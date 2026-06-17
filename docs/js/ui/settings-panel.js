// =========================
// FLOATING CHIPS SYSTEM
// Settings, Time, Logo
// =========================

(function () {

  const state = {
    settings: { open: false, chips: [], subpanel: null },
    time:     { open: false, chips: [], subpanel: null },
    logo:     { open: false, chips: [], subpanel: null },
  };

  const GAP = 6;
  const GAP_BTN    = 12;  // entre botón y primer chip

  // -------------------------------------------------------
  // POSICIONADOR
  // 'up'        — sube desde el anchor (settings, bottom-left)
  // 'down-left' — baja alineado a la izquierda del anchor (logo)
  // 'down-right'— baja alineado a la derecha del anchor (time)
  // -------------------------------------------------------
  function positionChips(elements, anchor, direction) {
    const rect = anchor.getBoundingClientRect();

    if (direction === 'up') {
      let bottom = window.innerHeight - rect.top + GAP_BTN;
      elements.forEach(el => {
        el.style.position = 'fixed';
        el.style.left     = rect.left + 'px';
        el.style.bottom   = bottom + 'px';
        el.style.zIndex   = 6000;
        document.body.appendChild(el);
        bottom += el.offsetHeight + GAP;
      });

    } else if (direction === 'down-left') {
      let top = rect.bottom + GAP;
      elements.forEach(el => {
        el.style.position = 'fixed';
        el.style.left     = rect.left + 'px';
        el.style.top      = top + 'px';
        el.style.zIndex   = 6000;
        document.body.appendChild(el);
        top += el.offsetHeight + GAP;
      });

    } else if (direction === 'down-right') {
      let top = rect.bottom + GAP_BTN;
      elements.forEach(el => {
        el.style.position = 'fixed';
        el.style.right    = (window.innerWidth - rect.right) + 'px';
        el.style.top      = top + 'px';
        el.style.zIndex   = 6000;
        document.body.appendChild(el);
        top += el.offsetHeight + GAP;
      });
    }
  }

  function destroyChips(key) {
    state[key].chips.forEach(el => el.remove());
    state[key].chips = [];
    closeSubpanel(key);
  }

  // -------------------------------------------------------
  // SUB-PANEL
  // -------------------------------------------------------
  function openSubpanel(key, anchorChip, content, growUp) {
    closeSubpanel(key);
    const panel = document.createElement('div');
    panel.className = 'shape-dropdown sp-subpanel-wrap';
    panel.appendChild(content);
    panel.style.position = 'fixed';
    panel.style.zIndex   = 7000;

    document.body.appendChild(panel);

    const rect      = anchorChip.getBoundingClientRect();
    const panelW    = panel.offsetWidth || 220;
    const margin    = 20;

    // Intentar a la derecha del chip, clamp al margen derecho
    let left = rect.right + 10;
    if (left + panelW > window.innerWidth - margin) {
      left = window.innerWidth - panelW - margin;
    }
    panel.style.left = left + 'px';

    if (growUp) {
      panel.style.bottom = (window.innerHeight - rect.bottom) + 'px';
    } else {
      // Posicionar tras render para tener offsetHeight real
      panel.style.top = rect.top + 'px';
      requestAnimationFrame(() => {
        const panelH = panel.offsetHeight;
        const maxTop = window.innerHeight - panelH - margin;
        const top    = Math.min(rect.top, maxTop);
        panel.style.top = Math.max(margin, top) + 'px';
      });
    }

    state[key].subpanel      = panel;
    state[key].activeChip     = anchorChip;

    // Marcar chip activo y atenuar los demás
    _dimSiblingChips(anchorChip, true, state[key].chips);
  }

  function closeSubpanel(key) {
    if (state[key]?.subpanel) {
      state[key].subpanel.remove();
      state[key].subpanel = null;
    }
    if (state[key]?.activeChip) {
      _dimSiblingChips(state[key].activeChip, false, state[key].chips);
      state[key].activeChip = null;
    }
  }

  // Atenúa todos los chips del panel excepto el activo
  function _dimSiblingChips(activeChip, dim, chips) {
    // Si se pasa lista explícita de chips, usarla; si no, buscar en todos los paneles
    const pool = chips
      ? chips.filter(el => el?.classList?.contains('ui-chip'))
      : Object.values(state).flatMap(s => s.chips || []).filter(el => el?.classList?.contains('ui-chip'));
    pool.forEach(chip => {
      if (chip === activeChip) {
        chip.classList.toggle('sp-chip-active', dim);
      } else {
        chip.classList.toggle('sp-chip-dimmed', dim);
      }
    });
  }

  // Wrapper para uso en chips de logo/time que no pasan por openSubpanel
  function _dimChipsOf(key, activeChip, dim) {
    _dimSiblingChips(activeChip, dim, state[key]?.chips);
  }

  // ¿Hay algún chip activo (panel abierto) en este panel?
  function _anySubpanelOpen(key) {
    const s = state[key];
    if (!s) return false;
    if (s.subpanel) return true;
    // Hay panel abierto si algún chip tiene la clase sp-chip-active
    return (s.chips || []).some(c =>
      c?.classList?.contains('sp-chip-active')
    );
  }

  // -------------------------------------------------------
  // CHIP FACTORIES
  // -------------------------------------------------------

  function makeSectionLabel(text) {
    const el = document.createElement('div');
    el.className = 'sp-section-label';
    el.innerText = text;
    return el;
  }

  function makeReadonlyChip(label, value) {
    const chip = createInlineSelectChip(label, value || '—');
    chip.querySelector('.ui-chip-arrow')?.remove();
    chip.style.cursor = 'default';
    return chip;
  }

  function makeEditableChip(label, value, onSave, numeric) {
    const chip = document.createElement('div');
    chip.className = 'ui-chip';
    const lbl = document.createElement('div');
    lbl.className = 'ui-chip-label';
    lbl.innerText = label;
    const val = document.createElement('div');
    val.className = 'ui-chip-value';
    const span = document.createElement('span');
    span.contentEditable = true;
    span.spellcheck = false;
    span.innerText = value ?? '';
    span.style.outline = 'none';
    span.style.minWidth = '20px';
    let _prev = span.innerText;
    span.addEventListener('focus', () => { _prev = span.innerText.trim(); });
    span.addEventListener('blur', () => {
      const v = span.innerText.trim();
      if (v !== _prev && onSave) onSave(numeric ? (parseInt(v) || null) : v);
    });
    span.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { e.preventDefault(); span.blur(); }
      if (e.key === 'Escape') { span.innerText = _prev; span.blur(); }
    });
    val.appendChild(span);
    chip.appendChild(lbl);
    chip.appendChild(val);
    return chip;
  }

  function makeSubpanelChip(label, onOpen) {
    const chip = document.createElement('div');
    chip.className = 'ui-chip';
    chip.style.cursor = 'pointer';
    const lbl = document.createElement('div');
    lbl.className = 'ui-chip-label';
    lbl.innerText = label;
    const val = document.createElement('div');
    val.className = 'ui-chip-value';
    // Flecha visible
    const arrow = document.createElement('span');
    arrow.className = 'sp-arrow';
    arrow.innerText = '›';
    val.appendChild(arrow);
    chip.appendChild(lbl);
    chip.appendChild(val);
    chip.addEventListener('click', e => {
      e.stopPropagation();
      // Abrir dropdown tipo shape-dropdown, alineado al chip
      onOpen(chip);
    });
    return chip;
  }

  // ON/OFF — círculo lleno / outline
  function makeToggleChip(label, active, onChange) {
    const chip = document.createElement('div');
    chip.className = 'ui-chip';
    chip.style.cursor = 'pointer';
    const lbl = document.createElement('div');
    lbl.className = 'ui-chip-label';
    lbl.innerText = label;
    const val = document.createElement('div');
    val.className = 'ui-chip-value';
    const dot = document.createElement('div');
    dot.className = 'sp-toggle-dot' + (active ? ' sp-toggle-on' : '');
    val.appendChild(dot);
    chip.appendChild(lbl);
    chip.appendChild(val);
    chip.addEventListener('click', () => {
      active = !active;
      dot.className = 'sp-toggle-dot' + (active ? ' sp-toggle-on' : '');
      if (onChange) onChange(active);
    });
    return chip;
  }

  // ACTION CHIP — botón simple sin estado
  function makeActionChip(label, onClick) {
    const chip = document.createElement('div');
    chip.className = 'ui-chip';
    chip.style.cursor = 'pointer';
    const lbl = document.createElement('div');
    lbl.className = 'ui-chip-label';
    lbl.innerText = label;
    chip.appendChild(lbl);
    chip.addEventListener('click', e => { e.stopPropagation(); onClick(); });
    return chip;
  }

  // VIEW LEVEL — texto simple − N +
  function makeViewLevelChip(initial) {
    let level = window.VIEW_LEVEL ?? initial ?? 0;
    const chip = document.createElement('div');
    chip.className = 'ui-chip';
    const lbl = document.createElement('div');
    lbl.className = 'ui-chip-label';
    lbl.innerText = 'View level';
    const val = document.createElement('div');
    val.className = 'ui-chip-value sp-level-val';
    const minus = document.createElement('span');
    minus.className = 'sp-level-btn';
    minus.innerText = '−';
    const num = document.createElement('span');
    num.className = 'sp-level-num';
    num.innerText = level;
    const plus = document.createElement('span');
    plus.className = 'sp-level-btn';
    plus.innerText = '+';
    minus.addEventListener('click', e => {
      e.stopPropagation();
      if (level > 0) {
        level--;
        num.innerText = level;
        window.applyViewLevel?.(level);
      }
    });
    plus.addEventListener('click', e => {
      e.stopPropagation();
      level++;
      window.applyViewLevel?.(level);
      // Sincroniza con el valor real (puede haber sido capado al maxDepth)
      level = window.VIEW_LEVEL ?? level;
      num.innerText = level;
    });
    val.appendChild(minus);
    val.appendChild(num);
    val.appendChild(plus);
    chip.appendChild(lbl);
    chip.appendChild(val);
    return chip;
  }

  // DATE chip — mini calendar con estilo shape-dropdown
  function makeDateChip(label, value, onSave) {
    const chip = document.createElement('div');
    chip.className = 'ui-chip';
    chip.style.cursor = 'pointer';
    const lbl = document.createElement('div');
    lbl.className = 'ui-chip-label';
    lbl.innerText = label;
    const val = document.createElement('div');
    val.className = 'ui-chip-value';
    const span = document.createElement('span');

    // Parsear valor inicial
    let _date = value ? new Date(value + 'T00:00:00') : null;
    span.innerText = _date ? formatDate(_date) : '—';

    val.appendChild(span);
    chip.appendChild(lbl);
    chip.appendChild(val);

    let _cal = null;

    chip.addEventListener('click', e => {
      e.stopPropagation();
      if (_cal) {
        _cal.remove(); _cal = null;
        if (chip._panelKey) _dimChipsOf(chip._panelKey, chip, false);
        return;
      }
      _cal = buildCalendar(_date, (picked) => {
        _date = picked;
        span.innerText = formatDate(_date);
        _cal.remove(); _cal = null;
        if (chip._panelKey) _dimChipsOf(chip._panelKey, chip, false);
        if (onSave) onSave(toISODate(_date));
      });
      if (chip._panelKey && _anySubpanelOpen(chip._panelKey)) return;
      if (chip._panelKey) _dimChipsOf(chip._panelKey, chip, true);
      document.body.appendChild(_cal);
      // Posición inteligente: derecha si hay espacio, izquierda si no
      const r   = chip.getBoundingClientRect();
      const calW = _cal.offsetWidth || 220;
      const margin = 12;
      if (r.right + calW + margin < window.innerWidth) {
        _cal.style.left  = (r.right + 8) + 'px';
        _cal.style.right = 'auto';
      } else {
        _cal.style.right = (window.innerWidth - r.left + 8) + 'px';
        _cal.style.left  = 'auto';
      }
      _cal.style.top = r.top + 'px';

      // Cerrar al click fuera
      setTimeout(() => {
        document.addEventListener('pointerdown', function _close(e) {
          if (!_cal?.contains(e.target) && !chip.contains(e.target)) {
            _cal?.remove(); _cal = null;
            if (chip._panelKey) _dimChipsOf(chip._panelKey, chip, false);
            document.removeEventListener('pointerdown', _close);
          }
        });
      }, 0);
    });

    chip._cal = () => { _cal?.remove(); _cal = null; };
    return chip;
  }

  function formatDate(d) {
    return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
  }

  function toISODate(d) {
    return d.toISOString().slice(0, 10);
  }

  function buildCalendar(selectedDate, onPick) {
    const now   = selectedDate ? new Date(selectedDate) : new Date();
    let year    = now.getFullYear();
    let month   = now.getMonth();

    const cal = document.createElement('div');
    cal.className = 'shape-dropdown sp-calendar';
    cal.style.position = 'fixed';
    cal.style.zIndex   = 7000;

    function render() {
      cal.innerHTML = '';

      // Header: mes/año + flechas
      const header = document.createElement('div');
      header.className = 'sp-cal-header';

      const prev = document.createElement('span');
      prev.className = 'sp-cal-nav';
      prev.innerText = '‹';
      prev.addEventListener('click', e => { e.stopPropagation(); month--; if (month < 0) { month = 11; year--; } render(); });

      const title = document.createElement('span');
      title.className = 'sp-cal-title';
      title.innerText = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      const next = document.createElement('span');
      next.className = 'sp-cal-nav';
      next.innerText = '›';
      next.addEventListener('click', e => { e.stopPropagation(); month++; if (month > 11) { month = 0; year++; } render(); });

      header.appendChild(prev);
      header.appendChild(title);
      header.appendChild(next);
      cal.appendChild(header);

      // Días de semana
      const weekdays = document.createElement('div');
      weekdays.className = 'sp-cal-weekdays';
      ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(d => {
        const el = document.createElement('span');
        el.innerText = d;
        weekdays.appendChild(el);
      });
      cal.appendChild(weekdays);

      // Grid de días
      const grid = document.createElement('div');
      grid.className = 'sp-cal-grid';

      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      // Espacios vacíos antes del día 1
      for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('span');
        grid.appendChild(empty);
      }

      for (let d = 1; d <= daysInMonth; d++) {
        const cell = document.createElement('span');
        cell.className = 'sp-cal-day';
        cell.innerText = d;

        const isSelected = selectedDate
          && selectedDate.getDate()     === d
          && selectedDate.getMonth()    === month
          && selectedDate.getFullYear() === year;

        if (isSelected) cell.classList.add('sp-cal-selected');

        cell.addEventListener('click', e => {
          e.stopPropagation();
          onPick(new Date(year, month, d));
        });

        grid.appendChild(cell);
      }

      cal.appendChild(grid);
    }

    render();
    return cal;
  }

  // COMMENTS — panel flotante con textarea, misma estética que shape-dropdown
  function makeCommentsChip(label, value, onSave) {
    const chip = document.createElement('div');
    chip.className = 'ui-chip';
    chip.style.cursor = 'pointer';
    const lbl = document.createElement('div');
    lbl.className = 'ui-chip-label';
    lbl.innerText = label;
    const val = document.createElement('div');
    val.className = 'ui-chip-value';
    const arrow = document.createElement('span');
    arrow.className = 'sp-arrow';
    arrow.innerText = '›';
    val.appendChild(arrow);
    chip.appendChild(lbl);
    chip.appendChild(val);

    let _panel = null;
    let _current = value || '';

    function openPanel() {
      if (_panel) return;
      _panel = document.createElement('div');
      _panel.className = 'shape-dropdown sp-comments-panel';

      const ta = document.createElement('textarea');
      ta.className = 'sp-comments-textarea';
      ta.value = _current;
      ta.placeholder = 'Add a comment…';
      ta.spellcheck = false;
      _panel.appendChild(ta);

      // Ancho fijo y position fixed antes de insertar
      _panel.style.position = 'fixed';
      _panel.style.zIndex   = '7000';
      _panel.style.width    = '300px';
      document.body.appendChild(_panel);

      // Posición: a la derecha del chip, alineado al top
      const r      = chip.getBoundingClientRect();
      const pw     = 300;
      const ph     = _panel.offsetHeight || 90;
      const margin = 12;


      // Horizontal: derecha si cabe, izquierda si no
      if (r.right + pw + margin < window.innerWidth) {
        _panel.style.left  = (r.right + 8) + 'px';
        _panel.style.right = 'auto';
      } else {
        _panel.style.left  = (r.left - pw - 8) + 'px';
        _panel.style.right = 'auto';
      }
      // Vertical: top del chip, clampeado al margen inferior
      const maxTop = window.innerHeight - ph - margin;
      _panel.style.top = Math.max(margin, Math.min(r.top, maxTop)) + 'px';

      ta.focus();

      ta.addEventListener('blur', () => {
        const v = ta.value.trim();
        if (v !== _current && onSave) onSave(v);
        _current = v;
      });

      // Cerrar al click fuera
      setTimeout(() => {
        document.addEventListener('pointerdown', function _close(e) {
          if (!_panel?.contains(e.target) && !chip.contains(e.target)) {
            const v = _panel?.querySelector('textarea')?.value?.trim() ?? _current;
            if (v !== _current && onSave) onSave(v);
            _current = v;
            _panel?.remove(); _panel = null;
            if (chip._panelKey) _dimChipsOf(chip._panelKey, chip, false);
            document.removeEventListener('pointerdown', _close);
          }
        });
      }, 0);

      chip._commentsPanel = _panel;
    }

    function closePanel() {
      _panel?.remove(); _panel = null;
      chip._commentsPanel = null;
    }

    chip.addEventListener('click', e => {
      e.stopPropagation();
      if (_panel) {
        closePanel();
        if (chip._panelKey) _dimChipsOf(chip._panelKey, chip, false);
      } else {
        if (!_anySubpanelOpen(chip._panelKey)) {
          openPanel();
          if (chip._panelKey) _dimChipsOf(chip._panelKey, chip, true);
        }
      }
    });

    chip._closeComments = closePanel;
    return chip;
  }

  function _applyBgColor(color) {
    document.documentElement.style.setProperty('--bg-graph', color);
    const graph = document.getElementById('graph');
    if (graph) {
      graph.style.backgroundImage    = '';
      graph.style.backgroundSize     = '';
      graph.style.backgroundPosition = '';
      graph.style.backgroundColor    = color;
    }
    const wrapper = document.getElementById('graph-wrapper');
    if (wrapper) wrapper.style.background = color;
    window.updateTopUIContrast?.({ bgColor: color, hasImage: false });
  }

  // INLINE COMMENTS — textarea expandible directamente en el chip
  function makeInlineCommentsChip(label, value, onSave) {
    const chip = document.createElement('div');
    chip.className = 'ui-chip comments-chip-inline';

    const lbl = document.createElement('div');
    lbl.className = 'ui-chip-label';
    lbl.innerText = label;
    lbl.style.cursor = 'pointer';

    const ta = document.createElement('textarea');
    ta.className = 'comments-inline-ta';
    ta.value     = value || '';
    ta.placeholder = '…';
    ta.spellcheck  = false;

    const taWrap = document.createElement('div');
    taWrap.className = 'comments-ta-wrap';
    taWrap.appendChild(ta);

    function collapse() { taWrap.style.display = 'none'; }
    function expand()   { taWrap.style.display = ''; resize(); ta.focus(); }
    function isEmpty()  { return ta.value.trim() === ''; }

    // Canvas reutilizable para medir texto sin tocar el DOM
    function _measureLine(str) {
      const c = _measureLine._c || (_measureLine._c = document.createElement('canvas'));
      const ctx = c.getContext('2d');
      ctx.font = '400 11px Poppins, sans-serif';
      return ctx.measureText(str).width;
    }

    function resizeW() {
      const lines   = ta.value.split('\n');
      const longest = lines.reduce((a, b) => a.length > b.length ? a : b, '');
      const w = Math.max(20, Math.min(108, Math.ceil(_measureLine(longest || ta.placeholder)))) + 20; // +20 = padding-left 12 + right 8
      ta.style.width = w + 'px';
    }

    function resizeH() {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 52) + 'px';
    }

    function resize() { resizeW(); resizeH(); }

    ta.addEventListener('input', resize);
    resizeW(); // ancho funciona sin DOM; alto se difiere
    requestAnimationFrame(resizeH);

    if (isEmpty()) collapse();

    lbl.addEventListener('click', e => { e.stopPropagation(); expand(); });

    let _prev = ta.value;
    ta.addEventListener('focus', () => { _prev = ta.value; });
    ta.addEventListener('blur',  () => {
      const v = ta.value.trim();
      if (v !== _prev && onSave) onSave(v);
      _prev = v;
      if (isEmpty()) collapse();
    });
    ta.addEventListener('keydown', e => {
      if (e.key === 'Escape') { ta.value = _prev; resize(); ta.blur(); }
    });

    // Evitar que el click en la textarea cierre el panel
    ta.addEventListener('pointerdown', e => e.stopPropagation());

    chip.appendChild(lbl);
    chip.appendChild(taWrap);
    return chip;
  }

  // ACTION chip
  function makeActionChip(label, onClick) {
    const chip = document.createElement('div');
    chip.className = 'ui-chip sp-action-chip';
    chip.style.cursor = 'pointer';
    const lbl = document.createElement('div');
    lbl.className = 'ui-chip-label';
    lbl.innerText = label;
    chip.appendChild(lbl);
    chip.addEventListener('click', e => { e.stopPropagation(); if (onClick) onClick(chip); });
    return chip;
  }

  // NEW MODEL
  async function handleNewModel(chip) {
    const userId = window.__USER_ID;
    if (!userId) return;

    const lbl = chip?.querySelector('.ui-chip-label');
    if (lbl) lbl.innerText = 'Creating…';

    try {
      const today = new Date().toISOString().slice(0, 10);

      // 1. Crear modelo con defaults (last_user se omite para evitar FK si el UUID no está aún en users)
      const { data: model, error: modelErr } = await window.supabaseClient
        .from('models')
        .insert({
          name:             'New Model v1',
          background_color: '#ffffff',
          version:          '1',
          periods:          1,
          time_unit:        'moment',
          starting_date:    today,
          last_review:      today,
          workspace:        { zoom: 2, pan: { x: window.innerWidth / 2, y: window.innerHeight / 2 }, expandedEdges: [] }
        })
        .select()
        .single();

      if (modelErr || !model) throw modelErr || new Error('no model returned');

      // 2. Asignar al usuario como owner
      const { error: relErr } = await window.supabaseClient
        .from('model_users')
        .insert({ model_id: model.id, user_id: userId, role: 'owner', viewed: true });

      if (relErr) throw relErr;

      // 3. Units por defecto
      const { error: unitsErr } = await window.supabaseClient
        .from('units')
        .insert(['$', 'un.', 'm²', 'm³', 'kg', 'ton', '%'].map(name => ({
          model_id:  model.id,
          name,
          min_sz:    20,
          max_sz:    120,
          min_value: 0,
          max_value: 1000
        })));

      if (unitsErr) console.warn('[sp] handleNewModel units:', unitsErr);

      // 4. Navegar al nuevo modelo y enfocar nombre
      const url = new URL(window.location.href);
      url.searchParams.set('m', model.id);
      url.searchParams.set('focus', 'name');
      window.location.href = url.toString();

    } catch (err) {
      console.error('[sp] handleNewModel:', err);
      if (lbl) lbl.innerText = 'Error';
    }
  }

  // TIME UNIT — copia ESTRICTA de shape-dropdown
  function makeTimeUnitChip(current, onSave) {
    const options = ['hour','day','week','month','quarter','semester','year','moment'];
    const chip = createInlineSelectChip('Time unit', current || 'select');
    chip.style.cursor = 'pointer';
    chip.dataset.value = current || '';

    // Dropdown — mismo CSS que shape-dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'shape-dropdown hidden';
    dropdown.style.position = 'fixed';
    dropdown.style.zIndex   = 7000;

    options.forEach(opt => {
      const item = document.createElement('div');
      item.className = 'shape-option';
      item.innerText = opt;
      if (opt === current) item.style.fontWeight = '600';
      item.addEventListener('click', e => {
        e.stopPropagation();
        chip.dataset.value = opt;
        chip.querySelector('.ui-chip-value span').innerText = opt;
        dropdown.classList.add('hidden');
        if (onSave) onSave(opt);
      });
      dropdown.appendChild(item);
    });

    document.body.appendChild(dropdown);

    chip.addEventListener('click', e => {
      e.stopPropagation();
      const hidden = dropdown.classList.contains('hidden');
      dropdown.classList.toggle('hidden');
      if (hidden) {
        if (_anySubpanelOpen('time')) return;
        const r    = chip.getBoundingClientRect();
        const ddW  = dropdown.offsetWidth || 160;
        const margin = 12;
        // Izquierda si hay espacio, derecha si no
        if (r.left - ddW - margin > 0) {
          dropdown.style.right = (window.innerWidth - r.left + 8) + 'px';
          dropdown.style.left  = 'auto';
        } else {
          dropdown.style.left  = (r.right + 8) + 'px';
          dropdown.style.right = 'auto';
        }
        dropdown.style.top = r.top + 'px';
        _dimSiblingChips(chip, true, state.time?.chips);
      } else {
        _dimSiblingChips(chip, false, state.time?.chips);
      }
    });

    // Limpiar dropdown al destruir
    chip._dropdown = dropdown;

    return chip;
  }


  // CONCEPTS chip — none / active node / all
  function makeConceptsChip(current, onSave) {
    const options = ['none', 'active', 'all'];
    const cur = current || 'none';
    const chip = createInlineSelectChip('Concepts', cur);
    chip.style.cursor = 'pointer';
    chip.dataset.value = cur;

    const dropdown = document.createElement('div');
    dropdown.className = 'shape-dropdown hidden';
    dropdown.style.position = 'fixed';
    dropdown.style.zIndex   = 7000;

    options.forEach(opt => {
      const item = document.createElement('div');
      item.className = 'shape-option';
      item.innerText = opt;
      if (opt === cur) item.style.fontWeight = '600';
      item.addEventListener('click', e => {
        e.stopPropagation();
        chip.dataset.value = opt;
        chip.querySelector('.ui-chip-value span').innerText = opt;
        dropdown.classList.add('hidden');
        _dimSiblingChips(chip, false, state.settings?.chips);
        if (onSave) onSave(opt);
      });
      dropdown.appendChild(item);
    });

    document.body.appendChild(dropdown);
    chip._dropdown = dropdown;

    chip.addEventListener('click', e => {
      e.stopPropagation();
      const hidden = dropdown.classList.contains('hidden');
      dropdown.classList.toggle('hidden', !hidden);
      if (hidden) {
        const r = chip.getBoundingClientRect();
        dropdown.style.left  = (r.right + 8) + 'px';
        dropdown.style.right = 'auto';
        dropdown.style.top   = r.top + 'px';
        if (_anySubpanelOpen('settings')) { dropdown.classList.add('hidden'); return; }
        _dimSiblingChips(chip, true, state.settings?.chips);
      } else {
        _dimSiblingChips(chip, false, state.settings?.chips);
      }
    });

    return chip;
  }

  // LINKS chip — dropdown con toggles Parent / Concept / Formula
  function makeLinksChip() {
    const chip = document.createElement('div');
    chip.className = 'ui-chip';
    chip.style.cursor = 'pointer';

    const lbl = document.createElement('div');
    lbl.className = 'ui-chip-label';
    lbl.innerText = 'Links';

    const val = document.createElement('div');
    val.className = 'ui-chip-value';
    const arrow = document.createElement('span');
    arrow.className = 'sp-arrow';
    arrow.innerText = '›';
    val.appendChild(arrow);

    chip.appendChild(lbl);
    chip.appendChild(val);

    const dd = document.createElement('div');
    dd.className = 'shape-dropdown hidden';
    dd.style.cssText = 'position:fixed;z-index:7000;min-width:100px;';
    document.body.appendChild(dd);

    const linkItems = [
      { key: 'SHOW_PARENT_LINKS',  label: 'Parent' },
      { key: 'SHOW_CONCEPT_LINKS', label: 'Concept' },
      { key: 'SHOW_FORMULA_LINKS', label: 'Formula' },
    ];

    linkItems.forEach(({ key, label }) => {
      const row = document.createElement('div');
      row.className = 'shape-option';
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;cursor:pointer;';

      const txt = document.createElement('span');
      txt.innerText = label;

      let active = window[key] !== false;
      const dot = document.createElement('div');
      dot.className = 'sp-toggle-dot' + (active ? ' sp-toggle-on' : '');
      dot.style.flexShrink = '0';

      row.appendChild(txt);
      row.appendChild(dot);

      row.addEventListener('click', e => {
        e.stopPropagation();
        active = !active;
        dot.className = 'sp-toggle-dot' + (active ? ' sp-toggle-on' : '');
        window[key] = active;
        window.updateLinkVisibility?.();
      });

      dd.appendChild(row);
    });

    chip._dropdown = dd;

    chip.addEventListener('click', e => {
      e.stopPropagation();
      const hidden = dd.classList.contains('hidden');
      dd.classList.toggle('hidden', !hidden);
      if (hidden) {
        if (_anySubpanelOpen('settings')) { dd.classList.add('hidden'); return; }
        const r = chip.getBoundingClientRect();
        dd.style.left  = (r.right + 8) + 'px';
        dd.style.right = 'auto';
        dd.style.top   = r.top + 'px';
        _dimSiblingChips(chip, true, state.settings?.chips);
      } else {
        _dimSiblingChips(chip, false, state.settings?.chips);
      }
    });

    return chip;
  }

  // -------------------------------------------------------
  // LAYOUT — presets algorítmicos (Grid / Circular tree / Flow / Compare)
  // + customs guardados (snapshot posiciones+filtro+workspace en tabla `layouts`).
  // -------------------------------------------------------
  const LAYOUT_PRESETS = [
    ['Grid', 'grid'], ['Circular tree', 'tree'], ['Flow', 'flow'], ['Compare', 'compare'],
  ];

  // "Set custom" — nombra y persiste la disposición actual como un custom.
  function makeLayoutSetCustomChip() {
    return makeSubpanelChip('Set custom', chip =>
      openSubpanel('settings', chip, buildLayoutSetCustomContent(), false));
  }

  function buildLayoutSetCustomContent() {
    const wrap = document.createElement('div');
    wrap.className = 'sp-units-inner sp-layout-set';

    const body = document.createElement('div');
    body.className = 'sp-bulk-editor';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'sp-bulk-input';
    input.placeholder = 'Layout name';
    input.spellcheck = false;
    body.appendChild(input);

    const row = document.createElement('div');
    row.className = 'sp-bulk-apply-row';
    const btn = document.createElement('div');
    btn.className = 'sp-bulk-action sp-layout-save';
    btn.innerText = 'Save layout';
    row.appendChild(btn);
    body.appendChild(row);

    wrap.appendChild(body);

    const _save = async () => {
      const name = input.value.trim();
      if (!name) { input.focus(); return; }
      btn.innerText = 'saving…';
      const saved = await window.saveLayout?.(name, window.captureLayout?.());
      btn.innerText = saved ? 'saved ✓' : 'error';
      if (saved) setTimeout(() => closeSubpanel('settings'), 700);
      else       setTimeout(() => { btn.innerText = 'Save layout'; }, 1400);
    };

    btn.addEventListener('click', e => { e.stopPropagation(); _save(); });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); _save(); } });
    setTimeout(() => input.focus(), 50);

    return wrap;
  }

  // "Select" — presets + customs (con × para borrar).
  function makeLayoutSelectChip() {
    return makeSubpanelChip('Select', chip =>
      openSubpanel('settings', chip, buildLayoutSelectContent(), false));
  }

  function buildLayoutSelectContent() {
    const wrap = document.createElement('div');
    wrap.className = 'sp-units-inner sp-filter-inner';

    // Presets
    const pLabel = document.createElement('div');
    pLabel.className = 'sp-section-label';
    pLabel.style.cssText = 'pointer-events:none; color:rgba(255,255,255,0.45); opacity:1;';
    pLabel.innerText = 'Presets';
    wrap.appendChild(pLabel);

    LAYOUT_PRESETS.forEach(([label, mode]) => {
      const row = document.createElement('div');
      row.className = 'sp-filter-row';
      const name = document.createElement('span');
      name.className = 'sp-filter-row-name';
      name.innerText = label;
      row.appendChild(name);
      row.addEventListener('click', e => {
        e.stopPropagation();
        closeSubpanel('settings');
        window.rearrangeGraph?.(mode);
      });
      wrap.appendChild(row);
    });

    // Custom
    const cLabel = document.createElement('div');
    cLabel.className = 'sp-section-label';
    cLabel.style.cssText = 'pointer-events:none; margin-top:6px; color:rgba(255,255,255,0.45); opacity:1;';
    cLabel.innerText = 'Custom';
    wrap.appendChild(cLabel);

    const scroll = document.createElement('div');
    scroll.className = 'sp-units-scroll';
    wrap.appendChild(scroll);

    const loading = document.createElement('div');
    loading.className = 'sp-open-loading';
    loading.innerText = 'loading…';
    scroll.appendChild(loading);

    (async () => {
      const layouts = await window.fetchLayouts?.() || [];
      scroll.innerHTML = '';
      if (!layouts.length) {
        const empty = document.createElement('div');
        empty.className = 'sp-open-loading';
        empty.innerText = 'No custom layouts yet';
        scroll.appendChild(empty);
        return;
      }
      layouts.forEach(L => {
        const row = document.createElement('div');
        row.className = 'sp-filter-row';

        const name = document.createElement('span');
        name.className = 'sp-filter-row-name';
        name.innerText = L.name;
        name.title = L.name;

        const del = document.createElement('span');
        del.className = 'sp-open-del';
        del.innerText = '✕';
        del.title = 'Delete layout';

        row.appendChild(name);
        row.appendChild(del);

        row.addEventListener('click', e => {
          e.stopPropagation();
          closeSubpanel('settings');
          window.applyLayout?.(L.data);
        });

        del.addEventListener('click', async e => {
          e.stopPropagation();
          const ok = await window.deleteLayout?.(L.id);
          if (ok) {
            row.style.transition = 'opacity 0.2s';
            row.style.opacity = '0';
            setTimeout(() => {
              row.remove();
              if (!scroll.querySelector('.sp-filter-row')) {
                const empty = document.createElement('div');
                empty.className = 'sp-open-loading';
                empty.innerText = 'No custom layouts yet';
                scroll.appendChild(empty);
              }
            }, 200);
          }
        });

        scroll.appendChild(row);
      });
    })();

    return wrap;
  }

  // -------------------------------------------------------
  // FILTER chip — define los nodos visibles (grupo / unidad / concepto /
  // parentesco / nombre). Panel en dos fases: home (5 items) + lista.
  // -------------------------------------------------------
  const FILTER_FACETS = [
    { key: 'group',   label: 'Groups' },
    { key: 'unit',    label: 'Units' },
    { key: 'concept', label: 'Concepts' },
    { key: 'parent',  label: 'Parentage' },
    { key: 'name',    label: 'Node name' },
  ];

  function _filterState() {
    if (!window.NODE_FILTER) {
      window.NODE_FILTER = {
        group:   { mode: 'all', ids: new Set() },
        unit:    { mode: 'all', ids: new Set() },
        concept: { mode: 'all', ids: new Set() },
        parent:  { mode: 'all', ids: new Set() },
        name:    { mode: 'all', ids: new Set() },
      };
    }
    return window.NODE_FILTER;
  }

  function _filterItems(key) {
    if (key === 'group')
      return (window.GROUPS_DATA || []).map(g => ({ id: g.id, name: g.name || 'Group', color: g.color }));
    if (key === 'unit')
      return (window.UNITS_DATA || []).map(u => ({ id: u.id, name: u.name || 'Unit', color: null }));
    if (key === 'concept')
      return (window.CONCEPTS_DATA || []).map(c => ({ id: c.id, name: c.label || 'Concept', color: c.color || '#888' }));
    // parent / name → nodos
    return (window.NODES_DATA || []).map(n => ({ id: n.id, name: n.label || n.id, color: n.color || null }));
  }

  function makeFilterChip() {
    return makeSubpanelChip('Filter', chip =>
      openSubpanel('settings', chip, buildFilterContent(), false));
  }

  function buildFilterContent() {
    const wrap = document.createElement('div');
    wrap.className = 'sp-units-inner sp-filter-inner';
    renderFilterHome(wrap);
    return wrap;
  }

  function renderFilterHome(wrap) {
    wrap.innerHTML = '';
    const home = document.createElement('div');
    home.className = 'sp-filter-home';

    FILTER_FACETS.forEach(meta => {
      const facet = _filterState()[meta.key];
      const row = document.createElement('div');
      row.className = 'sp-filter-row';

      const name = document.createElement('span');
      name.className = 'sp-filter-row-name';
      name.innerText = meta.label;

      const right = document.createElement('span');
      right.className = 'sp-filter-row-right';

      if (facet.mode !== 'all') {
        const badge = document.createElement('span');
        badge.className = 'sp-filter-count';
        badge.innerText = facet.mode === 'none' ? '0' : String(facet.ids.size);
        right.appendChild(badge);
      }

      const arrow = document.createElement('span');
      arrow.className = 'sp-arrow';
      arrow.innerText = '›';
      right.appendChild(arrow);

      row.appendChild(name);
      row.appendChild(right);
      row.addEventListener('click', e => { e.stopPropagation(); renderFilterList(wrap, meta.key); });
      home.appendChild(row);
    });

    wrap.appendChild(home);
  }

  function renderFilterList(wrap, key) {
    const prevScroll = wrap.querySelector('.sp-units-scroll')?.scrollTop || 0;
    wrap.innerHTML = '';
    const facet = _filterState()[key];
    const meta  = FILTER_FACETS.find(f => f.key === key);

    const header = document.createElement('div');
    header.className = 'sp-filter-list-header';
    const back = document.createElement('span');
    back.className = 'sp-filter-back';
    back.innerText = '‹';
    back.addEventListener('click', e => { e.stopPropagation(); renderFilterHome(wrap); });
    const title = document.createElement('span');
    title.innerText = meta.label;
    header.appendChild(back);
    header.appendChild(title);
    wrap.appendChild(header);

    const scroll = document.createElement('div');
    scroll.className = 'sp-units-scroll';
    wrap.appendChild(scroll);

    const _refresh = () => { window.applyNodeFilter?.(); renderFilterList(wrap, key); };

    // all / none siempre primeros
    scroll.appendChild(_makeFilterMetaRow('all', facet.mode === 'all', () => {
      facet.mode = 'all'; facet.ids = new Set(); _refresh();
    }));
    scroll.appendChild(_makeFilterMetaRow('none', facet.mode === 'none', () => {
      facet.mode = 'none'; facet.ids = new Set(); _refresh();
    }));

    _filterItems(key).forEach(it => {
      const selected = facet.mode === 'some' && facet.ids.has(it.id);
      scroll.appendChild(_makeFilterItemRow(it, selected, () => {
        if (facet.mode !== 'some') { facet.mode = 'some'; facet.ids = new Set(); }
        if (facet.ids.has(it.id)) facet.ids.delete(it.id); else facet.ids.add(it.id);
        _refresh();
      }));
    });

    scroll.scrollTop = prevScroll;

    const footer = document.createElement('div');
    footer.className = 'sp-filter-footer';
    const ok = document.createElement('div');
    ok.className = 'sp-filter-ok';
    ok.innerText = 'ok';
    ok.addEventListener('click', e => { e.stopPropagation(); renderFilterHome(wrap); });
    footer.appendChild(ok);
    wrap.appendChild(footer);
  }

  function _makeFilterMetaRow(label, selected, onClick) {
    const row = document.createElement('div');
    row.className = 'sp-filter-item sp-filter-meta';
    const name = document.createElement('span');
    name.className = 'sp-filter-item-name';
    name.innerText = label;
    const tog = document.createElement('div');
    tog.className = 'sp-toggle-dot' + (selected ? ' sp-toggle-on' : '');
    row.appendChild(name);
    row.appendChild(tog);
    row.addEventListener('click', e => { e.stopPropagation(); onClick(); });
    return row;
  }

  function _makeFilterItemRow(it, selected, onClick) {
    const row = document.createElement('div');
    row.className = 'sp-filter-item';
    const dot = document.createElement('span');
    dot.className = 'sp-filter-color';
    dot.style.background = it.color || 'rgba(255,255,255,0.22)';
    const name = document.createElement('span');
    name.className = 'sp-filter-item-name';
    name.innerText = it.name || '—';
    const tog = document.createElement('div');
    tog.className = 'sp-toggle-dot' + (selected ? ' sp-toggle-on' : '');
    row.appendChild(dot);
    row.appendChild(name);
    row.appendChild(tog);
    row.addEventListener('click', e => { e.stopPropagation(); onClick(); });
    return row;
  }

  // -------------------------------------------------------
  // BULK chip — aplicación masiva. Fase 1: scope por facetas (reusa el picker del
  // Filter, estado propio BULK_SEL, preview por selección en canvas). Fase 2: elegir
  // atributo + valor → window.bulkApplyAttr (write batcheado + undo único).
  // -------------------------------------------------------
  const BULK_ATTRS = [
    { key: 'value',     label: 'Value' },
    { key: 'color',     label: 'Color' },
    { key: 'size',      label: 'Size' },
    { key: 'shape',     label: 'Shape' },
    { key: 'unit',      label: 'Unit' },
    { key: 'group',     label: 'Group' },
    { key: 'parent',    label: 'Parent' },
    { key: 'text_only', label: 'Text only' },
    { key: 'comment',   label: 'Comment' },
    { key: 'hidden',    label: 'Hidden' },
    { key: 'hide_when', label: 'Hide when' },
  ];

  function _bulkState() {
    if (!window.BULK_SEL) {
      window.BULK_SEL = {
        group:   { mode: 'all', ids: new Set() },
        unit:    { mode: 'all', ids: new Set() },
        concept: { mode: 'all', ids: new Set() },
        parent:  { mode: 'all', ids: new Set() },
        name:    { mode: 'all', ids: new Set() },
      };
    }
    return window.BULK_SEL;
  }
  function _bulkIds()      { return window.bulkMatchedIds?.(_bulkState()) || []; }
  function _bulkPreview()  { window.bulkPreview?.(_bulkIds()); }

  function makeBulkChip() {
    return makeSubpanelChip('Bulk', chip =>
      openSubpanel('settings', chip, buildBulkContent(), false));
  }

  function buildBulkContent() {
    const wrap = document.createElement('div');
    wrap.className = 'sp-units-inner sp-filter-inner sp-bulk-inner';
    renderBulkScope(wrap);
    _bulkPreview();
    return wrap;
  }

  // FASE 1 — scope (facetas)
  function renderBulkScope(wrap) {
    wrap.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'sp-filter-list-header';   // mismo header (mayúscula, gris claro) que la fase de atributos
    title.innerText = 'Select';
    wrap.appendChild(title);

    const home = document.createElement('div');
    home.className = 'sp-filter-home';

    FILTER_FACETS.forEach(meta => {
      const facet = _bulkState()[meta.key];
      const row = document.createElement('div');
      row.className = 'sp-filter-row';
      const name = document.createElement('span');
      name.className = 'sp-filter-row-name';
      name.innerText = meta.label;
      const right = document.createElement('span');
      right.className = 'sp-filter-row-right';
      if (facet.mode !== 'all') {
        const badge = document.createElement('span');
        badge.className = 'sp-filter-count';
        badge.innerText = facet.mode === 'none' ? '0' : String(facet.ids.size);
        right.appendChild(badge);
      }
      const arrow = document.createElement('span');
      arrow.className = 'sp-arrow'; arrow.innerText = '›';
      right.appendChild(arrow);
      row.append(name, right);
      row.addEventListener('click', e => { e.stopPropagation(); renderBulkList(wrap, meta.key); });
      home.appendChild(row);
    });
    wrap.appendChild(home);

    const footer = document.createElement('div');
    footer.className = 'sp-bulk-footer';
    const cnt = document.createElement('div');
    cnt.className = 'sp-bulk-count';
    cnt.innerText = `${_bulkIds().length} selected`;
    const next = document.createElement('div');
    next.className = 'sp-bulk-action';
    next.innerText = 'Set attributes';
    next.addEventListener('click', e => { e.stopPropagation(); renderBulkAttrs(wrap); });
    footer.append(cnt, next);
    wrap.appendChild(footer);
  }

  function renderBulkList(wrap, key) {
    const prevScroll = wrap.querySelector('.sp-units-scroll')?.scrollTop || 0;
    wrap.innerHTML = '';
    const facet = _bulkState()[key];
    const meta  = FILTER_FACETS.find(f => f.key === key);

    const header = document.createElement('div');
    header.className = 'sp-filter-list-header';
    const back = document.createElement('span');
    back.className = 'sp-filter-back'; back.innerText = '‹';
    back.addEventListener('click', e => { e.stopPropagation(); renderBulkScope(wrap); });
    const title = document.createElement('span'); title.innerText = meta.label;
    header.append(back, title);
    wrap.appendChild(header);

    const scroll = document.createElement('div');
    scroll.className = 'sp-units-scroll';
    wrap.appendChild(scroll);

    const _refresh = () => { _bulkPreview(); renderBulkList(wrap, key); };
    scroll.appendChild(_makeFilterMetaRow('all',  facet.mode === 'all',  () => { facet.mode = 'all';  facet.ids = new Set(); _refresh(); }));
    scroll.appendChild(_makeFilterMetaRow('none', facet.mode === 'none', () => { facet.mode = 'none'; facet.ids = new Set(); _refresh(); }));
    _filterItems(key).forEach(it => {
      const selected = facet.mode === 'some' && facet.ids.has(it.id);
      scroll.appendChild(_makeFilterItemRow(it, selected, () => {
        if (facet.mode !== 'some') { facet.mode = 'some'; facet.ids = new Set(); }
        if (facet.ids.has(it.id)) facet.ids.delete(it.id); else facet.ids.add(it.id);
        _refresh();
      }));
    });
    scroll.scrollTop = prevScroll;

    const footer = document.createElement('div');
    footer.className = 'sp-filter-footer';
    const ok = document.createElement('div');
    ok.className = 'sp-filter-ok'; ok.innerText = 'ok';
    ok.addEventListener('click', e => { e.stopPropagation(); renderBulkScope(wrap); });
    footer.appendChild(ok);
    wrap.appendChild(footer);
  }

  // FASE 2 — elegir atributo
  function renderBulkAttrs(wrap) {
    wrap.innerHTML = '';
    const header = document.createElement('div');
    header.className = 'sp-filter-list-header';
    const back = document.createElement('span');
    back.className = 'sp-filter-back'; back.innerText = '‹';
    back.addEventListener('click', e => { e.stopPropagation(); renderBulkScope(wrap); });
    const title = document.createElement('span'); title.innerText = `Attribute · ${_bulkIds().length} nodes`;
    header.append(back, title);
    wrap.appendChild(header);

    const scroll = document.createElement('div');
    scroll.className = 'sp-units-scroll';
    BULK_ATTRS.forEach(a => {
      const row = document.createElement('div');
      row.className = 'sp-filter-row';
      const name = document.createElement('span');
      name.className = 'sp-filter-row-name'; name.innerText = a.label;
      const arrow = document.createElement('span');
      arrow.className = 'sp-arrow'; arrow.innerText = '›';
      row.append(name, arrow);
      row.addEventListener('click', e => { e.stopPropagation(); renderBulkAttrEditor(wrap, a); });
      scroll.appendChild(row);
    });
    wrap.appendChild(scroll);
  }

  // FASE 2b — editor del atributo + Apply
  function renderBulkAttrEditor(wrap, attr) {
    wrap.innerHTML = '';
    const header = document.createElement('div');
    header.className = 'sp-filter-list-header';
    const back = document.createElement('span');
    back.className = 'sp-filter-back'; back.innerText = '‹';
    back.addEventListener('click', e => { e.stopPropagation(); renderBulkAttrs(wrap); });
    const title = document.createElement('span'); title.innerText = attr.label;
    header.append(back, title);
    wrap.appendChild(header);

    const body = document.createElement('div');
    body.className = 'sp-bulk-editor';
    wrap.appendChild(body);

    // Cada control devuelve getPayload()→{cols} | null y opcionalmente opts.
    // customApply (si se setea, p.ej. Value) reemplaza el path genérico bulkApplyAttr.
    let getPayload = () => null;
    let opts = {};
    let customApply = null;

    if (attr.key === 'value') {
      let pending    = '';
      let periodMode = 'current';
      const SELF_NODES = () => [...(window.NODES_DATA || []), { id: window.BULK_SELF_ID, label: 'Self' }];
      const info = document.createElement('div');
      info.className = 'sp-bg-swatch-lbl';
      info.innerText = 'no formula';
      const editBtn = document.createElement('div');
      editBtn.className = 'sp-bgimage-btn';
      editBtn.innerText = 'Edit formula';
      editBtn.addEventListener('click', e => {
        e.stopPropagation();
        const firstId = _bulkIds()[0] || null;
        const r = editBtn.getBoundingClientRect();
        window.openFormulaEditor?.({
          x: r.right + 130, y: r.top, nodeId: firstId,
          period: window.CURRENT_PERIOD || 1, storedFormula: pending, mode: 'bulk-value',
          onSave: stored => { pending = stored || ''; info.innerText = pending ? window.Formula.toDisplay(pending, SELF_NODES()) : 'no formula'; },
          onCancel: () => {}
        });
      });
      body.append(info, editBtn);

      // Período: current / all / from now (single-select)
      const PMODES = [['current', 'Current period'], ['all', 'All times'], ['fromnow', 'From now']];
      const pWrap = document.createElement('div');
      pWrap.style.marginTop = '4px';
      PMODES.forEach(([mode, label]) => {
        pWrap.appendChild(_makeFilterMetaRow(label, mode === periodMode, () => {
          periodMode = mode;
          [...pWrap.querySelectorAll('.sp-toggle-dot')].forEach((d, i) => {
            d.className = 'sp-toggle-dot' + (PMODES[i][0] === periodMode ? ' sp-toggle-on' : '');
          });
        }));
      });
      body.appendChild(pWrap);

      customApply = async () => {
        if (!pending) return { error: 'compose a formula' };
        const total = parseInt(window.MODEL_DATA?.periods || 1);
        const cur   = window.CURRENT_PERIOD || 1;
        let periods;
        if (periodMode === 'all')        periods = Array.from({ length: total }, (_, i) => i + 1);
        else if (periodMode === 'fromnow') { periods = []; for (let p = cur; p <= total; p++) periods.push(p); }
        else periods = [cur];
        return await window.bulkApplyFormula(_bulkIds(), periods, pending);
      };

    } else if (attr.key === 'color') {
      let pending = '#8c8c8c';
      let pendingAlpha = 1;
      const row = document.createElement('div'); row.className = 'sp-bg-swatch-row';
      const sw = document.createElement('div'); sw.className = 'sp-bg-swatch'; sw.style.background = pending; sw.style.opacity = pendingAlpha;
      const lbl = document.createElement('div'); lbl.className = 'sp-bg-swatch-lbl'; lbl.innerText = 'Pick color';
      row.append(sw, lbl);
      row.addEventListener('click', e => {
        e.stopPropagation();
        window.openColorPicker({ anchorEl: sw, color: pending, hasAlpha: true, alpha: pendingAlpha,
          onChange: (c, a) => { pending = c; pendingAlpha = (a == null ? 1 : a); sw.style.background = c; sw.style.opacity = pendingAlpha; } });
      });
      body.appendChild(row);
      getPayload = () => ({ color: pending, alpha: pendingAlpha });

    } else if (attr.key === 'size') {
      let mode = 'fixed';
      const inp = document.createElement('input');
      inp.type = 'number'; inp.min = '10'; inp.value = '80';
      inp.className = 'sp-bulk-input';
      inp.addEventListener('pointerdown', e => e.stopPropagation());
      const fixedRow = _makeFilterMetaRow('fixed (px)', true,  () => setMode('fixed'));
      const unitRow  = _makeFilterMetaRow('by unit',    false, () => setMode('by unit'));
      function setMode(m) {
        mode = m;
        fixedRow.querySelector('.sp-toggle-dot').className = 'sp-toggle-dot' + (m === 'fixed'   ? ' sp-toggle-on' : '');
        unitRow.querySelector('.sp-toggle-dot').className  = 'sp-toggle-dot' + (m === 'by unit' ? ' sp-toggle-on' : '');
        inp.style.display = m === 'fixed' ? '' : 'none';
      }
      body.append(fixedRow, unitRow, inp);
      getPayload = () => {
        if (mode === 'by unit') return { size_type: 'by unit' };
        const n = parseFloat(inp.value);
        return (!isNaN(n) && n > 0) ? { size_px: n, size_type: 'fixed' } : null;
      };

    } else if (attr.key === 'shape') {
      let pending = 'ellipse';
      ['ellipse', 'round-rectangle', 'rectangle', 'diamond', 'star'].forEach(s => {
        const r = _makeFilterMetaRow(s, s === pending, () => {
          pending = s;
          body.querySelectorAll('.sp-toggle-dot').forEach((d, i) => {
            d.className = 'sp-toggle-dot' + (['ellipse','round-rectangle','rectangle','diamond','star'][i] === pending ? ' sp-toggle-on' : '');
          });
        });
        body.appendChild(r);
      });
      getPayload = () => ({ shape: pending });

    } else if (attr.key === 'unit') {
      let pending = null;
      const units = window.UNITS_DATA || [];
      if (!units.length) { const e2 = document.createElement('div'); e2.className = 'sp-bg-swatch-lbl'; e2.innerText = 'No units defined'; body.appendChild(e2); }
      units.forEach(u => {
        const r = _makeFilterItemRow({ id: u.id, name: u.name, color: null }, false, () => {
          pending = u.id;
          [...body.querySelectorAll('.sp-filter-item')].forEach(row => {
            const on = row._unitId === u.id;
            row.querySelector('.sp-toggle-dot').className = 'sp-toggle-dot' + (on ? ' sp-toggle-on' : '');
          });
        });
        r._unitId = u.id;
        body.appendChild(r);
      });
      getPayload = () => pending ? { unit_id: pending } : null;

    } else if (attr.key === 'group') {
      let pending = null, gmode = 'add';
      const addRow = _makeFilterMetaRow('add',    true,  () => setGMode('add'));
      const remRow = _makeFilterMetaRow('remove', false, () => setGMode('remove'));
      function setGMode(m) {
        gmode = m;
        addRow.querySelector('.sp-toggle-dot').className = 'sp-toggle-dot' + (m === 'add'    ? ' sp-toggle-on' : '');
        remRow.querySelector('.sp-toggle-dot').className = 'sp-toggle-dot' + (m === 'remove' ? ' sp-toggle-on' : '');
      }
      body.append(addRow, remRow);
      const scroll = document.createElement('div'); scroll.className = 'sp-units-scroll';
      body.appendChild(scroll);

      const GPAL = ['#6b7cc4', '#c46b7c', '#7cc46b', '#c4a46b', '#6bc4c1', '#a46bc4', '#c4756b'];
      function selectGroupId(id) {
        pending = id;
        [...scroll.querySelectorAll('.sp-filter-item')].forEach(row => {
          row.querySelector('.sp-toggle-dot').className = 'sp-toggle-dot' + (row._gId === id ? ' sp-toggle-on' : '');
        });
      }
      // Fila editable (mismo lenguaje que el chip de relations): swatch con color picker
      // + nombre contenteditable, ambos persistiendo a `groups`. El resto de la fila selecciona.
      function addGroupRow(g) {
        const row = document.createElement('div');
        row.className = 'sp-filter-item';
        row._gId = g.id;

        const dot = document.createElement('span');
        dot.className = 'sp-filter-color';
        dot.style.background = g.color || 'rgba(255,255,255,0.22)';
        dot.style.cursor = 'pointer';
        dot.addEventListener('click', ev => {
          ev.stopPropagation();
          window.openColorPicker({ anchorEl: dot, color: g.color || '#888', hasAlpha: false,
            onChange: async (newColor) => {
              g.color = newColor; dot.style.background = newColor;
              const idx = (window.GROUPS_DATA || []).findIndex(x => x.id === g.id);
              if (idx >= 0) window.GROUPS_DATA[idx].color = newColor;
              await window.supabaseClient.from('groups').update({ color: newColor }).eq('id', g.id);
            } });
        });

        const name = document.createElement('span');
        name.className = 'sp-filter-item-name';
        name.contentEditable = true; name.spellcheck = false;
        name.innerText = g.name || 'Group';
        name.style.cursor = 'text';
        name.addEventListener('click',       e => e.stopPropagation());
        name.addEventListener('pointerdown', e => e.stopPropagation());
        name.addEventListener('keydown',     e => { if (e.key === 'Enter') { e.preventDefault(); name.blur(); } e.stopPropagation(); });
        name.addEventListener('blur', async () => {
          const t = name.innerText.trim();
          if (t && t !== g.name) {
            g.name = t;
            const idx = (window.GROUPS_DATA || []).findIndex(x => x.id === g.id);
            if (idx >= 0) window.GROUPS_DATA[idx].name = t;
            await window.supabaseClient.from('groups').update({ name: t }).eq('id', g.id);
          } else if (!t) { name.innerText = g.name || 'Group'; }
        });

        const tog = document.createElement('div');
        tog.className = 'sp-toggle-dot' + (pending === g.id ? ' sp-toggle-on' : '');

        // × borra el grupo del SISTEMA (no solo del set)
        const del = document.createElement('span');
        del.innerText = '×';
        del.style.cssText = 'margin-left:6px;font-size:11px;color:rgba(255,255,255,0.55);cursor:pointer;flex-shrink:0;padding:0 2px;';
        del.addEventListener('click', async ev => {
          ev.stopPropagation();
          if (await window.deleteGroup(g.id)) { if (pending === g.id) pending = null; row.remove(); }
        });

        row.append(dot, name, tog, del);
        row.addEventListener('click', e => { e.stopPropagation(); selectGroupId(g.id); });
        scroll.appendChild(row);
      }
      (window.GROUPS_DATA || []).forEach(addGroupRow);

      // + New group (mismo flujo que el picker de relations): inserta en `groups` + GROUPS_DATA.
      const newRow = document.createElement('div');
      newRow.className = 'shape-option';
      newRow.innerText = '+ New group';
      newRow.addEventListener('click', async e => {
        e.stopPropagation();
        if (window.USER_ROLE === 'reader') return;
        const n = (window.GROUPS_DATA || []).length;
        const g = { id: crypto.randomUUID(), name: 'Group', color: GPAL[n % GPAL.length] };
        const { error } = await window.supabaseClient.from('groups')
          .insert({ id: g.id, model_id: window.MODEL_ID, name: g.name, color: g.color });
        if (error) { console.error('bulk new group:', error); return; }
        if (!Array.isArray(window.GROUPS_DATA)) window.GROUPS_DATA = [];
        window.GROUPS_DATA.push(g);
        addGroupRow(g);
        selectGroupId(g.id);
        // Enfocar el nombre recién creado y seleccionarlo para tipear de una
        const nameEl = scroll.lastChild?.querySelector('.sp-filter-item-name');
        if (nameEl) {
          nameEl.focus();
          const range = document.createRange(); range.selectNodeContents(nameEl);
          const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
        }
      });
      body.appendChild(newRow);

      customApply = async () => { if (!pending) return { error: 'pick a group' }; return await window.bulkApplyGroup(_bulkIds(), pending, gmode === 'add'); };

    } else if (attr.key === 'parent') {
      let pending = undefined;   // undefined = sin elegir; 'NONE' = limpiar; <id> = padre
      const scroll = document.createElement('div'); scroll.className = 'sp-units-scroll';
      const noneRow = _makeFilterMetaRow('clear (no parent)', false, () => selectP('NONE'));
      scroll.appendChild(noneRow);
      (window.NODES_DATA || []).forEach(n => {
        const r = _makeFilterItemRow({ id: n.id, name: n.label, color: n.color }, false, () => selectP(n.id));
        r._pId = n.id;
        scroll.appendChild(r);
      });
      function selectP(v) {
        pending = v;
        noneRow.querySelector('.sp-toggle-dot').className = 'sp-toggle-dot' + (v === 'NONE' ? ' sp-toggle-on' : '');
        [...scroll.querySelectorAll('.sp-filter-item')].forEach(row => {
          if (row._pId === undefined) return;
          row.querySelector('.sp-toggle-dot').className = 'sp-toggle-dot' + (row._pId === v ? ' sp-toggle-on' : '');
        });
      }
      body.appendChild(scroll);
      customApply = async () => {
        if (pending === undefined) return { error: 'pick a parent' };
        const res = await window.bulkApplyParent(_bulkIds(), pending === 'NONE' ? null : pending);
        if (res?.error) return res;
        return { ok: true };
      };

    } else if (attr.key === 'comment') {
      let cmode = 'replace';
      const replaceRow = _makeFilterMetaRow('replace', true,  () => setCMode('replace'));
      const appendRow  = _makeFilterMetaRow('append',  false, () => setCMode('append'));
      function setCMode(m) {
        cmode = m;
        replaceRow.querySelector('.sp-toggle-dot').className = 'sp-toggle-dot' + (m === 'replace' ? ' sp-toggle-on' : '');
        appendRow.querySelector('.sp-toggle-dot').className  = 'sp-toggle-dot' + (m === 'append'  ? ' sp-toggle-on' : '');
      }
      const ta = document.createElement('textarea');
      ta.className = 'sp-bulk-input'; ta.rows = 3; ta.placeholder = 'Comment…';
      ta.addEventListener('pointerdown', e => e.stopPropagation());
      ta.addEventListener('keydown', e => e.stopPropagation());
      body.append(replaceRow, appendRow, ta);
      customApply = async () => {
        if (cmode === 'append') return await window.bulkAppendComment(_bulkIds(), ta.value);
        await window.bulkApplyAttr(_bulkIds(), { comment: ta.value }, {});   // replace (permite vaciar)
        return { ok: true };
      };

    } else if (attr.key === 'text_only' || attr.key === 'hidden') {
      let pending = true;
      const r = _makeFilterMetaRow(attr.key === 'hidden' ? 'hidden on' : 'text only on', pending, () => {
        pending = !pending;
        r.querySelector('.sp-toggle-dot').className = 'sp-toggle-dot' + (pending ? ' sp-toggle-on' : '');
      });
      body.appendChild(r);
      if (attr.key === 'hidden') opts = { recomputeHide: true };
      getPayload = () => (attr.key === 'hidden' ? { hidden: pending } : { text_only: pending });

    } else if (attr.key === 'hide_when') {
      let pending = '';
      const info = document.createElement('div');
      info.className = 'sp-bg-swatch-lbl';
      info.innerText = 'no condition';
      const editBtn = document.createElement('div');
      editBtn.className = 'sp-bgimage-btn';
      editBtn.innerText = 'Edit condition';
      editBtn.addEventListener('click', e => {
        e.stopPropagation();
        const firstId = _bulkIds()[0] || null;
        const r = editBtn.getBoundingClientRect();
        window.openFormulaEditor?.({
          x: r.right + 130, y: r.top, nodeId: firstId,
          period: window.CURRENT_PERIOD || 1, storedFormula: pending, mode: 'condition',
          onSave: stored => { pending = stored || ''; info.innerText = pending ? window.Formula.toDisplay(pending, window.NODES_DATA || []) : 'no condition'; },
          onCancel: () => {}
        });
      });
      body.append(info, editBtn);
      opts = { recomputeHide: true };
      getPayload = () => ({ hide_when: pending });
    }

    const footer = document.createElement('div');
    footer.className = 'sp-bulk-apply-row';
    const apply = document.createElement('div');
    apply.className = 'sp-filter-ok sp-bulk-apply';
    const ids = _bulkIds();
    apply.innerText = `Apply to ${ids.length}`;
    apply.addEventListener('click', async e => {
      e.stopPropagation();
      if (customApply) {
        apply.innerText = 'applying…';
        const res = await customApply();
        if (res?.error) { apply.innerText = res.error; setTimeout(() => apply.innerText = `Apply to ${ids.length}`, 1800); return; }
        apply.innerText = 'applied ✓';
        setTimeout(() => apply.innerText = `Apply to ${ids.length}`, 1400);
        return;
      }
      const payload = getPayload();
      if (!payload) { apply.innerText = 'pick a value'; setTimeout(() => apply.innerText = `Apply to ${ids.length}`, 1400); return; }
      apply.innerText = 'applying…';
      await window.bulkApplyAttr(ids, payload, opts);
      apply.innerText = 'applied ✓';
      setTimeout(() => apply.innerText = `Apply to ${ids.length}`, 1400);
    });
    footer.appendChild(apply);
    wrap.appendChild(footer);
  }

  // -------------------------------------------------------
  // ⚙ SETTINGS
  // -------------------------------------------------------
  function buildSettingsChips() {
    // El panel apila hacia ARRIBA: el primer item del array queda abajo (cerca del
    // engranaje) y el último arriba. El section-label va DESPUÉS de su grupo para
    // quedar encima. Orden visual (arriba→abajo): MODEL · VIEW · NAVIGATE.
    return [
      // NAVIGATE — cámara y profundidad (abajo de todo)
      makeActionChip('Zoom all', () => window.zoomAll?.()),
      makeViewLevelChip(0),
      makeActionChip('Center',   () => window.centerActiveNode?.()),
      makeSectionLabel('Navigate'),

      // LAYOUT — presets algorítmicos + customs guardados (encima de Navigate)
      makeLayoutSelectChip(),
      makeLayoutSetCustomChip(),
      makeSectionLabel('Layout'),

      // VIEW — qué se muestra
      makeToggleChip('Show hidden', false, v => {
        window.SHOW_HIDDEN = v;
        if (typeof window.updateHiddenVisibility === 'function') window.updateHiddenVisibility();
      }),
      makeLinksChip(),
      makeFilterChip(),
      makeConceptsChip(window.CONCEPTS_MODE || 'none', v => {
        window.CONCEPTS_MODE = v;
        if (typeof window.applyConceptsMode === 'function') window.applyConceptsMode(v);
        if (typeof window.saveWorkspace === 'function') window.saveWorkspace();
      }),
      makeSectionLabel('View'),

      // MODEL — configuración a nivel modelo (arriba)
      makeBulkChip(),
      makeSubpanelChip('Background', chip => openSubpanel('settings', chip, buildBackgroundContent())),
      (() => { const c = makeSubpanelChip('Units', chip => openSubpanel('settings', chip, buildUnitsContent(), false)); c._isUnitsChip = true; return c; })(),
      makeSectionLabel('Model'),
    ];
  }

  window.openSettingsPanel = function () {
    if (state.settings.open) return;
    state.settings.open = true;
    const btn = document.getElementById('settings-btn');
    const els = buildSettingsChips();
    positionChips(els, btn, 'up');
    state.settings.chips = els;
  };

  window.closeSettingsPanel = function () {
    // Limpiar dropdowns de time unit si existen
    state.settings.chips.forEach(el => {
      if (el._dropdown) el._dropdown.remove();
    });
    state.settings.open = false;
    destroyChips('settings');
  };

  // -------------------------------------------------------
  // ⏱ TIME — slider, flechas, período activo
  // -------------------------------------------------------

  function _updateTimeLabel(unit) {
    const el = document.getElementById('time-label');
    if (el) el.innerText = (unit || 'time').toLowerCase();
  }

  function _periodDateLabel(p) {
    const model     = window.MODEL_DATA   || {};
    const timeUnit  = model.time_unit     || 'moment';
    const startDate = model.starting_date || null;
    if (!startDate || timeUnit === 'moment') return null;
    const [y, m, d] = startDate.split('-').map(Number);
    const base = new Date(y, m - 1, d);
    const n    = p - 1;
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
      case 'year':     base.setFullYear(base.getFullYear() + n);
                       return String(base.getFullYear());
      default:         return null;
    }
  }

  function _applyTimeLabelForPeriod(p) {
    const el = document.getElementById('time-label');
    if (!el) return;
    const dateLabel = _periodDateLabel(p);
    el.innerText = dateLabel || (window.MODEL_DATA?.time_unit || 'time').toLowerCase();
  }

  function _setActivePeriod(p) {
    const periods = parseInt(window.MODEL_DATA?.periods || 1);
    p = Math.max(1, Math.min(periods, p));
    window.CURRENT_PERIOD = p;
    const slider  = document.getElementById('time-slider');
    const valueEl = document.getElementById('time-value');
    if (slider)  slider.value     = p;
    if (valueEl) valueEl.innerText = p;
    _applyTimeLabelForPeriod(p);
    if (typeof window.refreshPeriod === 'function') window.refreshPeriod();
  }

  // Expuesto para que el timeline panel pueda cambiar el período activo
  window._timeSetPeriod = _setActivePeriod;

  window.initTimeControls = function() {
    const periods = parseInt(window.MODEL_DATA?.periods || 1);
    const p       = window.CURRENT_PERIOD || 1;
    const slider  = document.getElementById('time-slider');
    const badge   = document.getElementById('time-badge');
    const valueEl = document.getElementById('time-value');
    if (slider)  { slider.min = 1; slider.max = periods; slider.value = p; }
    if (badge)   badge.innerText  = periods;
    if (valueEl) valueEl.innerText = p;
    _applyTimeLabelForPeriod(p);
  };

  function buildTimeChips() {
    const model = window.MODEL_DATA || {};
    return [
      (() => { const c = makeDateChip('Starting date', model.starting_date || '', v => saveModelField('starting_date', v)); c._panelKey = 'time'; return c; })(),
      makeTimeUnitChip(model.time_unit || '', v => { saveModelField('time_unit', v); _updateTimeLabel(v); }),
      makeEditableChip('Periods', model.periods ?? '', v => {
        const p = parseInt(v) || null;
        saveModelField('periods', p);
        if (p) {
          const slider = document.getElementById('time-slider');
          const badge  = document.getElementById('time-badge');
          if (slider) { slider.max = p; if ((window.CURRENT_PERIOD || 1) > p) _setActivePeriod(p); }
          if (badge)  badge.innerText = p;
        }
      }, true),
    ];
  }

  window.openTimePanel = function () {
    if (state.time.open) return;
    state.time.open = true;
    const btn = document.getElementById('time-circle');
    const els = buildTimeChips();
    positionChips(els, btn, 'down-right');
    state.time.chips = els;
  };

  window.closeTimePanel = function () {
    state.time.chips.forEach(el => {
      if (el._dropdown) el._dropdown.remove();
      if (el._cal) el._cal();
    });
    state.time.open = false;
    destroyChips('time');
  };

  // -------------------------------------------------------
  // 💡 LOGO — versioning helpers
  // -------------------------------------------------------

  function _nextVersion(vStr) {
    const n = Math.floor(parseFloat(vStr) || 1);
    return `${n + 1}`;
  }

  function _stripVersion(name) {
    return (name || '').replace(/\s+v\d+(\.\d+)?$/i, '').trim();
  }

  function makeVersionChip(value, onSave) {
    const chip = makeEditableChip('Version', value, onSave);

    const val  = chip.querySelector('.ui-chip-value');
    const span = val?.querySelector('span');
    if (val)  { val.style.flex = '1'; val.style.maxWidth = 'none'; }
    if (span) { span.style.flex = '1'; span.style.textAlign = 'center'; }

    const pill = document.createElement('div');
    pill.className = 'sp-new-version-pill';
    pill.innerText = 'new';
    pill.addEventListener('click', async e => {
      e.stopPropagation();
      await handleNewVersion(pill);
    });

    val?.appendChild(pill);
    return chip;
  }

  async function handleNewVersion(pill) {
    const modelId = window.MODEL_ID;
    const userId  = window.__USER_ID;
    if (!modelId || !userId) return;

    pill.innerText = 'Copying…';

    try {
      const model      = window._currentModel || {};
      const newVersion = _nextVersion(model.version || '1.0');
      const newName    = `${_stripVersion(model.name || 'Model')} v${newVersion}`;
      const today      = new Date().toISOString().slice(0, 10);

      // 1. Nuevo modelo
      const { data: newModel, error: modelErr } = await window.supabaseClient
        .from('models')
        .insert({
          name:                 newName,
          background_color:     model.background_color,
          background_image_url: model.background_image_url,
          version:              newVersion,
          periods:              model.periods,
          time_unit:            model.time_unit,
          starting_date:        model.starting_date,
          comments:             model.comments,
          last_review:          today,
          last_user:            userId
        })
        .select().single();
      if (modelErr || !newModel) throw modelErr || new Error('no model');

      // 2. model_users
      const { error: relErr } = await window.supabaseClient
        .from('model_users')
        .insert({ model_id: newModel.id, user_id: userId, role: 'owner', viewed: true });
      if (relErr) throw relErr;

      // 3. Copiar units → mapa id viejo → id nuevo
      const { data: units } = await window.supabaseClient
        .from('units').select('*').eq('model_id', modelId);
      const unitIdMap = {};
      if (units?.length) {
        const newUnits = units.map(u => {
          const nid = crypto.randomUUID();
          unitIdMap[u.id] = nid;
          return { ...u, id: nid, model_id: newModel.id };
        });
        const { error } = await window.supabaseClient.from('units').insert(newUnits);
        if (error) throw error;
      }

      // 4. Copiar nodes → mapa id viejo → id nuevo.
      //    Los edges son DERIVADOS: el parent edge sale de nodes.parent → hay que
      //    REMAPEAR parent al id nuevo (si no, apunta al modelo viejo y no se dibuja).
      const { data: nodes } = await window.supabaseClient
        .from('nodes').select('*').eq('model_id', modelId);
      const nodeIdMap = {};
      if (nodes?.length) {
        nodes.forEach(n => { nodeIdMap[n.id] = crypto.randomUUID(); });   // 1ª pasada: todos los ids
        const newNodes = nodes.map(n => ({
          ...n,
          id:      nodeIdMap[n.id],
          model_id: newModel.id,
          unit_id: n.unit_id ? (unitIdMap[n.unit_id] ?? null) : null,
          parent:  n.parent  ? (nodeIdMap[n.parent] ?? null) : null,
        }));
        const { error } = await window.supabaseClient.from('nodes').insert(newNodes);
        if (error) throw error;
      }

      // Reescribe refs de fórmula `node:<uuid>` al id nuevo (formula edges derivan de esto).
      const _rewriteFormula = (formula) => formula
        ? formula.replace(/node:([0-9a-fA-F-]{36})/g, (m, id) => nodeIdMap[id] ? `node:${nodeIdMap[id]}` : m)
        : formula;

      // 5. Copiar time_values (con las refs de fórmula reescritas)
      const { data: values } = await window.supabaseClient
        .from('time_values').select('*').eq('model_id', modelId);
      if (values?.length) {
        const newValues = values
          .filter(v => nodeIdMap[v.node_id])
          .map(v => ({ ...v, id: crypto.randomUUID(),
                       model_id: newModel.id, node_id: nodeIdMap[v.node_id],
                       formula: _rewriteFormula(v.formula) }));
        if (newValues.length) {
          const { error } = await window.supabaseClient.from('time_values').insert(newValues);
          if (error) throw error;
        }
      }

      // 6. Copiar links (columnas reales: source_id / target_id) → manual/concept edges.
      const { data: links } = await window.supabaseClient
        .from('links').select('*').eq('model_id', modelId);
      const linkIdMap = {};
      if (links?.length) {
        const newLinks = links
          .filter(l => nodeIdMap[l.source_id] && nodeIdMap[l.target_id])
          .map(l => {
            const nid = crypto.randomUUID();
            linkIdMap[l.id] = nid;
            return { ...l, id: nid, model_id: newModel.id,
                     source_id: nodeIdMap[l.source_id],
                     target_id: nodeIdMap[l.target_id] };
          });
        if (newLinks.length) {
          const { error } = await window.supabaseClient.from('links').insert(newLinks);
          if (error) throw error;
        }
      }

      const oldNodeIds = (nodes || []).map(n => n.id);
      const oldLinkIds = Object.keys(linkIdMap);

      // 6b. Copiar groups → mapa id viejo → nuevo
      const { data: groups } = await window.supabaseClient
        .from('groups').select('*').eq('model_id', modelId);
      const groupIdMap = {};
      if (groups?.length) {
        const newGroups = groups.map(g => { const nid = crypto.randomUUID(); groupIdMap[g.id] = nid; return { ...g, id: nid, model_id: newModel.id }; });
        const { error } = await window.supabaseClient.from('groups').insert(newGroups);
        if (error) throw error;
      }

      // 6c. Copiar concepts → mapa id viejo → nuevo
      const { data: concepts } = await window.supabaseClient
        .from('concepts').select('*').eq('model_id', modelId);
      const conceptIdMap = {};
      if (concepts?.length) {
        const newConcepts = concepts.map(c => { const nid = crypto.randomUUID(); conceptIdMap[c.id] = nid; return { ...c, id: nid, model_id: newModel.id }; });
        const { error } = await window.supabaseClient.from('concepts').insert(newConcepts);
        if (error) throw error;
      }

      // 6d. node_groups (membresías) — sin model_id, remapeo node_id + group_id
      if (oldNodeIds.length) {
        const { data: ng } = await window.supabaseClient
          .from('node_groups').select('node_id, group_id').in('node_id', oldNodeIds);
        const newNg = (ng || [])
          .filter(r => nodeIdMap[r.node_id] && groupIdMap[r.group_id])
          .map(r => ({ node_id: nodeIdMap[r.node_id], group_id: groupIdMap[r.group_id] }));
        if (newNg.length) { const { error } = await window.supabaseClient.from('node_groups').insert(newNg); if (error) throw error; }
      }

      // 6e. link_concepts (concepts de cada manual edge) — remapeo link_id + concept_id
      if (oldLinkIds.length) {
        const { data: lc } = await window.supabaseClient
          .from('link_concepts').select('link_id, concept_id').in('link_id', oldLinkIds);
        const newLc = (lc || [])
          .filter(r => linkIdMap[r.link_id] && conceptIdMap[r.concept_id])
          .map(r => ({ link_id: linkIdMap[r.link_id], concept_id: conceptIdMap[r.concept_id] }));
        if (newLc.length) { const { error } = await window.supabaseClient.from('link_concepts').insert(newLc); if (error) throw error; }
      }

      // 6f. node_parent_concepts (concepts del vínculo parent) — remapeo node_id + concept_id
      if (oldNodeIds.length) {
        const { data: npc } = await window.supabaseClient
          .from('node_parent_concepts').select('node_id, concept_id').in('node_id', oldNodeIds);
        const newNpc = (npc || [])
          .filter(r => nodeIdMap[r.node_id] && conceptIdMap[r.concept_id])
          .map(r => ({ node_id: nodeIdMap[r.node_id], concept_id: conceptIdMap[r.concept_id] }));
        if (newNpc.length) { const { error } = await window.supabaseClient.from('node_parent_concepts').insert(newNpc); if (error) throw error; }
      }

      // 7. Navegar al nuevo modelo
      const url = new URL(window.location.href);
      url.searchParams.set('m', newModel.id);
      url.searchParams.delete('focus');
      window.location.href = url.toString();

    } catch (err) {
      console.error('[sp] handleNewVersion:', err);
      pill.innerText = 'Error';
    }
  }

  // -------------------------------------------------------
  // OPEN — panel de modelos
  // -------------------------------------------------------

  function openOpenPanel(chip) {
    const wrap = document.createElement('div');
    wrap.className = 'sp-open-inner';

    // Search row — mismo grid que filas, pill solo ocupa columna name
    const searchRow = document.createElement('div');
    searchRow.className = 'sp-open-search-row';

    const searchPill = document.createElement('div');
    searchPill.className = 'sp-open-search-pill';

    const searchIcon = document.createElement('span');
    searchIcon.className = 'sp-open-search-icon';
    searchIcon.innerHTML = `<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><circle cx="4.5" cy="4.5" r="3.5" stroke="currentColor" stroke-width="1.4"/><line x1="7.5" y1="7.5" x2="10.5" y2="10.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;

    const searchInput = document.createElement('input');
    searchInput.className = 'sp-open-search';
    searchInput.placeholder = 'search...';
    searchInput.spellcheck = false;

    searchPill.appendChild(searchIcon);
    searchPill.appendChild(searchInput);
    searchRow.appendChild(searchPill);
    wrap.appendChild(searchRow);

    // Header con columnas ordenables
    const header = document.createElement('div');
    header.className = 'sp-open-header';

    const colDefs = [
      { key: 'name',     label: 'Name' },
      { key: 'created',  label: 'Created' },
      { key: 'modified', label: 'Modified' },
      { key: 'owner',    label: 'Owner' },
    ];

    const headerCells = colDefs.map(col => {
      const span = document.createElement('span');
      span.dataset.col = col.key;
      span.style.cursor = 'pointer';
      span.innerHTML = col.label + '<span class="sp-open-sort-arrow"></span>';
      header.appendChild(span);
      return span;
    });
    header.appendChild(document.createElement('span')); // placeholder del

    wrap.appendChild(header);

    // List
    const listEl = document.createElement('div');
    listEl.className = 'sp-open-list';
    listEl.innerHTML = '<div class="sp-open-loading">loading…</div>';
    wrap.appendChild(listEl);

    openSubpanel('logo', chip, wrap, false);
    _loadOpenModels(listEl, searchInput, headerCells);
  }

  async function _loadOpenModels(listEl, searchInput, headerCells) {
    const userId = window.__USER_ID;
    if (!userId) return;

    const { data: muRows, error: muErr } = await window.supabaseClient
      .from('model_users')
      .select('model_id, role, viewed, models(id, name, created_at, last_review)')
      .eq('user_id', userId);

    if (muErr || !muRows) {
      listEl.innerHTML = '<div class="sp-open-loading">Error loading models</div>';
      return;
    }

    const modelIds = muRows.map(r => r.model_id).filter(Boolean);

    let ownerMap = {};
    if (modelIds.length > 0) {
      const { data: ownerRows } = await window.supabaseClient
        .from('model_users')
        .select('model_id, users(name)')
        .eq('role', 'owner')
        .in('model_id', modelIds);
      (ownerRows || []).forEach(r => { ownerMap[r.model_id] = r.users?.name || '—'; });
    }

    listEl.innerHTML = '';
    const allRowEls = [];

    muRows.filter(r => r.models).forEach(mu => {
      const m = mu.models;
      const rowEl = document.createElement('div');
      rowEl.className = 'sp-open-row';
      rowEl.dataset.modelId  = m.id;
      rowEl.dataset.name     = (m.name || '').toLowerCase();
      rowEl.dataset.created  = m.created_at  || '';
      rowEl.dataset.modified = m.last_review || m.created_at || '';
      rowEl.dataset.owner    = (ownerMap[m.id] || '').toLowerCase();

      const isCurrent = m.id === window.MODEL_ID;
      const isNewShare = !mu.viewed && mu.role !== 'owner';

      const nameEl = document.createElement('span');
      nameEl.className = 'sp-open-col-name' + (isCurrent ? ' sp-open-current' : '');

      const nameText = document.createElement('span');
      nameText.className = 'sp-open-col-name-text';
      nameText.innerText = m.name || '(unnamed)';
      nameText.title = m.name || '(unnamed)';
      nameEl.appendChild(nameText);

      if (isNewShare) {
        const pill = document.createElement('span');
        pill.className = 'sp-new-share-pill';
        pill.innerText = 'new share';
        nameEl.appendChild(pill);
      }

      const createdEl = document.createElement('span');
      createdEl.className = 'sp-open-col-date';
      createdEl.innerText = m.created_at ? m.created_at.slice(0, 10) : '—';

      const modEl = document.createElement('span');
      modEl.className = 'sp-open-col-date';
      modEl.innerText = m.last_review ? m.last_review.slice(0, 10) : '—';

      const ownerName = ownerMap[m.id] || '—';
      const ownerEl = document.createElement('span');
      ownerEl.className = 'sp-open-col-owner';
      ownerEl.title = ownerName;
      ownerEl.innerText = ownerName;

      const isOwner = mu.role === 'owner';

      const delEl = document.createElement('span');
      delEl.className = 'sp-open-del';
      delEl.innerText = '✕';
      delEl.title = isOwner ? 'Delete model' : 'Leave model';

      rowEl.appendChild(nameEl);
      rowEl.appendChild(createdEl);
      rowEl.appendChild(modEl);
      rowEl.appendChild(ownerEl);
      rowEl.appendChild(delEl);

      rowEl.addEventListener('dblclick', async () => {
        await window.supabaseClient.from('model_users')
          .update({ viewed: true })
          .eq('model_id', m.id)
          .eq('user_id', window.__USER_ID);
        const url = new URL(window.location.href);
        url.searchParams.set('m', m.id);
        window.location.href = url.toString();
      });

      delEl.addEventListener('click', e => {
        e.stopPropagation();
        _openDeleteModelConfirm(m.id, m.name, delEl, () => {
          rowEl.style.transition = 'opacity 0.2s';
          rowEl.style.opacity = '0';
          setTimeout(() => rowEl.remove(), 200);
        }, isOwner);
      });

      listEl.appendChild(rowEl);
      allRowEls.push(rowEl);
    });

    if (allRowEls.length === 0) {
      listEl.innerHTML = '<div class="sp-open-loading">No models found</div>';
      return;
    }

    // Sort
    let sortCol = 'modified';
    let sortAsc  = false;

    function applySort(col) {
      if (sortCol === col) {
        sortAsc = !sortAsc;
      } else {
        sortCol = col;
        sortAsc = (col === 'name' || col === 'owner');
      }
      [...allRowEls]
        .sort((a, b) => {
          const va = a.dataset[col] || '';
          const vb = b.dataset[col] || '';
          return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
        })
        .forEach(el => listEl.appendChild(el));

      headerCells.forEach(cell => {
        const arrow = cell.querySelector('.sp-open-sort-arrow');
        if (arrow) arrow.textContent = cell.dataset.col === sortCol ? (sortAsc ? ' ▲' : ' ▼') : '';
      });
    }

    headerCells.forEach(cell => cell.addEventListener('click', () => applySort(cell.dataset.col)));

    // Indicador inicial
    const modCell = headerCells.find(c => c.dataset.col === 'modified');
    if (modCell) modCell.querySelector('.sp-open-sort-arrow').textContent = ' ▼';

    // Search filter
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase().trim();
      allRowEls.forEach(el => {
        el.style.display = (!q || el.dataset.name.includes(q)) ? '' : 'none';
      });
    });

    searchInput.focus();
  }

  async function _leaveModel(modelId) {
    await window.supabaseClient.from('model_users')
      .delete()
      .eq('model_id', modelId)
      .eq('user_id', window.__USER_ID);
  }

  function _openDeleteModelConfirm(modelId, modelName, anchorEl, onDeleted, isOwner = true) {
    document.getElementById('model-delete-confirm')?.remove();

    const modal = document.createElement('div');
    modal.id        = 'model-delete-confirm';
    modal.className = 'shape-dropdown';
    modal.style.cssText = 'position:fixed;z-index:999999;padding:10px 12px;display:flex;flex-direction:column;gap:10px;min-width:0;max-width:260px;';

    const text = document.createElement('div');
    text.style.cssText = 'font-size:12px;color:rgba(255,255,255,0.85);font-weight:500;white-space:normal;line-height:1.35';
    text.innerText = isOwner
      ? `Permanently delete “${modelName}” and all its data? This cannot be undone.`
      : `Leave “${modelName}”?`;

    const btns = document.createElement('div');
    btns.style.cssText = 'display:flex;gap:6px;justify-content:flex-end';

    const yes = document.createElement('div');
    yes.className = 'shape-option';
    yes.innerText = 'yes';
    yes.style.cssText = 'color:#ef4444;font-weight:600;cursor:pointer';
    yes.addEventListener('click', async e => {
      e.stopPropagation();
      modal.remove();
      try {
        if (isOwner) {
          await _hardDeleteModel(modelId);
        } else {
          await _leaveModel(modelId);
        }
      } catch (err) {
        console.error('[sp] delete model failed:', err);
        alert('Could not delete the model:\n' + (err?.message || err) +
              '\n\nThe model was NOT removed. Check console / DB permissions.');
        return;
      }
      onDeleted();
    });

    const no = document.createElement('div');
    no.className = 'shape-option';
    no.innerText = 'no';
    no.style.cursor = 'pointer';
    no.addEventListener('click', e => { e.stopPropagation(); modal.remove(); });

    btns.appendChild(yes);
    btns.appendChild(no);
    modal.appendChild(text);
    modal.appendChild(btns);
    document.body.appendChild(modal);

    const r  = anchorEl.getBoundingClientRect();
    const mW = modal.offsetWidth  || 120;
    const mH = modal.offsetHeight || 58;
    const mg = 8;
    let left = r.right + 8;
    if (left + mW > window.innerWidth - mg) left = r.left - mW - 8;
    let top = r.top + r.height / 2 - mH / 2;
    if (top + mH > window.innerHeight - mg) top = window.innerHeight - mH - mg;
    modal.style.left = Math.max(mg, left) + 'px';
    modal.style.top  = Math.max(mg, top)  + 'px';

    setTimeout(() => {
      const close = e => { if (!modal.contains(e.target)) { modal.remove(); document.removeEventListener('click', close); } };
      document.addEventListener('click', close);
    }, 0);
  }

  async function _hardDeleteModel(modelId) {
    const sb = window.supabaseClient;

    // IDs dependientes (junction tables sin model_id)
    const { data: nodeRows } = await sb.from('nodes').select('id').eq('model_id', modelId);
    const nodeIds = (nodeRows || []).map(r => r.id);
    const { data: linkRows } = await sb.from('links').select('id').eq('model_id', modelId);
    const linkIds = (linkRows || []).map(r => r.id);

    // helper: ejecuta el delete y aborta toda la operación si Supabase devuelve error
    const run = async (label, q) => {
      const { error } = await q;
      if (error) { console.error(`[sp] hardDelete ${label}:`, error); throw new Error(`${label}: ${error.message}`); }
    };

    // orden: hijos → padres (respetando FKs)
    if (linkIds.length) await run('link_concepts', sb.from('link_concepts').delete().in('link_id', linkIds));
    if (nodeIds.length) {
      await run('node_groups',          sb.from('node_groups').delete().in('node_id', nodeIds));
      await run('node_parent_concepts', sb.from('node_parent_concepts').delete().in('node_id', nodeIds));
    }
    await run('links',       sb.from('links').delete().eq('model_id', modelId));
    await run('time_values', sb.from('time_values').delete().eq('model_id', modelId));
    await run('nodes',       sb.from('nodes').delete().eq('model_id', modelId));
    await run('units',       sb.from('units').delete().eq('model_id', modelId));
    await run('groups',      sb.from('groups').delete().eq('model_id', modelId));
    await run('concepts',    sb.from('concepts').delete().eq('model_id', modelId));

    // models ANTES que model_users: la policy de DELETE de models exige que la membresía
    // owner siga existiendo. El FK model_users.model_id ON DELETE CASCADE limpia las membresías.
    const { data: delRows, error: delErr } = await sb.from('models').delete().eq('id', modelId).select('id');
    if (delErr) { console.error('[sp] hardDelete models:', delErr); throw new Error('models: ' + delErr.message); }
    if (!delRows || delRows.length === 0) {
      throw new Error('models: 0 rows deleted (RLS/permission — missing DELETE policy on models?)');
    }

    // limpieza por si el FK no fuera CASCADE (no-op si ya cascadearon). No abortamos si falla:
    // el modelo ya está borrado y sin él las membresías quedan huérfanas/inaccesibles igual.
    const { error: muErr } = await sb.from('model_users').delete().eq('model_id', modelId);
    if (muErr) console.warn('[sp] hardDelete model_users (post-models cleanup):', muErr);

  }

  // -------------------------------------------------------
  // SHARE — panel de usuarios del modelo
  // Columnas: email | name | avatar | role | del
  // -------------------------------------------------------

  function openSharePanel(chip) {
    const wrap = document.createElement('div');
    wrap.className = 'sp-share-inner';

    const header = document.createElement('div');
    header.className = 'sp-share-header';
    ['Email', 'Name', '', 'Role', ''].forEach(t => {
      const s = document.createElement('span');
      s.innerText = t;
      header.appendChild(s);
    });
    wrap.appendChild(header);

    const listEl = document.createElement('div');
    listEl.className = 'sp-share-list';
    listEl.innerHTML = '<div class="sp-open-loading">loading…</div>';
    wrap.appendChild(listEl);

    const footer = document.createElement('div');
    footer.className = 'sp-share-footer';
    const addBtn = document.createElement('div');
    addBtn.className = 'sp-units-add-btn';
    addBtn.innerText = '+';
    addBtn.addEventListener('click', e => { e.stopPropagation(); _showShareAddRow(listEl); });
    footer.appendChild(addBtn);
    wrap.appendChild(footer);

    openSubpanel('logo', chip, wrap, false);
    _loadShareUsers(listEl);
  }

  async function _loadShareUsers(listEl) {
    const modelId = window.MODEL_ID;
    if (!modelId) return;

    const { data: muRows, error } = await window.supabaseClient
      .from('model_users').select('user_id, role').eq('model_id', modelId);

    if (error || !muRows) {
      listEl.innerHTML = '<div class="sp-open-loading">Error loading users</div>';
      return;
    }

    const userIds = muRows.map(r => r.user_id).filter(Boolean);
    let usersMap = {};
    if (userIds.length > 0) {
      const { data: usersRows, error: usersErr } = await window.supabaseClient
        .from('users').select('id, name, email, color').in('id', userIds);
      if (usersErr) console.error('[share] users query:', usersErr);
      (usersRows || []).forEach(u => { usersMap[u.id] = u; });
    }

    listEl.innerHTML = '';
    muRows.forEach(mu => listEl.appendChild(_makeShareRow({ ...mu, users: usersMap[mu.user_id] || {} }, listEl)));
  }

  function _makeShareRow(mu, listEl) {
    const row = document.createElement('div');
    row.className = 'sp-share-row';
    const u = mu.users || {};

    const emailEl = document.createElement('span');
    emailEl.className = 'sp-share-col-email';
    emailEl.innerText = u.email || '—';
    emailEl.title = u.email || '';

    const nameEl = document.createElement('span');
    nameEl.className = 'sp-share-col-name';
    nameEl.innerText = u.name || '—';
    nameEl.title = u.name || '';

    const av = makeAvatarCircle(u.name || mu.user_id || '?', u.color);
    av.style.width = '16px'; av.style.height = '16px';
    av.style.fontSize = '8px'; av.style.flexShrink = '0'; av.style.marginLeft = '0';

    let curRole = mu.role || 'reader';
    const roleEl = document.createElement('span');
    roleEl.className = 'sp-share-col-role';
    roleEl.innerText = curRole;
    if (curRole === 'owner') {
      roleEl.style.opacity = '0.5';
      roleEl.style.cursor = 'default';
    } else {
      const roles = ['writer', 'reader'];
      roleEl.title = 'click to cycle role';
      roleEl.style.cursor = 'pointer';
      roleEl.addEventListener('click', async e => {
        e.stopPropagation();
        curRole = roles[(roles.indexOf(curRole) + 1) % roles.length];
        roleEl.innerText = curRole;
        await window.supabaseClient.from('model_users')
          .update({ role: curRole })
          .eq('model_id', window.MODEL_ID).eq('user_id', mu.user_id);
      });
    }

    const delEl = document.createElement('span');
    delEl.className = 'sp-open-del';
    delEl.innerText = '✕';
    delEl.addEventListener('click', e => {
      e.stopPropagation();
      _openRemoveUserConfirm(mu.user_id, delEl, () => {
        row.style.transition = 'opacity 0.2s';
        row.style.opacity = '0';
        setTimeout(() => row.remove(), 200);
      });
    });

    row.append(emailEl, nameEl, av, roleEl, delEl);
    return row;
  }

  function _showShareAddRow(listEl) {
    listEl.querySelector('.sp-share-add-row')?.remove();
    _hideShareDropdowns();

    const row = document.createElement('div');
    row.className = 'sp-share-row sp-share-add-row';

    // Email input con autocomplete predictivo
    const emailInput = document.createElement('input');
    emailInput.className = 'sp-share-email-input sp-share-col-email';
    emailInput.placeholder = 'email…';
    emailInput.spellcheck = false;

    // Name (se llena al seleccionar)
    const nameEl = document.createElement('span');
    nameEl.className = 'sp-share-col-name';
    nameEl.style.color = 'rgba(255,255,255,0.28)';
    nameEl.innerText = '—';

    // Avatar placeholder (se reemplaza al seleccionar)
    const avHolder = document.createElement('div');
    avHolder.className = 'sp-share-av-placeholder';

    // Role — deshabilitado hasta seleccionar usuario
    const roleEl = document.createElement('span');
    roleEl.className = 'sp-share-col-role sp-share-role-pending';
    roleEl.innerText = 'define…';

    // Cancel
    const cancelEl = document.createElement('span');
    cancelEl.className = 'sp-open-del';
    cancelEl.innerText = '✕';
    cancelEl.addEventListener('click', e => { e.stopPropagation(); _hideShareDropdowns(); row.remove(); });

    let selectedUser = null;
    let _acTimer = null;

    emailInput.addEventListener('input', () => {
      clearTimeout(_acTimer);
      selectedUser = null;
      const q = emailInput.value.trim();
      if (q.length < 2) { _hideShareDropdowns(); return; }
      _acTimer = setTimeout(() => {
        _showShareAutocomplete(q, emailInput, user => {
          // Usuario seleccionado del autocomplete
          selectedUser = user;
          emailInput.value = user.email;
          nameEl.innerText = user.name || '—';
          nameEl.style.color = '';
          // Reemplazar avatar
          const av = makeAvatarCircle(user.name || '?', user.color);
          av.style.cssText += 'width:16px;height:16px;font-size:8px;flex-shrink:0;margin-left:0;';
          avHolder.replaceWith(av);
          // Activar role y mostrar dropdown
          roleEl.classList.remove('sp-share-role-pending');
          roleEl.innerText = 'define…';
          _showRolePickerDropdown(roleEl, async chosenRole => {
            roleEl.innerText = chosenRole;
            await _addShareUser(selectedUser, chosenRole, listEl, row);
          });
        });
      }, 200);
    });

    emailInput.addEventListener('keydown', e => {
      if (e.key === 'Escape') { _hideShareDropdowns(); row.remove(); }
    });

    row.append(emailInput, nameEl, avHolder, roleEl, cancelEl);
    listEl.appendChild(row);
    emailInput.focus();
  }

  function _showShareAutocomplete(query, anchorEl, onSelect) {
    document.getElementById('sp-share-ac')?.remove();

    window.supabaseClient
      .from('users').select('id, name, email, color')
      .ilike('email', `%${query}%`)
      .eq('status', 'ACTIVE')
      .limit(6)
      .then(({ data }) => {
        const dd = document.createElement('div');
        dd.id = 'sp-share-ac';
        dd.className = 'shape-dropdown sp-share-dropdown';
        document.body.appendChild(dd);

        if (!data || data.length === 0) {
          const msg = document.createElement('div');
          msg.className = 'sp-share-dd-item';
          msg.style.cssText = 'color:rgba(255,255,255,0.40);font-style:italic;cursor:default;';
          msg.innerText = 'this is not a valid user';
          dd.appendChild(msg);
        } else {
          data.forEach(user => {
            const item = document.createElement('div');
            item.className = 'sp-share-dd-item';
            const eml = document.createElement('span');
            eml.className = 'sp-share-dd-email';
            eml.innerText = user.email;
            const nm = document.createElement('span');
            nm.className = 'sp-share-dd-name';
            nm.innerText = user.name || '';
            item.append(eml, nm);
            item.addEventListener('mousedown', e => {
              e.preventDefault();
              document.getElementById('sp-share-ac')?.remove();
              onSelect(user);
            });
            dd.appendChild(item);
          });
        }

        const r = anchorEl.getBoundingClientRect();
        dd.style.left = r.left + 'px';
        dd.style.top  = (r.bottom + 2) + 'px';
        dd.style.minWidth = '200px';
      });
  }

  function _showRolePickerDropdown(anchorEl, onSelect) {
    document.getElementById('sp-share-role-dd')?.remove();

    const dd = document.createElement('div');
    dd.id = 'sp-share-role-dd';
    dd.className = 'shape-dropdown sp-share-dropdown';
    document.body.appendChild(dd);

    ['writer', 'reader'].forEach(role => {
      const item = document.createElement('div');
      item.className = 'sp-share-dd-item';
      item.innerText = role;
      item.addEventListener('mousedown', e => {
        e.preventDefault();
        document.getElementById('sp-share-role-dd')?.remove();
        onSelect(role);
      });
      dd.appendChild(item);
    });

    const r = anchorEl.getBoundingClientRect();
    dd.style.left = r.left + 'px';
    dd.style.top  = (r.bottom + 2) + 'px';
    dd.style.minWidth = '80px';

    setTimeout(() => {
      const close = e => {
        if (!dd.contains(e.target)) { dd.remove(); document.removeEventListener('mousedown', close); }
      };
      document.addEventListener('mousedown', close);
    }, 0);
  }

  function _hideShareDropdowns() {
    document.getElementById('sp-share-ac')?.remove();
    document.getElementById('sp-share-role-dd')?.remove();
  }

  async function _addShareUser(user, role, listEl, addRow) {
    const modelId = window.MODEL_ID;

    const { data: existing } = await window.supabaseClient
      .from('model_users').select('user_id')
      .eq('model_id', modelId).eq('user_id', user.id).maybeSingle();

    if (existing) { addRow.remove(); return; }

    const { error } = await window.supabaseClient
      .from('model_users').insert({ model_id: modelId, user_id: user.id, role, viewed: false });

    if (error) { console.error('[sp] addShareUser:', error); return; }

    addRow.replaceWith(_makeShareRow({ user_id: user.id, role, users: user }, listEl));
  }

  function _openRemoveUserConfirm(userId, anchorEl, onRemoved) {
    document.getElementById('user-remove-confirm')?.remove();
    const modal = document.createElement('div');
    modal.id = 'user-remove-confirm';
    modal.className = 'shape-dropdown';
    modal.style.cssText = 'position:fixed;z-index:999999;padding:10px 12px;display:flex;flex-direction:column;gap:10px;min-width:0;';
    const text = document.createElement('div');
    text.style.cssText = 'font-size:12px;color:rgba(255,255,255,0.85);font-weight:500;white-space:nowrap';
    text.innerText = 'Remove user?';
    const btns = document.createElement('div');
    btns.style.cssText = 'display:flex;gap:6px;justify-content:flex-end';
    const yes = document.createElement('div');
    yes.className = 'shape-option';
    yes.innerText = 'yes';
    yes.style.cssText = 'color:#ef4444;font-weight:600;cursor:pointer';
    yes.addEventListener('click', async e => {
      e.stopPropagation(); modal.remove();
      const { error } = await window.supabaseClient.rpc('remove_model_user', {
        p_model_id: window.MODEL_ID,
        p_user_id: userId
      });
      if (error) { console.error('[share] delete error:', error); return; }
      onRemoved();
    });
    const no = document.createElement('div');
    no.className = 'shape-option';
    no.innerText = 'no';
    no.style.cursor = 'pointer';
    no.addEventListener('click', e => { e.stopPropagation(); modal.remove(); });
    btns.append(yes, no);
    modal.append(text, btns);
    document.body.appendChild(modal);
    const r = anchorEl.getBoundingClientRect();
    const mW = modal.offsetWidth || 120, mH = modal.offsetHeight || 58, mg = 8;
    let left = r.right + 8;
    if (left + mW > window.innerWidth - mg) left = r.left - mW - 8;
    let top = r.top + r.height / 2 - mH / 2;
    if (top + mH > window.innerHeight - mg) top = window.innerHeight - mH - mg;
    modal.style.left = Math.max(mg, left) + 'px';
    modal.style.top  = Math.max(mg, top)  + 'px';
    setTimeout(() => {
      const close = e => { if (!modal.contains(e.target)) { modal.remove(); document.removeEventListener('click', close); } };
      document.addEventListener('click', close);
    }, 0);
  }

  // -------------------------------------------------------
  // 💡 LOGO — helpers de usuarios
  // -------------------------------------------------------

  function _nameToColor(name) {
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return `hsl(${Math.abs(hash) % 360}, 50%, 52%)`;
  }

  function makeAvatarCircle(name, color) {
    const el = document.createElement('div');
    el.className = 'sp-avatar-circle';
    el.style.background = color || _nameToColor(name || '?');
    el.innerText = (name || '?')[0].toUpperCase();
    el.title = name || '—';
    return el;
  }

  function makeLastReviewChip(dateValue, onSave, reviewerName, reviewerColor) {
    const chip = makeDateChip('Last review', dateValue, onSave);
    chip._panelKey = 'logo';
    chip.querySelector('.ui-chip-value')?.appendChild(makeAvatarCircle(reviewerName, reviewerColor));
    return chip;
  }

  function makeMeChip(userName, userColor) {
    const chip = document.createElement('div');
    chip.className = 'ui-chip';
    chip.style.cursor = 'default';

    const lbl = document.createElement('div');
    lbl.className = 'ui-chip-label';
    lbl.innerText = 'Me';

    const val = document.createElement('div');
    val.className = 'ui-chip-value';
    val.style.gap = '6px';
    val.style.maxWidth = 'none';

    const name = document.createElement('span');
    name.innerText = userName || '—';

    const pill = document.createElement('div');
    pill.className = 'sp-close-session-pill';
    pill.innerText = 'close session';
    pill.addEventListener('click', async e => {
      e.stopPropagation();
      await window.supabaseClient?.auth.signOut();
      window.location.href = 'index.html';
    });

    val.appendChild(name);
    val.appendChild(makeAvatarCircle(userName, userColor));
    val.appendChild(pill);
    chip.appendChild(lbl);
    chip.appendChild(val);
    return chip;
  }

  async function _fetchAndSetOpenBadge(chipEl) {
    const userId = window.__USER_ID;
    if (!userId) return;
    const { data } = await window.supabaseClient
      .from('model_users')
      .select('model_id')
      .eq('user_id', userId)
      .eq('viewed', false)
      .neq('role', 'owner');
    const count = data?.length || 0;
    if (!count) return;
    document.getElementById('sp-open-count-badge')?.remove();
    const badge = document.createElement('div');
    badge.id = 'sp-open-count-badge';
    badge.className = 'sp-open-count-badge';
    badge.innerText = count;
    badge.style.position = 'fixed';
    badge.style.zIndex = '9999999';
    document.body.appendChild(badge);
    requestAnimationFrame(() => {
      const r = chipEl.getBoundingClientRect();
      badge.style.left = (r.right - 7) + 'px';
      badge.style.top  = (r.top  - 7) + 'px';
    });
  }

  // -------------------------------------------------------
  // EXPORT — PDF y CSV
  // -------------------------------------------------------

  function openExportPanel(chip) {
    const wrap = document.createElement('div');
    wrap.className = 'sp-export-inner';

    [
      { label: 'PDF',  action: () => { _openPdfRangePanel(chip); } },
      { label: 'JSON', action: async () => { closeSubpanel('logo'); await _exportJSON(); } }
    ].forEach(({ label, action }) => {
      const row = document.createElement('div');
      row.className = 'sp-export-option shape-option';
      row.innerText = label;
      row.addEventListener('click', e => { e.stopPropagation(); action(); });
      wrap.appendChild(row);
    });

    openSubpanel('logo', chip, wrap, false);
  }

  // Selector de rango de períodos para el PDF (una página por período)
  function _openPdfRangePanel(chip) {
    const periods = parseInt(window.MODEL_DATA?.periods || 1);

    const wrap = document.createElement('div');
    wrap.className = 'sp-export-inner';
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:10px;padding:4px 2px;min-width:170px;';

    const title = document.createElement('div');
    title.style.cssText = 'font-size:12px;color:rgba(255,255,255,0.85);font-weight:600;';
    title.innerText = 'PDF — one page per period';

    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.5);';
    hint.innerText = `Periods 1–${periods}. Leave full range for all.`;

    const mkInput = (val) => {
      const i = document.createElement('input');
      i.type = 'number'; i.min = '1'; i.max = String(periods); i.value = String(val);
      i.style.cssText = 'width:54px;background:#2a2a2a;border:1px solid #444;border-radius:6px;color:#fff;font-size:12px;padding:4px 6px;text-align:center;';
      return i;
    };
    const fromI = mkInput(1);
    const toI   = mkInput(periods);

    const range = document.createElement('div');
    range.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:12px;color:rgba(255,255,255,0.7);';
    const fromL = document.createElement('span'); fromL.innerText = 'From';
    const toL   = document.createElement('span'); toL.innerText = 'to';
    range.append(fromL, fromI, toL, toI);

    const btn = document.createElement('div');
    btn.className = 'sp-export-option shape-option';
    btn.innerText = 'Export';
    btn.style.cssText = 'text-align:center;font-weight:600;color:#4ea1ff;';
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      let from = Math.max(1, Math.min(periods, parseInt(fromI.value) || 1));
      let to   = Math.max(1, Math.min(periods, parseInt(toI.value)   || periods));
      if (from > to) [from, to] = [to, from];
      closeSubpanel('logo');
      await _exportPDF(from, to);
    });

    wrap.append(title, hint, range, btn);
    openSubpanel('logo', chip, wrap, false);
  }

  function _loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // Export PDF: una página por período (fromP..toP). Cada página encuadra TODO el
  // modelo centrado (cy.fit) y muestra el momento (caption), apagando settings y (+).
  async function _exportPDF(fromP, toP) {
    await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    await _loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');

    const periods = parseInt(window.MODEL_DATA?.periods || 1);
    fromP = Math.max(1, Math.min(periods, fromP || 1));
    toP   = Math.max(1, Math.min(periods, toP   || periods));

    // Cerrar todos los paneles de chips (los destruye del DOM)
    if (typeof window.closeLogoPanel     === 'function') window.closeLogoPanel();
    if (typeof window.closeSettingsPanel === 'function') window.closeSettingsPanel();
    if (typeof window.closeTimePanel     === 'function') window.closeTimePanel();

    // Pre-fetch SVG lamparita — html2canvas no puede renderizar <img src=".svg">
    const svgCache = {};
    const logoImg  = document.querySelector('#logo-btn img[src$=".svg"]');
    const logoImgW = logoImg?.offsetWidth  || 32;
    const logoImgH = logoImg?.offsetHeight || 32;
    if (logoImg) {
      try { svgCache[logoImg.src] = await (await fetch(logoImg.src)).text(); } catch(e) {}
    }

    // Capturar color real del input ANTES de clonar (var(--top-ui-color) puede no resolverse en el clon)
    const nameInput = document.getElementById('model-name');
    const nameValue = nameInput?.value || '';
    const nameColor = nameInput ? window.getComputedStyle(nameInput).color : 'inherit';

    // Ocultar UI de edición que no debe aparecer en el export.
    // time-circle SÍ se deja visible (muestra n° de período + badge de períodos totales).
    const hideIds = ['add-node-btn', 'settings-btn', 'badge-layer'];
    const hidden = hideIds.map(id => document.getElementById(id)).filter(Boolean);
    hidden.forEach(el => { el.dataset._prevVis = el.style.visibility; el.style.visibility = 'hidden'; });

    // El badge fixed es capturado del viewport original por html2canvas,
    // no del clon — única solución confiable: sacarlo del DOM y restaurarlo.
    const floatBadge = document.getElementById('sp-open-count-badge');
    if (floatBadge) floatBadge.remove();

    // Caption del momento (una por página). Se inyecta en el body real → html2canvas lo captura.
    const caption = document.createElement('div');
    caption.id = 'sp-pdf-caption';
    caption.style.cssText = `position:fixed;top:60px;left:0;right:0;text-align:center;
      font-size:18px;font-weight:500;color:${nameColor};z-index:50;pointer-events:none;`;
    document.body.appendChild(caption);

    // Guardar estado para restaurar
    const cy = window.cy;
    const origPeriod = window.CURRENT_PERIOD || 1;
    const z0 = cy ? cy.zoom() : null;
    const p0 = cy ? { ...cy.pan() } : null;

    const captureOnce = () => html2canvas(document.body, {
      backgroundColor: window.MODEL_DATA?.background_color || '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
      onclone: (clonedDoc) => {
        clonedDoc.getElementById('sp-open-count-badge')?.remove();
        clonedDoc.getElementById('time-slider')?.remove();
        clonedDoc.getElementById('time-nav')?.remove();
        clonedDoc.getElementById('help-ui')?.remove();
        clonedDoc.getElementById('help-results')?.remove();
        clonedDoc.getElementById('ai-chip')?.remove();
        clonedDoc.getElementById('ai-panel')?.remove();

        // SVG inline (html2canvas no renderiza <img src=".svg">)
        clonedDoc.querySelectorAll('img[src$=".svg"]').forEach(img => {
          const svgText = svgCache[img.src];
          if (!svgText) return;
          const tmp = clonedDoc.createElement('div');
          tmp.innerHTML = svgText;
          const svg = tmp.querySelector('svg');
          if (!svg) return;
          svg.style.width  = logoImgW + 'px';
          svg.style.height = logoImgH + 'px';
          svg.style.display = 'block';
          img.parentNode.replaceChild(svg, img);
        });

        // Reemplazar <input#model-name> con <div> (line-height de input colapsa un div; color via var())
        const inp = clonedDoc.getElementById('model-name');
        if (inp) {
          const div = clonedDoc.createElement('div');
          div.innerText = nameValue;
          div.style.cssText = `height:42px;font-size:32px;font-weight:400;line-height:42px;
            margin-top:-8px;padding:0;color:${nameColor};background:transparent;white-space:nowrap;overflow:hidden;`;
          inp.parentNode.replaceChild(div, inp);
        }
      }
    });

    const fitModel = () => {
      if (!cy) return;
      const eles = cy.nodes().filter(n =>
        !n.data('isChip') && !n.data('isConceptHub') && n.style('display') !== 'none');
      if (eles.length) cy.fit(eles, 60);
    };

    try {
      const { jsPDF } = window.jspdf;
      let pdf = null;

      for (let p = fromP; p <= toP; p++) {
        if (typeof window._timeSetPeriod === 'function') window._timeSetPeriod(p);
        caption.innerText = _periodDateLabel(p) ||
          `${(window.MODEL_DATA?.time_unit || 'period')} ${p}`;
        fitModel();
        // Dar tiempo a que los labels HTML se reposicionen tras fit/refresh
        await new Promise(r => setTimeout(r, 140));

        const canvas = await captureOnce();
        const imgW = canvas.width  / 2;
        const imgH = canvas.height / 2;
        const orient = imgW > imgH ? 'landscape' : 'portrait';
        if (!pdf) {
          pdf = new jsPDF({ orientation: orient, unit: 'px', format: [imgW, imgH] });
        } else {
          pdf.addPage([imgW, imgH], orient);
        }
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgW, imgH);
      }

      const name = (window.MODEL_DATA?.name || 'model').replace(/[^a-z0-9_\-]/gi, '_');
      pdf.save(`${name}.pdf`);
    } finally {
      caption.remove();
      hidden.forEach(el => { el.style.visibility = el.dataset._prevVis || ''; });
      if (typeof window._timeSetPeriod === 'function') window._timeSetPeriod(origPeriod);
      if (cy && z0 != null) cy.viewport({ zoom: z0, pan: p0 });
      // floatBadge no se restaura: el logo panel quedó cerrado, se recrea al reabrir.
    }
  }

  // Slug legible y único para claves locales (units/groups/concepts/links).
  function _localIdMap(rows, prefix, nameField) {
    const byId = {}; const used = new Set();
    (rows || []).forEach((r, idx) => {
      let base = String(r?.[nameField] ?? '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      if (!base) base = String(idx + 1);
      let key = `${prefix}_${base}`, k = key, c = 2;
      while (used.has(k)) k = `${key}_${c++}`;
      used.add(k); byId[r.id] = k;
    });
    return byId;
  }

  // Export JSON para IA (contrato idemodel.model.v1): referencias por claves legibles
  // (nodos por label, units/groups/concepts/links por id local), fórmulas en forma
  // legible `Label[offset]`, y una _spec que es a la vez leyenda Y guía de autoría.
  // Builder puro del contrato idemodel.model.v1 (reusado por export-a-archivo y por el
  // read-tool del agente de IA). Devuelve el objeto `out`; no descarga nada.
  window.buildModelExport = async function (opts = {}) {
    const forAgent = opts.forAgent === true;   // agente IA: payload reducido (sin _spec ni coords/campos visuales)
    if (typeof window.fetchModelSnapshot !== 'function' || !window.MODEL_ID) {
      throw new Error('model not loaded');
    }
    const snap = await window.fetchModelSnapshot(window.MODEL_ID);

    // Claves locales (uuid → clave legible)
    const nodeKeyById = {}; const usedNK = new Set();
    (snap.nodes || []).forEach(n => {
      let base = String(n.label ?? '').trim() || `node_${String(n.id || '').slice(0, 8)}`;
      let k = base, c = 2;
      while (usedNK.has(k)) k = `${base} (${c++})`;
      usedNK.add(k); nodeKeyById[n.id] = k;
    });
    const unitIdMap    = _localIdMap(snap.units,    'u', 'name');
    const groupIdMap   = _localIdMap(snap.groups,   'g', 'name');
    const conceptIdMap = _localIdMap(snap.concepts, 'c', 'label');
    const linkIdMap    = {}; (snap.links || []).forEach((l, i) => { linkIdMap[l.id] = `l_${i + 1}`; });

    const fdisplay = (f) => (window.Formula ? window.Formula.toDisplay(f, snap.nodes) : f);
    const strip = (o) => { const c = { ...o }; delete c.id; delete c.model_id; return c; };

    const m = snap.model || {};
    const spec = {
      format: 'idemodel.model.v1',
      about: 'IdeModel is a visual idea-modelling tool: a graph of nodes whose values are defined by formulas and evolve over discrete time periods. This file fully describes one model.',
      identity: 'Nodes are referenced everywhere by their unique `label`. Units, groups, concepts and links are referenced by their local `id` (a readable key, NOT a database uuid).',
      time: `Discrete periods 1..${m.periods ?? '?'}. time_unit = "${m.time_unit ?? '?'}", starting_date = "${m.starting_date ?? '?'}".`,
      formulas: {
        belongsToNode: 'A node\'s formula computes that node\'s value. Assignment is implicit (no "X =").',
        reference: 'Reference another node by wrapping its exact label in braces, followed by the period offset in brackets: `{Label}[offset]`. The braces remove any ambiguity when labels contain spaces or are prefixes of each other. The offset is mandatory and relative to the current period: [0]=current, [-1]=previous, [-2]=two back, [+1]=next.',
        selfReference: 'A node may reference ONLY its own past periods ({Caja}[-1], {Caja}[-2], ...). Never {Caja}[0] or {Caja}[+1] of itself — that would create a cycle.',
        boundaries: '[-1] in period 1 is undefined (there is no previous period). An empty/absent formula means the node has no value that period.',
        constants: 'A bare number is a valid formula (e.g. "100"). RND(a,b) yields a random number baked once on save (stable). FRND(a,b) stays live and re-rolls on every recompute.',
        operators: ['+', '-', '*', '/', '^', '=', '!=', '>', '<', '>=', '<=', 'AND', 'OR', 'NOT'],
        functions: ['SUM(...)', 'AVG(...)', 'MIN(...)', 'MAX(...)', 'ABS(x)', 'ROUND(x,n)', 'RND(a,b)', 'FRND(a,b)', 'IF(cond,then,else)', 'AND(...)', 'OR(...)', 'NOT(x)'],
        examples: ['{Ventas}[0] - {Costos}[0]', '{Caja}[-1] + {Ingresos}[0] - {Egresos}[0]', '{Clientes}[-1] * 1.05']
      },
      tables: {
        units: '`number_format` is presentation only: plain | integer | decimal2 | accounting | percent.',
        groups: 'Named groupings of nodes. `nodeGroups` assigns nodes to groups.',
        concepts: 'Qualitative tags (a concept has a `label` and a `color`). `parentConcepts` attaches concepts to a node\'s parent edge; `linkConcepts` attaches concepts to manual links.',
        links: 'Manual concept links between two nodes (the only explicitly stored edges; parent and formula edges are derived).'
      },
      howToAuthor: 'To create or evolve a model, return JSON with THIS shape. Reference nodes by `label` and the rest by local `id`. Keep node labels unique. Do NOT invent database uuids — the app generates them on import. Importing always creates a NEW model.'
    };

    const out = {
      // Para el agente IA: sin _spec (vive en su system prompt) ni coords/campos visuales de bajo
      // valor — reduce los tokens que se re-mandan en cada vuelta del loop. Export a archivo: full.
      ...(forAgent ? {} : { _spec: spec, exportedAt: new Date().toISOString() }),
      model: {
        name: m.name, periods: m.periods, time_unit: m.time_unit,
        starting_date: m.starting_date, version: m.version,
        comments: m.comments ?? null, background_color: m.background_color ?? null
      },
      units: (snap.units || []).map(u => ({ id: unitIdMap[u.id], ...strip(u) })),
      nodes: (snap.nodes || []).map(n => {
        const node = {
          label:     nodeKeyById[n.id],
          parent:    n.parent ? (nodeKeyById[n.parent] || null) : null,
          unit:      n.unit_id ? (unitIdMap[n.unit_id] || null) : null,
          comment:   n.comment ?? null,
          shape:     n.shape, color: n.color, size_type: n.size_type,
          hidden:    !!n.hidden, text_only: !!n.text_only,
          hide_when: n.hide_when ?? null,
          text_auto: n.text_auto !== false
        };
        if (!forAgent) {
          node.alpha = n.alpha; node.size_px = n.size_px; node.x = n.x; node.y = n.y;
          node.text_label = n.text_label ?? null;
          node.text_value = n.text_value ?? null;
          node.text_unit  = n.text_unit  ?? null;
        }
        return node;
      }),
      // time_values: SOLO fórmulas, en forma legible `Label[offset]`. Se omiten las vacías.
      timeValues: (snap.timeValues || [])
        .filter(tv => tv.formula != null && String(tv.formula).trim() !== '' && nodeKeyById[tv.node_id])
        .map(tv => ({ node: nodeKeyById[tv.node_id], period: tv.period, formula: fdisplay(tv.formula) })),
      groups:   (snap.groups   || []).map(g => ({ id: groupIdMap[g.id],   ...strip(g) })),
      concepts: (snap.concepts || []).map(c => ({ id: conceptIdMap[c.id], ...strip(c) })),
      nodeGroups: (snap.nodeGroups || [])
        .filter(ng => nodeKeyById[ng.node_id] && groupIdMap[ng.group_id])
        .map(ng => ({ node: nodeKeyById[ng.node_id], group: groupIdMap[ng.group_id] })),
      parentConcepts: (snap.parentConcepts || [])
        .filter(pc => nodeKeyById[pc.node_id] && conceptIdMap[pc.concept_id])
        .map(pc => ({ node: nodeKeyById[pc.node_id], concept: conceptIdMap[pc.concept_id] })),
      links: (snap.links || []).map(l => ({
        id: linkIdMap[l.id],
        source: nodeKeyById[l.source_id] || null,
        target: nodeKeyById[l.target_id] || null,
        type: l.type || 'manual'
      })),
      linkConcepts: (snap.linkConcepts || [])
        .filter(lc => linkIdMap[lc.link_id] && conceptIdMap[lc.concept_id])
        .map(lc => ({ link: linkIdMap[lc.link_id], concept: conceptIdMap[lc.concept_id] }))
    };

    return out;
  };

  async function _exportJSON() {
    let out;
    try {
      out = await window.buildModelExport();
    } catch (err) {
      console.error('[sp] exportJSON build failed:', err);
      alert('Could not read the model from the database:\n' + (err?.message || err));
      return;
    }

    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `${(window.MODEL_DATA?.name || 'model').replace(/[^a-z0-9_\-]/gi, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // IMPORT — levanta un JSON idemodel.model.v1 y crea un MODELO NUEVO (uuids frescos,
  // referencias resueltas, fórmulas {Label}[off] → node:<uuid>). Nunca toca el modelo actual.
  function _openImportPicker() {
    closeSubpanel('logo');
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', async () => {
      const f = input.files && input.files[0];
      input.remove();
      if (!f) return;
      let data;
      try { data = JSON.parse(await f.text()); }
      catch (e) { alert('Invalid JSON file: ' + (e?.message || e)); return; }
      await _importModelFromJSON(data, f.name);
    });
    input.click();
  }

  async function _importModelFromJSON(data, fileName) {
    const sb = window.supabaseClient;
    const userId = window.__USER_ID;
    if (!sb || !userId) { alert('Not logged in.'); return; }

    if (!data || typeof data !== 'object' || !Array.isArray(data.nodes)) {
      alert('This file is not a valid IdeModel JSON (missing "nodes").');
      return;
    }
    if (data._spec?.format && data._spec.format !== 'idemodel.model.v1') {
      if (!confirm(`Unexpected format "${data._spec.format}". Import anyway?`)) return;
    }
    if (!confirm('Import will create a NEW model from this file. Continue?')) return;

    const warnings = [];
    const uuid = () => crypto.randomUUID();
    const ins = async (table, rows) => {
      if (!rows || !rows.length) return;
      const { error } = await sb.from(table).insert(rows);
      if (error) { console.error(`[sp] import ${table}:`, error); throw new Error(`${table}: ${error.message}`); }
    };

    try {
      const m = data.model || {};
      const today    = new Date().toISOString().slice(0, 10);
      const baseName = String(m.name || (fileName || 'Imported model').replace(/\.json$/i, '')).trim() || 'Imported model';

      // 1. models
      const { data: newModel, error: modelErr } = await sb.from('models').insert({
        name:             baseName,
        periods:          parseInt(m.periods) || 1,
        time_unit:        m.time_unit || 'month',
        starting_date:    m.starting_date || today,
        version:          m.version || '1',
        comments:         m.comments ?? null,
        background_color: m.background_color ?? null,
        last_review:      today,
        last_user:        userId
      }).select().single();
      if (modelErr || !newModel) throw modelErr || new Error('models insert failed');
      const modelId = newModel.id;

      // 2. model_users owner — ANTES del resto (las policies de INSERT exigen membresía)
      await ins('model_users', [{ model_id: modelId, user_id: userId, role: 'owner', viewed: true }]);

      // 3. units (id local → uuid)
      const unitMap = {};
      await ins('units', (data.units || []).map(u => {
        const id = uuid(); unitMap[u.id] = id;
        return { id, model_id: modelId, name: u.name ?? '', min_sz: u.min_sz ?? null,
                 max_sz: u.max_sz ?? null, min_value: u.min_value ?? null, max_value: u.max_value ?? null,
                 comment: u.comment ?? null, number_format: u.number_format || 'plain' };
      }));

      // 4. nodes (label → uuid). parent/unit se resuelven con los mapas ya armados.
      const nodeMap = {};
      (data.nodes || []).forEach(n => { if (n.label != null) nodeMap[n.label] = uuid(); });
      await ins('nodes', (data.nodes || []).filter(n => n.label != null).map(n => {
        if (n.parent && !nodeMap[n.parent]) warnings.push(`parent "${n.parent}" of "${n.label}" not found`);
        if (n.unit && !unitMap[n.unit])     warnings.push(`unit "${n.unit}" of "${n.label}" not found`);
        return {
          id: nodeMap[n.label], model_id: modelId, label: n.label,
          parent:  n.parent ? (nodeMap[n.parent] ?? null) : null,
          unit_id: n.unit ? (unitMap[n.unit] ?? null) : null,
          comment: n.comment ?? null,
          shape: n.shape || 'ellipse', color: n.color || '#8c8c8c',
          alpha: (n.alpha != null ? n.alpha : 0.5),
          size_px: n.size_px ?? 80, size_type: n.size_type || 'fixed',
          hidden: !!n.hidden, text_only: !!n.text_only,
          hide_when: n.hide_when ?? null,
          text_auto: n.text_auto !== false,
          text_label: n.text_label ?? null,
          text_value: n.text_value ?? null,
          text_unit:  n.text_unit  ?? null,
          x: n.x ?? 0, y: n.y ?? 0
        };
      }));

      // Nodes para serializar fórmulas {Label}[off] → node:<uuid>[off]
      const nodesForFormula = Object.keys(nodeMap).map(label => ({ id: nodeMap[label], label }));
      const toStored = (f) => {
        if (f == null || String(f).trim() === '') return '';
        if (!window.Formula) return String(f);
        return window.Formula.serialize(window.Formula.tokenize(String(f), nodesForFormula));
      };

      // 5. time_values
      await ins('time_values', (data.timeValues || [])
        .filter(tv => nodeMap[tv.node])
        .map(tv => ({ id: uuid(), model_id: modelId, node_id: nodeMap[tv.node],
                      period: parseInt(tv.period) || 1, formula: toStored(tv.formula) }))
        .filter(r => r.formula !== ''));

      // 6. groups
      const groupMap = {};
      await ins('groups', (data.groups || []).map(g => {
        const id = uuid(); groupMap[g.id] = id;
        return { id, model_id: modelId, name: g.name ?? '', color: g.color ?? null, comment: g.comment ?? null };
      }));

      // 7. node_groups
      await ins('node_groups', (data.nodeGroups || [])
        .filter(ng => nodeMap[ng.node] && groupMap[ng.group])
        .map(ng => ({ node_id: nodeMap[ng.node], group_id: groupMap[ng.group] })));

      // 8. concepts (la columna es `label`, no `name`)
      const conceptMap = {};
      await ins('concepts', (data.concepts || []).map(c => {
        const id = uuid(); conceptMap[c.id] = id;
        return { id, model_id: modelId, label: c.label ?? c.name ?? '', color: c.color ?? null, comment: c.comment ?? null };
      }));

      // 9. node_parent_concepts
      await ins('node_parent_concepts', (data.parentConcepts || [])
        .filter(pc => nodeMap[pc.node] && conceptMap[pc.concept])
        .map(pc => ({ node_id: nodeMap[pc.node], concept_id: conceptMap[pc.concept] })));

      // 10. links
      const linkMap = {};
      await ins('links', (data.links || [])
        .filter(l => nodeMap[l.source] && nodeMap[l.target])
        .map(l => { const id = uuid(); linkMap[l.id] = id;
          return { id, model_id: modelId, source_id: nodeMap[l.source], target_id: nodeMap[l.target], type: l.type || 'manual' }; }));

      // 11. link_concepts
      await ins('link_concepts', (data.linkConcepts || [])
        .filter(lc => linkMap[lc.link] && conceptMap[lc.concept])
        .map(lc => ({ link_id: linkMap[lc.link], concept_id: conceptMap[lc.concept] })));

      if (warnings.length) console.warn('[sp] import warnings:', warnings);

      // 12. Navegar al modelo nuevo
      const url = new URL(window.location.href);
      url.searchParams.set('m', modelId);
      url.searchParams.delete('focus');
      window.location.href = url.toString();

    } catch (err) {
      console.error('[sp] import failed:', err);
      alert('Import failed:\n' + (err?.message || err) + '\n\nThe new model may be incomplete. Check the console.');
    }
  }

  function buildLogoChips() {
    const model  = window.MODEL_DATA        || {};
    const author = window.MODEL_AUTHOR      || '—';
    const me     = window.CURRENT_USER_NAME || '—';

    const openChip = makeActionChip('Open', chip => openOpenPanel(chip));
    openChip.style.position = 'relative';
    _fetchAndSetOpenBadge(openChip);

    return [
      makeSectionLabel('File'),
      makeActionChip('New',    chip => handleNewModel(chip)),
      openChip,
      makeActionChip('Share',  chip => openSharePanel(chip)),
      makeActionChip('Export', chip => openExportPanel(chip)),
      makeActionChip('Import', () => _openImportPicker()),

      makeSectionLabel('Model'),
      makeVersionChip(model.version || '', v => saveModelField('version', v)),
      (() => { const c = makeDateChip('Started on', model.starting_date || '', v => saveModelField('starting_date', v)); c._panelKey = 'logo'; return c; })(),
      makeLastReviewChip(model.last_review || '', v => saveModelField('last_review', v), author, window.MODEL_AUTHOR_COLOR),
      makeInlineCommentsChip('Comments', model.comments || '', v => saveModelField('comments', v)),

      makeSectionLabel('Users'),
      makeReadonlyChip('Owner', author),
      makeMeChip(me, window.CURRENT_USER_COLOR),
    ];
  }

  window.openLogoPanel = function () {
    if (state.logo.open) return;
    state.logo.open = true;
    const btn = document.getElementById('logo-btn');
    const els = buildLogoChips();
    positionChips(els, btn, 'down-left');
    state.logo.chips = els;
  };

  window.closeLogoPanel = function () {
    state.logo.chips?.forEach(c => c._closeComments?.());
    state.logo.open = false;
    destroyChips('logo');
  };

  // -------------------------------------------------------
  // PERSISTENCIA
  // -------------------------------------------------------
  async function saveModelField(field, value) {
    const modelId = window.MODEL_ID;
    if (!modelId) return;
    try {
      const today  = new Date().toISOString().slice(0, 10);
      const userId = window.__USER_ID || null;
      const { error } = await window.supabaseClient
        .from('models')
        .update({ [field]: value, last_review: today, last_user: userId })
        .eq('id', modelId);
      if (error) throw error;
      if (!window.MODEL_DATA)    window.MODEL_DATA    = {};
      if (!window._currentModel) window._currentModel = {};
      window.MODEL_DATA[field]    = value;
      window._currentModel[field] = value;
      window.MODEL_DATA.last_review    = today;
      window._currentModel.last_review = today;
      window.MODEL_DATA.last_user      = userId;
      window._currentModel.last_user   = userId;
    } catch (err) { console.error('[sp] saveModelField:', err); }
  }
  window.saveModelField = saveModelField;   // expuesto para el agente de IA

  // -------------------------------------------------------
  // UNITS
  // -------------------------------------------------------
  function buildUnitsContent() {
    const wrap = document.createElement('div');
    wrap.className = 'sp-units-inner';
    wrap.id = 'units-subpanel-wrap';

    // Cabezal fijo
    const header = document.createElement('div');
    header.className = 'sp-units-header';
    header.innerHTML = '<span class=\"sp-units-col-name\">Name</span><span class=\"sp-units-col-px\">min</span><span class=\"sp-units-dash-hdr\">–</span><span class=\"sp-units-col-px\">max</span><span class=\"sp-units-col-fmt\">format</span><span class=\"sp-units-col-del\"></span>';
    wrap.appendChild(header);

    // Contenedor scrolleable para las filas
    const scrollEl = document.createElement('div');
    scrollEl.className = 'sp-units-scroll';
    scrollEl.id = 'units-scroll-list';
    wrap.appendChild(scrollEl);

    // Footer fijo con "+" circular
    const footer = document.createElement('div');
    footer.className = 'sp-units-footer';
    const addBtn = document.createElement('div');
    addBtn.className = 'sp-units-add-btn';
    addBtn.innerText = '+';
    addBtn.addEventListener('click', e => { e.stopPropagation(); handleAddUnitInline(wrap); });
    footer.appendChild(addBtn);
    wrap.appendChild(footer);

    renderUnitsCompact(wrap);
    return wrap;
  }

  function renderUnitsCompact(wrapEl) {
    const wrap = wrapEl || document.getElementById('units-subpanel-wrap');
    if (!wrap) return;

    const scrollEl = wrap.querySelector('.sp-units-scroll') || document.getElementById('units-scroll-list');
    if (!scrollEl) return;

    // Limpiar solo las filas dentro del scroll
    scrollEl.querySelectorAll('.sp-unit-row').forEach(el => el.remove());

    const units = window.UNITS_DATA || [];
    units.forEach(unit => scrollEl.appendChild(makeUnitRow(unit)));
  }

  function makeUnitRow(unit) {
    const row = document.createElement('div');
    row.className = 'sp-unit-row';

    // Name editable
    const name = document.createElement('span');
    name.className = 'sp-unit-name';
    name.contentEditable = true;
    name.spellcheck = false;
    name.innerText = unit.name;
    name.addEventListener('blur', () => {
      const v = name.innerText.trim();
      if (v && v !== unit.name) saveUnitField(unit.id, 'name', v);
    });
    name.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); name.blur(); } });

    // Separador
    const sep = document.createElement('span');
    sep.className = 'sp-unit-sep';
    sep.innerText = '·';

    // Min px editable
    const minEl = document.createElement('span');
    minEl.className = 'sp-unit-px';
    minEl.contentEditable = true;
    minEl.spellcheck = false;
    minEl.innerText = unit.min_sz;
    minEl.addEventListener('blur', () => {
      const v = parseFloat(minEl.innerText);
      if (!isNaN(v)) saveUnitField(unit.id, 'min_sz', v);
    });
    minEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); minEl.blur(); } });

    // Dash
    const dash = document.createElement('span');
    dash.className = 'sp-unit-dash';
    dash.innerText = '–';

    // Max px editable
    const maxEl = document.createElement('span');
    maxEl.className = 'sp-unit-px';
    maxEl.contentEditable = true;
    maxEl.spellcheck = false;
    maxEl.innerText = unit.max_sz;
    maxEl.addEventListener('blur', () => {
      const v = parseFloat(maxEl.innerText);
      if (!isNaN(v)) saveUnitField(unit.id, 'max_sz', v);
    });
    maxEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); maxEl.blur(); } });

    // Number format selector — muestra un ejemplo del formato elegido
    const fmtEl = document.createElement('span');
    fmtEl.className = 'sp-unit-fmt';
    fmtEl.title = 'Number format';
    fmtEl.innerText = window.formatNumber ? window.formatNumber(FMT_SAMPLE, unit.number_format || 'plain') : '';
    fmtEl.addEventListener('click', e => { e.stopPropagation(); openUnitFmtDropdown(fmtEl, unit); });

    // Delete
    const del = document.createElement('span');
    del.className = 'sp-unit-del';
    del.innerText = '✕';
    del.addEventListener('click', e => {
      e.stopPropagation();
      handleDeleteUnit(unit.id);
    });

    row.appendChild(name);
    row.appendChild(sep);
    row.appendChild(minEl);
    row.appendChild(dash);
    row.appendChild(maxEl);
    row.appendChild(fmtEl);
    row.appendChild(del);
    return row;
  }

  const FMT_SAMPLE = 1234.5;   // número de muestra para el preview del formato
  const FMT_OPTS = [
    ['plain',      'Plain'],
    ['integer',    'Integer'],
    ['decimal2',   '2 decimals'],
    ['accounting', 'Accounting'],
    ['percent',    'Percent'],
  ];

  function openUnitFmtDropdown(anchor, unit) {
    document.querySelectorAll('.sp-unit-fmt-dd').forEach(d => d.remove());
    const dd = document.createElement('div');
    dd.className = 'sp-unit-fmt-dd';
    const current = unit.number_format || 'plain';

    FMT_OPTS.forEach(([val, label]) => {
      const it = document.createElement('div');
      it.className = 'sp-unit-fmt-opt' + (val === current ? ' active' : '');
      const sample = window.formatNumber ? window.formatNumber(-1234.5, val) : '';
      it.innerHTML = `<span>${label}</span><span class="sp-unit-fmt-sample">${sample}</span>`;
      it.addEventListener('click', e => {
        e.stopPropagation();
        saveUnitField(unit.id, 'number_format', val);
        anchor.innerText = window.formatNumber ? window.formatNumber(FMT_SAMPLE, val) : '';
        window.refreshPeriod?.();
        window.refreshTimelinePanel?.();
        dd.remove();
      });
      dd.appendChild(it);
    });

    document.body.appendChild(dd);
    const r = anchor.getBoundingClientRect();
    const ddw = dd.offsetWidth, ddh = dd.offsetHeight;
    let left = Math.min(r.left, window.innerWidth  - ddw - 8);
    let top  = r.bottom + 4;
    if (top + ddh > window.innerHeight - 8) top = r.top - ddh - 4;   // crece hacia arriba si no entra
    dd.style.left = Math.max(8, left) + 'px';
    dd.style.top  = Math.max(8, top)  + 'px';

    const close = (ev) => {
      if (dd.contains(ev.target) || ev.target === anchor) return;
      dd.remove();
      document.removeEventListener('pointerdown', close, true);
    };
    setTimeout(() => document.addEventListener('pointerdown', close, true), 0);
  }

  async function handleAddUnitInline(wrap) {
    const modelId = window.MODEL_ID;
    if (!modelId) return;
    try {
      const { data, error } = await window.supabaseClient
        .from('units')
        .insert([{ model_id: modelId, name: 'unit', min_sz: 20, max_sz: 100,
          min_value: 0, max_value: 1000 }])
        .select().single();
      if (error) throw error;
      window.UNITS_DATA = window.UNITS_DATA || [];
      window.UNITS_DATA.push(data);
      renderUnitsCompact(wrap);
      // Focus en el nombre de la nueva unidad
      setTimeout(() => {
        const scrollEl = wrap.querySelector('.sp-units-scroll');
        const rows = (scrollEl || wrap).querySelectorAll('.sp-unit-row');
        const last = rows[rows.length - 1];
        last?.querySelector('.sp-unit-name')?.focus();
        if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
      }, 50);
    } catch (err) { console.error('[sp] handleAddUnitInline:', err); }
  }

  function buildBgImageContent() {
    const wrap = document.createElement('div');
    wrap.className = 'sp-subpanel-inner sp-bgimage-wrap';

    // Preview de imagen actual
    const preview = document.createElement('div');
    preview.className = 'sp-bgimage-preview';
    const modelUrl = window._currentModel?.background_image_url || '';
    if (modelUrl) {
      preview.style.backgroundImage = `url(${modelUrl})`;
      preview.classList.add('has-image');
    } else {
      preview.innerText = 'No image';
    }
    wrap.appendChild(preview);

    // Botón upload
    const uploadBtn = document.createElement('div');
    uploadBtn.className = 'sp-bgimage-btn';
    uploadBtn.innerText = 'Upload image';

    // Input file oculto
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';

    uploadBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;

      uploadBtn.innerText = 'Uploading…';
      uploadBtn.style.opacity = '0.6';

      try {
        const modelId = window.MODEL_ID;

        // Validar tamaño antes de subir (límite 2MB)
        if (file.size > 2 * 1024 * 1024) {
          uploadBtn.innerText = 'Max size: 2MB';
          uploadBtn.style.opacity = '1';
          setTimeout(() => { uploadBtn.innerText = 'Upload image'; }, 3000);
          return;
        }

        // Borrar todos los archivos previos de este modelo en el bucket
        const { data: existing } = await window.supabaseClient.storage
          .from('model-backgrounds')
          .list(modelId);
        if (existing?.length) {
          const toRemove = existing.map(f => `${modelId}/${f.name}`);
          await window.supabaseClient.storage
            .from('model-backgrounds')
            .remove(toRemove);
        }

        // Subir con nombre único (timestamp) — evita cualquier caché
        const ext  = file.name.split('.').pop() || 'jpg';
        const path = `${modelId}/background_${Date.now()}.${ext}`;

        const { error: upErr } = await window.supabaseClient.storage
          .from('model-backgrounds')
          .upload(path, file, { contentType: file.type });

        if (upErr) throw upErr;

        // Obtener URL pública
        const { data: urlData } = window.supabaseClient.storage
          .from('model-backgrounds')
          .getPublicUrl(path);

        const url = urlData.publicUrl;

        // Persistir en tabla models
        await saveModelField('background_image_url', url);

        // Aplicar al grafo
        _applyBgImage(url);

        // Actualizar preview
        preview.style.backgroundImage = `url(${url})`;
        preview.classList.add('has-image');
        preview.innerText = '';
        removeBtn.style.display = '';

        uploadBtn.innerText = 'Change image';
        uploadBtn.style.opacity = '1';

      } catch (err) {
        console.error('[sp] bg image upload:', err);
        uploadBtn.innerText = 'Error — retry';
        uploadBtn.style.opacity = '1';
      }
    });

    // Preset: blackboard (asset local servido por la app)
    const PRESETS = { blackboard: 'assets/blackboard.png' };
    const blackboardBtn = document.createElement('div');
    blackboardBtn.className = 'sp-bgimage-btn';
    blackboardBtn.innerText = 'Blackboard';
    blackboardBtn.addEventListener('click', async () => {
      const url = PRESETS.blackboard;
      await saveModelField('background_image_url', url);
      _applyBgImage(url);
      preview.style.backgroundImage = `url(${url})`;
      preview.classList.add('has-image');
      preview.innerText = '';
      removeBtn.style.display = '';
      uploadBtn.innerText = 'Change image';
    });

    // Botón quitar imagen
    const removeBtn = document.createElement('div');
    removeBtn.className = 'sp-bgimage-btn sp-bgimage-remove';
    removeBtn.innerText = 'Remove';
    removeBtn.addEventListener('click', async () => {
      const modelId = window.MODEL_ID;
      const curUrl  = window._currentModel?.background_image_url || '';
      // Solo borrar del bucket si era una imagen subida (no un preset local)
      if (curUrl && !Object.values(PRESETS).includes(curUrl)) {
        const { data: existing } = await window.supabaseClient.storage
          .from('model-backgrounds')
          .list(modelId);
        if (existing?.length) {
          const toRemove = existing.map(f => `${modelId}/${f.name}`);
          await window.supabaseClient.storage
            .from('model-backgrounds')
            .remove(toRemove);
        }
      }
      // Limpiar en BD y UI
      await saveModelField('background_image_url', null);
      _applyBgImage(null);
      preview.style.backgroundImage = '';
      preview.classList.remove('has-image');
      preview.innerText = 'No image';
      uploadBtn.innerText = 'Upload image';
      removeBtn.style.display = 'none';
    });

    wrap.appendChild(uploadBtn);
    wrap.appendChild(blackboardBtn);
    wrap.appendChild(fileInput);
    wrap.appendChild(removeBtn);
    if (!modelUrl) removeBtn.style.display = 'none';

    return wrap;
  }

  function _applyBgImage(url) {
    const graph = document.getElementById('graph');
    if (!graph) return;
    if (url) {
      const baseUrl  = url.split('?')[0];
      const freshUrl = `${baseUrl}?t=${Date.now()}`;
      graph.style.backgroundImage    = `url(${freshUrl})`;
      graph.style.backgroundSize     = 'cover';
      graph.style.backgroundPosition = 'center';
    } else {
      graph.style.backgroundImage = '';
      if (window._currentModel) window._currentModel.background_image_url = '';
    }
    window.updateTopUIContrast?.({ hasImage: !!url });
  }

  // Quita la imagen de fondo (storage + DB + grafo). Reutilizable desde el panel de
  // Background (al elegir un color → either/or) y desde el botón Remove de la imagen.
  async function _removeBgImage() {
    const modelId = window.MODEL_ID;
    const curUrl  = window._currentModel?.background_image_url || '';
    const PRESETS = { blackboard: 'assets/blackboard.png' };
    try {
      if (modelId && curUrl && !Object.values(PRESETS).includes(curUrl)) {
        const { data: existing } = await window.supabaseClient.storage
          .from('model-backgrounds').list(modelId);
        if (existing?.length) {
          await window.supabaseClient.storage.from('model-backgrounds')
            .remove(existing.map(f => `${modelId}/${f.name}`));
        }
      }
    } catch (e) { console.error('[sp] _removeBgImage storage:', e); }
    await saveModelField('background_image_url', null);
    _applyBgImage(null);
  }

  // Panel unificado de Background: pestañas Color | Image (either/or).
  function buildBackgroundContent() {
    const wrap = document.createElement('div');
    wrap.className = 'sp-subpanel-inner sp-bg-wrap';

    // Segmented Color | Image
    const seg = document.createElement('div');
    seg.className = 'sp-bg-seg';
    const colorTab = document.createElement('div'); colorTab.className = 'sp-bg-tab'; colorTab.innerText = 'Color';
    const imageTab = document.createElement('div'); imageTab.className = 'sp-bg-tab'; imageTab.innerText = 'Image';
    seg.append(colorTab, imageTab);

    const body = document.createElement('div');
    body.className = 'sp-bg-body';

    // --- Color ---
    const colorPane = document.createElement('div');
    colorPane.className = 'sp-bg-pane';
    const swatchRow = document.createElement('div');
    swatchRow.className = 'sp-bg-swatch-row';
    const swatch = document.createElement('div');
    swatch.className = 'sp-bg-swatch';
    let curColor = window.MODEL_DATA?.background_color || '#ffffff';
    swatch.style.background = curColor;
    const swatchLbl = document.createElement('div');
    swatchLbl.className = 'sp-bg-swatch-lbl';
    swatchLbl.innerText = 'Pick color';
    swatchRow.append(swatch, swatchLbl);
    colorPane.append(swatchRow);

    swatchRow.addEventListener('click', e => {
      e.stopPropagation();
      window.openColorPicker({
        anchorEl: swatch,
        color: curColor,
        hasAlpha: false,
        onChange: async (c) => {
          curColor = c;
          swatch.style.background = c;
          _applyBgColor(c);
          await saveModelField('background_color', c);
          // either/or: elegir un color descarta la imagen de fondo
          if (window._currentModel?.background_image_url) await _removeBgImage();
        }
      });
    });

    // --- Image (se reconstruye al entrar a la pestaña para no quedar desfasado) ---
    const imagePane = document.createElement('div');
    imagePane.className = 'sp-bg-pane';
    function renderImagePane() { imagePane.innerHTML = ''; imagePane.appendChild(buildBgImageContent()); }

    body.append(colorPane, imagePane);
    wrap.append(seg, body);

    function selectTab(which) {
      const isColor = which === 'color';
      colorTab.classList.toggle('active', isColor);
      imageTab.classList.toggle('active', !isColor);
      colorPane.style.display = isColor ? '' : 'none';
      imagePane.style.display = isColor ? 'none' : '';
      if (!isColor) renderImagePane();
    }
    colorTab.addEventListener('click', e => { e.stopPropagation(); selectTab('color'); });
    imageTab.addEventListener('click', e => { e.stopPropagation(); selectTab('image'); });

    // Pestaña inicial: imagen si hay una, si no color
    selectTab(window._currentModel?.background_image_url ? 'image' : 'color');

    return wrap;
  }

  function renderUnitsList(listEl) {
    const list = listEl || document.getElementById('units-list');
    if (!list) return;
    list.innerHTML = '';
    const units = window.UNITS_DATA || [];
    if (units.length === 0) {
      list.innerHTML = `<div class="unit-empty">No units defined yet</div>`;
      return;
    }
    units.forEach(unit => {
      const row = document.createElement('div');
      row.className = 'unit-row';
      row.innerHTML = `
        <div class="unit-row-name">${unit.name}</div>
        <div class="unit-row-range">${unit.min_sz}–${unit.max_sz} px</div>
        <div class="unit-row-delete" data-id="${unit.id}">✕</div>
      `;
      row.querySelector('.unit-row-delete').addEventListener('click', e => {
        e.stopPropagation();
        handleDeleteUnit(unit.id);
      });
      list.appendChild(row);
    });
  }

  async function saveUnitField(unitId, field, value) {
    try {
      const { data, error } = await window.supabaseClient
        .from('units').update({ [field]: value }).eq('id', unitId).select();
      if (error) throw error;
      if (!data || data.length === 0) {
        console.warn('[sp] saveUnitField: 0 filas actualizadas — probablemente falta la RLS policy/GRANT de UPDATE en la tabla units', { unitId, field, value });
      }
      const u = (window.UNITS_DATA || []).find(u => u.id === unitId);
      if (u) u[field] = value;
    } catch (err) { console.error('[sp] saveUnitField:', err); }
  }

  async function handleDeleteUnit(unitId) {
    try {
      const { error } = await window.supabaseClient
        .from('units').delete().eq('id', unitId);
      if (error) throw error;
      window.UNITS_DATA = (window.UNITS_DATA || []).filter(u => u.id !== unitId);
      renderUnitsCompact();
    } catch (err) { console.error('[sp] handleDeleteUnit:', err); }
  }

  // -------------------------------------------------------
  // OPEN UNITS PANEL (llamable desde fuera, e.g. node label)
  // -------------------------------------------------------
  window.openUnitsPanel = function () {
    if (!state.settings.open) {
      window.openSettingsPanel();
    }
    requestAnimationFrame(() => {
      const unitsChip = state.settings.chips.find(c => c._isUnitsChip);
      if (unitsChip) openSubpanel('settings', unitsChip, buildUnitsContent(), false);
    });
  };

  // -------------------------------------------------------
  // CLICK FUERA
  // -------------------------------------------------------
  document.addEventListener('pointerdown', e => {
    ['settings','time','logo'].forEach(key => {
      if (!state[key].open) return;
      const btnIds = { settings: 'settings-btn', time: 'time-circle', logo: 'logo-btn' };
      const inBtn   = document.getElementById(btnIds[key])?.contains(e.target);
      const inChips = state[key].chips.some(c => c.contains(e.target));
      const inSub   = state[key].subpanel?.contains(e.target);
      const inDrop  = e.target.closest('.shape-dropdown, .color-dropdown, .sp-unit-fmt-dd, .color-picker-popup');
      if (!inBtn && !inChips && !inSub && !inDrop) {
        if (key === 'settings') closeSettingsPanel();
        if (key === 'time')     closeTimePanel();
        if (key === 'logo')     closeLogoPanel();
      } else if (!inSub && !inDrop) {
        closeSubpanel(key);
      }
    });
  });

  // -------------------------------------------------------
  // HOOKS
  // -------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('settings-btn')?.addEventListener('click', () =>
      state.settings.open ? closeSettingsPanel() : openSettingsPanel()
    );
    document.getElementById('time-circle')?.addEventListener('click', () =>
      state.time.open ? closeTimePanel() : openTimePanel()
    );
    document.getElementById('logo-btn')?.addEventListener('click', () =>
      state.logo.open ? closeLogoPanel() : openLogoPanel()
    );

    document.getElementById('time-slider')?.addEventListener('input', e => {
      _setActivePeriod(parseInt(e.target.value));
    });

    document.getElementById('time-nav')?.addEventListener('click', e => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (!action) return;
      _setActivePeriod((window.CURRENT_PERIOD || 1) + (action === 'next' ? 1 : -1));
    });

    _initSearchPanel();
    _initUndoBadge();
  });

  // -------------------------------------------------------
  // ↺ UNDO — badge sobre add-node-btn
  // -------------------------------------------------------
  function _initUndoBadge() {
    const addBtn = document.getElementById('add-node-btn');
    if (!addBtn) return;
    const badge = document.createElement('div');
    badge.id = 'undo-badge';
    Object.assign(badge.style, {
      position: 'absolute', top: '-5px', right: '-5px',
      width: '30px', height: '30px', borderRadius: '15px',
      background: '#272727', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: '20',
    });
    badge.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px;display:block">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/>
    </svg>`;
    badge.addEventListener('click', e => { e.stopPropagation(); window.performUndo?.(); });
    badge.addEventListener('mouseenter', () => {
      badge.style.background = '#3d3d3d';
      addBtn.style.background = 'var(--ui-bg)';
      addBtn.style.transform = 'none';
    });
    badge.addEventListener('mouseleave', () => {
      badge.style.background = '#272727';
      addBtn.style.background = '';
      addBtn.style.transform = '';
    });
    addBtn.appendChild(badge);
  }

  // -------------------------------------------------------
  // 🔍 SEARCH — badge sobre settings-btn + popup
  // -------------------------------------------------------
  function _initSearchPanel() {
    const settingsBtn = document.getElementById('settings-btn');
    if (!settingsBtn) return;

    // Badge (mismo estilo que #time-badge)
    const badge = document.createElement('div');
    badge.id = 'search-badge';
    Object.assign(badge.style, {
      position: 'absolute', top: '-5px', right: '-5px',
      width: '30px', height: '30px', borderRadius: '15px',
      background: '#272727', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: '20',
    });
    badge.innerHTML = `<svg viewBox="0 0 20 20" fill="none" style="width:14px;height:14px;display:block">
      <circle cx="8.5" cy="8.5" r="5.5" stroke="white" stroke-width="1.8"/>
      <line x1="12.5" y1="12.5" x2="17" y2="17" stroke="white" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`;
    settingsBtn.appendChild(badge);

    // Popup de búsqueda
    const popup = document.createElement('div');
    Object.assign(popup.style, {
      position: 'fixed', display: 'none', flexDirection: 'column',
      background: 'rgba(30,30,36,0.95)', backdropFilter: 'blur(8px)',
      borderRadius: '14px', padding: '8px 0',
      zIndex: '9001', boxShadow: '0 4px 20px rgba(0,0,0,0.45)',
      minWidth: '200px',
    });

    // Input row
    const inputRow = document.createElement('div');
    Object.assign(inputRow.style, {
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '0 10px 6px', borderBottom: '1px solid rgba(255,255,255,0.08)',
    });
    const lupita = document.createElement('span');
    lupita.innerHTML = `<svg viewBox="0 0 20 20" fill="none" style="width:12px;height:12px;display:block">
      <circle cx="8.5" cy="8.5" r="5.5" stroke="rgba(255,255,255,0.5)" stroke-width="1.8"/>
      <line x1="12.5" y1="12.5" x2="17" y2="17" stroke="rgba(255,255,255,0.5)" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`;
    const input = document.createElement('input');
    input.type = 'text'; input.placeholder = 'Search node…';
    Object.assign(input.style, {
      background: 'transparent', border: 'none', outline: 'none',
      color: 'rgba(255,255,255,0.9)', fontSize: '11px', fontFamily: 'inherit',
      flex: '1', padding: '0',
    });
    inputRow.appendChild(lupita);
    inputRow.appendChild(input);
    popup.appendChild(inputRow);

    // Lista de resultados
    const list = document.createElement('div');
    Object.assign(list.style, { maxHeight: '200px', overflowY: 'auto' });
    popup.appendChild(list);
    document.body.appendChild(popup);

    let _open = false;

    function _populateList(filter) {
      list.innerHTML = '';
      const nodes = (window.NODES_DATA || [])
        .filter(n => !filter || (n.label || '').toLowerCase().includes(filter.toLowerCase()))
        .slice(0, 40);
      if (!nodes.length) {
        const empty = document.createElement('div');
        empty.textContent = 'No results';
        Object.assign(empty.style, { padding: '8px 12px', fontSize: '10px', color: 'rgba(255,255,255,0.35)' });
        list.appendChild(empty);
        return;
      }
      nodes.forEach(n => {
        const item = document.createElement('div');
        item.textContent = n.label || n.id;
        Object.assign(item.style, {
          padding: '6px 12px', fontSize: '11px', cursor: 'pointer',
          color: 'rgba(255,255,255,0.82)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        });
        item.addEventListener('mouseenter', () => item.style.background = 'rgba(255,255,255,0.08)');
        item.addEventListener('mouseleave', () => item.style.background = '');
        item.addEventListener('mousedown', e => {
          e.preventDefault();
          window.centerNodeById?.(n.id);
          _close();
        });
        list.appendChild(item);
      });
    }

    function _open_panel() {
      if (_open) return;
      _open = true;
      const r = settingsBtn.getBoundingClientRect();
      popup.style.display = 'flex';
      popup.style.left   = (r.right + 8) + 'px';
      popup.style.top    = 'auto';
      popup.style.bottom = (window.innerHeight - r.bottom) + 'px';
      _populateList('');
      setTimeout(() => input.focus(), 30);
    }

    function _close() {
      if (!_open) return;
      _open = false;
      popup.style.display = 'none';
      input.value = '';
    }

    badge.addEventListener('click', e => {
      e.stopPropagation();
      _open ? _close() : _open_panel();
    });
    badge.addEventListener('mouseenter', () => {
      badge.style.background = '#3d3d3d';
      settingsBtn.style.background = 'var(--ui-bg)';
      settingsBtn.style.transform = 'none';
    });
    badge.addEventListener('mouseleave', () => {
      badge.style.background = '#272727';
      settingsBtn.style.background = '';
      settingsBtn.style.transform = '';
    });
    input.addEventListener('input', () => _populateList(input.value));
    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') _close();
      e.stopPropagation();
    });
    document.addEventListener('pointerdown', e => {
      if (!popup.contains(e.target) && !badge.contains(e.target)) _close();
    });
  }

})();