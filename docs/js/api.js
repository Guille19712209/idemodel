/////////////////////
// ARCHIVO api.js
/////////////////////

const API_URL = "https://script.google.com/macros/s/AKfycbwQrFA2LNbN7yg4rrxJjvdYIZyA_elm7b4KP0h7KG8ROTgWv511srAo_iwSgm0aUlXGnw/exec";

///////////////////////////////
// 🔥 MODE CONTROL
///////////////////////////////

const USE_BATCH = true;

function loadData() {

  document.querySelectorAll("script[data-api]").forEach(s => s.remove());

  const script = document.createElement("script");
  script.setAttribute("data-api", "1");

  window.handleData = function(data) {

    // 🔥 asegurar estructuras
    data.conceptLinks = data.conceptLinks || [];
    data.concepts = data.concepts || [];

    if (!data.config || !data.config.author) {
      saveConfig("author", "unknown");
    }

    if (!data.config || !data.config.version) {
      saveConfig("version", "v1");
    }

    // 🔥 MAP global (si lo usás en otros lados)
    if (data.concepts) {
      CONCEPTS_MAP = {};

      data.concepts.forEach(c => {
        CONCEPTS_MAP[c.id] = c;
      });
    }

    const workspace = data.workspace || {};

    // 🔵 render UI lateral (si aplica)
    renderData(data.nodes);

    if (data.config) {

      const cfg = data.config;

      if (cfg.name) {
        document.getElementById("model-name").value = cfg.name;
      }

      if (typeof updateModelMeta === "function") {
        updateModelMeta(cfg);
      }
    }
    
    // 🔥 GRAPH DATA (AHORA CON CONCEPTS)
    const graphData = buildGraphData({
      
      nodes: data.nodes,
      model: data.model,
      conceptLinks: data.conceptLinks,
      concepts: data.concepts, // ✅ CLAVE
          // 🔥 PASARLO AL GRAPH
      workspace: workspace
    });
  

    if (typeof setState === "function") {
    setState({
      nodes: data.nodes,
      edges: graphData.edges,
      concepts: data.concepts
    });
    }

    if (data.config) {

      if (data.config) {

      if (!data.config.author) {
         const url = API_URL +
          "?action=saveConfig" +
          "&key=author" +
          "&value=Guille" +
          "&_=" + Date.now();

        const script = document.createElement("script");
        script.src = url;
        document.body.appendChild(script);
      }

      if (!data.config.version) {
        
        const url = API_URL +
          "?action=saveConfig" +
          "&key=version" +
          "&value=v1" +
          "&_=" + Date.now();

        const script = document.createElement("script");
        script.src = url;
        document.body.appendChild(script);
      }

    }

    }

    renderGraph(graphData);
  };

  script.src = API_URL + "?callback=handleData&_=" + Date.now();

  document.body.appendChild(script);
}


// ==============================
// ⚠️ NOTA IMPORTANTE
// ==============================
// Estas funciones NO se usan en este flujo (JSONP)
// Se dejan para futuro si migrás a google.script.run
// ==============================

function apiGetConcepts() {
  return new Promise(resolve => {
    google.script.run.withSuccessHandler(resolve).getConcepts();
  });
}

function apiGetConceptLinks() {
  return new Promise(resolve => {
    google.script.run.withSuccessHandler(resolve).getConceptLinks();
  });
}

function apiAddConceptLink(edgeId, conceptId) {
  return new Promise(resolve => {
    google.script.run.withSuccessHandler(resolve).addConceptLink(edgeId, conceptId);
  });
}

function apiCreateConcept(name, color) {
  return new Promise(resolve => {
    google.script.run.withSuccessHandler(resolve).createConcept(name, color);
  });
}


function sendPositionsToAPI(positions) {
  
  if (USE_BATCH && typeof queuePositions === "function") {
  queuePositions(positions);
  return;
  }

  const payload = encodeURIComponent(JSON.stringify(positions));

  const url = API_URL +
    "?action=savePositions" +
    "&positions=" + payload +
    "&_=" + Date.now();

  const script = document.createElement("script");
  script.src = url;
  document.body.appendChild(script);
}

function sendWorkspaceToAPI(workspace) {

  if (USE_BATCH && typeof queueWorkspace === "function") {
  queueWorkspace(workspace);
  return;
  }

  const payload = encodeURIComponent(JSON.stringify(workspace));

  const url = API_URL +
    "?action=saveWorkspace" +
    "&workspace=" + payload +
    "&_=" + Date.now();

  const script = document.createElement("script");
  script.src = url;
  document.body.appendChild(script);

}

///////////////////////////////
// 🔥 BATCH QUEUE (NUEVO)
///////////////////////////////

let __changeQueue = [];
let __syncTimeout = null;

function __queueChange(change) {

  __changeQueue.push(change);

  if (!__syncTimeout) {
    __syncTimeout = setTimeout(__flushChanges, 2000);
  }
}

function __flushChanges() {

  console.log("FLUSH EXECUTED", __changeQueue);

  if (__changeQueue.length === 0) return;

  // 🔥 COMPACTAR CAMBIOS

const merged = {};

  __changeQueue.forEach(change => {

    if (change.type === "positions") {
      merged.positions = {
        ...(merged.positions || {}),
        ...change.data
      };
    }

    if (change.type === "workspace") {
      merged.workspace = change.data;
    }

    if (change.type === "config") {
      merged.config = change.data;
    }

  });

  const compactedQueue = [];

  if (merged.positions) {
    compactedQueue.push({ type: "positions", data: merged.positions });
  }

  if (merged.workspace) {
    compactedQueue.push({ type: "workspace", data: merged.workspace });
  }

  if (merged.config) {
    compactedQueue.push({ type: "config", data: merged.config });
  }
  
  const payload = JSON.stringify(compactedQueue);

  const url = API_URL +
    "?action=batchUpdate" +
    "&data=" + payload +
    "&_=" + Date.now();

  const script = document.createElement("script");
  script.src = url;

  script.onload = () => script.remove();

  document.body.appendChild(script);

    __changeQueue = [];
    __syncTimeout = null;
  }

///////////////////////////////
// 🔥 WRAPPERS BATCH (NUEVO)
///////////////////////////////

function queueWorkspace(workspace) {
  __queueChange({
    type: "workspace",
    data: workspace
  });
}

function queuePositions(positions) {

  __queueChange({
    type: "positions",
    data: positions
  });

}

function queueConfig(key, value) {
  __queueChange({
    type: "config",
    data: { key, value }
  });
}