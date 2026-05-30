/////////////////////////////////////////////////////////
// GRAPH ENGINE (Cytoscape)
/////////////////////////////////////////////////////////

let cy = null;
let tickingChips = false;
let tickingLabels = false;
window.ACTIVE_EDGE = null;
window.NODE_EDIT_MODE = false;

import { removeNodeUI } from "./nodeUI.js";

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
  ele.cy().nodes().not('[isChip]').forEach(n => {
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

      /////////////////////////////////////////////////////////
      // CHIPS (concepts on edges)
      /////////////////////////////////////////////////////////
    {
      selector: 'node[isChip]',
      style: {
        'label': 'data(label)',
        'background-color': 'data(color)',
        'shape': 'round-rectangle',

        'color': (ele) => getContrastColor(ele.data('color')),

        'font-size': 7,
        'text-valign': 'center',
        'text-halign': 'center',

        'padding': '4px 10px',
        'padding-top': 2,
        'padding-bottom': 2,

        'height': 'label',
        'width': 'label',

        'border-width': 0
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

          'label': 'data(conceptLabel)',
          'font-size': 7,
          'color': getCSSVar('--text-secondary'),

          'text-background-opacity': 1,
          'text-background-color': getCSSVar('--bg-graph'),
          'text-background-padding': 0,

          'text-rotation': 'autorotate'
        }
      },

      {
        selector: 'edge[type="parent"]',
        style: {
          'line-color': '#a2c1cf',
          'target-arrow-color': '#a2c1cf',
          'target-arrow-shape': 'triangle',
          'curve-style': 'unbundled-bezier',
          'control-point-distances': [-25],
          'control-point-weights': [0.5],
          'arrow-scale': 0.5,
          'target-distance-from-node': .5
        }
      },

      {
        selector: 'edge[type="formula"]',
        style: {
          'width': 1,
          'line-color': getEdgeColor(),
          'target-arrow-color': getEdgeColor(),
          'target-arrow-shape': 'triangle',
          'curve-style': 'straight',
          'arrow-scale': 0.5,
          'target-distance-from-node': .5
        }
      },

      {
      selector: 'edge[type="manual"]',
      style: {
        'line-color': '#f7acac',              // rojo
        'target-arrow-color': '#f7acac',
        'target-arrow-shape': 'triangle',     // misma flecha que parent

        'curve-style': 'unbundled-bezier',
        'control-point-distances': [30],      // 🔥 opuesto a parent (-30)
        'control-point-weights': [0.5],

        'arrow-scale': 0.5,
        'target-distance-from-node': .5
                 
      }
     },

      {
        selector: 'node.concept-related',
        style: {
          'border-width': 1,
          'border-color': getCSSVar('--accent')
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

      {
        selector: 'edge.dimmed',
        style: {
          'opacity': 0.1
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


    ],

    layout: { name: 'preset' }
  });

  window.cy = cy;

  window.refreshByUnitSizes = () => cy.style().update();

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
    removeNodeUI,
    renderNodeLabels
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

    if (rafPending) return;

    rafPending = true;

    requestAnimationFrame(() => {

      updateFloatingUI();

      rafPending = false;

    });

  });

  cy.on(
  'grab drag position',
  'node',
    () => {

      closeNodeStylePanel();

      requestAnimationFrame(() => {

        updateFloatingUI();

      });

    }
  );


  /////////////////////////////////////////////////////////
  // WORKSPACE
  /////////////////////////////////////////////////////////

  const debouncedSave = debounce(saveWorkspace, 400);

  cy.on('pan zoom', debouncedSave);


 cy.on('dragfree', 'node', () => {
  

  if (typeof setState !== "function") return;

  const positions = {};

  cy.nodes().forEach(n => {
    positions[n.id()] = n.position();
  });

  const current = getState();

  setState({
    ...current,
    positions
  });

   });

  /////////////////////////////////////////////////////////
  // LABELS INIT
  /////////////////////////////////////////////////////////

  cy.ready(() => {
    renderNodeLabels(cy);
    updateNodeLabelPositions(cy);
    applyWorkspace(graphData.workspace);
    hideLoader();
    if (window.USER_ROLE === 'reader') cy.autoungrabify(true);
  });

  // 🔥 FORCE BATCH HOOK (DEBUG)

  cy.on('dragfree', 'node', () => {

    console.log("DRAG EVENT OK");

    if (typeof queuePositions !== "function") {
      console.log("queuePositions NOT FOUND");
      return;
    }

    const positions = {};

    cy.nodes().forEach(n => {
      positions[n.id()] = n.position();
    });

    console.log("SENDING TO QUEUE", positions);

    queuePositions(positions);

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
  const spacing = 14;

  concepts.forEach((c, i) => {

    cy.add({
      group: 'nodes',
      data: {
        id: `chip_${edge.id()}_${i}_${Date.now()}`,
        parentEdge: edge.id(),
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

  edge.data('conceptLabel', '•');

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
    .filter(n => n.data('parentEdge') === edge.id())
    .forEach(n => n.remove()); // OK porque son nodos visuales

  edge.data('expanded', false);

  const count = edge.data('concepts')?.length || 0;
  edge.data('conceptLabel', count > 0 ? String(count) : '');

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

window.collapseEdge = collapseEdge;

/////////////////////////////////////////////////////////
// UPDATE CHIP POSITIONS
/////////////////////////////////////////////////////////

function updateAllChips() {

  cy.nodes('[isChip]').forEach(chip => {

    const edge = cy.getElementById(chip.data('parentEdge'));
    if (!edge || edge.empty()) return;

    const center = getEdgeCenter(edge);
    const index = chip.data('index');

    const spacing = 14;

    chip.position({
      x: center.x,
      y: center.y - ((index + 1) * spacing)
    });

  });
}

/////////////////////////////////////////////////////////
// GEOMETRY
/////////////////////////////////////////////////////////

function getEdgeCenter(edge) {
  const p = edge.midpoint();
  return { x: p.x, y: p.y };
}

/////////////////////////////////////////////////////////
// CONCEPT FILTER
/////////////////////////////////////////////////////////

let ACTIVE_CONCEPT = null;

function toggleConceptFilter(conceptName, chip) {

  if (ACTIVE_CONCEPT === conceptName) {
    clearConceptFilter();
    return;
  }

  ACTIVE_CONCEPT = conceptName;

  cy.nodes().removeClass('concept-related');

  cy.edges().forEach(edge => {

    const concepts = edge.data('concepts') || [];

    const match = concepts.some(c => c.name === conceptName);

    edge.toggleClass('highlighted', match);
    edge.toggleClass('dimmed', !match);

    if (match) {
      edge.source().addClass('concept-related');
      edge.target().addClass('concept-related');
    }

  });

  cy.nodes('[isChip]').removeClass('active');
  chip.addClass('active');
}

function clearConceptFilter() {

  ACTIVE_CONCEPT = null;

  cy.edges().removeClass('highlighted dimmed');
  cy.nodes().removeClass('concept-related');
  cy.nodes('[isChip]').removeClass('active');
}

/////////////////////////////////////////////////////////
// WORKSPACE
/////////////////////////////////////////////////////////

function saveWorkspace() {
  const expandedEdges = [];
  cy.edges().forEach(edge => {
    if (edge.data('expanded')) expandedEdges.push(edge.id());
  });

  const ws = { zoom: cy.zoom(), pan: cy.pan(), expandedEdges };

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

  const existingNodes = cy.nodes().not('[isChip]');
  const positions = existingNodes.map(n => n.position());

  // Partir del último nodo; si no hay nodos, usar centro del viewport
  let center;
  if (existingNodes.length > 0) {
    center = existingNodes[existingNodes.length - 1].position();
  } else {
    const ext = cy.extent();
    center = { x: (ext.x1 + ext.x2) / 2, y: (ext.y1 + ext.y2) / 2 };
  }

  const minDist = 130; // radio nodo (40) + 50 clearance + radio nodo (40)

  function collides(pos) {
    return positions.some(p => {
      const dx = p.x - pos.x;
      const dy = p.y - pos.y;
      return Math.sqrt(dx * dx + dy * dy) < minDist;
    });
  }

  if (!collides(center)) return center;

  for (let ring = 1; ring <= 20; ring++) {
    const r     = ring * minDist;
    const steps = Math.max(8, ring * 8);
    for (let i = 0; i < steps; i++) {
      const angle = (2 * Math.PI * i) / steps;
      const pos   = {
        x: center.x + r * Math.cos(angle),
        y: center.y + r * Math.sin(angle)
      };
      if (!collides(pos)) return pos;
    }
  }

  return { x: center.x + minDist, y: center.y };
}

window.createNewNode = async function() {
  if (!cy || !window.MODEL_ID) return;
  if (window.USER_ROLE === 'reader') return;

  const pos    = findFreePosition();
  const nodeId = crypto.randomUUID();

  // Agregar a Cytoscape inmediatamente
  cy.add({
    group: 'nodes',
    data: {
      id:        nodeId,
      label:     'Hi!',
      value:     '0',
      unit:      'unit',
      unit_id:   null,
      shape:     'ellipse',
      color:     '#8c8c8c',
      alpha:     0.5,
      size:      80,
      size_px:   80,
      size_type: 'fixed'
    },
    position: pos
  });

  const node = cy.getElementById(nodeId);

  // Activar edit mode
  cy.nodes().unselect();
  node.select();
  window.ACTIVE_NODE_ID  = nodeId;
  window.NODE_EDIT_MODE  = true;

  renderNodeLabels(cy);
  createNodeBadges(cy, node);

  // Persistir en Supabase
  try {
    const { error } = await window.supabaseClient
      .from('nodes')
      .insert({
        id:        nodeId,
        model_id:  window.MODEL_ID,
        label:     'Hi!',
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
  } catch (err) {
    console.error('[createNewNode] DB error:', err);
    node.remove();
    renderNodeLabels(cy);
    window.ACTIVE_NODE_ID = null;
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

  // 3. Reset estado
  window.ACTIVE_NODE_ID = null;
  window.NODE_EDIT_MODE = false;

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

