
window.ACTIVE_STYLE_BADGE = null;
window.STYLE_PANEL = null;
const SHAPE_SCALE = {

  ellipse: 1,

  'round-rectangle': 0.8,

  rectangle: 0.8,

  diamond: 0.9

};


window.openNodeStylePanel =
function(node, anchorEl) {

  closeNodeStylePanel();

  const panel =
    document.createElement('div');

  panel.className =
    'node-style-panel';

  /////////////////////////////////////////////////////////
  // SHAPE CHIP
  /////////////////////////////////////////////////////////

  const shapeChip =
    createInlineSelectChip(
      "shape",
      "ellipse"
    );

  panel.appendChild(shapeChip);

  /////////////////////////////////////////////////////////
  // DROPDOWN
  /////////////////////////////////////////////////////////
    
  const currentColor =
    node.style('background-color');
    

  const currentOpacity =
    parseFloat(
      node.style('background-opacity')
    ) || 1;

  const colorChip =
    createColorChip(
      currentColor,
      currentOpacity
    );

    panel.appendChild(colorChip);
/////////////////////////////////////////////////////////
  // SIZE CHIP
  /////////////////////////////////////////////////////////

  const currentSizeType =
    node.data('size_type') || 'fixed';

  const currentSizePx =
    parseFloat(node.data('size_px')) || 80;

  const sizeChip =
    createInlineSelectChip(
      "size",
      currentSizeType
    );

  panel.appendChild(sizeChip);

  /////////////////////////////////////////////////////////
  // HIDDEN TOGGLE CHIP
  /////////////////////////////////////////////////////////

  let _isHidden = !!node.data('hidden');

  const hiddenChip = document.createElement('div');
  hiddenChip.className = 'ui-chip';
  hiddenChip.style.cursor = 'pointer';

  const hiddenLbl = document.createElement('div');
  hiddenLbl.className = 'ui-chip-label';
  hiddenLbl.innerText = 'Hidden';

  const hiddenVal = document.createElement('div');
  hiddenVal.className = 'ui-chip-value';

  const hiddenDot = document.createElement('div');
  hiddenDot.className = 'sp-toggle-dot' + (_isHidden ? ' sp-toggle-on' : '');
  hiddenVal.appendChild(hiddenDot);
  hiddenChip.appendChild(hiddenLbl);
  hiddenChip.appendChild(hiddenVal);

  hiddenChip.addEventListener('click', (e) => {
    e.stopPropagation();
    const _prevHidden = _isHidden;
    _isHidden = !_isHidden;
    node.data('hidden', _isHidden);
    window.pushUndo?.(() => {
      _isHidden = _prevHidden;
      node.data('hidden', _prevHidden);
      hiddenDot.className = 'sp-toggle-dot' + (_prevHidden ? ' sp-toggle-on' : '');
      node.cy().style().update();
      window.queueNodeData?.(node.id(), 'hidden', _prevHidden);
    });
    hiddenDot.className = 'sp-toggle-dot' + (_isHidden ? ' sp-toggle-on' : '');
    node.cy().style().update();
    const labelEl = document.querySelector(`#node-label-layer [data-id="${node.id()}"]`);
    if (labelEl) {
      labelEl.style.display = (_isHidden && !window.SHOW_HIDDEN) ? 'none' : '';
      labelEl.style.opacity = '';
    }
    if (_isHidden && !window.SHOW_HIDDEN) {
      node.unselect();
      if (typeof window.removeNodeBadges === 'function') window.removeNodeBadges();
      window.closeNodeStylePanel();
    }
    if (typeof window.queueNodeData === 'function') {
      window.queueNodeData(node.id(), 'hidden', _isHidden);
    }
  });

  panel.appendChild(hiddenChip);

  /////////////////////////////////////////////////////////
  // COORDINATES CHIP — x/y en una sola fila
  /////////////////////////////////////////////////////////

  const coordChip = document.createElement('div');
  coordChip.className = 'ui-chip';
  coordChip.style.cssText = 'cursor:default;gap:0;';

  const _makeAxisLabel = (axis) => {
    const el = document.createElement('div');
    el.className = 'ui-chip-label';
    el.innerText = axis;
    return el;
  };

  const _makeAxisVal = (initVal) => {
    const el = document.createElement('div');
    el.className = 'ui-chip-alpha';
    el.contentEditable = true;
    el.spellcheck = false;
    el.innerText = Math.round(initVal);
    el.style.cssText = 'min-width:34px;text-align:right;padding:0 10px;cursor:text;font-size:10px;color:#373737;';
    return el;
  };

  const nodePos = node.position();
  const xLbl = _makeAxisLabel('x');
  const xVal  = _makeAxisVal(nodePos.x);
  const yLbl  = _makeAxisLabel('y');
  const yVal  = _makeAxisVal(nodePos.y);

  coordChip.appendChild(xLbl);
  coordChip.appendChild(xVal);
  coordChip.appendChild(yLbl);
  coordChip.appendChild(yVal);

  const _applyCoords = () => {
    const x = parseFloat(xVal.innerText.trim());
    const y = parseFloat(yVal.innerText.trim());
    if (!isNaN(x) && !isNaN(y)) {
      node.position({ x, y });
      if (typeof window.queueNodeData === 'function') {
        window.queueNodeData(node.id(), 'x', x);
        window.queueNodeData(node.id(), 'y', y);
      }
    }
  };

  xVal.addEventListener('blur', _applyCoords);
  yVal.addEventListener('blur', _applyCoords);
  xVal.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); xVal.blur(); }
    if (e.key === 'Tab')   { e.preventDefault(); yVal.focus(); }
  });
  yVal.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); yVal.blur(); }
  });

  panel.appendChild(coordChip);

  /////////////////////////////////////////////////////////
  // SIZE PX INPUT (dentro del sizeChip, como alpha en color)
  /////////////////////////////////////////////////////////

  const sizePxEl =
    document.createElement('div');

  sizePxEl.className = 'ui-chip-alpha';
  sizePxEl.contentEditable = true;
  sizePxEl.spellcheck = false;
  sizePxEl.innerText = currentSizePx + ' px';

  // Insertarlo dentro del ui-chip-value del sizeChip
  sizeChip.querySelector('.ui-chip-value')
    .append(sizePxEl);

  if (currentSizeType !== 'fixed') {
    sizePxEl.style.display = 'none';
  }

  let _prevSize = parseFloat(node.data('size_px') || node.data('size')) || 80;
  sizePxEl.addEventListener('focus', () => {
    _prevSize = parseFloat(sizePxEl.innerText.trim()) || _prevSize;
  });
  sizePxEl.addEventListener('blur', () => {
    const n = parseFloat(sizePxEl.innerText.trim());
    if (!isNaN(n) && n > 0 && n !== _prevSize) {
      const snap = _prevSize;
      window.pushUndo?.(() => {
        sizePxEl.innerText = snap;
        node.data('size_px', snap);
        node.style({ width: snap, height: snap });
        window.queueNodeData?.(node.id(), 'size_px', snap);
      });
    }
  });

  sizePxEl.addEventListener('input', () => {

    const n =
      parseFloat(sizePxEl.innerText.trim());

    if (isNaN(n) || n <= 0) return;

    node.data('size_px', n);
    node.style({ width: n, height: n });

    if (typeof window.queueNodeData === 'function') {
      window.queueNodeData(node.id(), 'size_px', n);
    }

  });


  // Input numérico → aplica al nodo y persiste
  sizePxEl.addEventListener('input', () => {

    const n =
      parseFloat(sizePxEl.innerText.trim());

    if (isNaN(n) || n <= 0) return;

    node.data('size_px', n);
    node.style({ width: n, height: n });

    if (typeof window.queueNodeData === 'function') {
      window.queueNodeData(node.id(), 'size_px', n);
    }

  });

  colorChip.updateNodeStyle =
    function(color, alpha) {

      node.style(
        'background-color',
        color
      );
      node.data('color', color);

      node.style(
        'background-opacity',
        alpha
      );
      node.data('alpha', alpha);

      if (typeof window.queueNodeData === 'function') {

      window.queueNodeData(
        node.id(),
        'color',
        color
      );

      window.queueNodeData(
        node.id(),
        'alpha',
        alpha
      );

    }

    };

  const dropdown =
    document.createElement('div');

  dropdown.className =
    'shape-dropdown hidden';

    /////////////////////////////////////////////////////////
  // SIZE TYPE DROPDOWN
  /////////////////////////////////////////////////////////

  const sizeDropdown =
    document.createElement('div');

  sizeDropdown.className =
    'shape-dropdown hidden';

  ['fixed', 'by unit'].forEach(mode => {

    const item =
      document.createElement('div');

    item.className = 'shape-option';
    item.innerText = mode;

    item.addEventListener('click', () => {

      sizeChip.querySelector('span')
        .innerText = mode;

      sizeDropdown.classList.add('hidden');

      // Mostrar/ocultar el campo px
      sizePxEl.style.display =
      mode === 'fixed' ? '' : 'none';

      // Persiste size_type
      node.data('size_type', mode);

      if (typeof window.queueNodeData === 'function') {
        window.queueNodeData(
          node.id(),
          'size_type',
          mode
        );
      }

    });

    sizeDropdown.appendChild(item);

  });

  // Click en chip abre dropdown
  sizeChip.addEventListener('click', (e) => {

  e.stopPropagation();

  dropdown.classList.add('hidden');
  window.closeColorPicker?.();

  sizeDropdown.classList.toggle('hidden');

  // Reposicionar siempre al abrir
  if (!sizeDropdown.classList.contains('hidden')) {

    const r = sizeChip.getBoundingClientRect();

    sizeDropdown.style.left =
      r.right + 10 + 'px';

    sizeDropdown.style.top =
      r.top + 'px';

  }

});

const shapes = [
  'ellipse',
  'round-rectangle',
  'rectangle',
  'diamond'
];


shapes.forEach(shape => {

  const item =
    document.createElement('div');

  item.className =
    'shape-option';

  item.innerText = shape;

  item.addEventListener('click', () => {
    console.log("CLICK SHAPE");

    console.log(
      "QUEUE EXISTS",
      typeof window.queueNodeData
    );

    shapeChip.querySelector('span')
      .innerText = shape;

    dropdown.classList.add('hidden');

    /////////////////////////////////////////////////////
    // APPLY TO NODE
    /////////////////////////////////////////////////////

    const _prevShape = node.data('shape');
    node.style('shape', shape);
    node.data('shape', shape);

    if (typeof window.queueNodeData === 'function') {

      window.queueNodeData(
        node.id(),
        'shape',
        shape
      );

      window.pushUndo?.(() => {
        node.style('shape', _prevShape);
        node.data('shape', _prevShape);
        window.queueNodeData(node.id(), 'shape', _prevShape);
      });

    }

      /////////////////////////////////////////////////////////
      // VISUAL SCALE
      /////////////////////////////////////////////////////////

      const baseSize =
      parseFloat(node.data('size')) || 80;

      const scale =
      SHAPE_SCALE[shape] || 1;

      const finalSize =
      baseSize * scale;

      node.data('size_px', finalSize);

      window.queueNodeData(
        node.id(),
        'size_px',
        finalSize
      );

      node.style({

      width: finalSize,
      height: finalSize

      });

  });

    dropdown.appendChild(item);

  });


  /////////////////////////////////////////////////////////
  // CHIP CLICK
  /////////////////////////////////////////////////////////

  shapeChip.addEventListener('click', (e) => {

    e.stopPropagation();

    window.closeColorPicker?.();

    dropdown.classList.toggle(
      'hidden'
    );

  });

  colorChip.swatch
  .addEventListener('click', (e) => {

    e.stopPropagation();

    dropdown.classList.add('hidden');
    sizeDropdown.classList.add('hidden');

    const _snapColor = colorChip.currentColor;
    const _snapAlpha = colorChip.currentAlpha;
    let _colorUndoPushed = false;
    window.openColorPicker({
      anchorEl: colorChip,
      color: colorChip.currentColor,
      hasAlpha: true,
      alpha: colorChip.currentAlpha,
      onChange: (color, alpha) => {
        if (!_colorUndoPushed) {
          _colorUndoPushed = true;
          const sc = _snapColor, sa = _snapAlpha;
          window.pushUndo?.(() => {
            colorChip.currentColor = sc;
            colorChip.currentAlpha = sa;
            const rgb = hexToRgb(sc);
            colorChip.swatch.style.background = `rgba(${rgb}, ${sa})`;
            colorChip.alphaEl.innerText = Math.round(sa * 100) + ' %';
            colorChip.updateNodeStyle(sc, sa);
          });
        }
        colorChip.currentColor = color;
        colorChip.currentAlpha = alpha;
        const rgb = hexToRgb(color);
        colorChip.swatch.style.background = `rgba(${rgb}, ${alpha})`;
        colorChip.alphaEl.innerText = Math.round(alpha * 100) + ' %';
        colorChip.updateNodeStyle(color, alpha);
      }
    });

  });

  /////////////////////////////////////////////////////////
  // POSITION
  /////////////////////////////////////////////////////////

  const rect =
    anchorEl.getBoundingClientRect();

  panel.style.left =
    rect.right + 18 + 'px';

  panel.style.top =
    rect.top + 'px';

  /////////////////////////////////////////////////////////
  // APPEND
  /////////////////////////////////////////////////////////

  document.body.appendChild(panel);

  dropdown.style.position = 'fixed';
  dropdown.style.zIndex = 999999;

  const chipRect =
  shapeChip.getBoundingClientRect();

  dropdown.style.left =
    chipRect.right + 10 + 'px';

  dropdown.style.top =
    chipRect.top + 'px';

  document.body.appendChild(dropdown);

  sizeDropdown.style.position = 'fixed';
  sizeDropdown.style.zIndex = 999999;

  const sizeChipRect =
    sizeChip.getBoundingClientRect();

  sizeDropdown.style.left =
    sizeChipRect.right + 10 + 'px';

  sizeDropdown.style.top =
    sizeChipRect.top + 'px';

  document.body.appendChild(sizeDropdown);


  STYLE_PANEL = panel;
  ACTIVE_STYLE_BADGE = anchorEl;

    document
    .querySelectorAll('.graph-badge')
    .forEach(b => {

        if (b === anchorEl) {
        b.classList.add('active');
        b.classList.remove('dimmed');
        }

        else {
        b.classList.remove('active');
        b.classList.add('dimmed');
        }

    });
  STYLE_PANEL.anchorEl = anchorEl;
};



/////////////////////////////////////////////////////////
// CLOSE
/////////////////////////////////////////////////////////

window.closeNodeStylePanel =
function() {

  if (!STYLE_PANEL) return;

  STYLE_PANEL.remove();

  window.closeColorPicker?.();

  document
    .querySelectorAll('.shape-dropdown')
    .forEach(el => el.remove());


  document
  .querySelectorAll('.graph-badge')
  .forEach(b => {

    b.classList.remove('active');
    b.classList.remove('dimmed');

  });

ACTIVE_STYLE_BADGE = null;

  STYLE_PANEL = null;
};

window.updateNodeStylePanel =
function(anchorEl) {

  if (!STYLE_PANEL) return;

  if (!anchorEl) return;

  const rect =
    anchorEl.getBoundingClientRect();

  STYLE_PANEL.style.left =
    rect.right + 18 + 'px';

  STYLE_PANEL.style.top =
    rect.top + 'px';
};

document.addEventListener('pointerdown', (e) => {

  if (!STYLE_PANEL) return;

  const insidePanel =
  STYLE_PANEL.contains(e.target);

  const insideDropdown =
  e.target.closest(
    '.shape-dropdown, .color-dropdown, .color-picker-popup'
  );

  const isBadge =
  e.target.closest('.graph-badge');

  if (
  insidePanel ||
  insideDropdown ||
  isBadge
) return;

  closeNodeStylePanel();

});

