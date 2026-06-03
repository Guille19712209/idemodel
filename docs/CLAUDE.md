# IDEMODEL — Contexto de Sesión
Última actualización: 02/06/2026 (sesión 10 — cierre)
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

### Derivación de edges parent ⚠️
Los edges `type: 'parent'` NO se guardan en la tabla `links`. Se derivan de `nodes.parent` al cargar:
```javascript
// en ui.js handleData, después del map de graphEdges:
const nodeIdSet = new Set(data.nodes.map(n => n.id));
data.nodes.forEach(n => {
  if (n.parent && nodeIdSet.has(n.parent)) {
    graphEdges.push({ data: { id: `parent_${n.id}`, source: n.id, target: n.parent, type: 'parent', ... } });
  }
});
```
Los links de tipo `'parent'` que pudieran existir en la tabla `links` se filtran al cargar (`.filter(l => l.type !== 'parent')`).

---

## ESTRUCTURA DE ARCHIVOS CLAVE

```
docs/js/
  api.js              ← ARCHIVO VIEJO (aún activo, contiene queueNodeData + queueValueData)
  ui.js               ← MAPEO REAL de datos Supabase → Cytoscape (línea ~367)
  graph.js            ← renderGraph, eventos, workspace, createNewNode, removeNode
  engine.js           ← handleData, state, fórmulas

  graph/
    graph-dom-badges.js   ← posicionamiento de badges DOM (5 badges) + handlers comments
    graph-labels.js       ← labels HTML overlay (title/value/unit + unit selector)
    graph-style.js        ← estilos Cytoscape
    graph-events.js       ← eventos del grafo

  ui/
    color-picker.js       ← ⭐ picker unificado de color (sesión 8) — openColorPicker/closeColorPicker
    node-style-ui.js      ← panel de style (shape/color/size/hidden/coords chips)
    node-relations-ui.js  ← panel de relations (parent/concept link/groups chips)
    node-comments-ui.js   ← panel de comments del nodo (badge comments)
    ui-chips.js           ← createInlineSelectChip, createColorChip
    settings-panel.js     ← ⭐ sistema de chips flotantes (Settings + Time + Logo)

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

## ARQUITECTURA — ARCHIVO ACTIVO POR FUNCIÓN

`queueNodeData` vive únicamente en `api.js`. `persistence/queue.js` fue eliminado (sesión 10).

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
| parent | uuid | FK a otro nodo — fuente de verdad para edge parent |
| unit_id | uuid | FK a units |
| hidden | boolean | nodo oculto (visual transparente + dashed) |
| comment | text | comentario del nodo — agregado sesión 7 |

⚠️ El campo viejo era `size` — ya no existe en la tabla. Ahora es `size_px`.
⚠️ SQL aplicado: `ALTER TABLE nodes ADD COLUMN IF NOT EXISTS comment text;`

---

## TABLA GROUPS ✅
| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | PK |
| model_id | uuid | FK a models |
| name | text | nombre del grupo |
| color | text | color hex del grupo |
| comment | text | nullable |

## TABLA NODE_GROUPS ✅
| Campo | Tipo | Notas |
|---|---|---|
| node_id | uuid | FK a nodes |
| group_id | uuid | FK a groups |

⚠️ NO tiene columna `id`. Los inserts no deben incluir `id`.

### RLS y permisos necesarios (ya aplicados en producción)
```sql
GRANT INSERT, UPDATE, DELETE ON groups TO authenticated;
GRANT INSERT, DELETE ON node_groups TO authenticated;

-- RLS node_groups
CREATE POLICY "users can insert node_groups" ON node_groups FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM nodes n JOIN model_users mu ON mu.model_id = n.model_id
    WHERE n.id = node_groups.node_id AND mu.user_id = auth.uid()
  ));
CREATE POLICY "users can delete node_groups" ON node_groups FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM nodes n JOIN model_users mu ON mu.model_id = n.model_id
    WHERE n.id = node_groups.node_id AND mu.user_id = auth.uid()
  ));
-- RLS groups
CREATE POLICY "users can insert groups" ON groups FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM model_users WHERE model_id = groups.model_id AND user_id = auth.uid()));
CREATE POLICY "users can update groups" ON groups FOR UPDATE
  USING (EXISTS (SELECT 1 FROM model_users WHERE model_id = groups.model_id AND user_id = auth.uid()));
```

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
    hidden: n.hidden, parent_id: n.parent, groups: nodeGroupsMap[n.id],
    value: valuesMap[n.id_period]?.value ... } })
→ graphEdges = links filtrados (sin type:parent) + parent edges derivados de nodes.parent
→ window.renderGraph({ nodes: graphNodes, edges: graphEdges })
→ graph.js:renderGraph() → Cytoscape
```

⚠️ `unit_id` DEBE incluirse en el map de graphNodes en `ui.js`. Si falta, el selector de unidad no funciona correctamente al recargar.

### Fetch de node_groups en api.js
Después del Promise.all principal, se hace un fetch adicional:
```javascript
const nodeIds = (nodesRes.data || []).map(n => n.id);
const { data: ngData } = await supabaseClient.from('node_groups')
  .select('node_id, group_id').in('node_id', nodeIds);
nodeGroups = ngData || [];
```
Se pasa en `data.nodeGroups` a `handleData`.

### Globals expuestos al cargar
- `window.MODEL_ID` — uuid del modelo activo
- `window.MODEL_DATA` — objeto completo de la tabla models
- `window._currentModel` — idem (ambos deben mantenerse sincronizados)
- `window.MODEL_AUTHOR` — nombre real del owner (via join `users(name, color)` en api.js)
- `window.MODEL_AUTHOR_COLOR` — color del avatar del owner (desde users.color)
- `window.UNITS_DATA` — array de units del modelo
- `window.UNITS_MAP` — map id→unit
- `window.CURRENT_PERIOD` — período activo (1-based). Actualizado por el time slider.
- `window.VALUES_DATA` — map `"nodeId_period"` → row de time_values
- `window.NODES_DATA` — array de nodos del modelo
- `window.GROUPS_DATA` — array de grupos del modelo `[{id, name, color, ...}]`
- `window.CURRENT_USER_NAME` — nombre del usuario autenticado
- `window.CURRENT_USER_COLOR` — color del avatar del usuario actual
- `window.__USER_ID` — UUID del usuario autenticado
- `window.USER_ROLE` — `'owner'` | `'writer'` | `'reader'`
- `window.refreshPeriod()` — actualiza valores Cytoscape para `CURRENT_PERIOD`
- `window.initTimeControls()` — inicializa slider/badge/label de tiempo

### Globals de visibilidad de links (graph.js)
```javascript
window.SHOW_PARENT_LINKS  = true;
window.SHOW_FORMULA_LINKS = true;
window.SHOW_CONCEPT_LINKS = true;
window.updateLinkVisibility = function() { cy.style().update(); };
```
Usados en los estilos Cytoscape de edges como funciones `() => window.SHOW_X ? 'element' : 'none'`.

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

## NODO HIDDEN ✅ (sesión 5)

### Visual Cytoscape (graph.js)
```javascript
'node[?hidden]': {
  'background-opacity': 0,
  'border-style': 'dashed',
  'border-width': 1.5,
  'border-color': () => getCSSVar('--top-ui-color'),
  'border-opacity': 0.35
}
'node[?hidden]:selected': {
  'border-style': 'solid',
  'border-width': 1,
  'border-color': getCSSVar('--text-primary'),
  'border-opacity': 1
}
```
Edge style: `'line-style': (ele) => (ele.source().data('hidden') || ele.target().data('hidden')) ? 'dashed' : 'solid'`

### Labels (graph-labels.js)
Nodos hidden: color de título/valor/unidad = `--top-ui-color`, opacidad del contenedor = 0.35.

### Comportamiento (node-style-ui.js)
Cuando hidden ON y `window.SHOW_HIDDEN` es false: deselecciona el nodo → desaparece badge → cierra panel automáticamente.

### Persistencia
`queueNodeData(nodeId, 'hidden', value)` → `payload.hidden = value` → UPDATE `nodes.hidden`.

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
- VIEW: Parent link ✅, Concept link ✅, Formula link ✅ (on/off toggle funcional), View level (−N+), Show hidden (on/off)

**⏱ Time** (botón `#time-circle`, top-right) — chips bajan hacia abajo:
- Periods (editable inline)
- Time unit (dropdown: hour/day/week/month/quarter/semester/year/moment)
- Starting date (mini calendar custom)

**💡 Logo** (botón `#logo-btn`, top-left) — chips bajan hacia abajo:
- FILE: New ✅, Open ✅, Share, Export
- MODEL: Version (editable + pill "new"), Started on (date picker), Comments (textarea colapsable)
- USERS: Owner (readonly), Last Review (date picker + avatar circle), Me (nombre + avatar + pill "close session" roja)

### Toggles VIEW — link visibility ✅ (sesión 5)
```javascript
makeToggleChip('Formula link', true, v => { window.SHOW_FORMULA_LINKS = v; window.updateLinkVisibility?.(); }),
makeToggleChip('Concept link', true, v => { window.SHOW_CONCEPT_LINKS = v; window.updateLinkVisibility?.(); }),
makeToggleChip('Parent link',  true, v => { window.SHOW_PARENT_LINKS  = v; window.updateLinkVisibility?.(); }),
```
Los chips del badge relations asociados a cada tipo de edge también se ocultan si el link type está desactivado.

### Section labels ✅
Usan `var(--top-ui-color, var(--text-primary))` → se adaptan automáticamente al contraste del fondo del canvas.

### Comments chip ✅
- **Colapsable**: vacío → solo label visible. Click en label → expande y enfoca.
- **Auto-ancho**: canvas measurement de la línea más larga → min 20px, max 120px
- **Auto-alto**: JS resize con `scrollHeight`, max 52px (~3 líneas). Scroll vertical si desborda.
- **CSS**: `margin-left: -12px` en `.comments-ta-wrap`, `padding-left: 12px` en `.comments-inline-ta`
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
- **Search row**: mismo grid que filas de datos. Pill gris (`sp-open-search-pill`) solo ocupa la columna Name.
  - ⚠️ El SVG necesita `.sp-open-search-icon svg { width: 11px; height: 11px; }` para sobreescribir la regla global
- **Header**: columnas Name / Created / Modified / Owner — todas clickeables para ordenar
- **Filas**: name (bold si es el modelo activo), created, modified (last_review), owner, botón ✕

### Comportamiento
- **Doble click** en fila → navega a `?m=<model_id>`
- **Ordenamiento**: click en cabecera ordena asc/desc. Indicador ▲/▼. Default: Modified ▼
- **Búsqueda**: filtra filas por nombre en tiempo real
- **Borrar**: ✕ abre modal "Delete model?" → `_hardDeleteModel(modelId)` hace cascade delete completo

### Cascade delete (`_hardDeleteModel`)
Secuencia:
1. Obtiene link IDs → borra `link_concepts`
2. `links` → `time_values` → `nodes` → `units` → `groups` → `concepts` → `model_users` → `models`

### Grid (ajustable en CSS)
```css
grid-template-columns: 1fr 62px 62px 70px 16px;
```
Tres lugares en `settings-panel.css` deben mantenerse sincronizados: search-row, header, rows.
Ancho total: `.sp-open-inner { width: 380px; }`

---

## SISTEMA DE VERSIONADO ✅

Cada modelo tiene versión en formato entero `"X"`. El nombre siempre termina en `" vX"`.

### Flujo "new version"
Copia: models → model_users → units → nodes → time_values → links (sin parent edges).
Navega al nuevo modelo vía `?m=<new_id>`.

---

## BOTÓN NEW (File panel) ✅

Crea modelo desde cero. Defaults: nombre `"New Model v1"`, 8 units por defecto. Navega con `?m=<new_id>&focus=name`.

---

## CONTRASTE TOP-UI ✅

`window.updateTopUIContrast({ bgColor, hasImage })` en `ui.js`:
- Si hay imagen → texto blanco
- Si hay color → calcula luminancia WCAG → blanco u oscuro
- Setea CSS var `--top-ui-color` en `:root`
- Afecta: `#app-name`, `#model-name`, `#model-meta`, `.sp-section-label`, badges de nodo, labels de nodos hidden

---

## BACKGROUND IMAGE ✅

Bucket: `model-backgrounds` (public). Naming: `{modelId}/background_{Date.now()}.{ext}`. Upload: borra previos, sube, guarda URL en `models.background_image_url`.

---

## PERMISOS DE ROL (reader/writer/owner) ✅

`window.USER_ROLE` cargado desde `model_users` en `api.js`. Default `'reader'`.

### Guards
- `graph.js` — `createNewNode`, `removeNode`: guard reader
- `graph.js` — `cy.ready()`: `cy.autoungrabify(true)` para readers
- `graph-dom-badges.js` — readers no ven badges style ni delete
- `graph-labels.js` — `openFieldEditor`, `openUnitSelector`: guard reader

---

## SISTEMA DE BADGES ✅
Elementos DOM posicionados sobre el grafo via `#badge-layer`.

**5 tipos** (en orden): style (pincel), relations, comments, timeline, delete (X roja)

```javascript
const BADGE_SIZE_MODEL = 10;
const BADGE_GAP_MODEL  = 2;
const OFFSET_X_MODEL   = 10;
```

Badge relations → abre `node-relations-ui.js` panel.
Badge style → abre `node-style-ui.js` panel.
Ambos paneles se cierran mutuamente al abrirse.

---

## SISTEMA DE LABELS ✅
Labels son overlays HTML centrados en el nodo. Estructura: `.label-content > .title-slot > .title`, `.value-slot > .value`, `.unit-slot > .unit`

**Unit selector**: al tocar la zona inferior del label se abre dropdown con units del modelo.

---

## PANEL DE RELATIONS (node-relations-ui.js) ✅ (sesión 5)

Archivo: `docs/js/ui/node-relations-ui.js` — script regular (no module).
Cargado en `idemodel.html` antes de `graph.js`.

### Globals expuestos
```javascript
window.RELATIONS_PANEL        // el elemento DOM del panel activo
window.HIGHLIGHTED_GROUP_ID   // id del grupo con highlight activo
window.openNodeRelationsPanel(node, anchorEl)
window.closeNodeRelationsPanel()
```

### Estructura
Panel `#node-relations-panel` con clase `node-style-panel` (sin fondo, chips flotantes).
Se ancla en `r.top` del badge y crece hacia abajo.

### Chip Parent (single-select)
- Dropdown a la derecha del chip con todos los nodos del modelo menos el propio
- Al seleccionar: `_applyParent(cy, nodeId, targetId)`
  - Elimina edge parent existente en Cytoscape
  - Agrega nuevo edge con `id: 'parent_${nodeId}'`
  - Llama `queueNodeData(nodeId, 'parent', targetId)` → persiste en `nodes.parent`
- "none" limpia el parent

### Chip Concept Link (multi-select)
- Dropdown a la derecha con todos los nodos, toggle dots
- Crea/elimina edges `type: 'manual'` en Cytoscape
- Persiste en tabla `links` (source_id/target_id, type:'manual')
- Label muestra nombres separados por coma

### Chip Groups (área gris estilo comments)
- Chip transparente + área gris con `margin-left: -18px`, `padding: 4px 8px 4px 22px`
- Pills de color para cada grupo del nodo (`{id, name, color}`)
- Click en pill → highlight de todos los nodos del modelo en ese grupo (Cytoscape style bypass)
- Highlight se limpia al cerrar el panel
- `×` en pill → elimina de `node_groups` en DB + local
- Nombre del pill editable inline → persiste en `groups.name`
- Botón `+` → abre `#node-group-picker`

### Group Picker
- Lista grupos existentes del modelo (`window.GROUPS_DATA`) con toggle dots
- Toggle ON → INSERT en `node_groups` (sin campo `id`)
- Toggle OFF → DELETE de `node_groups`
- "New group" → INSERT en `groups` (model_id, name, color) + INSERT en `node_groups`
- Actualiza `window.GROUPS_DATA` localmente

### Gestión de dropdowns
```javascript
let _activeRelDd   = null;  // dropdown abierto actualmente
let _activeRelChip = null;  // chip que lo abrió
```
Click en chip activo → cierra dropdown. Click en otro chip → cierra el anterior, abre nuevo.

---

## SISTEMA DE STYLE PANEL (node-style-ui.js) ✅
Panel al clickear el badge de pincel. Chips:
- `shape` → dropdown (ellipse/round-rectangle/rectangle/diamond)
- `color` → `createColorChip` con alpha
- `size` → dropdown fixed/by unit + campo px inline
- `hidden` → toggle. Si ON y `SHOW_HIDDEN=false`: deselecciona nodo, cierra panel

---

## AUTO-SIZING POR UNIDAD ✅

`computeByUnitSize(ele)` en `graph.js`:
- Solo nodos con `size_type === 'by unit'`
- `pct = value / valMax`, `size = max(minSz, round(pct * maxSz))`
- `window.refreshByUnitSizes = () => cy.style().update()`

---

## CREAR / ELIMINAR NODOS ✅

`window.createNewNode()` — UUID, posición libre (espiral minDist=130px), defaults: label 'Hi!', ellipse, gris, 80px.
`window.removeNode(nodeId)` — elimina badges, label, nodo de Cytoscape y Supabase.

⚠️ RLS requerida:
```sql
CREATE POLICY "users can insert own model nodes" ON nodes
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM model_users WHERE model_id = nodes.model_id AND user_id = auth.uid()
  ));
GRANT INSERT ON nodes TO authenticated;
```

---

## PANEL SHARE ✅

`openSharePanel(chip)` en `settings-panel.js`.
Grid: `1fr 1fr 18px 52px 16px` → email | name | avatar | role | del
Ancho: `.sp-share-inner { width: 380px; }`

Roles válidos: `'owner'`, `'writer'`, `'reader'` — NO usar 'editor' ni 'viewer'.

RPC `remove_model_user` para delete (bypasea RLS). Autocomplete filtra `status = 'ACTIVE'`.

---

## SISTEMA DE NOTIFICACIÓN DE COMPARTIDOS ✅

Campo `viewed` en `model_users` (boolean, DEFAULT false).
Badge verde en chip Open si hay modelos no vistos. Pill "new share" en filas del panel Open.

```sql
ALTER TABLE model_users ADD COLUMN IF NOT EXISTS viewed boolean DEFAULT false;
UPDATE model_users SET viewed = true;
```

---

## TIME SLIDER ✅

`window.initTimeControls()` en `settings-panel.js`. Slider + flechas + badge total.

⚠️ CSS necesario para quitar estilo browser del slider:
```css
#time-slider { -webkit-appearance: none; appearance: none; }
#time-slider::-webkit-slider-thumb { -webkit-appearance: none; background: var(--top-ui-color); }
```

⚠️ Flechas SVG inline: `#time-nav svg { width: 10px; height: 10px; }` (override regla global).

---

## EXPORT (PDF y CSV) ✅

CSV: columnas Node name | P1..Pn. PDF: html2canvas + jsPDF (lazy load).

⚠️ Quirks html2canvas: `position:fixed` captura desde viewport original; `<img src=".svg">` no renderiza; `<input>` con `line-height:0` colapsa; CSS vars pueden no resolver en clone.

---

## PATRÓN: OVERRIDE DE SVG INLINE ⚠️

`styles.css` tiene `svg { width: 4%; }` global. Cada SVG inline necesita override explícito.

---

## ARQUITECTURA — MAPA DE ARCHIVOS ✅ (limpieza completa sesión 10)

| Archivo | Estado | Notas |
|---|---|---|
| `api.js` | **Activo** | queueNodeData, queueValueData, loadData, init. Fuente de verdad. |
| `ui.js` | **Activo** | handleData + updateTopUIContrast. Código del bottom panel eliminado. |
| `graph.js` | **Activo** | renderGraph, estilos Cytoscape, createNewNode, removeNode, workspace. |
| `graph/graph-dom-badges.js` | **Activo** | Sistema de badges DOM (5 tipos). |
| `graph/graph-labels.js` | **Activo** | Labels HTML overlay. |
| `graph/graph-events.js` | **Activo** | Todos los eventos de tap — limpio, sin referencias old. |
| `graph/graph-style.js` | **Activo** | getCSSVar, getNodeColor, getEdgeColor. |
| `engine.js` | **Activo** | setState/getState/\_\_STATE + undo stack (pushUndo/performUndo). |
| `ui/node-style-ui.js` | **Activo** | Panel de style badge. |
| `ui/node-relations-ui.js` | **Activo** | Panel de relations badge. |
| `ui/node-comments-ui.js` | **Activo** | Panel de comments badge. |
| `ui/concept-panel.js` | **Activo** | Panel flotante de concepts. |
| `ui/settings-panel.js` | **Activo** | Sistema de chips flotantes (Settings/Time/Logo). |
| `ui/ui-chips.js` | **Activo** | Helpers de chips. |
| `ui/color-picker.js` | **Activo** | Picker unificado singleton. |

### Archivos eliminados en sesión 10
- `nodeUI.js` — sistema de badges radiales original (muerto)
- `persistence/queue.js` — queueNodeData sin campos nuevos (supersedido por api.js)

---

## SISTEMA DE CONCEPTS ✅ (sesión 6 — completo)

### Base de datos
- Tabla `concepts`: id, model_id, label, color, comment ✅
- Tabla `link_concepts`: id (uuid DEFAULT gen_random_uuid()), link_id (FK→links), concept_id (FK→concepts) ✅
- Unique constraint `(link_id, concept_id)` ✅
- RLS + GRANT en ambas tablas ✅
- ⚠️ SQL aplicado en producción:
  ```sql
  ALTER TABLE link_concepts DROP CONSTRAINT link_concepts_id_fkey;
  ALTER TABLE link_concepts ALTER COLUMN id SET DEFAULT gen_random_uuid();
  ```

### Arquitectura del sistema de concepts

**Hub nodes** (`isConceptHub: true`): nodos Cytoscape creados una sola vez en `cy.ready()` para TODOS los edges (incluyendo parent). No son draggables — `cy.on('add', 'node[isConceptHub],node[isChip]', e => e.target.ungrabify())`.

```javascript
// Globals
window.CONCEPTS_MODE        = 'none' | 'active' | 'all'
window.ACTIVE_CONCEPT_EDGES = new Set()  // edge IDs visibles en modo 'active'
let _updatingChips = false               // guard anti-loop en updateAllChips
```

**Estilos hub**: 12×12px, `background: #3a3a3a`, texto blanco, `font-size: 5`.

**Hub display logic** (en orden de prioridad):
```javascript
'display': (ele) => {
  // 1. ACTIVE_EDGE siempre muestra su hub (tap en edge, cualquier modo)
  if (window.ACTIVE_EDGE && window.ACTIVE_EDGE.id() === edgeId) return 'element';
  // 2. Modo none: nada más
  if (window.CONCEPTS_MODE === 'none') return 'none';
  // 3. Modo active: solo edges en ACTIVE_CONCEPT_EDGES
  if (window.CONCEPTS_MODE === 'active') return ACTIVE_CONCEPT_EDGES.has(edgeId) ? 'element' : 'none';
  // 4. Modo all: todos
  if (window.CONCEPTS_MODE === 'all') return 'element';
}
```

⚠️ Cytoscape NO soporta selectores compuestos `:not([isChip]):not([isConceptHub])` en event listeners. Usar guard manual en el handler:
```javascript
cy.on('grab drag position', 'node', (e) => {
  if (e.target.data('isChip') || e.target.data('isConceptHub')) return;
  ...
});
```

⚠️ `renderNodeLabels` en `graph-labels.js` usa `cy.nodes().not('[isChip],[isConceptHub]')` para excluir hubs de los HTML overlays (sin esto, el número/label del hub aparece flotando).

**Flow de concept view modes**:
- `none` → sin hubs, sin chips. Edge tap igual muestra hub via `hub.css('display','element')` directo.
- `active` + nodo seleccionado → hubs visibles para todos los edges conectados + chips auto-expandidos en los que tienen concepts. Al deseleccionar → todo colapsa.
- `all` → todos los hubs visibles + chips auto-expandidos en todos. Al deseleccionar canvas → NO colapsa chips (se mantienen). Persiste en workspace.

**Tap en edge** (cualquier modo, más fuerte que el modo):
```javascript
window.ACTIVE_EDGE = edge;
const hub = cy.getElementById(`hub_${edgeId}`);
if (hub.length) hub.css('display', 'element');  // inline style, prioridad máxima
```
Al canvas tap: `hub.css('display', '')` restaura el computed style del modo.

**Parent edges y concepts** ✅ (sesión 11): hubs creados para parent edges. `linkConceptToEdge` persiste en tabla `node_parent_concepts` (no en `link_concepts`):
```javascript
if (edgeId.startsWith('parent_')) {
  const nodeId = edgeId.slice(7);
  supabase.from('node_parent_concepts').insert({ node_id: nodeId, concept_id: conceptId });
  return;
}
```
Al cargar: `data.parentConcepts` se mapea en `ui.js` como `conceptsByParentNode[nodeId]` y se inyecta en el edge derivado.

**Creación de hub en runtime**: `_applyParent` llama `refreshConceptHubs()` después de agregar el nuevo edge. Al remover el parent, el hub viejo también se remueve (`cy.getElementById('hub_parent_'+nodeId).remove()`).

**Chips al asignar concept**: `_assign` en `concept-panel.js` llama `window.expandEdge(edge)` si el edge no estaba expandido (primer concept). Al cerrar el panel: si modo ≠ 'all' → colapsa chips + limpia `ACTIVE_EDGE`.

**Chip nodes** (`isChip: true`): dinámicos. `spacing = 10px` entre centros. `font-size: 6`, `padding: 4px`. Cada chip tiene `conceptId` en data.

**Tap en chip** → `toggleConceptFilter(conceptId, chip)`:
- Resalta edges con ese concept + sus nodos source/target (clase `highlighted` / `concept-related`)
- Dimea el resto (clase `dimmed`)
- Tap de nuevo en el mismo chip → limpia filtro

### Panel de concepts (`docs/js/ui/concept-panel.js`)
Panel flotante 200px de ancho. Se abre desde hub. Contenido:
- Lista: color dot | nombre | toggle asignado | × delete
- Form al pie: color picker + nombre + botón +
- Sin campo comment (eliminado para compactar)

```javascript
window.CONCEPT_PANEL    // DOM activo
window.openConceptPanel(edge, cy, hubNode)
window.closeConceptPanel()
```

### Persistencia de CONCEPTS_MODE
Se guarda en `models.workspace` (jsonb) junto con zoom/pan/expandedEdges:
```javascript
const ws = { zoom, pan, expandedEdges, conceptsMode: window.CONCEPTS_MODE };
```
Se restaura en `applyWorkspace`. Settings chip lee `window.CONCEPTS_MODE || 'none'` al abrirse.
`window.saveWorkspace` está expuesto globalmente para que el settings panel lo llame al cambiar modo.

### Posiciones de nodos ✅
`dragfree` listener llama `queuePositions(positions)` para persistir en Supabase. Excluye chips y hubs del map de posiciones.

---

## CHIP DE COORDENADAS ✅ (sesión 7)

En el panel de style (badge pincel), al final de los chips. Un único pill gris con dos `ui-chip-label` idénticos a los demás:

```
[ x | 123  y | 456 ]
```

- Lee `node.position()` al abrir el panel
- Enter o Tab confirma y mueve el nodo en Cytoscape
- Persiste vía `queueNodeData(nodeId, 'x', x)` y `queueNodeData(nodeId, 'y', y)`
- `api.js` tiene soporte para campos `x`, `y`, `comment` en `queueNodeData`

---

## BADGE COMMENTS ✅ (sesión 7)

`docs/js/ui/node-comments-ui.js` — panel flotante desde el badge comments.

```javascript
window.openNodeCommentsPanel(node, anchorEl)
window.closeNodeCommentsPanel()
window.COMMENTS_NODE_PANEL
```

- Chip con área gris (mismo patrón que Groups chip en relations)
- Textarea: auto-height, max 80px, guarda al perder foco
- Persiste en `nodes.comment` vía `queueNodeData(nodeId, 'comment', text)`
- Al abrir, cierra style/relations/input panels y viceversa

---

## COLOR PICKER UNIFICADO ✅ (sesión 8)

`docs/js/ui/color-picker.js` — singleton global.

```javascript
window.openColorPicker({ anchorEl, color, hasAlpha, alpha, onChange })
window.closeColorPicker()
window._colorPickerAnchor   // el anchorEl activo (null si cerrado)
```

### Paleta
8 colores fijos: `#57789b #d16b6b #6f9d6d #b08ccc #d3a25f #5f8f95 #8c8c8c #3f3f3f` + cuadrado custom (abre native `<input type="color">`).

### Comportamiento
- **Swatches**: `onChange(color, alpha)` → cierra picker.
- **Custom**: `onChange` en cada `input` (preview en vivo) → cierra en `change` (confirmar).
- **Alpha row** (solo si `hasAlpha: true`): campo editable, llama `onChange` sin cerrar.
- **Singleton**: `openColorPicker` siempre cierra el anterior antes de abrir uno nuevo.
- **Cierre exterior**: `pointerdown` fuera del picker y fuera del `anchorEl`.

### Usos
| Dónde | hasAlpha | qué persiste |
|---|---|---|
| Node color (node-style-ui.js) | ✅ | `nodes.color` + `nodes.alpha` |
| Background (settings-panel.js) | ✗ | `models.background_color` |
| Concept color (concept-panel.js) | ✗ | `concepts.color` |
| Group color dot en pill (node-relations-ui.js) | ✗ | `groups.color` |

### ⚠️ Regla para paneles con outside-click handler
Todo panel que use `openColorPicker` debe excluir `.color-picker-popup` de su handler de cierre:
```javascript
if (ev.target.closest('.color-picker-popup')) return;
```
Ya aplicado en: node-style-ui.js (`.shape-dropdown, .color-dropdown, .color-picker-popup`), concept-panel.js, node-relations-ui.js.

### CSS en ui-chips.css
`.color-picker-popup` — contenedor flex-column, `rgba(30,30,36,.92)`, `border-radius:14px`.
`.cp-row` — flex-row de swatches.
`.cp-custom` — cuadrado con borde dashed + native input invisible superpuesto.
`.cp-alpha-row` — fila de alpha con separador superior.

---

## FILTRO DE PARENT — DESCENDIENTES ✅ (sesión 7)

En `node-relations-ui.js`, el dropdown de Parent excluye:
1. El nodo mismo (ya existía)
2. Todos los descendientes del nodo (hijos, nietos, etc.)

Función `_getDescendants(cy, nodeId)`: BFS siguiendo edges `type:'parent'` donde `target === nodeId` (los hijos tienen source=hijo, target=padre).

---

## VIEW LEVEL ✅ (sesión 7)

`window.applyViewLevel(level)` en `graph.js`. Chip −N+ en Settings → VIEW.

### Lógica de profundidad
- Raíz (sin parent edge) = depth 0
- Hijo directo = depth 1, nieto = depth 2, etc.
- Nodos sin jerarquía → depth 0 (siempre visibles)

### Comportamiento del slider
- **Level 0** = todos los nodos visibles (sin filtro)
- **Level N** = muestra nodos con `depth ≤ maxDepth − N`
- A level = maxDepth: solo quedan las raíces visibles
- El `+` se capa automáticamente en `maxDepth`

### Globals
```javascript
window.VIEW_LEVEL     // nivel activo
window.VIEW_LEVEL_MAX // profundidad máxima del árbol actual
window.applyViewLevel(level)
```

### Detalles de implementación
- Oculta nodos con `node.css('display', 'none')` + oculta label DOM
- Oculta edges cuyos nodos están ocultos
- Deselecciona nodo si quedó oculto
- Se recalcula el árbol en cada llamada (BFS fresco)

---

## TABLA NODE_PARENT_CONCEPTS ✅ (sesión 11)

| Campo | Tipo | Notas |
|---|---|---|
| node_id | uuid | FK a nodes(id) ON DELETE CASCADE — identifica el parent edge |
| concept_id | uuid | FK a concepts(id) ON DELETE CASCADE |
| PK | (node_id, concept_id) | |

⚠️ SQL necesario (aplicar en Supabase si no está):
```sql
CREATE TABLE node_parent_concepts (
  node_id    uuid REFERENCES nodes(id)    ON DELETE CASCADE,
  concept_id uuid REFERENCES concepts(id) ON DELETE CASCADE,
  PRIMARY KEY (node_id, concept_id)
);
ALTER TABLE node_parent_concepts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON node_parent_concepts TO authenticated;
CREATE POLICY "users can select node_parent_concepts" ON node_parent_concepts FOR SELECT USING (true);
CREATE POLICY "users can insert node_parent_concepts" ON node_parent_concepts FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM nodes n JOIN model_users mu ON mu.model_id = n.model_id WHERE n.id = node_parent_concepts.node_id AND mu.user_id = auth.uid()));
CREATE POLICY "users can delete node_parent_concepts" ON node_parent_concepts FOR DELETE
  USING (EXISTS (SELECT 1 FROM nodes n JOIN model_users mu ON mu.model_id = n.model_id WHERE n.id = node_parent_concepts.node_id AND mu.user_id = auth.uid()));
```

Fetch en `api.js loadData` sección 4c. Pasado como `data.parentConcepts` a `handleData`.
`deleteConcept` también borra de `node_parent_concepts` donde `concept_id = X`.

---

## MUNDO FÓRMULAS — FASE 1 ✅ (sesión 11)

### Arquitectura
- `time_values.formula` (text) = fuente de verdad. El `value` numérico es derivado, **no se persiste**.
- Evaluador: `window.evalFormula(formula)` en `ui.js` → `parseFloat(formula)` por ahora. Extensible.
- Al cargar: si `formula != null`, `row.value = evalFormula(formula)`. Si es null (fila vieja), mantiene `value` existente (backward compat).

⚠️ SQL necesario:
```sql
ALTER TABLE time_values ADD COLUMN IF NOT EXISTS formula text;
```

### queueValueData (api.js)
Guarda `formula` (texto), calcula `value` localmente. No escribe `value` en DB.

### Nodo (graph-labels.js)
Al cerrar editor de `value`: el texto escrito es la fórmula. Node muestra `evalFormula(input.value)`.

### Toggle Values / Formulas (node-timeline-ui.js)
Segmented control junto al FILTER: `values` | `formulas`.
- `values`: muestra número evaluado
- `formulas`: muestra texto crudo de la fórmula
- Al hacer focus en celda: siempre muestra la fórmula (para editar)
- Al blur: guarda fórmula, restaura display según toggle
- `_saveFormula(nodeId, period, text)` en lugar de `_saveValue`

---

## TABLA VALUES IN TIME ✅ (sesión 10)

`docs/js/ui/node-timeline-ui.js` — script regular, cargado en HTML antes de graph.js.

### Apertura
Badge de reloj en el nodo → `window.openNodeTimelinePanel(node)`.
Por defecto muestra solo el nodo activo (hiddenIds = todos los demás). Oculta `#settings-btn` y `#add-node-btn`.

### Estructura visual
- Panel fixed bottom, `left:20px; right:20px; height:20vh`, `border-radius:14px 14px 0 0`
- Handle de resize drag en la parte superior (drag arriba para agrandar)
- Animación slide-up al abrir (`panel.animate(...)`)
- Ancho de columnas: `(panelWidth - 130px - 32px) / min(periods, 12)` — 12 columnas llenan el panel; más → scroll horizontal

### Header de períodos
- Número de período (bold, blanco)
- Fecha calculada desde `starting_date` + `time_unit` (mismo formato que `_dateLabel`)
- **Columna activa**: texto blanco + `border-bottom: 2px solid rgba(255,255,255,0.5)`
- Actualizable in-place via `_updatePeriodHighlights(p)` sin re-render

### Inputs de valor
- Cada celda es un `<input>` con fondo transparente
- Al hacer focus en un período diferente al activo: llama `window._timeSetPeriod(p)` + actualiza highlights + refresca grafo
- Al blur/Enter: persiste a `time_values` (UPDATE si existe, INSERT si no)
- Refresca el grafo si es el período activo (`window.refreshPeriod()`)

### Globals expuestos
```javascript
window.openNodeTimelinePanel(node)
window.closeNodeTimelinePanel()
```

### Chip FILTER
Panel compacto con filas por sección. Click en fila → subpanel lateral con opciones.
- **Sort**: Default / Name A→Z / Name Z→A
- **Parent**, **Group**, **Concept**, **Elements**: multi-select con opción "all" al tope
- "all" seleccionado = set vacío = sin filtro aplicado
- Seleccionar "all" limpia el set; seleccionar item apaga "all"
- Label del compact row muestra selección separada por comas (ej. "Ventas, Costos +1")

### Scrollbar
Webkit + Firefox scrollbar en paleta oscura: `rgba(255,255,255,0.18)` inyectado via `<style id="ntv-style">`.

### Nuevos globals en ui.js (para el filter)
```javascript
window.NODE_GROUPS_MAP   // nodeId → [{id, name, color}]
window.NODE_CONCEPTS_MAP // nodeId → Set<conceptId>
```

---

## FIX CONCEPTS + LINKS ✅ (sesión 10)

### SQL aplicado en producción
```sql
-- link_concepts: columna link_id que faltaba
ALTER TABLE link_concepts ADD COLUMN IF NOT EXISTS link_id uuid REFERENCES links(id) ON DELETE CASCADE;
DELETE FROM link_concepts WHERE link_id IS NULL;
ALTER TABLE link_concepts ALTER COLUMN link_id SET NOT NULL;
ALTER TABLE link_concepts ADD CONSTRAINT link_concepts_link_concept_unique UNIQUE (link_id, concept_id);
GRANT SELECT, INSERT, DELETE ON link_concepts TO authenticated;
-- (+ políticas RLS SELECT/INSERT/DELETE en link_concepts)

-- concepts: RLS completo
GRANT SELECT, INSERT, UPDATE, DELETE ON concepts TO authenticated;
-- (+ políticas RLS SELECT/INSERT/UPDATE/DELETE en concepts)

-- links: RLS faltante
GRANT INSERT, DELETE ON links TO authenticated;
-- (+ políticas RLS INSERT/DELETE en links)
```

### Cambios de código
- `linkConceptToEdge`: upsert → plain INSERT (ignora 23505 unique violation)
- INSERT a `links` en `node-relations-ui.js`: ahora awaited con rollback en Cytoscape si falla
- `window.refreshConceptHubs = _createAllHubs` expuesto en graph.js
- Se llama `refreshConceptHubs()` al crear un edge nuevo para que tenga hub de concepts

---

## NAVEGACIÓN Y BÚSQUEDA ✅ (sesión 11)

### Globals en graph.js
```javascript
window.zoomAll()          // fit animado sobre nodos visibles (padding 60px, 350ms)
window.centerActiveNode() // centra el nodo seleccionado
window.centerNodeById(id) // centra nodo por id + lo selecciona
```

### Chips en Settings > VIEW
- `makeActionChip('Zoom all', ...)` — arriba del section label View
- `makeActionChip('Center', ...)` — arriba de Zoom all

### Badge Search (settings-panel.js)
Badge 30px sobre `#settings-btn` (top-right, mismo estilo que `#time-badge`). Click → popup a la derecha del botón que crece hacia arriba. Input + lista de nodos filtrada. Click en nodo → `centerNodeById`.

### Badges — patrón hover ✅
Todos los badges (`#time-badge`, `#search-badge`, `#undo-badge`) tienen hover: `mouseenter` → `background: #3d3d3d` + override del botón padre para evitar que su CSS `:hover` compita. `mouseleave` → restaura.

---

## SISTEMA UNDO ✅ (sesión 11)

### Stack en engine.js
```javascript
window.pushUndo(async fn)   // agrega closure al stack (máx 30)
window.performUndo()        // ejecuta y elimina el último
// Ctrl+Z / Cmd+Z → performUndo()
```

`_syncUndoBadge()` actualiza `#undo-badge` background: `#272727` con undo disponible, `#1a1a1a` sin undo.

### Badge Undo (settings-panel.js)
Badge 30px sobre `#add-node-btn` (top-right). Ícono: rotate-ccw (Lucide), `stroke="white"`, `stroke-width="2"`. `stopPropagation` en click para no disparar el botón `+`.

### Acciones hooked
| Acción | Dónde | Reversa |
|---|---|---|
| Drag nodo | graph.js `grab`+`dragfree` | restaura posiciones previas + queuePositions |
| Crear nodo | graph.js `createNewNode` | removeNode |
| Editar label | graph-labels.js `closeEditor` | restaura label + queueNodeData |
| Editar formula/valor | graph-labels.js `closeEditor` | restaura formula + queueValueData |
| Cambiar shape | node-style-ui.js | restaura shape + queueNodeData |
| Cambiar color | node-style-ui.js | 1 push al abrir picker (captura color previo) |
| Cambiar size | node-style-ui.js | focus captura old, blur pushea si cambió |
| Toggle hidden | node-style-ui.js | restaura estado previo + queueNodeData |

---

## PENDIENTE / PRÓXIMA SESIÓN
- [ ] Mundo fórmulas fase 2 — fórmulas reales entre nodos (referencias, expresiones)
- [ ] SQL pendiente de aplicar en Supabase: `node_parent_concepts` + `formula` en `time_values`

### Sesión 11 — completado
- [x] Fix hub de concepts en parent edges: `_applyParent` llama `refreshConceptHubs()` + remueve hub viejo al limpiar parent
- [x] Persistencia de concepts en parent edges: tabla `node_parent_concepts` (node_id, concept_id)
- [x] Concept chips se expanden al asignar el primer concept (`expandEdge` desde `_assign`)
- [x] Al cerrar concept panel: colapsa chips si modo ≠ 'all' + limpia ACTIVE_EDGE
- [x] `window.expandEdge` expuesto globalmente desde graph.js
- [x] Mundo fórmulas fase 1: `evalFormula`, campo `formula` en time_values, queueValueData guarda formula, nodo muestra valor evaluado, toggle values/formulas en timeline
- [x] Settings > VIEW: chips "Zoom all" y "Center"
- [x] `window.zoomAll`, `window.centerActiveNode`, `window.centerNodeById` en graph.js
- [x] Badge Search sobre settings-btn: popup crece hacia arriba, filtrado en tiempo real
- [x] Sistema Undo: stack en engine.js, badge sobre add-node-btn, Ctrl+Z, 8 acciones hooked
- [x] Hover en badges: aísla visualmente del hover del botón padre

### Sesión 10 — completado
- [x] Limpieza arquitectónica completa: nodeUI.js eliminado, persistence/queue.js eliminado, bottom panel system removido de ui.js, engine.js podado, graph-events.js limpiado, HTML limpiado
- [x] **TABLA VALUES IN TIME** — panel bottom sheet con resize drag, tabla scrollable, inputs editables con persistencia directa a Supabase, refresca grafo si es período activo
- [x] Chip FILTER en tabla — panel compacto con subpanel lateral. Secciones: Sort (A→Z / Z→A), Parent, Group, Concept, Elements. Cada sección con opción "all"
- [x] Por defecto al abrir tabla: solo muestra el nodo activo; filter permite agregar más
- [x] Columna activa destacada en header de tabla (texto blanco + borde)
- [x] Focus en celda de período diferente → cambia período activo + refresca grafo
- [x] `#time-label` muestra la fecha del período activo (ej. "Oct '26") en vez de la unidad
- [x] Hub de concepts para edges nuevos: `window.refreshConceptHubs` expuesto en graph.js, llamado al crear edge en Relations
- [x] Fix persistencia concepts: SQL agregado `link_id` a `link_concepts` + RLS completo para `concepts` y `link_concepts`
- [x] Fix persistencia links: SQL RLS INSERT/DELETE en tabla `links` (faltaba)
- [x] INSERT a `links` ahora awaited con rollback en Cytoscape si falla
- [x] `linkConceptToEdge`: upsert → INSERT simple (más robusto, ignora 23505)
- [x] Nuevos globales en ui.js: `window.NODE_GROUPS_MAP` y `window.NODE_CONCEPTS_MAP` (para timeline filter)
- [x] `window._timeSetPeriod` expuesto desde settings-panel.js (para timeline panel)

### Sesión 9 — completado
- [x] Links chip unificado en Settings > View — dropdown con toggles Parent / Concept / Formula
- [x] Last review movido a sección Model (debajo de Started on)
- [x] Hubs y chips de concepto se ocultan cuando su edge type está off (SHOW_*_LINKS)
- [x] Nodos nuevos aparecen junto al nodo activo: 30px mín del activo, 80px del resto
- [x] Botón `+` se desbloquea al presionar Escape en el editor de título (fix `_clearPendingNode`)
- [x] Concepts dropdown no queda bloqueado tras seleccionar (fix `_dimSiblingChips`)

### Sesión 8 — completado
- [x] Color picker unificado (`color-picker.js`) — paleta 8 colores + cuadrado custom nativo

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
