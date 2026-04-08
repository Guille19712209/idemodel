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

    userPanningEnabled: true,
    userZoomingEnabled: true,
    boxSelectionEnabled: false,
    autoungrabify: false,
    autolock: false,

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

      // 🔵 BASE EDGE + CONCEPT LABEL
      
      {
        selector: 'edge',
        style: {
          'width': 1,
          'line-color': '#4b4b4b',
          'target-arrow-color': '#4b4b4b',
          'target-arrow-shape': 'vee',
          'arrow-scale': .5,
          


          // TEXTO (número)
          'label': 'data(conceptLabel)',
          'color': '#747474',
          'font-size': 7,
          'text-valign': 'center',
          'text-halign': 'center',

          // 🔥 HACERLO CÍRCULO REAL
          'text-background-opacity': 1,
          'text-background-color': '#ffffff',
          

          // 🔥 CLAVE: padding controla el tamaño real
          'text-background-padding': 1,

          // 🔥 redondeo total → círculo
          'text-border-radius': 10,

          // POSICIÓN
          'text-rotation': 'autorotate'
        }

      },

      // 🟢 PARENT
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

      // ⚫ FORMULA
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

  // 🔥 asegurar render sincronizado
  setTimeout(() => {
    
  }, 0);

  setupEdgeInteraction(cy);

}