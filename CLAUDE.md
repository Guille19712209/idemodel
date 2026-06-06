# IdeModel — Guía para Claude

Tool de modelado visual de ideas: un grafo interactivo con dimensión temporal donde los
nodos tienen valores/fórmulas y relaciones cualicuantitativas. Autor: Guille (arquitecto,
no IT — trabaja con Claude como programador, muy enfocado en perfección visual del UI).
URL en producción: **idemodel.app**

## ⚠️ AL INICIAR SESIÓN — leer estos tres documentos, en orden

1. **`CLAUDE.md`** (este archivo) — mapa de arquitectura y punto de entrada.
2. **`docs/STATE_NOW.md`** — estado actual / contexto técnico profundo. La fuente de verdad
   de implementación: esquema de tablas, SQL/RLS aplicado, decisiones de cada feature, globals,
   pendientes. Consultar antes de tocar cualquier subsistema.
3. **`MANUAL.md`** — manual de usuario final (qué hace cada panel/feature de cara al usuario).

Este `CLAUDE.md` se carga solo al arrancar; `STATE_NOW.md` y `MANUAL.md` hay que abrirlos.

## Documentación de referencia

| Archivo | Qué es |
|---|---|
| `docs/STATE_NOW.md` | **Estado actual + contexto técnico profundo** (ex `docs/CLAUDE.md`, ~1400 líneas). Fuente de verdad de implementación. |
| `MANUAL.md` | Manual de usuario final. |
| `docs/FUNCIONES.md` | Referencia de funciones de fórmula. |
| `Documentation/` | Notas conceptuales y de arquitectura originales. |

> **Protocolo de sesión:** al arrancar, leer los tres documentos de arriba. Al cerrar, actualizar
> `docs/STATE_NOW.md` (estado/decisiones) y, si cambió arquitectura o features de usuario, este
> `CLAUDE.md` y `MANUAL.md`. Commitear. Mantener los tres en sync con el código.

## Stack

- **Frontend:** HTML + CSS + JavaScript **Vanilla** (sin frameworks, decisión arquitectónica de control total del UI). Sin build, sin `package.json`, sin `node_modules`.
- **Motor gráfico:** Cytoscape.js (cargado por CDN).
- **Backend:** Supabase (PostgreSQL + Auth + Storage). Cliente Supabase vía ESM CDN en `docs/js/api.js`.
- **Deploy:** GitHub Pages sirviendo `docs/` (ver `docs/CNAME` → idemodel.app).

## Cómo correr

No hay paso de build. Servir `docs/` con cualquier static server y abrir en el navegador:

```powershell
# desde la raíz del repo
python -m http.server 8000 --directory docs
# luego abrir http://localhost:8000/index.html
```

- `docs/index.html` — landing + login (Google OAuth vía Supabase).
- `docs/idemodel.html` — la app (el grafo). Soporta `?m=<model_id>` para abrir un modelo y `?focus=name`.

## Principios de arquitectura (congelados)

1. **Edges derivados, NO persistidos.** Los edges se reconstruyen en runtime desde atributos del nodo:
   - `type:'parent'` → derivado de `nodes.parent` (los `parent` en la tabla `links` se filtran al cargar).
   - `type:'formula'` → derivado escaneando las fórmulas de `time_values` (`node:<uuid>[offset]`).
   - `type:'manual'` (concept links) → estos sí viven en la tabla `links`.
2. **Modelo desacoplado del renderer.** El modelo existe independiente de Cytoscape.
3. **ID ≠ Label.** ID técnico (uuid) estable; label humano editable y único.
4. **Valores derivados.** `time_values.formula` (texto) es la fuente de verdad; el `value`
   numérico se calcula localmente y **no se persiste**.

## Mapa de archivos (`docs/js/` — todos activos salvo aviso)

```
api.js            módulo. Cliente Supabase, loadData, queueNodeData, queueValueData,
                  saveFormulaForPeriod. Fuente de verdad de persistencia.
ui.js             script. handleData (Supabase → Cytoscape, ~línea 320), evalFormula,
                  formatNumber/formatValue, updateTopUIContrast, recomputeFormulas.
graph.js          módulo. renderGraph, estilos Cytoscape, createNewNode/removeNode,
                  workspace (zoom/pan), concept hubs, formula edges, view level, undo hooks.
engine.js         script. setState/getState/__STATE + undo stack (pushUndo/performUndo).
formula.js        script. Motor de fórmulas: tokenize/serialize/evaluate/validate,
                  recomputeAll (orden topológico + detección de ciclos), bakeRandom (RND).
app.js            módulo. Bootstrap.

graph/
  graph-dom-badges.js   5 badges DOM sobre el nodo (style/relations/comments/timeline/delete).
  graph-labels.js       labels HTML overlay (title/value/unit + unit selector).
  graph-events.js       eventos tap del grafo.
  graph-style.js        getCSSVar, getNodeColor, getEdgeColor.

ui/
  settings-panel.js     ⭐ chips flotantes de los 3 paneles (Settings ⚙ / Time ⏱ / Logo 💡),
                        + Open/Share/Units/Export, time slider, search/undo badges.
  node-style-ui.js      panel del badge style (shape/color/size/hidden/coords/text_only).
  node-relations-ui.js  panel del badge relations (parent/concept link/groups).
  node-comments-ui.js   panel del badge comments.
  node-timeline-ui.js   tabla "Values in Time" (bottom sheet) + filtros + export.
  concept-panel.js      panel flotante de concepts (desde el hub del edge).
  formula-editor.js     editor contenteditable con highlight + autocomplete + All times/Import.
  color-picker.js       picker de color unificado (singleton).
  ui-chips.js           helpers de chips.
```

Orden de carga en `idemodel.html`: `engine.js`, `formula.js` → módulos UI (`ui-chips`,
`color-picker`, `formula-editor`, `node-*`, `concept-panel`, `settings-panel`) →
`graph.js` (module) → `ui.js` → `api.js` (module) → `app.js` (module).

## Convenciones y trampas conocidas

- **Comunicación entre archivos vía `window.*`.** Mezcla de módulos ES y scripts regulares;
  todo lo compartido se expone en `window` (ver lista completa de globals en `docs/CLAUDE.md`).
  Ej.: `MODEL_ID`, `VALUES_DATA`, `CURRENT_PERIOD`, `USER_ROLE`, `refreshFormulaEdges`,
  `recomputeFormulas`, `markFormulaCycles`, `refreshConceptHubs`, `openFormulaEditor`.
- ⚠️ **`window.MODEL_DATA` y `window._currentModel` deben mantenerse sincronizados.**
  `saveModelField` actualiza ambos + siempre setea `last_review` y `last_user`.
- ⚠️ **SVG inline:** `styles.css` tiene una regla global `svg { width: 4%; }` que aplasta
  cualquier SVG inline → siempre dar override explícito de `width`/`height`.
- ⚠️ **Cytoscape no soporta selectores compuestos `:not(...)`** en listeners de eventos →
  usar guard manual (`if (e.target.data('isChip') || e.target.data('isConceptHub')) return`).
- **Permisos por rol** (`window.USER_ROLE`: owner/writer/reader): hay guards de reader en
  createNewNode, removeNode, edición de labels/valores y visibilidad de badges.
- **RLS de Supabase:** features nuevos suelen requerir GRANT + policies. El SQL aplicado en
  producción está documentado tabla por tabla en `docs/CLAUDE.md`.
- **Idioma:** UI en inglés; comentarios/docs/comunicación con Guille en español.

## Esquema de datos (resumen — detalle completo en `docs/CLAUDE.md`)

Tablas: `models`, `nodes`, `units`, `time_values`, `groups`, `node_groups`, `links`,
`concepts`, `link_concepts`, `node_parent_concepts`, `users`, `model_users`.

- `nodes`: `parent` es la fuente de verdad del edge parent; `size_px`/`size_type`,
  `hidden`, `comment`, `text_only`.
- `time_values`: `(node_id, period)` con `formula` (texto = fuente de verdad).
- `units`: `number_format` (`plain`/`integer`/`decimal2`/`accounting`/`percent`) — solo presentación.
- `models.workspace` (jsonb): zoom/pan/expandedEdges/conceptsMode, guardado debounced.
