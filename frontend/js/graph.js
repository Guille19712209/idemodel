let cy = null;

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
          'arrow-scale': .7,
          'target-distance-from-node': .1
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
            'control-point-weights': [0.5],
            'arrow-scale': 1,
            'target-distance-from-node': .1
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
            'control-point-weights': [0.5],
            'arrow-scale': 1,
            'target-distance-from-node': .1
            
        }
      },
      {
        selector: 'edge[type="formula"]',
        style: {
          'width': 2,
          'line-color': '#4b4b4b',
          'target-arrow-color': '#4b4b4b',
          'target-arrow-shape': 'triangle',
          'curve-style': 'straight',
          'arrow-scale': 1,
          'target-distance-from-node': .1
        }
      }
    ],

    layout: {
      name: 'grid'
    }
  });
}







