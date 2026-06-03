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

    titleBar.appendChild(title);
    titleBar.appendChild(toggleWrap);
    titleBar.appendChild(filterChip);
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
          if (_showMode === 'formulas') return r?.formula ?? '';
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
          padding:'5px 4px', boxSizing:'border-box', cursor:'default',
        });

        let _origFormula = _getFormula();
        input.addEventListener('focus', () => {
          input.value = _getFormula();
          input.style.cursor = 'text'; input.style.color = 'rgba(255,255,255,0.9)';
          td.style.background = 'rgba(255,255,255,0.07)';
          if (p !== window.CURRENT_PERIOD) {
            if (typeof window._timeSetPeriod === 'function') window._timeSetPeriod(p);
            _updatePeriodHighlights(p);
          }
        });
        input.addEventListener('blur', async () => {
          td.style.background = ''; input.style.cursor = 'default';
          const newFormula = input.value;
          if (newFormula === _origFormula) { _applyDisplay(); return; }
          _origFormula = newFormula;
          await _saveFormula(n.id, p, newFormula);
          _applyDisplay();
        });
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter')  input.blur();
          if (e.key === 'Escape') { input.value = _origFormula; input.blur(); }
          e.stopPropagation();
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
  }

  function _refreshCellDisplay(content) {
    content.querySelectorAll('input[data-node-id]').forEach(input => {
      if (document.activeElement === input) return;
      const key = `${input.dataset.nodeId}_${input.dataset.period}`;
      const r = (window.VALUES_DATA || {})[key];
      const d = _showMode === 'formulas'
        ? (r?.formula ?? '')
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
