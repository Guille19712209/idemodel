/////////////////////
// UI LAYER
/////////////////////

let CONCEPTS_MAP = {};
let VIEW_MODE = "ALL";

const API_URL = "";

/////////////////////////////////////////////////////////
// DATA TABLE (debug / optional)
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
// EDGE UI (basic panel trigger)
/////////////////////////////////////////////////////////

let CURRENT_EDGE = null;

function setupEdgeUI(cy) {

  // right click → edit
  cy.on('cxttap', 'edge', function(evt) {
    const edge = evt.target;
    CURRENT_EDGE = edge;
    openConceptPrompt(edge.data());
  });

}

/////////////////////////////////////////////////////////
// PROMPT (temporary)
/////////////////////////////////////////////////////////

function openConceptPrompt(edge) {

  const name = prompt(
    `Add concept to edge:\n${edge.source} → ${edge.target}`
  );

  if (!name) return;

  addConceptToEdge(edge.id, name);
}

/////////////////////////////////////////////////////////
// CORE
/////////////////////////////////////////////////////////

function addConceptToEdge(edgeId, conceptName) {

  const conceptId = conceptName.toLowerCase().replace(/\s+/g, "_");

  /////////////////////////////////////////////////////////
  // API CALL (JSONP)
  /////////////////////////////////////////////////////////

  const url = API_URL +
    "?action=addConceptLink" +
    "&edge_id=" + encodeURIComponent(edgeId.toLowerCase().trim()) +
    "&concept_id=" + encodeURIComponent(conceptId) +
    "&_=" + Date.now();

  // remove old temp scripts
  document.querySelectorAll("script[data-api-temp]").forEach(s => s.remove());

  const script = document.createElement("script");
  script.setAttribute("data-api-temp", "1");
  script.src = url;

  document.body.appendChild(script);

  /////////////////////////////////////////////////////////
  // LOCAL UPDATE (instant UX)
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
  // RELOAD (sync with backend)
  /////////////////////////////////////////////////////////

  setTimeout(() => {
    loadData_UI();
  }, 300);
}

/////////////////////////////////////////////////////////
// PANEL CONTROL
/////////////////////////////////////////////////////////



/////////////////////////////////////////////////////////
// CREATE CONCEPT PANEL
/////////////////////////////////////////////////////////

function openCreateConceptPanel() {

  openPanel({
    title: "New concept",
    content: `
      <input id="new-concept" placeholder="Concept name"/>
      <button onclick="saveConcept()">Create</button>
    `
  });
}

/////////////////////////////////////////////////////////
// ADD INLINE CONCEPT
/////////////////////////////////////////////////////////

function addConceptInline(edgeId) {

  const input = document.getElementById('new-concept');
  const name = input.value.trim();

  if (!name) return;

  addConceptToEdge(edgeId, name);

  input.value = "";
}

/////////////////////////////////////////////////////////
// CONCEPT SELECTOR
/////////////////////////////////////////////////////////

function openConceptSelector(edgeId) {

  const list = Object.values(CONCEPTS_MAP);

  const items = list.map(c => `
    <div 
      class="chip" 
      style="background:${c.color}"
      onclick="selectConcept('${edgeId}','${c.id}')"
    >
      ${c.name}
    </div>
  `).join('');

  openPanel({
    title: "Select concept",
    content: `
      <div>${items}</div>

      <div style="margin-top:10px;">
        <div 
          class="chip" 
          onclick="openCreateConceptPanel()"
        >
          + new concept
        </div>
      </div>
    `
  });
}

/////////////////////////////////////////////////////////
// SELECT CONCEPT
/////////////////////////////////////////////////////////

function selectConcept(edgeId, conceptId) {

  const concept = CONCEPTS_MAP[conceptId];
  if (!concept) return;

  addConceptToEdge(edgeId, concept.name);
}

/////////////////////////////////////////////////////////
// SAVE CONFIG KEYS
/////////////////////////////////////////////////////////

function saveConfig(key, value) {

  const url = API_URL +
    "?action=saveConfig" +
    "&key=" + encodeURIComponent(key) +
    "&value=" + encodeURIComponent(value) +
    "&_=" + Date.now();

  const script = document.createElement("script");
  script.src = url;
  document.body.appendChild(script);
}

function deleteEdge(edgeId) {

  const edge = cy.getElementById(edgeId);
  if (!edge || edge.empty()) return;

  // 🔥 1. remover visual inmediato
  collapseEdge(edge);   // por si está expandido
  // 🔥 fade out
  edge.animate({
    style: { opacity: 0 },
    duration: 300
  });

  // 🔥 remover después
  setTimeout(() => {
    collapseEdge(edge);
    cy.remove(edge);
  }, 300);

  // 🔥 2. persistir en background
  const url = API_URL +
    "?action=deleteEdge" +
    "&edge_id=" + encodeURIComponent(edgeId) +
    "&_=" + Date.now();

  const script = document.createElement("script");

  script.src = url;

  script.onerror = () => {
    console.warn("Delete failed, reloading...");
    loadData_UI();
  };

  document.body.appendChild(script);

  closePanel();
}

function removeManualRelation(edge) {

  const sourceId = edge.source().id();
  const targetId = edge.target().id();

  const url = API_URL +
    "?action=deleteManualRelation" +
    "&source=" + encodeURIComponent(sourceId) +
    "&target=" + encodeURIComponent(targetId) +
    "&_=" + Date.now();

  const script = document.createElement("script");
  script.src = url;
  document.body.appendChild(script);

}


window.openEdgePanel = function(edge) {

  const concepts = edge.data('concepts') || [];

  const source = edge.source().data('label') || edge.source().id();
  const target = edge.target().data('label') || edge.target().id();

  const type = edge.data('type') ?? "manual";

  const chips = concepts.map(c => {

    const textColor = getContrastColor(c.color);

    return `
      <div class="chip" style="background:${c.color}; color:${textColor}">
        ${c.name}
      </div>
    `;
  }).join('');

  openPanel({
    title: "Connection",
    content: `
      <div class="panel-grid">

        <!-- LEFT -->
        <div class="col-4 panel-block panel-left">

          <div class="row">
            <span class="label">Between</span>
            <span class="value">${source} → ${target}</span>
          </div>

          <div class="row">
            <span class="label">Type</span>
            <span class="value">${type}</span>
          </div>

          ${ type !== "formula"
            ? `<div style="margin-top:10px;">
                <div class="panel-btn-danger"
                    onclick="deleteEdge('${edge.id()}')">
                  Delete
                </div>
              </div>`
              : ``
            }

        </div>

        <!-- RIGHT -->
        <div class="col-8 panel-block">

          <div class="row">
            <span class="label">Concepts</span>
          </div>

          <div class="chips-row">
            ${chips}

            <div class="chip" onclick="openConceptSelector('${edge.id()}')">
              +
            </div>
          </div>

        </div>

      </div>
    `
  });

};

function openPanel({ title, content }) {

  const panel = document.getElementById('bottom-panel');
  const titleEl = document.getElementById('panel-title');
  const inner = document.getElementById('panel-inner');

  if (!panel || !titleEl || !inner) return;

  titleEl.innerText = title;
  inner.innerHTML = content;

  panel.classList.add('open');
}

function closePanel() {

  const panel = document.getElementById('bottom-panel');
  const inner = document.getElementById('panel-inner');

  if (!panel) return;

  panel.classList.remove('open');

  if (inner) inner.innerHTML = '';

 
}


function hideLoader() {
  const el = document.getElementById("loader");
  if (!el) return;

  el.classList.add("hidden");

  setTimeout(() => {
    el.remove(); // 🔥 limpia DOM
  }, 300);
}

window.handleData = function(data) {

  console.log("DATA RECIBIDA:", data);

  // 🔻 ocultar loader
  const loader = document.getElementById("loader");
  if (loader) loader.style.display = "none";

  // 🔥 adaptar datos para el grafo
  const graphData = {
    nodes: (data.nodes || []).map(n => ({
      data: {
        id: n.id,
        label: n.label
      },
      position: {
        x: n.x || 0,
        y: n.y || 0
      }
    })),

    edges: [] // 🔥 por ahora vacío
  };

  console.log("GRAPH DATA:", graphData);

  // 🔻 render
  if (window.renderGraph) {
    window.renderGraph(graphData);
  } else {
    console.error("renderGraph no existe");
  }
};