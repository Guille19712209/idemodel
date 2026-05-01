// ============================
// nodeUI.js (v3 contextual UI)
// ============================

let currentNode = null;
let badgesContainer = null;

function getNodeScreenPos(node, cy) {
  const pos = node.renderedPosition();
  const rect = cy.container().getBoundingClientRect();

  return {
    x: rect.left + pos.x,
    y: rect.top + pos.y
  };
}

export function showNodeUI(node, cy) {

    
  currentNode = node;

  removeNodeUI();

    const container = cy.container();
    const { x, y } = getNodeScreenPos(node, cy);

  badgesContainer = document.createElement("div");
  badgesContainer.className = "node-ui";

  // posiciones radiales
    const actions = [
    { name: "style", angle: 30 },
    { name: "relations", angle: 55 },
    { name: "comments", angle: 80 },
    { name: "timeline", angle: 105 },
    ];

  actions.forEach((a) => {

    console.log("CREANDO BADGE", a.name);

    const el = document.createElement("div");
    el.className = "node-ui-badge";

    el.style.background = "#373737";;
    el.style.width = "40px";
    el.style.height = "40px";
    el.style.zIndex = "99999";
    el.style.position = "absolute";

    const icons = {
    style: "icon-style.svg",
    relations: "icon_relations.svg",
    comments: "icon_comments.svg",
    timeline: "icon_timeline.svg",
    };

    // 👇 ACÁ va el fetch (EN ESTE LUGAR EXACTO)
    fetch(`assets/${icons[a.name]}`)
    .then(r => r.text())
    .then(svg => {
        el.innerHTML = svg;

        const svgEl = el.querySelector("svg");

        if (svgEl) {
        svgEl.removeAttribute("class"); // limpia clases tipo size-6
        svgEl.style.width = "18px";
        svgEl.style.height = "18px";
        }
    });

    // 0° = arriba → convertimos a sistema trigonométrico
    const rad = ((a.angle - 90) * Math.PI) / 180;

    const radius = (node.width() * cy.zoom() / 2) + 30;

    const bx = x + Math.cos(rad) * radius;
    const by = y + Math.sin(rad) * radius;

    const size = 40; // tamaño del badge

    el.style.left = (bx - size / 2) + "px";
    el.style.top = (by - size / 2) + "px";


    el.onclick = (e) => {
      e.stopPropagation();

      if (a.name === "value") {
        enableInlineEdit(node, cy);
      }

      console.log("Action:", a.name);
      };

      badgesContainer.appendChild(el);
    });
      container.appendChild(badgesContainer);
      window.activeNodeUI = {
      node,
      update: () => updateNodeUI(node, cy)
      };
  }

export function removeNodeUI() {
  if (badgesContainer) {
    badgesContainer.remove();
    badgesContainer = null;
  }
}

function updateNodeUI(node, cy) {
  if (!badgesContainer) return;

  const pos = node.renderedPosition();
  const rect = cy.container().getBoundingClientRect();

  // 👉 POSICIÓN REAL EN PANTALLA
  const x = rect.left + pos.x;
  const y = rect.top + pos.y;

  const zoom = cy.zoom();

  // 👉 RADIO correcto con zoom + mínimo
  const baseRadius = (node.width() * zoom / 2) + 30;
  const minRadius = 90;
  const radius = Math.max(baseRadius, minRadius);

  const angles = [30, 55, 80, 105];

  for (let i = 0; i < badgesContainer.children.length; i++) {
    const el = badgesContainer.children[i];
    const angle = angles[i];

    const rad = ((angle - 90) * Math.PI) / 180;

    const bx = x + Math.cos(rad) * radius;
    const by = y + Math.sin(rad) * radius;

    const size = 40; // tamaño del badge

    el.style.left = (bx - size / 2) + "px";
    el.style.top = (by - size / 2) + "px";
  }
}

window.enableInlineLabelEdit = function(node, cy) {

  const id = node.id();
  const labelEl = document.querySelector(
  `.node-label[data-id="${id}"]`
  );

  if (!labelEl) return;

  const titleEl = labelEl.querySelector(".title");
  if (!titleEl) return;

  const current = titleEl.innerText;

  // evitar doble edición
  if (titleEl.querySelector("input")) return;

  const input = document.createElement("input");
  input.value = current;

  // 🔥 copiar estilo visual
  input.style.background = "transparent";
  input.style.border = "none";
  input.style.outline = "none";
  input.style.color = "inherit";
  input.style.font = "inherit";
  input.style.textAlign = "center";
  input.style.width = "100%";

  titleEl.innerHTML = "";
  titleEl.appendChild(input);

  input.focus();
  input.select();

  function save() {
  const newValue = input.value.trim();

  if (!newValue) {
    titleEl.innerText = current;
    return;
  }

  node.data("label", newValue);
  titleEl.innerText = newValue;

  // 🔥 persistencia real
  if (window.supabaseClient) {
    window.supabaseClient
      .from("nodes")
      .update({ label: newValue })
      .eq("id", node.id())
      .then(({ error }) => {
        if (error) {
          console.error("ERROR GUARDANDO:", error);
        } else {
          console.log("GUARDADO EN DB ✔");
        }
      });
  }
}

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      save();
      saved = true;
    }
    if (e.key === "Escape") {
      cancel();
      saved = true;
    }
  });

  let saved = false;

  input.addEventListener("blur", () => {
    if (!saved) {
      save();
      saved = true;
    }
  });
};