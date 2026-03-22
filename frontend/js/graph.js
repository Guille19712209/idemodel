let cy = null;

function renderGraph(data) {

  if (cy) cy.destroy();

  const nodes = data
    .filter(row => row.id)
    .map(row => ({
      data: {
        id: String(row.id),
        label: row.label
      }
    }));

  // 👉 EDGES POR PARENT
  const edges = data
    .filter(row => row.parent && String(row.parent).trim() !== "")
    .map((row, i) => ({
      data: {
        id: "p_" + i,
        source: String(row.parent),
        target: String(row.id),
        type: "parent"
      }
    }));

  const conceptEdges = buildConceptEdges(data);
  
  cy = cytoscape({
    container: document.getElementById('graph'),

    elements: [...nodes, ...edges, ...conceptEdges],

    style: [
      {
        selector: 'node',
        style: {
          'label': 'data(label)',
          'background-color': '#007bff',
          'color': '#fff',
          'text-valign': 'center',
          'text-halign': 'center',
          'width': '80px',
          'height': '80px'
        }
      },
      {
        selector: 'edge',
        style: {
          'width': 2,
          'line-color': '#00aa00',
          'target-arrow-color': '#00aa00',
          'target-arrow-shape': 'triangle',
          'arrow-scale': 1.5,
          'target-distance-from-node': 1
        }
      },
      {
        selector: 'edge[type="parent"]',
        style: {
            'line-color': '#a2c1cf',
            'target-arrow-color': '#a2c1cf',
            'target-arrow-shape': 'triangle','arrow-scale': 1.5,
            'target-distance-from-node': 1,
            'curve-style': 'unbundled-bezier',
            'control-point-distances': [-30],
            'control-point-weights': [0.5]
        }
      },
      {
        selector: 'edge[type="concept"]',
        style: {
            'width': 2,
            'line-color': '#83c583',
            'target-arrow-color': '#83c583',
            'line-style': 'dashed',
            'curve-style': 'unbundled-bezier',
            'target-distance-from-node': 1,
            'control-point-distances': [-30],
            'control-point-weights': [0.5]
            
        }
}
    ],

    layout: {
      name: 'grid'
    }
  });
}

function buildEdges(nodes, model) {

  const edges = [];

  // 1️⃣ parent
  nodes.forEach(n => {
    if (n.parent) {
      edges.push({
        data: {
          id: "parent_" + n.id,
          source: n.parent,
          target: n.id,
          type: "parent"
        }
      });
    }
  });

  // 2️⃣ concept
  const conceptGroups = {};

  nodes.forEach(n => {
    if (!n.concept) return;

    if (!conceptGroups[n.concept]) {
      conceptGroups[n.concept] = [];
    }

    conceptGroups[n.concept].push(n.id);
  });

  Object.values(conceptGroups).forEach(group => {
    if (group.length < 2) return;

    for (let i = 1; i < group.length; i++) {
      edges.push({
        data: {
          id: "concept_" + group[0] + "_" + group[i],
          source: group[0],
          target: group[i],
          type: "concept"
        }
      });
    }
  });

  // 3️⃣ formulas (placeholder por ahora)
  // después parseamos fórmulas

  return edges;
}

function buildConceptEdges(data) {

  return data
    .filter(n => n.concept && String(n.concept).trim() !== "")
    .map((n, i) => ({
      data: {
        id: "c_" + i,
        source: String(n.concept), // 👈 referencia a otro nodo
        target: String(n.id),
        type: "concept"
      }
    }));
}