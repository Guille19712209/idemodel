// =========================
// SETTINGS PANEL
// =========================

(function () {

  // -------------------------------------------------------
  // Estado global de units (se llena desde ui.js al cargar)
  // -------------------------------------------------------
  window.UNITS_DATA = window.UNITS_DATA || [];

  // -------------------------------------------------------
  // Crear el panel en el DOM
  // -------------------------------------------------------
  function createPanel() {

    const panel = document.createElement('div');
    panel.id = 'settings-panel';
    panel.innerHTML = `
      <div class="settings-header">
        <span class="settings-title">Model Settings</span>
        <div class="settings-close" id="settings-panel-close">✕</div>
      </div>
      <div class="settings-body" id="settings-body">
        <!-- Sección Units -->
        <div class="settings-section expanded" id="settings-section-units">
          <div class="settings-section-header">
            <span class="settings-section-label">Units</span>
            <span class="settings-section-arrow">▼</span>
          </div>
          <div class="settings-section-body">
            <div class="units-list" id="units-list"></div>
            <div class="unit-add-form" id="unit-add-form">
              <input id="unit-input-name"   placeholder="Name  (e.g. kg, $, m²)" />
              <div class="unit-add-row">
                <input id="unit-input-min-sz"   type="number" placeholder="Min px"   min="10" />
                <input id="unit-input-max-sz"   type="number" placeholder="Max px"   min="10" />
              </div>
              <div class="unit-add-row">
                <input id="unit-input-min-val"  type="number" placeholder="Min value" />
                <input id="unit-input-max-val"  type="number" placeholder="Max value" />
              </div>
              <div class="unit-add-btn" id="unit-add-btn">+ Add unit</div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    // Close
    panel.querySelector('#settings-panel-close')
      .addEventListener('click', closeSettingsPanel);

    // Cerrar al hacer click fuera
    document.addEventListener('pointerdown', (e) => {
      if (!panel.classList.contains('open')) return;
      const btn = document.getElementById('settings-btn');
      if (panel.contains(e.target)) return;
      if (btn && btn.contains(e.target)) return;
      closeSettingsPanel();
    });

    // Toggle secciones
    panel.querySelectorAll('.settings-section-header')
      .forEach(header => {
        header.addEventListener('click', () => {
          const section = header.closest('.settings-section');
          section.classList.toggle('expanded');
        });
      });

    // Add unit
    panel.querySelector('#unit-add-btn')
      .addEventListener('click', handleAddUnit);

    return panel;
  }

  // -------------------------------------------------------
  // Render lista de units
  // -------------------------------------------------------
  function renderUnitsList() {
    const list = document.getElementById('units-list');
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
      row.dataset.id = unit.id;

      row.innerHTML = `
        <div class="unit-row-name">${unit.name}</div>
        <div class="unit-row-range">
          ${unit.min_sz}–${unit.max_sz} px
        </div>
        <div class="unit-row-delete" data-id="${unit.id}">✕</div>
      `;

      row.querySelector('.unit-row-delete')
        .addEventListener('click', (e) => {
          e.stopPropagation();
          handleDeleteUnit(unit.id);
        });

      list.appendChild(row);
    });
  }

  // -------------------------------------------------------
  // Add unit → Supabase
  // -------------------------------------------------------
  async function handleAddUnit() {

    const name   = document.getElementById('unit-input-name').value.trim();
    const minSz  = parseFloat(document.getElementById('unit-input-min-sz').value);
    const maxSz  = parseFloat(document.getElementById('unit-input-max-sz').value);
    const minVal = parseFloat(document.getElementById('unit-input-min-val').value);
    const maxVal = parseFloat(document.getElementById('unit-input-max-val').value);

    if (!name) return;
    if (isNaN(minSz) || isNaN(maxSz)) return;

    const modelId = window.MODEL_ID;
    if (!modelId) {
      console.warn('[settings-panel] MODEL_ID not available');
      return;
    }

    try {
      const { data, error } = await window.supabaseClient
        .from('units')
        .insert([{
          model_id:  modelId,
          name:      name,
          min_sz:    minSz,
          max_sz:    maxSz,
          min_value: isNaN(minVal) ? 0 : minVal,
          max_value: isNaN(maxVal) ? 0 : maxVal,
        }])
        .select()
        .single();

      if (error) throw error;

      // Actualizar estado local
      window.UNITS_DATA.push(data);
      renderUnitsList();
      clearAddForm();

    } catch (err) {
      console.error('[settings-panel] Error adding unit:', err);
    }
  }

  // -------------------------------------------------------
  // Delete unit → Supabase
  // -------------------------------------------------------
  async function handleDeleteUnit(unitId) {

    try {
      const { error } = await window.supabaseClient
        .from('units')
        .delete()
        .eq('id', unitId);

      if (error) throw error;

      window.UNITS_DATA = window.UNITS_DATA.filter(u => u.id !== unitId);
      renderUnitsList();

    } catch (err) {
      console.error('[settings-panel] Error deleting unit:', err);
    }
  }

  // -------------------------------------------------------
  // Helpers
  // -------------------------------------------------------
  function clearAddForm() {
    ['unit-input-name', 'unit-input-min-sz', 'unit-input-max-sz',
     'unit-input-min-val', 'unit-input-max-val']
      .forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
  }

  // -------------------------------------------------------
  // Open / Close
  // -------------------------------------------------------
  let _panel = null;

  window.openSettingsPanel = function () {
    if (!_panel) _panel = createPanel();
    renderUnitsList();
    _panel.classList.add('open');
  };

  window.closeSettingsPanel = function () {
    if (!_panel) return;
    _panel.classList.remove('open');
  };

  // -------------------------------------------------------
  // Hook al botón existente
  // -------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('settings-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        if (_panel && _panel.classList.contains('open')) {
          closeSettingsPanel();
        } else {
          openSettingsPanel();
        }
      });
    }
  });

})();
