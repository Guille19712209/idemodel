export let NODE_LABELS = {};

let _unitDropdown = null;

import {
  getNodeColor
} from "./graph-style.js";


/////////////////////////////////////////////////////////
// HTML LABELS (overlay)
/////////////////////////////////////////////////////////

function renderNodeLabels(cy) {
  
  const container = document.getElementById('node-label-layer');
  const zoom = cy.zoom();

  cy.nodes().not('[isChip],[isConceptHub]').forEach(node => {

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

          <div class="label-slot title-slot">
            <div class="title"></div>
          </div>

          <div class="label-slot value-slot">
            <div class="value"></div>
          </div>

          <div class="label-slot unit-slot">
            <div class="unit"></div>
          </div>

        </div>
      `;

    const titleEl = el.querySelector('.title');
    const valueEl = el.querySelector('.value');
    const unitEl = el.querySelector('.unit');

      container.appendChild(el);
      NODE_LABELS[id] = el;
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

    const unit = window.UNITS_DATA?.find(u => u.id === data.unit_id);

    const unitText = unit ? unit.name : (data.unit || '');

    titleEl.innerText = data.label || '';
    valueEl.innerText = data.value || '';
    unitEl.innerText = unitText;

  const content = el.querySelector('.label-content'); 
  const rect = cy.container().getBoundingClientRect();

  el.style.left = pos.x + 'px';
  el.style.top = pos.y + 'px';


  

  const bg = getNodeColor(node);
  const opacity =
    parseFloat(node.style('background-opacity')) || 1;

  const textColor =
      getContrastColor(bg, opacity);

  titleEl.style.color = textColor;
  valueEl.style.color = textColor;
  unitEl.style.color = textColor;

  valueEl.style.opacity = 1;
  titleEl.style.opacity = 0.9;
  unitEl.style.opacity = 0.6;
  
  if (data.hidden) {
    el.style.display = window.SHOW_HIDDEN ? '' : 'none';
    if (window.SHOW_HIDDEN) {
      const uiColor = getComputedStyle(document.documentElement).getPropertyValue('--top-ui-color').trim() || textColor;
      titleEl.style.color = uiColor;
      valueEl.style.color = uiColor;
      unitEl.style.color  = uiColor;
      el.style.opacity = '0.35';
    } else {
      el.style.opacity = '';
    }
  } else {
    el.style.display  = '';
    el.style.opacity  = '';
  }

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

  cy.nodes().not('[isChip],[isConceptHub]').forEach(node => {

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


function openFieldEditor(cy, node, field) {

  if (window.USER_ROLE === 'reader') return;

  const id = node.id();

  const labelEl = NODE_LABELS[id];

  if (!labelEl) return;

  const fieldEl =
  labelEl.querySelector(`.${field}`);
  fieldEl.style.visibility = 'hidden';

  const rect =
    fieldEl.getBoundingClientRect();

  const computed =
    window.getComputedStyle(fieldEl);

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
  const dataField = field === 'title' ? 'label' : field;
  input.value = node.data(dataField) || '';
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
  
  let _isDuplicate = false;

  const warn = document.createElement('div');
  warn.style.cssText = 'position:fixed;font-size:10px;color:#ff6b6b;background:rgba(0,0,0,0.75);padding:3px 9px;border-radius:6px;pointer-events:none;display:none;z-index:9999999;white-space:nowrap';
  warn.innerText = 'Element name already in use!';
  document.body.appendChild(warn);

  input.addEventListener('input', () => {

    input.style.width = '0px';
    input.style.width = Math.max(80, input.scrollWidth + 24) + 'px';

    if (field === 'title') {
      const val = input.value.trim();
      _isDuplicate = val.length > 0 && cy.nodes().some(n => n.id() !== id && n.data('label') === val);
      if (_isDuplicate) {
        warn.style.display = 'block';
        const r = input.getBoundingClientRect();
        warn.style.left = (r.left + r.width / 2 - warn.offsetWidth / 2) + 'px';
        warn.style.top  = (r.bottom + 5) + 'px';
      } else {
        warn.style.display = 'none';
      }
    }

  });

  document.body.appendChild(input);
  cy.userZoomingEnabled(false);

  input.focus();
  let closed = false;

  function closeEditor(save = true) {

    if (closed) return;

    closed = true;

    if (save && field === 'title' && _isDuplicate) save = false;

    if (save) {
      if (field === "title") {
        node.data("label", input.value);
        if (typeof window._clearPendingNode === 'function') window._clearPendingNode(node.id());
      }

      else if (field === "unit") {
        node.data("unit_id", input.value);
      }

      else {
        node.data(field, input.value);
      }

      if (field === 'value') {
        if (typeof window.queueValueData === 'function') {
          window.queueValueData(node.id(), input.value);
        }
      } else if (typeof queueNodeData === 'function') {
        queueNodeData(node.id(), field, input.value);
      }
    }

    warn.remove();
    input.remove();
    cy.userZoomingEnabled(true);
    fieldEl.style.visibility = 'visible';
    renderNodeLabels(cy);
    if (typeof window.refreshByUnitSizes === 'function') window.refreshByUnitSizes();
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

function openUnitSelector(cy, node) {
  if (window.USER_ROLE === 'reader') return;
  closeUnitSelector();

  const id = node.id();
  const labelEl = NODE_LABELS[id];
  if (!labelEl) return;

  const units = window.UNITS_DATA || [];
  const currentUnitId = node.data('unit_id');

  const dropdown = document.createElement('div');
  dropdown.className = 'shape-dropdown node-unit-selector';
  dropdown.style.position = 'fixed';
  dropdown.style.zIndex = '999999';
  dropdown.style.minWidth = '90px';

  if (units.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'shape-option';
    empty.style.opacity = '0.4';
    empty.style.fontStyle = 'italic';
    empty.style.cursor = 'default';
    empty.innerText = 'No units yet';
    dropdown.appendChild(empty);
  } else {
    units.forEach(unit => {
      const item = document.createElement('div');
      item.className = 'shape-option';
      if (unit.id === currentUnitId) {
        item.style.fontWeight = '700';
        item.style.color = 'rgba(255,255,255,0.95)';
      }
      item.innerText = unit.name;
      item.addEventListener('click', e => {
        e.stopPropagation();
        node.data('unit_id', unit.id);
        if (typeof queueNodeData === 'function') {
          queueNodeData(node.id(), 'unit', unit.id);
        }
        closeUnitSelector();
        renderNodeLabels(cy);
      });
      dropdown.appendChild(item);
    });
  }

  const footer = document.createElement('div');
  footer.className = 'sp-units-footer';
  const addBtn = document.createElement('div');
  addBtn.className = 'sp-units-add-btn';
  addBtn.innerText = '+';
  addBtn.title = 'Manage units';
  addBtn.addEventListener('click', e => {
    e.stopPropagation();
    closeUnitSelector();
    if (typeof window.openUnitsPanel === 'function') window.openUnitsPanel();
    else if (typeof window.openSettingsPanel === 'function') window.openSettingsPanel();
  });
  footer.appendChild(addBtn);
  dropdown.appendChild(footer);

  document.body.appendChild(dropdown);
  _unitDropdown = dropdown;

  const labelRect = labelEl.getBoundingClientRect();
  const ddW = dropdown.offsetWidth || 120;
  const ddH = dropdown.offsetHeight || 80;
  const margin = 8;

  let left = labelRect.right + 8;
  if (left + ddW > window.innerWidth - margin) left = labelRect.left - ddW - 8;
  let top = labelRect.top + labelRect.height / 2 - ddH / 2;
  if (top + ddH > window.innerHeight - margin) top = window.innerHeight - ddH - margin;

  dropdown.style.left = Math.max(margin, left) + 'px';
  dropdown.style.top  = Math.max(margin, top)  + 'px';

  setTimeout(() => {
    document.addEventListener('pointerdown', _onUnitOutsideClick, { capture: true });
  }, 0);
}

function _onUnitOutsideClick(e) {
  if (_unitDropdown && !_unitDropdown.contains(e.target)) closeUnitSelector();
}

function closeUnitSelector() {
  if (_unitDropdown) { _unitDropdown.remove(); _unitDropdown = null; }
  document.removeEventListener('pointerdown', _onUnitOutsideClick, { capture: true });
}

export {
  renderNodeLabels,
  updateNodeLabelPositions,
  openFieldEditor,
  openUnitSelector,
  closeUnitSelector
};

function normalizeColor(color) {

    if (!color) {
        return { r: 136, g: 136, b: 136 };
    }

    if (color.startsWith('#')) {

        let hex = color.replace('#', '');

        if (hex.length === 3) {
            hex = hex
                .split('')
                .map(c => c + c)
                .join('');
        }

        return {
            r: parseInt(hex.substring(0, 2), 16),
            g: parseInt(hex.substring(2, 4), 16),
            b: parseInt(hex.substring(4, 6), 16)
        };
    }

    if (color.startsWith('rgb')) {

        const values = color.match(/[\d.]+/g);

        return {
            r: parseFloat(values[0]),
            g: parseFloat(values[1]),
            b: parseFloat(values[2])
        };
    }

    return { r: 136, g: 136, b: 136 };
}


function getContrastColor(color, alpha = 1) {

    const c = normalizeColor(color);

    // fondo real app
    const bg = {
        r: 236,
        g: 236,
        b: 236
    };

    // color visible compuesto
    const r =
        Math.round((1 - alpha) * bg.r + alpha * c.r);

    const g =
        Math.round((1 - alpha) * bg.g + alpha * c.g);

    const b =
        Math.round((1 - alpha) * bg.b + alpha * c.b);

    // luminancia WCAG REAL
    const srgb = [r, g, b].map(v => {

        v /= 255;

        return v <= 0.03928
            ? v / 12.92
            : Math.pow((v + 0.055) / 1.055, 2.4);
    });

    const L =
        0.2126 * srgb[0] +
        0.7152 * srgb[1] +
        0.0722 * srgb[2];

    // contraste REAL
    const whiteContrast =
        1.05 / (L + 0.05);

    const blackContrast =
        (L + 0.05) / 0.05;

    console.log({
        visible: { r, g, b },
        L,
        whiteContrast,
        blackContrast
    });

    // elegir el MEJOR
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);

    const saturation =
        max === 0
            ? 0
            : (max - min) / max;

    // colores intensos favorecen blanco
    if (saturation > 0.35 && L < 0.65) {
        return '#FFFFFF';
    }

    return whiteContrast > blackContrast
        ? '#FFFFFF'
        : '#111111';
}

