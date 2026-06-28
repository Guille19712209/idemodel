/////////////////////////////////////////////////////////
// GRAPH ENGINE (Cytoscape)
/////////////////////////////////////////////////////////

let cy = null;
let tickingChips = false;
let tickingLabels = false;
window.ACTIVE_EDGE = null;
window.NODE_EDIT_MODE = false;
window._pendingNodeId = null;
window.SHOW_HIDDEN        = false;
window.SHOW_PARENT_LINKS  = true;
window.SHOW_FORMULA_LINKS = true;
window.SHOW_CONCEPT_LINKS = true;
window.CONCEPTS_MODE        = 'none';
window.ACTIVE_CONCEPT_EDGES = new Set();
// Factor de atenuación del "resto del modelo" cuando hay algo activo (× opacidad definida).
window.DIM_FACTOR = 0.25;
let _updatingChips = false;

window.updateHiddenVisibility = function() {
  if (!cy) return;
  cy.style().update();
  renderNodeLabels(cy);
};

window.updateLinkVisibility = function() {
  if (!cy) return;
  cy.style().update();
};

function _setPendingBtnState(disabled) {
  const btn = document.getElementById('add-node-btn');
  if (!btn) return;
  btn.style.opacity = disabled ? '0.35' : '';
  btn.style.cursor  = disabled ? 'not-allowed' : '';
  btn.title         = disabled ? 'Name the new element first' : '';
}

window._clearPendingNode = function(nodeId) {
  if (nodeId !== undefined && window._pendingNodeId !== nodeId) return;
  window._pendingNodeId = null;
  _setPendingBtnState(false);
};

window.__FROM_LABEL_CLICK = false;

import {
  getCSSVar,
  getNodeColor,
  getEdgeColor,
  getEdgeActiveColor
} from "./graph/graph-style.js?v=34";

import { setupGraphEvents }
from "./graph/graph-events.js?v=34";

import {
  NODE_LABELS,
  renderNodeLabels,
  updateNodeLabelPositions,
  openFieldEditor,
  openUnitSelector,
  closeUnitSelector,
} from "./graph/graph-labels.js?v=34";

import {
  createNodeBadges,
  removeNodeBadges,
  updateBadgePositions,
} from "./graph/graph-dom-badges.js?v=34";

window.removeNodeBadges = removeNodeBadges;


/////////////////////////////////////////////////////////
// MAIN RENDER
/////////////////////////////////////////////////////////

// Máximo por unidad (entre nodos size_type 'by unit'), cacheado POR PASADA de render.
// Antes se recalculaba recorriendo todos los nodos por cada nodo → O(N²). Ahora se
// calcula una vez y se limpia en el microtask siguiente, así el próximo render lo recomputa
// fresco (sin invalidación manual). Resultado: O(N) por style().update().
let _byUnitMaxCache = null;

function computeByUnitSize(ele, fallbackPx) {
  const fb = (fallbackPx != null && !isNaN(fallbackPx))
    ? fallbackPx
    : (parseFloat(ele.data('size_px')) || 80);
  const unitId  = ele.data('unit_id');
  const value   = parseFloat(ele.data('value'));

  if (!unitId || isNaN(value)) return fb;

  const unit = (window.UNITS_DATA || []).find(u => u.id === unitId);
  if (!unit) return fb;

  const minSz = parseFloat(unit.min_sz) || 20;
  const maxSz = parseFloat(unit.max_sz) || 120;

  if (!_byUnitMaxCache) {
    const cache = _byUnitMaxCache = {};
    ele.cy().nodes().not('[isChip],[isConceptHub]').forEach(n => {
      if (n.data('size_type') === 'by unit' || n.data('size_type_h') === 'by unit') {
        const uid = n.data('unit_id'); if (!uid) return;
        const v = parseFloat(n.data('value'));
        if (!isNaN(v) && (cache[uid] === undefined || v > cache[uid])) cache[uid] = v;
      }
    });
    queueMicrotask(() => { _byUnitMaxCache = null; });
  }

  const valMax = _byUnitMaxCache[unitId];
  if (valMax === undefined || valMax <= 0) return minSz;

  const pct  = Math.max(0, Math.min(1, value / valMax));
  const size = Math.round(pct * maxSz);

  return Math.max(minSz, size);
}

// Dimensión de un eje (axis='w'|'h'). W = size_type/size_px (fuente histórica);
// H = size_type_h/size_px_h con FALLBACK a las de W cuando son null (nodos viejos = cuadrados).
function axisDim(ele, axis) {
  if (axis === 'h') {
    const t  = ele.data('size_type_h') || ele.data('size_type') || 'fixed';
    const px = ele.data('size_px_h') != null
      ? parseFloat(ele.data('size_px_h'))
      : (parseFloat(ele.data('size_px')) || parseFloat(ele.data('size')) || 80);
    return t === 'by unit' ? computeByUnitSize(ele, px) : px;
  }
  const t  = ele.data('size_type') || 'fixed';
  const px = parseFloat(ele.data('size_px')) || parseFloat(ele.data('size')) || 80;
  return t === 'by unit' ? computeByUnitSize(ele, px) : px;
}
window.axisDim = axisDim;

window.renderGraph = function(graphData) {


  if (cy) cy.destroy();

  cy = cytoscape({

    container: document.getElementById('graph'),

    elements: [
    ...graphData.nodes.map(n => ({

      data: {

        id: n.id,

        ...n.data,

        unit_id:
          n.unit_id ||
          n.data?.unit_id ||
          null

      },

      position: n.position

    })),
      ...graphData.edges
    ],

    userPanningEnabled: true,
    userZoomingEnabled: false,   // rueda manejada por handler propio THROTTLED (pasos chicos y parejos)
    boxSelectionEnabled: false,

    // Acota el zoom: el default (1e-50 … 1e50) permite llegar a un régimen degenerado
    // (transformaciones con 1/zoom enormes → geometría rota → pantalla negra del GPU).
    // Además, cy.zoom() respeta estos límites → el handler de rueda no puede degenerarse.
    minZoom: 0.05,
    maxZoom: 5,

    style: [

      /////////////////////////////////////////////////////////
      // NODES
      /////////////////////////////////////////////////////////
      {
        selector: 'node',
        style: {
          'label': '',
          'background-color': (ele) => ele.data('color') || getNodeColor(ele),
          'background-opacity': (ele) => ele.data('alpha') ?? 0.7,
          // Shapes-polígono (país built-in o custom del usuario): si data(shape) resuelve a un
          // string de puntos, el shape real de Cytoscape es 'polygon' (ver polyPointsFor/graph-style.js).
          'shape': (ele) => {
            const pts = window.polyPointsFor?.(ele.data('shape'));
            return pts ? 'polygon' : (ele.data('shape') || 'ellipse');
          },
          'shape-polygon-points': (ele) => window.polyPointsFor?.(ele.data('shape')) || '-1 -1  1 -1  1 1  -1 1',
          'width':  (ele) => axisDim(ele, 'w'),
          'height': (ele) => axisDim(ele, 'h'),
                  }
      },

      {
        selector: "node:selected",
        style: {
          "border-width": 1,
          "border-color": getCSSVar('--text-primary'),
        }
      },

      {
        selector: 'node[?hidden]',
        style: {
          'display':            () => window.SHOW_HIDDEN ? 'element' : 'none',
          'background-opacity': 0,
          'border-style':       'dashed',
          'border-width':       1.5,
          'border-color':       () => getCSSVar('--top-ui-color'),
          'border-opacity':     0.35,
        }
      },
      {
        selector: 'node[?hidden]:selected',
        style: {
          'border-style':   'solid',
          'border-width':   1,
          'border-color':   getCSSVar('--text-primary'),
          'border-opacity': 1,
        }
      },
      {
        selector: 'node[?formula_cycle]',
        style: {
          'border-style':   'solid',
          'border-width':   2.5,
          'border-color':   '#ff5a5a',
          'border-opacity': 1,
        }
      },

      /////////////////////////////////////////////////////////
      // CHIPS (concepts on edges)
      /////////////////////////////////////////////////////////
    {
      selector: 'node[isChip]',
      style: {
        'label': 'data(label)',
        'background-color': 'data(color)',
        'background-opacity': 1,
        'shape': 'round-rectangle',

        'color': (ele) => getContrastColor(ele.data('color')),

        'font-size': 6,
        'text-valign': 'center',
        'text-halign': 'center',

        'padding': 0,

        'height': 9,
        // Padding sólo horizontal: 'padding' afecta los 4 lados y sumaría alto
        // (choca con el círculo del hub). El ancho se mide del texto + CHIP_PAD_X*2.
        'width': (ele) => _chipWidth(ele.data('label')),

        'border-width': 0,

        'display': (ele) => {
          const pEdge = ele.cy().getElementById(ele.data('parentEdge'));
          if (!pEdge.length) return 'none';
          // Nodo oculto por view level → ocultar también su chip (si no, queda flotando)
          if (pEdge.source().css('display') === 'none' || pEdge.target().css('display') === 'none') return 'none';
          const eType = pEdge.data('type');
          if (eType === 'parent'  && !window.SHOW_PARENT_LINKS)  return 'none';
          if (eType === 'manual'  && !window.SHOW_CONCEPT_LINKS) return 'none';
          if (eType === 'formula' && !window.SHOW_FORMULA_LINKS) return 'none';
          return (pEdge.source().data('hidden') || pEdge.target().data('hidden'))
            ? (window.SHOW_HIDDEN ? 'element' : 'none')
            : 'element';
        },
        'opacity': (ele) => {
          const pEdge = ele.cy().getElementById(ele.data('parentEdge'));
          if (!pEdge.length) return 1;
          return (pEdge.source().data('hidden') || pEdge.target().data('hidden')) ? 0.35 : 1;
        }
      }
    },

      /////////////////////////////////////////////////////////
      // CONCEPT HUBS
      /////////////////////////////////////////////////////////
    {
      selector: 'node[isConceptHub]',
      style: {
        // El hub tiene dos apariencias (ver _isHubActive / _hubEdgeColor abajo):
        //  · ACTIVO (edge seleccionado): círculo gris, tamaño normal, label '+', chips desplegados.
        //  · PASIVO: en modo 'all' un punto del color del edge al 30% sin label; en
        //    'active'/'none' un círculo del color del edge con el número de conceptos en negro.
        'label': (ele) => {
          const edgeId = ele.data('parentEdge');
          if (_isHubActive(edgeId)) return '+';
          if (window.CONCEPTS_MODE === 'all') return '';           // punto: sin número ni +
          const pEdge = ele.cy().getElementById(edgeId);
          const count = pEdge.length ? (pEdge.data('concepts') || []).length : 0;
          return count > 0 ? String(count) : '';
        },
        'shape': 'ellipse',
        'background-color': (ele) => {
          const edgeId = ele.data('parentEdge');
          if (_isHubActive(edgeId)) return '#272727';              // gris cuando está activo
          const pEdge = ele.cy().getElementById(edgeId);
          return pEdge.length ? _hubEdgeColor(pEdge) : '#272727';  // color del edge
        },
        'background-opacity': 1,
        'border-width': 0,
        'color': (ele) => _isHubActive(ele.data('parentEdge')) ? '#ffffff' : '#000000',
        'font-size': 7,
        'text-valign': 'center',
        'text-halign': 'center',
        'width': (ele) => {
          const edgeId = ele.data('parentEdge');
          if (_isHubActive(edgeId)) return 9;
          return window.CONCEPTS_MODE === 'all' ? 3 : 9;           // punto al 30% en modo all
        },
        'height': (ele) => {
          const edgeId = ele.data('parentEdge');
          if (_isHubActive(edgeId)) return 9;
          return window.CONCEPTS_MODE === 'all' ? 3 : 9;
        },
        'display': (ele) => {
          const edgeId = ele.data('parentEdge');
          const pEdge = ele.cy().getElementById(edgeId);
          if (!pEdge.length) return 'none';
          // Nodo oculto por view level → ocultar también su hub (si no, queda flotando)
          if (pEdge.source().css('display') === 'none' || pEdge.target().css('display') === 'none') return 'none';
          if ((pEdge.source().data('hidden') || pEdge.target().data('hidden')) && !window.SHOW_HIDDEN) return 'none';
          const eType = pEdge.data('type');
          if (eType === 'parent'  && !window.SHOW_PARENT_LINKS)  return 'none';
          if (eType === 'manual'  && !window.SHOW_CONCEPT_LINKS) return 'none';
          if (eType === 'formula' && !window.SHOW_FORMULA_LINKS) return 'none';
          // Edge seleccionado: siempre visible (círculo gris '+'), más fuerte que el modo
          if (_isHubActive(edgeId)) return 'element';
          const count = (pEdge.data('concepts') || []).length;
          // Modo all: punto de color en todos los edges
          if (window.CONCEPTS_MODE === 'all') return 'element';
          // Modo active/none: solo si hay conceptos (círculo con número)
          return count > 0 ? 'element' : 'none';
        },
        'opacity': (ele) => {
          const pEdge = ele.cy().getElementById(ele.data('parentEdge'));
          if (!pEdge.length) return 1;
          return (pEdge.source().data('hidden') || pEdge.target().data('hidden')) ? 0.35 : 1;
        }
      }
    },

      /////////////////////////////////////////////////////////
      // EDGES
      /////////////////////////////////////////////////////////
      {
        selector: 'edge',
        style: {
          'width': 1,
          'line-color': getEdgeColor(),
          'target-arrow-color': getEdgeColor(),
          'target-arrow-shape': 'vee',
          'arrow-scale': 0.5,

          'label': '',
          'text-rotation': 'autorotate',
          'line-style': (ele) => (ele.source().data('hidden') || ele.target().data('hidden')) ? 'dashed' : 'solid',
          'opacity':    (ele) => (ele.source().data('hidden') || ele.target().data('hidden')) ? 0.35 : 1
        }
      },

      {
        selector: 'edge[type="parent"]',
        style: {
          'display':                   () => window.SHOW_PARENT_LINKS ? 'element' : 'none',
          'line-color':                '#a2c1cf',
          'target-arrow-color':        '#a2c1cf',
          'target-arrow-shape':        'triangle',
          'curve-style':               'unbundled-bezier',
          'control-point-distances':   [-25],
          'control-point-weights':     [0.5],
          'arrow-scale':               0.5,
          'target-distance-from-node': .5
        }
      },

      {
        selector: 'edge[type="formula"]',
        style: {
          'display':                   () => window.SHOW_FORMULA_LINKS ? 'element' : 'none',
          'width':                     1,
          'line-color':                getEdgeColor(),
          'target-arrow-color':        getEdgeColor(),
          'target-arrow-shape':        'triangle',
          'curve-style':               'straight',
          'arrow-scale':               0.5,
          'target-distance-from-node': .5
        }
      },

      {
        selector: 'edge[type="manual"]',
        style: {
          'display':                   () => window.SHOW_CONCEPT_LINKS ? 'element' : 'none',
          'line-color':                '#f7acac',
          'target-arrow-color':        '#f7acac',
          'target-arrow-shape':        'triangle',
          'curve-style':               'unbundled-bezier',
          'control-point-distances':   [30],
          'control-point-weights':     [0.5],
          'arrow-scale':               0.5,
          'target-distance-from-node': .5
        }
      },

      {
        selector: 'node.concept-related',
        style: {
          'border-width': 2,
          'border-color': () => window.ACTIVE_CONCEPT_COLOR || getCSSVar('--accent'),
          'border-opacity': 1
        }
      },

      /////////////////////////////////////////////////////////
      // EDGE STATES
      /////////////////////////////////////////////////////////
      {
        selector: 'edge.highlighted',
        style: {
          'width': 1,
          'line-color':        () => window.ACTIVE_CONCEPT_COLOR || getEdgeActiveColor(),
          'target-arrow-color': () => window.ACTIVE_CONCEPT_COLOR || getEdgeActiveColor()
        }
      },

      /////////////////////////////////////////////////////////
      // ACTIVE CHIP
      /////////////////////////////////////////////////////////
      {
        selector: 'node[isChip].active',
        style: {
          'border-width': 1,
          'border-color': getCSSVar('--accent')
        }
      },

      /////////////////////////////////////////////////////////
      // DIM (resto del modelo cuando hay algo activo) → 50% de la opacidad definida
      /////////////////////////////////////////////////////////
      {
        selector: 'node.dim',
        style: {
          // Hidden mantiene su fondo a 0; el resto baja según DIM_FACTOR su alpha definido.
          'background-opacity': (ele) => ele.data('hidden') ? 0 : (ele.data('alpha') ?? 0.7) * window.DIM_FACTOR
        }
      },
      {
        selector: 'edge.dim',
        style: {
          'opacity': (ele) => ((ele.source().data('hidden') || ele.target().data('hidden')) ? 0.35 : 1) * window.DIM_FACTOR
        }
      },
      {
        selector: 'node[isChip].dim, node[isConceptHub].dim',
        style: {
          'opacity': (ele) => _dimChipOpacity(ele)
        }
      },

    ],

    layout: { name: 'preset' }
  });

  window.cy = cy;

  window.refreshByUnitSizes = () => cy.style().update();

  window.zoomAll = function() {
    const visible = cy.nodes().not('[isChip],[isConceptHub]').filter(n => n.style('display') !== 'none');
    if (!visible.length) return;
    cy.animate({ fit: { eles: visible, padding: 60 }, duration: 350, easing: 'ease-in-out-quad' });
  };

  window.centerActiveNode = function() {
    const sel = cy.nodes(':selected').not('[isChip],[isConceptHub]');
    const target = sel.length ? sel.first() : null;
    if (!target) return;
    cy.animate({ center: { eles: target }, duration: 350, easing: 'ease-in-out-quad' });
  };

  window.centerNodeById = function(nodeId) {
    const node = cy.getElementById(nodeId);
    if (!node.length || node.data('isChip') || node.data('isConceptHub')) return;
    cy.animate({ center: { eles: node }, duration: 350, easing: 'ease-in-out-quad' });
    cy.nodes().unselect();
    node.select();
  };

  /////////////////////////////////////////////////////////
  // VIEW LEVEL
  /////////////////////////////////////////////////////////

  window.VIEW_LEVEL     = 0;
  window.VIEW_LEVEL_MAX = 0;

  window.applyViewLevel = function(level) {
    const realNodes = cy.nodes().not('[isChip],[isConceptHub]');

    // BFS desde raíces para calcular profundidad de cada nodo
    const depths = new Map();
    const roots  = realNodes.filter(n =>
      !cy.edges().some(e => e.source().id() === n.id() && e.data('type') === 'parent')
    );
    const queue = [];
    roots.forEach(n => { depths.set(n.id(), 0); queue.push(n.id()); });
    while (queue.length) {
      const curId    = queue.shift();
      const curDepth = depths.get(curId);
      cy.edges()
        .filter(e => e.data('type') === 'parent' && e.target().id() === curId)
        .forEach(e => {
          const childId = e.source().id();
          if (!depths.has(childId)) {
            depths.set(childId, curDepth + 1);
            queue.push(childId);
          }
        });
    }
    realNodes.forEach(n => { if (!depths.has(n.id())) depths.set(n.id(), 0); });

    const maxDepth    = depths.size ? Math.max(...depths.values()) : 0;
    const capped      = Math.min(level, maxDepth);
    window.VIEW_LEVEL     = capped;
    window.VIEW_LEVEL_MAX = maxDepth;

    const visIds = new Set();
    realNodes.forEach(n => {
      const depth        = depths.get(n.id()) ?? 0;
      const depthVisible = capped === 0 || depth <= maxDepth - capped;
      // Un nodo hidden NO se fuerza visible: lo gobierna node[?hidden] (respeta SHOW_HIDDEN).
      if (!depthVisible)         n.css('display', 'none');
      else if (n.data('hidden')) n.removeStyle('display');
      else                       n.css('display', 'element');
      const eff = depthVisible && !(n.data('hidden') && !window.SHOW_HIDDEN);
      if (eff) visIds.add(n.id());
      const labelEl = document.querySelector(`#node-label-layer [data-id="${n.id()}"]`);
      if (labelEl) labelEl.style.display = eff ? '' : 'none';
    });

    // Edges visibles solo si ambos extremos lo están (visibilidad lógica, no css).
    cy.edges().not('[isChip]').forEach(e => {
      const v = visIds.has(e.source().id()) && visIds.has(e.target().id());
      e.css('display', v ? 'element' : 'none');
    });

    // Deseleccionar nodo si quedó oculto
    cy.nodes(':selected').not('[isChip],[isConceptHub]').forEach(n => {
      if (n.css('display') === 'none') {
        n.unselect();
        if (typeof window.removeNodeBadges === 'function') window.removeNodeBadges();
      }
    });

    // Reevaluar display de chips/hubs: sus mappers ahora dependen del display de los nodos
    cy.style().update();
  };

  /////////////////////////////////////////////////////////
  // NODE FILTER — visibilidad por grupo / unidad / concepto / parentesco / nombre
  // Cada faceta: { mode:'all'|'none'|'some', ids:Set }. 'all' no restringe;
  // un nodo es visible si pasa TODAS las facetas (intersección).
  /////////////////////////////////////////////////////////

  if (!window.NODE_FILTER) {
    window.NODE_FILTER = {
      group:   { mode: 'all', ids: new Set() },
      unit:    { mode: 'all', ids: new Set() },
      concept: { mode: 'all', ids: new Set() },
      parent:  { mode: 'all', ids: new Set() },
      name:    { mode: 'all', ids: new Set() },
    };
  }

  window.applyNodeFilter = function() {
    if (!cy) return;
    const F = window.NODE_FILTER;
    const realNodes = cy.nodes().not('[isChip],[isConceptHub]');

    // Nodos endpoint de un edge con alguno de los concepts seleccionados.
    let conceptNodes = null;
    if (F.concept.mode === 'some') {
      conceptNodes = new Set();
      cy.edges().forEach(e => {
        const cs = e.data('concepts') || [];
        if (cs.some(c => F.concept.ids.has(c.id))) {
          conceptNodes.add(e.source().id());
          conceptNodes.add(e.target().id());
        }
      });
    }

    // Parentesco: nodos seleccionados + todos sus descendientes (subárbol).
    let parentNodes = null;
    if (F.parent.mode === 'some') {
      parentNodes = new Set();
      F.parent.ids.forEach(rootId => {
        parentNodes.add(rootId);
        const queue = [rootId];
        while (queue.length) {
          const cur = queue.shift();
          cy.edges()
            .filter(e => e.data('type') === 'parent' && e.target().id() === cur)
            .forEach(e => {
              const ch = e.source().id();
              if (!parentNodes.has(ch)) { parentNodes.add(ch); queue.push(ch); }
            });
        }
      });
    }

    const matchFacet = (f, test) => {
      if (f.mode === 'all')  return true;
      if (f.mode === 'none') return false;
      return test();
    };

    const visIds = new Set();
    realNodes.forEach(n => {
      const id = n.id();
      const okGroup = matchFacet(F.group, () => {
        const gs = n.data('groups');
        return Array.isArray(gs) && gs.some(g => F.group.ids.has(g.id));
      });
      const okUnit    = matchFacet(F.unit,    () => F.unit.ids.has(n.data('unit_id')));
      const okConcept = matchFacet(F.concept, () => conceptNodes.has(id));
      const okParent  = matchFacet(F.parent,  () => parentNodes.has(id));
      const okName    = matchFacet(F.name,    () => F.name.ids.has(id));
      const passes = okGroup && okUnit && okConcept && okParent && okName;

      // Un nodo hidden NO se fuerza visible: lo gobierna node[?hidden] (respeta SHOW_HIDDEN).
      if (!passes)               n.css('display', 'none');
      else if (n.data('hidden')) n.removeStyle('display');
      else                       n.css('display', 'element');
      const eff = passes && !(n.data('hidden') && !window.SHOW_HIDDEN);
      if (eff) visIds.add(id);
      const labelEl = document.querySelector(`#node-label-layer [data-id="${id}"]`);
      if (labelEl) labelEl.style.display = eff ? '' : 'none';
    });

    // Edges visibles solo si ambos extremos lo están (visibilidad lógica, no css).
    cy.edges().not('[isChip]').forEach(e => {
      const v = visIds.has(e.source().id()) && visIds.has(e.target().id());
      e.css('display', v ? 'element' : 'none');
    });

    // Deseleccionar nodo que quedó oculto.
    cy.nodes(':selected').not('[isChip],[isConceptHub]').forEach(n => {
      if (n.css('display') === 'none') {
        n.unselect();
        if (typeof window.removeNodeBadges === 'function') window.removeNodeBadges();
      }
    });

    cy.style().update();
  };

  /////////////////////////////////////////////////////////
  // RE-ARRANGE — reordena el grafo. Manual, reversible con undo.
  //   'grid'    → cada árbol una celda (root-origen al centro), empaquetadas en grilla.
  //   'tree'    → radial parent-tree único centro (cuñas por necesidad).
  //   'compare' → colectores (roots con hijos) en eje horizontal por valor; el resto, bosque
  //               por fórmula (force-directed) con colectores como anclas.
  /////////////////////////////////////////////////////////

  // mode: 'grid' | 'tree' | 'compare'
  window.rearrangeGraph = function(mode) {
    if (!cy) return;
    if (window.USER_ROLE === 'reader') return;
    mode = mode || 'grid';

    const realNodes = cy.nodes().not('[isChip],[isConceptHub]').filter(n => n.css('display') !== 'none');
    if (realNodes.length < 2) return;

    // Solo edges parent entre nodos visibles → definen la jerarquía.
    const parentEdges = cy.edges().filter(e =>
      e.data('type') === 'parent' &&
      realNodes.contains(e.source()) && realNodes.contains(e.target())
    );
    const eles = realNodes.union(parentEdges);

    // Snapshot para undo.
    const saved = {};
    realNodes.forEach(n => { saved[n.id()] = { ...n.position() }; });

    const _persist = (positions) => {
      if (typeof setState === 'function') {
        const current = getState();
        setState({ ...current, positions });
      }
      window.queuePositions?.(positions);
    };

    const _refreshOverlays = () => {
      window.refreshConceptHubs?.();
      if (typeof window.updateBadgePositions === 'function') window.updateBadgePositions();
      renderNodeLabels(cy);
    };

    // Persiste posiciones nuevas + registra undo (restaura el snapshot previo).
    const _finish = () => {
      const positions = {};
      realNodes.forEach(n => { positions[n.id()] = { ...n.position() }; });
      _persist(positions);
      // Auto-encuadre: cada Re-arrange aterriza a un zoom legible (los labels siguen por el
      // handler de pan/zoom). Clave porque la escala del radial depende del nº/tamaño de nodos.
      cy.animate({ fit: { eles: realNodes, padding: 80 }, duration: 350, easing: 'ease-in-out' });
      _refreshOverlays();
      window.pushUndo?.(async () => {
        realNodes.forEach(n => { if (saved[n.id()]) n.position(saved[n.id()]); });
        _persist(saved);
        _refreshOverlays();
      });
    };

    if (mode === 'tree') {
      // ── RADIAL PARENT-TREE (único centro, forest-aware) ─────────────────────
      // Criterio (esquema de Guille):
      //  · Los primeros padres definen el primer anillo; de cada uno NACE una cuña.
      //  · Cada nivel subdivide la cuña del padre en cuñas menores (nunca invade la del vecino).
      //  · Cada cuña vale SOLO lo que necesita: sus nodos se empaquetan con 10px entre sí,
      //    y las cuñas hermanas se separan solo 10px → se ven como "porciones" nítidas.
      //  · Si los nodos no entran en su cuña, sube el radio (se alejan), no roban ángulo.
      //  · Nodos AISLADOS (sin padre ni hijos) → una sola línea horizontal abajo, centrada.
      const TAU      = Math.PI * 2;
      const GAP      = 10;     // separación mínima entre nodos (px) — tuneable
      const SEP_FRAC = 0.18;   // margen lateral de cada RAMA (fracción) → cuñas visibles como porciones
      const R_MAX    = 6000;   // tope duro de radio (coordenadas enormes rompen el GPU)

      // Árbol limpio: un solo padre por nodo (último gana); childrenOf derivado de parentOf.
      const parentOf = new Map();
      parentEdges.forEach(e => { parentOf.set(e.source().id(), e.target().id()); });
      const childrenOf = new Map();
      realNodes.forEach(n => childrenOf.set(n.id(), []));
      parentOf.forEach((p, c) => { if (childrenOf.has(p)) childrenOf.get(p).push(c); });

      const allRoots     = realNodes.map(n => n.id()).filter(id => !parentOf.has(id));
      const isolated     = allRoots.filter(id => (childrenOf.get(id) || []).length === 0);
      const participating = allRoots.filter(id => (childrenOf.get(id) || []).length > 0);

      const radOf = (id) => {
        const n = cy.getElementById(id); let w = n.width(), h = n.height();
        if (!isFinite(w)) w = 80; if (!isFinite(h)) h = 80;
        return Math.max(w, h) / 2;
      };

      // Profundidad por BFS desde los roots participantes (los aislados/ciclos quedan fuera → abajo).
      const depthOf = new Map();
      participating.forEach(r => depthOf.set(r, 0));
      let frontier = participating.slice();
      while (frontier.length) {
        const next = [];
        frontier.forEach(p => (childrenOf.get(p) || []).forEach(c => {
          if (!depthOf.has(c)) { depthOf.set(c, depthOf.get(p) + 1); next.push(c); }
        }));
        frontier = next;
      }
      const maxDepth = Math.max(0, ...depthOf.values());

      // Radio mínimo por anillo (no colisión radial padre↔hijo). Root único → al centro.
      const maxRadAt = new Map();
      depthOf.forEach((d, id) => { maxRadAt.set(d, Math.max(maxRadAt.get(d) || 0, radOf(id))); });
      const singleRoot = participating.length === 1;
      const radiusAt = new Map();
      radiusAt.set(0, singleRoot ? 0 : (maxRadAt.get(0) || 40) + GAP);
      for (let d = 1; d <= maxDepth; d++) {
        radiusAt.set(d, (radiusAt.get(d - 1) || 0) + (maxRadAt.get(d - 1) || 0) + (maxRadAt.get(d) || 0) + GAP);
      }
      const gapAng = (d) => { const r = radiusAt.get(d) || 0; return r > 0 ? GAP / r : 0; };

      // Ancho angular NECESARIO por nodo (bottom-up): el suyo propio (a su radio) o el de
      // sus hijos empaquetados con 10px — el que sea mayor. Así la cuña vale solo lo que necesita.
      const needMemo = new Map();
      const angNeed = (id) => {
        if (needMemo.has(id)) return needMemo.get(id);
        const d = depthOf.get(id);
        const r = radiusAt.get(d) || 0;
        const own = r > 0 ? (2 * radOf(id) + GAP) / r : 0;     // arco propio a su radio
        const kids = childrenOf.get(id) || [];
        let res = own;
        if (kids.length) {
          const gc = gapAng(d + 1);
          let sum = 0; kids.forEach(k => { sum += angNeed(k); });
          sum += (kids.length - 1) * gc;
          if (sum > res) res = sum;
          res *= (1 + SEP_FRAC);   // margen lateral de la rama → separa la cuña de sus hermanas
        }
        needMemo.set(id, res);
        return res;
      };

      // Si el total no entra en 360°, escalar TODOS los radios (los ángulos bajan ∝ 1/k →
      // total = 360°). Empaquetado tangencial garantizado, sin invadir cuñas.
      let total = gapAng(0) * Math.max(0, participating.length - 1);
      participating.forEach(r => { total += angNeed(r); });
      if (total > TAU) {
        const k = total / TAU;
        for (let d = 0; d <= maxDepth; d++) radiusAt.set(d, Math.min((radiusAt.get(d) || 0) * k, R_MAX));
        needMemo.clear();
      }

      // Asignar ángulos: hijos centrados sobre el EJE de su padre, empaquetados tight.
      const angC = new Map();
      const place = (id, start) => {
        const d = depthOf.get(id);
        const w = angNeed(id);
        const center = start + w / 2;
        angC.set(id, center);
        const kids = childrenOf.get(id) || [];
        if (kids.length) {
          const gc = gapAng(d + 1);
          let ct = (kids.length - 1) * gc; kids.forEach(k => { ct += angNeed(k); });
          let cs = center - ct / 2;                      // centrar el bloque de hijos bajo el eje
          kids.forEach(k => { place(k, cs); cs += angNeed(k) + gc; });
        }
      };
      const gr = gapAng(0);
      let span = gr * Math.max(0, participating.length - 1);
      participating.forEach(r => { span += angNeed(r); });
      let cursor = -span / 2;                            // centrar todo alrededor del eje (arriba)
      participating.forEach(r => { place(r, cursor); cursor += angNeed(r) + gr; });

      const bb  = realNodes.boundingBox();
      const cx0 = (bb.x1 + bb.x2) / 2;
      const cy0 = (bb.y1 + bb.y2) / 2;
      angC.forEach((ang, id) => {
        const r = radiusAt.get(depthOf.get(id)) || 0;
        const t = ang - Math.PI / 2;
        cy.getElementById(id).position({ x: cx0 + r * Math.cos(t), y: cy0 + r * Math.sin(t) });
      });

      // Área "sin child": aislados + no alcanzados (ciclos) → UNA línea horizontal centrada.
      const unreached = realNodes.map(n => n.id()).filter(id => !depthOf.has(id) && !isolated.includes(id));
      const bottom = isolated.concat(unreached);
      if (bottom.length) {
        const outer = (radiusAt.get(maxDepth) || 0) + (maxRadAt.get(maxDepth) || 40);
        let rowW = -GAP; bottom.forEach(id => { rowW += 2 * radOf(id) + GAP; });
        const y = cy0 + outer + 80;
        let x = cx0 - rowW / 2;
        bottom.forEach(id => { const w = 2 * radOf(id); cy.getElementById(id).position({ x: x + w / 2, y }); x += w + GAP; });
      }

      _finish();
      return;
    }

    if (mode === 'compare') {
      // ── VALUE-COMPARE (bosque por fórmula) ───────────────────────────────────
      //  · Los COLECTORES MAYORES del modelo (roots con hijos, detectados vía PARENT) van
      //    clavados en el EJE HORIZONTAL (y=0), ordenados por VALOR del período → mayor a la
      //    IZQUIERDA, menor a la derecha. El parent SÓLO sirve para identificarlos.
      //  · El resto de los nodos NO cuelga por parent: se acomoda como BOSQUE POR FÓRMULA con
      //    un layout force-directed (spring-electrical) donde cada formula-edge es un resorte y
      //    hay repulsión entre todos. Así cada nodo gravita hacia los que lo unen por fórmula y,
      //    si lo unen varios, queda en el PUNTO INTERMEDIO (centroide de equilibrio). Los
      //    colectores son anclas fijas que tiran de sus dependientes.
      //  · Pasada final de de-colisión por footprint+LABEL (AABB) → CERO solapes de nodo ni label.
      //  · Nodos SIN ninguna fórmula (sólo parent) → columna vertical a la izquierda (mayor arriba).
      //  · Se entrega con formula edges ON y parent/concept OFF (vista de comparación).
      const GAP    = 15;
      const L      = 170;          // largo ideal del resorte (formula edge), en unidades de modelo
      const period = window.CURRENT_PERIOD || 1;
      const vmap   = window.VALUES_DATA    || {};
      const valOf  = (id) => {
        const v = vmap[`${id}_${period}`]?.value;
        const n = typeof v === 'number' ? v : parseFloat(v);
        return isFinite(n) ? n : -Infinity;   // sin valor → al final del orden
      };

      // PARENT sólo para detectar colectores (= roots con hijos). No ordena a los hijos.
      const childrenOf = new Map();
      realNodes.forEach(n => childrenOf.set(n.id(), []));
      parentEdges.forEach(e => { const c = e.source().id(), p = e.target().id(); if (childrenOf.has(p)) childrenOf.get(p).push(c); });
      const hasParent = new Set();
      parentEdges.forEach(e => hasParent.add(e.source().id()));
      const allRoots     = realNodes.filter(n => !hasParent.has(n.id())).map(n => n.id());
      const collectors   = allRoots.filter(id => (childrenOf.get(id) || []).length > 0);
      const collectorSet = new Set(collectors);

      const radOf = (id) => {
        const n = cy.getElementById(id); let w = n.width(), h = n.height();
        if (!isFinite(w)) w = 80; if (!isFinite(h)) h = 80;
        return Math.max(w, h) / 2;
      };
      // Medio-footprint INCLUYENDO el label (overlay HTML; a zoom 1 sus offsets están en unidades
      // de modelo). hw/hh = medio ancho/alto → la separación cuenta el ancho real del label.
      const labelHalf = (id) => {
        const r = radOf(id);
        const el = NODE_LABELS[id];
        if (!el) return { hw: r, hh: r };
        const w = el.offsetWidth || 0, h = el.offsetHeight || 0;
        return { hw: Math.max(r, w / 2), hh: Math.max(r, h / 2) };
      };

      // Adyacencia por FÓRMULA (no dirigida) entre nodos visibles. Aunque los formula-edges estén
      // ocultos ahora, la relación lógica vale para armar el bosque.
      const idset = new Set(realNodes.map(n => n.id()));
      const adj = new Map(); realNodes.forEach(n => adj.set(n.id(), new Set()));
      cy.edges().forEach(e => {
        if (e.data('type') !== 'formula') return;
        const a = e.source().id(), b = e.target().id();
        if (a === b || !idset.has(a) || !idset.has(b)) return;
        adj.get(a).add(b); adj.get(b).add(a);
      });

      // Libres = no-colectores CON al menos una fórmula. Huérfanos = no-colectores SIN fórmula.
      const freeNodes = [], orphans = [];
      realNodes.forEach(n => {
        const id = n.id();
        if (collectorSet.has(id)) return;
        (adj.get(id).size > 0 ? freeNodes : orphans).push(id);
      });

      const pos = new Map();   // id → {x,y}; se calcula en el Map y se vuelca a cy al final.

      // 1) Colectores anclados en y=0, x por valor desc (mayor IZQUIERDA). Separación =
      //    footprints+label+GAP, con un mínimo de 2L para que entre el bosque-puente.
      collectors.sort((a, b) => valOf(b) - valOf(a));
      let cxk = 0, prevHalf = 0;
      collectors.forEach((id, i) => {
        const half = labelHalf(id).hw;
        cxk = (i === 0) ? half : cxk + Math.max(prevHalf + half + GAP, 2 * L);
        pos.set(id, { x: cxk, y: 0 });
        prevHalf = half;
      });
      const rowCx = collectors.length
        ? (pos.get(collectors[0]).x + pos.get(collectors[collectors.length - 1]).x) / 2 : 0;

      // 2) Init de libres: centroide de sus vecinos ANCLADOS (+jitter); si ninguno, centro de la fila.
      freeNodes.forEach((id, i) => {
        let sx = 0, sy = 0, k = 0;
        adj.get(id).forEach(nb => { if (collectorSet.has(nb)) { const p = pos.get(nb); sx += p.x; sy += p.y; k++; } });
        const jx = (Math.random() - 0.5) * L;
        const jy = (i % 2 ? 1 : -1) * (L + Math.random() * L);   // arranca arriba/abajo del eje
        pos.set(id, k ? { x: sx / k + jx, y: jy } : { x: rowCx + jx, y: jy });
      });

      // 3) Force-directed: resortes en formula-edges + repulsión all-pairs + gravedad débil al
      //    centro de la fila. Colectores FIJOS. Cooling lineal.
      const sim   = collectors.concat(freeNodes);
      const inSim = new Set(sim);
      const REP   = L * L * 0.9;
      const ITERS = sim.length > 200 ? 150 : 300;
      // Aristas únicas entre nodos de la sim.
      const edges = [], seenE = new Set();
      sim.forEach(a => adj.get(a).forEach(b => {
        if (!inSim.has(b)) return;
        const key = a < b ? a + '|' + b : b + '|' + a;
        if (!seenE.has(key)) { seenE.add(key); edges.push([a, b]); }
      }));
      for (let it = 0; it < ITERS; it++) {
        const temp = Math.max(4, L * (1 - it / ITERS));
        const disp = new Map(); sim.forEach(id => disp.set(id, { x: 0, y: 0 }));
        // repulsión (todos contra todos)
        for (let i = 0; i < sim.length; i++) {
          for (let j = i + 1; j < sim.length; j++) {
            const pa = pos.get(sim[i]), pb = pos.get(sim[j]);
            let dx = pa.x - pb.x, dy = pa.y - pb.y, d2 = dx * dx + dy * dy;
            if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = dx * dx + dy * dy + 1; }
            const d = Math.sqrt(d2), f = REP / d2, ux = dx / d, uy = dy / d;
            const di = disp.get(sim[i]), dj = disp.get(sim[j]);
            di.x += ux * f; di.y += uy * f; dj.x -= ux * f; dj.y -= uy * f;
          }
        }
        // atracción (resortes de fórmula)
        edges.forEach(([a, b]) => {
          const pa = pos.get(a), pb = pos.get(b);
          let dx = pb.x - pa.x, dy = pb.y - pa.y, d = Math.hypot(dx, dy) || 1;
          const f = (d - L) * 0.06, ux = dx / d, uy = dy / d;
          const da = disp.get(a), db = disp.get(b);
          da.x += ux * f; da.y += uy * f; db.x -= ux * f; db.y -= uy * f;
        });
        // aplicar SÓLO a libres (colectores fijos); gravedad débil hacia (rowCx, 0).
        freeNodes.forEach(id => {
          const p = pos.get(id), dp = disp.get(id);
          dp.x += (rowCx - p.x) * 0.006; dp.y += (0 - p.y) * 0.006;
          const dl = Math.hypot(dp.x, dp.y) || 1, s = Math.min(dl, temp) / dl;
          p.x += dp.x * s; p.y += dp.y * s;
        });
      }

      // 4) De-colisión final por footprint+label (AABB). Colectores fijos; entre dos libres se
      //    reparte el empuje. Garantiza CERO solapes de nodo y de label.
      const halfOf = new Map(); sim.forEach(id => halfOf.set(id, labelHalf(id)));
      for (let pass = 0; pass < 80; pass++) {
        let moved = false;
        for (let i = 0; i < sim.length; i++) {
          for (let j = i + 1; j < sim.length; j++) {
            const ia = sim[i], ib = sim[j];
            const pa = pos.get(ia), pb = pos.get(ib), ha = halfOf.get(ia), hb = halfOf.get(ib);
            const dx = pb.x - pa.x, dy = pb.y - pa.y;
            const ox = ha.hw + hb.hw + GAP - Math.abs(dx);
            const oy = ha.hh + hb.hh + GAP - Math.abs(dy);
            if (ox <= 0 || oy <= 0) continue;          // no se tocan
            const aFix = collectorSet.has(ia), bFix = collectorSet.has(ib);
            if (aFix && bFix) continue;                // ambos anclados → ya pre-separados
            moved = true;
            if (ox < oy) {                             // empujar por el eje de menor solape
              const push = (dx < 0 ? -1 : 1) * ox;
              if (aFix)      pb.x += push;
              else if (bFix) pa.x -= push;
              else { pa.x -= push / 2; pb.x += push / 2; }
            } else {
              const push = (dy < 0 ? -1 : 1) * oy;
              if (aFix)      pb.y += push;
              else if (bFix) pa.y -= push;
              else { pa.y -= push / 2; pb.y += push / 2; }
            }
          }
        }
        if (!moved) break;
      }

      // 5) Volcar la sim a cy.
      sim.forEach(id => cy.getElementById(id).position(pos.get(id)));

      // 6) Huérfanos (sin fórmula) → columna vertical a la IZQUIERDA de todo, mayor arriba,
      //    15px entre footprints (alto de label incluido).
      if (orphans.length) {
        let minX = Infinity;
        sim.forEach(id => { minX = Math.min(minX, pos.get(id).x - halfOf.get(id).hw); });
        if (!isFinite(minX)) minX = 0;
        orphans.sort((a, b) => valOf(b) - valOf(a));
        const maxHalfW = Math.max(...orphans.map(id => labelHalf(id).hw));
        const colX = minX - 60 - maxHalfW;
        let colH = -GAP; orphans.forEach(id => { colH += 2 * labelHalf(id).hh + GAP; });
        let y = -colH / 2;
        orphans.forEach(id => { const hh = labelHalf(id).hh; cy.getElementById(id).position({ x: colX, y: y + hh }); y += 2 * hh + GAP; });
      }

      // Vista de comparación: formula ON, parent/concept OFF.
      window.SHOW_FORMULA_LINKS = true;
      window.SHOW_PARENT_LINKS  = false;
      window.SHOW_CONCEPT_LINKS = false;
      window.updateLinkVisibility?.();

      _finish();
      return;
    }

    // ── GRID: cada árbol = una celda con su root-origen AL CENTRO (radial por niveles),
    // empaquetadas en grilla (shelf packing). Los nodos SIN HIJOS (aislados) → una sola
    // línea horizontal abajo, centrada. Determinístico, compacto, sin cuelgues.
    const GAP = 80;
    const childrenOf = new Map();
    realNodes.forEach(n => childrenOf.set(n.id(), []));
    parentEdges.forEach(e => { const c = e.source().id(), p = e.target().id(); if (childrenOf.has(p)) childrenOf.get(p).push(c); });
    const hasParent = new Set();
    parentEdges.forEach(e => hasParent.add(e.source().id()));
    const allRoots  = realNodes.filter(n => !hasParent.has(n.id())).map(n => n.id());
    const isolated  = allRoots.filter(id => (childrenOf.get(id) || []).length === 0);
    const treeRoots = allRoots.filter(id => (childrenOf.get(id) || []).length  >  0);

    const radOf = (id) => {
      const n = cy.getElementById(id); let w = n.width(), h = n.height();
      if (!isFinite(w)) w = 80; if (!isFinite(h)) h = 80;
      return Math.max(w, h) / 2;
    };

    // Coloca un árbol con root en (ox,oy): cada nivel en un anillo concéntrico.
    const placeTree = (rootId, ox, oy) => {
      cy.getElementById(rootId).position({ x: ox, y: oy });
      let level = [rootId];
      const seen = new Set([rootId]);
      let depth = 0;
      while (true) {
        const next = [];
        level.forEach(id => (childrenOf.get(id) || []).forEach(c => { if (!seen.has(c)) { seen.add(c); next.push(c); } }));
        if (!next.length) break;
        depth++;
        const R = Math.max(depth * 150, (next.length * 95) / (2 * Math.PI));
        next.forEach((c, i) => {
          const a = (i / next.length) * 2 * Math.PI - Math.PI / 2;
          cy.getElementById(c).position({ x: ox + R * Math.cos(a), y: oy + R * Math.sin(a) });
        });
        level = next;
      }
    };

    // Cada árbol al origen; medir su bounding box (root queda al centro de su celda).
    const comps = treeRoots.map(r => {
      placeTree(r, 0, 0);
      const ns = []; const seen = new Set(); const stack = [r];
      while (stack.length) { const x = stack.pop(); if (seen.has(x)) continue; seen.add(x); ns.push(x); (childrenOf.get(x) || []).forEach(c => stack.push(c)); }
      let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
      ns.forEach(id => { const p = cy.getElementById(id).position(), rr = radOf(id); x1 = Math.min(x1, p.x - rr); y1 = Math.min(y1, p.y - rr); x2 = Math.max(x2, p.x + rr); y2 = Math.max(y2, p.y + rr); });
      return { ns, x1, y1, w: x2 - x1, h: y2 - y1 };
    });

    // Shelf packing: filas con ancho objetivo ~ raíz del área; alto desc primero.
    const area = comps.reduce((s, b) => s + (b.w + GAP) * (b.h + GAP), 0);
    const targetW = Math.sqrt(area) * 1.3;
    comps.sort((a, b) => b.h - a.h);
    let curX = 0, curY = 0, rowH = 0;
    comps.forEach(b => {
      if (curX > 0 && curX + b.w > targetW) { curX = 0; curY += rowH + GAP; rowH = 0; }
      const dx = curX - b.x1, dy = curY - b.y1;
      b.ns.forEach(id => { const p = cy.getElementById(id).position(); cy.getElementById(id).position({ x: p.x + dx, y: p.y + dy }); });
      curX += b.w + GAP; rowH = Math.max(rowH, b.h);
    });

    // Bounding box de la grilla (para centrar y ubicar la línea de aislados).
    let gX1 = Infinity, gX2 = -Infinity, gY2 = -Infinity;
    comps.forEach(b => b.ns.forEach(id => { const p = cy.getElementById(id).position(), rr = radOf(id); gX1 = Math.min(gX1, p.x - rr); gX2 = Math.max(gX2, p.x + rr); gY2 = Math.max(gY2, p.y + rr); }));
    const cx = isFinite(gX1) ? (gX1 + gX2) / 2 : 0;

    // Aislados → una sola línea horizontal centrada, debajo de la grilla.
    if (isolated.length) {
      let rowW = -GAP; isolated.forEach(id => { rowW += 2 * radOf(id) + GAP; });
      const y = (isFinite(gY2) ? gY2 : 0) + 120;
      let x = cx - rowW / 2;
      isolated.forEach(id => { const w = 2 * radOf(id); cy.getElementById(id).position({ x: x + w / 2, y }); x += w + GAP; });
    }

    _finish();
    return;
  };

  /////////////////////////////////////////////////////////
  // INTERACTIONS
  /////////////////////////////////////////////////////////

  setupGraphEvents(cy, {
    NODE_LABELS,
    expandEdge,
    collapseEdge,
    saveWorkspace,
    createNodeBadges,
    removeNodeBadges,
    openFieldEditor,
    openUnitSelector,
    renderNodeLabels,
    toggleConceptFilter
  });

  /////////////////////////////////////////////////////////
  // RENDER LOOP (chips + labels)
  /////////////////////////////////////////////////////////

  let rafPending = false;

  function updateFloatingUI() {

    updateAllChips();

    updateNodeLabelPositions(cy);

    updateBadgePositions(cy);

    if (
      window.STYLE_PANEL &&
      window.STYLE_PANEL.anchorEl
    ) {

      updateNodeStylePanel(
        window.STYLE_PANEL.anchorEl
      );

    }

  }

  // Zoom de rueda PROPIO, throttled a un rAF (un cy.zoom por frame → no se clava) y con
  // paso multiplicativo fijo → chico y PAREJO en todo el rango, centrado en el cursor.
  // cy.zoom respeta minZoom/maxZoom → nunca llega al régimen degenerado (pantalla negra).
  const _cyContainer = cy.container();
  let _wheelAccum = 0, _wheelPos = null, _wheelRaf = null;
  _cyContainer.addEventListener('wheel', (e) => {
    e.preventDefault();
    _wheelAccum += e.deltaY;
    const r = _cyContainer.getBoundingClientRect();
    _wheelPos = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (_wheelRaf) return;
    _wheelRaf = requestAnimationFrame(() => {
      _wheelRaf = null;
      let factor = Math.exp(-_wheelAccum * 0.0004);          // coef. chico = pasos finos (½ del paso anterior)
      factor = Math.max(0.85, Math.min(1.18, factor));       // tope suave por frame (sin saltos)
      _wheelAccum = 0;
      cy.zoom({ level: cy.zoom() * factor, renderedPosition: _wheelPos });
    });
  }, { passive: false });

  // Durante pan/zoom mantenemos los labels VIVOS (continuidad visual). El costo se acota con
  // el culling de updateNodeLabelPositions (solo se reposicionan los del viewport) + throttle a
  // un rAF (un solo reposicionado por frame). Un settle final asegura el estado correcto al soltar.
  // (NO usa textureOnViewport — eso daba pantalla negra.)
  let _vpRaf = null;
  const _settleViewport = debounce(() => { updateFloatingUI(); }, 90);

  cy.on('pan zoom', () => {

    closeNodeStylePanel();
    window.closeNodeRelationsPanel?.();
    window.closeNodeCommentsPanel?.();
    window.closeNodeCopyPanel?.();

    if (!_vpRaf) {
      _vpRaf = requestAnimationFrame(() => {
        _vpRaf = null;
        updateNodeLabelPositions(cy);
        updateBadgePositions(cy);
      });
    }
    _settleViewport();

  });

  cy.on('grab drag position', 'node', (e) => {
    if (e.target.data('isChip') || e.target.data('isConceptHub')) return;
    closeNodeStylePanel();
    window.closeNodeRelationsPanel?.();
    window.closeNodeCommentsPanel?.();
    window.closeNodeCopyPanel?.();
    requestAnimationFrame(() => {
      updateFloatingUI();
    });
  });


  /////////////////////////////////////////////////////////
  // WORKSPACE
  /////////////////////////////////////////////////////////

  const debouncedSave = debounce(saveWorkspace, 400);

  cy.on('pan zoom', debouncedSave);


  let _preDragPositions = null;

  cy.on('grab', 'node', e => {
    if (e.target.data('isChip') || e.target.data('isConceptHub')) return;
    _preDragPositions = {};
    cy.nodes().not('[isChip],[isConceptHub]').forEach(n => {
      _preDragPositions[n.id()] = { ...n.position() };
    });
  });

  cy.on('dragfree', 'node', (e) => {
    if (e.target.data('isChip') || e.target.data('isConceptHub')) return;

    const positions = {};
    cy.nodes().not('[isChip],[isConceptHub]').forEach(n => {
      positions[n.id()] = n.position();
    });

    if (typeof setState === 'function') {
      const current = getState();
      setState({ ...current, positions });
    }

    if (typeof window.queuePositions === 'function') {
      window.queuePositions(positions);
    }

    const saved = _preDragPositions;
    _preDragPositions = null;
    if (saved) {
      window.pushUndo?.(async () => {
        cy.nodes().not('[isChip],[isConceptHub]').forEach(n => {
          if (saved[n.id()]) n.position(saved[n.id()]);
        });
        window.queuePositions?.(saved);
      });
    }
  });

  /////////////////////////////////////////////////////////
  // LABELS INIT
  /////////////////////////////////////////////////////////

  cy.on('add', 'node[isConceptHub],node[isChip]', (e) => {
    e.target.ungrabify();
  });

  cy.ready(() => {
    renderNodeLabels(cy);
    updateNodeLabelPositions(cy);
    applyWorkspace(graphData.workspace);
    _createAllHubs();
    updateAllChips();
    if (window.CONCEPTS_MODE !== 'none') cy.style().update();
    hideLoader();
    window.refreshFormulaEdges?.();
    window.markFormulaCycles?.();
    if (window.USER_ROLE === 'reader') cy.autoungrabify(true);
  });

}

/////////////////////////////////////////////////////////
// EDGE INTERACTION
/////////////////////////////////////////////////////////
function removeConnection(edgeId) {
  const edge = cy.getElementById(edgeId);
  if (!edge || edge.empty()) return;

  const data = edge.data();

  // 🔥 1. limpiar chips asociados
  cy.nodes()
    .filter(n => n.data('parentEdge') === edgeId)
    .forEach(n => {
      n.animate({
        style: { opacity: 0 },
        duration: 150
      });

  setTimeout(() => n.remove(), 150);
});

  // 🔥 2. actualizar estado visual
  if (ACTIVE_EDGE && ACTIVE_EDGE.id() === edgeId) {
    ACTIVE_EDGE = null;
  }

  // 🔥 3. actualizar fórmulas (stub por ahora)
  updateFormulasAfterRemoval(data);

  // 🔥 4. eliminar edge del grafo
  edge.remove();
}




/////////////////////////////////////////////////////////
// EXPAND EDGE → CREATE CHIPS
/////////////////////////////////////////////////////////

function expandEdge(edge) {

  const concepts = edge.data('concepts') || [];
  if (!concepts.length) return;

  edge.data('expanded', true);

  const center = getEdgeCenter(edge);
  if (!center) return;
  const spacing = 10;

  cy.nodes().filter(n => n.data('parentEdge') === edge.id() && n.data('isChip')).remove();

  concepts.forEach((c, i) => {

    cy.add({
      group: 'nodes',
      data: {
        id: `chip_${edge.id()}_${i}`,
        parentEdge: edge.id(),
        conceptId: c.id,
        index: i,
        label: c.name,
        color: c.color || '#888',
        isChip: true
      },
      position: {
        x: center.x,
        y: center.y - ((i + 1) * spacing)
      }
    });

  });

  const hub = cy.getElementById(`hub_${edge.id()}`);
  if (hub.length) hub.data('label', '+');

  if (typeof setState === "function") {

  const current = getState();

  const expanded = current.workspace?.expandedEdges || [];

  setState({
    ...current,
    workspace: {
      ...current.workspace,
      expandedEdges: [...new Set([...expanded, edge.id()])]
    }
  });

  }
}

/////////////////////////////////////////////////////////
// COLLAPSE EDGE
/////////////////////////////////////////////////////////

function collapseEdge(edge) {

  cy.nodes()
    .filter(n => n.data('parentEdge') === edge.id() && n.data('isChip'))
    .forEach(n => n.remove());

  edge.data('expanded', false);

  const count = edge.data('concepts')?.length || 0;
  const hub = cy.getElementById(`hub_${edge.id()}`);
  if (hub.length) hub.data('label', count > 0 ? String(count) : '+');

  if (typeof setState === "function") {

  const current = getState();

  const expanded = current.workspace?.expandedEdges || [];

  setState({
    ...current,
    workspace: {
      ...current.workspace,
      expandedEdges: expanded.filter(id => id !== edge.id())
    }
  });

  }
}

window.expandEdge   = expandEdge;
window.collapseEdge = collapseEdge;
window.saveWorkspace = saveWorkspace;

/////////////////////////////////////////////////////////
// CONCEPT HUB — creados una sola vez en cy.ready()
// Visibilidad controlada por estilo + cy.style().update()
/////////////////////////////////////////////////////////

function _createAllHubs() {
  cy.edges().forEach(edge => {
    if (cy.getElementById(`hub_${edge.id()}`).length) return;
    const count = (edge.data('concepts') || []).length;
    const center = getEdgeCenter(edge);
    cy.add({
      group: 'nodes',
      data: {
        id: `hub_${edge.id()}`,
        parentEdge: edge.id(),
        label: count > 0 ? String(count) : '+',
        isConceptHub: true
      },
      position: center || { x: 0, y: 0 }
    });
  });
}

window.refreshConceptHubs = _createAllHubs;

// Marca con borde rojo los nodos que forman ciclo de dependencia (window.FORMULA_CYCLES)
window.markFormulaCycles = function() {
  if (!cy) return;
  const cycles  = window.FORMULA_CYCLES || new Set();
  const preview = window.FORMULA_CYCLE_PREVIEW || null;
  cy.nodes().not('[isChip],[isConceptHub]').forEach(n => {
    const id = n.id();
    const on = cycles.has(id) || (preview ? preview.has(id) : false);
    if (!!n.data('formula_cycle') !== on) n.data('formula_cycle', on);
  });
  cy.style().update();
};

window.refreshFormulaEdges = function() {
  if (!cy) return;
  cy.edges('[type="formula"]').remove();
  const vd  = window.VALUES_DATA || {};
  const edgeMap = new Map();
  Object.values(vd).forEach(v => {
    if (!v.formula) return;
    for (const m of v.formula.matchAll(/node:([a-f0-9-]{36})\[/g)) {
      const src = m[1], tgt = v.node_id;
      if (src === tgt) continue;
      const key = `${src}_${tgt}`;
      if (!edgeMap.has(key)) edgeMap.set(key, { src, tgt });
    }
  });
  edgeMap.forEach(({ src, tgt }, key) => {
    if (cy.getElementById(src).length && cy.getElementById(tgt).length) {
      cy.add({ group: 'edges', data: {
        id: `formula_${key}`, source: src, target: tgt,
        type: 'formula', concepts: [], conceptLabel: ''
      }});
    }
  });
  window.refreshConceptHubs?.();
  cy.style().update();
};

window.applyConceptsMode = function(mode) {
  window.CONCEPTS_MODE = mode;
  window.ACTIVE_CONCEPT_EDGES = new Set();
  window.ACTIVE_EDGE = null;
  if (!cy) return;

  cy.nodes('[isChip]').remove();
  cy.edges().forEach(e => {
    e.data('expanded', false);
    const hub = cy.getElementById(`hub_${e.id()}`);
    if (hub.length) {
      const count = (e.data('concepts') || []).length;
      hub.data('label', count > 0 ? String(count) : '+');
    }
  });

  if (typeof window.closeConceptPanel === 'function') window.closeConceptPanel();

  if (mode === 'all') {
    cy.edges().forEach(edge => {
      if ((edge.data('concepts') || []).length > 0) expandEdge(edge);
    });
  }

  cy.style().update();
};

window.showConceptHubsForSelection = function(cyElement) {
  if (window.CONCEPTS_MODE === 'none') {
    cy.style().update();
    return;
  }

  if (window.CONCEPTS_MODE === 'all') {
    // En modo all: solo actualizar estilos (chips y hubs ya están en el estado correcto)
    cy.style().update();
    return;
  }

  // Modo active: colapsar chips anteriores y recalcular
  cy.nodes('[isChip]').remove();
  cy.edges().forEach(e => {
    if (e.data('expanded')) {
      e.data('expanded', false);
      const hub = cy.getElementById(`hub_${e.id()}`);
      if (hub.length) {
        const count = (e.data('concepts') || []).length;
        hub.data('label', count > 0 ? String(count) : '+');
      }
    }
  });

  window.ACTIVE_CONCEPT_EDGES = new Set();

  if (cyElement && cyElement.isNode && cyElement.isNode()) {
    cy.edges().filter(e =>
      e.source().id() === cyElement.id() || e.target().id() === cyElement.id()
    ).forEach(e => {
      window.ACTIVE_CONCEPT_EDGES.add(e.id());
      if ((e.data('concepts') || []).length > 0) expandEdge(e);
    });
  } else if (cyElement && cyElement.isEdge && cyElement.isEdge()) {
    window.ACTIVE_CONCEPT_EDGES.add(cyElement.id());
  }

  cy.style().update();
};

/////////////////////////////////////////////////////////
// UPDATE CHIP POSITIONS
/////////////////////////////////////////////////////////

function updateAllChips() {
  if (_updatingChips) return;
  _updatingChips = true;
  try {
    cy.nodes('[isChip]').forEach(chip => {
      const edge = cy.getElementById(chip.data('parentEdge'));
      if (!edge || edge.empty()) return;
      const center = getEdgeCenter(edge);
      if (!center) return;
      const index = chip.data('index');
      chip.position({
        x: center.x,
        y: center.y - ((index + 1) * 10)
      });
    });

    cy.nodes('[isConceptHub]').forEach(hub => {
      const edge = cy.getElementById(hub.data('parentEdge'));
      if (!edge || edge.empty()) return;
      const center = getEdgeCenter(edge);
      if (center) hub.position(center);
    });
  } finally {
    _updatingChips = false;
  }
}

/////////////////////////////////////////////////////////
// GEOMETRY
/////////////////////////////////////////////////////////

function getEdgeCenter(edge) {
  const p = edge.midpoint();
  if (!p || isNaN(p.x)) return null;
  return { x: p.x, y: p.y };
}

/////////////////////////////////////////////////////////
// CONCEPT HUB — apariencia (activo vs pasivo)
/////////////////////////////////////////////////////////

// Un hub está "activo" (círculo gris, '+', chips) cuando su edge está seleccionado:
//  · edge tapeado directamente (window.ACTIVE_EDGE), en cualquier modo.
//  · en modo 'active', los edges del nodo seleccionado (ACTIVE_CONCEPT_EDGES).
function _isHubActive(edgeId) {
  if (window.ACTIVE_EDGE && window.ACTIVE_EDGE.id() === edgeId) return true;
  if (window.CONCEPTS_MODE === 'active'
      && window.ACTIVE_CONCEPT_EDGES
      && window.ACTIVE_CONCEPT_EDGES.has(edgeId)) return true;
  return false;
}

// Color del punto/círculo pasivo = color del edge según su tipo.
function _hubEdgeColor(pEdge) {
  const t = pEdge.data('type');
  if (t === 'parent') return '#a2c1cf';
  if (t === 'manual') return '#f7acac';
  return getEdgeColor(); // formula + default
}

/////////////////////////////////////////////////////////
// CONCEPT FILTER
/////////////////////////////////////////////////////////

let ACTIVE_CONCEPT = null;

function toggleConceptFilter(conceptId, chip) {

  if (ACTIVE_CONCEPT === conceptId) {
    clearConceptFilter();
    return;
  }

  ACTIVE_CONCEPT = conceptId;
  window.ACTIVE_CONCEPT_COLOR = chip ? chip.data('color') : null;

  cy.nodes().removeClass('concept-related');

  cy.edges().forEach(edge => {
    const concepts = edge.data('concepts') || [];
    const match = concepts.some(c => c.id === conceptId);
    edge.toggleClass('highlighted', match);
    if (match) {
      edge.source().addClass('concept-related');
      edge.target().addClass('concept-related');
    }
  });

  cy.nodes('[isChip]').removeClass('active');
  if (chip) chip.addClass('active');

  // Resto del modelo al 50% de su opacidad; nodos/links con el concepto, full.
  window.refreshDimming();
}

function clearConceptFilter() {

  ACTIVE_CONCEPT = null;
  window.ACTIVE_CONCEPT_COLOR = null;

  cy.edges().removeClass('highlighted');
  cy.nodes().removeClass('concept-related');
  cy.nodes('[isChip]').removeClass('active');

  // Vuelve al dimming que corresponda (grupo / nodo seleccionado / ninguno).
  window.refreshDimming();
}

window.clearConceptFilter = clearConceptFilter;

/////////////////////////////////////////////////////////
// DIMMING — "el resto del modelo al 50% de su opacidad definida"
// Un único estado activo a la vez, con prioridad:
//   filtro de concepto  >  highlight de grupo  >  nodo seleccionado.
// Cada disparador actualiza su global y llama refreshDimming().
/////////////////////////////////////////////////////////

window.DIM_ACTIVE = false;

// Opacidad de un chip/hub atenuado = mitad de la que tendría (0.35 si su edge es hidden, si no 1).
function _dimChipOpacity(ele) {
  const pe = ele.cy().getElementById(ele.data('parentEdge'));
  const hidden = pe.length && (pe.source().data('hidden') || pe.target().data('hidden'));
  return (hidden ? 0.35 : 1) * window.DIM_FACTOR;
}

function _applyDimming(nodeSet, edgeSet) {
  cy.batch(() => {
    cy.nodes().not('[isChip],[isConceptHub]').forEach(n =>
      n.toggleClass('dim', !nodeSet.has(n.id())));
    cy.edges().forEach(e =>
      e.toggleClass('dim', !edgeSet.has(e.id())));
    // Chips y hubs siguen a su edge: full si el edge está en el set activo.
    cy.nodes('[isChip],[isConceptHub]').forEach(h =>
      h.toggleClass('dim', !edgeSet.has(h.data('parentEdge'))));
  });
  window.DIM_ACTIVE = true;
  cy.style().update();
  renderNodeLabels(cy);
}

function _clearDimming() {
  if (cy.elements('.dim').length) cy.elements('.dim').removeClass('dim');
  window.DIM_ACTIVE = false;
  cy.style().update();
  renderNodeLabels(cy);
}

// Recalcula el dimming a partir del estado global actual.
window.refreshDimming = function() {
  if (!cy) return;

  // 1) Filtro de concepto (chip de un edge tapeado)
  if (ACTIVE_CONCEPT) {
    const aN = new Set(), aE = new Set();
    cy.edges().forEach(e => {
      if ((e.data('concepts') || []).some(c => c.id === ACTIVE_CONCEPT)) {
        aE.add(e.id());
        aN.add(e.source().id());
        aN.add(e.target().id());
      }
    });
    _applyDimming(aN, aE);
    return;
  }

  // 2) Highlight de grupo
  if (window.HIGHLIGHTED_GROUP_ID) {
    const gid = window.HIGHLIGHTED_GROUP_ID;
    const aN = new Set(), aE = new Set();
    cy.nodes().not('[isChip],[isConceptHub]').forEach(n => {
      const gs = n.data('groups');
      if (Array.isArray(gs) && gs.some(g => g.id === gid)) aN.add(n.id());
    });
    // Links entre dos nodos del grupo también quedan full.
    cy.edges().forEach(e => {
      if (aN.has(e.source().id()) && aN.has(e.target().id())) aE.add(e.id());
    });
    _applyDimming(aN, aE);
    return;
  }

  // 3) Nodo seleccionado para editar
  if (window.ACTIVE_NODE_ID) {
    const n = cy.getElementById(window.ACTIVE_NODE_ID);
    if (n && n.length && !n.data('isChip') && !n.data('isConceptHub')) {
      const aN = new Set([n.id()]);
      const aE = new Set(n.connectedEdges().map(e => e.id()));
      _applyDimming(aN, aE);
      return;
    }
  }

  // 4) Nada activo → sin atenuación
  _clearDimming();
};

/////////////////////////////////////////////////////////
// WORKSPACE
/////////////////////////////////////////////////////////

function saveWorkspace() {
  const expandedEdges = [];
  cy.edges().forEach(edge => {
    if (edge.data('expanded')) expandedEdges.push(edge.id());
  });

  const ws = { zoom: cy.zoom(), pan: cy.pan(), expandedEdges, conceptsMode: window.CONCEPTS_MODE || 'none' };

  if (typeof setState === 'function') {
    const current = getState();
    setState({ ...current, workspace: ws });
  }

  if (typeof window.queueWorkspace === 'function') {
    window.queueWorkspace(ws);
  }
}

function applyWorkspace(workspace) {

  if (!workspace) return;

  if (workspace.conceptsMode) window.CONCEPTS_MODE = workspace.conceptsMode;
  if (workspace.zoom) cy.zoom(workspace.zoom);
  if (workspace.pan) cy.pan(workspace.pan);

  workspace.expandedEdges?.forEach(id => {
    const edge = cy.getElementById(id);
    if (edge.length) expandEdge(edge);
  });
}

/////////////////////////////////////////////////////////
// LAYOUT (custom) — snapshot completo de la disposición:
// posiciones de TODOS los nodos + filtro de visibilidad + workspace
// (zoom/pan/expandedEdges/conceptsMode). Se guarda en la tabla `layouts`.
// captureLayout() produce el objeto; applyLayout() lo restaura.
/////////////////////////////////////////////////////////

const _FILTER_FACETS = ['group', 'unit', 'concept', 'parent', 'name'];

function _serializeFilter() {
  const F = window.NODE_FILTER || {};
  const out = {};
  _FILTER_FACETS.forEach(k => {
    const f = F[k];
    out[k] = { mode: f?.mode || 'all', ids: [...(f?.ids || [])] };
  });
  return out;
}

function _restoreFilter(filter) {
  if (!filter) return;
  const F = window.NODE_FILTER || (window.NODE_FILTER = {});
  _FILTER_FACETS.forEach(k => {
    const sf = filter[k];
    F[k] = sf
      ? { mode: sf.mode || 'all', ids: new Set(sf.ids || []) }
      : { mode: 'all', ids: new Set() };
  });
}

window.captureLayout = function () {
  if (!cy) return null;
  const realNodes = cy.nodes().not('[isChip],[isConceptHub]');
  const positions = {};
  realNodes.forEach(n => { positions[n.id()] = { ...n.position() }; });

  const expandedEdges = [];
  cy.edges().forEach(e => { if (e.data('expanded')) expandedEdges.push(e.id()); });

  return {
    positions,
    filter: _serializeFilter(),
    workspace: {
      zoom: cy.zoom(),
      pan: { ...cy.pan() },
      expandedEdges,
      conceptsMode: window.CONCEPTS_MODE || 'none',
    },
  };
};

window.applyLayout = function (data) {
  if (!cy || !data) return;
  const isReader = window.USER_ROLE === 'reader';

  const realNodes = cy.nodes().not('[isChip],[isConceptHub]');

  // Snapshot previo para undo (posiciones + filtro).
  const savedPos    = {};
  realNodes.forEach(n => { savedPos[n.id()] = { ...n.position() }; });
  const savedFilter = _serializeFilter();

  const _refreshOverlays = () => {
    window.refreshConceptHubs?.();
    if (typeof window.updateBadgePositions === 'function') window.updateBadgePositions();
    renderNodeLabels(cy);
  };

  // 1. Posiciones.
  if (data.positions) {
    Object.entries(data.positions).forEach(([id, p]) => {
      const n = cy.getElementById(id);
      if (n && n.length && !n.data('isChip') && !n.data('isConceptHub')) n.position({ x: p.x, y: p.y });
    });
  }

  // 2. Filtro de visibilidad.
  if (data.filter) {
    _restoreFilter(data.filter);
    window.applyNodeFilter?.();
  }

  // 3. Persistir posiciones (salvo reader → solo vista).
  const positions = {};
  realNodes.forEach(n => { positions[n.id()] = { ...n.position() }; });
  if (typeof setState === 'function') { const cur = getState(); setState({ ...cur, positions }); }
  if (!isReader) window.queuePositions?.(positions);

  // 4. Workspace (zoom/pan/conceptsMode/expandedEdges) → restaura el encuadre exacto.
  if (data.workspace) {
    applyWorkspace(data.workspace);
    if (!isReader) saveWorkspace();
  }

  _refreshOverlays();

  // 5. Undo: vuelve a posiciones + filtro previos.
  window.pushUndo?.(async () => {
    realNodes.forEach(n => { if (savedPos[n.id()]) n.position(savedPos[n.id()]); });
    _restoreFilter(savedFilter);
    window.applyNodeFilter?.();
    if (!isReader) window.queuePositions?.(savedPos);
    if (typeof setState === 'function') { const cur = getState(); setState({ ...cur, positions: savedPos }); }
    _refreshOverlays();
  });
};

/////////////////////////////////////////////////////////
// UTIL
/////////////////////////////////////////////////////////

function debounce(fn, delay) {
  let t;
  return function () {
    clearTimeout(t);
    t = setTimeout(fn, delay);
  };
}





window.getContrastColor = function(hex) {
  if (!hex) return '#111';

  const c = hex.replace('#', '');
  const r = parseInt(c.substr(0, 2), 16);
  const g = parseInt(c.substr(2, 2), 16);
  const b = parseInt(c.substr(4, 2), 16);

  const luminance = (0.299*r + 0.587*g + 0.114*b) / 255;

  return luminance > 0.6? '#111' : '#fff';
}

// Ancho de un chip de concepto = ancho del texto medido + padding horizontal
// a cada lado. Cytoscape sólo ofrece 'padding' uniforme (sumaría alto y chocaría
// con el círculo del hub), así que el alto sigue al label y el ancho se calcula acá.
const CHIP_PAD_X = 2;   // px de padding a cada lado
let _chipMeasureCtx = null;
function _chipWidth(label) {
  if (!_chipMeasureCtx) _chipMeasureCtx = document.createElement('canvas').getContext('2d');
  _chipMeasureCtx.font = '6px Helvetica, Arial, sans-serif';
  return Math.ceil(_chipMeasureCtx.measureText(label || '').width) + CHIP_PAD_X * 2;
}

document.getElementById("model-name").addEventListener("change", async (e) => {
  const name = e.target.value.trim();
  if (!name || !window.MODEL_ID) return;
  try {
    const { error } = await window.supabaseClient
      .from('models').update({ name }).eq('id', window.MODEL_ID);
    if (error) throw error;
    if (window.MODEL_DATA)    window.MODEL_DATA.name    = name;
    if (window._currentModel) window._currentModel.name = name;
  } catch (err) { console.error('[model-name] save error:', err); }
});

function updateModelMeta(cfg) {

  const el = document.getElementById("model-meta");
  if (!el) return;

  const author = cfg.author || "unknown";
  const version = cfg.version || "v1";

  el.innerText = `by ${author} · ${version}`;
}

/////////////////////////////////////////////////////////
// CREATE NODE
/////////////////////////////////////////////////////////

function findFreePosition() {
  if (!cy) return { x: 0, y: 0 };

  const existingNodes = cy.nodes().not('[isChip],[isConceptHub]');

  // Centro = nodo activo; fallback: último nodo; fallback: centro del viewport
  const activeId  = window.ACTIVE_NODE_ID;
  const activeNode = activeId ? cy.getElementById(activeId) : null;
  const hasActive  = !!(activeNode && activeNode.length
    && !activeNode.data('isChip') && !activeNode.data('isConceptHub'));

  let center;
  if (hasActive) {
    center = activeNode.position();
  } else if (existingNodes.length > 0) {
    center = existingNodes[existingNodes.length - 1].position();
  } else {
    const ext = cy.extent();
    center = { x: (ext.x1 + ext.x2) / 2, y: (ext.y1 + ext.y2) / 2 };
  }

  const minFromActive = 30;  // proximidad mínima al nodo activo
  const minFromOthers = 80;  // separación mínima al resto (sin superposición visual)

  // Posiciones de todos los nodos excepto el activo
  const otherPositions = existingNodes
    .filter(n => !hasActive || n.id() !== activeId)
    .map(n => n.position());

  function collides(pos) {
    if (hasActive) {
      const dx = center.x - pos.x, dy = center.y - pos.y;
      if (Math.sqrt(dx * dx + dy * dy) < minFromActive) return true;
    }
    return otherPositions.some(p => {
      const dx = p.x - pos.x, dy = p.y - pos.y;
      return Math.sqrt(dx * dx + dy * dy) < minFromOthers;
    });
  }

  for (let ring = 1; ring <= 40; ring++) {
    const r     = ring * minFromActive;
    const steps = Math.max(8, ring * 8);
    for (let i = 0; i < steps; i++) {
      const angle = (2 * Math.PI * i) / steps;
      const pos   = { x: center.x + r * Math.cos(angle), y: center.y + r * Math.sin(angle) };
      if (!collides(pos)) return pos;
    }
  }

  return { x: center.x + minFromActive, y: center.y };
}

window.createNewNode = async function() {
  if (!cy || !window.MODEL_ID) return;
  if (window.USER_ROLE === 'reader') return;
  if (window._pendingNodeId) return;
  if (window.NODE_EDIT_MODE) return;

  const pos    = findFreePosition();
  const nodeId = crypto.randomUUID();

  const existing = new Set(cy.nodes().map(n => n.data('label')));
  let labelIdx = 1;
  while (existing.has(`Element ${labelIdx}`)) labelIdx++;
  const defaultLabel = `Element ${labelIdx}`;

  // Agregar a Cytoscape inmediatamente
  cy.add({
    group: 'nodes',
    data: {
      id:        nodeId,
      label:     defaultLabel,
      value:     '0',
      unit:      'unit',
      unit_id:   null,
      shape:     'ellipse',
      color:     '#8c8c8c',
      alpha:     0.5,
      size:      80,
      size_px:   80,
      size_type: 'fixed',
      hidden:    false
    },
    position: pos
  });

  const node = cy.getElementById(nodeId);

  // Agregar a NODES_DATA para que aparezca en listas (parent selector, etc.) sin F5
  if (Array.isArray(window.NODES_DATA)) {
    window.NODES_DATA.push({
      id: nodeId, model_id: window.MODEL_ID, label: defaultLabel,
      parent: null, unit_id: null, shape: 'ellipse', color: '#8c8c8c',
      alpha: 0.5, size_px: 80, size_type: 'fixed', hidden: false,
      comment: null, text_only: false, x: pos.x, y: pos.y
    });
  }

  window._pendingNodeId = nodeId;
  _setPendingBtnState(true);

  // Activar edit mode
  cy.nodes().unselect();
  node.select();
  window.ACTIVE_NODE_ID  = nodeId;
  window.NODE_EDIT_MODE  = true;

  renderNodeLabels(cy);
  createNodeBadges(cy, node);
  window.refreshDimming?.();

  // Persistir en Supabase
  try {
    const { error } = await window.supabaseClient
      .from('nodes')
      .insert({
        id:        nodeId,
        model_id:  window.MODEL_ID,
        label:     defaultLabel,
        shape:     'ellipse',
        color:     '#8c8c8c',
        alpha:     0.5,
        size_px:   80,
        size_type: 'fixed',
        x:         pos.x,
        y:         pos.y
      });
    if (error) throw error;
    window.pushUndo?.(async () => { window.removeNode?.(nodeId); });
  } catch (err) {
    console.error('[createNewNode] DB error — code:', err?.code, '| message:', err?.message, '| details:', err?.details, err);
    node.remove();
    if (Array.isArray(window.NODES_DATA)) {
      const i = window.NODES_DATA.findIndex(n => n.id === nodeId);
      if (i >= 0) window.NODES_DATA.splice(i, 1);
    }
    renderNodeLabels(cy);
    window.ACTIVE_NODE_ID = null;
    window._pendingNodeId = null;
    _setPendingBtnState(false);
  }
};

/////////////////////////////////////////////////////////
// REMOVE NODE
/////////////////////////////////////////////////////////

window.removeNode = async function(nodeId) {
  if (window.USER_ROLE === 'reader') return;
  // 1. Limpiar badges y label
  removeNodeBadges();
  const labelEl = NODE_LABELS[nodeId];
  if (labelEl) { labelEl.remove(); delete NODE_LABELS[nodeId]; }

  // 2. Quitar del grafo
  const node = cy?.getElementById(nodeId);
  if (node && !node.empty()) node.remove();

  // 2b. Quitar de NODES_DATA para que desaparezca de listas sin F5
  if (Array.isArray(window.NODES_DATA)) {
    const i = window.NODES_DATA.findIndex(n => n.id === nodeId);
    if (i >= 0) window.NODES_DATA.splice(i, 1);
  }

  // 3. Reset estado
  window.ACTIVE_NODE_ID = null;
  window.NODE_EDIT_MODE = false;
  if (window._pendingNodeId === nodeId) {
    window._pendingNodeId = null;
    _setPendingBtnState(false);
  }

  // 4. Persistir borrado en Supabase
  try {
    const { error } = await window.supabaseClient
      .from('nodes')
      .delete()
      .eq('id', nodeId);
    if (error) throw error;
  } catch (err) {
    console.error('[removeNode] DB error:', err);
  }
};

/////////////////////////////////////////////////////////
// BULK — aplicación masiva de atributos a un conjunto de nodos.
//   Selección por facetas (independiente del NODE_FILTER de visibilidad),
//   preview por selección en canvas, apply batcheado con undo único.
/////////////////////////////////////////////////////////

// Ids de nodos reales que matchean la selección por facetas (misma lógica que applyNodeFilter).
window.bulkMatchedIds = function(sel) {
  if (!cy || !sel) return [];
  const real = cy.nodes().not('[isChip],[isConceptHub]');

  let conceptNodes = null;
  if (sel.concept.mode === 'some') {
    conceptNodes = new Set();
    cy.edges().forEach(e => {
      const cs = e.data('concepts') || [];
      if (cs.some(c => sel.concept.ids.has(c.id))) {
        conceptNodes.add(e.source().id());
        conceptNodes.add(e.target().id());
      }
    });
  }
  let parentNodes = null;
  if (sel.parent.mode === 'some') {
    parentNodes = new Set();
    sel.parent.ids.forEach(rootId => {
      parentNodes.add(rootId);
      const q = [rootId];
      while (q.length) {
        const cur = q.shift();
        cy.edges().filter(e => e.data('type') === 'parent' && e.target().id() === cur)
          .forEach(e => { const ch = e.source().id(); if (!parentNodes.has(ch)) { parentNodes.add(ch); q.push(ch); } });
      }
    });
  }
  const match = (f, test) => f.mode === 'all' ? true : f.mode === 'none' ? false : test();
  const ids = [];
  real.forEach(n => {
    const id = n.id();
    const okG = match(sel.group,   () => { const gs = n.data('groups'); return Array.isArray(gs) && gs.some(g => sel.group.ids.has(g.id)); });
    const okU = match(sel.unit,    () => sel.unit.ids.has(n.data('unit_id')));
    const okC = match(sel.concept, () => conceptNodes.has(id));
    const okP = match(sel.parent,  () => parentNodes.has(id));
    const okN = match(sel.name,    () => sel.name.ids.has(id));
    if (okG && okU && okC && okP && okN) ids.push(id);
  });
  return ids;
};

// Preview: resalta (selecciona) en el canvas el conjunto matcheado.
window.bulkPreview = function(ids) {
  if (!cy) return;
  cy.batch(() => {
    cy.nodes().unselect();
    (ids || []).forEach(id => { const n = cy.getElementById(id); if (n && n.length) n.select(); });
  });
};

// Aplica `payload` (columnas DB) al cy de un nodo. Espeja la persistencia.
function _bulkApplyToNode(node, payload) {
  if (!node || !node.length) return;
  if ('color'     in payload) { node.data('color', payload.color); node.style('background-color', payload.color); }
  if ('alpha'     in payload) { node.data('alpha', payload.alpha); node.style('background-opacity', payload.alpha); }
  if ('size_px'   in payload) { node.data('size_px', payload.size_px); node.data('size', payload.size_px); }
  if ('size_type' in payload) node.data('size_type', payload.size_type);
  if ('size_px_h'   in payload) node.data('size_px_h', payload.size_px_h);
  if ('size_type_h' in payload) node.data('size_type_h', payload.size_type_h);
  if ('shape'     in payload) { node.data('shape', payload.shape); (window.applyNodeShape || ((n,s)=>n.style('shape',s)))(node, payload.shape); }
  if ('unit_id'   in payload) { node.data('unit_id', payload.unit_id); const u = (window.UNITS_DATA || []).find(x => x.id === payload.unit_id); node.data('unit', u ? u.name : ''); }
  if ('text_only' in payload) node.data('text_only', payload.text_only);
  if ('text_auto'  in payload) { node.data('text_auto', payload.text_auto); window.applyNodeTextSize?.(node); }
  if ('text_label' in payload) { node.data('text_label', payload.text_label); window.applyNodeTextSize?.(node); }
  if ('text_value' in payload) { node.data('text_value', payload.text_value); window.applyNodeTextSize?.(node); }
  if ('text_unit'  in payload) { node.data('text_unit',  payload.text_unit);  window.applyNodeTextSize?.(node); }
  if ('comment'   in payload) node.data('comment', payload.comment || '');
  if ('hidden'    in payload) node.data('hidden_manual', payload.hidden);   // efectivo → recomputeHideConditions
  if ('hide_when' in payload) node.data('hide_when', payload.hide_when || '');
}

// Lee el valor DB-significativo actual de una columna (para el snapshot de undo).
function _bulkReadCol(node, col) {
  if (col === 'hidden')  return !!node.data('hidden_manual');
  if (col === 'size_px') return node.data('size_px') || node.data('size') || 80;
  return node.data(col);
}

// Aplica un atributo a un conjunto de nodos: cy + persistencia batch + undo único.
// payload = columnas DB. opts.recomputeHide → re-evalúa visibilidad (hidden/hide_when).
window.bulkApplyAttr = async function(ids, payload, opts) {
  if (window.USER_ROLE === 'reader') return;
  if (!cy || !Array.isArray(ids) || !ids.length || !payload) return;
  opts = opts || {};
  const cols = Object.keys(payload);

  // Snapshot previo por nodo (los valores difieren entre nodos → no se puede un único valor)
  const prev = ids.map(id => {
    const n = cy.getElementById(id);
    const p = {}; cols.forEach(c => { p[c] = _bulkReadCol(n, c); });
    return { id, p };
  });

  ids.forEach(id => _bulkApplyToNode(cy.getElementById(id), payload));
  await window.bulkUpdateNodes(ids, payload);
  if (opts.recomputeHide) window.recomputeHideConditions?.();
  renderNodeLabels(cy);
  cy.style().update();
  window.refreshByUnitSizes?.();   // size_type 'by unit' recalcula tamaño desde el valor

  window.pushUndo?.(async () => {
    // Restaurar por nodo (cy + DB); agrupado por valor sería micro-optimización innecesaria en undo.
    for (const { id, p } of prev) {
      _bulkApplyToNode(cy.getElementById(id), p);
      await window.bulkUpdateNodes([id], p);
    }
    if (opts.recomputeHide) window.recomputeHideConditions?.();
    renderNodeLabels(cy);
    cy.style().update();
    window.refreshByUnitSizes?.();
  });
};

// BULK — agrega/quita un grupo a un conjunto de nodos (tabla node_groups). Solo toca
// los nodos que realmente cambian (snapshot/undo precisos). Sincroniza node.data('groups').
window.bulkApplyGroup = async function(ids, groupId, add) {
  if (window.USER_ROLE === 'reader') return { error: 'read only' };
  if (!cy || !Array.isArray(ids) || !ids.length || !groupId) return { error: 'nothing' };
  const g = (window.GROUPS_DATA || []).find(x => x.id === groupId);
  if (!g) return { error: 'no group' };
  const meta = { id: g.id, name: g.name, color: g.color };

  const affected = ids.filter(id => {
    const node = cy.getElementById(id); if (!node.length) return false;
    const has = (node.data('groups') || []).some(x => x.id === groupId);
    return add ? !has : has;
  });
  if (!affected.length) return { ok: true, count: 0 };

  const _applyMem = (nodeIds, addMode) => {
    nodeIds.forEach(id => {
      const node = cy.getElementById(id); if (!node.length) return;
      let groups = Array.isArray(node.data('groups')) ? node.data('groups').slice() : [];
      if (addMode) { if (!groups.some(x => x.id === groupId)) groups.push({ ...meta }); }
      else groups = groups.filter(x => x.id !== groupId);
      node.data('groups', groups);
      if (window.NODE_GROUPS_MAP) window.NODE_GROUPS_MAP[id] = groups;
    });
  };
  const _db = async (addMode, nodeIds) => {
    if (addMode) {
      const { error } = await window.supabaseClient.from('node_groups')
        .insert(nodeIds.map(id => ({ node_id: id, group_id: groupId })));
      if (error) console.error('bulk group insert:', error);
    } else {
      const { error } = await window.supabaseClient.from('node_groups')
        .delete().in('node_id', nodeIds).eq('group_id', groupId);
      if (error) console.error('bulk group delete:', error);
    }
  };

  await _db(add, affected);
  _applyMem(affected, add);
  cy.style().update();
  window.refreshDimming?.();

  window.pushUndo?.(async () => {
    await _db(!add, affected);
    _applyMem(affected, !add);
    cy.style().update();
    window.refreshDimming?.();
  });
  return { ok: true, count: affected.length };
};

// Borra un grupo del SISTEMA (no solo lo desasigna de un nodo): elimina la fila de
// `groups` + todas sus `node_groups`, y lo saca de GROUPS_DATA, de cada node.data('groups'),
// del NODE_GROUPS_MAP y de los sets de Filter/Bulk. Compartida por el picker del nodo y el Bulk.
window.deleteGroup = async function(groupId) {
  if (window.USER_ROLE === 'reader') return false;
  if (!groupId) return false;
  try {
    await window.supabaseClient.from('node_groups').delete().eq('group_id', groupId);
    await window.supabaseClient.from('groups').delete().eq('id', groupId);
  } catch (e) { console.error('deleteGroup:', e); return false; }

  if (Array.isArray(window.GROUPS_DATA)) {
    const i = window.GROUPS_DATA.findIndex(g => g.id === groupId);
    if (i >= 0) window.GROUPS_DATA.splice(i, 1);
  }
  if (cy) cy.nodes().not('[isChip],[isConceptHub]').forEach(n => {
    const gs = n.data('groups');
    if (Array.isArray(gs) && gs.some(x => x.id === groupId)) {
      const next = gs.filter(x => x.id !== groupId);
      n.data('groups', next);
      if (window.NODE_GROUPS_MAP) window.NODE_GROUPS_MAP[n.id()] = next;
    }
  });
  [window.NODE_FILTER, window.BULK_SEL].forEach(F => { if (F && F.group && F.group.ids) F.group.ids.delete(groupId); });
  cy?.style().update();
  window.refreshDimming?.();
  return true;
};

// Setea el parent edge de un nodo en runtime (mismo patrón que node-relations _applyParent).
function _setNodeParentRuntime(nodeId, parentId) {
  const node = cy.getElementById(nodeId); if (!node.length) return;
  const oldEdge = cy.edges().filter(e => e.source().id() === nodeId && e.data('type') === 'parent');
  if (oldEdge.length) { const hub = cy.getElementById(`hub_${oldEdge.id()}`); if (hub.length) hub.remove(); oldEdge.remove(); }
  if (parentId) cy.add({ group: 'edges', data: { id: `parent_${nodeId}`, source: nodeId, target: parentId, type: 'parent' } });
  node.data('parent_id', parentId || null);
}

// BULK — re-parenta un conjunto de nodos bajo un mismo padre (o los desvincula con null).
// Excluye al propio padre y a sus ancestros (evita ciclos). Edges parent se rederivan.
window.bulkApplyParent = async function(ids, parentId) {
  if (window.USER_ROLE === 'reader') return { error: 'read only' };
  if (!cy || !Array.isArray(ids) || !ids.length) return { error: 'no nodes' };

  // Ancestros de P (incluye P): si X es ancestro de P, hacer X.parent=P crearía un ciclo.
  const blocked = new Set();
  if (parentId) {
    let cur = parentId, guard = 0;
    while (cur && guard++ < 10000) { blocked.add(cur); cur = cy.getElementById(cur).data('parent_id') || null; }
  }
  const valid = ids.filter(id => !blocked.has(id));
  if (!valid.length) return { error: 'would create a cycle' };

  const prev = valid.map(id => ({ id, parent: cy.getElementById(id).data('parent_id') || null }));
  valid.forEach(id => _setNodeParentRuntime(id, parentId || null));
  await window.bulkUpdateNodes(valid, { parent: parentId || null });
  cy.style().update();
  window.refreshConceptHubs?.();

  window.pushUndo?.(async () => {
    for (const p of prev) { _setNodeParentRuntime(p.id, p.parent); await window.bulkUpdateNodes([p.id], { parent: p.parent }); }
    cy.style().update();
    window.refreshConceptHubs?.();
  });
  return { ok: true, count: valid.length, skipped: ids.length - valid.length };
};

// BULK — agrega texto al comment de muchos nodos (append, per-nodo: cada valor difiere).
window.bulkAppendComment = async function(ids, text) {
  if (window.USER_ROLE === 'reader') return { error: 'read only' };
  if (!cy || !Array.isArray(ids) || !ids.length) return { error: 'no nodes' };
  text = (text || '').trim();
  if (!text) return { error: 'empty text' };

  const prev = [], targets = [];
  ids.forEach(id => {
    const node = cy.getElementById(id); if (!node.length) return;
    const cur = (node.data('comment') || '').trim();
    prev.push({ id, comment: node.data('comment') || '' });
    const next = cur ? cur + '\n\n' + text : text;
    targets.push({ id, comment: next });
    node.data('comment', next);
  });
  for (const t of targets) await window.bulkUpdateNodes([t.id], { comment: t.comment });

  window.pushUndo?.(async () => {
    for (const p of prev) { cy.getElementById(p.id).data('comment', p.comment); await window.bulkUpdateNodes([p.id], { comment: p.comment }); }
  });
  return { ok: true, count: targets.length };
};

// Aplica una fórmula a un conjunto de nodos en los períodos dados. La fórmula puede
// contener el sentinel Self (window.BULK_SELF_ID): se reescribe al uuid de cada nodo
// destino → referencia relativa a sí mismo. Escritura batcheada + undo único. Los
// ciclos se marcan al recomputar (no rompe). Devuelve { ok } o { error }.
window.bulkApplyFormula = async function(ids, periods, rawStored) {
  if (window.USER_ROLE === 'reader') return { error: 'read only' };
  if (!Array.isArray(ids) || !ids.length)         return { error: 'no nodes' };
  if (!Array.isArray(periods) || !periods.length) return { error: 'no periods' };
  const stored = (rawStored || '').trim();
  if (!stored) return { error: 'empty formula' };

  const SELF = window.BULK_SELF_ID;
  // Self en offset >= 0 → auto-ciclo seguro: bloquear (solo se permite Self[-k]).
  const selfRe = new RegExp('node:' + SELF.replace(/-/g, '\\-') + '\\[([+-]?\\d+)\\]', 'g');
  let m; while ((m = selfRe.exec(stored)) !== null) { if (parseInt(m[1]) >= 0) return { error: 'Self must be past (e.g. Self[-1])' }; }

  const vd = window.VALUES_DATA || {};
  const prevRows = [], newRows = [];
  ids.forEach(id => {
    let f = stored.split(SELF).join(id);            // Self → uuid del nodo
    f = window.Formula?.bakeRandom(f) ?? f;          // sella RND por nodo
    periods.forEach(p => {
      prevRows.push({ nodeId: id, period: p, formula: vd[`${id}_${p}`]?.formula ?? null });
      newRows.push({  nodeId: id, period: p, formula: f });
    });
  });

  await window.bulkWriteFormulaRows(newRows);
  window.recomputeFormulas?.();
  window.refreshFormulaEdges?.();
  window.refreshTimelinePanel?.();

  window.pushUndo?.(async () => {
    await window.bulkWriteFormulaRows(prevRows);
    window.recomputeFormulas?.();
    window.refreshFormulaEdges?.();
    window.refreshTimelinePanel?.();
  });
  return { ok: true, count: ids.length * periods.length };
};

// Re-evalúa las condiciones "Hide when" para el período actual y setea el hidden
// EFECTIVO de cada nodo = manual || condición. Volátil (no persiste). Reusa toda la
// maquinaria de visibilidad existente (estilo node[?hidden], labels, SHOW_HIDDEN).
window.recomputeHideConditions = function() {
  if (!cy) return;
  const period = window.CURRENT_PERIOD || 1;
  cy.nodes().not('[isChip],[isConceptHub]').forEach(n => {
    const manual = !!n.data('hidden_manual');
    const cond   = n.data('hide_when');
    const hit    = cond ? !!window.Formula?.evaluateCondition(cond, n.id(), period) : false;
    n.data('_hideCond', hit);
    n.data('hidden', manual || hit);
  });
  // Deseleccionar / limpiar badges de nodos que quedaron ocultos (igual que view level/filter)
  if (!window.SHOW_HIDDEN) {
    cy.nodes(':selected').not('[isChip],[isConceptHub]').forEach(n => {
      if (n.data('hidden')) {
        n.unselect();
        if (typeof window.removeNodeBadges === 'function') window.removeNodeBadges();
      }
    });
  }
  cy.style().update();
  renderNodeLabels(cy);   // los labels HTML dependen de data.hidden → re-render (carga inicial / guardar condición)
};

window.refreshPeriod = function() {
  if (!cy) return;
  const period    = window.CURRENT_PERIOD || 1;
  const valuesMap = window.VALUES_DATA    || {};
  cy.nodes().not('[isChip]').forEach(node => {
    const v = valuesMap[`${node.id()}_${period}`]?.value;
    node.data('value', v !== undefined && v !== null ? v : '');
  });
  // Condiciones "Hide when" dependen del valor del período → recalcular antes de los labels.
  window.recomputeHideConditions();
  renderNodeLabels(cy);
  if (typeof window.refreshByUnitSizes === 'function') window.refreshByUnitSizes();
};

setTimeout(() => {
  window.renderGraph = window.renderGraph;
}, 0);

