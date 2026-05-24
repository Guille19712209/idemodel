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
    
    },

    {
      type: "relations",
      icon: "assets/icon_relations.svg",
  
    },

    {
      type: "comments",
      icon: "assets/icon_comments.svg",
    
    },

    {
      type: "timeline",
      icon: "assets/icon_timeline.svg",
    
    }

  ];

  badges.forEach(b => {

    const el = document.createElement('div');

    el.className = 'graph-badge';
    el.style.position = 'absolute';

    el.dataset.type = b.type;

    const img = document.createElement('img');

    img.src = b.icon;

    el.appendChild(img);

    layer.appendChild(el);

    el.addEventListener('pointerdown', (e) => {

    e.stopPropagation();

    e.preventDefault();

  });

  el.addEventListener('click', (e) => {

    e.stopPropagation();

    e.preventDefault();

    if (b.type === 'style') {

      openNodeStylePanel(
        node,
        el
      );

    }

  });

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

  const BADGE_SIZE_MODEL = 10; // mitad del alto del value
  const BADGE_GAP_MODEL  = 2;
  const OFFSET_X_MODEL   = 10; // distancia del texto más ancho

  const badgeSize = BADGE_SIZE_MODEL * zoom;
  const badgeGap  = BADGE_GAP_MODEL  * zoom;

  ACTIVE_BADGES.forEach((b, i) => {

    const node = cy.getElementById(b.nodeId);
    if (!node || node.empty()) return;

    const pos = node.renderedPosition();

    const nodeSize =
      parseFloat(node.data('size_px')) ||
      parseFloat(node.data('size')) || 80;

    // Anclar al texto más ancho del label
    const labelEl = document.querySelector(
      `.node-label[data-id="${b.nodeId}"]`
    );

    let anchorX;

    if (labelEl) {

      const titleRect = labelEl.querySelector('.title').getBoundingClientRect();
      const valueRect = labelEl.querySelector('.value').getBoundingClientRect();
      const unitRect  = labelEl.querySelector('.unit').getBoundingClientRect();

      const textRight = Math.max(
        titleRect.right,
        valueRect.right,
        unitRect.right
      );

      anchorX = textRight + (OFFSET_X_MODEL * zoom);

    } else {

      const nodeRight = pos.x + (nodeSize / 2) * zoom;
      anchorX = nodeRight + (OFFSET_X_MODEL * zoom);

    }

    const totalHeight =
      ACTIVE_BADGES.length * badgeSize +
      (ACTIVE_BADGES.length - 1) * badgeGap;

    const startY  = pos.y - totalHeight / 2;
    const anchorY = startY + i * (badgeSize + badgeGap);

    b.el.style.left   = `${anchorX}px`;
    b.el.style.top    = `${anchorY}px`;
    b.el.style.width  = `${badgeSize}px`;
    b.el.style.height = `${badgeSize}px`;
    b.el.style.transform = 'translate(-50%, -50%)';

    let opacity = 1;
    if (zoom < 1.3) {
      opacity = Math.max(0, (zoom - 0.8) / 0.5);
    }
    b.el.style.opacity = opacity;

  });

}

