(function() {

  let _panel            = null;
  let _filterPanel      = null;
  let _subPanel         = null;
  let _activeSubRow     = null;
  let _isResizing       = false;
  let _resizeStartY     = 0;
  let _resizeStartH     = 0;

  let _filterState = {
    sort:       'default',
    hiddenIds:  new Set(),
    parentIds:  new Set(),
    groupIds:   new Set(),
    conceptIds: new Set(),
  };

  let _showMode = 'values'; // 'values' | 'formulas'

  // ─── Panel DOM ────────────────────────────────────────────────────

  function _ensurePanel() {
    if (_panel) return _panel;

    _panel = document.createElement('div');
    _panel.id = 'node-timeline-panel';
    Object.assign(_panel.style, {
      position:'fixed', bottom:'0', left:'20px', right:'20px',
      height:'20vh', minHeight:'80px',
      background:'rgba(30,30,36,0.72)', borderRadius:'14px 14px 0 0',
      zIndex:'99998', display:'none', flexDirection:'column', pointerEvents:'auto',
    });
    document.body.appendChild(_panel);

    if (!document.getElementById('ntv-style')) {
      const s = document.createElement('style');
      s.id = 'ntv-style';
      s.textContent = `
        #node-timeline-panel ::-webkit-scrollbar,
        .ntv-fp ::-webkit-scrollbar { width:5px; height:5px; }
        #node-timeline-panel ::-webkit-scrollbar-track,
        .ntv-fp ::-webkit-scrollbar-track { background:rgba(255,255,255,0.04); border-radius:3px; }
        #node-timeline-panel ::-webkit-scrollbar-thumb,
        .ntv-fp ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.18); border-radius:3px; }
        #node-timeline-panel ::-webkit-scrollbar-thumb:hover,
        .ntv-fp ::-webkit-scrollbar-thumb:hover { background:rgba(255,255,255,0.32); }
        #node-timeline-panel ::-webkit-scrollbar-corner,
        .ntv-fp ::-webkit-scrollbar-corner { background:transparent; }
        #node-timeline-panel, .ntv-fp
          { scrollbar-width:thin; scrollbar-color:rgba(255,255,255,0.18) rgba(255,255,255,0.04); }
      `;
      document.head.appendChild(s);
    }

    const handle = document.createElement('div');
    Object.assign(handle.style, {
      height:'18px', cursor:'ns-resize',
      display:'flex', alignItems:'center', justifyContent:'center', flexShrink:'0',
    });
    const bar = document.createElement('div');
    Object.assign(bar.style, {
      width:'32px', height:'3px',
      background:'rgba(255,255,255,0.18)', borderRadius:'2px', transition:'background 0.15s',
    });
    handle.appendChild(bar);
    handle.addEventListener('mouseenter', () => bar.style.background = 'rgba(255,255,255,0.38)');
    handle.addEventListener('mouseleave', () => bar.style.background = 'rgba(255,255,255,0.18)');
    handle.addEventListener('mousedown', (e) => {
      _isResizing = true; _resizeStartY = e.clientY; _resizeStartH = _panel.offsetHeight;
      document.addEventListener('mousemove', _onResize);
      document.addEventListener('mouseup',   _stopResize);
      e.preventDefault();
    });
    _panel.appendChild(handle);

    const content = document.createElement('div');
    content.className = 'ntv-content';
    Object.assign(content.style, {
      flex:'1', overflow:'hidden',
      display:'flex', flexDirection:'column', padding:'0 16px 12px',
    });
    _panel.appendChild(content);

    return _panel;
  }

  function _onResize(e) {
    if (!_isResizing || !_panel) return;
    _panel.style.height = Math.max(80, _resizeStartH + (_resizeStartY - e.clientY)) + 'px';
  }
  function _stopResize() {
    _isResizing = false;
    document.removeEventListener('mousemove', _onResize);
    document.removeEventListener('mouseup',   _stopResize);
  }

  // ─── Open / Close ─────────────────────────────────────────────────

  window.openNodeTimelinePanel = function(node) {
    const panel = _ensurePanel();
    if (panel.style.display !== 'none' && panel._nodeId === node.id()) {
      window.closeNodeTimelinePanel(); return;
    }
    const allIds = (window.NODES_DATA || []).map(n => n.id);
    _filterState = {
      sort:       'default',
      hiddenIds:  new Set(allIds.filter(id => id !== node.id())),
      parentIds:  new Set(),
      groupIds:   new Set(),
      conceptIds: new Set(),
    };
    panel._nodeId = node.id();
    panel.style.display = 'flex';
    panel.animate(
      [{ transform:'translateY(100%)' }, { transform:'translateY(0)' }],
      { duration:220, easing:'cubic-bezier(0.4,0,0.2,1)', fill:'forwards' }
    );
    document.getElementById('settings-btn') && (document.getElementById('settings-btn').style.display = 'none');
    document.getElementById('add-node-btn')  && (document.getElementById('add-node-btn').style.display  = 'none');
    _renderContent(node.id());
  };

  window.closeNodeTimelinePanel = function() {
    if (!_panel || _panel.style.display === 'none') return;
    _closeFilterPanel();
    _panel.style.display = 'none';
    _panel._nodeId = null;
    document.getElementById('settings-btn') && (document.getElementById('settings-btn').style.display = '');
    document.getElementById('add-node-btn')  && (document.getElementById('add-node-btn').style.display  = '');
  };

  // ─── Render ───────────────────────────────────────────────────────

  function _renderContent(activeNodeId) {
    const content = _panel?.querySelector('.ntv-content');
    if (!content) return;
    content.innerHTML = '';

    const model     = window._currentModel || {};
    const periods   = model.periods        || 1;
    const timeUnit  = model.time_unit      || 'moment';
    const startDate = model.starting_date  || null;
    const allNodes  = window.NODES_DATA    || [];
    const values    = window.VALUES_DATA   || {};

    const panelW = _panel.offsetWidth || (window.innerWidth - 40);
    const firstW = 130;
    const colW   = Math.floor((panelW - firstW - 32) / Math.min(periods, 12));

    // Barra título + chip FILTER
    const titleBar = document.createElement('div');
    Object.assign(titleBar.style, {
      display:'flex', alignItems:'center', gap:'8px', flexShrink:'0', paddingBottom:'6px',
    });
    const title = document.createElement('div');
    title.textContent = 'Values in time';
    Object.assign(title.style, {
      fontSize:'10px', fontWeight:'600', color:'rgba(255,255,255,0.4)',
      letterSpacing:'0.07em', textTransform:'uppercase',
    });
    const hasFilter = _filterState.parentIds.size > 0 || _filterState.groupIds.size > 0
      || _filterState.conceptIds.size > 0 || _filterState.sort !== 'default';
    const filterChip = document.createElement('div');
    filterChip.textContent = 'FILTER';
    Object.assign(filterChip.style, {
      fontSize:'9px', fontWeight:'600', letterSpacing:'0.06em',
      padding:'3px 9px', borderRadius:'10px', cursor:'pointer',
      background: hasFilter ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.12)',
      color: hasFilter ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)',
      userSelect:'none', flexShrink:'0',
    });
    filterChip.addEventListener('click', (e) => {
      e.stopPropagation();
      if (_filterPanel) { _closeFilterPanel(); return; }
      _openFilterPanel(filterChip, activeNodeId, allNodes);
    });
    // Toggle formulas / values
    const toggleWrap = document.createElement('div');
    Object.assign(toggleWrap.style, {
      display:'flex', alignItems:'center', borderRadius:'10px', overflow:'hidden',
      background:'rgba(255,255,255,0.10)', flexShrink:'0',
    });
    ['values','formulas'].forEach(mode => {
      const btn = document.createElement('div');
      btn.textContent = mode;
      btn.dataset.mode = mode;
      Object.assign(btn.style, {
        fontSize:'9px', fontWeight:'600', letterSpacing:'0.06em',
        padding:'3px 9px', cursor:'pointer', userSelect:'none', transition:'background 0.15s, color 0.15s',
        background: _showMode === mode ? 'rgba(255,255,255,0.28)' : 'transparent',
        color:      _showMode === mode ? 'rgba(255,255,255,0.9)'  : 'rgba(255,255,255,0.45)',
      });
      btn.addEventListener('click', () => {
        if (_showMode === mode) return;
        _showMode = mode;
        toggleWrap.querySelectorAll('[data-mode]').forEach(b => {
          const active = b.dataset.mode === mode;
          b.style.background = active ? 'rgba(255,255,255,0.28)' : 'transparent';
          b.style.color      = active ? 'rgba(255,255,255,0.9)'  : 'rgba(255,255,255,0.45)';
        });
        _refreshCellDisplay(content);
      });
      toggleWrap.appendChild(btn);
    });

    // Export pill
    const exportPill = document.createElement('div');
    exportPill.textContent = 'EXPORT';
    Object.assign(exportPill.style, {
      fontSize:'9px', fontWeight:'600', letterSpacing:'0.06em',
      padding:'3px 9px', borderRadius:'10px', cursor:'pointer',
      background:'rgba(255,255,255,0.12)', color:'rgba(255,255,255,0.55)',
      userSelect:'none', flexShrink:'0',
    });

    let _exportDd = null;

    function _doCSV() {
      const visible = _applyFilter(allNodes);
      const header  = ['Node'];
      for (let p = 1; p <= periods; p++) {
        const dl = _dateLabel(p, timeUnit, startDate);
        header.push(dl ? `P${p} (${dl})` : `P${p}`);
      }
      const rows = visible.map(n => {
        const cols = [n.label || n.id];
        for (let p = 1; p <= periods; p++) {
          const r = values[`${n.id}_${p}`];
          let v = '';
          if (_showMode === 'formulas') {
            const f = r?.formula ?? '';
            v = window.Formula ? window.Formula.toDisplay(f, allNodes) : f;
          } else {
            v = r?.value != null ? String(r.value) : '';
          }
          cols.push(v);
        }
        return cols;
      });
      const csv  = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `${(window.MODEL_DATA?.name || 'model').replace(/[^a-z0-9_\-]/gi,'_')}_values.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    async function _doPDF() {
      function _load(src, check) {
        return new Promise((res, rej) => {
          if (check()) { res(); return; }
          const s = document.createElement('script');
          s.src = src; s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
      }
      await _load('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', () => !!window.html2canvas);
      await _load('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',        () => !!window.jspdf);

      const visible = _applyFilter(allNodes);
      const CELL_H  = 28;
      const NAME_W  = 140;
      const COL_W   = 80;
      const totalW  = NAME_W + COL_W * periods;

      // Tabla limpia para html2canvas (sin inputs)
      const wrap = document.createElement('div');
      Object.assign(wrap.style, {
        position:'fixed', left:'-9999px', top:'0',
        background:'#1e1e24', fontFamily:'inherit',
        width: totalW + 'px', padding:'0',
      });

      // ─── Header ────────────────────────────────────────────────────
      const md       = window.MODEL_DATA || window._currentModel || {};
      const modelName = md.name || '—';
      const version   = md.version ? `v${md.version}` : '';
      const author    = window.MODEL_AUTHOR || '—';
      const lastReview = md.last_review || '—';
      const today     = new Date().toISOString().slice(0,10);

      const header = document.createElement('div');
      Object.assign(header.style, {
        display:'flex', alignItems:'flex-end', justifyContent:'space-between',
        padding:'16px 14px 10px',
        borderBottom:'1px solid rgba(255,255,255,0.12)',
        marginBottom:'4px',
      });

      // Logo + nombre — misma estructura que top UI: [bulb] | [col: idemodel / model name]
      const logoSide = document.createElement('div');
      Object.assign(logoSide.style, { display:'flex', alignItems:'center', gap:'10px' });

      const BULB_SVG = `<svg viewBox="0 0 595.3 841.9" xmlns="http://www.w3.org/2000/svg"
        style="width:22px;height:32px;display:block;flex-shrink:0">
        <path fill="white" d="M298.5,45C171.8,45,68.7,148,68.7,274.7c0,63.6,25.4,122.7,71.6,166.6c4.4,4.1,8.8,8.1,13.3,11.7
          c39.8,37.9,62.1,88.5,63,143l-9.5,6l9.6,12.8v23.3l-11,6.9l11,14.6v21.5l-11,6.9l11,14.6V724l-11,6.9l11,14.6v30.5
          c0,4,1.8,7.8,4.9,10.3l34.1,27.2c2.3,1.8,5.2,2.9,8.2,2.9h68.7c3,0,5.9-1,8.2-2.8l34.5-27.2c2.6-2,4.2-4.9,4.8-8l10.4-8.9
          l-10.1-12.7v-21.6l10.1-8.7l-10.1-12.7v-21.6l10.1-8.7l-10.1-12.7v-20.4l11.5-9.9l-11.5-14.4v-28.1c0-0.2,0.1-0.3,0.1-0.5
          c0.5-56.5,23.9-108.7,65.8-147.1c2.2-2,4.5-4,7-6.1c0.2-0.1,0.3-0.2,0.4-0.4c47.3-43.4,74.4-105.1,74.4-169.2
          C528.1,148,425.1,45,298.5,45z M328.2,790.1h-59.5l-25.6-20.4V753l105.6,20.9L328.2,790.1z M354.1,749.5l-111-22V710l111,22V749.5z
          M354.1,706.5l-111-22V667l111,22V706.5z M354.1,663.6l-111-22v-17.8l111,22V663.6z M354.1,620.3l-49.1-9.8h49.1V620.3z
          M436.1,424.3c-2.6,2.2-5.2,4.5-7.6,6.6c-44.1,40.4-70.1,94.4-73.9,153.2H242.5c-3.8-57.4-28.8-110.5-71.2-150.7
          c-0.2-0.2-0.5-0.5-0.8-0.7c-4-3.2-8.1-6.8-12.1-10.7c-40.9-38.8-63.5-91.2-63.5-147.5c0-112.1,91.2-203.4,203.4-203.4
          s203.4,91.2,203.4,203.4C501.8,331.3,477.9,385.9,436.1,424.3z"/>
        <ellipse fill="white" transform="matrix(0.7071 -0.7071 0.7071 0.7071 -31.4529 338.2574)" cx="392.6" cy="207.1" rx="59.6" ry="59.6"/>
        <path fill="white" d="M386.6,279c-4.8,0-9,2.6-11.3,6.5l-0.1,0c0,0.1-0.1,0.3-0.1,0.4c-0.6,1-1,2.1-1.3,3.2
          c-12.1,29.4-41,50.1-74.7,50.1c-44.6,0-80.8-36.2-80.8-80.8c0-7.3-5.9-13.2-13.2-13.2s-13.2,5.9-13.2,13.2
          c0,59.1,48,107.1,107.1,107.1c45.6,0,84.6-28.7,100-69.1l0,0c0.5-1.3,0.7-2.7,0.7-4.2C399.8,284.9,393.9,279,386.6,279z"/>
      </svg>`;

      const bulbWrap = document.createElement('div');
      bulbWrap.innerHTML = BULB_SVG;

      const textCol = document.createElement('div');
      Object.assign(textCol.style, { display:'flex', flexDirection:'column', gap:'2px' });

      const logoLabel = document.createElement('div');
      logoLabel.textContent = 'idemodel';
      Object.assign(logoLabel.style, {
        fontSize:'11px', fontWeight:'400', color:'rgba(255,255,255,0.4)',
        letterSpacing:'0.04em', lineHeight:'1.2',
      });

      const nameText = document.createElement('div');
      nameText.textContent = `${modelName}${version ? '  ' + version : ''}`;
      Object.assign(nameText.style, {
        fontSize:'15px', fontWeight:'700', color:'rgba(255,255,255,0.92)',
        letterSpacing:'0.01em', lineHeight:'1.2',
      });

      textCol.appendChild(logoLabel);
      textCol.appendChild(nameText);
      logoSide.appendChild(bulbWrap);
      logoSide.appendChild(textCol);

      // Metadata
      const metaSide = document.createElement('div');
      Object.assign(metaSide.style, { textAlign:'right' });
      [
        `Author: ${author}`,
        `Periods: ${periods}  ·  Unit: ${model.time_unit || '—'}`,
        `Last review: ${lastReview}  ·  Exported: ${today}`,
      ].forEach(line => {
        const el = document.createElement('div');
        el.textContent = line;
        Object.assign(el.style, {
          fontSize:'9px', color:'rgba(255,255,255,0.38)',
          lineHeight:'1.6', letterSpacing:'0.02em',
        });
        metaSide.appendChild(el);
      });

      header.appendChild(logoSide);
      header.appendChild(metaSide);
      wrap.appendChild(header);

      function _cell(text, opts = {}) {
        const d = document.createElement('div');
        d.textContent = text;
        Object.assign(d.style, {
          display:'inline-flex', alignItems:'center', justifyContent: opts.left ? 'flex-start' : 'center',
          height: CELL_H + 'px',
          width: (opts.w || COL_W) + 'px',
          padding:'0 6px', boxSizing:'border-box',
          fontSize:'10px', color: opts.color || 'rgba(255,255,255,0.82)',
          fontWeight: opts.bold ? '600' : '400',
          borderBottom:'1px solid rgba(255,255,255,0.06)',
          borderRight:'1px solid rgba(255,255,255,0.04)',
          overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis',
          background: opts.bg || 'transparent',
        });
        return d;
      }

      // Header row
      const headerRow = document.createElement('div');
      headerRow.style.display = 'flex';
      headerRow.appendChild(_cell('Node', { left:true, w:NAME_W, bold:true, color:'rgba(255,255,255,0.6)' }));
      for (let p = 1; p <= periods; p++) {
        const dl = _dateLabel(p, timeUnit, startDate);
        const isActive = p === (window.CURRENT_PERIOD || 1);
        headerRow.appendChild(_cell(dl || `P${p}`, {
          color: isActive ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.5)',
          bold: isActive,
        }));
      }
      wrap.appendChild(headerRow);

      // Data rows
      visible.forEach(n => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.appendChild(_cell(n.label || n.id, { left:true, w:NAME_W, bold:true, bg: n.color || 'rgba(80,80,90,0.6)' }));
        for (let p = 1; p <= periods; p++) {
          const r = values[`${n.id}_${p}`];
          let v = '';
          if (_showMode === 'formulas') {
            const f = r?.formula ?? '';
            v = window.Formula ? window.Formula.toDisplay(f, allNodes) : f;
          } else {
            v = r?.value != null ? String(r.value) : '';
          }
          row.appendChild(_cell(v));
        }
        wrap.appendChild(row);
      });

      document.body.appendChild(wrap);
      await new Promise(r => requestAnimationFrame(r));

      try {
        const canvas = await html2canvas(wrap, { scale:2, backgroundColor:'#1e1e24', useCORS:true });
        const iw = canvas.width / 2, ih = canvas.height / 2;
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: iw > ih ? 'landscape' : 'portrait', unit:'px', format:[iw, ih] });
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, iw, ih);
        pdf.save(`${(window.MODEL_DATA?.name || 'model').replace(/[^a-z0-9_\-]/gi,'_')}_values.pdf`);
      } finally {
        document.body.removeChild(wrap);
      }
    }

    exportPill.addEventListener('click', e => {
      e.stopPropagation();
      if (_exportDd) { _exportDd.remove(); _exportDd = null; return; }
      const dd = document.createElement('div');
      _exportDd = dd;
      Object.assign(dd.style, {
        position:'fixed', background:'rgba(30,30,36,0.97)', backdropFilter:'blur(8px)',
        borderRadius:'10px', padding:'4px 0', zIndex:'99999',
        boxShadow:'0 4px 16px rgba(0,0,0,0.45)', minWidth:'90px',
      });
      [{ label:'CSV', fn: _doCSV }, { label:'PDF', fn: _doPDF }].forEach(({ label, fn }) => {
        const row = document.createElement('div');
        row.textContent = label;
        Object.assign(row.style, { padding:'6px 14px', fontSize:'11px', cursor:'pointer', color:'rgba(255,255,255,0.82)' });
        row.addEventListener('mouseenter', () => row.style.background = 'rgba(255,255,255,0.08)');
        row.addEventListener('mouseleave', () => row.style.background = '');
        row.addEventListener('click', ev => { ev.stopPropagation(); dd.remove(); _exportDd = null; fn(); });
        dd.appendChild(row);
      });
      const pr = exportPill.getBoundingClientRect();
      dd.style.right = (window.innerWidth - pr.right) + 'px';
      dd.style.top   = (pr.bottom + 4) + 'px';
      document.body.appendChild(dd);
      setTimeout(() => {
        function _out(ev) { if (!dd.contains(ev.target) && ev.target !== exportPill) { dd.remove(); _exportDd = null; document.removeEventListener('pointerdown', _out, true); } }
        document.addEventListener('pointerdown', _out, true);
      }, 0);
    });

    titleBar.appendChild(title);
    titleBar.appendChild(toggleWrap);
    titleBar.appendChild(filterChip);
    titleBar.appendChild(exportPill);
    content.appendChild(titleBar);

    // Tabla
    const wrap = document.createElement('div');
    Object.assign(wrap.style, { flex:'1', overflowX:'auto', overflowY:'auto' });
    content.appendChild(wrap);

    const table = document.createElement('table');
    Object.assign(table.style, { borderCollapse:'collapse', width:'max-content' });
    wrap.appendChild(table);

    const STICKY_BG = 'rgba(28,28,34,0.98)';
    const thead = document.createElement('thead');
    const hRow  = document.createElement('tr');
    const thEl  = document.createElement('th');
    thEl.textContent = 'element';
    Object.assign(thEl.style, {
      padding:'5px 10px', textAlign:'left',
      fontSize:'10px', fontWeight:'600', letterSpacing:'0.05em', textTransform:'uppercase',
      color:'rgba(255,255,255,0.45)', borderBottom:'1px solid rgba(255,255,255,0.1)',
      background:STICKY_BG, position:'sticky', left:'0', top:'0', zIndex:'4',
      minWidth:firstW+'px', width:firstW+'px', whiteSpace:'nowrap',
    });
    hRow.appendChild(thEl);

    for (let p = 1; p <= periods; p++) {
      const isActivePeriod = p === (window.CURRENT_PERIOD || 1);
      const th = document.createElement('th');
      th.dataset.period = p;
      const inner = document.createElement('div');
      Object.assign(inner.style, { display:'flex', flexDirection:'column', alignItems:'center', gap:'1px' });
      const num = document.createElement('span');
      num.className   = 'ntv-period-num';
      num.textContent = p;
      Object.assign(num.style, {
        fontSize:'10px', fontWeight:'600',
        color: isActivePeriod ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.7)',
      });
      const lbl = document.createElement('span');
      lbl.className   = 'ntv-period-lbl';
      lbl.textContent = _dateLabel(p, timeUnit, startDate);
      Object.assign(lbl.style, {
        fontSize:'9px',
        color: isActivePeriod ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.35)',
      });
      inner.appendChild(num); inner.appendChild(lbl);
      th.appendChild(inner);
      Object.assign(th.style, {
        padding:'5px 6px', textAlign:'center',
        borderBottom: isActivePeriod
          ? '2px solid rgba(255,255,255,0.5)'
          : '1px solid rgba(255,255,255,0.1)',
        background:STICKY_BG, position:'sticky', top:'0', zIndex:'3',
        minWidth:colW+'px', width:colW+'px', whiteSpace:'nowrap',
      });
      hRow.appendChild(th);
    }
    thead.appendChild(hRow);
    table.appendChild(thead);

    const visibleNodes = _applyFilter(allNodes);
    const tbody = document.createElement('tbody');
    visibleNodes.forEach(n => {
      const isActive = n.id === activeNodeId;
      const tr = document.createElement('tr');
      const tdName = document.createElement('td');
      tdName.textContent = n.label || n.id;
      tdName.title       = n.label || n.id;
      Object.assign(tdName.style, {
        padding:'5px 10px', fontSize:'10px', fontWeight:'500',
        color:'rgba(255,255,255,0.92)',
        minWidth:firstW+'px', width:firstW+'px',
        position:'sticky', left:'0', zIndex:'1',
        borderBottom:'1px solid rgba(255,255,255,0.06)',
        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        background: n.color || 'rgba(80,80,90,0.8)',
        boxShadow: isActive ? 'inset 0 0 0 1.5px rgba(255,255,255,0.4)' : 'none',
      });
      tr.appendChild(tdName);

      for (let p = 1; p <= periods; p++) {
        const key = `${n.id}_${p}`;
        const row = values[key];
        const td  = document.createElement('td');
        Object.assign(td.style, {
          padding:'0', textAlign:'center',
          borderBottom:'1px solid rgba(255,255,255,0.06)',
          minWidth:colW+'px', width:colW+'px', transition:'background 0.1s',
        });
        const input = document.createElement('input');
        input.type = 'text';
        input.dataset.nodeId = n.id;
        input.dataset.period = p;

        function _getDisplay() {
          const r = (window.VALUES_DATA || {})[key];
          if (_showMode === 'formulas') {
            const f = r?.formula ?? '';
            return window.Formula ? window.Formula.toDisplay(f, window.NODES_DATA) : f;
          }
          return r?.value != null ? String(r.value) : '';
        }
        function _getFormula() {
          return (window.VALUES_DATA || {})[key]?.formula ?? '';
        }
        function _applyDisplay() {
          const d = _getDisplay();
          input.value = d;
          input.style.color = d !== '' ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.2)';
        }

        _applyDisplay();
        Object.assign(input.style, {
          width:'100%', height:'100%', background:'transparent',
          border:'none', outline:'none', textAlign:'center',
          fontSize:'11px', fontFamily:'inherit',
          padding:'5px 4px', boxSizing:'border-box', cursor:'pointer',
          pointerEvents: 'none',
        });

        // Celda clickeable → abre formula editor
        td.style.cursor = 'pointer';
        td.addEventListener('click', () => {
          if (!window.openFormulaEditor || !window.Formula) return;
          if (p !== window.CURRENT_PERIOD) {
            window._timeSetPeriod?.(p);
            _updatePeriodHighlights(p);
          }
          td.style.background = 'rgba(255,255,255,0.07)';
          const r = td.getBoundingClientRect();
          window.openFormulaEditor({
            x: r.left + r.width / 2,
            y: r.top,
            nodeId: n.id,
            period: p,
            storedFormula: _getFormula(),
            onSave: async (stored) => {
              td.style.background = '';
              await _saveFormula(n.id, p, stored);
              _applyDisplay();
            },
            onCancel: () => { td.style.background = ''; },
          });
        });
        td.appendChild(input);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
  }

  // ─── Filter logic ─────────────────────────────────────────────────

  function _applyFilter(nodes) {
    const groupsMap = window.NODE_GROUPS_MAP  || {};
    const concMap   = window.NODE_CONCEPTS_MAP || {};
    return nodes.filter(n => {
      if (_filterState.hiddenIds.has(n.id)) return false;
      if (_filterState.parentIds.size > 0 && !_filterState.parentIds.has(n.parent || 'root')) return false;
      if (_filterState.groupIds.size > 0) {
        const ng = (groupsMap[n.id] || []).map(g => g.id);
        if (!ng.some(gid => _filterState.groupIds.has(gid))) return false;
      }
      if (_filterState.conceptIds.size > 0) {
        const nc = concMap[n.id] || new Set();
        if (![..._filterState.conceptIds].some(cid => nc.has(cid))) return false;
      }
      return true;
    }).sort((a, b) => {
      if (_filterState.sort === 'name-asc')  return (a.label||'').localeCompare(b.label||'');
      if (_filterState.sort === 'name-desc') return (b.label||'').localeCompare(a.label||'');
      return 0;
    });
  }

  // ─── Filter panel (compact rows) ──────────────────────────────────

  function _openFilterPanel(chipEl, activeNodeId, allNodes) {
    _closeFilterPanel();

    const groups      = window.GROUPS_DATA    || [];
    const concepts    = window.CONCEPTS_DATA  || [];
    const groupsMap   = window.NODE_GROUPS_MAP  || {};
    const concMap     = window.NODE_CONCEPTS_MAP || {};

    // Unique parents
    const parentMap = new Map();
    allNodes.forEach(n => {
      if (!n.parent) { parentMap.set('root', 'No parent'); }
      else {
        const p = allNodes.find(x => x.id === n.parent);
        parentMap.set(n.parent, p?.label || n.parent);
      }
    });
    const parentEntries = [
      ...( parentMap.has('root') ? [{ id:'root', label:'No parent', color:null }] : [] ),
      ...[...parentMap.entries()].filter(([k]) => k !== 'root').map(([k,v]) => ({
        id: k, label: v, color: allNodes.find(n => n.id === k)?.color || null
      })),
    ];

    const usedConcepts = concepts.filter(c =>
      allNodes.some(n => (concMap[n.id] || new Set()).has(c.id))
    );

    _filterPanel = document.createElement('div');
    _filterPanel.className = 'ntv-fp';
    Object.assign(_filterPanel.style, {
      position:'fixed', zIndex:'999999',
      background:'rgba(30,30,36,0.92)',
      borderRadius:'14px', padding:'8px',
      display:'flex', flexDirection:'column', gap:'2px',
      minWidth:'210px',
    });
    document.body.appendChild(_filterPanel);

    const rerender = () => _renderContent(activeNodeId);

    // ── Sort row ──
    const sortLabels = { default:'Default', 'name-asc':'Name A → Z', 'name-desc':'Name Z → A' };
    _filterPanel.appendChild(_compactRow('Sort', () => sortLabels[_filterState.sort] || 'Default',
      (rowEl, valEl) => _openSubpanel(rowEl, valEl, chipEl,
        [
          { id:'default', label:'Default order', color:null },
          { id:'name-asc', label:'Name A → Z', color:null },
          { id:'name-desc', label:'Name Z → A', color:null },
        ],
        id => _filterState.sort === id,
        id => { _filterState.sort = id; rerender(); },
        () => sortLabels[_filterState.sort],
        true // radio mode
      )
    ));

    const ALL = { id: '_all', label: 'all', color: null };

    // ── Parent row ──
    if (parentEntries.length > 1) {
      const pMap = new Map(parentEntries.map(e => [e.id, e.label]));
      _filterPanel.appendChild(_compactRow('Parent',
        () => _multiLabel(_filterState.parentIds, pMap),
        (rowEl, valEl) => _openSubpanel(rowEl, valEl, chipEl,
          [ALL, ...parentEntries],
          id => id === '_all' ? _filterState.parentIds.size === 0 : _filterState.parentIds.has(id),
          id => {
            if (id === '_all') { _filterState.parentIds.clear(); }
            else { _filterState.parentIds.has(id) ? _filterState.parentIds.delete(id) : _filterState.parentIds.add(id); }
            rerender();
          },
          () => _multiLabel(_filterState.parentIds, pMap)
        )
      ));
    }

    // ── Group row ──
    if (groups.length > 0) {
      const gMap = new Map(groups.map(g => [g.id, g.name]));
      _filterPanel.appendChild(_compactRow('Group',
        () => _multiLabel(_filterState.groupIds, gMap),
        (rowEl, valEl) => _openSubpanel(rowEl, valEl, chipEl,
          [ALL, ...groups.map(g => ({ id:g.id, label:g.name, color:g.color }))],
          id => id === '_all' ? _filterState.groupIds.size === 0 : _filterState.groupIds.has(id),
          id => {
            if (id === '_all') { _filterState.groupIds.clear(); }
            else { _filterState.groupIds.has(id) ? _filterState.groupIds.delete(id) : _filterState.groupIds.add(id); }
            rerender();
          },
          () => _multiLabel(_filterState.groupIds, gMap)
        )
      ));
    }

    // ── Concept row ──
    if (usedConcepts.length > 0) {
      const cMap = new Map(usedConcepts.map(c => [c.id, c.label]));
      _filterPanel.appendChild(_compactRow('Concept',
        () => _multiLabel(_filterState.conceptIds, cMap),
        (rowEl, valEl) => _openSubpanel(rowEl, valEl, chipEl,
          [ALL, ...usedConcepts.map(c => ({ id:c.id, label:c.label, color:c.color || '#888' }))],
          id => id === '_all' ? _filterState.conceptIds.size === 0 : _filterState.conceptIds.has(id),
          id => {
            if (id === '_all') { _filterState.conceptIds.clear(); }
            else { _filterState.conceptIds.has(id) ? _filterState.conceptIds.delete(id) : _filterState.conceptIds.add(id); }
            rerender();
          },
          () => _multiLabel(_filterState.conceptIds, cMap)
        )
      ));
    }

    // ── Elements row ──
    const nMap = new Map(allNodes.map(n => [n.id, n.label || n.id]));
    const visibleIds = () => new Set(allNodes.filter(n => !_filterState.hiddenIds.has(n.id)).map(n => n.id));
    _filterPanel.appendChild(_compactRow('Elements',
      () => _multiLabel(visibleIds(), nMap, allNodes.length),
      (rowEl, valEl) => _openSubpanel(rowEl, valEl, chipEl,
        [ALL, ...allNodes.map(n => ({ id:n.id, label:n.label || n.id, color:n.color || null }))],
        id => id === '_all' ? _filterState.hiddenIds.size === 0 : !_filterState.hiddenIds.has(id),
        id => {
          if (id === '_all') { _filterState.hiddenIds.clear(); }
          else { _filterState.hiddenIds.has(id) ? _filterState.hiddenIds.delete(id) : _filterState.hiddenIds.add(id); }
          rerender();
        },
        () => _multiLabel(visibleIds(), nMap, allNodes.length)
      )
    ));

    // Posición encima del chip
    requestAnimationFrame(() => {
      const cr = chipEl.getBoundingClientRect();
      const pw = _filterPanel.offsetWidth  || 210;
      const ph = _filterPanel.offsetHeight || 150;
      let left = cr.left;
      let top  = cr.top - ph - 8;
      if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
      if (top < 8) top = cr.bottom + 8;
      _filterPanel.style.left = Math.max(8, left) + 'px';
      _filterPanel.style.top  = Math.max(8, top)  + 'px';
    });

    setTimeout(() => document.addEventListener('pointerdown', _outsideFilter), 0);
  }

  // ─── Compact row (label + current value + chevron) ────────────────

  function _compactRow(sectionName, getLabel, onOpen) {
    const row = document.createElement('div');
    Object.assign(row.style, {
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'5px 6px', borderRadius:'8px', cursor:'pointer', gap:'6px',
    });
    row.addEventListener('mouseenter', () => { if (_activeSubRow !== row) row.style.background = 'rgba(255,255,255,0.06)'; });
    row.addEventListener('mouseleave', () => { if (_activeSubRow !== row) row.style.background = ''; });

    const left = document.createElement('span');
    left.textContent = sectionName;
    Object.assign(left.style, {
      fontSize:'9px', fontWeight:'600', letterSpacing:'0.06em', textTransform:'uppercase',
      color:'rgba(255,255,255,0.35)', flexShrink:'0',
    });

    const valEl = document.createElement('span');
    valEl.textContent = getLabel();
    Object.assign(valEl.style, {
      fontSize:'10px', color:'rgba(255,255,255,0.7)',
      overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
      flex:'1', textAlign:'right',
    });

    const arrow = document.createElement('span');
    arrow.textContent = '›';
    Object.assign(arrow.style, {
      fontSize:'13px', color:'rgba(255,255,255,0.25)', flexShrink:'0', lineHeight:'1',
    });

    row.appendChild(left); row.appendChild(valEl); row.appendChild(arrow);

    row.addEventListener('click', (e) => {
      e.stopPropagation();
      if (_activeSubRow === row) { _closeSubpanel(); return; }
      onOpen(row, valEl);
    });

    return row;
  }

  // ─── Subpanel (lista de opciones al costado) ──────────────────────

  function _openSubpanel(rowEl, valEl, chipEl, items, isOn, onToggle, getLabel, radioMode = false) {
    _closeSubpanel();
    _activeSubRow = rowEl;
    rowEl.style.background = 'rgba(255,255,255,0.1)';

    _subPanel = document.createElement('div');
    _subPanel.className = 'ntv-fp';
    Object.assign(_subPanel.style, {
      position:'fixed', zIndex:'9999999',
      background:'rgba(30,30,36,0.92)',
      borderRadius:'14px', padding:'8px',
      display:'flex', flexDirection:'column', gap:'2px',
      maxHeight:'50vh', overflowY:'auto', minWidth:'160px',
    });
    document.body.appendChild(_subPanel);

    const dotRefs = [];

    function _refreshDots() {
      dotRefs.forEach(({ id, color, dot, lbl }) => {
        const on = isOn(id);
        dot.style.background = on ? (color || 'rgba(255,255,255,0.7)') : 'transparent';
        dot.style.border     = on ? 'none' : '1.5px solid rgba(255,255,255,0.35)';
        lbl.style.color      = on ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.4)';
      });
    }

    items.forEach(item => {
      const row = document.createElement('div');
      Object.assign(row.style, {
        display:'flex', alignItems:'center', gap:'7px',
        padding:'4px 6px', borderRadius:'8px', cursor:'pointer',
      });
      row.addEventListener('mouseenter', () => row.style.background = 'rgba(255,255,255,0.06)');
      row.addEventListener('mouseleave', () => row.style.background = '');

      const on  = isOn(item.id);
      const dot = document.createElement('div');
      Object.assign(dot.style, {
        width:'9px', height:'9px', borderRadius:'50%', flexShrink:'0',
        background:  on ? (item.color || 'rgba(255,255,255,0.7)') : 'transparent',
        border:      on ? 'none' : '1.5px solid rgba(255,255,255,0.35)',
        transition:'background 0.12s',
      });

      const lbl = document.createElement('span');
      lbl.textContent = item.label;
      Object.assign(lbl.style, {
        fontSize:'11px',
        color: on ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.4)',
        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'140px',
      });

      dotRefs.push({ id: item.id, color: item.color, dot, lbl });
      row.appendChild(dot); row.appendChild(lbl);
      _subPanel.appendChild(row);

      row.addEventListener('click', (e) => {
        e.stopPropagation();
        onToggle(item.id);
        _refreshDots();
        if (valEl) valEl.textContent = getLabel();
        if (radioMode) _closeSubpanel();
      });
    });

    // Posición: a la derecha del filter panel (o izquierda si no hay espacio)
    requestAnimationFrame(() => {
      const fpR = _filterPanel.getBoundingClientRect();
      const spH = _subPanel.offsetHeight || 200;
      const spW = _subPanel.offsetWidth  || 160;
      let left  = fpR.right + 6;
      if (left + spW > window.innerWidth - 8) left = fpR.left - spW - 6;
      const rR  = rowEl.getBoundingClientRect();
      let top   = rR.top;
      if (top + spH > window.innerHeight - 8) top = window.innerHeight - spH - 8;
      _subPanel.style.left = Math.max(8, left) + 'px';
      _subPanel.style.top  = Math.max(8, top)  + 'px';
    });
  }

  function _closeSubpanel() {
    if (_activeSubRow) { _activeSubRow.style.background = ''; }
    _activeSubRow = null;
    if (_subPanel) { _subPanel.remove(); _subPanel = null; }
  }

  function _outsideFilter(e) {
    const inFp = _filterPanel && _filterPanel.contains(e.target);
    const inSp = _subPanel    && _subPanel.contains(e.target);
    if (!inFp && !inSp) _closeFilterPanel();
  }

  function _closeFilterPanel() {
    _closeSubpanel();
    if (!_filterPanel) return;
    _filterPanel.remove();
    _filterPanel = null;
    document.removeEventListener('pointerdown', _outsideFilter);
  }

  // ─── Label helpers ────────────────────────────────────────────────

  function _multiLabel(selectedIds, nameMap, total) {
    if (selectedIds.size === 0) return total !== undefined ? 'none' : 'all';
    if (total !== undefined && selectedIds.size === total) return 'all';
    const names = [...selectedIds].map(id => nameMap.get(id) || id);
    if (names.length === 1) return names[0];
    if (names.length === 2) return names.join(', ');
    return `${names[0]}, ${names[1]} +${names.length - 2}`;
  }

  // ─── Persistencia ─────────────────────────────────────────────────

  async function _saveFormula(nodeId, period, formulaText) {
    const formula  = (formulaText == null || formulaText === '') ? null : String(formulaText).trim();
    const computed = window.evalFormula?.(formula) ?? null;
    const key      = `${nodeId}_${period}`;
    const existing = (window.VALUES_DATA || {})[key];
    if (existing) {
      existing.formula = formula;
      existing.value   = computed;
      await window.supabaseClient.from('time_values').update({ formula }).eq('id', existing.id);
    } else {
      const { data } = await window.supabaseClient
        .from('time_values')
        .insert({ model_id: window.MODEL_ID, node_id: nodeId, period, formula })
        .select().single();
      if (data) {
        data.value = computed;
        if (!window.VALUES_DATA) window.VALUES_DATA = {};
        window.VALUES_DATA[key] = data;
      }
    }
    if (period === window.CURRENT_PERIOD && typeof window.refreshPeriod === 'function') window.refreshPeriod();
    window.refreshFormulaEdges?.();
  }

  function _refreshCellDisplay(content) {
    content.querySelectorAll('input[data-node-id]').forEach(input => {
      if (document.activeElement === input) return;
      const key = `${input.dataset.nodeId}_${input.dataset.period}`;
      const r = (window.VALUES_DATA || {})[key];
      const rawF = r?.formula ?? '';
      const d = _showMode === 'formulas'
        ? (window.Formula ? window.Formula.toDisplay(rawF, window.NODES_DATA) : rawF)
        : (r?.value != null ? String(r.value) : '');
      input.value = d;
      input.style.color = d !== '' ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.2)';
    });
  }

  // ─── Highlight columna activa (sin re-render) ─────────────────────

  function _updatePeriodHighlights(newPeriod) {
    const content = _panel?.querySelector('.ntv-content');
    if (!content) return;
    content.querySelectorAll('th[data-period]').forEach(th => {
      const isActive = parseInt(th.dataset.period) === newPeriod;
      const num = th.querySelector('.ntv-period-num');
      const lbl = th.querySelector('.ntv-period-lbl');
      if (num) num.style.color = isActive ? 'rgba(255,255,255,1)'   : 'rgba(255,255,255,0.7)';
      if (lbl) lbl.style.color = isActive ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.35)';
      th.style.borderBottom = isActive
        ? '2px solid rgba(255,255,255,0.5)'
        : '1px solid rgba(255,255,255,0.1)';
    });
  }

  // ─── Fechas ───────────────────────────────────────────────────────

  function _dateLabel(period, timeUnit, startDate) {
    if (!startDate || timeUnit === 'moment') return '';
    const [y, m, d] = startDate.split('-').map(Number);
    const base = new Date(y, m - 1, d);
    const n    = period - 1;
    const MO   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    switch (timeUnit) {
      case 'hour':     base.setHours(base.getHours() + n);
                       return `${MO[base.getMonth()]} ${base.getDate()} ${String(base.getHours()).padStart(2,'0')}h`;
      case 'day':      base.setDate(base.getDate() + n);
                       return `${MO[base.getMonth()]} ${base.getDate()}`;
      case 'week':     base.setDate(base.getDate() + n * 7);
                       return `${MO[base.getMonth()]} ${base.getDate()}`;
      case 'month':    base.setMonth(base.getMonth() + n);
                       return `${MO[base.getMonth()]} '${String(base.getFullYear()).slice(2)}`;
      case 'quarter':  base.setMonth(base.getMonth() + n * 3);
                       return `Q${Math.floor(base.getMonth() / 3) + 1} '${String(base.getFullYear()).slice(2)}`;
      case 'semester': base.setMonth(base.getMonth() + n * 6);
                       return `S${base.getMonth() < 6 ? 1 : 2} '${String(base.getFullYear()).slice(2)}`;
      case 'year':     base.setFullYear(base.getFullYear() + n); return String(base.getFullYear());
      default:         return '';
    }
  }

})();
