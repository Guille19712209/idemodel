--
-- PostgreSQL database dump
--

\restrict 3UFhozSRtphKhfws9HRXp5Mz9bjdMnwDWZKGgjoxd7LUoaJOSdrhNROpqlIJhXm

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: is_model_owner(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_model_owner(mid uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT EXISTS (
      SELECT 1 FROM public.model_users
      WHERE model_id = mid
        AND user_id = auth.uid()
        AND role = 'owner'
    );
  $$;


--
-- Name: remove_model_user(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remove_model_user(p_model_id uuid, p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM model_users
      WHERE model_id = p_model_id
        AND user_id = auth.uid()
        AND role = 'owner'
    ) THEN
      RAISE EXCEPTION 'permission denied';
    END IF;

    DELETE FROM model_users
    WHERE model_id = p_model_id AND user_id = p_user_id;
  END;
  $$;


--
-- Name: sync_user_uuid(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_user_uuid(p_email text, p_new_uuid uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$  DECLARE
    p_old_uuid uuid;
  BEGIN
    SELECT id INTO p_old_uuid FROM users WHERE email = p_email;
    IF p_old_uuid IS NULL OR p_old_uuid = p_new_uuid THEN RETURN; END IF;
    UPDATE model_users SET user_id   = p_new_uuid WHERE user_id   = p_old_uuid;
    UPDATE models       SET last_user = p_new_uuid WHERE last_user = p_old_uuid;
    UPDATE users        SET id        = p_new_uuid WHERE id        = p_old_uuid;
  END; $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: concepts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.concepts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    model_id uuid,
    label text,
    color text,
    comment text
);


--
-- Name: groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    model_id uuid,
    name text,
    color text,
    comment text
);


--
-- Name: link_concepts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.link_concepts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    concept_id uuid NOT NULL,
    link_id uuid NOT NULL
);


--
-- Name: links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    model_id uuid,
    source_id uuid,
    target_id uuid,
    type text,
    CONSTRAINT links_type_check CHECK ((type = ANY (ARRAY['manual'::text, 'formula'::text, 'hierarchy'::text])))
);


--
-- Name: model_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.model_users (
    model_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text,
    viewed boolean DEFAULT false,
    CONSTRAINT model_users_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'writer'::text, 'reader'::text])))
);


--
-- Name: models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.models (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    workspace jsonb,
    background_color text,
    version text,
    periods integer,
    time_unit text,
    starting_date date,
    comments text,
    created_at timestamp without time zone DEFAULT now(),
    background_image_url text,
    last_review date,
    last_user uuid,
    parent_link boolean DEFAULT true,
    concept_link boolean,
    fomula_link boolean,
    view_level numeric DEFAULT '1'::numeric,
    show_hidden boolean,
    concepts text
);


--
-- Name: node_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.node_groups (
    node_id uuid NOT NULL,
    group_id uuid NOT NULL
);


--
-- Name: node_parent_concepts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.node_parent_concepts (
    node_id uuid NOT NULL,
    concept_id uuid NOT NULL
);


--
-- Name: nodes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nodes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    model_id uuid,
    label text NOT NULL,
    unit_id uuid,
    x numeric,
    y numeric,
    size_type text,
    size_type_h text,
    color text,
    shape text,
    parent uuid,
    alpha numeric(3,2) DEFAULT 0.00,
    comments text,
    size_px numeric,
    size_px_h numeric,
    hidden boolean,
    comment text,
    text_only boolean DEFAULT false,
    CONSTRAINT alpha_range CHECK (((alpha >= (0)::numeric) AND (alpha <= (1)::numeric)))
);


--
-- Name: time_values; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.time_values (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    model_id uuid,
    node_id uuid,
    period integer,
    formula text,
    value numeric
);


--
-- Name: units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.units (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    model_id uuid,
    name text,
    min_sz integer,
    max_sz integer,
    min_value numeric,
    max_value numeric,
    comment text,
    number_format text DEFAULT 'plain'::text
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    name text,
    status text DEFAULT 'ACTIVE'::text,
    created_at timestamp without time zone DEFAULT now(),
    color text,
    viewed boolean
);


--
-- Name: concepts concepts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concepts
    ADD CONSTRAINT concepts_pkey PRIMARY KEY (id);


--
-- Name: groups groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_pkey PRIMARY KEY (id);


--
-- Name: link_concepts link_concepts_link_concept_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.link_concepts
    ADD CONSTRAINT link_concepts_link_concept_unique UNIQUE (link_id, concept_id);


--
-- Name: link_concepts link_concepts_link_id_concept_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.link_concepts
    ADD CONSTRAINT link_concepts_link_id_concept_id_key UNIQUE (link_id, concept_id);


--
-- Name: link_concepts link_concepts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.link_concepts
    ADD CONSTRAINT link_concepts_pkey PRIMARY KEY (id, concept_id);


--
-- Name: links links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.links
    ADD CONSTRAINT links_pkey PRIMARY KEY (id);


--
-- Name: model_users model_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_users
    ADD CONSTRAINT model_users_pkey PRIMARY KEY (model_id, user_id);


--
-- Name: models models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.models
    ADD CONSTRAINT models_pkey PRIMARY KEY (id);


--
-- Name: node_groups node_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.node_groups
    ADD CONSTRAINT node_groups_pkey PRIMARY KEY (node_id, group_id);


--
-- Name: node_parent_concepts node_parent_concepts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.node_parent_concepts
    ADD CONSTRAINT node_parent_concepts_pkey PRIMARY KEY (node_id, concept_id);


--
-- Name: nodes nodes_model_id_label_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nodes
    ADD CONSTRAINT nodes_model_id_label_key UNIQUE (model_id, label);


--
-- Name: nodes nodes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nodes
    ADD CONSTRAINT nodes_pkey PRIMARY KEY (id);


--
-- Name: time_values time_values_node_id_period_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_values
    ADD CONSTRAINT time_values_node_id_period_key UNIQUE (node_id, period);


--
-- Name: time_values time_values_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_values
    ADD CONSTRAINT time_values_pkey PRIMARY KEY (id);


--
-- Name: link_concepts unique_link_concept; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.link_concepts
    ADD CONSTRAINT unique_link_concept UNIQUE (id, concept_id);


--
-- Name: units units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_links_model; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_links_model ON public.links USING btree (model_id);


--
-- Name: idx_nodes_model; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_nodes_model ON public.nodes USING btree (model_id);


--
-- Name: idx_time_values_model; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_time_values_model ON public.time_values USING btree (model_id);


--
-- Name: concepts concepts_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.concepts
    ADD CONSTRAINT concepts_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.models(id) ON DELETE CASCADE;


--
-- Name: groups groups_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.models(id) ON DELETE CASCADE;


--
-- Name: link_concepts link_concepts_concept_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.link_concepts
    ADD CONSTRAINT link_concepts_concept_id_fkey FOREIGN KEY (concept_id) REFERENCES public.concepts(id) ON DELETE CASCADE;


--
-- Name: link_concepts link_concepts_link_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.link_concepts
    ADD CONSTRAINT link_concepts_link_id_fkey FOREIGN KEY (link_id) REFERENCES public.links(id) ON DELETE CASCADE;


--
-- Name: links links_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.links
    ADD CONSTRAINT links_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.models(id) ON DELETE CASCADE;


--
-- Name: links links_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.links
    ADD CONSTRAINT links_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.nodes(id) ON DELETE CASCADE;


--
-- Name: links links_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.links
    ADD CONSTRAINT links_target_id_fkey FOREIGN KEY (target_id) REFERENCES public.nodes(id) ON DELETE CASCADE;


--
-- Name: model_users model_users_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_users
    ADD CONSTRAINT model_users_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.models(id) ON DELETE CASCADE;


--
-- Name: model_users model_users_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.model_users
    ADD CONSTRAINT model_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: models models_last_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.models
    ADD CONSTRAINT models_last_user_fkey FOREIGN KEY (last_user) REFERENCES public.users(id);


--
-- Name: node_groups node_groups_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.node_groups
    ADD CONSTRAINT node_groups_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE;


--
-- Name: node_groups node_groups_node_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.node_groups
    ADD CONSTRAINT node_groups_node_id_fkey FOREIGN KEY (node_id) REFERENCES public.nodes(id) ON DELETE CASCADE;


--
-- Name: node_parent_concepts node_parent_concepts_concept_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.node_parent_concepts
    ADD CONSTRAINT node_parent_concepts_concept_id_fkey FOREIGN KEY (concept_id) REFERENCES public.concepts(id) ON DELETE CASCADE;


--
-- Name: node_parent_concepts node_parent_concepts_node_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.node_parent_concepts
    ADD CONSTRAINT node_parent_concepts_node_id_fkey FOREIGN KEY (node_id) REFERENCES public.nodes(id) ON DELETE CASCADE;


--
-- Name: nodes nodes_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nodes
    ADD CONSTRAINT nodes_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.models(id) ON DELETE CASCADE;


--
-- Name: nodes nodes_parent_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nodes
    ADD CONSTRAINT nodes_parent_fkey FOREIGN KEY (parent) REFERENCES public.nodes(id);


--
-- Name: nodes nodes_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nodes
    ADD CONSTRAINT nodes_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: time_values time_values_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_values
    ADD CONSTRAINT time_values_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.models(id) ON DELETE CASCADE;


--
-- Name: time_values time_values_node_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_values
    ADD CONSTRAINT time_values_node_id_fkey FOREIGN KEY (node_id) REFERENCES public.nodes(id) ON DELETE CASCADE;


--
-- Name: units units_model_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.models(id) ON DELETE CASCADE;


--
-- Name: nodes Users can insert nodes for their models; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert nodes for their models" ON public.nodes FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.model_users
  WHERE ((model_users.model_id = nodes.model_id) AND (model_users.user_id = auth.uid())))));


--
-- Name: model_users Users can read their models; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read their models" ON public.model_users FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: concepts allow delete concepts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "allow delete concepts" ON public.concepts FOR DELETE USING (true);


--
-- Name: concepts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.concepts ENABLE ROW LEVEL SECURITY;

--
-- Name: concepts concepts open; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "concepts open" ON public.concepts FOR SELECT USING (true);


--
-- Name: concepts concepts select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "concepts select" ON public.concepts FOR SELECT TO authenticated USING ((model_id IN ( SELECT model_users.model_id
   FROM public.model_users
  WHERE (model_users.user_id = auth.uid()))));


--
-- Name: concepts concepts_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY concepts_insert ON public.concepts FOR INSERT WITH CHECK (true);


--
-- Name: concepts concepts_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY concepts_select ON public.concepts FOR SELECT USING (true);


--
-- Name: model_users delete model_users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "delete model_users" ON public.model_users FOR DELETE USING (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.model_users mu
  WHERE ((mu.model_id = model_users.model_id) AND (mu.user_id = auth.uid()) AND (mu.role = 'owner'::text))))));


--
-- Name: groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

--
-- Name: groups groups open; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "groups open" ON public.groups FOR SELECT USING (true);


--
-- Name: groups groups select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "groups select" ON public.groups FOR SELECT TO authenticated USING ((model_id IN ( SELECT model_users.model_id
   FROM public.model_users
  WHERE (model_users.user_id = auth.uid()))));


--
-- Name: link_concepts lc_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lc_delete ON public.link_concepts FOR DELETE USING (true);


--
-- Name: link_concepts lc_delete_secure; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lc_delete_secure ON public.link_concepts FOR DELETE USING ((EXISTS ( SELECT 1
   FROM (public.links l
     JOIN public.model_users mu ON ((mu.model_id = l.model_id)))
  WHERE ((l.id = link_concepts.id) AND (mu.user_id = auth.uid())))));


--
-- Name: link_concepts lc_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lc_insert ON public.link_concepts FOR INSERT WITH CHECK (true);


--
-- Name: link_concepts lc_insert_secure; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lc_insert_secure ON public.link_concepts FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.links l
     JOIN public.model_users mu ON ((mu.model_id = l.model_id)))
  WHERE ((l.id = link_concepts.id) AND (mu.user_id = auth.uid())))));


--
-- Name: link_concepts lc_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lc_select ON public.link_concepts FOR SELECT USING (true);


--
-- Name: link_concepts lc_select_secure; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lc_select_secure ON public.link_concepts FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.links l
     JOIN public.model_users mu ON ((mu.model_id = l.model_id)))
  WHERE ((l.id = link_concepts.id) AND (mu.user_id = auth.uid())))));


--
-- Name: link_concepts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.link_concepts ENABLE ROW LEVEL SECURITY;

--
-- Name: links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.links ENABLE ROW LEVEL SECURITY;

--
-- Name: links links access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "links access" ON public.links USING ((model_id IN ( SELECT model_users.model_id
   FROM public.model_users
  WHERE (model_users.user_id = auth.uid()))));


--
-- Name: links links open; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "links open" ON public.links FOR SELECT USING (true);


--
-- Name: links links select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "links select" ON public.links FOR SELECT TO authenticated USING ((model_id IN ( SELECT model_users.model_id
   FROM public.model_users
  WHERE (model_users.user_id = auth.uid()))));


--
-- Name: model_users model update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "model update" ON public.model_users FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.model_users model_users_1
  WHERE ((model_users_1.model_id = model_users_1.model_id) AND (model_users_1.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.model_users model_users_1
  WHERE ((model_users_1.model_id = model_users_1.model_id) AND (model_users_1.user_id = auth.uid())))));


--
-- Name: model_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.model_users ENABLE ROW LEVEL SECURITY;

--
-- Name: model_users model_users access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "model_users access" ON public.model_users USING ((user_id = auth.uid()));


--
-- Name: model_users model_users insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "model_users insert" ON public.model_users FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: model_users model_users open; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "model_users open" ON public.model_users FOR SELECT USING (true);


--
-- Name: model_users model_users select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "model_users select" ON public.model_users FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: model_users model_users_select_open; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY model_users_select_open ON public.model_users FOR SELECT TO authenticated USING (true);


--
-- Name: models; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;

--
-- Name: models models access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "models access" ON public.models USING ((id IN ( SELECT model_users.model_id
   FROM public.model_users
  WHERE (model_users.user_id = auth.uid()))));


--
-- Name: models models insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "models insert" ON public.models FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: models models open; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "models open" ON public.models FOR SELECT USING (true);


--
-- Name: models models select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "models select" ON public.models FOR SELECT TO authenticated USING ((id IN ( SELECT model_users.model_id
   FROM public.model_users
  WHERE (model_users.user_id = auth.uid()))));


--
-- Name: models models update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "models update" ON public.models FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.model_users mu
  WHERE ((mu.model_id = models.id) AND (mu.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.model_users mu
  WHERE ((mu.model_id = models.id) AND (mu.user_id = auth.uid())))));


--
-- Name: models models_select_open; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY models_select_open ON public.models FOR SELECT TO authenticated USING (true);


--
-- Name: node_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.node_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: node_groups node_groups open; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "node_groups open" ON public.node_groups FOR SELECT USING (true);


--
-- Name: node_groups node_groups select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "node_groups select" ON public.node_groups FOR SELECT TO authenticated USING ((node_id IN ( SELECT nodes.id
   FROM public.nodes
  WHERE (nodes.model_id IN ( SELECT model_users.model_id
           FROM public.model_users
          WHERE (model_users.user_id = auth.uid()))))));


--
-- Name: node_parent_concepts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.node_parent_concepts ENABLE ROW LEVEL SECURITY;

--
-- Name: nodes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.nodes ENABLE ROW LEVEL SECURITY;

--
-- Name: nodes nodes access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "nodes access" ON public.nodes USING ((model_id IN ( SELECT model_users.model_id
   FROM public.model_users
  WHERE (model_users.user_id = auth.uid()))));


--
-- Name: nodes nodes open; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "nodes open" ON public.nodes FOR SELECT USING (true);


--
-- Name: nodes nodes select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "nodes select" ON public.nodes FOR SELECT TO authenticated USING ((model_id IN ( SELECT model_users.model_id
   FROM public.model_users
  WHERE (model_users.user_id = auth.uid()))));


--
-- Name: nodes nodes update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "nodes update" ON public.nodes FOR UPDATE TO authenticated USING ((model_id IN ( SELECT model_users.model_id
   FROM public.model_users
  WHERE (model_users.user_id = auth.uid())))) WITH CHECK ((model_id IN ( SELECT model_users.model_id
   FROM public.model_users
  WHERE (model_users.user_id = auth.uid()))));


--
-- Name: model_users open select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "open select" ON public.model_users FOR SELECT TO anon USING (true);


--
-- Name: model_users owners can delete model_users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners can delete model_users" ON public.model_users FOR DELETE USING (public.is_model_owner(model_id));


--
-- Name: models owners can delete models; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owners can delete models" ON public.models FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.model_users
  WHERE ((model_users.model_id = models.id) AND (model_users.user_id = auth.uid()) AND (model_users.role = 'owner'::text)))));


--
-- Name: time_values; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.time_values ENABLE ROW LEVEL SECURITY;

--
-- Name: time_values time_values access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "time_values access" ON public.time_values USING ((model_id IN ( SELECT model_users.model_id
   FROM public.model_users
  WHERE (model_users.user_id = auth.uid()))));


--
-- Name: time_values time_values open; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "time_values open" ON public.time_values FOR SELECT USING (true);


--
-- Name: time_values time_values select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "time_values select" ON public.time_values FOR SELECT TO authenticated USING ((model_id IN ( SELECT model_users.model_id
   FROM public.model_users
  WHERE (model_users.user_id = auth.uid()))));


--
-- Name: time_values time_values update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "time_values update" ON public.time_values FOR UPDATE TO authenticated USING ((model_id IN ( SELECT model_users.model_id
   FROM public.model_users
  WHERE (model_users.user_id = auth.uid())))) WITH CHECK ((model_id IN ( SELECT model_users.model_id
   FROM public.model_users
  WHERE (model_users.user_id = auth.uid()))));


--
-- Name: units; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

--
-- Name: units units_insert_open; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY units_insert_open ON public.units FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: units units_select_open; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY units_select_open ON public.units FOR SELECT TO authenticated USING (true);


--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: concepts users can delete concepts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can delete concepts" ON public.concepts FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.model_users
  WHERE ((model_users.model_id = concepts.model_id) AND (model_users.user_id = auth.uid())))));


--
-- Name: link_concepts users can delete link_concepts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can delete link_concepts" ON public.link_concepts FOR DELETE USING ((EXISTS ( SELECT 1
   FROM (public.links l
     JOIN public.model_users mu ON ((mu.model_id = l.model_id)))
  WHERE ((l.id = link_concepts.link_id) AND (mu.user_id = auth.uid())))));


--
-- Name: links users can delete links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can delete links" ON public.links FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.model_users
  WHERE ((model_users.model_id = links.model_id) AND (model_users.user_id = auth.uid())))));


--
-- Name: node_groups users can delete node_groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can delete node_groups" ON public.node_groups FOR DELETE USING ((EXISTS ( SELECT 1
   FROM (public.nodes n
     JOIN public.model_users mu ON ((mu.model_id = n.model_id)))
  WHERE ((n.id = node_groups.node_id) AND (mu.user_id = auth.uid())))));


--
-- Name: node_parent_concepts users can delete node_parent_concepts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can delete node_parent_concepts" ON public.node_parent_concepts FOR DELETE USING ((EXISTS ( SELECT 1
   FROM (public.nodes n
     JOIN public.model_users mu ON ((mu.model_id = n.model_id)))
  WHERE ((n.id = node_parent_concepts.node_id) AND (mu.user_id = auth.uid())))));


--
-- Name: time_values users can delete time_values; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can delete time_values" ON public.time_values FOR DELETE USING ((EXISTS ( SELECT 1
   FROM (public.nodes n
     JOIN public.model_users mu ON ((mu.model_id = n.model_id)))
  WHERE ((n.id = time_values.node_id) AND (mu.user_id = auth.uid())))));


--
-- Name: concepts users can insert concepts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can insert concepts" ON public.concepts FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.model_users
  WHERE ((model_users.model_id = concepts.model_id) AND (model_users.user_id = auth.uid())))));


--
-- Name: groups users can insert groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can insert groups" ON public.groups FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.model_users
  WHERE ((model_users.model_id = groups.model_id) AND (model_users.user_id = auth.uid())))));


--
-- Name: link_concepts users can insert link_concepts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can insert link_concepts" ON public.link_concepts FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.links l
     JOIN public.model_users mu ON ((mu.model_id = l.model_id)))
  WHERE ((l.id = link_concepts.link_id) AND (mu.user_id = auth.uid())))));


--
-- Name: links users can insert links; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can insert links" ON public.links FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.model_users
  WHERE ((model_users.model_id = links.model_id) AND (model_users.user_id = auth.uid())))));


--
-- Name: node_groups users can insert node_groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can insert node_groups" ON public.node_groups FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.nodes n
     JOIN public.model_users mu ON ((mu.model_id = n.model_id)))
  WHERE ((n.id = node_groups.node_id) AND (mu.user_id = auth.uid())))));


--
-- Name: node_parent_concepts users can insert node_parent_concepts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can insert node_parent_concepts" ON public.node_parent_concepts FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.nodes n
     JOIN public.model_users mu ON ((mu.model_id = n.model_id)))
  WHERE ((n.id = node_parent_concepts.node_id) AND (mu.user_id = auth.uid())))));


--
-- Name: nodes users can insert own model nodes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can insert own model nodes" ON public.nodes FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.model_users
  WHERE ((model_users.model_id = nodes.model_id) AND (model_users.user_id = auth.uid())))));


--
-- Name: time_values users can insert time_values; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can insert time_values" ON public.time_values FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.model_users
  WHERE ((model_users.model_id = time_values.model_id) AND (model_users.user_id = auth.uid())))));


--
-- Name: users users can read own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can read own" ON public.users FOR SELECT USING ((auth.uid() = id));


--
-- Name: concepts users can select concepts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can select concepts" ON public.concepts FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.model_users
  WHERE ((model_users.model_id = concepts.model_id) AND (model_users.user_id = auth.uid())))));


--
-- Name: link_concepts users can select link_concepts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can select link_concepts" ON public.link_concepts FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.links l
     JOIN public.model_users mu ON ((mu.model_id = l.model_id)))
  WHERE ((l.id = link_concepts.link_id) AND (mu.user_id = auth.uid())))));


--
-- Name: node_groups users can select node_groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can select node_groups" ON public.node_groups FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.nodes n
     JOIN public.model_users mu ON ((mu.model_id = n.model_id)))
  WHERE ((n.id = node_groups.node_id) AND (mu.user_id = auth.uid())))));


--
-- Name: node_parent_concepts users can select node_parent_concepts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can select node_parent_concepts" ON public.node_parent_concepts FOR SELECT USING (true);


--
-- Name: concepts users can update concepts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can update concepts" ON public.concepts FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.model_users
  WHERE ((model_users.model_id = concepts.model_id) AND (model_users.user_id = auth.uid())))));


--
-- Name: groups users can update groups; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can update groups" ON public.groups FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.model_users
  WHERE ((model_users.model_id = groups.model_id) AND (model_users.user_id = auth.uid())))));


--
-- Name: time_values users can update time_values; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can update time_values" ON public.time_values FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.model_users
  WHERE ((model_users.model_id = time_values.model_id) AND (model_users.user_id = auth.uid())))));


--
-- Name: units users can update units; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users can update units" ON public.units FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.model_users
  WHERE ((model_users.model_id = units.model_id) AND (model_users.user_id = auth.uid())))));


--
-- Name: users users insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users insert" ON public.users FOR INSERT TO authenticated WITH CHECK ((id = auth.uid()));


--
-- Name: users users open; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users open" ON public.users FOR SELECT USING (true);


--
-- Name: users users self insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users self insert" ON public.users FOR INSERT TO authenticated WITH CHECK ((id = auth.uid()));


--
-- Name: users users self select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users self select" ON public.users FOR SELECT TO authenticated USING ((id = auth.uid()));


--
-- Name: users users update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "users update" ON public.users FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));


--
-- Name: time_values values open; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "values open" ON public.time_values FOR SELECT USING (true);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;


--
-- Name: FUNCTION remove_model_user(p_model_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.remove_model_user(p_model_id uuid, p_user_id uuid) TO authenticated;


--
-- Name: FUNCTION sync_user_uuid(p_email text, p_new_uuid uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.sync_user_uuid(p_email text, p_new_uuid uuid) TO authenticated;


--
-- Name: TABLE concepts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.concepts TO anon;
GRANT ALL ON TABLE public.concepts TO authenticated;


--
-- Name: TABLE groups; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.groups TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.groups TO authenticated;


--
-- Name: TABLE link_concepts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.link_concepts TO anon;
GRANT ALL ON TABLE public.link_concepts TO authenticated;


--
-- Name: TABLE links; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.links TO anon;
GRANT SELECT,INSERT,DELETE ON TABLE public.links TO authenticated;


--
-- Name: TABLE model_users; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.model_users TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.model_users TO authenticated;


--
-- Name: TABLE models; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.models TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.models TO authenticated;


--
-- Name: TABLE node_groups; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.node_groups TO anon;
GRANT SELECT,INSERT,DELETE ON TABLE public.node_groups TO authenticated;


--
-- Name: TABLE node_parent_concepts; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE ON TABLE public.node_parent_concepts TO authenticated;


--
-- Name: TABLE nodes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,UPDATE ON TABLE public.nodes TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.nodes TO authenticated;


--
-- Name: TABLE time_values; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.time_values TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.time_values TO authenticated;


--
-- Name: TABLE units; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.units TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.units TO authenticated;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.users TO anon;
GRANT SELECT,INSERT,UPDATE ON TABLE public.users TO authenticated;


--
-- PostgreSQL database dump complete
--

\unrestrict 3UFhozSRtphKhfws9HRXp5Mz9bjdMnwDWZKGgjoxd7LUoaJOSdrhNROpqlIJhXm


-- =====================================================================
-- DELTAS POST-DUMP (idempotentes) — agregados a mano
-- ---------------------------------------------------------------------
-- El dump de arriba se generó en una sesión vieja (~sesión 26/27) y no
-- incluye cambios posteriores. Este bloque deja el schema AL DÍA y es
-- seguro de re-correr (todo IF NOT EXISTS / IF EXISTS). Ideal: regenerar
-- el dump completo con pg_dump y borrar este apéndice. Ver SUPABASE_MIGRATION.md.
--
-- ⚠️ RLS: las policies que muestra el dump de arriba están OBSOLETAS (laxas,
--    USING(true), acceso a `anon`, escritura para cualquier miembro). El estado
--    real de producción las reemplaza por las de `docs/rls_harden_reader.sql`
--    (sesión 34): reader = solo-lectura, escritura solo owner|writer. Correr ese
--    archivo DESPUÉS de este para quedar en el estado endurecido.
-- =====================================================================

-- nodes: columnas nuevas (sesiones 26 y 28)
ALTER TABLE public.nodes ADD COLUMN IF NOT EXISTS hide_when  text;       -- condición booleana de visibilidad por período (sesión 26)
ALTER TABLE public.nodes ADD COLUMN IF NOT EXISTS text_auto  boolean DEFAULT true;  -- text_only: tamaños de fuente auto vs. manual (sesión 28)
ALTER TABLE public.nodes ADD COLUMN IF NOT EXISTS text_label real;
ALTER TABLE public.nodes ADD COLUMN IF NOT EXISTS text_value real;
ALTER TABLE public.nodes ADD COLUMN IF NOT EXISTS text_unit  real;

-- models: biblioteca de shapes-polígono custom del modelo (sesión 30)
ALTER TABLE public.models ADD COLUMN IF NOT EXISTS custom_shapes jsonb DEFAULT '[]'::jsonb;

-- models: gráficos guardados de "Values in graphics" (sesión 37). Ver docs/charts_column.sql.
-- jsonb = [{ id, name, type, valueMode, title, filter }] — config de vista VIVA (no datos).
ALTER TABLE public.models ADD COLUMN IF NOT EXISTS charts jsonb NOT NULL DEFAULT '[]'::jsonb;

-- model_users: último abierto (fuente de verdad del orden de "Open"), sesión 19
ALTER TABLE public.model_users ADD COLUMN IF NOT EXISTS last_opened_at timestamptz;
-- backfill una sola vez desde models.last_review
UPDATE public.model_users mu SET last_opened_at = m.last_review::timestamptz
  FROM public.models m WHERE m.id = mu.model_id AND mu.last_opened_at IS NULL;

-- =====================================================================
-- TABLA layouts — disposiciones custom por modelo (sesión 25)
-- data jsonb = { positions, filter, workspace }. Los presets algorítmicos
-- (Parent-Circular-Grid / -Tree / Value-Compare) NO se guardan acá.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.layouts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id   uuid NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
  name       text NOT NULL,
  data       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.layouts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.layouts TO authenticated;

DROP POLICY IF EXISTS "select layouts" ON public.layouts;
CREATE POLICY "select layouts" ON public.layouts FOR SELECT
  USING (model_id IN (SELECT model_id FROM public.model_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "insert layouts" ON public.layouts;
CREATE POLICY "insert layouts" ON public.layouts FOR INSERT
  WITH CHECK (model_id IN (SELECT model_id FROM public.model_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "update layouts" ON public.layouts;
CREATE POLICY "update layouts" ON public.layouts FOR UPDATE
  USING (model_id IN (SELECT model_id FROM public.model_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "delete layouts" ON public.layouts;
CREATE POLICY "delete layouts" ON public.layouts FOR DELETE
  USING (model_id IN (SELECT model_id FROM public.model_users WHERE user_id = auth.uid()));

