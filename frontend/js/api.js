const API_URL = "https://script.google.com/macros/s/AKfycbxTd-fkqjrKMFo1QYvCq2SrhnF2LXJspMEmy2W1c2E7Wio95o1AbSJz7t8gPCe3iyzQ0A/exec";

console.log("UI VERSION NUEVA");

function loadData() {

  // limpiar scripts anteriores
  document.querySelectorAll("script[data-api]").forEach(s => s.remove());

  const script = document.createElement("script");
  script.setAttribute("data-api", "1");

  window.handleData = function(data) {
    console.log("RAW:", data);
    console.log("TYPE:", typeof data.nodes);

    renderData(data.nodes);
    renderGraph(data.nodes);
  };

  script.src = API_URL + "?callback=handleData&_=" + Date.now();

  document.body.appendChild(script);
} 