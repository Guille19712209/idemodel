/////////////////////////////////////////////////////////
// 🧠 GRAPH ENGINE (Cytoscape)
/////////////////////////////////////////////////////////

let cy = null;
let NODE_LABELS = {};
let tickingChips = false;
let tickingLabels = false;

/////////////////////////////////////////////////////////
// 🎨 UTILS DE COLOR (usa variables CSS)
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
// 🚀 RENDER PRINCIPAL
/////////////////////////////////////////////////////////

function renderGraph(graphData) {

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
      // 🔵 NODOS
      /////////////////////////////////////////////////////////
      {
        selector: 'node',
        style: {
          'label': '',
          'background-color': (ele) => getNodeColor(ele),
          'width': 80,
          'height': 80,
          'border-width': 1,
          'border-color': getCSSVar('--node-border')
        }
      },

      /////////////////////////////////////////////////////////
      // 🟦 CHIPS (conceptos sobre edges)
      /////////////////////////////////////////////////////////
      {
        selector: 'node[isChip]',
        style: {
          'label': 'data(label)',
          'background-color': 'data(color)',
          'shape': 'round-rectangle',

          'color': (ele) => getContrastColor(ele.data('color')),

          'font-size': 4,
          'padding': 1,

          'height': 5,
          'width': 'label',

          'text-valign': 'center',
          'text-halign': 'center',

          // 🔥 CLAVE
          'border-width': 0,
          'border-color': 'transparent'
        }
      },

      /////////////////////////////////////////////////////////
      // 🔗 EDGES BASE
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
          'text-background-color': getCSSVar('--bg-panel'),
          'text-background-padding': 2,

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
          'control-point-distances': [-30],
          'control-point-weights': [0.5],
          'arrow-scale': 0.5,
          'target-distance-from-node': 1
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
          'arrow-scale': 0.6,
          'target-distance-from-node': 1
        }
     },

      /////////////////////////////////////////////////////////
      // ✨ EDGE ACTIVO
      /////////////////////////////////////////////////////////
      {
        selector: 'edge.highlighted',
        style: {
          'width': 2,
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
      // 🔷 CHIP ACTIVO
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
  // 🧠 INTERACCIONES
  /////////////////////////////////////////////////////////

  setupEdgeInteraction(cy);

  /////////////////////////////////////////////////////////
  // 🔄 RENDER LOOP (chips)
  /////////////////////////////////////////////////////////

  cy.on('render', () => {

    if (tickingChips) return;

    tickingChips = true;

    requestAnimationFrame(() => {
      updateAllChips();
      tickingChips = false;
    });

  });

  /////////////////////////////////////////////////////////
  // 🔄 RENDER LOOP (labels)
  /////////////////////////////////////////////////////////

  cy.on('render', () => {

    if (tickingLabels) return;

    tickingLabels = true;

    requestAnimationFrame(() => {
      renderNodeLabels();
      tickingLabels = false;
    });

  });

  /////////////////////////////////////////////////////////
  // 💾 WORKSPACE
  /////////////////////////////////////////////////////////

  const debouncedSave = debounce(saveWorkspace, 400);

  cy.on('pan zoom', debouncedSave);
  cy.on('dragfree', 'node', saveWorkspace);
  cy.on('tap', 'edge', saveWorkspace);

  applyWorkspace(graphData.workspace);

  /////////////////////////////////////////////////////////
  // 🏷 LABELS INIT
  /////////////////////////////////////////////////////////

  cy.ready(() => {
    renderNodeLabels();
  });

}

/////////////////////////////////////////////////////////
// 🧠 INTERACCIÓN EDGE
/////////////////////////////////////////////////////////

function setupEdgeInteraction(cy) {

  // 🔷 CLICK CHIP → filtrar concepto
  cy.on('tap', 'node[isChip]', (e) => {
    const chip = e.target;
    const conceptName = chip.data('label');
    toggleConceptFilter(conceptName, chip);
  });

  // 🔗 CLICK EDGE → expand/collapse
  cy.on('tap', 'edge', (e) => {

    const edge = e.target;
    const expanded = edge.data('expanded');

    expanded ? collapseEdge(edge) : expandEdge(edge);

    saveWorkspace();
  });
}

/////////////////////////////////////////////////////////
// 🚀 EXPAND EDGE → CREA CHIPS
/////////////////////////////////////////////////////////

function expandEdge(edge) {

  const concepts = edge.data('concepts') || [];
  if (!concepts.length) return;

  edge.data('expanded', true);

  const center = getEdgeCenter(edge);
  const spacing = 10;

  concepts.forEach((c, i) => {

    const center = getEdgeCenter(edge);
const spacing = 14; // podés ajustar

const total = concepts.length;

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

  });

  edge.data('conceptLabel', '•');
}

/////////////////////////////////////////////////////////
// ❌ COLLAPSE EDGE
/////////////////////////////////////////////////////////

function collapseEdge(edge) {

  cy.nodes().filter(n => n.data('parentEdge') === edge.id()).remove();

  edge.data('expanded', false);

  const count = edge.data('concepts')?.length || 0;
  edge.data('conceptLabel', count > 0 ? String(count) : '');
}

/////////////////////////////////////////////////////////
// 📍 UPDATE POSICIÓN CHIPS
/////////////////////////////////////////////////////////

function updateAllChips() {

  cy.nodes('[isChip]').forEach(chip => {

    const edge = cy.getElementById(chip.data('parentEdge'));
    if (!edge || edge.empty()) return;

    const center = getEdgeCenter(edge);
    const index = chip.data('index');

    const spacing = 8;

    chip.position({
      x: center.x,
      y: center.y - ((index + 1) * spacing)
    });

  });
}

/////////////////////////////////////////////////////////
// 📐 GEOMETRÍA
/////////////////////////////////////////////////////////

function getEdgeCenter(edge) {

  const src = edge.source().position();
  const tgt = edge.target().position();

  return {
    x: (src.x + tgt.x) / 2,
    y: (src.y + tgt.y) / 2
  };
}

/////////////////////////////////////////////////////////
// 🔎 FILTRO POR CONCEPTO
/////////////////////////////////////////////////////////

let ACTIVE_CONCEPT = null;

function toggleConceptFilter(conceptName, chip) {

  if (ACTIVE_CONCEPT === conceptName) {
    clearConceptFilter();
    return;
  }

  ACTIVE_CONCEPT = conceptName;

  cy.edges().forEach(edge => {

    const concepts = edge.data('concepts') || [];

    const match = concepts.some(c => c.name === conceptName);

    edge.toggleClass('highlighted', match);
    edge.toggleClass('dimmed', !match);

  });

  cy.nodes('[isChip]').removeClass('active');
  chip.addClass('active');
}

function clearConceptFilter() {

  ACTIVE_CONCEPT = null;

  cy.edges().removeClass('highlighted dimmed');
  cy.nodes('[isChip]').removeClass('active');
}

/////////////////////////////////////////////////////////
// 💾 WORKSPACE
/////////////////////////////////////////////////////////

function saveWorkspace() {

  const expandedEdges = [];

  cy.edges().forEach(edge => {
    if (edge.data('expanded')) {
      expandedEdges.push(edge.id());
    }
  });

  sendWorkspaceToAPI({
    zoom: cy.zoom(),
    pan: cy.pan(),
    expandedEdges
  });
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
// 🧭 UTIL
/////////////////////////////////////////////////////////

function debounce(fn, delay) {
  let t;
  return function () {
    clearTimeout(t);
    t = setTimeout(fn, delay);
  };
}

/////////////////////////////////////////////////////////
// 🏷 LABELS HTML (overlay)
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

    el.style.transform = `translate(-50%, -50%) scale(${zoom})`;
  });

  /////////////////////////////////////////////////////////
  // 🧹 CLEANUP LABELS
  /////////////////////////////////////////////////////////

  Object.keys(NODE_LABELS).forEach(id => {

    const exists = cy.getElementById(id).length > 0;

    if (!exists) {
      NODE_LABELS[id].remove();
      delete NODE_LABELS[id];
    }

  });
}

function getContrastColor(hex) {
  if (!hex) return '#111';

  const c = hex.replace('#', '');
  const r = parseInt(c.substr(0, 2), 16);
  const g = parseInt(c.substr(2, 2), 16);
  const b = parseInt(c.substr(4, 2), 16);

  const luminance = (0.299*r + 0.587*g + 0.114*b) / 255;

  return luminance > 0.6 ? '#111' : '#fff';
}