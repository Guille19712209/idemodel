# IDEMODEL — STATE NOW (estado actual + contexto técnico)
> Punto de entrada: ver `CLAUDE.md` en la raíz. Este doc es el #2 de los tres a leer al iniciar.
Última actualización: 28/06/2026 (sesión 32 — size W/H independientes)
Con: Claude Opus 4.8

## SESIÓN 32 (28/06/2026) — Size por eje: W y H independientes

Antes el tamaño del nodo era **un solo control** (`size_type` + `size_px`) que alimentaba
width y height por igual → todo cuadrado/proporcional. Ahora **cada eje se configura aparte**:
permite rectángulos/elipses estirados y que la escala "by unit" afecte **una sola dimensión**
(ej.: W fixed + H by unit = una barra cuya altura codifica el valor).

### Datos (migración aplicada)
- Dos columnas nuevas en `nodes`: **`size_type_h` (text)** y **`size_px_h` (numeric)**.
- **Eje W = columnas históricas** `size_type`/`size_px` (sin cambios → retrocompatible).
- **Eje H = `size_type_h`/`size_px_h`**, con **FALLBACK a W cuando son null** → los nodos
  viejos siguen cuadrados sin migrar datos. Default de nodo nuevo: ambas H en null.
- SQL: `ALTER TABLE public.nodes ADD COLUMN IF NOT EXISTS size_type_h text, ADD COLUMN IF NOT EXISTS size_px_h numeric;`
  (RLS sin cambios: las policies de `nodes` son row-level, cubren columnas nuevas).

### Render (`graph.js`)
- `computeByUnitSize(ele, fallbackPx)` ahora toma un fallback px por-eje. El cache de máximo
  por unidad considera by-unit en **cualquiera** de los dos ejes (`size_type` || `size_type_h`).
- Nuevo `axisDim(ele, axis)` (window.axisDim): resuelve fixed/by-unit del eje con fallback H→W.
  Los mappers de estilo: `width → axisDim(ele,'w')`, `height → axisDim(ele,'h')`.
- **Importante:** los handlers ya NO setean `node.style({width,height})` explícito (eso pisaba
  el mapper y rompía la independencia de H). Todo cambio de tamaño hace `node.data(...)` +
  `refreshByUnitSizes()` (= `cy.style().update()`). Idem `_applyShape` y `_bulkApplyToNode`.

### UI (`node-style-ui.js` + `settings-panel.css`)
- El size-chip se rehizo: una fila gris con **dos sub-bloques W y H**, cada uno = cap (W/H) +
  **pill de modo** (`.sp-size-mode`, cyclea fixed↔by unit al click) + **px editable**
  (`.sp-size-px`, visible solo en fixed). Al pasar a fixed se siembra el px con el tamaño
  efectivo actual. Undo por cambio de pill y por px. Se eliminaron el viejo dropdown de
  size-type y el input px único.

### Propagación
- `ui.js` mapea `size_px_h`/`size_type_h` desde Supabase. `api.js queueNodeData` los whitelistea.
- `node-copy-ui.js` (duplicar) y export/import JSON (`buildModelExport` / import) copian ambos.
  `handleNewVersion` ya copiaba por spread `...n`.

---

## SESIÓN 31 (19/06/2026) — Layout preset "Value-Compare" (bosque por fórmula)

Tercer preset de layout (junto a Parent-Circular-Grid / -Tree). Idea de Guille: comparar
visualmente los **colectores mayores** del modelo por su **valor**, y que el resto de los nodos
**no cuelgue por parent sino que se agrupe por FÓRMULA**. Requisito duro: **cero colisiones**, ni
de nodo **ni de label**.

> El diseño se reescribió en la misma sesión: una primera versión empaquetaba cada árbol-parent como
> celda radial en una fila (quedaba casi idéntica al Parent-Circular-Grid). Guille pidió que el parent
> sirva **solo para detectar los colectores** y que los hijos se ordenen por fórmula → la versión final
> usa un layout **force-directed**. Lo descrito abajo es lo vigente.

### Motor (`graph.js`, `window.rearrangeGraph` → branch `mode === 'compare'`)
- **Colectores** = roots con hijos (detectados vía `parent`; el parent **solo** los identifica, no
  ordena a los hijos). Se ordenan por valor (`VALUES_DATA[id_period].value`, parse a número; sin valor
  → `-Infinity` = al final) **desc → mayor a la IZQUIERDA**. Quedan **clavados en `y=0`** (anclas fijas),
  con separación = footprints+label+GAP y un **mínimo de `2L`** para que entre el bosque-puente.
- **Bosque por fórmula** = layout **force-directed (spring-electrical)** sobre los nodos NO-colectores
  que tienen al menos una fórmula. Resortes = formula-edges (largo ideal `L=170`), repulsión all-pairs
  (`REP=L²·0.9`), gravedad débil (`0.006`) hacia `(rowCx,0)`. ~300 iteraciones con cooling (150 si
  >200 nodos). Cada nodo gravita hacia los que lo unen por fórmula y, si lo unen varios, queda en el
  **punto intermedio**. Los colectores tiran como anclas (su `disp` se calcula pero **no se aplica**).
  Init de cada libre: centroide de sus vecinos anclados + jitter (arriba/abajo alternado del eje).
- **Adyacencia por fórmula** (`adj`): no dirigida, entre nodos visibles, leída de los edges
  `type==='formula'` aunque estén ocultos (la relación lógica vale). Aristas únicas para los resortes.
- **De-colisión final** (AABB con `labelHalf`): ~80 pasadas empujando por el eje de menor solape; los
  colectores quedan fijos (solo se mueve el libre; entre dos libres se reparte). Garantiza **cero solapes
  de nodo y de label** sin importar el resultado del force-directed.
- **Footprint con LABEL.** `labelHalf(id)` mide el overlay HTML (`NODE_LABELS[id].offsetWidth/Height`,
  que a zoom 1 = unidades de modelo) y toma `max(radio, label/2)` → la separación cuenta el ancho real
  del label, no solo el círculo.
- **Huérfanos** = nodos NO-colectores **sin ninguna fórmula** → columna vertical a la **izquierda** de
  todo (`minX - 60 - maxHalfW`), ordenados por valor desc (**mayor arriba**), `15px` entre footprints.
  (Antes el criterio era "sin hijos"; ahora es **"sin fórmula"** — pedido de Guille.)
- **Visibilidad de links**: fuerza `SHOW_FORMULA_LINKS=true`, `SHOW_PARENT_LINKS=false`,
  `SHOW_CONCEPT_LINKS=false` + `updateLinkVisibility()`. No entra en el undo (toggle reversible por el
  chip Links); el undo de `_finish` solo restaura posiciones.
- Reusa `_finish` (persist posiciones + auto-fit + undo). Tuneables del feel: `L`, `REP`, `ITERS`,
  constante de resorte `0.06`, gravedad `0.006`.

### UI (`ui/settings-panel.js`)
- `LAYOUT_PRESETS` suma `['Value-Compare', 'compare']` → aparece en Settings ▸ LAYOUT ▸ Select.

### Nota
- El force-directed es estocástico (jitter en el init) → dos corridas pueden diferir un poco, pero la
  de-colisión final siempre garantiza no-solape. Componentes de fórmula sin ningún colector flotan
  contenidos por la gravedad débil al centro.

## SESIÓN 30 (18/06/2026) — Shapes custom: nodos con forma de polígono (país / SVG del usuario)

Objetivo de Guille: dejar una **puerta** para que el usuario le dé a un nodo **cualquier silueta**.

### Motor (graph/graph-style.js)
- `COUNTRY_SHAPES` — built-ins keyed por nombre. Trae **`italy`** (Natural Earth 110m, 65 puntos,
  anillo continental). Generado con corrección equirectangular `cos(latMedia)` + escala única + flip Y.
- `CUSTOM_SHAPES` (`window`) — shapes del **modelo**, id→points; se pueblan al cargar con
  `registerCustomShapes(list)` desde `models.custom_shapes`.
- `polyPointsFor(name)` — lookup unificado (custom → país → null). `null` = no es polígono.
- `applyNodeShape(node, val)` — bypass instantáneo: si `polyPointsFor` resuelve → `shape:'polygon'`
  + `shape-polygon-points`; si no, `shape` built-in normal.
- `svgToPolygon(svgText, samples=80)` — convierte un SVG a string de puntos **client-side, sin deps**:
  muestrea el contorno con `path.getTotalLength()`/`getPointAtLength()` (resuelve curvas), toma el
  path/polygon de **mayor bbox**, normaliza a [-1,1] escala única (SVG ya es Y-down = Cytoscape → sin flip).

### Render (graph.js)
- El mapper del estilo `node` resuelve `shape` vía `window.polyPointsFor(data(shape))`: si hay puntos →
  shape real `'polygon'` + `'shape-polygon-points'`; si no, el shape built-in (`ele.data('shape') || 'ellipse'`).
- `_bulkApplyToNode` usa `applyNodeShape`.

### UI (ui/node-style-ui.js)
- Dropdown de **Shape** reescrito: built-ins (`ellipse … star`, **`italy`**) + las custom del modelo
  (por id, label = name) + **"＋ Upload SVG…"**. Refactor: `_applyShape(shape,label)` reusable
  (antes inline), `_shapeOption`, `_rebuildShapeDropdown`, `_saveCustomShape`, `_uploadShape`. El chip
  muestra el nombre legible del shape actual (resuelve id→name).
- Upload: file `.svg` → `svgToPolygon` → `prompt` nombre → `_saveCustomShape` (append a
  `models.custom_shapes` vía `saveModelField`) → `registerCustomShapes` → aplica al nodo. Guard de reader.
- Persistencia: `nodes.shape` guarda el **id** del shape custom (o el nombre del país, o el built-in).
  En reload, `registerCustomShapes` + el mapper lo reconstruyen.

### Esquema
- **Nueva columna** `models.custom_shapes jsonb DEFAULT '[]'` (ver TABLA MODELS). El load ya hace
  `models.select('*')` → la trae sola. RLS: cubierta por la policy UPDATE del owner.

### Límites v1
- Un solo anillo simple (cóncavo OK; **sin islas ni huecos** — toma el subpath de mayor bbox).
- Diálogos nativos (`prompt`/`alert`). Pendiente posible: preview del contorno en el panel antes de nombrar.
- Para islas/huecos reales → imagen de fondo (otro camino, sin clip de edges).

---

## SESIÓN 29 (18/06/2026) — Color de edges (concepto/grupo) + limpieza de layouts

### 1. Color de edges al resaltar (concepto y grupo)
- **Concepts** (`graph.js`): el `edge.highlighted` (filtro de concepto activo) ahora toma el color del
  concepto vía `() => window.ACTIVE_CONCEPT_COLOR || getEdgeActiveColor()` en `line-color`/
  `target-arrow-color` — mismo criterio que el outline de los nodos relacionados (`node.concept-related`).
- **Groups** (`node-relations-ui.js`): al resaltar un grupo (click en el chip de Groups), los **edges
  cuyos dos extremos pertenecen al grupo** toman el color del grupo (bypass `line-color`/
  `target-arrow-color`). Nueva lista `_highlightedEdges` + limpieza en `_clearGroupHighlights`
  (`removeStyle` de ambos). Hubs excluidos del barrido.

### 2. Layouts — renombre + poda
- **"Grid" → "Parent-Circular-Grid"** y **"Circular tree" → "Parent-Circular-Tree"** (solo labels del
  selector; las claves internas `'grid'`/`'tree'` no cambian).
- **Eliminados los presets "Flow" y "Compare"**: preset del selector + sus bloques en `rearrangeGraph`
  (modos `'flow'` y `'compare'` borrados). Quedan **2 lentes**: `'grid'` y `'tree'`.
- **"Concept-elements" (prototipado y descartado)**: se exploró un layout que dibujaba un chip
  ephemeral por concepto (escalado 1×–6× por nº de nodos) con los nodos en círculo alrededor y edges
  tipo concepto. Se probaron variantes (fila horizontal / grid de estrellas / clones por concepto) y
  **Guille decidió no seguir** → revertido por completo (no quedó código). Nota para futuras sesiones:
  el experimento ya se hizo; no rehacerlo sin un criterio nuevo.

---

## SESIÓN 28 (17/06/2026) — Legibilidad de nodos, deuda técnica, seguridad

Sesión mixta: features de legibilidad + saneamiento del repo.

### 1. Cache-busting (al fin con token)
Diagnóstico de "veo viejo en producción": GitHub Pages sirve assets con `Cache-Control: max-age=600`
detrás de Fastly; sin versionado, navegador + CDN servían JS/CSS viejo. **Solución**: token `?v=NN`
(NN = nº de sesión) en todos los CSS/JS **propios** — `idemodel.html`, `manual.html` y los `import`
internos de `graph.js`/`graph-labels.js`. CDN NO se versiona. **Protocolo**: al cerrar sesión con
cambios de JS/CSS, bumpear `?v=<actual>`→`?v=<+1>` en una pasada sobre `docs/`. Documentado en CLAUDE.md.
Actual: **`?v=29`**.

### 2. Text size (chip nuevo en panel de style, sobre "Text only")
El label antes solo escalaba por zoom → nodo grande con texto chico (conflicto de legibilidad).
- **Auto** (toggle "A", default ON): el font-size escala con el nodo. `fs = min(max(size_px/80, 1), 5)`
  aplicado a la base (title 10 / value 18 / unit 8 px, == ui-core.css). Hasta 80px = base; sobre 80
  crece 1:1; tope 5×.
- **Manual** (A apagada): el chip se ensancha y muestra 3 inputs px **L/V/U** (label/value/unit),
  sembrados con el tamaño auto actual. Persisten.
- **Columnas nuevas** `nodes`: `text_auto` (bool), `text_label/value/unit` (real). Ver tabla de esquema.
- **Implementación**: `applyNodeTextSize(node)` en `graph-labels.js` (export + `window`), llamada por
  nodo en cada `renderNodeLabels` y desde los handlers de size/shape del style panel (vista en vivo).
  Enganchado en handleData (mapeo), queueNodeData (4 fields), `_bulkApplyToNode` (graph.js) y
  export/import JSON (settings-panel.js). Con undo.

### 3. Label a 2 líneas
- **Auto-wrap** (default): `.node-label .title` con `max-width: 13em` (em → corta por ~caracteres y
  escala con el font-size) + `-webkit-line-clamp: 2`. Nombres largos parten solos; más de 2 líneas → ellipsis.
- **Salto manual**: el editor del título (`openFieldEditor` en graph-labels.js) pasó de `<input>` a
  `<textarea>`. **Enter** = confirmar, **Shift+Enter** = salto. Auto-grow de alto, `white-space:pre`.
  El `\n` se guarda en `label` (sin columna nueva).

### 4. Zoom de rueda más fino
`graph.js` handler de wheel: coef `0.0008→0.0004` (½ del paso por tick) y tope por frame `0.7..1.4 →
0.85..1.18` (sin brincos entre "tracks" de la rueda).

### 5. Deuda técnica (sesión dedicada, mayor ROI primero)
- **Tests del motor de fórmulas**: `tests/formula.test.js` — 19 casos, `node --test` (nativo, sin deps,
  fuera de `docs/` → no se deploya). Cubre evaluate (aritmética/funciones/refs temporales `[-k]`),
  recomputeAll (orden topológico + ciclos), validate/hasCycle/cyclePath, evaluateCondition, bakeRandom.
  Técnica: el IIFE de `formula.js` setea `window.Formula`; el test apunta `globalThis.window=globalThis`
  y `eval`-úa el archivo. **19/19 verde.**
- **Consola limpia**: eliminados ~35 `console.log` de andamiaje (incluido uno que corría **por nodo en
  CADA render** dentro de `getContrastColor` → bug de perf real). Quedan `console.error`/`warn`. Helper
  `window.dlog` gateado por `window.DEBUG` en engine.js (apagado; para diagnóstico futuro). `app.js`
  quedó como módulo vacío documentado (era solo un log).

### 6. "Viajar liviano" — limpieza de repo
- **Borrados 13 archivos sin referencias** (restos de arquitectura V1/V2/V3, verificado 0 refs en HTML +
  imports + CSS): JS `graph-core`, `graph-badges`, `graph-workspace`, `node-panel`, `panels`, `modals`,
  `selector`, `edge-panel`, `node-input-ui`; CSS `app`, `controls`, `panels`, `token`.
- **6 branches viejas eliminadas** (local + remoto): `v1-stable`, `v2-stable`, `V3-contextual-ui`,
  `badge-dom-overlay`, `cytoscape-unified-ui`, `recuperado`. Repo queda con **solo `main`**.
  (Hubo que cambiar la default branch de GitHub a `main` — era `badge-dom-overlay`.)

### 7. Seguridad — credenciales expuestas
El archivo `Keys` (raíz, **commiteado en repo público**) tenía contraseñas en texto plano (cuenta
Google + Supabase). **Acción**: borrado del árbol + agregado a `.gitignore`. **Rotada la clave de
Google** (Supabase entra vía Google OAuth → sin password propia, cubierto). El historial viejo NO se
reescribió (decisión: con la clave rotada es basura inofensiva; reescribir 179 commits × 6 branches +
force-push en repo público = mucho riesgo, beneficio cosmético). **Lección**: nunca commitear secretos;
`.gitignore` ya cubre `Keys`, `config/`, `.env`, `_conn.txt`.

---

## SESIÓN 27 (15/06/2026) — Layout (sección core): presets + customs

**Insight**: el layout dejó de ser una acción de Navigate y pasó a ser una **entidad de primer
nivel** con su propio subtítulo en Settings (entre VIEW y NAVIGATE). El chip "Re-arrange" de
Navigate **desapareció**; sus 4 algoritmos ahora son los **presets** dentro de "Select".

### Nueva tabla `layouts` (snapshot de disposición por modelo)
Un custom captura **todo**: posiciones de TODOS los nodos + filtro de visibilidad (`NODE_FILTER`
serializado, Sets→arrays) + workspace (zoom/pan/expandedEdges/conceptsMode). Un modelo puede tener
muchos customs. SQL aplicado en producción:
```sql
CREATE TABLE IF NOT EXISTS public.layouts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id   uuid NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  name       text NOT NULL,
  data       jsonb NOT NULL DEFAULT '{}'::jsonb,   -- { positions, filter, workspace }
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.layouts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.layouts TO authenticated;
CREATE POLICY "select layouts" ON public.layouts FOR SELECT
  USING (EXISTS (SELECT 1 FROM model_users WHERE model_id = layouts.model_id AND user_id = auth.uid()));
CREATE POLICY "insert layouts" ON public.layouts FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM model_users WHERE model_id = layouts.model_id AND user_id = auth.uid()));
CREATE POLICY "update layouts" ON public.layouts FOR UPDATE
  USING (EXISTS (SELECT 1 FROM model_users WHERE model_id = layouts.model_id AND user_id = auth.uid()));
CREATE POLICY "delete layouts" ON public.layouts FOR DELETE
  USING (EXISTS (SELECT 1 FROM model_users WHERE model_id = layouts.model_id AND user_id = auth.uid()));
```

### Implementación
- **graph.js**: `captureLayout()` → `{positions, filter, workspace}`; `applyLayout(data)` aplica
  posiciones + filtro + workspace, **persiste** (queuePositions/queueWorkspace; salvo `reader` → solo
  vista) y registra **undo** (restaura posiciones + filtro previos). Helpers `_serializeFilter` /
  `_restoreFilter`. Decisión Guille: restaurar un custom **sobrescribe** las posiciones vivas del modelo.
- **api.js**: `fetchLayouts()` / `saveLayout(name, data)` / `deleteLayout(id)` (tabla `layouts`).
- **settings-panel.js**: sección `Layout` (subtítulo) con 2 chips:
  - **Set custom** → subpanel con input inline (`.sp-layout-input`) + botón `Save current layout` →
    `saveLayout(name, captureLayout())`.
  - **Select** → subpanel con "Presets" (Parent-Circular-Grid / Parent-Circular-Tree →
    `rearrangeGraph(mode)`; ver sesión 29) + "Custom" (lista de `fetchLayouts`, cada fila aplica
    `applyLayout`; `✕` = `deleteLayout`).
- **Estilo**: el panel "Set custom" reutiliza las clases del **Bulk** (`sp-bulk-input` + pill de acción
  `sp-bulk-action`, gris oscuro #373737 texto blanco weight 500). El input del nombre fuerza
  `font-family: Poppins` (override del `font:` monospace que trae `sp-bulk-input`). En el panel "Select"
  los subtítulos "Presets"/"Custom" van en gris claro fijo (`rgba(255,255,255,0.45)`), no el color
  adaptable de `sp-section-label`.
- **CSS** (settings-panel.css): `.sp-layout-set` (ancho), `.sp-layout-set .sp-bulk-input` (Poppins),
  `.sp-layout-save` (min-width).

### Pendiente / posible mejora
- El custom guarda zoom/pan absolutos: al restaurar reproduce el encuadre exacto (no auto-fit).
- No hay "rename" de un custom (solo crear / borrar). No hay límite de cantidad.

---

## SESIÓN 26 (14/06/2026) — Lentes de layout + fixes de visibilidad + star

### Verificación de la sesión 25 (en localhost / Live Server, NO en producción)
- ✅ Los clamps `minZoom 0.05 / maxZoom 5` resuelven la **pantalla negra**: frena antes de romperse.
- ⚠️ Molestaba que las labels **desaparecieran durante el gesto** de pan/zoom → fix abajo.

### Fix: labels vivos durante pan/zoom (graph.js)
Antes la capa entera se ocultaba (`visibility:hidden`) durante el gesto y reaparecía ~90ms después.
Reemplazado por **actualización en vivo throttleada a un rAF** (`updateNodeLabelPositions` +
`updateBadgePositions` por frame), apoyado en el **culling existente** (solo viewport). Labels pegadas
a los nodos sin parpadeo. Se mantiene la supresión por `zoom < 0.25`. NO usa textureOnViewport.

### Lentes de layout — `rearrangeGraph` reescrito (graph.js) + dropdown (settings-panel.js)
**Insight rector**: un layout en IdeModel es *algoritmo × qué relación uso de esqueleto*
(`parent`=estructura, `formula`=causalidad, `concept`=afinidad). Todo layout produce solo `{id:{x,y}}`
→ **propio y portable, cero dependencia nueva**. Dropdown de Re-arrange con 4 modos (en la sesión 29
quedaron solo 2: ver nota al final del bloque):

- **Grid** (`mode:'grid'`, default — ex "Compact"): cada árbol = una **celda con su root-origen al
  centro** (radial por anillos concéntricos, `placeTree`), celdas empaquetadas en grilla (shelf packing
  por bounding box). Nodos **sin hijos (aislados)** → **una sola línea horizontal centrada abajo** (ya no
  se mezclan en la grilla como componentes de 1 nodo). Reemplazó al viejo compact + `_packComponents`
  (eliminado, dead code).
- **Circular tree** (`mode:'tree'`): radial **parent-tree de único centro**, forest-aware. Árbol limpio
  (1 padre por nodo, `childrenOf` derivado de `parentOf`); profundidad por BFS desde los roots con hijos.
  Reglas (esquema de Guille): cada cuña vale **solo lo que necesita** (`angNeed` bottom-up = arco propio
  a su radio, o el de sus hijos empaquetados a `GAP=10px`, el mayor) × `(1+SEP_FRAC)` para las **ramas**
  → las cuñas se ven como **porciones** separadas, las hojas quedan tight. Hijos **centrados sobre el eje
  del padre**. Radio por anillo = no-colisión radial; si el total angular no entra en 360°, **escala todos
  los radios** (los ángulos bajan ∝1/k). Consts: `GAP=10`, `SEP_FRAC=0.18`, `R_MAX=6000`. Aislados →
  línea horizontal centrada abajo.
- ~~**Flow** (`mode:'flow'`)~~ y ~~**Compare** (`mode:'compare'`)~~: **eliminados en sesión 29** (Guille no
  los usaba). El código de ambos modos se borró de `rearrangeGraph`.

> **Renombre (sesión 29)**: "Grid" → **Parent-Circular-Grid**, "Circular tree" → **Parent-Circular-Tree**
> (labels del selector; claves `'grid'`/`'tree'` sin cambio). Layouts vivos hoy: esos dos.

**Auto-encuadre**: `_finish` ahora hace `cy.animate({ fit })` tras cada Re-arrange → el resultado aterriza
a un zoom legible (clave porque la escala del radial depende del nº/tamaño de nodos). Los labels siguen
por el handler de pan/zoom.

**Antagonía observada** (SUVs vs Impactaiment): el mismo radial choca con paredes opuestas — 150 hojas
**explotan** el radio (ilegible al encuadrar) y pocos nodos grandes **se comprimen**. Conclusión (y tesis
del artículo de Cytoscape, ver abajo): **ningún algoritmo salva 150 hojas en un anillo**; la palanca es
mostrar menos nodos (**View level / colapsar**), no el layout. El layout nunca fue el cuello de botella.

### Fixes de visibilidad — hidden vs view-level/filter (graph.js, graph-labels.js)
- **Labels de ocultos reaparecían en pan/zoom**: `updateNodeLabelPositions` ahora cullea también los
  nodos con `css('display')==='none'` (filtro / view level), no solo `data.hidden` — antes, al correr en
  vivo cada frame, re-mostraba labels de nodos ocultos por css. Mismo criterio que `renderNodeLabels`.
- **Se veían nodos hidden al cambiar View level / Filter**: `applyViewLevel` y `applyNodeFilter` hacían
  `css('display','element')` (inline) que **sobrescribe** la regla `node[?hidden]` del stylesheet → un
  hidden "visible por profundidad/filtro" se prendía a la fuerza. Fix: si el nodo pasa su dimensión pero
  está hidden, **`removeStyle('display')`** (que mande `node[?hidden]`, respeta `SHOW_HIDDEN`); visibilidad
  de edges por **Set lógico**, no por `css('display')` (que puede lagear tras `removeStyle`).

### Shape `star` (node-style-ui.js + settings-panel.js)
Agregado al dropdown de shape del badge style y a la lista de Bulk. `SHAPE_SCALE.star = 1.35` (el star se
ve más chico que un círculo del mismo bounding box → se escala hacia arriba).

### Fix: CDN de Cytoscape corrupto (idemodel.html)
La URL de Cytoscape estaba **corrupta** (`cytoscape.una dudain.js` en vez de `cytoscape.min.js` — se
coló texto) → `ReferenceError: cytoscape is not defined` en `graph.js:125`, la app no abría. Corregido +
**pineado** a `cdn.jsdelivr.net/npm/cytoscape@3.30.2` (jsdelivr es más estable que unpkg sin versión).
Los deps de fcose (layout-base/cose-base/cytoscape-fcose) siguen en unpkg (cargan bien; fcose ya no se usa).

> **Estado de las lentes**: ya son funcionales (no prototipos). Falta la **UI final "Layout"** (nombres
> por *intención de análisis*, no por algoritmo) + **modificadores** (orientación, anclaje por group/parent,
> spacing) + decidir el set definitivo. La perilla `SEP_FRAC` (Circular tree) y `GAP` son tuneables.

### Decisión estratégica registrada (Cytoscape vs motor propio)
- **Hand-rollear layouts NO es falla de Cytoscape** — es la costura que deja a propósito (los layouts
  son plugins; le pasás posiciones propias vía `.position()`/`preset`). Cytoscape brilla como
  **renderer + motor de interacción** (canvas, pan/zoom, hit-testing, eventos, estilos). Eso es lo caro.
- **El verdadero techo NO son los layouts, son los labels HTML** (overlay DOM sincronizado al canvas =
  la fuente de la perf/pantalla negra). Si algún día se construye motor propio, el motivo serían los
  **nodos HTML ricos**, no los algoritmos de posición.
- **Comercial/licencia**: Cytoscape es **MIT** (fcose/dagre también) → producto comercial cerrado sin
  royalties ni copyleft; bandera verde en due diligence. Depender de Cytoscape **no** limita comercializar.
- **Rumbo acordado**: motor propio NO es destino obligado; es opción estratégica diferible e incremental
  (la costura es limpia: posiciones entran, eventos salen → se puede migrar solo el renderer). **MVP:
  invertir en lentes (propias y portables) ahora; motor recién cuando el nodo HTML sea el límite.**

### Pendiente / a meditar (Guille quiere pensar el aporte de valor real)
- Definir el **set de lentes** definitivo + **modificadores** ortogonales (orientación L→R/T→B, anclaje
  por group/parent, spacing) que es lo que de verdad vuelve legible cualquier layout.
- Diseñar la **UI "Layout"** (subpanel con lentes nombradas por *intención de análisis*, no por algoritmo;
  hoy es un dropdown simple en Re-arrange).
- Apoyar las lentes en **selección de subgrafo** (View level / Filter / focus) — la tesis del artículo:
  filtrar ANTES de layoutear; el grafo entero es ruido.
- **Pusheado a producción** en esta sesión (sesión 25 perf + sesión 26 lentes/fixes/star).

## SESIÓN 25 (13/06/2026) — Performance del grafo (modelo grande) ⏳ A VERIFICAR

> ⚠️ **Sin pushear. A verificar en localhost** (`python -m http.server 8000 --directory docs`).
> OJO: durante la sesión se probó por error en **idemodel.app (producción = código viejo)** → mucha
> confusión ("no pasaba nada"). Para probar cambios locales: **localhost:8000**, no idemodel.app.

Modelo de prueba: "Evaluación Comparativa SUVs" — 160 nodos, **bosque de 10 componentes**
desconectados (5 SUVs con ~30 hijos c/u + 5 "Score Final" sueltos), **2 niveles**, 155 nodos `by unit`.
Síntomas: zoom torpe/lento, **pantalla negra** al zoom-in y al alejarse, layout disperso.

Diagnóstico (DevTools Performance): el costo se iba en **renderNodeLabels** (90%), `getBoundingClientRect`
(reflow forzado por nodo), `computeByUnitSize` **O(N²)**, y la **capa de labels** (cientos de divs
escalados → satura el GPU = pantalla negra). NO era límite del navegador ni "coordenadas gigantes"
(el modelo mide ~7000px). La pantalla negra a zoom extremo sí era régimen degenerado de transformaciones.

Cambios (solo `graph.js` + `graph-labels.js`):
- **renderNodeLabels** (graph-labels.js): saqué el `getBoundingClientRect` por-nodo (muerto + reflow);
  listeners de title/value/unit **solo al crear** (antes se re-agregaban en cada render → fuga); hoist
  de `getComputedStyle('--top-ui-color')`; uso `data('alpha')` en vez de `node.style(...)`.
- **Supresión de labels por zoom**: si `zoom < 0.25` se oculta toda la capa (ilegibles + caros).
- **Culling de labels** (updateNodeLabelPositions): solo pinta los que están en viewport (clave para
  el zoom-in: evita componer 160 divs escalados de golpe). Saqué otro `getBoundingClientRect` muerto.
- **Ocultar labels durante pan/zoom** (graph.js handler): la capa se esconde mientras dura el gesto y
  reaparece ~90ms después (debounced). **NO** se usa `textureOnViewport` (daba pantalla negra) ni
  `hideEdgesOnViewport`.
- **computeByUnitSize** O(N²)→O(N): cachea el máximo por unidad por pasada de render (queueMicrotask
  para auto-limpiar → siempre fresco).
- **minZoom: 0.05 / maxZoom: 5**: evita el zoom degenerado (pantalla negra a zoom extremo in/out).
- **Tree radius**: tope duro `R_MAX=6000` + guardas de finitos (no genera coordenadas absurdas/NaN).
- **`_packComponents`** (en rearrangeGraph): empaqueta los componentes desconectados (bosque) en grilla
  (shelf packing) tras el layout. Validado offline: comprime ~7000²→~2000×1460.
- **Compact reescrito (determinístico, forest-aware)**: reemplazó fcose (que inflaba cada componente y
  dispersaba el bosque). Cada árbol root-al-centro con descendientes en anillos (radio adaptado a la
  cantidad por nivel) + `_packComponents`. Determinístico, compacto, sin cuelgues.

⚠️ **Intentos descartados** (no repetir): `textureOnViewport:true` (pantalla negra); handler de rueda
propio sin/​con throttle + `userZoomingEnabled:false` (clavaba — era el zoom degenerado, ahora topado
con min/maxZoom, podría reintentarse para pasos parejos pero con cuidado).

**Pendiente mañana:** (1) verificar TODO en localhost con el modelo SUVs (¿Compact compacta? ¿se acabó
la pantalla negra?). (2) Si Compact OK → evaluar Tree forest-aware (per-componente + grilla).
(3) zoom de rueda "parejo" (pasos chicos uniformes) si se quiere, ahora seguro con los clamps.
(4) Recién con todo verificado: push a producción.

## SESIÓN 24 (13/06/2026) — Hide when + reorg Settings + Bulk + fix New version ✅

> ⚠️ **Migración SQL pendiente de confirmar**: `alter table public.nodes add column if not exists hide_when text;`
> El código es tolerante (si la columna no existe, no persiste, no rompe). Necesaria para Hide when (single y bulk).

### Hide when — condición de visibilidad por período (formula-editor, graph, node-style-ui, ui, api)
Chip **"Hide when"** en el badge style: abre el editor de fórmula en **modo `condition`** (boolean).
- `Formula.evaluateCondition(stored, nodeId, period)` (formula.js) → bool. Atajo: si empieza con
  comparador, antepone el ref propio (`<0` = valorPropio<0). Convierte `=` suelto a `==`. Reusa la
  sustitución de refs de `evaluate` pero devuelve booleano.
- **hidden EFECTIVO vs MANUAL**: `node.data('hidden')` pasó a ser **efectivo** = `hidden_manual || condición`.
  `node.data('hidden_manual')` = flag persistido (columna DB `hidden`). En ui.js se cargan ambos +
  `hide_when`. El toggle Hidden de node-style-ui opera sobre `hidden_manual` y llama `recomputeHideConditions`.
- `window.recomputeHideConditions()` (graph.js): recalcula el efectivo de cada nodo y corre en
  `refreshPeriod` (cada tick del slider + tras recompute) y en la carga inicial. Reusa toda la
  maquinaria existente (`node[?hidden]`, labels, SHOW_HIDDEN revela). **Re-renderiza labels HTML al
  final** (dependen de `data.hidden`; fix: antes solo se actualizaban en el slider → labels de nodos
  ocultos por condición quedaban prendidos en la carga inicial / al guardar). Editor en modo condición:
  sin spread/Import/AI, sin chequeo de ciclo de valor; avisa "True/False now".
- Persistencia: `hide_when` en queueNodeData + en duplicar nodo (node-copy) + export/import.

### Reorg del panel Settings → MODEL / VIEW / NAVIGATE (settings-panel.js + .css)
`buildSettingsChips` reordenado en tres grupos (el array apila hacia arriba; label DESPUÉS del grupo):
- **MODEL** (arriba): Bulk · Background · Units.
- **VIEW**: Concepts · Filter · Links · Show hidden.
- **NAVIGATE**: Center · View level · Re-arrange · Zoom all.
- **Background unificado**: un solo `makeSubpanelChip('Background')` → `buildBackgroundContent()` con
  pestañas **Color | Image** (either/or: elegir color descarta la imagen vía `_removeBgImage`; la
  pestaña Image se reconstruye al entrar). Se borró `makeBgColorChip` (chip viejo). El handler de
  click-afuera de settings ahora whitelistea `.color-picker-popup` (para el picker anidado).
- **Toggle dots**: `.shape-dropdown .sp-toggle-dot[.sp-toggle-on]` → gris claro `#d6d6d6` (en subpaneles
  oscuros el `#373737` no se veía). Los chips claros `.ui-chip` conservan el dot oscuro.

### Bulk — aplicación masiva (settings-panel.js + graph.js + api.js)
Chip **"Bulk"** en MODEL. Panel 2 fases: **Select** (5 facetas, estado propio `window.BULK_SEL`,
preview por selección en canvas) → **Set attributes** (atributo + valor + "Apply to N").
- Selección: `window.bulkMatchedIds(sel)` (misma lógica de matching que applyNodeFilter, devuelve ids)
  + `window.bulkPreview(ids)` (select en canvas). Header **SELECT** (estilo `.sp-filter-list-header`),
  footer con conteo + pill de acción `.sp-bulk-action` ("Set attributes", estética del chip Bulk).
- Apply de columnas: `window.bulkApplyAttr(ids, payload, opts)` (graph.js) — cy + `window.bulkUpdateNodes`
  (UPDATE ... IN, un write) + **undo único** (snapshot por nodo). `_bulkApplyToNode`/`_bulkReadCol`.
- Atributos: Value · Color(+alpha) · Size(px/by unit) · Shape · Unit · Group · Parent · Text only ·
  Comment(replace/append) · Hidden · Hide when.
- **Value (bulk-value)**: editor en modo `bulk-value` (sin spread/AI, con pill **Self**). Sentinel
  `window.BULK_SELF_ID = '00000000-...-000000000000'` (pseudo-nodo "Self"); `window.bulkApplyFormula`
  lo reescribe al uuid de cada nodo + sella RND + **bloquea Self offset ≥ 0** (auto-ciclo). Escritura
  batcheada `window.bulkWriteFormulaRows` (updates agrupados por fórmula + insert) + recompute + undo.
  Períodos: Current / All times / From now.
- **Group**: `window.bulkApplyGroup(ids, groupId, add)` (node_groups insert/delete batch, undo). Filas
  con nombre **contenteditable** + swatch con color picker (persisten a `groups`), "+ New group"
  (idéntico al picker del nodo: name 'Group', GROUP_COLORS) y **× = borrar del sistema**.
- **Parent**: `window.bulkApplyParent(ids, parentId|null)` — guarda de ciclos (excluye P y sus
  ancestros), `_setNodeParentRuntime` rederiva el edge, undo.
- **Comment append**: `window.bulkAppendComment(ids, text)` (per-nodo, undo).
- **`window.deleteGroup(groupId)`** (graph.js, compartida): borra del sistema (node_groups + groups +
  GROUPS_DATA + node.data('groups') + NODE_GROUPS_MAP + sets de Filter/Bulk). Usada por el picker del
  nodo (node-relations) y por Bulk. La × del **chip** de relations sigue solo desasignando.

### Fix: New version no generaba edges (settings-panel.js `handleNewVersion`)
Los edges son derivados → la copia los rompía: (1) no remapeaba `nodes.parent`, (2) no reescribía las
refs `node:<uuid>` de las fórmulas, (3) copiaba `l.source/target` cuando las columnas son
`source_id/target_id` (no copiaba ningún link). Corregido + ahora copia también **groups, concepts,
node_groups, link_concepts, node_parent_concepts** (antes se perdían). Aplica a versiones nuevas; las
ya creadas con el bug quedaron con edges rotos.

## SESIÓN 23 (13/06/2026) — Logo IA en header + pick de nodo a fórmula ✅

### Logo del proveedor en el header del agente (ai-agent.js + ai-agent.css)
El `✦` fijo del header del panel se reemplazó por el SVG de marca del proveedor activo
(Claude = ráfaga terracota `#D97757`, Gemini = estrella 4 puntas `#4285F4`, OpenAI = knot blanco).
- Cada item de `PROVIDERS` lleva campo `logo` (SVG inline, `viewBox 0 0 24 24`).
- `<span id="ai-brand">` en `.ai-title`; `syncBrand()` lo rellena con el logo del proveedor actual.
  Se llama desde `syncSettingsUI()` (al iniciar y al cambiar el dropdown de provider, que persiste
  el cambio al instante) → el header siempre refleja la IA elegida.
- ⚠️ Trampa global `svg { width: 4% }`: NO alcanza con el atributo `width` del HTML (CSS gana y lo
  aplasta a ~0.6px → invisible). `.ai-brand svg { width:15px !important; height:15px }` lo fuerza.

### Click en un nodo para insertarlo en la fórmula (formula-editor.js + graph-events.js)
Con el editor de fórmula abierto, hacer click sobre cualquier nodo del grafo inserta su referencia
`{Label}[0]` en el cursor (encadenable). Hint sutil "or click a node" junto a los chips.
- `window.insertNodeIntoFormula(id)` (formula-editor): si hay editor abierto, inserta vía el
  `_pickNode` del closure (`_insertText('{'+label+'}[0]')`) y re-enfoca; devuelve `true` si consumió
  el click. `_pickNode` se asigna al abrir y se limpia (`null`) en `closeFormulaEditor`.
- `graph-events.js` (tap de nodo): antes del flujo normal, si `insertNodeIntoFormula(id)` → `true`,
  `stopPropagation` + `return` (no abre panel ni badges del nodo convocado).
- `_outside` (pointerdown captura) ya **no cierra** si el click cae dentro de `#graph` (container de
  Cytoscape): si fue nodo, el tap inserta + re-enfoca → el `blur` (setTimeout 160ms) ve el editor
  enfocado y no guarda; si fue canvas vacío, el blur guarda igual.
- **Outline (selección):** el nodo convocado queda `:selected` (feedback de qué se trajo); como la
  selección de Cytoscape es simple, se transfiere solo al próximo nodo o se limpia al clickear canvas.
  Al cerrar el editor, si `ACTIVE_NODE_ID === _nodeId` (Enter/guardar con badges desplegados),
  `closeFormulaEditor` apaga el `:selected` del convocado y re-selecciona el nodo inicial. Si se cerró
  clickeando el canvas, `ACTIVE_NODE_ID` ya quedó `null` → no re-selecciona (outline en ninguno).

## SESIÓN 22 (11/06/2026) — FILTER + RE-ARRANGE (Compact/Tree) + paneles Parent ✅

### Badge "Filter" (Settings ⚙ → VIEW, entre Links y Center)
Define los **nodos visibles** por 5 facetas: **grupo / unidad / concepto / parentesco / nombre**.
- Estado global `window.NODE_FILTER` = `{ group, unit, concept, parent, name }`, cada faceta
  `{ mode:'all'|'none'|'some', ids:Set }`. Default todas en `'all'` (no restringe).
- `window.applyNodeFilter()` (en `graph.js`): un nodo es visible si **pasa TODAS** las facetas
  (intersección). `all`→pasa todo; `none`→nada; `some`→matchea la faceta. Oculta con `display:'none'`
  (igual que `applyViewLevel`); edges visibles solo si ambos extremos lo están; chips/hubs siguen por
  `cy.style().update()`. Matching: group = `node.groups ∩ ids`; unit = `unit_id ∈ ids`; concept =
  nodo es extremo de un edge con concept ∈ ids; parent = nodo ∈ subárbol de los seleccionados; name =
  `id ∈ ids`. Se aplica **en vivo** a cada toque.
- UI en `settings-panel.js` (`makeFilterChip` + helpers): panel estilo Units (`sp-units-inner` +
  `.sp-units-scroll`) en **dos fases** — *home* con los 5 items (cada uno con círculo gris oscuro +
  nº blanco cuando filtra) y *lista* con `all`/`none` primeros + items con círculo de color del objeto
  + toggle, y pill **ok** abajo que vuelve al home. CSS nuevo `.sp-filter-*` en `settings-panel.css`.

### Re-arrange (Settings ⚙ → VIEW, chip con dropdown Compact / Tree)
Reordena el grafo. **Manual**, reversible con **undo** (mismo patrón que `dragfree`: snapshot de
posiciones → `queuePositions` → `pushUndo` restaura). `window.rearrangeGraph(mode)` en `graph.js`,
corre sobre **nodos reales visibles + edges parent** (chips/hubs/ocultos excluidos).
- **Compact** → `fcose` (force-directed, CDN nuevo en `idemodel.html`: layout-base + cose-base +
  cytoscape-fcose; registro lazy `cytoscape.use`; cae a `cose` del core si no cargó). `idealEdgeLength`
  parent 55 / resto 140, `randomize:false`, `animate:false`.
- **Tree** → **árbol radial calculado a mano** (metáfora tomate→brócoli). DFS asigna a cada hoja un
  índice angular incremental y a cada interno el **promedio de sus hijos** → cada subárbol queda en una
  **cuña contigua sin cruces**. Raíz al centro (multi-raíz: primer anillo). **Radio adaptativo**: por
  nivel, `D = 2·maxRadioNodo + 10px`; cada anillo se aleja lo necesario para que el arco entre vecinos
  ≥ D (sin colisión intra-nivel) y quede ≥ D afuera del previo (sin colisión hijo↔padre).

### Paneles Parent unificados (node-relations-ui.js)
Los dropdowns de **Parent** y **Concept Link** ahora usan el scroll estilo Units (`_relScrollDd`:
`shape-dropdown` + `.sp-units-scroll`, scrollbar fino) con filas `.sp-filter-item` (círculo de color
del nodo + nombre + toggle). Helpers `_relNodeRow` / `_relMetaRow`.

### Fix labels de nodos ocultos
`graph-labels.js` `renderNodeLabels` (corre en el loop) forzaba `display:''` ignorando el nodo. Ahora
si `node.css('display')==='none'` oculta el label y no lo recrea → sirve para Filter y View level.

### Landing copy (index.html)
Headline `Make mental models collective.` → **`Living ideas.`**; subtitle a 3 líneas (`line-height:1.2`):
*Create, analyse and share / systemic visual models / of how things work.*; beta `Welcome aboard.` →
**`Let's explore.`**.


## SESIÓN 21 (10/06/2026) — COPIAR NODO (atributos + edges + fórmulas) ✅
Feature: badge nuevo **copy** (antes de delete, solo writers) que duplica un nodo generando N copias
con nombre + número correlativo (`Ventas 1`, `Ventas 2`…). Toggle **Copy childs** duplica todo el
subárbol. Decisiones: nombres `Nombre N` (salta al próximo libre); fórmulas copiadas con
**reescritura** de auto-refs y refs internas al subárbol → a las copias (refs externas intactas);
se copia **todo** (parent → la copia queda hermana, grupos, concept links manuales + sus concepts,
y `node_parent_concepts`).

Implementación:
- `graph-dom-badges.js`: `{type:'copy'}` en `allBadges` antes de delete; oculto para reader; icono SVG
  inline (width/height explícitos por la trampa global `svg{width:4%}`, 70%); handler → `openNodeCopyPanel`.
  Cierre cruzado: cada badge llama `closeNodeCopyPanel?.()` al abrir su panel.
- `node-copy-ui.js` (**nuevo**, script no-module): panel `.node-style-panel` con chip toggle
  "Copy childs" (`sp-toggle-dot`) + chip "Copies" (input `ui-chip-alpha` + botón "go!" accent).
  Motor `runCopy(rootNode,{childs,copies})`: arma el set (BFS por `parent`, root-first), lee
  nodes/time_values de los globals (NODES_DATA/VALUES_DATA) y node_groups/links(manual)/link_concepts/
  node_parent_concepts por fetch puntual; por copia genera `idMap` (uuid nuevo), sufijo correlativo,
  reescribe fórmulas (`node:<old>`→`node:<new>` para ids del set), e inserta por tabla en orden de
  dependencia (nodes root-first → time_values → node_groups → links → link_concepts →
  node_parent_concepts). Rollback (delete .in(newIds)) si algo falla. Éxito → `removeNodeBadges` +
  `reloadCurrentModel` + `pushUndo` (delete de los nodes nuevos, cascada limpia el resto).
- `idemodel.html`: `<script>` de `node-copy-ui.js` entre los `node-*`.
- Ajustes: el botón "go!" toma la altura del "+" de groups (16px), fondo gris oscuro `#373737`, letra
  blanca. Y los handlers `pan zoom` / `grab drag position` de `graph.js` ahora cierran TODOS los
  paneles de chip de badges (style/relations/comments/copy), no solo el de style (el bottom-sheet
  Timeline queda afuera a propósito: es una tabla con la que se interactúa).

## SESIÓN 21 (10/06/2026) — PRESET DE FONDO "BLACKBOARD" ✅
En Settings ⚙ → Background image se sumó el botón **Blackboard**: setea `background_image_url` al asset
local `assets/blackboard.png` (ruta relativa), lo persiste y lo aplica al canvas con `_applyBgImage`.
El loader existente (`ui.js`) ya aplica cualquier `background_image_url` al abrir el modelo, así que no
hubo cambios extra. *Remove* ahora NO intenta borrar del bucket si el valor es un preset local (solo
borra archivos subidos por el usuario); y tras subir una imagen aparece *Remove* aunque el modelo
arrancara sin imagen. Archivos: `docs/js/ui/settings-panel.js` (`buildBgImageContent`), `docs/MANUAL.es.md`.

## SESIÓN 21 (10/06/2026) — TERCER PROVEEDOR DE IA: ChatGPT (OpenAI) ✅
Se sumó **OpenAI** como tercer proveedor del agente y de la función `AI("...")`. Como la UI se arma
desde `PROVIDERS`/`MODELS` y todo va contra `adapters[cfg.provider]`, alcanzó con: item en `PROVIDERS`
(`openai`, keyHint `sk-...`), lista en `MODELS.openai` (gpt-4o / gpt-4o-mini / gpt-4.1) y un adapter
`openai` nuevo (Chat Completions `/v1/chat/completions`, `Authorization: Bearer`, tool calling con
`tools:[{type:'function',...}]` y resultados como mensajes `role:'tool'` por `tool_call_id`). OpenAI
tiene CORS abierto → llamada directa desde el browser, sin header especial (a diferencia de Anthropic).
`pruneStaleModelSnapshots` ahora también se saltea para `openai` (caching de prefijo automático).
Sumar otro proveedor sigue siendo: otro adapter + entradas en las listas.

## SESIÓN 21 (10/06/2026) — FUNCIÓN `AI("...")` EN FÓRMULAS (estimación sellada) ✅
Feature: dentro de una fórmula se puede pedir `AI("pedido en lenguaje natural")` y la IA estima un
número. Caso de uso: valores que no se importan fácil (ej. "costo de flete Noruega→Uruguay por barco").
Decisiones de scope (con Guille): sintaxis **inline y componible** (`{Volumen}[0] * AI("...")`),
**sellado** (no función viva — se resuelve una vez y se hornea a literal, como `bakeRandom` con RND),
**sin web search** (estima de memoria), **provenance en el `comment` del nodo** (sin migración de DB).

Arquitectura clave: el motor de fórmulas es síncrono y recalcula seguido → una llamada async viva
rompería determinismo/costo/velocidad. Por eso `AI("...")` **nunca llega al storage ni al evaluador**:
se **resuelve** SOLO en el editor (`formula-editor.js`), se sustituye inline por el número y se sella
antes de guardar. `AI` se sumó a `Formula.FUNCTIONS` (`formula.js`) sólo para que **autocomplete y se
resalte** como las demás; NO se evalúa (si llegara sin sellar, el guard de `evaluate()` líneas 197-199
—que descarta todo lo no numérico tras quitar las funciones conocidas— devuelve `null`, sin crash).

Implementación:
- `ai-agent.js`: dos helpers nuevos expuestos en window, reusan los adapters BYO-key existentes SIN
  tools ni web search (payload mínimo = prompt + contexto):
  - `window.aiEstimateValue({prompt, context})` → `{value, rationale}` (un valor, período actual).
  - `window.aiEstimateSeries({prompt, periodLabels, context})` → `{values:[...], rationale}` (proyección,
    un valor por período, en UNA sola llamada).
  - Fix de paso: el adapter de Gemini ahora omite la key `tools` cuando está vacía (rechazaba `functionDeclarations:[]`).
- `formula-editor.js`:
  - `AI_RE`/`AI_HAS`, `_maskAI` (enmascara `AI("...")`→`0` para que `_validate` valide el resto sin
    marcar error y sin aportar deps de nodo; muestra hint neutro en vez de error).
  - `_save` ahora async: si hay `AI(...)`, `_resolveAiSingle` resuelve cada ocurrencia, sustituye el
    número (negativos entre paréntesis para componer) y agrega provenance al comment; recién ahí
    tokenize/serialize/guarda. Estado "Estimating…" con `_busy=true` (bloquea editor + auto-cierre).
  - `_spreadAllTimes`/`_spreadFromNow`: si hay `AI(...)`, en vez de copiar la misma fórmula llaman
    `_confirmAiSpread` → `_spreadAiSeries` (pide serie a la IA con las fechas de cada período, espejando
    `node-timeline-ui.js _dateLabel`, y escribe período por período vía `saveFormulaForPeriod`).
  - `AI` es función de primera clase: aparece en el autocomplete (escribís `ai`) y se resalta verde;
    al elegirla inserta `AI("")` con el caret entre comillas (`_insertAiCall`). Sin pill dedicado.
  - Provenance: `_aiProvenanceSingle`/`_aiProvenanceSeries` → bloque marcado en `node.data('comment')` +
    `queueNodeData(_nodeId,'comment',...)`. Se ve con el badge de comments.
- Costo: usa la API key del usuario; 1 llamada por `AI("...")` (single) o por ocurrencia (serie). Una
  vez sellado, el recompute NO vuelve a llamar (no recurrente).
- Pendientes/posibles v2: web search opcional (Claude web_search / Gemini grounding), campo jsonb propio
  para provenance con UI dedicada, re-estimar con un botón.

## SESIÓN 21 (10/06/2026) — DIMMING: "el resto del modelo a una fracción de su opacidad definida" ✅
Feature: cuando hay un elemento activo, el resto del modelo se atenúa a **`window.DIM_FACTOR` × su opacidad
definida** (no a un valor fijo). El factor está centralizado en `graph.js` (`window.DIM_FACTOR = 0.25`,
arrancó en 0.5 y se bajó a 0.25 a pedido para que el salto se note más; un solo número para ajustar).
Tres disparadores:
1. **Nodo seleccionado** para editar → full: ese nodo + sus links + chips/hubs de esos links. Resto atenuado.
2. **Filtro de concepto** (tap en un chip de un edge) → full: edges con ese concepto + sus nodos + chips/hubs. Resto atenuado. (Antes dimeaba a 0.1 vía clase `dimmed`, ya eliminada.)
3. **Highlight de grupo** (chip Groups del panel relations) → full: nodos del grupo + links entre dos nodos del grupo. Resto atenuado.

Implementación (motor único en `graph.js`):
- `window.refreshDimming()` — única fuente de verdad. Lee el estado global y aplica con prioridad **concepto > grupo > nodo > nada**. Cada disparador sólo actualiza su global (`ACTIVE_CONCEPT` módulo-local, `window.HIGHLIGHTED_GROUP_ID`, `window.ACTIVE_NODE_ID`) y llama `refreshDimming()`.
- `_applyDimming(nodeSet, edgeSet)` / `_clearDimming()` — togglean la clase `dim`. Chips/hubs siguen a su `parentEdge`.
- Reglas de estilo `.dim` (Cytoscape): `node.dim` → `background-opacity = alpha*DIM_FACTOR` (hidden queda en 0); `edge.dim` → `opacity *DIM_FACTOR`; `node[isChip].dim, node[isConceptHub].dim` → `opacity *DIM_FACTOR` vía `_dimChipOpacity`.
- Labels HTML (`graph-labels.js` `renderNodeLabels`): si `node.hasClass('dim')` → `el.style.opacity *= window.DIM_FACTOR`.
- Disparadores: `graph-events.js` (tap nodo + tap canvas), `node-relations-ui.js` (click chip grupo + `_clearGroupHighlights`), `toggleConceptFilter`/`clearConceptFilter` (`graph.js`), `createNewNode`.
- `window.DIM_ACTIVE` indica si hay atenuación activa.

## SESIÓN 20 (09/06/2026) — FIX HUBS/CHIPS FLOTANTES CON VIEW LEVEL ✅
Bug: al bajar el "parent level" (slider que oculta niveles del grafo), los círculos (concept hubs) y chips de conceptos de los nodos ocultados quedaban flotando.
Causa: `applyViewLevel` (`graph.js`) oculta nodos/edges reales con `css('display','none')` pero NO toca hubs/chips (nodos `isConceptHub`/`isChip`), y sus mappers de `display` solo chequeaban el atributo `hidden` y los toggles `SHOW_*_LINKS` — nada del view level. Además `applyViewLevel` no disparaba `cy.style().update()`, así que esos mappers ni se reevaluaban.
Fix (3 puntos, todo en `graph.js`):
- Mapper `display` del chip (~l.236) y del hub (~l.296): `if (pEdge.source().css('display')==='none' || pEdge.target().css('display')==='none') return 'none';` → si el nodo del edge está oculto por nivel, su chip/hub se oculta.
- `applyViewLevel`: `cy.style().update()` al final para reevaluar esos mappers.
- Funciona en ambos sentidos y para los 3 tipos de edge (parent/formula/manual). Al subir el nivel, `applyViewLevel` re-corre, los nodos vuelven a `display:'element'` y hubs/chips reaparecen con su lógica normal.

## SESIÓN 20 (09/06/2026) — FIX CACHÉ DEL AGENTE IA (poda vs prompt caching) ✅
Diagnóstico sobre logs de Haiku (`[ai cache] read=… write=…`): los `read=0` intermitentes venían de `pruneStaleModelSnapshots()`. El caché es prefix-match → al stubear un `get_model` viejo (río arriba), cambian bytes del prefijo e invalida la caché de TODO lo posterior → reescritura completa a 1,25×. La tensión "menor" anotada en sesión 19 resultó ser la causa real de los misses entre turnos (cada 2º `get_model` disparaba la poda).
- **Fix:** `pruneStaleModelSnapshots()` ahora hace `if (cfg.provider === 'claude') return;`. Con caché activo re-mandar el snapshot viejo cuesta ~0,1× (read) — más barato que reescribir la cola. El prefijo del turno anterior queda intacto y se lee entero. Gemini sin tocar (mismo beneficio por caching implícito, pero fuera del alcance de este fix).
- **Observaciones del diagnóstico (sin acción):** (1) `tools+system` ≈ 3,8k tokens < **4096 = mínimo cacheable de Haiku 4.5** → el breakpoint de `system` NO cachea en Haiku (sí en Sonnet, piso 2048); en Haiku todo el caché recae en el breakpoint de messages. (2) El caché es scoped por modelo → cambiar de modelo a mitad de sesión = miss total. (3) Ventana de lookback de 20 bloques: irrelevante acá porque el loop agrega ~2 bloques/iteración.
- Pendiente (de sesión 19, sigue): contador de tokens/costo en UI (ya se loguea `data.usage`); streaming.

## SESIÓN 19 (08/06/2026) — TOKENS DEL AGENTE IA + ARRANQUE POR ÚLTIMO MODELO ✅
Dos temas independientes.

### A. Optimización de tokens del agente IA (`ai-agent.js` + `settings-panel.js`)
Diagnóstico: la API es stateless → el loop re-manda `system` + `tools` + todo el `convo` en CADA vuelta. En un pedido de ~12 iteraciones, los ~4-5k tokens fijos (system + 15 tools + el resultado de `get_model` con su `_spec` estático) se re-facturaban íntegros cada vez. Cero caché. Cuatro cambios:
1. **Prompt caching (solo adapter `claude`):** `system` ahora va como `[{type:'text', text, cache_control:{type:'ephemeral'}}]` → cachea **tools+system** (orden de render tools→system→messages, el breakpoint en system cubre lo de antes). Además se marca `cache_control` en el **último content block de `messages`** → cachea el prefijo de conversación (append-only). Desde la 2ª iteración el grueso del input se lee de caché (~0,1×). Log dev en consola: `[ai cache] read=… write=… input=… out=…` (lee `data.usage`). **Gemini no se tocó:** 2.5 hace caching implícito automático con prefijo estable primero.
2. **`_spec` movido al system prompt:** `get_model` ya NO embebe el `_spec` (eran ~1.5k tokens estáticos re-mandados cada vuelta). La doc del data model + lenguaje de fórmulas vive ahora como texto en la constante `SYSTEM` de `ai-agent.js` (zona cacheada, se paga una vez). Descripción de la tool `get_model` actualizada para no mentir.
3. **Payload reducido de `get_model`:** `window.buildModelExport(opts)` acepta `{forAgent:true}` → omite `_spec`, `exportedAt`, y por nodo `x/y/alpha/size_px`. **Export-a-archivo intacto:** sin args = full (con `_spec` y coords, necesarias para preservar layout al importar). El agente llama `buildModelExport({forAgent:true})`.
4. **Dedupe de snapshots:** `pruneStaleModelSnapshots()` en el loop — si hay >1 `get_model` en el historial, los anteriores se reemplazan por un stub; solo el más reciente viaja completo.
- ⚠️ El `_spec` (objeto) y el bloque DATA MODEL/FORMULA LANGUAGE del `SYSTEM` describen lo mismo pero son consumidores distintos (JSON para export/import vs prosa para el LLM). Si cambia el lenguaje de fórmulas, tocar **ambos**.
- ⚠️ Tensión menor caching↔dedupe: stubear un snapshot viejo cambia bytes en medio del prefijo → invalida la caché de ese request. Solo pasa con 2+ `get_model` (raro); aceptable. **[Superado en sesión 20: no era "menor" — era la causa de los `read=0` entre turnos. La poda se desactivó para claude.]**
- Pendiente: contador de tokens/costo en el panel (ahora que `data.usage` se loguea, es fácil exponerlo en UI); streaming.
- **UX/seguridad (mismo ai-agent.js):** botón **"Clear key"** en el ⚙ (junto a Save) → borra del navegador la key del **proveedor actual** (`cfg.key=''` → removeItem) + limpia el chat (`convo=[]`, `msgsEl`); no revoca en el proveedor, es para compus compartidas. El **greet sin key** ahora destaca (innerHTML + `<strong>` ámbar `.ai-bubble strong`) que **la cuenta necesita créditos API** (pay-as-you-go; la suscripción de claude.ai NO cuenta; Gemini tiene free tier). Recordatorio del modelo BYO: la key vive SOLO en `localStorage`, atada al **navegador** (no a la cuenta ni al modelo); otros usuarios de un modelo compartido NO gastan tus tokens (ponen la suya). `localStorage` sin cifrar → quien use tu navegador puede leerla/usarla.

### B. Arranque por último modelo abierto (`api.js`)
Bug: al abrir la app (sin `?m=`) entraba a un modelo "aleatorio". Causa: el query de selección hacía `.from('model_users').select('model_id').eq('user_id',…).limit(1)` **sin `ORDER BY`** → orden indefinido de Postgres (cambia por updates/vacuum). Fix:
- Nueva columna **`model_users.last_opened_at timestamptz`** (fuente de verdad del "último abierto").
- Selección ahora ordena `.order('last_opened_at', {ascending:false, nullsFirst:false}).limit(1)` → entra al último abierto; nunca-abiertos al final.
- El update fire-and-forget que marcaba `viewed:true` ahora también sella `last_opened_at: new Date().toISOString()` (cada apertura, incluida vía `?m=`, lo actualiza).
- **SQL aplicado en producción** (correr una vez):
  ```sql
  ALTER TABLE model_users ADD COLUMN IF NOT EXISTS last_opened_at timestamptz;
  UPDATE model_users mu SET last_opened_at = m.last_review::timestamptz
  FROM models m WHERE m.id = mu.model_id AND mu.last_opened_at IS NULL;
  ```
  (backfill desde `last_review` para que el primer arranque post-deploy ya tenga orden razonable). No requiere GRANT/RLS extra: el UPDATE de `viewed` sobre la propia fila ya estaba concedido.

## SESIÓN 18 (07/06/2026) — AGENTE DE IA EMBEBIDO (BYO KEY) + HELP UN-PILL ✅
Objetivo: que el usuario opere TODA la herramienta con SU propia IA y SUS tokens, desde dentro de la app. No "un chat más": construye modelos *vivos* (units con size-by-value, jerarquía, grupos/zonas, fórmulas multi-período, concepts/links, layout espacial).

- **Arquitectura (client-side, sin backend):** la IA corre en el browser llamando a la API del proveedor con la key del usuario. Historial en **formato neutral** (`{role:'user'|'assistant'|'tool', ...}`) que cada **adapter** traduce → el loop agéntico, las tools y la UI son **agnósticos del proveedor**. Sumar un proveedor = otro adapter (~funciones `send`).
  - **Adapters:** `claude` (Anthropic Messages API, header `anthropic-dangerous-direct-browser-access:true`) y `gemini` (Google `generativelanguage.../:generateContent`, header `x-goog-api-key`, `systemInstruction`/`contents`/`functionDeclarations`, roles `user`/`model`, `functionResponse`).
  - **Key BYO:** vive SOLO en `localStorage`, **una por proveedor** (`idemodel_ai_key_<provider>`), idem modelo (`idemodel_ai_model_<provider>`). Nunca toca Supabase. Claude: console.anthropic.com (`sk-ant-`). Gemini: aistudio.google.com (free tier en Flash; key suele empezar `AIza`, también vistas `AQ...`).
  - **Resiliencia:** `_fetchRetry` reintenta 503/429/529/5xx con backoff (Gemini Flash se satura seguido).
- **Tool surface completa** (todas con `pushUndo` y guard de `USER_ROLE==='reader'`):
  - `get_model` → `window.buildModelExport()` (refactor de `_exportJSON`: ahora hay builder puro reusado por export-a-archivo y por el read-tool; devuelve el contrato `idemodel.model.v1` con su `_spec`).
  - `set_model_settings` → `periods`/`time_unit`/`starting_date`/`name` vía `window.saveModelField` (expuesto desde settings-panel). **CLAVE:** fórmulas escritas más allá de `model.periods` se guardan pero NO se muestran; hay que subir `periods` (el modelo multi-período fallaba por esto).
  - `create_unit` / `update_unit` (incl. `number_format` accounting, size-by-value `min/max_value`→`min/max_sz`).
  - `create_node` (con `unit` + `size_type:'by unit'`), `update_node` (rename/recolor/reshape/re-parent/unit/hide), `delete_node` (limpia time_values/node_groups/links; hijos quedan sueltos).
  - `set_formula` (display `{Label}[offset]` → stored vía `Formula.tokenize/serialize`).
  - `create_group` / `assign_to_group`.
  - `create_concept` (usa `window.createConcept`) / `link_nodes` (link `type:'manual'` + `link_concepts`) / `tag_parent_edge` (`node_parent_concepts`).
  - `arrange_layout` — posiciona TODO en **zonas** (por grupo o por raíz de jerarquía) con **jitter orgánico**; persiste `nodes.x/y`. Llamar al final.
- **Persistencia/refresh:** las tools escriben directo a Supabase + sincronizan globals (`NODES_DATA`/`UNITS_DATA`/`GROUPS_DATA`/`CONCEPTS_DATA`); al terminar un run con escrituras, `window.reloadCurrentModel()` (= `loadData(__USER_ID)`, ambos expuestos en `api.js`) re-renderiza.
- **UX:** botón circular **"AI" verde agua** (fixed, sobre el `(+)`), panel de chat dark (`#ai-panel`). Confirmación por acción con **Approve / Approve all (resto del pedido) / Reject**, o modo **Auto-apply** (⚙). Excluido del export PDF (onclone). Archivos: `docs/js/ui/ai-agent.js` + `docs/css/ai-agent.css`, cargado en `idemodel.html` tras `help-panel.js`.
- **Costos (key del usuario):** el snapshot se reenvía en cada vuelta del loop → es el driver. Por interacción: centavos (Haiku/Flash) a ~US$0.1–0.4 (Opus/modelos grandes). **Prompt caching + payload reducido → hechos en sesión 19** (Anthropic; bajan fuerte el input facturado). Pendiente aún: `get_node` parcial.
- **Pendientes del agente:** contador de tokens/costo en panel; streaming; `arrange_layout` por concepto; quizás tools de versión/share.

- **Help como UN SOLO pill** (sesión, cambios chicos): `#help-ui` es un único pill gris (`#cac9c9`, lenguaje de `.ui-chip`/"Version"); "Help!" es el label verde y al abrir despliega adentro dos sub-chips gris oscuro `#373737` (`Go to user manual`, `Search`). Input de About a ancho mínimo que crece con el contenido (autosize JS). Placeholder/labels y mensajes de resultados en inglés. Help excluido del PDF.

## SESIÓN 17 (07/06/2026) — CONCEPT HUBS + FILTROS + FROM NOW + FRND + HELP ✅
- **Concept hubs rediseñados** (graph.js): el `+` gris solo en el edge seleccionado (`_isHubActive`); hubs pasivos = punto de color (modo `all`) o color del edge + número en negro (`none`/`active`, oculto si 0). Helper `_hubEdgeColor`. (Ver sección de concepts más abajo.)
- **Apagado de filtros**: filtro por concept se apaga con re-click del chip o click en canvas (`clearConceptFilter` + `cy.style().update()`). Highlight de grupo se apaga al click en cualquier cosa (canvas/nodo/edge) vía `window.clearGroupHighlights` (graph-events.js).
- **Chip "From now"** en el editor de fórmulas (`_spreadFromNow`, formula-editor.js): replica la fórmula desde el período activo hasta el último.
- **FRND(a,b)**: random vivo (no sellado), se re-tira en cada recompute. (Ver sección RND/FRND.)
- **Landing**: "Welcome aboard." + botón "try!".
- **Sistema Help** (nuevo): chip "Help!" arriba-centro en la app.
  - `docs/js/ui/help-panel.js` + `docs/css/help.css`: al abrir despliega "Go to user manual" (→ `manual.html` en pestaña nueva) y "About?" (input). About busca en `MANUAL.<lang>.md` (parseo por headings, scoring título×5 + body), muestra resultados en overlay flotante con deep link `manual.html#<slug>`.
  - `docs/manual.html` + `docs/js/help-manual.js`: render del manual con `marked` (CDN), índice (TOC h2/h3) navegable, scroll-spy, filtro. Estética dark del app.
  - **Manual movido**: `MANUAL.md` (raíz) → **`docs/MANUAL.es.md`** (para ser servido por Pages y leído en runtime). Hook de SessionStart (`.claude/settings.json`) y refs de `CLAUDE.md` actualizados. `lang` = `localStorage 'idemodel_help_lang'`/`?lang=`, default `es`. **Bilingüe pendiente**: sumar `docs/MANUAL.en.md` + toggle (el fetch ya es `MANUAL.<lang>.md`).
  - ⚠️ El `slugify` está duplicado idéntico en `help-panel.js` y `help-manual.js` — si se toca uno, tocar el otro (los deep links dependen de que coincidan).

## SESIÓN 16 (06/06/2026) — EXPORT/IMPORT JSON (IA) + PDF MULTIPÁGINA + REFS CON LLAVES ✅
- **Export PDF multipágina** (`_exportPDF(from,to)` en `settings-panel.js`): una página por período, con selector de rango (PDF chip → form From/To → Export). Cada página hace `cy.fit()` (encuadra todo el modelo centrado), muestra el círculo de período + badge de totales, y un **caption** con la fecha del momento. Apaga `settings-btn`/`add-node-btn`. Restaura período + zoom/pan al terminar.
- **Export JSON para IA** (reemplaza CSV): contrato **`idemodel.model.v1`**. Nuevo `window.fetchModelSnapshot(modelId)` en `api.js` (trae todas las tablas frescas, sin tocar el estado de la app). El JSON usa **claves legibles** (nodos por `label`, units/groups/concepts/links por id local `u_`/`g_`/`c_`/`l_`), `time_values` **solo fórmulas** en forma legible `{Label}[offset]`, y una **`_spec`** que es leyenda + guía de autoría (sintaxis, offsets, funciones, howToAuthor). Ojo: columnas reales `concepts.label` (no name), `links.source_id/target_id/type`.
- **Import JSON** (`_openImportPicker`/`_importModelFromJSON` en `settings-panel.js`, chip Import en panel logo): levanta un `idemodel.model.v1` y crea un **MODELO NUEVO**. Genera uuids frescos para todo, arma mapas `label→uuid` y `idLocal→uuid`, resuelve todas las referencias (parent, unit, groups, concepts, links) y **serializa las fórmulas** `{Label}[off]` → `node:<uuid>[off]` con `Formula.tokenize/serialize`. Inserta en orden de FK con `model_users` owner **primero** (RLS); aborta + alert con la tabla exacta si algo falla. Navega al modelo nuevo. Cierra el **round-trip completo**: modelar → exportar → IA evoluciona/crea desde cero → reimportar (validado con modelo PHEV generado por IA: 17 nodos, 10 años, 3 niveles, 7 grupos, 14 conceptos, 6 edges manuales con impacto +/−).
- ⚠️ **Bug viejo detectado (no corregido):** `handleNewVersion` copia links usando `l.source`/`l.target` pero las columnas reales son `source_id`/`target_id` → nunca copia links en "new version".
- **Referencias de fórmula con llaves `{Label}[offset]`** (fix de raíz de ambigüedad de prefijos/espacios, ej. `Direct` vs `Direct unit.`): `formula.js` `tokenize` parsea `{...}[off]` exacto (+ fallback legacy de label pelada); `toDisplay`/`fromStorage` emiten con llaves; `formula-editor.js` las pinta **tenues** (gris 0.22) + autocomplete inserta `{Label}[`. Storage sin cambios (`node:<uuid>[offset]`). Coherente en editor + timeline + export.
- **Sync de `NODES_DATA`** (fix "necesita F5"): `queueNodeData` (`api.js`) actualiza `NODES_DATA` con cada campo persistido; `createNewNode`/`removeNode` (`graph.js`) agregan/quitan el nodo. Listas (parent selector, timeline, autocomplete) reflejan cambios al instante.

## SESIÓN 15 (06/06/2026) — FIX BORRADO DE MODELOS + DUMP DE ESQUEMA ✅
- **Bug:** borrar un modelo (panel Open) lo sacaba de la vista pero no persistía (volvía con F5). Causas combinadas, ambas resueltas:
  1. **RLS/GRANT faltante en `model_users`**: el DELETE directo daba `permission denied for table model_users`. SQL aplicado: `GRANT DELETE ON model_users TO authenticated` + policy `"delete model_users"` (owner borra cualquier membresía, o el propio usuario se sale).
  2. **Orden de borrado**: el código borraba `model_users` ANTES que `models`, pero la policy de DELETE de `models` exige que la membresía owner siga existiendo → 0 filas. **Fix en `settings-panel.js`**: ahora borra `models` primero y `model_users` después; el FK `model_users_model_id_fkey` se cambió a `ON DELETE CASCADE` (SQL aplicado) para limpiar membresías.
- **`_hardDeleteModel` robustecido**: captura errores de cada DELETE y **aborta + alert** si alguno falla (antes ignoraba errores → fingía que borró). Verifica que `models` borre ≥1 fila. Agregados los borrados que faltaban: `node_groups` y `node_parent_concepts`.
- **Modal de confirmación**: ahora muestra el nombre del modelo → "Permanently delete "X" and all its data? This cannot be undone."
- **Nuevo `docs/db_schema.sql`** = dump del esquema (`pg_dump --schema-only` del schema `public`, vía session pooler). 12 tablas, 75 policies, 3 funciones, 27 grants, 50 constraints. **Sin datos ni credenciales.** Fuente de verdad reproducible del esquema para eventual migración. Regenerar con `pg_dump` cuando cambie el esquema.
- **Credenciales**: password de la BASE guardada SOLO en `C:\Users\GUILLE\idemodel-credentials.txt` (fuera del repo). La app usa la *anon key*, no esta password. `_conn.txt` (temporal con credenciales) agregado al `.gitignore`.

## SESIÓN 14 (06/06/2026) — INFRA DE DOCUMENTACIÓN ✅
- **Nuevo `CLAUDE.md` en la raíz** = punto de entrada (arquitectura + mapa de archivos + protocolo de arranque). Se autocarga como memoria del proyecto.
- **`docs/CLAUDE.md` → renombrado a `docs/STATE_NOW.md`** (este archivo). Dejó de competir como CLAUDE.md; ahora es el #2 de los tres docs a leer al iniciar.
- **Limpieza de archivos muertos:** eliminados `docs/js/engine/` (analysis/evaluation/formulas/state.js) y `docs/js/persistence/` (api/auth.js) — eran placeholders **vacíos** (0 bytes) de la arquitectura V2 nunca usada. Nadie los importaba.
- **Hook `SessionStart`** en `.claude/settings.json` (versionado): inyecta `docs/STATE_NOW.md` + `docs/MANUAL.es.md` en contexto al arrancar cada sesión (CLAUDE.md no, ya se autocarga). Toma efecto a partir de la sesión siguiente a su creación.

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
| text_only | boolean | si true, el label solo muestra title centrado (sin value ni unit) — sesión 12 |
| hide_when | text | condición booleana de visibilidad por período — sesión 26 |
| text_auto | boolean | tamaño de texto del label: true = auto (escala con size_px), false = manual — sesión 28 |
| text_label | real | px del title cuando text_auto=false (null = base) — sesión 28 |
| text_value | real | px del value cuando text_auto=false — sesión 28 |
| text_unit | real | px del unit cuando text_auto=false — sesión 28 |

⚠️ El campo viejo era `size` — ya no existe en la tabla. Ahora es `size_px`.
⚠️ SQL aplicado: `ALTER TABLE nodes ADD COLUMN IF NOT EXISTS comment text;`
⚠️ SQL aplicado: `ALTER TABLE nodes ADD COLUMN IF NOT EXISTS text_only boolean DEFAULT false;`
⚠️ SQL aplicado (sesión 28): `ALTER TABLE public.nodes ADD COLUMN IF NOT EXISTS text_auto boolean DEFAULT true, ADD COLUMN IF NOT EXISTS text_label real, ADD COLUMN IF NOT EXISTS text_value real, ADD COLUMN IF NOT EXISTS text_unit real;`

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
| custom_shapes | jsonb | biblioteca de shapes-polígono del usuario: `[{ id, name, points }]` (sesión 30) |

⚠️ Columnas agregadas manualmente:
```sql
ALTER TABLE models ADD COLUMN IF NOT EXISTS last_review date;
ALTER TABLE models ADD COLUMN IF NOT EXISTS last_user uuid REFERENCES users(id);
ALTER TABLE models ADD COLUMN IF NOT EXISTS workspace jsonb;
ALTER TABLE models ADD COLUMN IF NOT EXISTS custom_shapes jsonb DEFAULT '[]'::jsonb;
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
| number_format | text | formato de presentación: `plain`/`integer`/`decimal2`/`accounting`/`percent` — sesión 13 |

⚠️ SQL aplicado: `ALTER TABLE units ADD COLUMN IF NOT EXISTS number_format text DEFAULT 'plain';`

⚠️ RLS de UPDATE en `units` faltaba (editar cualquier campo de unidad no persistía, sin error). SQL necesario:
```sql
GRANT UPDATE ON units TO authenticated;
CREATE POLICY "users can update units" ON units FOR UPDATE
  USING (EXISTS (SELECT 1 FROM model_users WHERE model_id = units.model_id AND user_id = auth.uid()));
```

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

- `window.queueValueData(nodeId, formulaText)` en `api.js`:
  - Guarda `formula` (texto) en DB — **nunca persiste `value`**
  - Calcula `value = evalFormula(formula)` localmente y lo setea en `VALUES_DATA`
  - Si existe row → UPDATE `{ formula }`. Si no → INSERT `{ formula }`
- En `graph-labels.js` `closeEditor`: cuando `field === 'value'` abre `openFormulaEditor` en lugar del input estándar
- En `ui.js handleData`: `VALUES_DATA` se asigna ANTES de evaluar fórmulas (para que referencias entre nodos resuelvan correctamente)

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
- **Borrar**: ✕ abre modal "Permanently delete \"X\"…?" → `_hardDeleteModel(modelId)` hace cascade delete completo (aborta + alert si algún DELETE falla)

### Cascade delete (`_hardDeleteModel`)
Secuencia (cada paso aborta con error si falla; verifica que `models` borre ≥1 fila):
1. Obtiene node IDs y link IDs.
2. `link_concepts` → `node_groups` → `node_parent_concepts` → `links` → `time_values` → `nodes` → `units` → `groups` → `concepts`
3. `models` (ANTES que `model_users`: la policy de DELETE de `models` exige que la membresía owner siga viva).
4. `model_users` (limpieza; el FK `model_users_model_id_fkey ON DELETE CASCADE` ya las borra al eliminar el modelo).

⚠️ RLS aplicada (sesión 15): `GRANT DELETE ON model_users` + policy `"delete model_users"`; FK `model_users_model_id_fkey` con `ON DELETE CASCADE`.

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
- Click en pill → highlight (outline color del grupo) de todos los nodos del modelo en ese grupo vía Cytoscape style bypass (`n.style({border-*})`). Toggle: re-click en el mismo pill apaga.
- **Limpieza del highlight (sesión 17):** `_clearGroupHighlights()` está expuesto como `window.clearGroupHighlights` y se llama desde `graph-events.js` en el tap de **canvas, nodo y edge** → "click en cualquier cosa" apaga el outline y el nodo seleccionado vuelve a su borde gris (`node:selected`). `removeStyle` de `border-width/color/opacity/style` (los 4) revierte el bypass.
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
- `coords` → x/y editables
- `text_only` → toggle. Si ON: el label oculta value-slot y unit-slot, centra el title verticalmente

### Text only ✅ (sesión 12)
Persiste en `nodes.text_only`. Aplicado en `graph-labels.js renderNodeLabels` (carga + F5) y en el toggle del panel via `_applyTextOnly(on)` que manipula el DOM del label directamente (`#node-label-layer [data-id]`) — `renderNodeLabels` es módulo, no accesible desde el script regular. Con undo.

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

Campo `last_opened_at` en `model_users` (timestamptz, sesión 19) — sella cada apertura; el arranque
sin `?m=` ordena por él (último abierto). Se setea junto con `viewed:true` en el update fire-and-forget
de `loadData` (`api.js`). SQL en sesión 19 (con backfill desde `models.last_review`).

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
| `formula.js` | **Activo** | Engine de fórmulas: tokenizer, serializer, evaluador, validador. |
| `ui/formula-editor.js` | **Activo** | Editor contenteditable con syntax highlighting + autocomplete. |
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

**Apariencia del hub** (sesión 17 — rediseño para bajar tensión visual). El hub tiene dos estados, gobernados por `_isHubActive(edgeId)` y `_hubEdgeColor(pEdge)` (ambos en `graph.js`):
- **ACTIVO** (edge seleccionado): círculo gris `#272727`, 9×9px, label `+`, texto blanco, chips desplegados. Es ACTIVO cuando `window.ACTIVE_EDGE.id() === edgeId` (tap directo, cualquier modo) **o** en modo `active` cuando `ACTIVE_CONCEPT_EDGES.has(edgeId)` (edges del nodo seleccionado).
- **PASIVO**: depende del modo (ver tabla). El `+` ya **no** aparece en hubs no seleccionados → evita la tensión visual de tener todos los `+` a la vez.

`_hubEdgeColor`: color del edge según tipo — parent `#a2c1cf`, manual `#f7acac`, formula/default `getEdgeColor()` (`--edge-color`).

| Modo | Hub PASIVO | label | tamaño |
|---|---|---|---|
| `none` | color del edge + número en negro; oculto si count=0 | count | 9×9 |
| `active` | igual que `none` (oculto si count=0) | count | 9×9 |
| `all` | punto del color del edge, **sin** número ni `+` | `''` | 3×3 (30%) |

**Hub display/style logic** (todas funciones; `cy.style().update()` recomputa al cambiar `ACTIVE_EDGE`/modo):
```javascript
'display': (ele) => {
  // ...guards de hidden/SHOW_*_LINKS primero...
  if (_isHubActive(edgeId)) return 'element';            // edge seleccionado: siempre
  if (window.CONCEPTS_MODE === 'all') return 'element';  // punto de color en todos
  return count > 0 ? 'element' : 'none';                 // none/active: solo si hay concepts
}
'label':  (ele) => _isHubActive(edgeId) ? '+' : (mode==='all' ? '' : String(count||''))
'width'/'height': (ele) => _isHubActive(edgeId) ? 9 : (mode==='all' ? 3 : 9)
'background-color': (ele) => _isHubActive(edgeId) ? '#272727' : _hubEdgeColor(pEdge)
'color': (ele) => _isHubActive(edgeId) ? '#ffffff' : '#000000'
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
- Atenúa el resto al 50% de su opacidad vía `refreshDimming()` (ver sesión 21; antes era clase `dimmed` a 0.1, eliminada)
- Tap de nuevo en el mismo chip → `clearConceptFilter()` (limpia clases + `cy.style().update()` para repintar)
- **Click en canvas vacío también limpia el filtro**: el handler de canvas tap en `graph-events.js` llama `window.clearConceptFilter()` (expuesto desde `graph.js`). Sin esto, edges/outlines quedaban destacados al deseleccionar.

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

### Celdas — editor de fórmulas ✅ (sesión 12)
Celdas son `td` clickeables (input readonly). Click → `openFormulaEditor` flotante cerca de la celda.
En blur: guarda fórmula vía `_saveFormula`, actualiza display.

### Toggle values/formulas ✅ (sesión 11)
- `values`: muestra número evaluado
- `formulas`: muestra `Formula.toDisplay(formula, nodes)` — texto legible con labels de nodos

### Export ✅ (sesión 12)
Pill **EXPORT** en la toolbar (junto a FILTER). Dropdown con:
- **CSV**: exporta nodos visibles (filtro aplicado), valores o fórmulas según toggle, con headers de fecha
- **PDF**: tabla limpia con `<div>` (no inputs — html2canvas los rompe). Header con logo SVG inlineado + "idemodel" + nombre de modelo + metadata (author, periods, unit, last review, fecha de export)

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

## MUNDO FÓRMULAS — FASE 2 ✅ (sesión 12)

### formula.js — Engine

```javascript
window.Formula.tokenize(text, nodes)   // display text → tokens
window.Formula.serialize(tokens)       // tokens → storage string
window.Formula.toDisplay(stored, nodes) // storage → display text
window.Formula.fromStorage(stored, nodes) // storage → tokens (para editor)
window.Formula.evaluate(stored, nodeId, period) // storage → number | null
window.Formula.validate(stored, nodeId) // → array de errores
window.Formula.FUNCTIONS               // array de nombres de funciones
```

**Storage format:** `node:uuid[offset]` — ej: `node:a3f2[0] - node:b8c1[-1]`

**Evaluador:** reemplaza refs por valores numéricos → ejecuta con `Function()` en contexto con las funciones definidas.

**Funciones implementadas:** `SUM`, `AVG`, `MIN`, `MAX`, `ABS`, `ROUND`, `RND`, `FRND`, `IF`, `AND`, `OR`, `NOT`

**Backward compat:** si la fórmula no contiene `node:` ni letras de función → `parseFloat`.

**Seguridad:** después de sustituir refs y quitar nombres de función, verifica que solo quedan caracteres aritméticos. Si hay letras no reconocidas → retorna null.

### formula-editor.js — Editor

```javascript
window.openFormulaEditor({ x, y, nodeId, period, storedFormula, onSave, onCancel })
window.closeFormulaEditor()
```

**Implementación:** `div[contenteditable]` — sin overlay, una sola capa. Guarda offset de cursor antes de re-renderizar HTML, lo restaura después.

**Syntax highlighting:**
- Nodos = `#7eb8ff` (azul)
- Números = `rgba(255,255,255,0.92)` (blanco)
- Operadores = `rgba(255,255,255,0.42)` (gris)
- Funciones = `#98d98e` (verde)
- Texto desconocido = `#ff8080` (rojo)

**Autocomplete:**
- Al tipear letras → sugiere nodos (azul) y funciones (verde)
- Al tipear `[` → sugiere offsets: `0 Actual`, `-1 Anterior`, `-2 Dos períodos atrás`, `+1 Próximo`
- Tab o click en item → inserta. Para nodos inserta `Nodo[0]` con cursor al final.
- Enter → guarda. Escape → cancela.

**Integración:**
- `graph-labels.js`: intercepta `field === 'value'` en `openFieldEditor` y usa `openFormulaEditor`
- `node-timeline-ui.js`: celdas son `td` clickeables que abren `openFormulaEditor` flotante
- `ui.js evalFormula`: delega a `Formula.evaluate(formula, nodeId, period)`

### Detección de ciclos + preview en vivo ✅ (sesión 13)
- `Formula.recomputeAll(valuesMap, maxPeriod)` recalcula período a período ascendente, con **orden topológico DFS** sobre refs `[0]` dentro de cada período. Detecta ciclos y los devuelve en `{ cycles: Set<nodeId> }`.
- `ui.js`: `window.recomputeFormulas()` y el loop de carga llaman `recomputeAll`, guardan `window.FORMULA_CYCLES` y llaman `window.markFormulaCycles()`.
- `Formula.hasCycle(nodeId, period, overrideFormula)` y `Formula.cyclePath(...)` → la 2ª devuelve el **Set de nodos del ciclo** propuesto (no solo bool). `validate()` bloquea el guardado de fórmulas que crean ciclo.
- **Borde rojo:** `graph.js markFormulaCycles` pinta `node[?formula_cycle]` (borde 2.5px). Considera la unión de `FORMULA_CYCLES` (persistido) + `window.FORMULA_CYCLE_PREVIEW` (transitorio).
- **Preview al editar:** `formula-editor.js _validate` setea `FORMULA_CYCLE_PREVIEW = cyclePath(...)` y llama `markFormulaCycles` → los nodos del ciclo se marcan en rojo **aunque la fórmula no se guarde**. `closeFormulaEditor` limpia el preview.
- En el label, nodo en ciclo muestra `⚠` en vez del valor (graph-labels.js).

### Formula edges derivados ✅ (sesión 12)
Los edges `type:'formula'` se derivan de las fórmulas — **no se persisten**. Un nodo cuya fórmula menciona a otro nodo genera un edge con flecha entrante (`referenced → formula_node`).

- **ID:** `formula_${sourceId}_${targetId}` — único por par (source, target)
- **Build al cargar** (`ui.js handleData`): escanea `VALUES_DATA` con `/node:([a-f0-9-]{36})\[/g`, dedupe por par
- **`window.refreshFormulaEdges()`** (graph.js): remueve todos los `[type="formula"]`, re-escanea `VALUES_DATA`, re-crea. Llama `refreshConceptHubs` + `cy.style().update()`
- **Triggers de refresh:** `cy.ready()`, al guardar fórmula en nodo (`graph-labels.js`), al guardar en tabla (`node-timeline-ui.js _saveFormula`)
- Estilo y toggle ya existían (`edge[type="formula"]`, `SHOW_FORMULA_LINKS`)

---

## RND(a,b) — RANDOM SELLADO AL GUARDAR ✅ (sesión 13) + FRND (sesión 17)

`RND(a,b)` devuelve un número al azar entre `a` y `b`. Como los valores son **derivados** (se recalculan seguido), un RND vivo parpadearía → se **sella al guardar**: la llamada se reemplaza por un número fijo antes de persistir.

- `Formula.bakeRandom(stored)` (formula.js): reemplaza `RND(a,b)` con args numéricos por un random. Enteros → entero; con decimales → 2 decimales. Regex `RND_RE` (solo argumentos numéricos literales, **no** refs a nodos).
- Llamado en los 3 puntos de guardado: `queueValueData`, `saveFormulaForPeriod` (api.js) y `_saveFormula` (node-timeline-ui.js).
- Con **All times**: cada período se sella independiente (cada `saveFormulaForPeriod` rola) → randoms distintos por período.
- `_FN.RND` también existe en el evaluador como fallback defensivo (si un RND llegara sin sellar, rola en vivo en vez de romper).
- En `FUNCTIONS` → autocomplete + highlight verde.

### FRND(a,b) — random VIVO (no sellado)
Lo contrario de RND: **no se bakea nunca**, queda en la fórmula y `_FN.FRND` la re-tira en **cada evaluación** (cada recompute, y al recargar — el `value` no se persiste). Mismo redondeo que RND (enteros → entero; si no, 2 decimales).
- ⚠️ **`FRND` contiene `RND`**: `RND_RE` y los regex de normalize/whitelist usan `\bRND` (word boundary) para no matchear el `RND` interno de `FRND`; en el alternation va `FRND|RND` (el más largo primero). `bakeRandom` no toca FRND.
- Trade-off (documentado en MANUAL): no es reproducible — cambia en cada interacción/recarga/export. Para series estables → RND.
- En `FUNCTIONS`, `_FN`, los dos regex de `evaluate` y los args del `new Function(...)`. El `_spec` del export JSON (settings-panel.js) lista ambas.

---

## FORMATO DE NÚMERO POR UNIDAD ✅ (sesión 13)

Cada unidad define cómo se presentan sus valores en nodos y tabla. **Solo presentación** — el valor crudo no se toca; fórmulas y exports CSV/PDF siguen con el número crudo.

### Engine (ui.js)
```javascript
window.formatNumber(value, fmt)    // aplica un formato concreto
window.formatValue(value, unitId)  // busca units.number_format de la unidad del nodo y formatea
```
Formatos: `plain` (crudo), `integer` (1,235), `decimal2` (1,234.50), `accounting` (negativos entre paréntesis), `percent` (agrega `%`, **no** multiplica ×100). Locale `en-US` (coma miles, punto decimal).

### Dónde se aplica
- `graph-labels.js renderNodeLabels`: `valueEl.innerText = formatValue(data.value, data.unit_id)`.
- `node-timeline-ui.js _getDisplay` (modo `values`): `formatValue(r.value, n.unit_id)`.

### UI (settings-panel.js → Units)
- Columna **format** en la fila de unidad (`makeUnitRow`): muestra un **ejemplo** del formato elegido (`formatNumber(1234.5, fmt)`).
- `openUnitFmtDropdown(anchor, unit)`: dropdown `.sp-unit-fmt-dd` con label + muestra (`-1234.5` para que el Accounting se vea con paréntesis). Al elegir → `saveUnitField(unit.id, 'number_format', val)` + `refreshPeriod()` + `refreshTimelinePanel()`.
- ⚠️ El handler global de cierre de paneles (settings-panel.js ~2616) incluye `.sp-unit-fmt-dd` en `inDrop` para no cerrar el panel de Units al elegir formato.
- CSS: grid de `.sp-units-header`/`.sp-unit-row` = `minmax(0,1fr) 28px 10px 28px 78px 16px`; `.sp-units-inner { width: 270px; }`.

`UNITS_MAP` comparte referencias de objeto con `UNITS_DATA`, así que `saveUnitField` se refleja sin recargar.

---

## FACILITADORES DE CARGA EN EDITOR DE FÓRMULAS ✅ (sesión 13)

Chips pill grises arriba del editor inline (`formula-editor.js`): **All times**, **From now** e **Import**.

### Persistencia por período (api.js)
```javascript
window.saveFormulaForPeriod(nodeId, period, formulaText)
```
Igual que `queueValueData` pero con período explícito y **sin recompute** (el caller hace el batch y luego llama `recomputeFormulas()` + `refreshFormulaEdges()` una vez).

### All times
Valida la fórmula actual; confirm panel *"Are you sure you want to spread this formula across all N periods?"* → escribe la fórmula en TODOS los períodos del nodo (offsets relativos se evalúan por período).

### From now (sesión 17)
`_spreadFromNow()`: igual que All times pero el loop va desde `startP = period || CURRENT_PERIOD` hasta `periods` (no toca períodos anteriores). Confirm panel *"Spread this formula from the current period to the last (N periods)?"* con `N = periods - startP + 1`.

### Import → Paste / Load CSV
- **Paste**: textarea *"Paste a series of numbers separated by spaces"*. `_parseNumbers` (split por `[\s,;]+`).
- **Load CSV**: `<input type=file>`; al leer, precarga los números en el panel de Paste (DRY).
- `_applySeries(nums, warnEl)`: llena desde `period` (posición actual) hacia adelante. `available = periods - startP + 1`. Si `nums.length > available` → *"The series exceeds the number of available periods; the extra values won't be pasted."* (igual aplica los que entran).

### Detalles críticos
- `let _busy` (closure): suprime el auto-cierre del editor (blur + `_outside`) mientras hay sub-panel o el diálogo de archivo abierto.
- `_closeAsCancel()`: cierra disparando el `onCancel` del host. **Necesario** porque `graph-labels.js openFieldEditor` hace `fieldEl.style.visibility='hidden'` al editar el valor y solo lo restaura en `onSave`/`onCancel`; cerrar con `closeFormulaEditor()` directo dejaba el valor oculto en el grafo.
- `_reposition()`: reclampa el `wrap` en el viewport tras abrir/cerrar sub-panel → crece hacia arriba si está cerca del borde inferior (caso tabla).
- `window.refreshTimelinePanel()` (node-timeline-ui.js): re-renderiza la tabla si está abierta (`_renderContent(_panel._nodeId)`). Llamado tras aplicar series/spread.

---

## OUTLINE DE CONCEPTS + PADDING DE CHIPS ✅ (sesión 13)

### Outline por color de concepto
Al tocar un chip de concepto, los nodos de los edges con ese concepto se marcan con outline del **color del concepto**.
- `toggleConceptFilter(conceptId, chip)` setea `window.ACTIVE_CONCEPT_COLOR = chip.data('color')` + agrega clase `concept-related` a source/target de edges con match + `cy.style().update()`.
- Estilo `node.concept-related`: `border-width:2`, `border-color: () => window.ACTIVE_CONCEPT_COLOR || getCSSVar('--accent')`.
- `clearConceptFilter` limpia `ACTIVE_CONCEPT_COLOR`.

⚠️ **Bug de raíz arreglado:** `graph-events.js` (módulo) llamaba `toggleConceptFilter` como variable libre, pero la función vive en `graph.js` (otro módulo) → `ReferenceError` en cada tap (por eso el outline nunca se activaba). Se pasa ahora por el objeto `deps` de `setupGraphEvents`.

### Padding horizontal de chips
Cytoscape 3.x solo soporta `padding` uniforme (sumaría alto y choca con el círculo del hub). Solución: el ancho del chip se mide del texto + `CHIP_PAD_X` (5px) a cada lado vía `_chipWidth(label)` (canvas measureText, font `6px Helvetica`), con `height: 'label'`. Esto además elimina la deprecación `width: 'label'`.

---

## FIX EDITOR DE FÓRMULAS — placeholder rojo ✅ (sesión 13)

El editor vacío usaba `<span style="opacity:0">|</span>` como placeholder. `opacity:0` **no** excluye el texto de `innerText`, así que `_getPlain()` devolvía `"|"` y al insertar un nodo quedaba `Nodo[0]|` → token de texto desconocido (rojo) tras los corchetes. Cambiado a `<br>` (su `innerText` es `\n`, que `_getPlain` descarta).

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
- [ ] **Hosting definitivo / privacidad del repo** (sesión 15): hoy el repo es **público** y el sitio se sirve con **GitHub Pages desde `docs/`**. GitHub Pages desde repo privado requiere plan pago. Para poder hacer el repo privado sin costo y/o tener mejor deploy, evaluar **migrar el hosting a Cloudflare Pages** (gratis, sirve repos privados, más rápido). Decisión pendiente; por ahora se dejó público a propósito (no expone secretos: la anon key es pública por diseño y la seguridad real es RLS + auth).
- [ ] Undo de los facilitadores de carga (All times / Import) — hoy no son deshaciables (el editor de celda individual sí)
- [ ] Locale configurable en `formatNumber` (hoy fijo `en-US`); decidir si `percent` debería multiplicar ×100
- [ ] SQL a aplicar si falta: `units.number_format` (sesión 13), `nodes.text_only`, `time_values.formula`, `node_parent_concepts`

### Resuelto en sesión 13 (eran pendientes viejos)
- [x] Fórmulas: evaluación en orden topológico — `Formula.recomputeAll` (período a período + DFS topológico intra-período)
- [x] Fórmulas: detección y manejo de ciclos — `recomputeAll`/`hasCycle`/`cyclePath`/`validate` + `FORMULA_CYCLES` + borde rojo + ⚠ en label + preview en vivo al editar

### Sesión 13 — completado
- [x] **DETECCIÓN DE CICLOS + ORDEN TOPOLÓGICO** confirmados/cableados: `recomputeAll` (período a período + DFS), `FORMULA_CYCLES`, borde rojo `node[?formula_cycle]`, ⚠ en label
- [x] **PREVIEW DE CICLO EN VIVO**: `Formula.cyclePath` + `FORMULA_CYCLE_PREVIEW` + `markFormulaCycles` (unión persistido+preview) — marca rojo al editar aunque no se guarde
- [x] **OUTLINE DE CONCEPTS** por color del concepto (`ACTIVE_CONCEPT_COLOR`, `node.concept-related` 2px) + fix bug raíz `toggleConceptFilter` no estaba en `deps` de `setupGraphEvents` (ReferenceError → outline nunca andaba)
- [x] **PADDING HORIZONTAL DE CHIPS**: `_chipWidth` (medición de texto + CHIP_PAD_X), `width` calculado en vez de `'label'`
- [x] **FIX placeholder rojo** en editor de fórmulas: `<span opacity:0>|</span>` → `<br>` (el `|` se filtraba al `innerText`)
- [x] **FACILITADORES DE CARGA** en editor inline: chips **All times** (spread a todos los períodos) e **Import** (Paste / Load CSV) → `saveFormulaForPeriod`, `_applySeries` (llena hacia adelante + aviso de overflow), `_busy`, `_closeAsCancel`, `_reposition`
- [x] **FIX**: el valor no se reflejaba en grafo tras aplicar series → `_closeAsCancel` (restaura visibilidad del label que `graph-labels` ocultaba)
- [x] **refreshTimelinePanel** expuesto (re-render de la tabla si está abierta)
- [x] **FORMATO DE NÚMERO POR UNIDAD**: `units.number_format`, `formatNumber`/`formatValue`, selector en Units con ejemplo en vivo, aplicado en nodos + tabla (modo values). Solo presentación; crudo intacto
- [x] **RND(a,b)** random sellado al guardar (`Formula.bakeRandom`) en los 3 puntos de save; fallback vivo en el evaluador
- [x] **RLS units UPDATE** faltaba (editar unidad no persistía sin error) → SQL agregado; `saveUnitField` ahora usa `.select()` y avisa si 0 filas
- [x] Correcciones de textos en inglés en los paneles de carga

### Sesión 12 — completado
- [x] **MOTOR DE FÓRMULAS** (`formula.js`): tokenizer, serializer, evaluador con `Function()`, validador, 10 funciones (SUM/AVG/MIN/MAX/ABS/ROUND/IF/AND/OR/NOT)
- [x] **EDITOR DE FÓRMULAS** (`formula-editor.js`): contenteditable con syntax highlighting en tiempo real (azul/blanco/gris/verde), autocomplete de nodos y funciones, sugerencias de offset al tipear `[`
- [x] Integración en nodo (`graph-labels.js`): click en value → `openFormulaEditor`
- [x] Integración en timeline (`node-timeline-ui.js`): celdas clickeables → `openFormulaEditor`
- [x] Toggle values/formulas en timeline: modo `formulas` muestra display legible (no storage format)
- [x] Export CSV desde timeline: nodos visibles + filtros + modo values/formulas
- [x] Export PDF desde timeline: tabla limpia con divs + header con logo SVG inlineado + metadata
- [x] Fix evaluación en carga: `VALUES_DATA` se asigna antes del loop de `evalFormula`
- [x] Fix evaluador: usa `Function()` para expresiones (no solo `parseFloat`)
- [x] `MANUAL.md` creado en raíz del repo
- [x] **FORMULA EDGES DERIVADOS**: `window.refreshFormulaEdges` en graph.js, build en `ui.js handleData`, flecha entrante al nodo con la fórmula. Triggers en cy.ready + guardado de fórmula (nodo y tabla)
- [x] **TEXT ONLY**: toggle en style panel, oculta value/unit del label, centra title. Campo `nodes.text_only`. Con undo

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
Al arrancar: leer los tres documentos (`CLAUDE.md` raíz, este `STATE_NOW.md`, `docs/MANUAL.es.md`)
Al cerrar: actualizar este documento (+ `CLAUDE.md`/`docs/MANUAL.es.md` si cambió arquitectura/UX) + commitear repo

---

## NOTAS DE GUILLE
- Arquitecto, no IT. Viene trabajando con Claude como programador.
- Muy enfocado en perfección visual — la simplicidad y coherencia del UI es estratégica para la adopción.
- El proyecto tiene base conceptual sólida y arquitectura bien pensada.
- Rocío es su señora ☕
