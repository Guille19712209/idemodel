# IdeModel — Guía de migración de Supabase

> Documento de referencia para **reconstruir el backend de IdeModel en otro proyecto de
> Supabase** (o migrar a otro Postgres + Auth + Storage). Captura **todo** lo que vive en
> Supabase, incluido lo que un `pg_dump` del schema `public` **no** ve: keys del cliente,
> proveedor de Auth, bucket de Storage y el orden de pasos.
>
> Fuentes que complementan este doc:
> - `docs/db_schema.sql` — pg_dump del schema `public` (tablas + constraints + índices +
>   funciones + RLS + grants) **+ un apéndice de deltas idempotentes al final** que lo deja al día.
> - `docs/STATE_NOW.md` — historia y razón de cada cambio de schema, sesión por sesión.

---

## 1. Resumen de qué hay en Supabase

| Componente | Detalle |
|---|---|
| **PostgreSQL** | 14 tablas en `public` + 3 funciones `SECURITY DEFINER`. Todo con RLS activado. |
| **Auth** | Un solo proveedor: **Google OAuth**. Sesión JWT estándar de Supabase. |
| **Storage** | Un bucket: **`model-backgrounds`** (público), imágenes de fondo de los modelos. |
| **Cliente** | Browser, vanilla JS. `@supabase/supabase-js` vía ESM CDN. Sin backend propio ni service-role. |

No hay Edge Functions, ni Realtime, ni cron/pg_cron, ni triggers de DB. Toda la lógica corre
en el browser con la **anon/publishable key** y RLS como única frontera de seguridad.

---

## 2. Conexión y keys (cliente)

Definido en `docs/js/api.js`:

```js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

export const supabaseClient = createClient(
  "https://rgfftmdxmsftgxmevpqj.supabase.co",   // Project URL  ← cambiar al migrar
  "sb_publishable_tNeS3BfRScwEchCnj6H_-w_YiZF_49N" // Publishable (anon) key ← cambiar al migrar
);
```

- Estos dos valores son **públicos por diseño** (van en el JS servido por GitHub Pages). La
  seguridad real es RLS, no la key. Al migrar, reemplazar ambos por los del nuevo proyecto.
- No se usa la **service-role key** en ningún lado (correcto: nunca debe ir al browser).

---

## 3. Auth — Google OAuth

`api.js` → `init()`: si no hay sesión, dispara login con Google y vuelve a la misma URL.

```js
await supabaseClient.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: window.location.href }
});
```

**Pasos en el dashboard del nuevo proyecto (Authentication → Providers → Google):**

1. Habilitar Google. Cargar `Client ID` / `Client Secret` de un proyecto de Google Cloud OAuth.
2. En Google Cloud Console, agregar el **redirect URI** de Supabase:
   `https://<NEW_PROJECT_REF>.supabase.co/auth/v1/callback`.
3. En Supabase → Authentication → URL Configuration: agregar el **Site URL** y los
   **Redirect URLs** permitidos: `https://idemodel.app`, y para dev `http://localhost:8000/*`.
   (El código usa `redirectTo: window.location.href`, así que toda URL desde la que se loguea
   debe estar en la allowlist.)

**Vínculo `auth.users` → `public.users`:** NO hay trigger de DB. El alta en la tabla `public.users`
la hace el **cliente** en `api.js` durante `init()` (valida/inserta la fila del usuario por
`auth.uid()`), respaldado por las policies `users self insert` / `users insert`. Además existe la
función `sync_user_uuid(email, new_uuid)` para re-mapear el `id` de un usuario si cambia su uuid
de Auth (p. ej. al recrear la cuenta) sin perder sus modelos. → no se requiere configurar nada
extra de Auth más allá del proveedor.

---

## 4. Storage — bucket `model-backgrounds`

Imágenes de fondo de los modelos (chip Background → Image). Definido en
`docs/js/ui/settings-panel.js`.

- **Bucket:** `model-backgrounds`, **público** (se usa `getPublicUrl`, no signed URLs).
- **Convención de path:** `"{model_id}/background_{timestamp}.{ext}"`. Antes de subir, borra
  todos los archivos previos de ese `model_id` (`list(modelId)` + `remove`).
- **Límite de tamaño:** 2 MB (validado en el cliente).
- La URL pública resultante se persiste en `models.background_image_url`.

**Pasos en el dashboard del nuevo proyecto (Storage):**

1. Crear bucket `model-backgrounds` con **Public = ON**.
2. Policies de Storage (sobre `storage.objects`). El cliente sube/lista/borra con la sesión del
   usuario; las imágenes se sirven públicas. Policy mínima sugerida:

```sql
-- Lectura pública de los fondos
CREATE POLICY "bg public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'model-backgrounds');

-- Subir / actualizar / borrar: cualquier usuario autenticado (el cliente ya namespacea por model_id)
CREATE POLICY "bg authenticated write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'model-backgrounds');
CREATE POLICY "bg authenticated update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'model-backgrounds');
CREATE POLICY "bg authenticated delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'model-backgrounds');
```

> Si se quiere endurecer: extraer el `model_id` del primer segmento del path
> (`split_part(name,'/',1)::uuid`) y exigir que el usuario sea miembro de ese modelo en
> `model_users`. Hoy producción usa la versión laxa de arriba.

> **Nota — shapes custom NO usan Storage.** La biblioteca de shapes-polígono del usuario vive
> en la columna `models.custom_shapes` (jsonb), no en un bucket. (Históricamente hubo un intento
> con bucket; quedó descartado — ver STATE_NOW sesión 30.)

---

## 5. Base de datos (schema `public`)

### 5.1 Cómo recrearla

Correr `docs/db_schema.sql` completo contra el nuevo proyecto (incluye el apéndice de deltas
idempotentes al final → schema **al día**). Lo más limpio para una migración real, sin embargo,
es **regenerar** el dump desde producción justo antes de migrar:

```bash
# requiere la connection string del proyecto (Settings → Database)
pg_dump --schema-only --schema=public "<CONNECTION_STRING>" > docs/db_schema.sql
# para llevar también los datos:
pg_dump --schema=public "<CONNECTION_STRING>" > full_backup.sql
```

Supabase también permite branching / `supabase db dump` con la CLI si se adopta ese flujo.

### 5.2 Tablas (14)

Todas con `model_id` como eje de pertenencia y RLS basada en membresía vía `model_users`.

| Tabla | Rol |
|---|---|
| `users` | Espejo de `auth.users` (email, name, color, status). |
| `models` | El modelo. Incluye `workspace` jsonb (zoom/pan/expandedEdges/conceptsMode), `custom_shapes` jsonb, flags de vista (`parent_link`, `concept_link`, `fomula_link` [sic], `view_level`, `show_hidden`), `background_color`, `background_image_url`, `last_review`, `last_user`. |
| `model_users` | Membresía + rol (`owner`/`writer`/`reader`) + `viewed` + `last_opened_at`. PK `(model_id,user_id)`. |
| `units` | Unidades del modelo. `number_format` (`plain`/`integer`/`decimal2`/`accounting`/`percent`). |
| `nodes` | Nodos. `parent` (FK self → fuente de verdad del edge parent), `unit_id`, `x/y`, `size_px(_h)`/`size_type(_h)`, `color`, `shape`, `alpha`, `hidden`, `hide_when` (condición), `text_only` + `text_auto/text_label/text_value/text_unit`, `comment`. Único `(model_id, label)`. |
| `time_values` | `(node_id, period)` con `formula` (texto = fuente de verdad) y `value` (numérico, derivado/no canónico). Único `(node_id, period)`. |
| `groups` | Grupos del modelo (name, color, comment). |
| `node_groups` | N:N nodo↔grupo. PK `(node_id, group_id)`. |
| `concepts` | Conceptos del modelo (label, color, comment). |
| `links` | Edges persistidos. `type` ∈ `manual`/`formula`/`hierarchy`. **Solo los `manual` se usan en runtime** (parent y formula se derivan). |
| `link_concepts` | N:N link↔concepto. |
| `node_parent_concepts` | N:N nodo↔concepto (concepto "padre" del nodo). PK `(node_id, concept_id)`. |
| `layouts` | Disposiciones custom por modelo. `data` jsonb = `{positions, filter, workspace}`. |

### 5.3 Funciones (`SECURITY DEFINER`)

| Función | Para qué |
|---|---|
| `is_model_owner(mid uuid) → bool` | Helper de RLS: ¿el `auth.uid()` es owner del modelo? |
| `is_model_member(mid uuid) → bool` | Helper de RLS (sesión 34): ¿es miembro (cualquier rol)? |
| `can_write_model(mid uuid) → bool` | Helper de RLS (sesión 34): ¿es owner|writer? Gate de escritura. |
| `is_member_node` / `can_write_node` (nid uuid) | Igual, resolviendo el modelo a través del nodo (tablas N:N por `node_id`). |
| `is_member_link` / `can_write_link` (lid uuid) | Igual, a través del link (`link_concepts`). |
| `remove_model_user(model_id, user_id)` | Borra una membresía bypassando RLS (solo si quien llama es owner). Usado por el panel Share. |
| `sync_user_uuid(email, new_uuid)` | Re-mapea el `id` de un usuario (model_users/models/users) si cambia su uuid de Auth. |

### 5.4 RLS — modelo de seguridad

- **Patrón general:** una fila es visible/editable si su `model_id` está en
  `(SELECT model_id FROM model_users WHERE user_id = auth.uid())`. Las tablas N:N validan
  saltando a `nodes`/`links` para llegar al `model_id`.
- **Borrado de modelo** (`models` DELETE): solo `owner` (policy `owners can delete models`).
- **Roles** (`owner`/`writer`/`reader`) — **endurecidos a nivel RLS** (sesión 34, ver
  `docs/rls_harden_reader.sql`):
  - **SELECT** → cualquier miembro del modelo (incluye `reader`).
  - **INSERT/UPDATE/DELETE** → solo `owner`|`writer` (helper `can_write_model`). El `reader`
    queda en **solo-lectura real garantizado por la base** (antes solo lo frenaban los guards de
    `USER_ROLE` en el cliente).
  - **DELETE de un modelo** → solo `owner` (`is_model_owner`).
  - **`model_users`**: ver co-miembros = cualquier miembro; agregarse a sí mismo o invitar = owner;
    cambiar roles / expulsar = owner; un usuario puede actualizar su propia fila
    (`viewed`/`last_opened_at`) y salirse del modelo.
  - El cliente **mantiene** sus guards de `USER_ROLE` como UX (esconde badges/acciones); RLS es la
    frontera dura. Los dos niveles son complementarios.
- ⚠️ **Policies laxas heredadas (ya purgadas por la migración de sesión 34):** el `db_schema.sql`
  (dump viejo) todavía muestra varias policies `*_open` / `*open*` con `USING (true)` y acceso a
  `anon`. **`docs/rls_harden_reader.sql` las borra todas** (DROP de toda policy de las tablas de
  datos) y recrea solo el set limpio basado en rol. En un proyecto nuevo: correr el dump y **luego**
  `rls_harden_reader.sql` para quedar en el estado endurecido. (Cuando se regenere el dump, ya
  reflejará solo las policies limpias y este archivo deja de ser necesario.)

### 5.5 Grants

`anon` y `authenticated` tienen `USAGE` sobre `public`. Los grants por tabla están en el dump
(sección ACL). En general `authenticated` tiene `SELECT,INSERT,UPDATE,DELETE` según necesidad y
`anon` mayormente `SELECT` (acceso de solo-lectura no aprovechado por la app actual, que siempre
loguea). Igual que con las policies, candidatos a podar al migrar.

---

## 6. Runbook de migración (orden sugerido)

1. **Crear proyecto** nuevo en Supabase. Anotar Project URL + publishable (anon) key.
2. **Auth:** habilitar Google (sección 3) + cargar redirect URLs.
3. **DB:** correr `docs/db_schema.sql` (o un dump fresco) contra el nuevo proyecto **y luego
   `docs/rls_harden_reader.sql`** (purga policies laxas + endurece `reader` por rol). Verificar que
   las 14 tablas, las funciones, RLS y grants quedaron. Si se migran datos, importar el
   `full_backup.sql` (respetando orden de FKs; los `INSERT` del dump ya vienen ordenados).
4. **Storage:** crear bucket público `model-backgrounds` + policies (sección 4). Si se migran las
   imágenes existentes, copiarlas manteniendo el path `{model_id}/...` y luego **reescribir**
   `models.background_image_url` para que apunten al nuevo dominio de storage.
5. **Migrar usuarios:** si los `auth.uid()` cambian (proyecto nuevo = uuids nuevos), usar
   `sync_user_uuid(email, new_uuid)` por cada usuario tras su primer login, o pre-cargar la tabla
   `public.users` y dejar que `init()` reconcilie. Las FKs `model_users.user_id`/`models.last_user`
   dependen de esto.
6. **Frontend:** actualizar las dos constantes en `docs/js/api.js` (URL + key). Bumpear el token
   `?v=NN` (ver CLAUDE.md) y deployar.
7. **Verificar:** login Google → abre un modelo → editar nodo/fórmula persiste → subir imagen de
   fondo → compartir modelo (Share) → borrar un modelo (owner). Cubre RLS, Storage y las RPC.

---

## 7. Checklist de lo que NO está en el pg_dump (y hay que rehacer a mano)

- [ ] Proveedor **Google OAuth** + Client ID/Secret + redirect URLs.
- [ ] Bucket **`model-backgrounds`** (público) + sus policies de `storage.objects`.
- [ ] Las dos constantes (URL + anon key) en `docs/js/api.js`.
- [ ] Migración/reconciliación de `auth.users` ↔ `public.users` (uuids).
- [ ] Reescritura de `models.background_image_url` si cambia el dominio de Storage.
- [ ] Correr `docs/rls_harden_reader.sql` después del schema (purga policies laxas + endurece `reader`).
- [ ] (Opcional) Revocar grants a `anon` (bloque comentado al final de `rls_harden_reader.sql`).
