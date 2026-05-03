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
  badgesContainer.style.display = "none";
  badgesContainer.style.pointerEvents = "none";

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
    el.style.width = "50px";
    el.style.height = "50px";
    el.style.zIndex = "99999";
    el.style.position = "absolute";
    el.style.pointerEvents = "none";

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
        svgEl.style.width = "30px";
        svgEl.style.height = "30px";
        }
    });

    // 0° = arriba → convertimos a sistema trigonométrico
    const rad = ((a.angle - 90) * Math.PI) / 180;

    const radius = (node.width() * cy.zoom() / 2) + 35;

    const bx = x + Math.cos(rad) * radius;
    const by = y + Math.sin(rad) * radius;

    const size = 50; // tamaño del badge

    el.style.left = (bx - size / 2) + "px";
    el.style.top = (by - size / 2) + "px";


    el.onclick = (e) => {
      e.stopPropagation();
      console.log("Action:", a.name);
    };

      badgesContainer.appendChild(el);
    });
      container.appendChild(badgesContainer);
      window.activeNodeUI = {
      node,
      update: () => updateNodeUI(node, cy)
      };

      updateNodeUI(node, cy);
  }

 

export function removeNodeUI() {
  if (badgesContainer) {
    badgesContainer.remove();
    badgesContainer = null;
  }
}

function updateNodeUI(node, cy) {
  if (!badgesContainer) return;
  
  badgesContainer.style.display = "block";

  const pos = node.renderedPosition();
  const rect = cy.container().getBoundingClientRect();

  const x = rect.left + pos.x;
  const y = rect.top + pos.y;

  const zoom = cy.zoom();

  const baseRadius = (node.width() * zoom / 2) + 35;

  const nodeRadius = (node.width() * zoom) / 2;

  // 🔥 restricciones físicas
  const MIN_RADIUS_COLLISION = 116;
  const MIN_RADIUS_GAP = nodeRadius + 30;

  const radius = baseRadius; //*

  const MIN_RADIUS = Math.max(MIN_RADIUS_COLLISION, MIN_RADIUS_GAP);

  // 🔥 visibilidad
// ===== GEOMETRÍA REAL =====
const gap = radius - nodeRadius;

const ANGLE_STEP = 25 * Math.PI / 180;
const distBetween = 2 * radius * Math.sin(ANGLE_STEP / 2);

const BADGE_SIZE = 50;

// ===== LÍMITES =====
const MIN_DIST = BADGE_SIZE; // colisión
const MAX_GAP = 35;          // tu regla

// ===== RANGOS DE FADE =====
const COLLISION_FADE = 25;
const GAP_FADE = 25;

// ===== CONDICIONES =====

// 1. colisión
const isColliding = distBetween < BADGE_SIZE + 10; //*  margen suave

// 2. gap excedido
const isTooFar = gap > MAX_GAP;

// ===== OPACITY =====
let opacity = 1;

// fade por colisión
if (isColliding) {
  opacity = (distBetween - BADGE_SIZE) / 25;
}

// fade por gap
if (isTooFar) {
  const excess = gap - MAX_GAP;
  const fade = 1 - (excess / 25);
  opacity = Math.min(opacity, fade);
}

// clamp final
opacity = Math.max(0, Math.min(1, opacity));

// suavizado
opacity = opacity * opacity * (3 - 2 * opacity);

// aplicar
badgesContainer.style.opacity = opacity;
badgesContainer.style.pointerEvents = opacity < 0.1 ? "none" : "auto";



  // 🔥 posiciones
  const angles = [30, 55, 80, 105];

  for (let i = 0; i < badgesContainer.children.length; i++) {
    const el = badgesContainer.children[i];
    const angle = angles[i];

    const rad = ((angle - 90) * Math.PI) / 180;

    const bx = x + Math.cos(rad) * radius;
    const by = y + Math.sin(rad) * radius;

    const size = 50;

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

window.openUnitSelector = function(node) {

  const id = node.id();

  const labelEl = document.querySelector(
    `.node-label[data-id="${id}"]`
  );

  if (!labelEl) return;

  const unitEl = labelEl.querySelector(".unit");
  if (!unitEl) return;

  // evitar duplicado
  if (unitEl.querySelector(".unit-menu")) return;

  const menu = document.createElement("div");
  menu.className = "unit-menu";

  // estilo base (simple y limpio)
  menu.style.position = "absolute";
  menu.style.left = "0px";
  menu.style.top = "100%";
  menu.style.background = "#2c2c2c";
  menu.style.borderRadius = "8px";
  menu.style.padding = "6px";
  menu.style.display = "flex";
  menu.style.flexDirection = "column";
  menu.style.gap = "4px";
  menu.style.zIndex = "99999";
  menu.style.marginTop = "4px";

  // 👉 lista de units
  (window.UNITS || []).forEach(u => {

    const item = document.createElement("div");
    item.innerText = u.name;

    item.style.padding = "4px 8px";
    item.style.cursor = "pointer";
    item.style.borderRadius = "6px";
    item.style.color = "#fff";

    item.onmouseenter = () => item.style.background = "#444";
    item.onmouseleave = () => item.style.background = "transparent";

    item.onclick = () => {
      node.data("unit", u.name);

      unitEl.innerText = u.name;
      menu.remove();

      // persistencia
      if (window.supabaseClient) {
        window.supabaseClient
          .from("nodes")
          .update({ unit: u.name })
          .eq("id", node.id());
      }
    };

    menu.appendChild(item);
  });

  // 👉 botón "+"
  const add = document.createElement("div");
  add.innerText = "+ nueva unidad";

  add.style.padding = "4px 8px";
  add.style.cursor = "pointer";
  add.style.borderTop = "1px solid #555";
  add.style.marginTop = "4px";
  add.style.color = "#aaa";

  add.onmouseenter = () => add.style.color = "#fff";
  add.onmouseleave = () => add.style.color = "#aaa";

  add.onclick = () => {
    menu.remove();
    openUnitsModal(); // 👈 lo conectamos después
  };

  menu.appendChild(add);

  unitEl.appendChild(menu);

  // cerrar al click afuera
  setTimeout(() => {
    document.addEventListener("click", function close(e) {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener("click", close);
      }
    });
  }, 0);
}