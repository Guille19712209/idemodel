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
    const brace = 'rgba(255,255,255,0.22)';   // llaves tenues, casi invisibles
    return tokens.map(t => {
      if (t.type === 'ref') {
        return `<span style="color:${brace}">{</span>` +
               `<span style="color:${COLORS.ref}">${_esc(t.display)}</span>` +
               `<span style="color:${brace}">}</span>` +
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
    // Placeholder para editor vacío: <br> da altura/caret sin aportar texto.
    // (Un span con '|' aunque sea opacity:0 SÍ cuenta en innerText y se filtraba
    //  al contenido, apareciendo como token rojo tras insertar un nodo.)
    el.innerHTML = _tokensToHtml(tokens) || '<br>';
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

    // ─── Facilitadores de carga: chips "All times" / "Import" ─────────
    let _busy  = false;   // suprime el auto-cierre del editor mientras hay un sub-panel o diálogo nativo abierto
    let _subEl = null;

    const chipsRow = document.createElement('div');
    Object.assign(chipsRow.style, {
      display: 'flex', gap: '6px', alignItems: 'center', padding: '0 2px 6px',
    });
    chipsRow.appendChild(_pill('All times', _spreadAllTimes));
    chipsRow.appendChild(_pill('From now',  _spreadFromNow));
    chipsRow.appendChild(_pill('Import',    _openImportMenu));
    wrap.insertBefore(chipsRow, ed);

    function _pill(text, onClick) {
      const el = document.createElement('div');
      el.textContent = text;
      el.style.cssText =
        'font-size:10px;line-height:1;padding:4px 9px;border-radius:10px;' +
        'cursor:pointer;user-select:none;white-space:nowrap;' +
        'background:rgba(255,255,255,0.10);color:rgba(255,255,255,0.72);';
      el.addEventListener('mouseenter', () => el.style.background = 'rgba(255,255,255,0.18)');
      el.addEventListener('mouseleave', () => el.style.background = 'rgba(255,255,255,0.10)');
      el.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); });
      el.addEventListener('click',     e => { e.preventDefault(); e.stopPropagation(); onClick(); });
      return el;
    }

    function _btn(text, onClick, primary) {
      const b = document.createElement('div');
      b.textContent = text;
      b.style.cssText =
        'font-size:10px;padding:4px 10px;border-radius:8px;cursor:pointer;white-space:nowrap;' +
        (primary ? 'background:#7eb8ff;color:#11151c;'
                 : 'background:rgba(255,255,255,0.12);color:rgba(255,255,255,0.75);');
      b.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); });
      b.addEventListener('click',     e => { e.preventDefault(); e.stopPropagation(); onClick(); });
      return b;
    }

    // Cierra el editor restaurando el estado del host (graph-labels oculta el
    // label del valor mientras edita y sólo lo restaura vía onCancel/onSave).
    function _closeAsCancel() {
      const cb = _onCancel;
      closeFormulaEditor();
      cb?.();
    }

    // Reclampa el panel dentro del viewport. Al crecer (sub-paneles) cerca del
    // borde inferior, esto lo empuja hacia arriba para que no se salga de pantalla.
    function _reposition() {
      requestAnimationFrame(() => {
        if (!_wrap) return;
        const eh = _wrap.offsetHeight, ew = _wrap.offsetWidth;
        let top  = parseFloat(_wrap.style.top)  || 0;
        let left = parseFloat(_wrap.style.left) || 0;
        top  = Math.max(8, Math.min(window.innerHeight - eh - 8, top));
        left = Math.max(8, Math.min(window.innerWidth  - ew - 8, left));
        _wrap.style.top  = top  + 'px';
        _wrap.style.left = left + 'px';
      });
    }

    function _closeSub() {
      if (_subEl) { _subEl.remove(); _subEl = null; }
      _busy = false;
      _reposition();
    }

    function _openSub(build) {
      _closeSub();
      dd.style.display = 'none';
      _busy  = true;
      _subEl = document.createElement('div');
      _subEl.style.cssText =
        'margin-top:6px;padding:8px;border-radius:8px;display:flex;flex-direction:column;gap:6px;' +
        'background:rgba(255,255,255,0.06);';
      build(_subEl);
      chipsRow.after(_subEl);
      _reposition();
    }

    function _currentStored() {
      return window.Formula.serialize(window.Formula.tokenize(_getPlain(ed), nodes));
    }

    function _parseNumbers(text) {
      return String(text || '')
        .split(/[\s,;]+/).map(s => s.trim()).filter(s => s !== '')
        .map(Number).filter(n => !isNaN(n));
    }

    // Escribe la serie en los períodos disponibles desde la posición actual hacia adelante.
    async function _applySeries(nums, warnEl) {
      if (!nums.length) {
        if (warnEl) { warnEl.textContent = 'No valid numbers found.'; warnEl.style.display = 'block'; }
        return;
      }
      const periods   = window.MODEL_DATA?.periods || window._currentModel?.periods || 1;
      const startP    = period || window.CURRENT_PERIOD || 1;
      const available = Math.max(0, periods - startP + 1);
      const used      = nums.slice(0, available);
      for (let i = 0; i < used.length; i++) {
        await window.saveFormulaForPeriod(_nodeId, startP + i, String(used[i]));
      }
      window.recomputeFormulas?.();
      window.refreshFormulaEdges?.();
      window.refreshTimelinePanel?.();
      if (nums.length > available) {
        const msg = "The series exceeds the number of available periods; the extra values won't be pasted.";
        if (warnEl) { warnEl.textContent = msg; warnEl.style.display = 'block'; }
        else alert(msg);
        // se deja el editor abierto para que el aviso quede visible
      } else {
        _closeAsCancel();
      }
    }

    function _spreadAllTimes() {
      if (!_validate(_getPlain(ed))) return;   // no esparcir fórmulas inválidas / con ciclo
      const periods = window.MODEL_DATA?.periods || window._currentModel?.periods || 1;
      const stored  = _currentStored();
      _openSub(box => {
        const msg = document.createElement('div');
        msg.textContent = `Are you sure you want to spread this formula across all ${periods} periods?`;
        msg.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.85);';
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:6px;justify-content:flex-end;';
        const ok = _btn('Spread', async () => {
          for (let p = 1; p <= periods; p++) await window.saveFormulaForPeriod(_nodeId, p, stored);
          window.recomputeFormulas?.();
          window.refreshFormulaEdges?.();
          window.refreshTimelinePanel?.();
          _closeAsCancel();
        }, true);
        row.append(_btn('Cancel', _closeSub, false), ok);
        box.append(msg, row);
      });
    }

    // Esparce la fórmula desde el período activo hasta el último.
    function _spreadFromNow() {
      if (!_validate(_getPlain(ed))) return;   // no esparcir fórmulas inválidas / con ciclo
      const periods = window.MODEL_DATA?.periods || window._currentModel?.periods || 1;
      const startP  = period || window.CURRENT_PERIOD || 1;
      const stored  = _currentStored();
      const count   = Math.max(0, periods - startP + 1);
      _openSub(box => {
        const msg = document.createElement('div');
        msg.textContent = `Spread this formula from the current period to the last (${count} period${count === 1 ? '' : 's'})?`;
        msg.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.85);';
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:6px;justify-content:flex-end;';
        const ok = _btn('Spread', async () => {
          for (let p = startP; p <= periods; p++) await window.saveFormulaForPeriod(_nodeId, p, stored);
          window.recomputeFormulas?.();
          window.refreshFormulaEdges?.();
          window.refreshTimelinePanel?.();
          _closeAsCancel();
        }, true);
        row.append(_btn('Cancel', _closeSub, false), ok);
        box.append(msg, row);
      });
    }

    function _openImportMenu() {
      _openSub(box => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:6px;';
        row.append(_btn('Paste',    () => _openPastePanel(), false),
                   _btn('Load CSV', _openCsvLoader,          false));
        box.append(row);
      });
    }

    function _openPastePanel(prefill) {
      _openSub(box => {
        const lbl = document.createElement('div');
        lbl.textContent = 'Paste a series of numbers separated by spaces';
        lbl.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.85);';
        const ta = document.createElement('textarea');
        ta.value = prefill || '';
        ta.style.cssText =
          'width:100%;min-height:48px;resize:vertical;box-sizing:border-box;' +
          "font:12px 'Courier New',monospace;background:rgba(0,0,0,0.25);color:#fff;" +
          'border:1px solid rgba(255,255,255,0.12);border-radius:6px;padding:5px;outline:none;';
        ta.addEventListener('keydown', e => e.stopPropagation());
        const warn = document.createElement('div');
        warn.style.cssText = 'font-size:10px;color:#ffb86b;display:none;';
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:6px;justify-content:flex-end;';
        row.append(_btn('Cancel', _closeSub, false),
                   _btn('Apply',  () => _applySeries(_parseNumbers(ta.value), warn), true));
        box.append(lbl, ta, warn, row);
        setTimeout(() => ta.focus(), 0);
      });
    }

    function _openCsvLoader() {
      const input = document.createElement('input');
      input.type   = 'file';
      input.accept = '.csv,text/csv,text/plain';
      input.style.display = 'none';
      document.body.appendChild(input);
      const cleanup = () => { input.remove(); _busy = false; };
      input.addEventListener('change', () => {
        const f = input.files && input.files[0];
        if (!f) { cleanup(); return; }
        const reader = new FileReader();
        reader.onload  = () => { cleanup(); _openPastePanel(_parseNumbers(String(reader.result)).join(' ')); };
        reader.onerror = cleanup;
        reader.readAsText(f);
      });
      input.addEventListener('cancel', cleanup);
      _busy = true;   // evita que blur/outside cierren el editor mientras está abierto el diálogo de archivo
      input.click();
    }

    function _validate(text) {
      const tokens = window.Formula.tokenize(text, nodes);
      const stored = window.Formula.serialize(tokens);
      const errs   = window.Formula.validate(stored, _nodeId, period);
      errLine.textContent = errs[0] || '';
      errLine.style.display = errs.length ? 'block' : 'none';
      // Resalta en rojo los nodos del ciclo aunque la fórmula no se guarde
      const cyc = window.Formula.cyclePath(_nodeId, period, stored);
      window.FORMULA_CYCLE_PREVIEW = (cyc && cyc.size) ? cyc : null;
      window.markFormulaCycles?.();
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
        .forEach(n => items.push({ label: n.label, color: COLORS.ref, fn: () => _replaceWord(ctx.partial, '{' + n.label + '}[') }));
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
      setTimeout(() => { if (!_busy && _wrap && !_wrap.contains(document.activeElement)) _save(); }, 160);
    });

    function _outside(e) {
      if (_busy) return;   // sub-panel o diálogo abierto: no cerrar por click afuera
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
    // Limpia el resaltado transitorio de ciclo al cerrar el editor
    if (window.FORMULA_CYCLE_PREVIEW) {
      window.FORMULA_CYCLE_PREVIEW = null;
      window.markFormulaCycles?.();
    }
  }

  window.closeFormulaEditor = closeFormulaEditor;

})();
