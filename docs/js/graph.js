/////////////////////////////////////////////////////////
// GRAPH ENGINE (Cytoscape)
/////////////////////////////////////////////////////////

let cy = null;
let NODE_LABELS = {};
let tickingChips = false;
let tickingLabels = false;
window.ACTIVE_EDGE = null;
import { showNodeUI, removeNodeUI } from "./nodeUI.js";

/////////////////////////////////////////////////////////
// COLOR UTILS (uses CSS variables)
/////////////////////////////////////////////////////////

function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function getNodeColor(ele) {
  return ele.data('color') || getCSSVar('--node-bg');
}

function getEdgeColor() {
  return getCSSVar('--edge-color');
}

function getEdgeActiveColor() {
  return getCSSVar('--edge-active');
}

/////////////////////////////////////////////////////////
// MAIN RENDER
/////////////////////////////////////////////////////////

window.renderGraph = function(graphData) {

  console.log("renderGraph", graphData);

  if (cy) cy.destroy();

  cy = cytoscape({

    container: document.getElementById('graph'),

    elements: [
      ...graphData.nodes,
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
          'background-color': (ele) => getNodeColor(ele),
          'background-opacity': 0.7,
          'width': 80,
          'height': 80,
          'border-width': 0,
          'border-color': getCSSVar('--node-border')
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
      }

    ],

    layout: { name: 'preset' }
  });

  /////////////////////////////////////////////////////////
  // INTERACTIONS
  /////////////////////////////////////////////////////////

  setupEdgeInteraction(cy);

  /////////////////////////////////////////////////////////
  // RENDER LOOP (chips + labels)
  /////////////////////////////////////////////////////////

  let rafPending = false;

  cy.on("pan zoom", () => {
    if (window.UI_MODE === "v3") {
      if (window.activeNodeUI) {
        window.activeNodeUI.update();
      }
    }
  });

  cy.on('pan zoom', () => {
    if (rafPending) return;

    rafPending = true;

    requestAnimationFrame(() => {
      updateAllChips();
      renderNodeLabels();
      rafPending = false;
    });
  });

  cy.on('drag', 'node', () => {
    updateAllChips();
    renderNodeLabels();
  });

  cy.on("drag", "node", () => {
  if (window.UI_MODE === "v3") {
    if (window.activeNodeUI) {
      window.activeNodeUI.update();
    }
  }
});

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
    renderNodeLabels();
    hideLoader();
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

function setupEdgeInteraction(cy) {

  // chip click → filter concept
  cy.on('tap', 'node[isChip]', (e) => {
    const chip = e.target;
    const conceptName = chip.data('label');
    toggleConceptFilter(conceptName, chip);
  });

  // edge click → expand + open panel
  cy.on('tap', 'edge', (e) => {

    const edge = e.target;

    if (window.ACTIVE_EDGE && window.ACTIVE_EDGE.id() !== edge.id()) {
      collapseEdge(window.ACTIVE_EDGE);
    }

    window.ACTIVE_EDGE = edge;

    const expanded = edge.data('expanded');

    if (!expanded) {
      expandEdge(edge);
      saveWorkspace();
    }

    openEdgePanel(edge);
  });

  // empty space click → create concept
  cy.on('tap', (e) => {
    if (e.target === cy) {

      if (window.ACTIVE_EDGE) {
        collapseEdge(window.ACTIVE_EDGE);
        window.ACTIVE_EDGE = null;
        return; // 👈 CLAVE: corta acá
      }

      openCreateConceptPanel();
    }
  });

cy.on("tap", "node", (e) => {
  e.stopPropagation();

  console.log("NODE CLICK OK");

  const node = e.target;

  if (window.UI_MODE === "v3") {
    showNodeUI(node, cy);
  } else {
    openNodePanel(node);
  }
});

  cy.on("tap", (e) => {
  if (e.target === cy) {
    removeNodeUI();
  }
});

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

  if (typeof setState === "function") {

  const current = getState();

  setState({
    ...current,
    workspace: {
      zoom: cy.zoom(),
      pan: cy.pan(),
      expandedEdges
    }
  });

  }

  cy.edges().forEach(edge => {
    if (edge.data('expanded')) {
      expandedEdges.push(edge.id());
    }
  });

  function saveWorkspace() {

  const expandedEdges = [];

  cy.edges().forEach(edge => {
    if (edge.data('expanded')) {
      expandedEdges.push(edge.id());
    }
  });

  if (typeof setState === "function") {
    const current = getState();

    setState({
      ...current,
      workspace: {
        zoom: cy.zoom(),
        pan: cy.pan(),
        expandedEdges
      }
    });
  }

  if (typeof queueWorkspace === "function") {
    queueWorkspace({
      zoom: cy.zoom(),
      pan: cy.pan(),
      expandedEdges
    });
  }
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

/////////////////////////////////////////////////////////
// HTML LABELS (overlay)
/////////////////////////////////////////////////////////

function renderNodeLabels() {

  const container = document.getElementById('node-label-layer');
  const zoom = cy.zoom();

  cy.nodes().not('[isChip]').forEach(node => {

    const id = node.id();
    const data = node.data();
    const pos = node.renderedPosition();

    let el = NODE_LABELS[id];

    if (!el) {
      el = document.createElement('div');
      el.className = 'node-label';

      el.innerHTML = `
        <div class="title"></div>
        <div class="value"></div>
        <div class="unit"></div>
      `;

      container.appendChild(el);
      NODE_LABELS[id] = el;
    }

    el.querySelector('.title').innerText = data.label || '';
    el.querySelector('.value').innerText = data.value || '';
    el.querySelector('.unit').innerText = data.unit || '';

    el.style.left = pos.x + 'px';
    el.style.top = pos.y + 'px';

   const bg = node.data('color') || '#0059ff';
   const textColor = getContrastColor(bg);

    el.style.color = textColor;
    el.style.transform = `translate(-50%, -50%) scale(${zoom})`;
  });

  /////////////////////////////////////////////////////////
  // CLEANUP LABELS
  /////////////////////////////////////////////////////////

  Object.keys(NODE_LABELS).forEach(id => {

    const exists = cy.getElementById(id).length > 0;

    if (!exists) {
      NODE_LABELS[id].remove();
      delete NODE_LABELS[id];
    }

  });
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

document.getElementById("model-name").addEventListener("change", (e) => {
  saveConfig("name", e.target.value);
});

document.getElementById("model-name").addEventListener("change", (e) => {

  if (typeof queueConfig === "function") {
    queueConfig("name", e.target.value);
  }

});

function updateModelMeta(cfg) {

  const el = document.getElementById("model-meta");
  if (!el) return;

  const author = cfg.author || "unknown";
  const version = cfg.version || "v1";

  el.innerText = `by ${author} · ${version}`;
}

setTimeout(() => {
  window.renderGraph = window.renderGraph;
}, 0);