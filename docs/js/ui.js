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

async function addConceptToEdge(edgeId, conceptName) {

  const current = getState();
  const model_id = current.model_id;

  if (!model_id) {
    console.warn("No model_id in state");
    return;
  }

  // 1. buscar si ya existe
  let concept = Object.values(CONCEPTS_MAP)
    .find(c => c.label === conceptName);

  // 2. si no existe → crear
  if (!concept) {
    concept = await createConcept(conceptName, model_id);
  }

  if (!concept) return;

  // 3. linkear
  await linkConceptToEdge(edgeId, concept.id);

  // 4. reload (manteniendo tu flujo actual)
  setTimeout(() => {
    loadData_UI();
  }, 200);
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

function openConceptSelector(event, edgeId) {

  closeConceptSelector();

  const edge = cy.getElementById(edgeId);
  const currentConcepts = edge.data('concepts') || [];

  SELECTOR_STATE = {
    edgeId,
    selected: new Set(currentConcepts.map(c => c.id))
  };

  const list = Object.values(CONCEPTS_MAP);

  const items = list.map(c => renderConceptItem(c)).join('');

  const html = `
    <div id="concept-selector" class="concept-selector">
      <div class="concept-list">
        ${items}

        <div class="concept-divider"></div>

        <div class="concept-item create" onclick="openCreateConceptPanel()">
          <div class="chip-btn dark">+</div>
          <span>New concept</span>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", html);

  positionConceptSelector(event);

  setTimeout(() => {
    document.addEventListener("click", outsideConceptClick);
  }, 10);
}

/////////////////////////////////////////////////////////
// SELECT CONCEPT
/////////////////////////////////////////////////////////

function selectConcept(edgeId, conceptId) {

  const concept = CONCEPTS_MAP[conceptId];
  if (!concept) return;

  addConceptToEdge(edgeId, concept.label);
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

  
    console.log("OPEN EDGE PANEL", edge.id());
  
  const concepts = edge.data('concepts') || [];

  const source = edge.source().data('label') || edge.source().id();
  const target = edge.target().data('label') || edge.target().id();

  const rawType = edge.data('type');
const type = String(rawType || "manual").trim().toLowerCase();

console.log("TYPE DEBUG:", rawType, type);

 const chips = (concepts || []).map(c => {
  const textColor = getContrastColor(c.color || "#888");

  return `
    <div class="chip" style="background:${c.color || "#888"}; color:${textColor}">
      ${c.name || ""}
    </div>
  `;
}).join('');

  openPanel({
    title: "Connection",
    content: `
    <div class="panel-grid">

      <!-- HEADER -->
      <div class="panel-header">
        <div class="panel-title">Connection</div>
        <div class="panel-close" onclick="closePanel()">×</div>
      </div>

      <!-- LEFT -->
      <div class="panel-left col-left">

        <div class="panel-line">
          <span class="title">Between</span>
          <span class="regular">${source}</span>
          <span class="title">and</span>
          <span class="regular">${target}</span>
        </div>

        <div class="panel-line">
          <span class="title">Type</span>
          <span class="regular">${type}</span>
        </div>

      </div>

      <!-- DIVIDER -->
      <div class="panel-divider"></div>

      <!-- RIGHT -->
      <div class="panel-right col-right">

        <div class="panel-line">
          <span class="title">Concepts</span>
        </div>

        <div class="chips-row">
          ${chips || ""}
          <div class="chip-btn add dark" onclick="openConceptSelector(event, '${edge.id()}')">+</div>
        </div>

      </div>

      <!-- FOOTER -->
      <div class="panel-footer">

        ${
          type !== "formula"
            ? `<div class="panel-btn-danger" onclick="deleteEdge('${edge.id()}')">Delete</div>`
            : ''
        }

      </div>

    </div>
    `
   
  });

};

function openPanel({ title, content }) {

  const panel = document.getElementById('bottom-panel');
  const titleEl = document.getElementById('panel-title');
  const inner = document.getElementById('panel-inner');

  if (!panel || !inner) return;

  if (titleEl) {
    titleEl.innerText = title;
  }

  // 🔥 1. limpiar primero
  inner.innerHTML = "";

  // 🔥 2. abrir panel PRIMERO
  panel.classList.add('open');

  // 🔥 3. render DESPUÉS (clave)
  requestAnimationFrame(() => {
    inner.innerHTML = content;
  });
}

function closePanel() {


  if (typeof cy !== "undefined" && typeof collapseEdge === "function") {
    if (window.ACTIVE_EDGE) {
      collapseEdge(window.ACTIVE_EDGE);
      window.ACTIVE_EDGE = null;
    }
  }

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

  console.log("DATA COMPLETA:", data);

  if (typeof setState === "function") {
  const current = getState();

  setState({
    ...current,
    model_id: data.model_id
  });
}

  const currentPeriod = 1;

  // ==========================
  // 🔥 1. VALUES MAP (PRIMERO)
  // ==========================
  const valuesMap = {};
  (data.values || []).forEach(v => {
    valuesMap[`${v.node_id}_${v.period}`] = v;
  });

  // ==========================
  // 🔥 2. UNITS MAP
  // ==========================
  const unitsMap = Object.fromEntries(
    (data.units || []).map(u => [u.id, u])
  );

  // ==========================
  // 🔥 3. CONCEPTS MAP
  // ==========================
  const conceptsMap = Object.fromEntries(
    (data.concepts || []).map(c => [c.id, c])
  );

  CONCEPTS_MAP = conceptsMap;

  console.log("conceptsMap:", conceptsMap);

  // ==========================
  // 🔥 4. CONCEPTS POR LINK
  // ==========================
  const conceptsByLink = {};

    (data.linkConcepts || []).forEach(lc => {

      if (!conceptsByLink[lc.link_id]) {
        conceptsByLink[lc.link_id] = [];
      }

      const concept = conceptsMap[lc.concept_id];

      if (concept) {
        conceptsByLink[lc.link_id].push({
          id: concept.id,
          name: concept.label, // 🔥 IMPORTANTE
          color: concept.color || "#888"
        });
      }

    });

  console.log("conceptsByLink:", conceptsByLink);

  // ==========================
  // 🔥 5. NODES
  // ==========================
  const graphNodes = data.nodes.map(n => {

    const row = valuesMap[`${n.id}_${currentPeriod}`];
    const unit = unitsMap[n.unit_id];

    return {
      data: {
        id: n.id,
        label: n.label,
        value: row?.value || "",
        unit: unit?.name || ""
      },
      position: {
        x: n.x || 0,
        y: n.y || 0
      }
    };
  });

  // ==========================
  // 🔥 6. EDGES (CON CONCEPTS)
  // ==========================
  const graphEdges = data.links.map(l => {

  const concepts = conceptsByLink[l.id] || [];

  return {
    data: {
      id: l.id,
      source: l.source_id,
      target: l.target_id,
      type: l.type || "manual",
      concepts,
      conceptLabel: concepts.length > 0
        ? String(concepts.length)
        : ''
    }
  };
  
  if (typeof setState === "function") {
    const current = getState();

    setState({
      ...current,
      model_id: data.model_id
    });
  }
});

console.log("GRAPH EDGES:", graphEdges);

// ==========================
// 🔥 7. RENDER
// ==========================
window.renderGraph({
  nodes: graphNodes,
  edges: graphEdges
});


};

function mostrarNoAutorizado() {

  document.body.innerHTML = `
    <div style="
      display:flex;
      height:100vh;
      align-items:center;
      justify-content:center;
      font-family:sans-serif;
      background:#111;
      color:white;
      text-align:center;
    ">
      <div>
        <h2>Acceso no habilitado</h2>
        <p>Tu usuario aún no está registrado en idemodel.</p>
      </div>
    </div>
  `;
}

function positionConceptSelector(event) {

  const el = document.getElementById("concept-selector");
  if (!el) return;

  const rect = event.target.getBoundingClientRect();

  el.style.position = "absolute";
  el.style.left = rect.left + "px";
  el.style.top = (rect.top - 10) + "px";
}

function outsideConceptClick(e) {

  const el = document.getElementById("concept-selector");

  if (!el) return;

  if (!el.contains(e.target)) {
    closeConceptSelector();
  }
}

function closeConceptSelector() {
  const el = document.getElementById("concept-selector");
  if (el) el.remove();

  document.removeEventListener("click", outsideConceptClick);
}

function selectConcept(edgeId, conceptId) {

  closeConceptSelector();

  const concept = CONCEPTS_MAP[conceptId];
  if (!concept) return;

  addConceptToEdge(edgeId, concept.label);
}

function renderConceptItem(c) {

  const isSelected = SELECTOR_STATE.selected.has(c.id);

  return `
    <div 
      class="concept-item ${isSelected ? 'selected' : ''}"
      onclick="toggleConcept('${c.id}')"
    >
      <div class="chip" style="background:${c.color}">
        ${c.label}
      </div>
    </div>
  `;
}

async function toggleConcept(conceptId) {

  const { edgeId, selected } = SELECTOR_STATE;

  const edge = cy.getElementById(edgeId);
  if (!edge || edge.empty()) return;

  let concepts = edge.data('concepts') || [];

  // =========================
  // REMOVE
  // =========================
  if (selected.has(conceptId)) {

    selected.delete(conceptId);

    concepts = concepts.filter(c => c.id !== conceptId);

  } 
  // =========================
  // ADD
  // =========================
  else {

    selected.add(conceptId);

    const concept = CONCEPTS_MAP[conceptId];
    if (!concept) return;

    concepts.push({
      id: concept.id,
      name: concept.label,
      color: concept.color || "#888"
    });

    await linkConceptToEdge(edgeId, conceptId);
  }

  // =========================
  // UPDATE EDGE DATA
  // =========================
  edge.data('concepts', concepts);

  edge.data(
    'conceptLabel',
    concepts.length > 0 ? String(concepts.length) : ''
  );

  // =========================
  // REFRESH CHIPS (grafo)
  // =========================
  if (edge.data('expanded')) {
    collapseEdge(edge);
    expandEdge(edge);
  }

  // =========================
  // REFRESH PANEL
  // =========================
  if (window.ACTIVE_EDGE && window.ACTIVE_EDGE.id() === edgeId) {
    openEdgePanel(edge);
  }

  // =========================
  // REFRESH SELECTOR
  // =========================
  refreshConceptSelector();
}

function refreshConceptSelector() {

  const list = Object.values(CONCEPTS_MAP);
  const container = document.querySelector(".concept-list");

  if (!container) return;

  const items = list.map(c => renderConceptItem(c)).join('');

  container.innerHTML = `
    ${items}
    <div class="concept-divider"></div>
    <div class="concept-item create" onclick="openCreateConceptPanel()">
      <div class="chip-btn dark">+</div>
      <span class="title">New concept</span>
    </div>
  `;
}