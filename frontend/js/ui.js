/////////////////////
// 🧠 UI LAYER
/////////////////////

let CONCEPTS_MAP = {};
let VIEW_MODE = "ALL";

/////////////////////////////////////////////////////////
// 📊 TABLA (debug / opcional)
/////////////////////////////////////////////////////////

function renderData(data) {

  const container = document.getElementById("output");
  if (!container) return;

  container.innerHTML = "";

  if (!data || data.length === 0) return;

  const table = document.createElement("table");

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
// 🧠 EDGE UI (panel simple)
/////////////////////////////////////////////////////////

let CURRENT_EDGE = null;

function setupEdgeUI(cy) {

  // 👉 click derecho = edición
  cy.on('cxttap', 'edge', function(evt) {
    const edge = evt.target;
    CURRENT_EDGE = edge;
    openConceptPanel(edge.data());
  });

}

/////////////////////////////////////////////////////////
// 🧾 PANEL (prompt temporal)
/////////////////////////////////////////////////////////

function openConceptPanel(edge) {

  const name = prompt(
    `Agregar concepto al edge:\n${edge.source} → ${edge.target}`
  );

  if (!name) return;

  addConceptToEdge(edge.id, name);
}

/////////////////////////////////////////////////////////
// 🔗 CORE
/////////////////////////////////////////////////////////

function addConceptToEdge(edgeId, conceptName) {

  const conceptId = conceptName.toLowerCase().replace(/\s+/g, "_");

  /////////////////////////////////////////////////////////
  // 🌐 API CALL (JSONP)
  /////////////////////////////////////////////////////////

  const url = API_URL +
    "?action=addConceptLink" +
    "&edge_id=" + encodeURIComponent(edgeId.toLowerCase().trim()) +
    "&concept_id=" + encodeURIComponent(conceptId) +
    "&_=" + Date.now();

  // 🔥 limpiar scripts viejos
  document.querySelectorAll("script[data-api-temp]").forEach(s => s.remove());

  const script = document.createElement("script");
  script.setAttribute("data-api-temp", "1");
  script.src = url;

  document.body.appendChild(script);

  /////////////////////////////////////////////////////////
  // ⚡ UPDATE LOCAL INMEDIATO (UX rápida)
  /////////////////////////////////////////////////////////

  const edge = cy.getElementById(edgeId);

  let concepts = edge.data("concepts") || [];

  const exists = concepts.some(c => c.id === conceptId);

  if (!exists) {
    concepts.push({
      id: conceptId,
      name: conceptName,
      color: "#888"
    });
  }

  cy.batch(() => {
    edge.data("concepts", concepts);
    edge.data("conceptLabel", String(concepts.length));
  });

  /////////////////////////////////////////////////////////
  // 🔄 RELOAD (sync backend)
  /////////////////////////////////////////////////////////

  setTimeout(() => {
    loadData();
  }, 300); // 👈 pequeño delay evita choque visual
}