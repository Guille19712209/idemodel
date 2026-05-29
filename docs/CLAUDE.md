# IDEMODEL — Contexto de Sesión
Última actualización: 29/05/2026 (sesión 3)
Con: Claude Sonnet 4.6

---

## EL PROYECTO
IdeModel es una tool para generar modelos integrales de funcionamiento de ideas. Permite desarrollar, analizar y compartir ideas de manera visual, definiendo relaciones cualicuantitativas entre elementos. El resultado es un sistema representado en un grafo. Las variaciones pueden desplegarse en una línea de tiempo.
Aspiración central: ser una externalización de un modelo mental individual que, una vez expresado, sirve como punto de partida para construir un modelo mental colectivo.
URL: idemodel.app
Autor: Guille (arquitecto, no IT)

---

## STACK
| Capa | Tecnología |
|---|---|
| Frontend | HTML + CSS + JavaScript Vanilla |
| Motor gráfico | Cytoscape.js |
| Backend | Supabase + PostgreSQL |

Sin frameworks: decisión arquitectónica de control total de UI.

---

## ARQUITECTURA — PRINCIPIOS CONGELADOS

- **Edges derivados**: no se persisten. Se derivan runtime desde atributos del nodo (parent, concept, formulas)
- **Modelo desacoplado del renderer**: el modelo existe independientemente de Cytoscape
- **ID ≠ Label**: ID técnico estable, Label humano editable
- **Persistencia real**: Supabase/Postgres con auth, queue, API layer

---

## ESTRUCTURA DE ARCHIVOS CLAVE

```
docs/js/
  api.js              ← ARCHIVO VIEJO (aún activo, contiene queueNodeData + queueValueData)
  ui.js               ← MAPEO REAL de datos Supabase → Cytoscape (línea ~367)
  graph.js            ← renderGraph, eventos, workspace, createNewNode, removeNode
  engine.js           ← handleData, state, fórmulas

  graph/
    graph-dom-badges.js   ← posicionamiento de badges DOM (5 badges)
    graph-labels.js       ← labels HTML overlay (title/value/unit + unit selector)
    graph-style.js        ← estilos Cytoscape
    graph-events.js       ← eventos del grafo

  ui/
    node-style-ui.js  ← panel de style (shape/color/size chips)
    ui-chips.js       ← createInlineSelectChip, createColorChip
    settings-panel.js ← ⭐ sistema de chips flotantes (Settings + Time + Logo)

  persistence/
    queue.js          ← queueNodeData (versión nueva, en migración)
    auth.js
    api.js

docs/css/
  settings-panel.css  ← estilos del sistema de chips flotantes
  ui-chips.css        ← estilos base de chips (height, border-radius, colores)
  styles.css          ← ⚠️ contiene regla global `svg { width: 4%; }` que aplasta SVGs inline
                          → cualquier SVG inline necesita override explícito de width/height
```

---

## MIGRACIÓN ARQUITECTÓNICA EN CURSO
⚠️ El proyecto está a mitad de migración de arquitectura monolítica → modular.
Conviven dos mundos:

- `docs/js/api.js` — archivo viejo, aún cargado y activo
- `docs/js/persistence/queue.js` — archivo nuevo modular

**Problema concreto**: `queueNodeData` existe en AMBOS archivos. El browser carga el de `api.js` como activo. Por eso cualquier campo nuevo debe agregarse en ambos hasta que se complete la migración.

---

## TABLA NODES — CAMPOS RELEVANTES
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| model_id | uuid | FK |
| label | text | nombre visible |
| shape | text | ellipse, rectangle, etc |
| color | text | rgb o hex |
| alpha | numeric | opacidad |
| size_px | numeric | tamaño en px (campo activo) |
| size_type | text | "fixed" o "by unit" |
| x | numeric | posición |
| y | numeric | posición |
| parent | uuid | FK a otro nodo |
| unit_id | uuid | FK a units |

⚠️ El campo viejo era `size` — ya no existe en la tabla. Ahora es `size_px`.

---

## TABLA MODELS — CAMPOS RELEVANTES
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| name | text | visible en top-ui, editable inline. Convención: siempre termina en " vX.0" |
| background_color | text | color de fondo del grafo |
| background_image_url | text | URL pública de Supabase Storage |
| version | text | editable desde logo panel. Formato "X.0" |
| periods | integer | cantidad de períodos |
| time_unit | text | hour/day/week/month/quarter/semester/year/moment |
| starting_date | date | fecha inicio |
| comments | text | notas del modelo |
| last_review | date | se actualiza automáticamente en cada `saveModelField` |
| last_user | uuid | FK a users.id — usuario que hizo la última modificación |
| workspace | jsonb | zoom/pan/expandedEdges — guardado debounced en pan/zoom |

⚠️ Columnas agregadas manualmente:
```sql
ALTER TABLE models ADD COLUMN IF NOT EXISTS last_review date;
ALTER TABLE models ADD COLUMN IF NOT EXISTS last_user uuid REFERENCES users(id);
ALTER TABLE models ADD COLUMN IF NOT EXISTS workspace jsonb;
```

---

## TABLA UNITS
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| model_id | uuid | FK |
| name | text | e.g. kg, $, m² |
| min_sz | integer | tamaño mínimo en px |
| max_sz | integer | tamaño máximo en px |
| min_value | numeric | valor mínimo del rango |
| max_value | numeric | valor máximo del rango |

---

## TABLA TIME_VALUES — CAMPOS RELEVANTES
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| model_id | uuid | FK |
| node_id | uuid | FK a nodes |
| period | integer | número de período (1-based) |
| value | numeric | valor del nodo en ese período |
| formula | text | fórmula opcional |

⚠️ Políticas RLS necesarias:
```sql
GRANT INSERT, UPDATE ON time_values TO authenticated;

CREATE POLICY "users can insert time_values" ON time_values FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM model_users WHERE model_id = time_values.model_id AND user_id = auth.uid()
  ));

CREATE POLICY "users can update time_values" ON time_values FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM model_users WHERE model_id = time_values.model_id AND user_id = auth.uid()
  ));
```

---

## TABLA USERS — CAMPOS RELEVANTES
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK — debe coincidir con auth.uid() después del primer login |
| email | text | |
| name | text | nombre visible |
| color | text | color del avatar circle (hex) |
| status | text | 'ACTIVE' requerido para acceder |

### Gestión de usuarios (beta interno)
- **Guille crea usuarios manualmente** en la tabla `users` (email, name, color, status='ACTIVE'). El UUID que ponga no importa.
- **En el primer login** del usuario: `api.js` detecta el mismatch de UUID y llama a `sync_user_uuid()` que actualiza `users.id`, `model_users.user_id` y `models.last_user` en cascada al UUID real de auth.
- **Si el email no existe en `public.users`** → pantalla "no autorizado". No hay auto-registro público.
- Para bloquear un usuario: cambiar `status` a cualquier valor distinto de `'ACTIVE'`.

### RPC sync_user_uuid (en Supabase)
```sql
CREATE OR REPLACE FUNCTION public.sync_user_uuid(p_email text, p_new_uuid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p_old_uuid uuid;
BEGIN
  SELECT id INTO p_old_uuid FROM users WHERE email = p_email;
  IF p_old_uuid IS NULL OR p_old_uuid = p_new_uuid THEN RETURN; END IF;
  UPDATE model_users SET user_id   = p_new_uuid WHERE user_id   = p_old_uuid;
  UPDATE models       SET last_user = p_new_uuid WHERE last_user = p_old_uuid;
  UPDATE users        SET id        = p_new_uuid WHERE id        = p_old_uuid;
END; $$;
GRANT EXECUTE ON FUNCTION public.sync_user_uuid(text, uuid) TO authenticated;
```

---

## FLUJO DE DATOS AL CARGAR

```
Supabase → api.js:loadData() → window.handleData(data)
→ ui.js:handleData() [línea ~320]
→ graphNodes = data.nodes.map(n => { data: { id, label, shape, color, alpha,
    size: n.size_px, size_px: n.size_px, size_type: n.size_type, unit_id: n.unit_id,
    value: valuesMap[n.id_period]?.value ... } })
→ window.renderGraph({ nodes: graphNodes, edges: graphEdges })
→ graph.js:renderGraph() → Cytoscape
```

⚠️ `unit_id` DEBE incluirse en el map de graphNodes en `ui.js`. Si falta, el selector de unidad no funciona correctamente al recargar.

Globals expuestos al cargar:
- `window.MODEL_ID` — uuid del modelo activo
- `window.MODEL_DATA` — objeto completo de la tabla models
- `window._currentModel` — idem (ambos deben mantenerse sincronizados)
- `window.MODEL_AUTHOR` — nombre real del owner (via join `users(name, color)` en api.js)
- `window.MODEL_AUTHOR_COLOR` — color del avatar del owner (desde users.color)
- `window.UNITS_DATA` — array de units del modelo
- `window.UNITS_MAP` — map id→unit
- `window.CURRENT_PERIOD` — período activo (= 1 por ahora, futuro: time slider)
- `window.VALUES_DATA` — map `"nodeId_period"` → row de time_values
- `window.CURRENT_USER_NAME` — nombre del usuario autenticado (desde userDb.name)
- `window.CURRENT_USER_COLOR` — color del avatar del usuario actual (desde userDb.color)
- `window.__USER_ID` — UUID del usuario autenticado. Se setea primero como `auth.uid()` y se sobreescribe con `userDb.id` después de validar. Tras el sync automático, siempre coinciden.

---

## GLOBALS — NOTA CRÍTICA DE SINCRONIZACIÓN ⚠️

`window.MODEL_DATA` y `window._currentModel` son dos objetos separados que deben mantenerse sincronizados. `ui.js` setea `_currentModel` al cargar. `saveModelField` en `settings-panel.js` actualiza ambos **y además siempre guarda `last_review` (hoy) y `last_user` (usuario actual)**:

```javascript
async function saveModelField(field, value) {
  const today  = new Date().toISOString().slice(0, 10);
  const userId = window.__USER_ID || null;
  await supabaseClient.from('models')
    .update({ [field]: value, last_review: today, last_user: userId })
    .eq('id', modelId);
  // Actualiza MODEL_DATA, _currentModel, last_review y last_user en ambos
}
```

---

## PERSISTENCIA DE VALUES (time_values) ✅

Los values de nodos se guardan en `time_values`, NO en `nodes`.

- `window.queueValueData(nodeId, value)` en `api.js`:
  - Lee `window.CURRENT_PERIOD` y `window.MODEL_ID`
  - Si existe row en `window.VALUES_DATA[nodeId_period]` → UPDATE por id
  - Si no existe → INSERT y agrega al mapa
  - Convierte a `parseFloat` (o `null` si vacío)
- En `graph-labels.js` `closeEditor`: cuando `field === 'value'` llama `queueValueData`, no `queueNodeData`

---

## WORKSPACE (zoom/pan) ✅

- Guardado debounced (400ms) al hacer pan/zoom en `graph.js:saveWorkspace()`
- Estructura: `{ zoom, pan: {x,y}, expandedEdges: [...] }`
- Persistido en `models.workspace` (jsonb) via `window.queueWorkspace(ws)` en `api.js`
- Restaurado en `cy.ready()` via `applyWorkspace(graphData.workspace)`

---

## NAVEGACIÓN ENTRE MODELOS ✅

`loadData` en `api.js` soporta `?m=<model_id>` en la URL para cargar un modelo específico (tiene prioridad sobre el primer modelo del usuario).

`?focus=name` — enfoca y selecciona el input `#model-name` al cargar, luego se auto-elimina de la URL via `history.replaceState`.

---

## SISTEMA DE CHIPS FLOTANTES (settings-panel.js)

### Constantes ajustables
```javascript
const GAP     = 6;   // px entre chips
const GAP_BTN = 12;  // px entre botón y primer chip
```

### Tres paneles

**⚙ Settings** (botón `#settings-btn`, bottom-left) — chips suben hacia arriba:
- UNITS: Units (→ sub-panel compacto)
- STYLE: Background color (`createColorChip` sin alpha), Background image (→ sub-panel)
- VIEW: Parent link, Concept link, Formula link (on/off toggle), View level (−N+), Show hidden (on/off)

**⏱ Time** (botón `#time-circle`, top-right) — chips bajan hacia abajo:
- Periods (editable inline)
- Time unit (dropdown: hour/day/week/month/quarter/semester/year/moment)
- Starting date (mini calendar custom)

**💡 Logo** (botón `#logo-btn`, top-left) — chips bajan hacia abajo:
- FILE: New ✅, Open ✅, Share, Export  ← Close fue eliminado
- MODEL: Version (editable + pill "new"), Started on (date picker), Comments (textarea colapsable)
- USERS: Owner (readonly), Last Review (date picker + avatar circle), Me (nombre + avatar + pill "close session" roja)

### Section labels ✅
Usan `var(--top-ui-color, var(--text-primary))` → se adaptan automáticamente al contraste del fondo del canvas. Aplica a FILE, MODEL, USERS en logo; UNITS, STYLE, VIEW en settings.

### Comments chip ✅
- **Colapsable**: vacío → solo label visible. Click en label → expande y enfoca.
- **Auto-ancho**: canvas measurement de la línea más larga → min 20px, max 120px
- **Auto-alto**: JS resize con `scrollHeight`, max 52px (~3 líneas). Scroll vertical si desborda.
- **Timing**: `resizeW()` se llama inmediatamente (canvas no necesita DOM). `resizeH()` se difiere con `requestAnimationFrame` (necesita `scrollHeight`)
- **CSS**: `margin-left: -12px` en `.comments-ta-wrap`, `padding-left: 12px` en `.comments-inline-ta` → todo el texto inicia alineado a 12px del borde izquierdo
- **Pill**: `background: #cac9c9`, `border-radius: 12px`

### Version chip ✅
- Valor editable centrado entre label y pill "new"
- Pill "new" → ejecuta `handleNewVersion()` (ver Versionado)

### Avatar circle (`.sp-avatar-circle`)
- Círculo 18px con inicial del nombre
- Color: `users.color` si existe, sino hash determinístico del nombre (`_nameToColor`)

### Close session pill (`.sp-close-session-pill`)
- Fondo rojo semitransparente, texto blanco
- Click → `supabaseClient.auth.signOut()` → redirect a `index.html`

### Sub-paneles
Se abren a la derecha del chip que los activa. Usan clase `shape-dropdown sp-subpanel-wrap`.

---

## PANEL OPEN ✅

`openOpenPanel(chip)` + `_loadOpenModels(listEl, searchInput, headerCells)` en `settings-panel.js`.

### Estructura visual
- **Search row**: mismo grid que filas de datos. Pill gris (`sp-open-search-pill`) solo ocupa la columna Name → su ancho coincide exactamente con esa columna. Ícono SVG lupa + input.
  - ⚠️ El SVG necesita `.sp-open-search-icon svg { width: 11px; height: 11px; }` para sobreescribir la regla global `svg { width: 4%; }` de styles.css
- **Header**: columnas Name / Created / Modified / Owner — todas clickeables para ordenar
- **Filas**: name (bold si es el modelo activo), created, modified (last_review), owner, botón ✕

### Comportamiento
- **Doble click** en fila → navega a `?m=<model_id>`
- **Ordenamiento**: click en cabecera ordena asc/desc. Indicador ▲/▼. Default: Modified ▼
- **Búsqueda**: filtra filas por nombre en tiempo real (solo campo name)
- **Borrar**: ✕ abre modal "Delete model?" (igual estética que "Remove element?"). Al confirmar → `_hardDeleteModel(modelId)` hace cascade delete completo

### Cascade delete (`_hardDeleteModel`)
Secuencia:
1. Obtiene link IDs → borra `link_concepts`
2. `links` → `time_values` → `nodes` → `units` → `groups` → `concepts` → `model_users` → `models`

### Grid (ajustable en CSS)
```css
grid-template-columns: 1fr 62px 62px 70px 16px;
/* Name  Created  Modified  Owner  Del */
```
Tres lugares en `settings-panel.css` deben mantenerse sincronizados: search-row, header, rows.
Ancho total del panel: `.sp-open-inner { width: 380px; }`

### Queries
1. `model_users` → join `models(id, name, created_at, last_review)` filtrado por `user_id`
2. `model_users` → join `users(name)` donde `role = 'owner'` e `model_id IN (...)` → `ownerMap`

---

## SISTEMA DE VERSIONADO ✅

### Concepto
Cada modelo tiene versión en formato entero `"X"` (sin decimales). El nombre del modelo siempre termina en `" vX"`.

### Flujo "new version"
1. Click en pill "new" del Version chip → muestra "Copying…"
2. Calcula nueva versión: `floor(current) + 1` → `"2"`, `"3"`, etc.
3. Nuevo nombre: strip sufijo existente + append `" vX"`
4. Copia en secuencia con nuevos UUIDs:
   - `models` (mismos campos, nuevo nombre/versión, last_review/last_user actualizados)
   - `model_users` (owner = usuario actual)
   - `units` (nuevos IDs, mapa viejo→nuevo)
   - `nodes` (nuevos IDs, unit_id remapeado)
   - `time_values` (nuevos IDs, node_id remapeado)
   - `links` (nuevos IDs, source/target remapeados — solo los que tienen ambos nodos válidos)
5. Navega al nuevo modelo vía `?m=<new_id>`

### Helpers
```javascript
_nextVersion("1") // → "2"
_nextVersion("2") // → "3"
_stripVersion("Mi modelo v2") // → "Mi modelo"
// También soporta formato viejo: _stripVersion("Mi modelo v2.0") → "Mi modelo"
```

---

## BOTÓN NEW (File panel) ✅

Crea modelo desde cero con defaults:
- Nombre: `"New Model v1"`
- background_color: `#ffffff`
- version: `"1"`, periods: `1`, time_unit: `"moment"`, starting_date: hoy
- 7 units por defecto: `$`, `un.`, `m²`, `m³`, `kg`, `ton`, `%` (min 20, max 120 px)
- Navega a `?m=<new_id>&focus=name` → auto-selecciona el nombre para editar

---

## CONTRASTE TOP-UI ✅

`window.updateTopUIContrast({ bgColor, hasImage })` en `ui.js`:
- Si hay imagen → texto blanco + clase `.top-ui-on-image` (text-shadow)
- Si hay color → calcula luminancia WCAG → blanco u oscuro
- Setea CSS var `--top-ui-color` en `:root` → usada por `.sp-section-label` y top-ui elements
- Se llama con args explícitos desde `handleData()` (no depende de globals)
- También se llama desde `_applyBgColor()` y `_applyBgImage()` en settings-panel.js

Los elementos afectados: `#app-name`, `#model-name`, `#model-meta`, `.sp-section-label`.

---

## BACKGROUND IMAGE ✅

### Bucket Supabase
- Nombre: `model-backgrounds` — PUBLIC
- MIME types: `image/jpeg`, `image/png` — Límite: 2MB

### Estrategia de naming
```
{modelId}/background_{Date.now()}.{ext}
```

### Flujo de upload
1. Lista archivos previos del modelo → los borra todos
2. Sube con nombre único (timestamp)
3. Guarda URL pública en `models.background_image_url` vía `saveModelField`
4. Aplica al grafo con `_applyBgImage(url)`

---

## SISTEMA DE BADGES ✅
Los badges son elementos DOM (no Cytoscape) posicionados sobre el grafo via `#badge-layer`.

**5 tipos** (en orden): style (pincel), relations, comments, timeline, **delete (X roja)**

El badge delete abre un modal de confirmación con estética `shape-dropdown`. Al confirmar llama `window.removeNode(nodeId)`.

**Posicionamiento:**
```javascript
const BADGE_SIZE_MODEL = 10;
const BADGE_GAP_MODEL  = 2;
const OFFSET_X_MODEL   = 10;
```

---

## SISTEMA DE LABELS ✅
Labels son overlays HTML centrados en el nodo. Estructura: `.label-content > .title-slot > .title`, `.value-slot > .value`, `.unit-slot > .unit`

**Unit selector**: al tocar la zona inferior del label se abre dropdown con units del modelo. Pie del dropdown: botón `+` que abre el panel de units en Settings.

---

## AUTO-SIZING POR UNIDAD ✅

En `graph.js`, función `computeByUnitSize(ele)`:
- Aplica solo a nodos con `size_type === 'by unit'`
- `pct = value / valMax` (proporcional desde cero, preserva escala real)
- `size = max(minSz, round(pct * maxSz))`
- Se actualiza con `window.refreshByUnitSizes = () => cy.style().update()`

---

## CREAR / ELIMINAR NODOS ✅

`window.createNewNode()` en `graph.js`:
- Genera UUID con `crypto.randomUUID()`
- Posición libre con `findFreePosition()`: parte del último nodo existente (o centro del viewport si no hay nodos), espiral de `minDist=130px` (equivale a 50px de clearance entre nodos de 80px)
- Defaults: label `'Hi!'`, value `0`, shape `ellipse`, color gris, size_px `80`, size_type `fixed`

`window.removeNode(nodeId)` — elimina badges, label, nodo de Cytoscape y de Supabase.

⚠️ RLS requerida:
```sql
CREATE POLICY "users can insert own model nodes" ON nodes
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM model_users WHERE model_id = nodes.model_id AND user_id = auth.uid()
  ));
GRANT INSERT ON nodes TO authenticated;
```

---

## SISTEMA DE STYLE PANEL (node-style-ui.js)
Panel que aparece al clickear el badge de pincel. Chips:
- `shape` → dropdown (ellipse/round-rectangle/rectangle/diamond)
- `color` → `createColorChip` con alpha
- `size` → dropdown fixed/by unit + campo px inline

---

## PANEL SHARE ✅

`openSharePanel(chip)` en `settings-panel.js`. Mismo estilo que Open panel.

### Estructura visual
Grid: `1fr 1fr 18px 52px 16px` → email | name | avatar | role | del  
Ancho del panel: `.sp-share-inner { width: 380px; }`

### Queries (dos separadas, sin FK join)
1. `model_users` → `user_id, role` filtrado por `model_id`
2. `users` → `id, name, email, color` filtrado por los IDs obtenidos

### Roles válidos en DB
`model_users_role_check` acepta: `'owner'`, `'writer'`, `'reader'`  
⚠️ NO usar 'editor' ni 'viewer' — la constraint los rechaza con 400.

### Comportamiento
- **Filas existentes**: email | name | avatar de color (o hash de user_id como fallback) | role (click cicla owner→writer→reader, guarda en DB) | ✕
- **Agregar usuario**: botón `+` en footer → add-row con email input predictivo (autocomplete `.ilike('%q%').limit(6)`). Al seleccionar usuario → dropdown role picker → `_addShareUser()` inserta en `model_users`
- **Borrar**: ✕ abre modal "Remove user?" → llama RPC `remove_model_user`

### RPC para delete (bypasea RLS)
```sql
-- Función creada en Supabase:
CREATE OR REPLACE FUNCTION public.remove_model_user(p_model_id uuid, p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM model_users WHERE model_id = p_model_id AND user_id = auth.uid() AND role = 'owner')
  THEN RAISE EXCEPTION 'permission denied'; END IF;
  DELETE FROM model_users WHERE model_id = p_model_id AND user_id = p_user_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.remove_model_user(uuid, uuid) TO authenticated;
```
El DELETE directo a `model_users` falla por RLS (ALL policy `user_id = auth.uid()`). La función SECURITY DEFINER bypasea esto.

### Avatar colors
`makeAvatarCircle(u.name || mu.user_id || '?', u.color)` — fallback al user_id para que cada usuario tenga color único aunque no tenga name.  
⚠️ No usar `style.cssText +=` después de `makeAvatarCircle` — pisa el background. Usar setters individuales: `av.style.width = '16px'` etc.

### Dropdowns (autocomplete + role picker)
- Clases: `sp-share-dropdown`, `sp-share-dd-item`, `sp-share-dd-email`, `sp-share-dd-name`
- `position: fixed`, posicionados con `getBoundingClientRect()` del anchor
- Se limpian con `_hideShareDropdowns()`

---

## SISTEMA DE NOTIFICACIÓN DE COMPARTIDOS ✅

### Estrategia adoptada (sin email)
En lugar de email, se usa un sistema de flags en la BD.

**Campo `viewed` en `model_users`** (boolean, DEFAULT false):
- Al compartir un modelo con alguien → `viewed: false` (explícito en `_addShareUser`)
- Al abrir un modelo (loadData en api.js) → `viewed: true` (fire-and-forget)
- Al crear modelo propio (handleNewModel, handleNewVersion) → `viewed: true`
- Al hacer dblclick en Open panel → `viewed: true` antes de navegar

**SQL de migración:**
```sql
ALTER TABLE model_users ADD COLUMN IF NOT EXISTS viewed boolean DEFAULT false;
UPDATE model_users SET viewed = true; -- evitar falsos positivos en deploy
```

**Badge en chip Open** (`buildLogoChips`):
- `_fetchAndSetOpenBadge(chip)`: query async de `model_users` donde `viewed=false AND role != 'owner'`
- Si count > 0 → agrega `.sp-open-count-badge` (círculo verde con número) en top-right del chip Open
- `position: relative` se setea inline en el chip

**Pill "new share" en Open panel** (`_loadOpenModels`):
- Rows con `viewed=false AND role != 'owner'` → muestran `.sp-new-share-pill` (verde) al lado del nombre
- Estructura del nombre: `nameEl (flex) > nameText (overflow) + pill (opcional)`
- CSS: `.sp-open-col-name` → flex container; `.sp-open-col-name-text` → text-overflow

**Validación en Share** (`_showShareAutocomplete`):
- Query filtra `status = 'ACTIVE'` en tabla users
- Si no hay resultados → muestra "this is not a valid user" en dropdown (mensaje italic/dim, no seleccionable)

## PENDIENTE / PRÓXIMA SESIÓN
- [ ] Toggles VIEW funcionales:
  - Parent link, Concept link, Formula link → filtrar edges en Cytoscape
  - View level → filtrar nodos por nivel
  - Show hidden → mostrar/ocultar nodos hidden
- [ ] Time slider → actualizar `window.CURRENT_PERIOD` y recargar values del período
- [ ] File actions: Export
- [ ] Migración completa `api.js` → `persistence/` (deuda técnica, no urgente)
- [ ] Comments chip: ajuste fino de tamaño si canvas measurement no coincide exactamente con Poppins renderizado

---

## PROTOCOLO DE SESIÓN
Al arrancar: leer este documento
Al cerrar: actualizar este documento + commitear repo

---

## NOTAS DE GUILLE
- Arquitecto, no IT. Viene trabajando con Claude como programador.
- Muy enfocado en perfección visual — la simplicidad y coherencia del UI es estratégica para la adopción.
- El proyecto tiene base conceptual sólida y arquitectura bien pensada.
- Rocío es su señora ☕
