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

    titleEl.style.pointerEvents = "none";
    valueEl.style.pointerEvents = "none";
    unitEl.style.pointerEvents = "none";


      container.appendChild(el);
      NODE_LABELS[id] = el;
    }

    if (!data.unit_id && window.UNITS.length > 0) {
      data.unit_id = window.UNITS[0].id;
    }

    const titleEl = el.querySelector('.title');
    const valueEl = el.querySelector('.value');
    const unitEl = el.querySelector('.unit');

    if (document.activeElement !== titleEl) {
      titleEl.innerText = data.label || '';
    }

    if (document.activeElement !== valueEl) {
      valueEl.innerText = data.value || '';
    }

    const unit = window.UNITS?.find(u => u.id === data.unit_id);

    const unitText = unit ? unit.name : (data.unit || '');

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

export {
  renderNodeLabels,
  updateNodeLabelPositions
};