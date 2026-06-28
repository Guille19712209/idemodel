
window.ACTIVE_STYLE_BADGE = null;
window.STYLE_PANEL = null;
const SHAPE_SCALE = {

  ellipse: 1,

  'round-rectangle': 0.8,

  rectangle: 0.8,

  diamond: 0.9,

  star: 1.35

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
  // SIZE CHIP — W / H independientes (cada eje: fixed/by unit + px, misma línea).
  // W = cols size_type/size_px ; H = size_type_h/size_px_h (null → cae al eje W).
  /////////////////////////////////////////////////////////

  const sizeChip = document.createElement('div');
  sizeChip.className = 'ui-chip';
  sizeChip.style.cursor = 'default';

  const sizeLbl = document.createElement('div');
  sizeLbl.className = 'ui-chip-label';
  sizeLbl.innerText = 'size';

  const sizeVal = document.createElement('div');
  sizeVal.className = 'ui-chip-value';
  sizeVal.style.cssText = 'gap:8px;max-width:260px;';

  sizeChip.appendChild(sizeLbl);
  sizeChip.appendChild(sizeVal);
  panel.appendChild(sizeChip);

  const _axisCols = (axis) => axis === 'h'
    ? { t: 'size_type_h', px: 'size_px_h' }
    : { t: 'size_type',   px: 'size_px' };

  const _axisType = (axis) => axis === 'h'
    ? (node.data('size_type_h') || node.data('size_type') || 'fixed')
    : (node.data('size_type') || 'fixed');

  const _axisPx = (axis) => {
    if (axis === 'h') {
      const v = node.data('size_px_h');
      return v != null ? parseFloat(v) : (parseFloat(node.data('size_px')) || 80);
    }
    return parseFloat(node.data('size_px')) || 80;
  };

  // Reaplica los mappers de width/height + reescala texto (no setea style explícito).
  const _refreshSize = () => {
    (window.refreshByUnitSizes || (() => node.cy().style().update()))();
    window.applyNodeTextSize?.(node);
  };

  // Sub-bloque de un eje: cap (W/H) + pill modo (cyclea fixed↔by unit) + px (solo fixed).
  function _buildSizeAxis(axis, capChar) {
    const wrap = document.createElement('div');
    wrap.className = 'sp-size-axis';

    const cap = document.createElement('span');
    cap.className = 'sp-size-cap';
    cap.innerText = capChar;

    const pill = document.createElement('span');
    pill.className = 'sp-size-mode';
    pill.innerText = _axisType(axis);

    const px = document.createElement('div');
    px.className = 'sp-size-px';
    px.contentEditable = true;
    px.spellcheck = false;
    px.innerText = Math.round(_axisPx(axis)) + ' px';
    px.style.display = _axisType(axis) === 'fixed' ? '' : 'none';

    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      const cols   = _axisCols(axis);
      const prevT  = node.data(cols.t);
      const prevPx = node.data(cols.px);
      const next   = _axisType(axis) === 'fixed' ? 'by unit' : 'fixed';
      node.data(cols.t, next);
      window.queueNodeData?.(node.id(), cols.t, next);
      // Al pasar a fixed, sembrar px con el tamaño efectivo actual si está vacío.
      if (next === 'fixed' && node.data(cols.px) == null) {
        const seed = Math.round(_axisPx(axis));
        node.data(cols.px, seed);
        window.queueNodeData?.(node.id(), cols.px, seed);
        px.innerText = seed + ' px';
      }
      pill.innerText = next;
      px.style.display = next === 'fixed' ? '' : 'none';
      _refreshSize();
      window.pushUndo?.(() => {
        node.data(cols.t, prevT);   window.queueNodeData?.(node.id(), cols.t, prevT);
        node.data(cols.px, prevPx); window.queueNodeData?.(node.id(), cols.px, prevPx);
        pill.innerText  = _axisType(axis);
        px.innerText    = Math.round(_axisPx(axis)) + ' px';
        px.style.display = _axisType(axis) === 'fixed' ? '' : 'none';
        _refreshSize();
      });
    });

    px.addEventListener('mousedown', e => e.stopPropagation());
    px.addEventListener('click',     e => e.stopPropagation());
    let _prevPx = _axisPx(axis);
    px.addEventListener('focus', () => { _prevPx = parseFloat(px.innerText) || _prevPx; });
    px.addEventListener('input', () => {
      const n = parseFloat(px.innerText.trim());
      if (isNaN(n) || n <= 0) return;
      const cols = _axisCols(axis);
      node.data(cols.px, n);
      window.queueNodeData?.(node.id(), cols.px, n);
      _refreshSize();
    });
    px.addEventListener('blur', () => {
      const n    = parseFloat(px.innerText.trim());
      const cols = _axisCols(axis);
      if (isNaN(n) || n <= 0) { px.innerText = Math.round(_axisPx(axis)) + ' px'; return; }
      if (n !== _prevPx) {
        const snap = _prevPx;
        window.pushUndo?.(() => {
          node.data(cols.px, snap);
          window.queueNodeData?.(node.id(), cols.px, snap);
          px.innerText = Math.round(snap) + ' px';
          _refreshSize();
        });
      }
      px.innerText = Math.round(n) + ' px';
    });
    px.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); px.blur(); } });

    wrap.append(cap, pill, px);
    return wrap;
  }

  sizeVal.append(_buildSizeAxis('w', 'W'), _buildSizeAxis('h', 'H'));

  /////////////////////////////////////////////////////////
  // HIDDEN TOGGLE CHIP
  /////////////////////////////////////////////////////////

  // _isHidden = flag MANUAL (no el efectivo). El efectivo = manual || condición
  // ("Hide when") lo calcula recomputeHideConditions sobre node.data('hidden').
  let _isHidden = !!node.data('hidden_manual');

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

  function _applyManualHidden(on) {
    node.data('hidden_manual', on);
    window.recomputeHideConditions?.();          // setea el hidden efectivo + style update
    const eff = !!node.data('hidden');
    const labelEl = document.querySelector(`#node-label-layer [data-id="${node.id()}"]`);
    if (labelEl) {
      labelEl.style.display = (eff && !window.SHOW_HIDDEN) ? 'none' : '';
      labelEl.style.opacity = '';
    }
    if (eff && !window.SHOW_HIDDEN) {
      node.unselect();
      if (typeof window.removeNodeBadges === 'function') window.removeNodeBadges();
      window.closeNodeStylePanel();
    }
    window.queueNodeData?.(node.id(), 'hidden', on);   // columna DB `hidden` = manual
  }

  hiddenChip.addEventListener('click', (e) => {
    e.stopPropagation();
    const _prevHidden = _isHidden;
    _isHidden = !_isHidden;
    hiddenDot.className = 'sp-toggle-dot' + (_isHidden ? ' sp-toggle-on' : '');
    _applyManualHidden(_isHidden);
    window.pushUndo?.(() => {
      _isHidden = _prevHidden;
      hiddenDot.className = 'sp-toggle-dot' + (_prevHidden ? ' sp-toggle-on' : '');
      _applyManualHidden(_prevHidden);
    });
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
  // TEXT ONLY TOGGLE
  /////////////////////////////////////////////////////////

  let _isTextOnly = !!node.data('text_only');

  const textOnlyChip = document.createElement('div');
  textOnlyChip.className = 'ui-chip';
  textOnlyChip.style.cursor = 'pointer';
  const textOnlyLbl = document.createElement('div');
  textOnlyLbl.className = 'ui-chip-label';
  textOnlyLbl.innerText = 'Text only';
  const textOnlyVal = document.createElement('div');
  textOnlyVal.className = 'ui-chip-value';
  const textOnlyDot = document.createElement('div');
  textOnlyDot.className = 'sp-toggle-dot' + (_isTextOnly ? ' sp-toggle-on' : '');
  textOnlyVal.appendChild(textOnlyDot);
  textOnlyChip.appendChild(textOnlyLbl);
  textOnlyChip.appendChild(textOnlyVal);

  function _applyTextOnly(on) {
    const labelEl = document.querySelector(`#node-label-layer [data-id="${node.id()}"]`);
    if (!labelEl) return;
    const valueSlot = labelEl.querySelector('.value-slot');
    const unitSlot  = labelEl.querySelector('.unit-slot');
    const content   = labelEl.querySelector('.label-content');
    if (valueSlot) valueSlot.style.display = on ? 'none' : '';
    if (unitSlot)  unitSlot.style.display  = on ? 'none' : '';
    if (content)   content.style.justifyContent = on ? 'center' : '';
  }

  textOnlyChip.addEventListener('click', e => {
    e.stopPropagation();
    const prev = _isTextOnly;
    _isTextOnly = !_isTextOnly;
    node.data('text_only', _isTextOnly);
    textOnlyDot.className = 'sp-toggle-dot' + (_isTextOnly ? ' sp-toggle-on' : '');
    _applyTextOnly(_isTextOnly);
    window.pushUndo?.(() => {
      _isTextOnly = prev;
      node.data('text_only', prev);
      textOnlyDot.className = 'sp-toggle-dot' + (prev ? ' sp-toggle-on' : '');
      _applyTextOnly(prev);
      window.queueNodeData?.(node.id(), 'text_only', prev);
    });
    window.queueNodeData?.(node.id(), 'text_only', _isTextOnly);
  });

  panel.appendChild(textOnlyChip);

  /////////////////////////////////////////////////////////
  // TEXT SIZE CHIP — auto ("A") o manual (3 inputs: L/V/U px por línea)
  /////////////////////////////////////////////////////////

  const TS_BASE = { label: 10, value: 18, unit: 8 };  // == ui-core.css / graph-labels.js
  let _tsAuto = node.data('text_auto') !== false;

  // Semilla de los inputs: stored (manual previo) o el tamaño auto actual (handoff suave).
  const _tsW  = node.width() || parseFloat(node.data('size_px')) || 80;
  const _tsFs = Math.min(Math.max(_tsW / 80, 1), 5);
  const _tsSeed = (col, base) =>
    node.data(col) != null ? parseFloat(node.data(col)) : Math.round(base * _tsFs);

  const tsChip = document.createElement('div');
  tsChip.className = 'ui-chip';
  tsChip.style.cursor = 'default';

  const tsLbl = document.createElement('div');
  tsLbl.className = 'ui-chip-label';
  tsLbl.innerText = 'Text size';

  const tsVal = document.createElement('div');
  tsVal.className = 'ui-chip-value';

  const tsInputs = document.createElement('div');
  tsInputs.className = 'sp-ts-inputs';
  tsInputs.style.display = _tsAuto ? 'none' : 'flex';

  function _mkTsField(field, capChar, initVal) {
    const wrap = document.createElement('div');
    wrap.className = 'sp-ts-field';
    const cap = document.createElement('span');
    cap.className = 'sp-ts-cap';
    cap.innerText = capChar;
    const inp = document.createElement('div');
    inp.className = 'sp-ts-in';
    inp.contentEditable = true;
    inp.spellcheck = false;
    inp.innerText = initVal;
    inp.dataset.field = field;
    wrap.appendChild(cap);
    wrap.appendChild(inp);
    return { wrap, inp };
  }

  const fLabel = _mkTsField('text_label', 'L', _tsSeed('text_label', TS_BASE.label));
  const fValue = _mkTsField('text_value', 'V', _tsSeed('text_value', TS_BASE.value));
  const fUnit  = _mkTsField('text_unit',  'U', _tsSeed('text_unit',  TS_BASE.unit));
  tsInputs.append(fLabel.wrap, fValue.wrap, fUnit.wrap);

  const tsAutoBtn = document.createElement('div');
  tsAutoBtn.className = 'sp-ts-auto' + (_tsAuto ? ' on' : '');
  tsAutoBtn.innerText = 'A';
  tsAutoBtn.title = 'Automatic text size';

  tsVal.appendChild(tsInputs);
  tsVal.appendChild(tsAutoBtn);
  tsChip.appendChild(tsLbl);
  tsChip.appendChild(tsVal);

  // Inputs manuales → persisten su columna y reaplican el tamaño en vivo.
  [fLabel, fValue, fUnit].forEach(({ inp }) => {
    inp.addEventListener('mousedown', e => e.stopPropagation());
    inp.addEventListener('click',     e => e.stopPropagation());
    inp.addEventListener('input', () => {
      const n = parseFloat(inp.innerText.trim());
      if (isNaN(n) || n <= 0) return;
      const col = inp.dataset.field;
      node.data(col, n);
      window.applyNodeTextSize?.(node);
      window.queueNodeData?.(node.id(), col, n);
    });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
  });

  function _applyTsMode(auto) {
    tsAutoBtn.className = 'sp-ts-auto' + (auto ? ' on' : '');
    tsInputs.style.display = auto ? 'none' : 'flex';
    node.data('text_auto', auto);
    window.queueNodeData?.(node.id(), 'text_auto', auto);
    // Al pasar a manual, sembrar las columnas con el tamaño actual si están vacías.
    if (!auto) {
      [['text_label', fLabel], ['text_value', fValue], ['text_unit', fUnit]].forEach(([col, f]) => {
        const n = parseFloat(f.inp.innerText.trim());
        if (!isNaN(n) && n > 0) {
          node.data(col, n);
          window.queueNodeData?.(node.id(), col, n);
        }
      });
    }
    window.applyNodeTextSize?.(node);
  }

  tsAutoBtn.addEventListener('click', e => {
    e.stopPropagation();
    const prev = _tsAuto;
    _tsAuto = !_tsAuto;
    _applyTsMode(_tsAuto);
    window.pushUndo?.(() => {
      _tsAuto = prev;
      _applyTsMode(prev);
    });
  });

  panel.appendChild(tsChip);

  /////////////////////////////////////////////////////////
  // HIDE WHEN CHIP — condición (fórmula booleana) que oculta el nodo por período
  /////////////////////////////////////////////////////////

  const hideWhenChip = document.createElement('div');
  hideWhenChip.className = 'ui-chip';
  hideWhenChip.style.cursor = 'pointer';
  const hideWhenLbl = document.createElement('div');
  hideWhenLbl.className = 'ui-chip-label';
  hideWhenLbl.innerText = 'Hide when';
  const hideWhenVal = document.createElement('div');
  hideWhenVal.className = 'ui-chip-value';
  const hideWhenTxt = document.createElement('div');
  hideWhenTxt.className = 'ui-chip-alpha';
  hideWhenTxt.style.cssText =
    'min-width:34px;max-width:130px;text-align:right;padding:0 10px;font-size:10px;' +
    'color:#373737;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
  function _hideWhenDisplay() {
    const stored = node.data('hide_when') || '';
    hideWhenTxt.innerText = stored
      ? window.Formula.toDisplay(stored, window.NODES_DATA || [])
      : '—';
  }
  _hideWhenDisplay();
  hideWhenVal.appendChild(hideWhenTxt);
  hideWhenChip.appendChild(hideWhenLbl);
  hideWhenChip.appendChild(hideWhenVal);

  hideWhenChip.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!window.openFormulaEditor) return;
    const r      = hideWhenChip.getBoundingClientRect();
    const prev   = node.data('hide_when') || '';
    window.openFormulaEditor({
      x: r.right + 130, y: r.top,
      nodeId: node.id(),
      period: window.CURRENT_PERIOD || 1,
      storedFormula: prev,
      mode: 'condition',
      onSave: (newStored) => {
        const next = newStored || '';
        node.data('hide_when', next);
        window.queueNodeData?.(node.id(), 'hide_when', next);
        _hideWhenDisplay();
        window.recomputeHideConditions?.();
        window.pushUndo?.(() => {
          node.data('hide_when', prev);
          window.queueNodeData?.(node.id(), 'hide_when', prev);
          _hideWhenDisplay();
          window.recomputeHideConditions?.();
        });
      },
      onCancel: () => {}
    });
  });

  panel.appendChild(hideWhenChip);

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

  // Built-in (incluye 'italy' del registro de países). Las custom del modelo + "Upload SVG"
  // se agregan dinámicamente en _rebuildShapeDropdown (abajo).
  const BUILTIN_SHAPES = ['ellipse', 'round-rectangle', 'rectangle', 'diamond', 'star', 'italy'];

  // Aplica un shape (built-in / país / custom) al nodo. `label` = lo que muestra el chip.
  function _applyShape(shape, label) {
    shapeChip.querySelector('span').innerText = label || shape;
    dropdown.classList.add('hidden');

    const _prevShape = node.data('shape');
    (window.applyNodeShape || ((n, s) => n.style('shape', s)))(node, shape);
    node.data('shape', shape);

    if (typeof window.queueNodeData === 'function') {
      window.queueNodeData(node.id(), 'shape', shape);
      window.pushUndo?.(() => {
        (window.applyNodeShape || ((n, s) => n.style('shape', s)))(node, _prevShape);
        node.data('shape', _prevShape);
        window.queueNodeData(node.id(), 'shape', _prevShape);
      });
    }

    // VISUAL SCALE — escala el eje W (size_px); el mapper recalcula width/height (H respeta lo suyo).
    const baseSize  = parseFloat(node.data('size')) || 80;
    const finalSize = baseSize * (SHAPE_SCALE[shape] || 1);
    node.data('size_px', finalSize);
    window.queueNodeData?.(node.id(), 'size_px', finalSize);
    window.refreshByUnitSizes?.();
    window.applyNodeTextSize?.(node);   // auto: reescala el texto con el nuevo tamaño
  }

  function _shapeOption(key, label) {
    const item = document.createElement('div');
    item.className = 'shape-option';
    item.innerText = label;
    item.addEventListener('click', () => _applyShape(key, label));
    return item;
  }

  // Guarda un SVG subido como shape custom del modelo (texto liviano en models.custom_shapes).
  async function _saveCustomShape(name, points) {
    const list = (window._currentModel?.custom_shapes || []).slice();
    const id = 'shp_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    list.push({ id, name, points });
    await window.saveModelField?.('custom_shapes', list);
    window.registerCustomShapes?.(list);
    return id;
  }

  function _uploadShape() {
    if (window.USER_ROLE === 'reader') return;
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.svg,image/svg+xml';
    inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      const text   = await f.text();
      const points = window.svgToPolygon?.(text);
      if (!points) { alert('No pude extraer un contorno del SVG (necesita un <path> o <polygon>).'); return; }
      let name = (f.name || 'shape').replace(/\.svg$/i, '').slice(0, 24);
      name = (prompt('Nombre del shape:', name) || '').trim().slice(0, 24);
      if (!name) return;
      const id = await _saveCustomShape(name, points);
      _rebuildShapeDropdown();
      _applyShape(id, name);
    });
    inp.click();
  }

  function _rebuildShapeDropdown() {
    dropdown.innerHTML = '';
    BUILTIN_SHAPES.forEach(s => dropdown.appendChild(_shapeOption(s, s)));
    (window._currentModel?.custom_shapes || []).forEach(s => dropdown.appendChild(_shapeOption(s.id, s.name)));
    const up = document.createElement('div');
    up.className = 'shape-option';
    up.innerText = '＋ Upload SVG…';
    up.style.opacity = '0.85';
    up.addEventListener('click', (e) => { e.stopPropagation(); dropdown.classList.add('hidden'); _uploadShape(); });
    dropdown.appendChild(up);
  }
  _rebuildShapeDropdown();

  // El chip refleja el shape actual del nodo (nombre legible si es custom).
  (() => {
    const cur = node.data('shape');
    if (!cur) return;
    const custom = (window._currentModel?.custom_shapes || []).find(s => s.id === cur);
    shapeChip.querySelector('span').innerText = custom ? custom.name : cur;
  })();


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

