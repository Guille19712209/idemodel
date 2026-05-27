# IDEMODEL — Contexto de Sesión
Última actualización: 27/05/2026
Con: Claude Sonnet

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
  api.js              ← ARCHIVO VIEJO (aún activo, contiene queueNodeData)
  ui.js               ← MAPEO REAL de datos Supabase → Cytoscape (línea ~367)
  graph.js            ← renderGraph, eventos, workspace
  engine.js           ← handleData, state, fórmulas

  graph/
    graph-dom-badges.js   ← posicionamiento de badges DOM
    graph-labels.js       ← labels HTML overlay (title/value/unit)
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
| name | text | visible en top-ui, editable inline |
| background_color | text | color de fondo del grafo |
| background_image_url | text | URL pública de Supabase Storage |
| version | text | editable desde logo panel |
| periods | integer | cantidad de períodos |
| time_unit | text | hour/day/week/month/quarter/semester/year/moment |
| starting_date | date | fecha inicio |
| comments | text | notas del modelo |
| updated_at | timestamp | last review |

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

## FLUJO DE DATOS AL CARGAR

```
Supabase → api.js:loadData() → window.handleData(data)
→ ui.js:handleData() [línea ~320]
→ graphNodes = data.nodes.map(n => { data: { id, label, shape, color, alpha, size: n.size_px, size_px: n.size_px, size_type: n.size_type ... } })
→ window.renderGraph({ nodes: graphNodes, edges: graphEdges })
→ graph.js:renderGraph() → Cytoscape
```

Globals expuestos al cargar:
- `window.MODEL_ID` — uuid del modelo activo
- `window.MODEL_DATA` — objeto completo de la tabla models
- `window._currentModel` — idem (ambos deben mantenerse sincronizados, ver nota abajo)
- `window.MODEL_AUTHOR` — user_id del owner (primeros 8 chars)
- `window.UNITS_DATA` — array de units del modelo
- `window.UNITS_MAP` — map id→unit

---

## GLOBALS — NOTA CRÍTICA DE SINCRONIZACIÓN ⚠️

`window.MODEL_DATA` y `window._currentModel` son dos objetos separados que deben mantenerse sincronizados. `ui.js` setea `_currentModel` al cargar. `saveModelField` en `settings-panel.js` actualiza ambos:

```javascript
async function saveModelField(field, value) {
  // ...update Supabase...
  if (!window.MODEL_DATA) window.MODEL_DATA = {};
  window.MODEL_DATA[field] = value;
  // Mantener _currentModel sincronizado
  if (!window._currentModel) window._currentModel = {};
  window._currentModel[field] = value;
}
```

Si se agrega algún panel o chip que lea datos del modelo en runtime, siempre usar `window._currentModel` y asegurarse que `saveModelField` lo actualice.

---

## SISTEMA DE CHIPS FLOTANTES (settings-panel.js)

### Concepto
Sin contenedor visible. Los chips flotan sobre el grafo, apilados desde el botón que los activa. Mismo lenguaje visual que los badges de nodo.

### Tres paneles

**⚙ Settings** (botón `#settings-btn`, bottom-left) — chips suben hacia arriba:
- STYLE: Background color (`createColorChip` sin alpha), Background image (→ sub-panel)
- VIEW: Parent link, Concept link, Formula link (on/off toggle), View level (−N+), Show hidden (on/off)
- UNITS: Units (→ sub-panel compacto)

**⏱ Time** (botón `#time-circle`, top-right) — chips bajan hacia abajo:
- Periods (editable inline)
- Time unit (dropdown con opciones: hour/day/week/month/quarter/semester/year/moment)
- Starting date (mini calendar custom)

**💡 Logo** (botón `#logo-btn`, top-left) — chips bajan hacia abajo:
- FILE: New, Open, Close, Share, Export (action chips — console.log por ahora)
- MODEL: Author (readonly), Version (editable), Started on (date picker), Last review (date picker), Comments (expande textarea)

### Sub-paneles
Se abren a la derecha del chip que los activa. Usan clase `shape-dropdown sp-subpanel-wrap` — mismo fondo oscuro semitransparente. Posición con `clamp` para no salirse de pantalla.

### Constantes ajustables
```javascript
const GAP     = 8;   // px entre chips
const GAP_BTN = 20;  // px entre botón y primer chip
```

### Ajuste de tamaño de chips
- Altura: `ui-chips.css` → `.ui-chip { height: 30px }`
- Fuente: `ui-chips.css` → `.ui-chip-label { font-size: 12px }` y `.ui-chip-value { font-size: 12px }`

---

## BACKGROUND IMAGE — IMPLEMENTACIÓN ACTUAL ✅

### Bucket Supabase
- Nombre: `model-backgrounds`
- Tipo: PUBLIC
- MIME types permitidos: `image/jpeg`, `image/png`
- Límite: 2MB

### Estrategia de naming
Cada imagen se sube con nombre único basado en timestamp:
```
{modelId}/background_{Date.now()}.{ext}
```
Esto evita cualquier problema de caché de CDN o browser — la URL es siempre diferente.

### Flujo de upload
1. Lista todos los archivos del modelo en el bucket (`storage.list(modelId)`)
2. Los borra todos (`storage.remove(toRemove)`)
3. Sube el nuevo con nombre único
4. Guarda la URL pública en `models.background_image_url`
5. Aplica al grafo con `_applyBgImage(url)`
6. Actualiza `window._currentModel.background_image_url` vía `saveModelField`

### Aplicación al cargar (ui.js ~línea 431)
```javascript
if (data.model?.background_image_url) {
  const baseUrl  = data.model.background_image_url.split('?')[0];
  const freshUrl = `${baseUrl}?t=${Date.now()}`;
  graph.style.backgroundImage    = `url(${freshUrl})`;
  graph.style.backgroundSize     = 'cover';
  graph.style.backgroundPosition = 'center';
}
```

### ⚠️ Live Server
Al desarrollar con Live Server, hacer **hard reset** (Cmd+Shift+R / Ctrl+Shift+R) después de modificar JS para asegurarse que tome el código nuevo.

---

## SISTEMA DE BADGES
Los badges son elementos DOM (no Cytoscape) posicionados sobre el grafo via `#badge-layer`.

Tipos: style (pincel), relations, comments, timeline

**Posicionamiento — ESTADO FINAL:**
- X: anclados al right del texto más ancho del label + `OFFSET_X_MODEL * zoom`
- Y: centro del grupo alineado al centro vertical del labelEl → `labelRect.top + labelRect.height / 2 + (20 * zoom)`
- Tamaño escalado con zoom: `BADGE_SIZE_MODEL * zoom`

```javascript
const BADGE_SIZE_MODEL = 10;
const BADGE_GAP_MODEL  = 2;
const OFFSET_X_MODEL   = 10;
```

---

## SISTEMA DE LABELS
Labels son overlays HTML centrados en el nodo:
```javascript
el.style.left = pos.x + 'px';
el.style.top  = pos.y + 'px';
el.style.transform = `translate(-50%, -50%) scale(${zoom})`;
```
Estructura: `.label-content > .title-slot > .title`, `.value-slot > .value`, `.unit-slot > .unit`

---

## SISTEMA DE STYLE PANEL (node-style-ui.js)
Panel que aparece al clickear el badge de pincel. Chips:
- `shape` → dropdown (ellipse/round-rectangle/rectangle/diamond)
- `color` → `createColorChip` con alpha
- `size` → dropdown fixed/by unit + campo px inline

---

## PENDIENTE / PRÓXIMA SESIÓN

- [ ] Funcionalidad real de los toggles VIEW:
  - Parent link, Concept link, Formula link → filtrar edges en Cytoscape
  - View level → filtrar nodos por nivel
  - Show hidden → mostrar/ocultar nodos hidden
- [ ] Background color → aplicar al fondo del grafo (¿ya funciona?)
- [ ] File actions en logo panel (New, Open, Close, Share, Export)
- [ ] Unit selector en nodo → label de unit como dropdown que lista units del modelo (con `+` que abre settings → Units si no hay ninguna)
- [ ] "By unit" en size badge → calcular tamaño proporcional al valor del nodo dentro del rango de su unit
- [ ] Migración completa `api.js` → `persistence/` (deuda técnica, no urgente)

---

## PROTOCOLO DE SESIÓN
Al arrancar: zip repo actualizado + este documento
Al cerrar: actualizar este documento + commitear repo

---

## NOTAS DE GUILLE
- Arquitecto, no IT. Viene trabajando con ChatGPT como programador.
- Muy enfocado en perfección visual — la simplicidad y coherencia del UI es estratégica para la adopción.
- El proyecto tiene base conceptual sólida y arquitectura bien pensada.
- Rocío es su señora ☕