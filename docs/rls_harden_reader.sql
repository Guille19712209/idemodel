-- =====================================================================
-- IdeModel — Endurecer el rol READER a nivel RLS  (sesión 34, 2026-06-28)
-- ---------------------------------------------------------------------
-- ANTES: las policies daban escritura a CUALQUIER miembro del modelo; el
--   rol `reader` solo se hacía cumplir en el cliente (guards de USER_ROLE).
--   Además convivían policies laxas heredadas (USING(true), acceso a `anon`).
-- DESPUÉS: la escritura (INSERT/UPDATE/DELETE) requiere rol owner|writer;
--   el `reader` queda en SOLO-LECTURA real, garantizado por la base de datos.
--
-- Idempotente y seguro de re-correr: borra TODAS las policies de las tablas
-- de datos y las recrea limpias. NO toca la tabla `users` (su SELECT abierto
-- es necesario para el buscador de colaboradores en Share).
--
-- Aplicar en: Supabase Dashboard → SQL Editor (o psql con la connection string).
-- Requiere que `is_model_owner(uuid)` ya exista (está en db_schema.sql).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Helpers SECURITY DEFINER (bypassan RLS → sin recursión)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_model_member(mid uuid) RETURNS boolean
  LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.model_users
    WHERE model_id = mid AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_write_model(mid uuid) RETURNS boolean
  LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.model_users
    WHERE model_id = mid AND user_id = auth.uid()
      AND role IN ('owner', 'writer')
  );
$$;

-- Resolución a través del nodo (para node_groups / node_parent_concepts)
CREATE OR REPLACE FUNCTION public.is_member_node(nid uuid) RETURNS boolean
  LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' STABLE AS $$
  SELECT public.is_model_member((SELECT model_id FROM public.nodes WHERE id = nid));
$$;
CREATE OR REPLACE FUNCTION public.can_write_node(nid uuid) RETURNS boolean
  LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' STABLE AS $$
  SELECT public.can_write_model((SELECT model_id FROM public.nodes WHERE id = nid));
$$;

-- Resolución a través del link (para link_concepts)
CREATE OR REPLACE FUNCTION public.is_member_link(lid uuid) RETURNS boolean
  LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' STABLE AS $$
  SELECT public.is_model_member((SELECT model_id FROM public.links WHERE id = lid));
$$;
CREATE OR REPLACE FUNCTION public.can_write_link(lid uuid) RETURNS boolean
  LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' STABLE AS $$
  SELECT public.can_write_model((SELECT model_id FROM public.links WHERE id = lid));
$$;

GRANT EXECUTE ON FUNCTION public.is_model_member(uuid)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_model(uuid)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_member_node(uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_node(uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_member_link(uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_link(uuid)   TO authenticated;

-- ---------------------------------------------------------------------
-- 2. Borrar TODAS las policies viejas de las tablas de datos
--    (incluye las laxas USING(true) y las de acceso `anon`)
-- ---------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'models','model_users','nodes','time_values','units','groups',
        'node_groups','concepts','links','link_concepts',
        'node_parent_concepts','layouts'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Asegurar RLS activado en todas
ALTER TABLE public.models               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nodes                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_values          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.node_groups          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concepts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.links                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.link_concepts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.node_parent_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.layouts              ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 3. Policies limpias.  Convención:
--    SELECT  = cualquier miembro (incluye reader)
--    WRITE   = solo owner|writer  (reader BLOQUEADO)
-- ---------------------------------------------------------------------

-- models -----------------------------------------------------------
CREATE POLICY models_select ON public.models FOR SELECT TO authenticated
  USING (public.is_model_member(id));
CREATE POLICY models_insert ON public.models FOR INSERT TO authenticated
  WITH CHECK (true);                              -- el alta se completa agregándose como owner en model_users
CREATE POLICY models_update ON public.models FOR UPDATE TO authenticated
  USING (public.can_write_model(id)) WITH CHECK (public.can_write_model(id));
CREATE POLICY models_delete ON public.models FOR DELETE TO authenticated
  USING (public.is_model_owner(id));             -- borrar modelo: solo owner

-- model_users (membresía / compartir) -----------------------------
CREATE POLICY mu_select ON public.model_users FOR SELECT TO authenticated
  USING (public.is_model_member(model_id));      -- ver co-miembros del modelo
CREATE POLICY mu_insert ON public.model_users FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_model_owner(model_id));  -- agregarse a sí mismo, o el owner invita
CREATE POLICY mu_update ON public.model_users FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_model_owner(model_id))        -- propio viewed/last_opened_at, o el owner cambia roles
  WITH CHECK (user_id = auth.uid() OR public.is_model_owner(model_id));
CREATE POLICY mu_delete ON public.model_users FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_model_owner(model_id));       -- salirse, o el owner expulsa

-- nodes ------------------------------------------------------------
CREATE POLICY nodes_select ON public.nodes FOR SELECT TO authenticated
  USING (public.is_model_member(model_id));
CREATE POLICY nodes_insert ON public.nodes FOR INSERT TO authenticated
  WITH CHECK (public.can_write_model(model_id));
CREATE POLICY nodes_update ON public.nodes FOR UPDATE TO authenticated
  USING (public.can_write_model(model_id)) WITH CHECK (public.can_write_model(model_id));
CREATE POLICY nodes_delete ON public.nodes FOR DELETE TO authenticated
  USING (public.can_write_model(model_id));

-- time_values ------------------------------------------------------
CREATE POLICY tv_select ON public.time_values FOR SELECT TO authenticated
  USING (public.is_model_member(model_id));
CREATE POLICY tv_insert ON public.time_values FOR INSERT TO authenticated
  WITH CHECK (public.can_write_model(model_id));
CREATE POLICY tv_update ON public.time_values FOR UPDATE TO authenticated
  USING (public.can_write_model(model_id)) WITH CHECK (public.can_write_model(model_id));
CREATE POLICY tv_delete ON public.time_values FOR DELETE TO authenticated
  USING (public.can_write_model(model_id));

-- units ------------------------------------------------------------
CREATE POLICY units_select ON public.units FOR SELECT TO authenticated
  USING (public.is_model_member(model_id));
CREATE POLICY units_insert ON public.units FOR INSERT TO authenticated
  WITH CHECK (public.can_write_model(model_id));
CREATE POLICY units_update ON public.units FOR UPDATE TO authenticated
  USING (public.can_write_model(model_id)) WITH CHECK (public.can_write_model(model_id));
CREATE POLICY units_delete ON public.units FOR DELETE TO authenticated
  USING (public.can_write_model(model_id));

-- groups -----------------------------------------------------------
CREATE POLICY groups_select ON public.groups FOR SELECT TO authenticated
  USING (public.is_model_member(model_id));
CREATE POLICY groups_insert ON public.groups FOR INSERT TO authenticated
  WITH CHECK (public.can_write_model(model_id));
CREATE POLICY groups_update ON public.groups FOR UPDATE TO authenticated
  USING (public.can_write_model(model_id)) WITH CHECK (public.can_write_model(model_id));
CREATE POLICY groups_delete ON public.groups FOR DELETE TO authenticated
  USING (public.can_write_model(model_id));

-- concepts ---------------------------------------------------------
CREATE POLICY concepts_select ON public.concepts FOR SELECT TO authenticated
  USING (public.is_model_member(model_id));
CREATE POLICY concepts_insert ON public.concepts FOR INSERT TO authenticated
  WITH CHECK (public.can_write_model(model_id));
CREATE POLICY concepts_update ON public.concepts FOR UPDATE TO authenticated
  USING (public.can_write_model(model_id)) WITH CHECK (public.can_write_model(model_id));
CREATE POLICY concepts_delete ON public.concepts FOR DELETE TO authenticated
  USING (public.can_write_model(model_id));

-- links ------------------------------------------------------------
CREATE POLICY links_select ON public.links FOR SELECT TO authenticated
  USING (public.is_model_member(model_id));
CREATE POLICY links_insert ON public.links FOR INSERT TO authenticated
  WITH CHECK (public.can_write_model(model_id));
CREATE POLICY links_update ON public.links FOR UPDATE TO authenticated
  USING (public.can_write_model(model_id)) WITH CHECK (public.can_write_model(model_id));
CREATE POLICY links_delete ON public.links FOR DELETE TO authenticated
  USING (public.can_write_model(model_id));

-- layouts ----------------------------------------------------------
CREATE POLICY layouts_select ON public.layouts FOR SELECT TO authenticated
  USING (public.is_model_member(model_id));
CREATE POLICY layouts_insert ON public.layouts FOR INSERT TO authenticated
  WITH CHECK (public.can_write_model(model_id));
CREATE POLICY layouts_update ON public.layouts FOR UPDATE TO authenticated
  USING (public.can_write_model(model_id)) WITH CHECK (public.can_write_model(model_id));
CREATE POLICY layouts_delete ON public.layouts FOR DELETE TO authenticated
  USING (public.can_write_model(model_id));

-- node_groups (N:N vía node) --------------------------------------
CREATE POLICY ng_select ON public.node_groups FOR SELECT TO authenticated
  USING (public.is_member_node(node_id));
CREATE POLICY ng_insert ON public.node_groups FOR INSERT TO authenticated
  WITH CHECK (public.can_write_node(node_id));
CREATE POLICY ng_delete ON public.node_groups FOR DELETE TO authenticated
  USING (public.can_write_node(node_id));

-- node_parent_concepts (N:N vía node) -----------------------------
CREATE POLICY npc_select ON public.node_parent_concepts FOR SELECT TO authenticated
  USING (public.is_member_node(node_id));
CREATE POLICY npc_insert ON public.node_parent_concepts FOR INSERT TO authenticated
  WITH CHECK (public.can_write_node(node_id));
CREATE POLICY npc_delete ON public.node_parent_concepts FOR DELETE TO authenticated
  USING (public.can_write_node(node_id));

-- link_concepts (N:N vía link) ------------------------------------
CREATE POLICY lc_select ON public.link_concepts FOR SELECT TO authenticated
  USING (public.is_member_link(link_id));
CREATE POLICY lc_insert ON public.link_concepts FOR INSERT TO authenticated
  WITH CHECK (public.can_write_link(link_id));
CREATE POLICY lc_delete ON public.link_concepts FOR DELETE TO authenticated
  USING (public.can_write_link(link_id));

-- ---------------------------------------------------------------------
-- 4. (Opcional) Revocar grants a `anon`. La app siempre autentica, así que
--    `anon` no necesita acceso. Descomentar para tightening total:
-- ---------------------------------------------------------------------
-- REVOKE ALL ON public.models, public.model_users, public.nodes,
--   public.time_values, public.units, public.groups, public.node_groups,
--   public.concepts, public.links, public.link_concepts,
--   public.node_parent_concepts, public.layouts FROM anon;

-- =====================================================================
-- VERIFICACIÓN rápida (correr aparte, logueado como reader):
--   UPDATE nodes SET color='#000' WHERE id='<algún nodo>';  -- debe afectar 0 filas
--   SELECT count(*) FROM nodes WHERE model_id='<modelo compartido>'; -- debe ver
-- =====================================================================
