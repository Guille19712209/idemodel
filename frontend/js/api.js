const API_URL = "PEGÁ_TU_URL_ACÁ";

function loadData() {
  const script = document.createElement("script");

  window.handleData = function(data) {
    console.log("DATA:", data);
    renderData(data);
  };

  script.src = API_URL + "?callback=handleData";

  document.body.appendChild(script);
}