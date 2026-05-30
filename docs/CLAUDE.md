# IDEMODEL — Contexto de Sesión
Última actualización: 30/05/2026 (sesión 5)
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
    graph-dom-badges.js   ← posicionamiento de badges DOM (5 badges)
    graph-labels.js       ← labels HTML overlay (title/value/unit + unit selector)
    graph-style.js        ← estilos Cytoscape
    graph-events.js       ← eventos del grafo

  ui/
    node-style-ui.js      ← panel de style (shape/color/size/hidden chips)
    node-relations-ui.js  ← panel de relations (parent/concept link/groups chips) ← NUEVO sesión 5
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

## MIGRACIÓN ARQUITECTÓNICA EN CURSO
⚠️ El proyecto está a mitad de migración de arquitectura monolítica → modular.
Conviven dos mundos:

- `docs/js/api.js` — archivo viejo, aún cargado y activo
- `docs/js/persistence/queue.js` — archivo nuevo modular

**Problema concreto**: `queueNodeData` existe en AMBOS archivos. El browser carga el de `api.js` como activo. Por eso cualquier campo nuevo debe agregarse en `api.js` (el activo).

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

⚠️ El campo viejo era `size` — ya no existe en la tabla. Ahora es `size_px`.

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

## TABLA LINK_CONCEPTS — PENDIENTE ⚠️
El fetch en `api.js` usa `.in('link_id', linkIds)` pero la columna real en DB se llama diferente.
Error: `PGRST204 column link_concepts.link_id does not exist`.
El error está silenciado (`linkConcepts = []` como fallback). Deuda para próxima sesión.

---

## ARQUITECTURA — CAPAS VIEJAS Y NUEVAS

El proyecto tiene código de dos generaciones coexistiendo. Esta sección mapea qué es qué para facilitar la limpieza eventual.

### Mapa por archivo

| Archivo | Estado | Notas |
|---|---|---|
| `api.js` | **Activo — keeper** | queueNodeData, queueValueData, loadData, init. Fuente de verdad. |
| `ui.js` | **Mixto** | handleData ✅ activo y necesario. Bottom panel (openEdgePanel, openCreateConceptPanel, openNodePanel, openColorSelector) → OLD, reemplazable. |
| `graph.js` | **Activo — keeper** | renderGraph, estilos Cytoscape, createNewNode, removeNode, workspace. Todo activo. |
| `graph/graph-dom-badges.js` | **Activo — keeper** | Sistema de badges actual. Reemplazó a nodeUI.js. |
| `graph/graph-labels.js` | **Activo — keeper** | Labels HTML overlay. |
| `graph/graph-events.js` | **Mixto** | Node tap → badges ✅ nuevo. Edge tap → `openEdgePanel()` OLD. Canvas tap → `openCreateConceptPanel()` OLD. |
| `graph/graph-style.js` | **Activo — keeper** | getCSSVar, getNodeColor, etc. |
| `nodeUI.js` | **MUERTO** | Sistema de badges radiales original. `showNodeUI()` nunca se llama. Solo `removeNodeUI()` se importa (como limpieza residual). Se puede eliminar tras verificar. |
| `engine.js` | **Parcialmente activo** | `setState/getState/__STATE` usado en graph.js para workspace. Fórmulas y validación → probablemente muerto. No tocar hasta mapear. |
| `persistence/queue.js` | **Supersedido** | Define `queueNodeData` sin los campos nuevos (parent, hidden). Cargado antes que api.js pero api.js lo sobreescribe. Se puede eliminar. |
| `ui/node-style-ui.js` | **Activo — keeper** | Panel de style badge. |
| `ui/node-relations-ui.js` | **Activo — keeper** | Panel de relations badge. Nuevo (sesión 5). |
| `ui/settings-panel.js` | **Activo — keeper** | Sistema de chips flotantes. |
| `ui/ui-chips.js` | **Activo — keeper** | Helpers de chips. |

### Código old activo que tiene que ser reemplazado

**`graph-events.js`** llama a dos funciones old que abren el bottom panel:
```javascript
// Edge tap → OLD (abre bottom panel de edge)
openEdgePanel(edge);  // definida en ui.js

// Canvas tap → OLD (abre bottom panel de concepts)
openCreateConceptPanel();  // definida en ui.js
```
Cuando se trabaje concept links, el edge tap debería simplemente hacer expand/collapse visual sin abrir el bottom panel. El canvas tap debería solo cerrar paneles flotantes.

**`ui.js`** contiene funciones old que siguen registradas globalmente pero ya no tienen entrada real:
- `openNodePanel()` — era el panel de nodo del bottom panel. Reemplazado por badges.
- `openColorSelector()`, `selectColor()`, `closeColorSelector()` — era el selector de color del old panel.
- `openCreateConceptPanel()`, `openEdgePanel()` — aún llamadas desde graph-events.js.
- `openPanel()`, `closePanel()` — el sistema base del bottom panel.

**`#bottom-panel`** en `idemodel.html` — el div todavía existe en el HTML. Cuando se elimine el bottom panel system se puede borrar.

**`nodeUI.js`** — completamente muerto. Solo sobrevive porque `removeNodeUI` se importa en graph.js como limpieza cuando se clickea el canvas. Se puede reemplazar con una línea inline.

### Qué conservar del sistema de concept chips (graph.js)
`expandEdge` / `collapseEdge` / `updateAllChips` — el sistema visual de chips en los edges (nodos Cytoscape que flotan sobre el edge) sigue activo y funciona. Lo que hay que reemplazar es la UI de gestión (openEdgePanel) no el renderer.

### Plan de limpieza (cuando sea el momento)
Orden recomendado después de concept links:

1. **graph-events.js**: reemplazar `openEdgePanel(edge)` por expand/collapse limpio y `openCreateConceptPanel()` por cierre de paneles.
2. **nodeUI.js**: eliminar el archivo. Reemplazar el `import { removeNodeUI }` en graph.js por una función inline de 2 líneas.
3. **persistence/queue.js**: eliminar. Borrar su `<script>` tag en el HTML.
4. **ui.js**: eliminar las funciones del bottom panel (openPanel, closePanel, openNodePanel, openEdgePanel, openCreateConceptPanel, openColorSelector). Conservar handleData y updateTopUIContrast.
5. **idemodel.html**: eliminar `<div id="bottom-panel">`.
6. **engine.js**: auditar. Si `setState/getState` solo se usa para workspace (que ya se guarda con queueWorkspace), se puede eliminar también.

---

## PENDIENTE / PRÓXIMA SESIÓN
- [ ] `link_concepts` — corregir nombre de columna en la query de `api.js`
- [ ] Concept Links chip — validar persistencia end-to-end (links table INSERT/DELETE + carga al recargar)
- [ ] View level → filtrar nodos por nivel de profundidad
- [ ] Limpieza arquitectónica (después de concept links — ver sección arriba)

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
