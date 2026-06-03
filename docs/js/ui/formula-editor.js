/////////////////////
// FORMULA EDITOR — contenteditable con syntax highlighting
/////////////////////

(function() {

  const FONT    = "13px/1.6 'Courier New', Courier, monospace";
  const PADDING = '6px 10px';
  const COLORS  = {
    ref:    '#7eb8ff',
    number: 'rgba(255,255,255,0.92)',
    op:     'rgba(255,255,255,0.42)',
    func:   '#98d98e',
    space:  'rgba(255,255,255,0.9)',
    text:   '#ff8080',
  };

  let _wrap     = null;
  let _editor   = null;
  let _nodeId   = null;
  let _onSave   = null;
  let _onCancel = null;

  function _esc(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function _tokensToHtml(tokens) {
    return tokens.map(t => {
      if (t.type === 'ref') {
        return `<span style="color:${COLORS.ref}">${_esc(t.display)}</span>` +
               `<span style="color:rgba(255,255,255,0.38)">[${t.offset}]</span>`;
      }
      const color = COLORS[t.type] || COLORS.text;
      return `<span style="color:${color}">${_esc(t.text)}</span>`;
    }).join('');
  }

  // ─── Cursor helpers ───────────────────────────────────────────────

  function _getPlain(el) {
    return (el.innerText || '').replace(/\r?\n/g, '');
  }

  function _getCursorOffset(el) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return _getPlain(el).length;
    try {
      const range = sel.getRangeAt(0).cloneRange();
      range.setStart(el, 0);
      return range.toString().length;
    } catch(e) { return 0; }
  }

  function _setCursorOffset(el, offset) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let remaining = Math.max(0, offset);
    let node;
    while ((node = walker.nextNode())) {
      const len = node.textContent.length;
      if (remaining <= len) {
        const range = document.createRange();
        range.setStart(node, remaining);
        range.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        return;
      }
      remaining -= len;
    }
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  }

  function _render(el, nodes, text, cursorPos) {
    const tokens = window.Formula.tokenize(text, nodes);
    el.innerHTML = _tokensToHtml(tokens) || '<span style="opacity:0">|</span>';
    if (cursorPos !== undefined) _setCursorOffset(el, cursorPos);
  }

  // ─── Open ─────────────────────────────────────────────────────────

  window.openFormulaEditor = function({ x, y, nodeId, period, storedFormula, onSave, onCancel }) {
    closeFormulaEditor();
    _nodeId   = nodeId;
    _onSave   = onSave;
    _onCancel = onCancel;

    const nodes       = window.NODES_DATA || [];
    const displayText = window.Formula.toDisplay(storedFormula, nodes);

    const wrap = document.createElement('div');
    wrap.id = 'formula-editor';
    Object.assign(wrap.style, {
      position: 'fixed', zIndex: '9999999',
      background: 'rgba(30,30,36,0.82)', backdropFilter: 'blur(8px)',
      borderRadius: '14px', padding: '8px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      minWidth: '220px', maxWidth: '440px',
      border: '1px solid rgba(255,255,255,0.07)',
    });

    const ed = document.createElement('div');
    ed.contentEditable = 'true';
    ed.spellcheck      = false;
    ed.autocorrect     = 'off';
    ed.autocapitalize  = 'off';
    Object.assign(ed.style, {
      outline: 'none', font: FONT, padding: PADDING,
      minHeight: '28px', minWidth: '180px',
      caretColor: 'white', whiteSpace: 'pre-wrap',
      wordBreak: 'break-word', cursor: 'text',
      boxSizing: 'border-box',
    });
    _editor = ed;

    const dd = document.createElement('div');
    Object.assign(dd.style, {
      display: 'none', flexDirection: 'column',
      background: 'rgba(28,28,34,0.99)',
      borderRadius: '8px', marginTop: '4px',
      boxShadow: '0 2px 14px rgba(0,0,0,0.45)',
      maxHeight: '180px', overflowY: 'auto',
    });

    const errLine = document.createElement('div');
    Object.assign(errLine.style, {
      fontSize: '10px', color: '#ff6b6b',
      padding: '2px 10px 0', display: 'none',
    });

    wrap.appendChild(ed);
    wrap.appendChild(dd);
    wrap.appendChild(errLine);
    document.body.appendChild(wrap);
    _wrap = wrap;

    function _validate(text) {
      const tokens = window.Formula.tokenize(text, nodes);
      const stored = window.Formula.serialize(tokens);
      const errs   = window.Formula.validate(stored, _nodeId, period);
      errLine.textContent = errs[0] || '';
      errLine.style.display = errs.length ? 'block' : 'none';
      return errs.length === 0;
    }

    function _getContext() {
      const text   = _getPlain(ed);
      const pos    = _getCursorOffset(ed);
      const before = text.slice(0, pos);
      if (before.endsWith('[')) return { type: 'bracket' };
      const m = before.match(/([A-Za-záéíóúüñÁÉÍÓÚÜÑ][A-Za-z0-9áéíóúüñÁÉÍÓÚÜÑ\s]*)$/);
      if (m && m[1].trim()) return { type: 'word', partial: m[1].trimStart() };
      return null;
    }

    function _ddItem(label, color, onSelect) {
      const el = document.createElement('div');
      el.textContent = label;
      Object.assign(el.style, {
        padding: '5px 12px', fontSize: '11px', cursor: 'pointer',
        color, whiteSpace: 'nowrap', fontFamily: "'Courier New', monospace",
      });
      el.addEventListener('mouseenter', () => el.style.background = 'rgba(255,255,255,0.07)');
      el.addEventListener('mouseleave', () => el.style.background = '');
      el.addEventListener('mousedown', e => { e.preventDefault(); onSelect(); });
      return el;
    }

    function _showDd(items) {
      dd.innerHTML = '';
      if (!items.length) { dd.style.display = 'none'; return; }
      items.forEach(it => dd.appendChild(_ddItem(it.label, it.color, it.fn)));
      dd.style.display = 'flex';
    }

    function _updateDd() {
      const ctx = _getContext();
      if (!ctx) { dd.style.display = 'none'; return; }
      if (ctx.type === 'bracket') {
        _showDd([
          { label: '0   — Actual',            color: 'rgba(255,255,255,0.7)', fn: () => _insertText('0]') },
          { label: '-1  — Anterior',           color: 'rgba(255,255,255,0.7)', fn: () => _insertText('-1]') },
          { label: '-2  — Dos períodos atrás', color: 'rgba(255,255,255,0.7)', fn: () => _insertText('-2]') },
          { label: '+1  — Próximo',            color: 'rgba(255,255,255,0.45)', fn: () => _insertText('+1]') },
        ]);
        return;
      }
      const p = ctx.partial.toLowerCase();
      if (!p) { dd.style.display = 'none'; return; }
      const items = [];
      nodes.filter(n => n.label && n.label.toLowerCase().startsWith(p)).slice(0, 8)
        .forEach(n => items.push({ label: n.label, color: COLORS.ref, fn: () => _replaceWord(ctx.partial, n.label + '[') }));
      window.Formula.FUNCTIONS.filter(fn => fn.toLowerCase().startsWith(p))
        .forEach(fn => items.push({ label: fn + '()', color: COLORS.func, fn: () => _replaceWord(ctx.partial, fn + '(') }));
      _showDd(items);
    }

    function _insertText(text) {
      const pos     = _getCursorOffset(ed);
      const plain   = _getPlain(ed);
      const newText = plain.slice(0, pos) + text + plain.slice(pos);
      _render(ed, nodes, newText, pos + text.length);
      _validate(newText);
      dd.style.display = 'none';
      ed.focus();
    }

    function _replaceWord(partial, replacement) {
      const isNodeRef = replacement.endsWith('[');
      const full      = isNodeRef ? replacement + '0]' : replacement;
      const pos       = _getCursorOffset(ed);
      const plain     = _getPlain(ed);
      const newBefore = plain.slice(0, pos - partial.length) + full;
      const newText   = newBefore + plain.slice(pos);
      _render(ed, nodes, newText, newBefore.length);
      _validate(newText);
      dd.style.display = 'none';
      ed.focus();
    }

    function _save() {
      const text = _getPlain(ed);
      if (!_validate(text)) return;
      const tokens = window.Formula.tokenize(text, nodes);
      const stored = window.Formula.serialize(tokens);
      const cb = _onSave;
      closeFormulaEditor();
      cb?.(stored);
    }

    ed.addEventListener('input', () => {
      const pos  = _getCursorOffset(ed);
      const text = _getPlain(ed);
      _render(ed, nodes, text, pos);
      _updateDd();
      _validate(text);
    });

    ed.addEventListener('paste', e => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text/plain');
      _insertText(text.replace(/\r?\n/g, ' '));
    });

    ed.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _save(); return; }
      if (e.key === 'Escape') { const cb = _onCancel; closeFormulaEditor(); cb?.(); return; }
      if (e.key === 'Tab' && dd.style.display !== 'none') {
        e.preventDefault();
        dd.querySelector('div')?.dispatchEvent(new MouseEvent('mousedown'));
        return;
      }
      e.stopPropagation();
    });

    ed.addEventListener('blur', () => {
      setTimeout(() => { if (_wrap && !_wrap.contains(document.activeElement)) _save(); }, 160);
    });

    function _outside(e) {
      if (_wrap && !_wrap.contains(e.target)) {
        document.removeEventListener('pointerdown', _outside, true);
        _save();
      }
    }
    setTimeout(() => document.addEventListener('pointerdown', _outside, true), 0);

    _render(ed, nodes, displayText, displayText.length);
    _validate(displayText);

    requestAnimationFrame(() => {
      const ew = wrap.offsetWidth, eh = wrap.offsetHeight;
      let left = Math.max(8, Math.min(window.innerWidth  - ew - 8, x - ew / 2));
      let top  = Math.max(8, Math.min(window.innerHeight - eh - 8, y - eh / 2));
      wrap.style.left = left + 'px';
      wrap.style.top  = top  + 'px';
      ed.focus();
      _setCursorOffset(ed, displayText.length);
    });
  };

  function closeFormulaEditor() {
    if (_wrap) { _wrap.remove(); _wrap = null; }
    _editor = null;
    _nodeId = null; _onSave = null; _onCancel = null;
  }

  window.closeFormulaEditor = closeFormulaEditor;

})();
