
// Unified color picker — window.openColorPicker({ anchorEl, color, hasAlpha, alpha, onChange })

(function() {

  const COLORS = [
    '#57789b', '#d16b6b', '#6f9d6d', '#b08ccc',
    '#d3a25f', '#5f8f95', '#8c8c8c', '#3f3f3f'
  ];

  window._colorPickerAnchor = null;
  let _picker = null;
  let _outsideHandler = null;

  window.closeColorPicker = function() {
    window._colorPickerAnchor = null;
    if (_outsideHandler) {
      document.removeEventListener('pointerdown', _outsideHandler);
      _outsideHandler = null;
    }
    if (_picker) { _picker.remove(); _picker = null; }
  };

  window.openColorPicker = function({ anchorEl, color, hasAlpha = false, alpha = 1, onChange }) {
    window.closeColorPicker();

    const picker = document.createElement('div');
    picker.className = 'color-picker-popup';

    let _color = color || COLORS[0];
    let _alpha = hasAlpha ? (alpha ?? 1) : 1;

    const _emit = () => onChange?.(_color, _alpha);

    // Swatches row
    const row = document.createElement('div');
    row.className = 'cp-row';
    row.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:nowrap;';

    COLORS.forEach(c => {
      const sw = document.createElement('div');
      sw.className = 'color-option' + (c === _color ? ' cp-active' : '');
      sw.style.cssText = `background:${c};width:20px;height:20px;border-radius:6px;flex-shrink:0;cursor:pointer;box-sizing:border-box;`;
      sw.addEventListener('click', e => {
        e.stopPropagation();
        _color = c;
        _emit();
        window.closeColorPicker();
      });
      row.appendChild(sw);
    });

    // Custom color square
    const customWrap = document.createElement('div');
    customWrap.className = 'color-option cp-custom';
    customWrap.style.cssText = `width:20px;height:20px;border-radius:6px;flex-shrink:0;cursor:pointer;box-sizing:border-box;position:relative;overflow:hidden;border:1.5px dashed rgba(255,255,255,0.35);background:${COLORS.includes(_color) ? '#e8e8e8' : _color};`;

    const nativeInput = document.createElement('input');
    nativeInput.type  = 'color';
    nativeInput.value = _color.startsWith('#') ? _color : '#888888';
    nativeInput.className = 'cp-native-input';

    const plusSpan = document.createElement('span');
    plusSpan.className = 'cp-plus-icon';
    plusSpan.innerText = '+';

    nativeInput.addEventListener('input', () => {
      _color = nativeInput.value;
      customWrap.style.background = _color;
      _emit();
    });
    nativeInput.addEventListener('change', () => {
      _color = nativeInput.value;
      _emit();
      window.closeColorPicker();
    });

    customWrap.appendChild(nativeInput);
    customWrap.appendChild(plusSpan);
    row.appendChild(customWrap);
    picker.appendChild(row);

    // Alpha row
    if (hasAlpha) {
      const alphaRow = document.createElement('div');
      alphaRow.className = 'cp-alpha-row';

      const lbl = document.createElement('span');
      lbl.className = 'cp-alpha-lbl';
      lbl.innerText = 'alpha';

      const val = document.createElement('div');
      val.className = 'ui-chip-alpha';
      val.contentEditable = true;
      val.spellcheck = false;
      val.innerText = Math.round(_alpha * 100) + ' %';

      val.addEventListener('input', () => {
        const n = parseFloat(val.innerText.replace('%', '').trim());
        if (!isNaN(n)) {
          _alpha = Math.max(0, Math.min(1, n / 100));
          _emit();
        }
      });

      alphaRow.appendChild(lbl);
      alphaRow.appendChild(val);
      picker.appendChild(alphaRow);
    }

    document.body.appendChild(picker);

    // Position right of anchor, clamp to viewport
    const r = anchorEl.getBoundingClientRect();
    picker.style.left = (r.right + 8) + 'px';
    picker.style.top  = r.top + 'px';

    requestAnimationFrame(() => {
      const pr = picker.getBoundingClientRect();
      if (pr.right > window.innerWidth - 8)
        picker.style.left = Math.max(8, r.left - pr.width - 8) + 'px';
      if (pr.bottom > window.innerHeight - 8)
        picker.style.top = Math.max(8, window.innerHeight - pr.height - 8) + 'px';
    });

    _picker = picker;
    window._colorPickerAnchor = anchorEl;

    _outsideHandler = e => {
      if (!picker.contains(e.target) && !anchorEl.contains(e.target))
        window.closeColorPicker();
    };
    setTimeout(() => document.addEventListener('pointerdown', _outsideHandler), 0);
  };

})();
