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

  const GAP = 8;
  const GAP_BTN    = 20;  // entre botón y primer chip

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
    // Aplicar via CSS variable (que es lo que usa #graph)
    document.documentElement.style.setProperty('--bg-graph', color);
    // Y también inline por si acaso
    const graph = document.getElementById('graph');
    if (graph) graph.style.background = color;
    const wrapper = document.getElementById('graph-wrapper');
    if (wrapper) wrapper.style.background = color;
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
    chip.addEventListener('click', e => { e.stopPropagation(); if (onClick) onClick(); });
    return chip;
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
    const options = ['none', 'active node', 'all'];
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
      makeSubpanelChip('Units', chip => openSubpanel('settings', chip, buildUnitsContent(), false)),
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
  // 💡 LOGO
  // -------------------------------------------------------
  function buildLogoChips() {
    const model  = window.MODEL_DATA   || {};
    const author = window.MODEL_AUTHOR || '—';
    return [
      makeSectionLabel('File'),
      makeActionChip('New',    () => console.log('new')),
      makeActionChip('Open',   () => console.log('open')),
      makeActionChip('Close',  () => console.log('close')),
      makeActionChip('Share',  () => console.log('share')),
      makeActionChip('Export', () => console.log('export')),

      makeSectionLabel('Model'),
      makeReadonlyChip('Author',      author),
      makeEditableChip('Version',     model.version       || '', v => saveModelField('version', v)),
      (() => { const c = makeDateChip('Started on',    model.starting_date || '', v => saveModelField('starting_date', v)); c._panelKey = 'logo'; return c; })(),
      (() => { const c = makeDateChip('Last review',   model.updated_at ? model.updated_at.slice(0,10) : '', v => saveModelField('updated_at', v)); c._panelKey = 'logo'; return c; })(),
      (() => { const c = makeCommentsChip('Comments', model.comments || '', v => saveModelField('comments', v)); c._panelKey = 'logo'; return c; })(),
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
      const { error } = await window.supabaseClient
        .from('models').update({ [field]: value }).eq('id', modelId);
      if (error) throw error;
      if (!window.MODEL_DATA) window.MODEL_DATA = {};
      window.MODEL_DATA[field] = value;
      // Mantener _currentModel sincronizado
      if (!window._currentModel) window._currentModel = {};
      window._currentModel[field] = value;
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
      // Quitar ?t= previo si existe, agregar uno fresco para evitar caché
      const baseUrl = url.split('?')[0];
      const freshUrl = `${baseUrl}?t=${Date.now()}`;
      graph.style.backgroundImage = `url(${freshUrl})`;
      graph.style.backgroundSize  = 'cover';
      graph.style.backgroundPosition = 'center';
    } else {
      graph.style.backgroundImage = '';
    }
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