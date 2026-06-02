
window.INPUT_PANEL = null;

window.openNodeInputPanel = function(node, anchorEl) {
  window.closeNodeInputPanel();

  const panel = document.createElement('div');
  panel.id = 'node-input-panel';
  panel.className = 'node-style-panel';

  panel.appendChild(_buildCoordChip(node));

  document.body.appendChild(panel);
  window.INPUT_PANEL = panel;

  requestAnimationFrame(() => {
    const r  = anchorEl.getBoundingClientRect();
    const pw = panel.offsetWidth  || 200;
    const ph = panel.offsetHeight || 40;
    const mg = 8;
    let left = r.right + mg;
    if (left + pw > window.innerWidth - mg) left = r.left - pw - mg;
    let top = Math.max(mg, Math.min(window.innerHeight - ph - mg, r.top));
    panel.style.left = left + 'px';
    panel.style.top  = top  + 'px';
  });

  setTimeout(() => {
    document.addEventListener('pointerdown', function _outside(ev) {
      if (panel.contains(ev.target) || anchorEl.contains(ev.target)) return;
      window.closeNodeInputPanel();
      document.removeEventListener('pointerdown', _outside);
    });
  }, 0);
};

window.closeNodeInputPanel = function() {
  document.getElementById('node-input-panel')?.remove();
  window.INPUT_PANEL = null;
};

function _buildCoordChip(node) {
  const pos = node.position();

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;align-items:center;';

  const _makeChip = (axis, initVal) => {
    const chip = document.createElement('div');
    chip.className = 'ui-chip';
    chip.style.cursor = 'default';

    const lbl = document.createElement('div');
    lbl.className = 'ui-chip-label';
    lbl.innerText = axis;
    lbl.style.padding = '0 8px';

    const val = document.createElement('div');
    val.className = 'ui-chip-alpha';
    val.contentEditable = true;
    val.spellcheck = false;
    val.innerText = Math.round(initVal);
    val.style.cssText = 'min-width:38px;text-align:right;padding:0 8px;cursor:text;font-size:10px;color:#373737;';

    chip.appendChild(lbl);
    chip.appendChild(val);
    return { chip, val };
  };

  const { chip: xChip, val: xVal } = _makeChip('x', pos.x);
  const { chip: yChip, val: yVal } = _makeChip('y', pos.y);

  const _apply = () => {
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

  xVal.addEventListener('blur', _apply);
  yVal.addEventListener('blur', _apply);

  xVal.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); xVal.blur(); }
    if (e.key === 'Tab')   { e.preventDefault(); yVal.focus(); }
  });
  yVal.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); yVal.blur(); }
  });

  row.appendChild(xChip);
  row.appendChild(yChip);
  return row;
}
