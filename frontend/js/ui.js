/////////////////////
// ARCHIVO ui.js
/////////////////////

let CONCEPTS_MAP = {};
let VIEW_MODE = "ALL";

/////////////////////////////////////////////////////////
// 📊 TABLA
/////////////////////////////////////////////////////////

function renderData(data) {

  const container = document.getElementById("output");

  
  if (!container) return;

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

/////////////////////////////////////////////////////////
// 🧠 PANEL (AGREGAR CONCEPTO)
/////////////////////////////////////////////////////////

let CURRENT_EDGE = null;

// ⚠️ IMPORTANTE:
// esta función ahora SOLO abre el panel
// la interacción de expand/collapse vive en graph.js

function setupEdgeUI(cy) {

  cy.on('cxttap', 'edge', function(evt) {
    // 👉 click derecho para editar (no interfiere con expand)
    const edge = evt.target;
    CURRENT_EDGE = edge;
    openConceptPanel(edge.data());
  });

}

/////////////////////////////////////////////////////////
// 🧾 PANEL PROMPT
/////////////////////////////////////////////////////////

function openConceptPanel(edge) {

  let name = prompt(
    `Agregar concepto al edge:\n${edge.source} → ${edge.target}`
  );

  if (!name) return;

  addConceptToEdge(edge.id, name);
}

/////////////////////////////////////////////////////////
// 🔗 CORE
/////////////////////////////////////////////////////////

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

  // 🔥 ahora concepts son objetos → adaptar
  const exists = concepts.some(c => c.id === conceptId);

  if (!exists) {
    concepts.push({
      id: conceptId,
      name: conceptName,
      color: "#888" // fallback hasta reload
    });
  }

  cy.batch(() => {
    edge.data("concepts", concepts);
    edge.data("conceptLabel", String(concepts.length));
  });

  // 🔄 recargar para sincronizar con backend
  loadData();
}