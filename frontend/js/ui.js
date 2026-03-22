function renderData(data) {
  const container = document.getElementById("output");
  container.innerHTML = "";

  const table = document.createElement("table");
  table.border = "1";
  table.style.borderCollapse = "collapse";

  // headers
  const headerRow = document.createElement("tr");
  ["nodeId", "label", "t1", "t2", "t3"].forEach(h => {
    const th = document.createElement("th");
    th.innerText = h;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);

  // rows
  data.forEach(row => {
    const tr = document.createElement("tr");

    ["nodeId", "label", "t1", "t2", "t3"].forEach(key => {
      const td = document.createElement("td");
      td.innerText = row[key];
      tr.appendChild(td);
    });

    table.appendChild(tr);
  });

  container.appendChild(table);
}