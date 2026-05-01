
/////////////////////
// UI LAYER
/////////////////////

let CONCEPTS_MAP = {};
let VIEW_MODE = "ALL";
const API_URL = "";
let CURRENT_EDGE = null;
window.UI_MODE = "v3";

/////////////////////////////////////////////////////////
// 🔷 DATA TABLE (debug / optional)
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
// 🔷 EDGE UI
/////////////////////////////////////////////////////////

function setupEdgeUI(cy) {
  cy.on('cxttap', 'edge', function(evt) {
    const edge = evt.target;
    CURRENT_EDGE = edge;
    openConceptPrompt(edge.data());
  });
}

/////////////////////////////////////////////////////////
// 🔷 PROMPT
/////////////////////////////////////////////////////////

function openConceptPrompt(edge) {
  const name = prompt(`Add concept to edge:\n${edge.source} → ${edge.target}`);
  if (!name) return;
  addConceptToEdge(edge.id, name);
}

/////////////////////////////////////////////////////////
// 🔷 CORE
/////////////////////////////////////////////////////////

async function addConceptToEdge(edgeId, conceptName) {
  const current = getState();
  const model_id = current.model_id;

  if (!model_id) {
    console.warn("No model_id in state");
    return;
  }

  let concept = Object.values(CONCEPTS_MAP)
    .find(c => c.label === conceptName);

  if (!concept) {
    concept = await createConcept(conceptName, model_id);
  }

  if (!concept) return;

  await linkConceptToEdge(edgeId, concept.id);

  setTimeout(() => {
    loadData_UI();
  }, 200);
}

/////////////////////////////////////////////////////////
// 🔷 CREATE CONCEPT PANEL
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

      <div class="panel-header">
        <div class="title">Concepts</div>
      </div>

      <div class="panel-body">

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

        <div class="panel-divider"></div>

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

      <div class="panel-footer footer-right">
        <div class="btn btn-dark" onclick="saveConcept()">Create</div>
      </div>

    </div>`
  });
}

/////////////////////////////////////////////////////////
// 🔷 EDGE PANEL
/////////////////////////////////////////////////////////

window.openEdgePanel = function(edge) {

  console.log("OPEN EDGE PANEL", edge.id());

  const concepts = edge.data('concepts') || [];

  const source = edge.source().data('label') || edge.source().id();
  const target = edge.target().data('label') || edge.target().id();

  const rawType = edge.data('type');
  const type = String(rawType || "manual").trim().toLowerCase();

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

      <div class="panel-header">
        <div class="panel-title">Connection</div>
        <div class="panel-close" onclick="closePanel()">×</div>
      </div>

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

      <div class="panel-divider"></div>

      <div class="panel-right col-right">
        <div class="panel-line">
          <span class="title">Concepts</span>
        </div>

        <div class="chips-row">
          ${chips || ""}
          <div class="chip-btn add dark"
               onclick="openConceptSelector(event, '${edge.id()}')">+</div>
        </div>
      </div>

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

/////////////////////////////////////////////////////////
// 🔷 PANEL CONTROL
/////////////////////////////////////////////////////////

function openPanel({ title, content }) {
  const panel = document.getElementById('bottom-panel');
  const titleEl = document.getElementById('panel-title');
  const inner = document.getElementById('panel-inner');

  if (!panel || !inner) return;

  if (titleEl) titleEl.innerText = title;

  inner.innerHTML = "";
  panel.classList.add('open');

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

/////////////////////////////////////////////////////////
// 🔷 LOADER
/////////////////////////////////////////////////////////

function hideLoader() {
  const el = document.getElementById("loader");
  if (!el) return;

  el.classList.add("hidden");

  setTimeout(() => {
    el.remove();
  }, 300);
}

/////////////////////////////////////////////////////////
// 🔷 DATA FLOW (CRÍTICO)
/////////////////////////////////////////////////////////

window.handleData = function(data) {
  // 🔴 NO TOCAR ESTE BLOQUE
  console.log("DATA COMPLETA:", data);

  if (typeof setState === "function") {
    const current = getState();
    setState({ ...current, model_id: data.model_id });
  }

  const currentPeriod = 1;

  const valuesMap = {};
  (data.values || []).forEach(v => {
    valuesMap[`${v.node_id}_${v.period}`] = v;
  });

  const unitsMap = Object.fromEntries(
    (data.units || []).map(u => [u.id, u])
  );

  const conceptsMap = Object.fromEntries(
    (data.concepts || []).map(c => [c.id, c])
  );

  CONCEPTS_MAP = conceptsMap;

  const conceptsByLink = {};

  (data.linkConcepts || []).forEach(lc => {
    if (!conceptsByLink[lc.link_id]) {
      conceptsByLink[lc.link_id] = [];
    }

    const concept = conceptsMap[lc.concept_id];

    if (concept) {
      conceptsByLink[lc.link_id].push({
        id: concept.id,
        name: concept.label,
        color: concept.color || "#888"
      });
    }
  });

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
  });

  window.renderGraph({
    nodes: graphNodes,
    edges: graphEdges
  });
};

window.openNodePanel = function(node) {

  const data = node.data();

  setTimeout(() => {
  const preview = document.querySelector('.color-preview');
  const input = document.getElementById('node-color');

  if (preview && input) {
    preview.style.background = input.value;
  }
  }, 0);

  openPanel({
    title: "Node",
    content: `

      <div class="panel">

  <!-- HEADER -->
  <div class="panel__header">
    <span class="panel__title">Node</span>
    <button class="panel__close">✕</button>
  </div>

  <!-- BODY -->
  <div class="panel__body">

    <!-- TOP -->
    <div class="node-top">

      <!-- LEFT (visual) -->
      <div class="node-col">
            <div class="node-field field-node-main">
                <label class="label-left">Label</label>
                <input value="ventas" />
                <label class="label-right">Unit</label>
                <input value="Pesos" />
                <label class="label-right">X</label>
                <input value="100"/>
                <label class="label-right">Y</label>
                <input value="100"/>
                <label class="label-right">Shape</label>
                <input value="ellipse"/>
                <label class="label-right">Size</label>
                <input value="100"/>
                <label class="label-right">Color</label>

                <div class="color-field">
                  <div 
                    class="color-preview" 
                    onclick="openColorSelector(event)"
                  ></div>
                  <input type="hidden" id="node-color" value="#A94E77">
                </div>

                <label class="label-right">Parent</label>
                <input value="Results"/>
                <label class="label-right">Groups</label>
                <input value="100"/>
            </div>
        
      </div>
    </div>

      <div class="values-row">

        <!-- LABEL -->
        <div class="values-row__label">
        Values
        </div>

        <!-- CONTENIDO -->
        <div class="values-row__content">

          <div class="values-row__grid">

          ${buildValuesGrid(
            [10,12,15,18,20,22,25,27,30,32,35,40], // valores ejemplo
            5 // índice activo (ej: junio)
          )}
          </div>
        </div>
      </div>

    <!-- FOOTER -->
    <div class="panel__footer">
        <button class="ui-btn ui-btn--danger">Delete</button>
        <button class="ui-btn ui-btn--primary">Save</button>
    </div>

    </div>

    `
  });

  }

  function buildValuesGrid(values = [], activeIndex = null) {

  const periods = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  let labels = '';
  let inputs = '';

  // LABELS (todos primero)
  periods.forEach(p => {
    labels += `<div class="vt-label">${p}</div>`;
  });

  // INPUTS (todos después)
  periods.forEach((p, i) => {
    const val = values[i] ?? '';

    inputs += `
      <div class="vt-cell ${i === activeIndex ? 'active' : ''}">
        <input value="${val}">
      </div>
    `;
  });

  return labels + inputs;
}

/////////////////////////////////////////////////////////
// 🔷 COLOR SELECTOR
/////////////////////////////////////////////////////////

window.openColorSelector = function(event) {

  closeColorSelector();

  const colors = [
    "#888","#2563eb","#16a34a","#f59e0b",
    "#ef4444","#8b5cf6","#6d3e0e","#ee5cf6"
  ];

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
  el.style.left = rect.left-40 + "px";
  el.style.top = rect.bottom-40 + "px";

  // cerrar al hacer click afuera
  setTimeout(() => {
    document.addEventListener("click", outsideColorClick);
  }, 10);
};

window.selectColor = function(color) {

  const preview = document.querySelector('.color-preview');
  const input = document.getElementById('node-color');

  if (preview) preview.style.background = color;
  if (input) input.value = color;

  closeColorSelector();
};

window.closeColorSelector = function() {
  const el = document.getElementById("color-selector");
  if (el) el.remove();
  document.removeEventListener("click", outsideColorClick);
};

function outsideColorClick(e) {
  const el = document.getElementById("color-selector");
  if (!el) return;

  if (!el.contains(e.target)) {
    closeColorSelector();
  }
}


/////////////////////////////////////////////////////////
// 🔷 CREAR NODE
/////////////////////////////////////////////////////////

document.getElementById("add-node-btn")
  .addEventListener("click", openCreateNodePanel);

function openCreateNodePanel() {

  openPanel({
    title: "New Node",
content: `

<div class="panel">

  <!-- HEADER -->
  <div class="panel__header">
    <span class="panel__title">Node</span>
    <button class="panel__close" onclick="closePanel()">✕</button>
  </div>

  <!-- BODY -->
  <div class="panel__body">

    <!-- 🔹 BASE (SIEMPRE VISIBLE) -->
    <div class="node-base">

      <div class="base-row">
        <div class="field">
          <label>Label</label>
          <input value="Node 1">
        </div>

        <div class="field value">
          <label>Value</label>
          <input value="125">
          <span class="period">(Aug)</span>
        </div>
      </div>

      <div class="base-row">
        <div class="field">
          <label>Unit</label>
          <input value="$">
        </div>

        <div class="field formula">
          <label>Formula</label>
          <input value="100 + node_2">
        </div>
      </div>

    </div>

    <!-- 🔹 TAG BAR -->
    <div class="node-tags">
      <span class="tag active" onclick="switchTab('style', this)">Style</span>
      <span class="tag" onclick="switchTab('relations', this)">Relations</span>
      <span class="tag" onclick="switchTab('timeline', this)">Timeline</span>
    </div>

    <!-- 🔹 DYNAMIC CONTENT -->
    <div class="node-extra">

      <!-- STYLE -->
      <div class="tab-content active" data-tab="style">

        <div class="inline-group">
          <div class="field small">
            <label>X</label>
            <input value="120">
          </div>

          <div class="field small">
            <label>Y</label>
            <input value="121">
          </div>
        </div>

        <div class="inline-group">
          <div class="field">
            <label>Shape</label>
            <input value="ellipse">
          </div>

          <div class="field">
            <label>Size</label>
            <input value="By unit">
          </div>

          <div class="field">
            <label>Color</label>
            <div class="color-preview"></div>
          </div>
        </div>

      </div>

      <!-- RELATIONS -->
      <div class="tab-content" data-tab="relations">

        <div class="relation-line">
          <span>Groups</span>
          <div class="chips-row">
            <div class="chip">obras ×</div>
            <div class="chip">gastos ×</div>
            <div class="chip-btn">+</div>
          </div>
        </div>

        <div class="relation-line">
          <span>Links</span>
          <div class="chips-row">
            <div class="chip">brand ×</div>
            <div class="chip">brand ×</div>
            <div class="chip-btn">+</div>
          </div>
        </div>

      </div>

      <!-- TIMELINE -->
      <div class="tab-content" data-tab="timeline">

        <div class="values-row__grid">
          ${buildValuesGrid(
            [10,12,15,18,20,22,25,27,30,32,35,40],
            5
          )}
        </div>

      </div>

    </div>

  </div>

  <!-- FOOTER -->
  <div class="panel__footer">
    <button class="ui-btn ui-btn--danger">Delete</button>
    <button class="ui-btn ui-btn--primary">Save</button>
  </div>

</div>
`
  });

  setTimeout(() => {
    document.getElementById("node-name")?.focus();
  }, 50);
}

function switchTab(tab, el) {

  // activar tag
  document.querySelectorAll(".tag").forEach(t => t.classList.remove("active"));
  el.classList.add("active");

  // mostrar contenido
  document.querySelectorAll(".tab-content").forEach(c => {
    c.classList.remove("active");
  });

  document.querySelector(`.tab-content[data-tab="${tab}"]`)
    .classList.add("active");

}

