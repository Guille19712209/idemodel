const API_URL = "https://script.google.com/macros/s/AKfycbyMYcl-nhAbqqLckgQ-mQebpsNltrTZKJ6C6bx47D_Rn69f4Qmp0MZaGU-jOtuv2r9zBQ/exec";


function loadData() {

  document.querySelectorAll("script[data-api]").forEach(s => s.remove());

  const script = document.createElement("script");
  script.setAttribute("data-api", "1");

  window.handleData = function(data) {

    console.log("RAW:", data);
    console.log("nodes:", data.nodes);
    console.log("model:", data.model);

    console.log("renderData:", typeof renderData);
    console.log("renderGraph:", typeof renderGraph);

    renderData(data.nodes);
    const graphData = buildGraphData(data);
    renderGraph(graphData);

  };

  script.src = API_URL + "?callback=handleData&_=" + Date.now();

  document.body.appendChild(script);
}