
window.COMMENTS_NODE_PANEL = null;

window.openNodeCommentsPanel = function(node, anchorEl) {
  window.closeNodeCommentsPanel();

  const nodeId = node.id();
  const current = node.data('comment') || '';

  const panel = document.createElement('div');
  panel.id = 'node-comments-panel';
  panel.className = 'node-style-panel';

  // Chip with gray area (same visual pattern as Groups chip)
  const chip = document.createElement('div');
  chip.className = 'ui-chip';
  chip.style.cssText = 'background:transparent;overflow:visible;gap:0;cursor:default;height:auto;align-items:flex-start;';

  const lbl = document.createElement('div');
  lbl.className = 'ui-chip-label';
  lbl.innerText = 'comment';
  lbl.style.cssText = 'height:24px;flex-shrink:0;position:relative;z-index:1;align-self:flex-start;';

  const wrap = document.createElement('div');
  wrap.style.cssText = 'background:#cac9c9;border-radius:12px;padding:5px 10px 5px 22px;margin-left:-18px;box-sizing:border-box;align-self:flex-start;';

  const ta = document.createElement('textarea');
  ta.style.cssText = [
    'background:transparent;border:none;outline:none;resize:none;',
    'font-family:inherit;font-size:10px;color:#373737;',
    'width:120px;min-height:18px;max-height:80px;overflow-y:auto;',
    'display:block;line-height:1.5;padding:0;margin:0;',
    'box-sizing:border-box;'
  ].join('');
  ta.spellcheck = false;
  ta.placeholder = 'add a comment…';
  ta.value = current;

  const _resize = () => {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 80) + 'px';
  };

  ta.addEventListener('input', _resize);

  ta.addEventListener('blur', () => {
    const text = ta.value;
    node.data('comment', text);
    if (typeof window.queueNodeData === 'function') {
      window.queueNodeData(nodeId, 'comment', text || null);
    }
  });

  wrap.appendChild(ta);
  chip.appendChild(lbl);
  chip.appendChild(wrap);
  panel.appendChild(chip);

  document.body.appendChild(panel);
  window.COMMENTS_NODE_PANEL = panel;

  requestAnimationFrame(() => {
    _resize();
    if (!current) ta.focus();

    const r  = anchorEl.getBoundingClientRect();
    const pw = panel.offsetWidth  || 200;
    const ph = panel.offsetHeight || 50;
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
      window.closeNodeCommentsPanel();
      document.removeEventListener('pointerdown', _outside);
    });
  }, 0);
};

window.closeNodeCommentsPanel = function() {
  document.getElementById('node-comments-panel')?.remove();
  window.COMMENTS_NODE_PANEL = null;
};
