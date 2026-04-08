const API_URL = "https://script.google.com/macros/s/AKfycbwQrFA2LNbN7yg4rrxJjvdYIZyA_elm7b4KP0h7KG8ROTgWv511srAo_iwSgm0aUlXGnw/exec";


function loadData() {

  document.querySelectorAll("script[data-api]").forEach(s => s.remove());

  const script = document.createElement("script");
  script.setAttribute("data-api", "1");

  window.handleData = function(data) {

    if (data.concepts) {
      CONCEPTS_MAP = {};

      data.concepts.forEach(c => {
        CONCEPTS_MAP[c.id] = c;
      });
    }

    console.log("RAW:", data);
    console.log("nodes:", data.nodes);
    console.log("model:", data.model);
    console.log("conceptLinks:", data.conceptLinks);

    console.log("renderData:", typeof renderData);
    console.log("renderGraph:", typeof renderGraph);

    // 🔥 asegurar que exista conceptLinks
    data.conceptLinks = data.conceptLinks || [];

    renderData(data.nodes);

    const graphData = buildGraphData({
      nodes: data.nodes,
      model: data.model,
      conceptLinks: data.conceptLinks // 🔥 CLAVE
    });

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