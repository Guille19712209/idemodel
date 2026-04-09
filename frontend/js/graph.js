

/////////////////////////////////////////////////////////
// ARCHIVO graph.js
/////////////////////////////////////////////////////////


let cy = null;
let NODE_LABELS = {};
let tickingChips = false;
let tickingLabels = false;

function renderGraph(graphData) {

  console.log("ENTRA renderGraph");
  console.log("graphData:", graphData);

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
    autoungrabify: false,
    autolock: false,

    style: [
      {
        selector: 'node',
        style: {
          'label': '',
          'font-family': 'Poppins',
          'background-color': '#007bff',
          'color': '#fff',
          'text-valign': 'center',
          'text-halign': 'center',
          'width': '80px',
          'height': '80px'
        }
      },

      // 🔷 CHIPS (tags tipo Notion)
      {
        
        selector: 'node[isChip]',
        style: {
          'label': 'data(label)',
          'background-color': 'data(color)',
          'shape': 'round-rectangle',

          'padding': '1px',
          'font-size': 5,
          'color': '#fff',

          'text-valign': 'center',
          'text-halign': 'center',

          'height': 6,
          'width': 'label',

          'font-family': 'Poppins'
        }

      },

      // 🔵 BASE EDGE + CONCEPT LABEL
      {
        selector: 'edge',
        style: {
          'width': 1,
          'line-color': '#4b4b4b',
          'target-arrow-color': '#4b4b4b',
          'target-arrow-shape': 'vee',
          'arrow-scale': .5,

          'label': 'data(conceptLabel)',
          'font-family': 'Poppins',
          'color': '#747474',
          'font-size': 7,
          'text-valign': 'center',
          'text-halign': 'center',

          'text-background-opacity': 1,
          'text-background-color': '#ffffff',
          'text-background-padding': 1,
          'text-border-radius': 10,

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
          'arrow-scale': .5,
          'target-distance-from-node': .1
        }
      },

      {
        selector: 'edge.dimmed',
        style: {
          'opacity': 0.1
        }
      },
      {
        selector: 'edge.highlighted',
        style: {
          'width': 3,
          'line-color': '#ff9800',
          'target-arrow-color': '#ff9800'
        }
      },
      {
        selector: 'node[isChip].active',
        style: {
          'border-width': 1,
          'border-color': '#727272'
        }
      },

      {
        selector: 'edge[type="formula"]',
        style: {
          'width': 1,
          'line-color': '#4b4b4b',
          'target-arrow-color': '#4b4b4b',
          'target-arrow-shape': 'triangle',
          'curve-style': 'straight',
          'arrow-scale': .5,
          'target-distance-from-node': .1
        }
      }
    ],

    layout: {
      name: 'preset'
    }
  });

  setupEdgeInteraction(cy);


  // 🔥 SINCRONIZAR CHIPS CON EL RENDER (FIX DEFINITIVO)



  cy.on('render', () => {

    if (tickingChips) return;

    tickingChips = true;

    requestAnimationFrame(() => {
      updateAllChips();
      tickingChips = false;
    });

  });

  cy.on('dragfree', 'node', () => {
  saveNodePositions();
  });

  cy.on('zoom pan', debounce(saveWorkspace, 300));
  
  cy.on('tap', 'edge', () => saveWorkspace());

  applyWorkspace(graphData.workspace);

  const debouncedSave = debounce(saveWorkspace, 400);

  cy.on('pan zoom', debouncedSave);

  cy.on('dragfree', 'node', () => {
  saveWorkspace();
  });

  cy.ready(() => {
  renderNodeLabels();
});

cy.on('render', () => {

  if (tickingLabels) return;

  tickingLabels = true;

  requestAnimationFrame(() => {
    renderNodeLabels();
    tickingLabels = false;
  });

});

}

/////////////////////////////////////////////////////////
// 🧠 INTERACCIÓN EDGE
/////////////////////////////////////////////////////////

function setupEdgeInteraction(cy) {
  
  cy.on('tap', 'node[isChip]', (e) => {

  const chip = e.target;
  const conceptName = chip.data('label');

  toggleConceptFilter(conceptName, chip);

  });
  
  
  cy.on('tap', 'edge', (e) => {

  const edge = e.target;

  const isExpanded = edge.data('expanded') === true;

  if (isExpanded) {
    collapseEdge(edge);
  } else {
    expandEdge(edge);
  }
  saveWorkspace();
  });


}

/////////////////////////////////////////////////////////
// 🚀 EXPAND
/////////////////////////////////////////////////////////

function expandEdge(edge) {

  const concepts = edge.data('concepts') || [];
  if (!concepts.length) return;

  edge.data('expanded', true);

  const center = getEdgeCenter(edge);
  const spacing = 9;

  concepts.forEach((c, i) => {

    const pos = {
      x: center.x,
      y: center.y - ((i + 1) * spacing)
    };

    cy.add({
      group: 'nodes',
      data: {
        id: `chip_${edge.id()}_${i}_${Date.now()}`, // 🔥 único SIEMPRE
        parentEdge: edge.id(),
        index: i,
        label: c.name,
        color: c.color || '#888',
        isChip: true
      },
      position: pos
    });

  });

  // 🔵 dot chico manual
  edge.data('conceptLabel', '•');
}

/////////////////////////////////////////////////////////
// ❌ COLLAPSE
/////////////////////////////////////////////////////////

function collapseEdge(edge) {

  cy.nodes().filter(n => n.data('parentEdge') === edge.id()).remove();

  edge.data('expanded', false);

  const count = edge.data('concepts')?.length || 0;

  edge.data('conceptLabel', count > 0 ? String(count) : '');
}

/////////////////////////////////////////////////////////
// 📍 UPDATE POSITIONS
/////////////////////////////////////////////////////////

function updateAllChips() {

  cy.nodes('[isChip]').forEach(chip => {

    const edgeId = chip.data('parentEdge');
    const index = chip.data('index');

    const edge = cy.getElementById(edgeId);
    if (!edge || edge.empty()) return;

    const center = getEdgeCenter(edge);

    const spacing = 9;

    chip.position({
      x: center.x,
      y: center.y - ((index + 1) * spacing)
    });

  });
}

/////////////////////////////////////////////////////////
// 🧮 EDGE GEOMETRY
/////////////////////////////////////////////////////////

function getEdgePoints(edge) {

  const src = edge.source().position();
  const tgt = edge.target().position();

  const curveStyle = edge.style('curve-style');

  // 🔥 si es recto
  if (curveStyle === 'straight') {
    return { p0: src, p1: midpoint(src, tgt), p2: tgt };
  }

  // 🔥 si es curva → mejor aproximación
  const mid = edge.midpoint();

  return {
    p0: src,
    p1: mid,
    p2: tgt
  };
}

function midpoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2
  };
}

function interpolateEdge({ p0, p1, p2 }, t) {
  // curva cuadrática (bezier)

  const x =
    (1 - t) * (1 - t) * p0.x +
    2 * (1 - t) * t * p1.x +
    t * t * p2.x;

  const y =
    (1 - t) * (1 - t) * p0.y +
    2 * (1 - t) * t * p1.y +
    t * t * p2.y;

  return { x, y };
}

/////////////////////////////////////////////////////////
// 📐 DISTRIBUCIÓN (NO OVERLAP)
/////////////////////////////////////////////////////////

function computeT(i, total) {

  if (total === 1) return 0.5;

  const margin = 0.3; // 🔥 más espacio en extremos
  const usable = 1 - margin * 2;

  return margin + (i / (total - 1)) * usable;
}

/////////////////////////////////////////////////////////
// 📐 DISTRIBUCIÓN (NO OVERLAP)
/////////////////////////////////////////////////////////


function getEdgeCenter(edge) {

  const src = edge.source().position();
  const tgt = edge.target().position();

  return {
    x: (src.x + tgt.x) / 2,
    y: (src.y + tgt.y) / 2
  };
}


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

    if (match) {
      edge.addClass('highlighted');
      edge.removeClass('dimmed');
    } else {
      edge.addClass('dimmed');
      edge.removeClass('highlighted');
    }

  });

  cy.nodes('[isChip]').removeClass('active');
  chip.addClass('active');
}

function clearConceptFilter() {

  ACTIVE_CONCEPT = null;

  cy.edges().removeClass('highlighted');
  cy.edges().removeClass('dimmed');

  cy.nodes('[isChip]').removeClass('active');
}


function saveNodePositions() {

  const positions = {};

  cy.nodes().forEach(node => {
    const pos = node.position();

    positions[node.id()] = {
      x: pos.x,
      y: pos.y
    };
  });

  sendPositionsToAPI(positions);
}

function saveWorkspace() {

  console.log("saving workspace...");

  const expandedEdges = [];

  cy.edges().forEach(edge => {
    if (edge.data('expanded')) {
      expandedEdges.push(edge.id());
    }
  });

  const workspace = {
    zoom: cy.zoom(),
    pan: cy.pan(),
    expandedEdges
  };

  sendWorkspaceToAPI(workspace);
}

function debounce(fn, delay) {
  let t;
  return function () {
    clearTimeout(t);
    t = setTimeout(fn, delay);
  };
}

function applyWorkspace(workspace) {

  if (!workspace) return;

  // 🔍 zoom
  if (workspace.zoom) {
    cy.zoom(workspace.zoom);
  }

  // 🧭 pan
  if (workspace.pan) {
    cy.pan(workspace.pan);
  }

  // 🔗 edges expandidos
  if (workspace.expandedEdges) {

    workspace.expandedEdges.forEach(id => {

      const edge = cy.getElementById(id);

      if (edge && edge.length) {
        expandEdge(edge);
      }

    });

  }
}

function renderNodeLabels() {

  const container = document.getElementById('node-label-layer');
  const zoom = cy.zoom();

  cy.nodes().not('[isChip]').forEach(node => {

    const id = node.id();
    const data = node.data();
    const pos = node.renderedPosition(); // ✅ incluye pan + zoom

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

    // 🔥 SOLO centrar, SIN SCALE
    el.style.transform = `
    translate(-50%, -50%)
    scale(${zoom})
`   ;
  });
}

Object.keys(NODE_LABELS).forEach(id => {

  const exists = cy.getElementById(id).length > 0;

  if (!exists) {
    NODE_LABELS[id].remove();
    delete NODE_LABELS[id];
  }

});