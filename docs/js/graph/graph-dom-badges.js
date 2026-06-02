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

  const allBadges = [

    { type: "style",     icon: "assets/icon-style.svg"      },
    { type: "relations", icon: "assets/icon_relations.svg"   },
    { type: "comments",  icon: "assets/icon_comments.svg"    },
    { type: "timeline",  icon: "assets/icon_timeline.svg"    },
    { type: "delete"                                          }

  ];

  const isReader = window.USER_ROLE === 'reader';
  const badges = isReader
    ? allBadges.filter(b => b.type !== 'style' && b.type !== 'delete')
    : allBadges;

  badges.forEach(b => {

    const el = document.createElement('div');

    el.className = 'graph-badge';
    el.style.position = 'absolute';

    el.dataset.type = b.type;

    if (b.type === 'delete') {
      el.innerHTML = `<svg viewBox="0 0 10 10" style="width:55%;height:55%;pointer-events:none">
        <line x1="2.5" y1="2.5" x2="7.5" y2="7.5" stroke="#ef4444" stroke-width="1.8" stroke-linecap="round"/>
        <line x1="7.5" y1="2.5" x2="2.5" y2="7.5" stroke="#ef4444" stroke-width="1.8" stroke-linecap="round"/>
      </svg>`;
    } else {
      const img = document.createElement('img');
      img.src = b.icon;
      el.appendChild(img);
    }

    layer.appendChild(el);

    el.addEventListener('pointerdown', (e) => {

    e.stopPropagation();

    e.preventDefault();

  });

  el.addEventListener('click', (e) => {

    e.stopPropagation();

    e.preventDefault();

    if (b.type === 'style') {
      window.closeNodeRelationsPanel?.();
      window.closeNodeCommentsPanel?.();
      openNodeStylePanel(node, el);
    } else if (b.type === 'relations') {
      window.closeNodeStylePanel?.();
      window.closeNodeCommentsPanel?.();
      if (typeof window.openNodeRelationsPanel === 'function') window.openNodeRelationsPanel(node, el);
    } else if (b.type === 'comments') {
      window.closeNodeStylePanel?.();
      window.closeNodeRelationsPanel?.();
      window.closeNodeInputPanel?.();
      if (typeof window.openNodeCommentsPanel === 'function') window.openNodeCommentsPanel(node, el);
    } else if (b.type === 'delete') {
      openDeleteConfirm(node.id(), el);
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

  const BADGE_SIZE_MODEL = 10;
  const BADGE_GAP_MODEL  = 2;
  const OFFSET_X_MODEL   = 10;

  const badgeSize = BADGE_SIZE_MODEL * zoom;
  const badgeGap  = BADGE_GAP_MODEL  * zoom;

  ACTIVE_BADGES.forEach((b, i) => {

    const node = cy.getElementById(b.nodeId);
    if (!node || node.empty()) return;

    const pos = node.renderedPosition();

    const nodeSize =
      parseFloat(node.data('size_px')) ||
      parseFloat(node.data('size')) || 80;

    const labelEl = document.querySelector(
      `.node-label[data-id="${b.nodeId}"]`
    );

    let anchorX;
    let centerY;

    if (labelEl) {

      const titleRect = labelEl.querySelector('.title').getBoundingClientRect();
      const valueRect = labelEl.querySelector('.value').getBoundingClientRect();
      const unitRect  = labelEl.querySelector('.unit').getBoundingClientRect();

      anchorX = Math.max(
        titleRect.right,
        valueRect.right,
        unitRect.right
      ) + (OFFSET_X_MODEL * zoom);

      const labelRect = labelEl.getBoundingClientRect();
      centerY = labelRect.top + labelRect.height / 2 + (6 * zoom);

    } else {

      const nodeRight = pos.x + (nodeSize / 2) * zoom;
      anchorX = nodeRight + (OFFSET_X_MODEL * zoom);
      centerY = pos.y;

    }

    const totalHeight =
      ACTIVE_BADGES.length * badgeSize +
      (ACTIVE_BADGES.length - 1) * badgeGap;

    const startY  = centerY - totalHeight / 2;
    const anchorY = startY + i * (badgeSize + badgeGap);

    b.el.style.left      = `${anchorX}px`;
    b.el.style.top       = `${anchorY}px`;
    b.el.style.width     = `${badgeSize}px`;
    b.el.style.height    = `${badgeSize}px`;
    b.el.style.transform = 'translate(-50%, -50%)';

    let opacity = 1;
    if (zoom < 1.3) {
      opacity = Math.max(0, (zoom - 0.8) / 0.5);
    }
    b.el.style.opacity = opacity;

  });

}

/////////////////////////////////////////////////////////
// DELETE CONFIRM MODAL
/////////////////////////////////////////////////////////

function openDeleteConfirm(nodeId, anchorEl) {
  document.getElementById('node-delete-confirm')?.remove();

  const modal = document.createElement('div');
  modal.id        = 'node-delete-confirm';
  modal.className = 'shape-dropdown';
  modal.style.cssText = `
    position:fixed; z-index:999999;
    padding:10px 12px;
    display:flex; flex-direction:column; gap:10px;
    min-width:0;
  `;

  const text = document.createElement('div');
  text.style.cssText = 'font-size:12px;color:rgba(255,255,255,0.85);font-weight:500;white-space:nowrap';
  text.innerText = 'Remove element?';

  const btns = document.createElement('div');
  btns.style.cssText = 'display:flex;gap:6px;justify-content:flex-end';

  const yes = document.createElement('div');
  yes.className = 'shape-option';
  yes.innerText  = 'yes';
  yes.style.cssText = 'color:#ef4444;font-weight:600;cursor:pointer';
  yes.addEventListener('click', e => {
    e.stopPropagation();
    modal.remove();
    if (typeof window.removeNode === 'function') window.removeNode(nodeId);
  });

  const no = document.createElement('div');
  no.className = 'shape-option';
  no.innerText  = 'no';
  no.style.cursor = 'pointer';
  no.addEventListener('click', e => {
    e.stopPropagation();
    modal.remove();
  });

  btns.appendChild(yes);
  btns.appendChild(no);
  modal.appendChild(text);
  modal.appendChild(btns);
  document.body.appendChild(modal);

  // Posición: a la derecha del badge, centrada verticalmente
  const r  = anchorEl.getBoundingClientRect();
  const mW = modal.offsetWidth  || 140;
  const mH = modal.offsetHeight || 58;
  const mg = 8;

  let left = r.right + 8;
  if (left + mW > window.innerWidth - mg) left = r.left - mW - 8;
  let top = r.top + r.height / 2 - mH / 2;
  if (top + mH > window.innerHeight - mg) top = window.innerHeight - mH - mg;

  modal.style.left = Math.max(mg, left) + 'px';
  modal.style.top  = Math.max(mg, top)  + 'px';

  setTimeout(() => {
    document.addEventListener('pointerdown', function _close(e) {
      if (!modal.contains(e.target) && !anchorEl.contains(e.target)) {
        modal.remove();
        document.removeEventListener('pointerdown', _close);
      }
    });
  }, 0);
}
