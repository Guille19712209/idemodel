let CONCEPTS_MAP = {};
let VIEW_MODE = "ALL";

function renderData(data) {

  const container = document.getElementById("output");
  container.innerHTML = "";

  if (!data || data.length === 0) return;

  const table = document.createElement("table");
  table.border = "1";

  const headerRow = document.createElement("tr");

  Object.keys(data[0]).forEach(key => {
    const th = document.createElement("th");
    th.innerText = key;
    headerRow.appendChild(th);
  });

  table.appendChild(headerRow);

  data.forEach(row => {

    if (!row.id) return;

    const tr = document.createElement("tr");

    Object.keys(data[0]).forEach(key => {
      const td = document.createElement("td");
      td.innerText = row[key] ?? "";
      tr.appendChild(td);
    });

    table.appendChild(tr);
  });

  container.appendChild(table);
}

let CURRENT_EDGE = null;

function setupEdgeInteraction(cy) {
  cy.on('tap', 'edge', function(evt) {
    const edge = evt.target.data();
    CURRENT_EDGE = edge;
    openConceptPanel(edge);
  });
}

// ======================
// PANEL
// ======================
function openConceptPanel(edge) {

  let name = prompt(
    `Agregar concepto al edge:\n${edge.source} → ${edge.target}`
  );

  if (!name) return;

  addConceptToEdge(edge.id, name);
}

// ======================
// CORE
// ======================
async function addConceptToEdge(edgeId, conceptName) {

  const conceptId = conceptName.toLowerCase().replace(/\s+/g, "_");

  const url = API_URL +
    "?action=addConceptLink" +
    "&edge_id=" + encodeURIComponent(edgeId.toLowerCase().trim()) +
    "&concept_id=" + encodeURIComponent(conceptId) +
    "&_=" + Date.now();

  const script = document.createElement("script");
  script.src = url;
  document.body.appendChild(script);

  const edge = cy.getElementById(edgeId);

  let concepts = edge.data("concepts") || [];

  if (!concepts.includes(conceptId)) {
    concepts.push(conceptId);
  }

  let label = "";
  if (concepts.length === 1) label = "●";
  if (concepts.length > 1) label = "●" + concepts.length;

  cy.batch(() => {
    edge.data("concepts", concepts);
    edge.data("conceptLabel", label);
  });

  loadData();
}

function setupEdgeInteraction(cy) {

  cy.on('tap', 'edge', function(evt) {

    const edge = evt.target;
    const data = edge.data();

    const expanded = data.expanded;

    if (expanded) {

      edge.data('conceptLabel',
        String(data.concepts?.length || 0)
      );

      edge.data('expanded', false);

    } else {

      const text = (data.concepts || [])
        .map(id => CONCEPTS_MAP[id]?.name || id)
        .join('\n');

      edge.data('conceptLabel', text);
      edge.data('expanded', true);
    }

  });

}