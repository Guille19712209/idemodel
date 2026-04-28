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

  closeConceptSelector();

  const activeConcepts = Object.values(CONCEPTS_MAP || {});

  const activeList = activeConcepts.map(c => {
    const textColor = getContrastColor(c.color || "#888");

    return `
      <div class="concept-row">

        <div class="chip removable"
             style="background:${c.color}; color:${textColor}">
          ${c.label}
          <span class="chip-remove"
                onclick="deleteConcept('${c.id}')">×</span>
        </div>

      </div>
    `;
  }).join('');

  openPanel({
    title: "Concepts",
    content: `
      <div class="panel">

      <!-- HEADER -->
      <div class="panel-header">
        <div class="title">Concepts</div>
      </div>

      <!-- BODY -->
      <div class="panel-body">

        <!-- LEFT -->
        <div class="panel-left col">

          <div class="row-top">
            <div class="text">In model</div>

            <div class="col grow">
              <div class="list scroll-y">
                ${activeList}
              </div>
            </div>
          </div>

        </div>

        <!-- DIVIDER -->
        <div class="panel-divider"></div>

        <!-- RIGHT -->
        <div class="panel-right">
         <div class="form-row">

  <div class="form-group name">
    <span class="text">Name</span>
    <input id="concept-name" class="panel-input"/>
  </div>

  <div class="form-group color">
    <span class="text">Color</span>
    <div id="color-preview"
         class="color-box"
         onclick="openColorSelector(event)">
    </div>
  </div>

  <div class="form-group description">
    <span class="text">Description</span>
    <textarea id="concept-comment" class="panel-input"></textarea>
  </div>

</div>

        </div>

      </div>

      <!-- FOOTER -->
      <div class="panel-footer footer-right">
        <div class="btn btn-dark" onclick="saveConcept()">Create</div>
      </div>

    </div>      
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

      <div class="concept-list-scroll">
        ${items}
      </div>

      <div class="concept-footer">
        <div class="concept-item create" onclick="event.stopPropagation(); openCreateConceptPanel()">
          <div class="chip-btn dark">+</div>
          <span class="regular">New concept</span>
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
    <div class="chip removable"
         style="background:${c.color || "#888"}; color:${textColor}">

      <span>${c.name || ""}</span>

      <span class="chip-remove"
            onclick="removeConceptFromPanel('${edge.id()}','${c.id}')">
        ×
      </span>
    </div>
    `;
  }).join('');

  openPanel({
    title: "Connection",
    content: `
    <div class="panel-grid panel-edge">

      <!-- HEADER -->
      <div class="panel-header">
        <div class="panel-title">Connection</div>
        <div class="panel-close" onclick="closePanel()">×</div>
      </div>

      <!-- LEFT -->
      <div class="panel-left col-left">

        <div class="panel-line inline">
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

  const buttonRect = event.target.getBoundingClientRect();
  const panel = document.getElementById("bottom-panel");
  const panelRect = panel.getBoundingClientRect();

  el.style.position = "absolute";

  // misma X que el botón
  el.style.left = buttonRect.left + "px";

  // 🔥 alineado al top del panel + margen
  el.style.top = (panelRect.top + 20) + "px";
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

function renderConceptItem(c, isSelected) {
  return `
    <div class="concept-item ${isSelected ? 'selected' : ''}"
         onclick="toggleConcept('${c.id}')">
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

  await unlinkConceptFromEdge(edgeId, conceptId);
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

  const items = list.map(c => {
    const isSelected = selectedConcepts.has(c.id);   // 🔥 CLAVE
    return renderConceptItem(c, isSelected);
  }).join('');

  container.innerHTML = `
    ${items}
    <div class="concept-divider"></div>
    <div class="concept-item create" onclick="openCreateConceptPanel()">
      <div class="chip-btn dark">+</div>
      <span class="title">New concept</span>
    </div>
  `;
}

async function removeConceptFromPanel(edgeId, conceptId) {

  const edge = cy.getElementById(edgeId);
  if (!edge || edge.empty()) return;

  let concepts = edge.data('concepts') || [];

  // 1) actualizar estado local del edge
  concepts = concepts.filter(c => c.id !== conceptId);

  edge.data('concepts', concepts);
  edge.data(
    'conceptLabel',
    concepts.length > 0 ? String(concepts.length) : ''
  );

  // 2) persistencia en backend
  await unlinkConceptFromEdge(edgeId, conceptId);

  // 3) refrescar grafo (chips sobre edge)
  if (edge.data('expanded')) {
    collapseEdge(edge);
    expandEdge(edge);
  }

  // 4) refrescar panel
  openEdgePanel(edge);
}

function outsideConceptClick(e) {

  const el = document.getElementById("concept-selector");
  if (!el) return;

  // 🔥 SI clic dentro del selector → NO cerrar
  if (el.contains(e.target)) return;

  closeConceptSelector();
}

async function saveConcept() {

  const name = document.getElementById("concept-name").value.trim();
  const color = document.getElementById("concept-color").value;
  const comment = document.getElementById("concept-comment").value.trim();

  if (!name) return;

  const { model_id } = getState();

  const concept = await createConcept(name, model_id, color, comment);

  if (!concept) return;

  CONCEPTS_MAP[concept.id] = concept;

  if (window.ACTIVE_EDGE) {
    await linkConceptToEdge(window.ACTIVE_EDGE.id(), concept.id);
  }

  closePanel();

}

window.openColorPicker = function () {
  const input = document.getElementById("concept-color");
  if (input) input.click();
};

window.updateColorPreview = function (color) {
  const el = document.getElementById("color-preview");
  if (el) el.style.background = color;
};

function openColorSelector(event) {

  closeColorSelector();

  const colors = ["#888","#2563eb","#16a34a","#f59e0b","#ef4444","#8b5cf6","#6d3e0e","#ee5cf6"];

  const html = `
    <div id="color-selector" class="color-selector">
      ${colors.map(c => `
        <div class="color-option"
             style="background:${c}"
             onclick="selectColor('${c}')"></div>
      `).join('')}
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", html);

  const rect = event.target.getBoundingClientRect();
  const el = document.getElementById("color-selector");

  el.style.position = "absolute";
  el.style.left = rect.left + "px";
  el.style.top = rect.bottom -40 + "px";
}

function selectColor(color) {
  const preview = document.getElementById("color-preview");

  if (preview) {
    preview.style.background = color;
  }

  // guardar valor si usás input oculto o state
  window.currentConceptColor = color;

  closeColorSelector();
}

function closeColorSelector() {
  const el = document.getElementById("color-selector");
  if (el) el.remove();
}

document.addEventListener("click", function(e) {
  const selector = document.getElementById("color-selector");

  if (!selector) return;

  if (!selector.contains(e.target) &&
      !e.target.classList.contains("color-box")) {
    closeColorSelector();
  }
});