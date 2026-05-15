export let NODE_LABELS = {};

import {
  getNodeColor
} from "./graph-style.js";

/////////////////////////////////////////////////////////
// HTML LABELS (overlay)
/////////////////////////////////////////////////////////

function renderNodeLabels(cy) {
  
  const container = document.getElementById('node-label-layer');
  const zoom = cy.zoom();

  cy.nodes().not('[isChip]').forEach(node => {

    const id = node.id();
    const isActive = window.ACTIVE_NODE_ID === id;
    const data = node.data();
    const pos = node.renderedPosition();

    let el = NODE_LABELS[id];

   if (!el) {
      el = document.createElement('div');
      el.className = 'node-label';
      el.dataset.id = id;

    el.innerHTML = `
      <div class="label-content">
        <div class="title"></div>
        <div class="value"></div>
        <div class="unit"></div>
      </div>
    `;

    const titleEl = el.querySelector('.title');
    const valueEl = el.querySelector('.value');
    const unitEl = el.querySelector('.unit');

      container.appendChild(el);
      NODE_LABELS[id] = el;
    }

    if (!data.unit_id && window.UNITS.length > 0) {
      data.unit_id = window.UNITS[0].id;
    }

    const titleEl = el.querySelector('.title');
    const valueEl = el.querySelector('.value');
    const unitEl = el.querySelector('.unit');

    [titleEl, valueEl, unitEl].forEach(input => {

      input.addEventListener('mousedown', (e) => {
        e.stopPropagation();
      });

      input.addEventListener('click', (e) => {
        e.stopPropagation();
      });

    });

    const unit = window.UNITS?.find(u => u.id === data.unit_id);

    const unitText = unit ? unit.name : (data.unit || '');

    titleEl.innerText = data.label || '';
    valueEl.innerText = data.value || '';
    unitEl.innerText = unitText;

  const content = el.querySelector('.label-content'); 
  const rect = cy.container().getBoundingClientRect();

  el.style.left = pos.x + 'px';
  el.style.top = pos.y + 'px';

  const bg = getNodeColor(node);
  const textColor = getContrastColor(bg);

  titleEl.style.color = textColor;
  valueEl.style.color = textColor;
  unitEl.style.color = textColor;

  valueEl.style.opacity = 1;
  titleEl.style.opacity = 0.9;
  unitEl.style.opacity = 0.6;
  
  el.style.transform = `
    translate(-50%, -50%)
    scale(${zoom})
  `;
  el.style.transformOrigin = "center";
  
  });



  /////////////////////////////////////////////////////////
  // CLEANUP LABELS
  /////////////////////////////////////////////////////////

  Object.keys(NODE_LABELS).forEach(id => {

    const exists = cy.getElementById(id).length > 0;

    if (!exists) {
      NODE_LABELS[id].remove();
      delete NODE_LABELS[id];
    }

  });
}


function updateNodeLabelPositions(cy) {

  const rect = cy.container().getBoundingClientRect();

  cy.nodes().not('[isChip]').forEach(node => {

    const id = node.id();
    const el = NODE_LABELS[id];
    if (!el) return;

    const pos = node.renderedPosition();

    const zoom = cy.zoom();

    el.style.transform = `
      translate(-50%, -50%)
      scale(${zoom})
    `;
    el.style.transformOrigin = "center";

   el.style.left = pos.x + 'px';
   el.style.top = pos.y + 'px';

  });
}


function openValueEditor(cy, node) {

  const id = node.id();

  const labelEl = NODE_LABELS[id];

  if (!labelEl) return;

  const valueEl = labelEl.querySelector('.value');
  valueEl.style.visibility = 'hidden';

  const rect = valueEl.getBoundingClientRect();
  const computed = window.getComputedStyle(valueEl);

  const zoom = cy.zoom();

  const input = document.createElement('input');
  const baseSize = parseFloat(computed.fontSize);

  input.style.fontSize = `${baseSize * zoom}px`;
  input.style.fontWeight = computed.fontWeight;
  input.style.fontFamily = computed.fontFamily;
  input.style.lineHeight = computed.lineHeight;
  input.style.color = computed.color;
  input.style.opacity = computed.opacity;
  input.style.textAlign = 'center';
  input.style.background = 'transparent';
  input.style.border = 'none';
  input.style.outline = 'none';
  input.type = 'text';
  input.value = node.data('value') || '';
  input.className = 'floating-value-editor';
  input.style.position = 'fixed';
  input.style.left = rect.left + rect.width / 2 + 'px';
  input.style.top = rect.top + rect.height / 2 + 'px';
  input.style.minWidth = '80px';
  input.style.width = `${Math.max(80, rect.width + 40)}px`;
  input.style.height = `auto`;
  input.style.transform = 'translate(-50%, -50%)';
  input.style.zIndex = 999999;
  input.style.background = 'rgba(40,40,40,0.45)';
  input.style.backdropFilter = 'blur(4px)';
  input.style.borderRadius = '10px';
  input.style.padding = '8px 14px';
  input.style.lineHeight = '1.2';
  input.style.boxSizing = 'border-box';
  
  input.addEventListener('input', () => {

    input.style.width = '0px';

    input.style.width =
      Math.max(80, input.scrollWidth + 24) + 'px';

  });

  document.body.appendChild(input);
  cy.userZoomingEnabled(false);

  input.focus();
  input.select();
  let closed = false;

  function closeEditor(save = true) {

    if (closed) return;

    closed = true;

    if (save) {
      node.data('value', input.value);
    }

    input.remove();
    cy.userZoomingEnabled(true);
    valueEl.style.visibility = 'visible';
    renderNodeLabels(cy);
  }

  input.addEventListener('keydown', (e) => {

    if (e.key === 'Enter') {
      closeEditor(true);
    }

    if (e.key === 'Escape') {
      closeEditor(false);
    }

  });

  input.addEventListener('blur', () => {
    closeEditor(true);
  });

}

export {
  renderNodeLabels,
  updateNodeLabelPositions,
  openValueEditor
};