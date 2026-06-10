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
} from "./graph/graph-style.js";

import { setupGraphEvents }
from "./graph/graph-events.js";

import {
  NODE_LABELS,
  renderNodeLabels,
  updateNodeLabelPositions,
  openFieldEditor,
  openUnitSelector,
  closeUnitSelector,
} from "./graph/graph-labels.js";

import {
  createNodeBadges,
  removeNodeBadges,
  updateBadgePositions,
} from "./graph/graph-dom-badges.js";

window.removeNodeBadges = removeNodeBadges;


/////////////////////////////////////////////////////////
// MAIN RENDER
/////////////////////////////////////////////////////////

function computeByUnitSize(ele) {
  const unitId  = ele.data('unit_id');
  const value   = parseFloat(ele.data('value'));

  if (!unitId || isNaN(value)) return parseFloat(ele.data('size_px')) || 80;

  const unit = (window.UNITS_DATA || []).find(u => u.id === unitId);
  if (!unit) return parseFloat(ele.data('size_px')) || 80;

  const minSz = parseFloat(unit.min_sz) || 20;
  const maxSz = parseFloat(unit.max_sz) || 120;

  // recolectar valores de todos los nodos con la misma unit y size_type 'by unit'
  const peers = [];
  ele.cy().nodes().not('[isChip],[isConceptHub]').forEach(n => {
    if (n.data('unit_id') === unitId && n.data('size_type') === 'by unit') {
      const v = parseFloat(n.data('value'));
      if (!isNaN(v)) peers.push(v);
    }
  });

  if (peers.length === 0) return minSz;

  const valMax = Math.max(...peers);

  if (valMax <= 0) return minSz;

  const pct  = Math.max(0, Math.min(1, value / valMax));
  const size = Math.round(pct * maxSz);

  return Math.max(minSz, size);
}

window.renderGraph = function(graphData) {

  console.log("renderGraph", graphData);

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
    userZoomingEnabled: true,
    boxSelectionEnabled: false,

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
          'shape': (ele) =>
            ele.data('shape') || 'ellipse',
          'width': (ele) =>
            ele.data('size_type') === 'by unit'
              ? computeByUnitSize(ele)
              : ele.data('size_px') || ele.data('size') || 80,

          'height': (ele) =>
            ele.data('size_type') === 'by unit'
              ? computeByUnitSize(ele)
              : ele.data('size_px') || ele.data('size') || 80,
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
          'line-color': getEdgeActiveColor(),
          'target-arrow-color': getEdgeActiveColor()
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

    realNodes.forEach(n => {
      const depth   = depths.get(n.id()) ?? 0;
      const visible = capped === 0 || depth <= maxDepth - capped;
      n.css('display', visible ? 'element' : 'none');
      const labelEl = document.querySelector(`#node-label-layer [data-id="${n.id()}"]`);
      if (labelEl) labelEl.style.display = visible ? '' : 'none';
    });

    // Ocultar edges cuyos nodos están ocultos
    cy.edges().not('[isChip]').forEach(e => {
      const srcVis = e.source().css('display') !== 'none';
      const tgtVis = e.target().css('display') !== 'none';
      e.css('display', srcVis && tgtVis ? 'element' : 'none');
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

  cy.on('pan zoom', () => {

    closeNodeStylePanel();
    window.closeNodeRelationsPanel?.();
    window.closeNodeCommentsPanel?.();
    window.closeNodeCopyPanel?.();

    if (rafPending) return;

    rafPending = true;

    requestAnimationFrame(() => {

      updateFloatingUI();

      rafPending = false;

    });

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
    console.log('[createNewNode] ✔', nodeId);
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
    console.log('[removeNode] ✔', nodeId);
  } catch (err) {
    console.error('[removeNode] DB error:', err);
  }
};

window.refreshPeriod = function() {
  if (!cy) return;
  const period    = window.CURRENT_PERIOD || 1;
  const valuesMap = window.VALUES_DATA    || {};
  cy.nodes().not('[isChip]').forEach(node => {
    const v = valuesMap[`${node.id()}_${period}`]?.value;
    node.data('value', v !== undefined && v !== null ? v : '');
  });
  renderNodeLabels(cy);
  if (typeof window.refreshByUnitSizes === 'function') window.refreshByUnitSizes();
};

setTimeout(() => {
  window.renderGraph = window.renderGraph;
}, 0);

