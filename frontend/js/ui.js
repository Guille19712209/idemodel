function renderData(data) {

  const container = document.getElementById("output");
  container.innerHTML = "";

  if (!data || data.length === 0) return;

  const table = document.createElement("table");
  table.border = "1";

  // headers
  const headerRow = document.createElement("tr");

  Object.keys(data[0]).forEach(key => {
    const th = document.createElement("th");
    th.innerText = key;
    headerRow.appendChild(th);
  });

  table.appendChild(headerRow);

  // rows
  data.forEach(row => {

    if (!row.id) return; // evita basura

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