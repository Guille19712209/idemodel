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

/////////////////////////////////////////////////////////
// 🧠 PANEL CONTROL
/////////////////////////////////////////////////////////

function openPanel({ title, content }) {

  const panel = document.getElementById('bottom-panel');
  const contentEl = document.getElementById('panel-content');
  const titleEl = document.getElementById('panel-title');

  titleEl.innerText = title || '';
  const inner = document.getElementById('panel-inner');
  inner.innerHTML = content;

  panel.classList.add('open');
}

function closePanel() {
  document.getElementById('bottom-panel').classList.remove('open');
}

function openEdgePanel(edge) {

  const concepts = edge.data('concepts') || [];

  const chips = concepts.map(c => `
    <div 
      class="chip" 
      style="background:${c.color}"
    >
      ${c.name}
    </div>
  `).join('');

  openPanel({
    title: "Relación",
    content: `
      <div class="panel-grid">

        <div class="col-12">
          <div class="panel-section-title">CONCEPTOS</div>
          <div>

            ${chips}

            <!-- 👇 chip + -->
            <div 
              class="chip" 
              onclick="openConceptSelector('${edge.id()}')"
            >
              +
            </div>

          </div>
        </div>

      </div>
    `
  });
}

function openCreateConceptPanel() {

  openPanel({
    title: "Nuevo concepto",
    content: `
      <input id="new-concept" placeholder="Nombre del concepto"/>
      <button onclick="saveConcept()">Crear</button>
    `
  });
}

function addConceptInline(edgeId) {

  const input = document.getElementById('new-concept');
  const name = input.value.trim();

  if (!name) return;

  addConceptToEdge(edgeId, name);

  input.value = "";
}

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
    title: "Seleccionar concepto",
    content: `
      <div>${items}</div>

      <div style="margin-top:10px;">
        <div 
          class="chip" 
          onclick="openCreateConceptPanel()"
        >
          + nuevo concepto
        </div>
      </div>
    `
  });
}

function selectConcept(edgeId, conceptId) {

  const concept = CONCEPTS_MAP[conceptId];
  if (!concept) return;

  addConceptToEdge(edgeId, concept.name);
}