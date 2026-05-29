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

  // VIEW LEVEL — texto simple − N +
  function makeViewLevelChip(initial) {
    let level = initial ?? 0;
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
    minus.addEventListener('click', e => { e.stopPropagation(); if (level > 0) { level--; num.innerText = level; } });
    plus.addEventListener('click',  e => { e.stopPropagation(); level++; num.innerText = level; });
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

      console.log('[comments] r:', r.top, r.right, r.bottom, 'pw:', pw, 'innerW:', window.innerWidth, 'innerH:', window.innerHeight, 'ph:', ph);

      // Horizontal: derecha si cabe, izquierda si no
      if (r.right + pw + margin < window.innerWidth) {
        _panel.style.left  = (r.right + 8) + 'px';
        _panel.style.right = 'auto';
        console.log('[comments] → derecha, left:', r.right + 8);
      } else {
        _panel.style.left  = (r.left - pw - 8) + 'px';
        _panel.style.right = 'auto';
        console.log('[comments] → izquierda, left:', r.left - pw - 8);
      }
      // Vertical: top del chip, clampeado al margen inferior
      const maxTop = window.innerHeight - ph - margin;
      _panel.style.top = Math.max(margin, Math.min(r.top, maxTop)) + 'px';
      console.log('[comments] top:', Math.max(margin, Math.min(r.top, maxTop)), 'maxTop:', maxTop);

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

  // COLOR chip (sin alpha)
  function makeBgColorChip(label, color) {
    const chip = createColorChip(color, 1);
    if (chip.alphaEl) chip.alphaEl.style.display = 'none';
    const lbl = chip.querySelector('.ui-chip-label');
    if (lbl) lbl.innerText = label;

    // Paleta de colores
    const COLORS = [
      '#ffffff', '#f0ede8', '#e8e0d4', '#d4c5b0',
      '#57789b', '#d16b6b', '#6f9d6d', '#b08ccc',
      '#d3a25f', '#5f8f95', '#8c8c8c', '#3f3f3f'
    ];

    // Dropdown de paleta
    const dropdown = document.createElement('div');
    dropdown.className = 'color-dropdown hidden';
    dropdown.style.position = 'fixed';
    dropdown.style.zIndex   = '7000';

    COLORS.forEach(c => {
      const sw = document.createElement('div');
      sw.className = 'color-option';
      sw.style.background = c;
      sw.addEventListener('click', e => {
        e.stopPropagation();
        // Actualizar swatch
        chip.currentColor = c;
        chip.swatch.style.background = c;
        // Aplicar al fondo de Cytoscape
        _applyBgColor(c);
        // Persistir
        saveModelField('background_color', c);
        dropdown.classList.add('hidden');
        _dimSiblingChips(chip, false, state.settings?.chips);
      });
      dropdown.appendChild(sw);
    });

    document.body.appendChild(dropdown);
    chip._dropdown = dropdown;

    // Abrir al clickear el chip
    chip.addEventListener('click', e => {
      e.stopPropagation();
      const hidden = dropdown.classList.contains('hidden');
      if (hidden) {
        if (_anySubpanelOpen('settings')) return;
        const r = chip.getBoundingClientRect();
        dropdown.style.left = (r.right + 8) + 'px';
        dropdown.style.top  = r.top + 'px';
        dropdown.classList.remove('hidden');
        _dimSiblingChips(chip, true, state.settings?.chips);
      } else {
        dropdown.classList.add('hidden');
        _dimSiblingChips(chip, false, state.settings?.chips);
      }
    });

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
          last_review:      today
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

  // -------------------------------------------------------
  // ⚙ SETTINGS
  // -------------------------------------------------------
  function buildSettingsChips() {
    const model = window.MODEL_DATA || {};
    return [
      // VIEW
      makeToggleChip('Show hidden',  false, v => console.log('hidden', v)),
      makeConceptsChip('none', v => console.log('concepts', v)),
      makeViewLevelChip(0),
      makeToggleChip('Formula link', true,  v => console.log('formula', v)),
      makeToggleChip('Concept link', true,  v => console.log('concept', v)),
      makeToggleChip('Parent link',  true,  v => console.log('parent', v)),
      makeSectionLabel('View'),

      // STYLE
      makeSubpanelChip('Background image', chip => openSubpanel('settings', chip, buildBgImageContent())),
      makeBgColorChip('Background color', model.background_color || '#ffffff'),
      makeSectionLabel('Style'),

      // UNITS — al final = queda en la parte superior del panel (apilado hacia arriba)
      (() => { const c = makeSubpanelChip('Units', chip => openSubpanel('settings', chip, buildUnitsContent(), false)); c._isUnitsChip = true; return c; })(),
      makeSectionLabel('Units'),
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
  // ⏱ TIME
  // -------------------------------------------------------
  function buildTimeChips() {
    const model = window.MODEL_DATA || {};
    return [
      (() => { const c = makeDateChip('Starting date', model.starting_date || '', v => saveModelField('starting_date', v)); c._panelKey = 'time'; return c; })(),
      makeTimeUnitChip(model.time_unit || '', v => saveModelField('time_unit', v)),
      makeEditableChip('Periods', model.periods ?? '', v => saveModelField('periods', parseInt(v)||null), true),
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

      // 4. Copiar nodes → mapa id viejo → id nuevo
      const { data: nodes } = await window.supabaseClient
        .from('nodes').select('*').eq('model_id', modelId);
      const nodeIdMap = {};
      if (nodes?.length) {
        const newNodes = nodes.map(n => {
          const nid = crypto.randomUUID();
          nodeIdMap[n.id] = nid;
          return { ...n, id: nid, model_id: newModel.id,
                   unit_id: n.unit_id ? (unitIdMap[n.unit_id] ?? null) : null };
        });
        const { error } = await window.supabaseClient.from('nodes').insert(newNodes);
        if (error) throw error;
      }

      // 5. Copiar time_values
      const { data: values } = await window.supabaseClient
        .from('time_values').select('*').eq('model_id', modelId);
      if (values?.length) {
        const newValues = values
          .filter(v => nodeIdMap[v.node_id])
          .map(v => ({ ...v, id: crypto.randomUUID(),
                       model_id: newModel.id, node_id: nodeIdMap[v.node_id] }));
        if (newValues.length) {
          const { error } = await window.supabaseClient.from('time_values').insert(newValues);
          if (error) throw error;
        }
      }

      // 6. Copiar links (remapear source/target)
      const { data: links } = await window.supabaseClient
        .from('links').select('*').eq('model_id', modelId);
      if (links?.length) {
        const newLinks = links
          .filter(l => nodeIdMap[l.source] && nodeIdMap[l.target])
          .map(l => ({ ...l, id: crypto.randomUUID(),
                       model_id: newModel.id,
                       source: nodeIdMap[l.source],
                       target: nodeIdMap[l.target] }));
        if (newLinks.length) {
          const { error } = await window.supabaseClient.from('links').insert(newLinks);
          if (error) throw error;
        }
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
        _openDeleteModelConfirm(m.id, delEl, () => {
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

  function _openDeleteModelConfirm(modelId, anchorEl, onDeleted, isOwner = true) {
    document.getElementById('model-delete-confirm')?.remove();

    const modal = document.createElement('div');
    modal.id        = 'model-delete-confirm';
    modal.className = 'shape-dropdown';
    modal.style.cssText = 'position:fixed;z-index:999999;padding:10px 12px;display:flex;flex-direction:column;gap:10px;min-width:0;';

    const text = document.createElement('div');
    text.style.cssText = 'font-size:12px;color:rgba(255,255,255,0.85);font-weight:500;white-space:nowrap';
    text.innerText = isOwner ? 'Delete model?' : 'Leave model?';

    const btns = document.createElement('div');
    btns.style.cssText = 'display:flex;gap:6px;justify-content:flex-end';

    const yes = document.createElement('div');
    yes.className = 'shape-option';
    yes.innerText = 'yes';
    yes.style.cssText = 'color:#ef4444;font-weight:600;cursor:pointer';
    yes.addEventListener('click', async e => {
      e.stopPropagation();
      modal.remove();
      if (isOwner) {
        await _hardDeleteModel(modelId);
      } else {
        await _leaveModel(modelId);
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
    const { data: linkRows } = await sb.from('links').select('id').eq('model_id', modelId);
    const linkIds = (linkRows || []).map(r => r.id);
    if (linkIds.length > 0) await sb.from('link_concepts').delete().in('link_id', linkIds);
    await sb.from('links').delete().eq('model_id', modelId);
    await sb.from('time_values').delete().eq('model_id', modelId);
    await sb.from('nodes').delete().eq('model_id', modelId);
    await sb.from('units').delete().eq('model_id', modelId);
    await sb.from('groups').delete().eq('model_id', modelId);
    await sb.from('concepts').delete().eq('model_id', modelId);
    await sb.from('model_users').delete().eq('model_id', modelId);
    await sb.from('models').delete().eq('id', modelId);
    console.log('[sp] model deleted:', modelId);
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
      console.log('[share] users fetched:', usersRows);
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
      makeActionChip('Export', () => console.log('export')),

      makeSectionLabel('Model'),
      makeVersionChip(model.version || '', v => saveModelField('version', v)),
      (() => { const c = makeDateChip('Started on', model.starting_date || '', v => saveModelField('starting_date', v)); c._panelKey = 'logo'; return c; })(),
      makeInlineCommentsChip('Comments', model.comments || '', v => saveModelField('comments', v)),

      makeSectionLabel('Users'),
      makeReadonlyChip('Owner', author),
      makeLastReviewChip(model.last_review || '', v => saveModelField('last_review', v), author, window.MODEL_AUTHOR_COLOR),
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
    header.innerHTML = '<span class=\"sp-units-col-name\">Name</span><span class=\"sp-units-col-px\">min</span><span class=\"sp-units-dash-hdr\">–</span><span class=\"sp-units-col-px\">max</span><span class=\"sp-units-col-del\"></span>';
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
    row.appendChild(del);
    return row;
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

        uploadBtn.innerText = 'Change image';
        uploadBtn.style.opacity = '1';

      } catch (err) {
        console.error('[sp] bg image upload:', err);
        uploadBtn.innerText = 'Error — retry';
        uploadBtn.style.opacity = '1';
      }
    });

    // Botón quitar imagen
    const removeBtn = document.createElement('div');
    removeBtn.className = 'sp-bgimage-btn sp-bgimage-remove';
    removeBtn.innerText = 'Remove';
    removeBtn.addEventListener('click', async () => {
      const modelId = window.MODEL_ID;
      // Borrar todos los archivos del modelo en el bucket
      const { data: existing } = await window.supabaseClient.storage
        .from('model-backgrounds')
        .list(modelId);
      if (existing?.length) {
        const toRemove = existing.map(f => `${modelId}/${f.name}`);
        await window.supabaseClient.storage
          .from('model-backgrounds')
          .remove(toRemove);
      }
      // Limpiar en BD y UI
      await saveModelField('background_image_url', null);
      _applyBgImage(null);
      preview.style.backgroundImage = '';
      preview.classList.remove('has-image');
      preview.innerText = 'No image';
      removeBtn.remove();
    });

    wrap.appendChild(uploadBtn);
    wrap.appendChild(fileInput);
    if (modelUrl) wrap.appendChild(removeBtn);

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
      const { error } = await window.supabaseClient
        .from('units').update({ [field]: value }).eq('id', unitId);
      if (error) throw error;
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
      const inDrop  = e.target.closest('.shape-dropdown, .color-dropdown');
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
  });

})();