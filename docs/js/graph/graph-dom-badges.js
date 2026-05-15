export let ACTIVE_BADGES = [];

export function removeNodeBadges() {

  ACTIVE_BADGES.forEach(b => {

    if (b.el) {
      b.el.remove();
    }

  });

  ACTIVE_BADGES = [];
}

export function createNodeBadges(cy, node) {

  removeNodeBadges();

  const layer =
    document.getElementById('badge-layer');

  const badges = [

    {
      type: "style",
      icon: "assets/icon-style.svg",
      angle: 30
    },

    {
      type: "relations",
      icon: "assets/icon_relations.svg",
      angle: 55
    },

    {
      type: "comments",
      icon: "assets/icon_comments.svg",
      angle: 80
    },

    {
      type: "timeline",
      icon: "assets/icon_timeline.svg",
      angle: 105
    }

  ];

  badges.forEach(b => {

    const el = document.createElement('div');

    el.className = 'graph-badge';

    el.dataset.type = b.type;

    const img = document.createElement('img');

    img.src = b.icon;

    el.appendChild(img);

    layer.appendChild(el);

    ACTIVE_BADGES.push({
      el,
      angle: b.angle,
      nodeId: node.id()
    });

  });

  updateBadgePositions(cy);
}

export function updateBadgePositions(cy) {

  const zoom = cy.zoom();

    let opacity = 1;

    if (zoom < 1.3) {
    opacity = (zoom - 0.8) / 0.5;
    }

    opacity = Math.max(0, Math.min(1, opacity));
  
    ACTIVE_BADGES.forEach(b => {

    const node =
      cy.getElementById(b.nodeId);

    if (!node || node.empty()) return;

    const pos =
      node.renderedPosition();

    const radians =
      (b.angle * Math.PI) / 180;

    const zoom = cy.zoom();

    const nodeSize = 80;

    const nodeRadius =
    (nodeSize / 2) * zoom;

    const nodeBorder = 2;

    const spacing = 35;

    const distance =
    nodeRadius +
    nodeBorder +
    spacing;

    const dx =
      Math.sin(radians) * distance;

    const dy =
      -Math.cos(radians) * distance;

    b.el.style.left =
      `${pos.x + dx}px`;

    b.el.style.top =
      `${pos.y + dy}px`;

    b.el.style.opacity = opacity;
  });

  for (let i = 0; i < ACTIVE_BADGES.length; i++) {

    const a = ACTIVE_BADGES[i];

    const ax = parseFloat(a.el.style.left);
    const ay = parseFloat(a.el.style.top);

    let opacity = 1;

    for (let j = 0; j < ACTIVE_BADGES.length; j++) {

        if (i === j) continue;

        const b = ACTIVE_BADGES[j];

        const bx = parseFloat(b.el.style.left);
        const by = parseFloat(b.el.style.top);

        const dx = ax - bx;
        const dy = ay - by;

        const dist = Math.sqrt(dx * dx + dy * dy);

        // START FADE
        if (dist < 50) {

        const t = (dist - 45) / (90 - 45);

        opacity = Math.min(opacity, t);
        }

        // FULL HIDE
        if (dist <= 45) {
        opacity = 0;
        }

    }

    opacity = Math.max(0, Math.min(1, opacity));

    a.el.style.opacity = opacity;
}

  

}

