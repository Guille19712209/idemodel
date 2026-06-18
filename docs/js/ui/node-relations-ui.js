
// node-relations-ui.js — Panel de relaciones del nodo (relations badge)
// Script regular (non-module). Usa: node.cy(), window.NODES_DATA, window.MODEL_ID, window.supabaseClient

window.RELATIONS_PANEL    = null;
window.HIGHLIGHTED_GROUP_ID = null;
let _activeRelDd    = null;
let _activeRelChip  = null;
let _highlightedNodes = [];
let _highlightedEdges = [];

function _closeRelDd() {
  if (_activeRelDd) { _activeRelDd.remove(); _activeRelDd = null; }
  _activeRelChip = null;
}

function _clearGroupHighlights() {
  _highlightedNodes.forEach(n => {
    n.removeStyle('border-width');
    n.removeStyle('border-color');
    n.removeStyle('border-opacity');
    n.removeStyle('border-style');
  });
  _highlightedNodes = [];
  _highlightedEdges.forEach(e => {
    e.removeStyle('line-color');
    e.removeStyle('target-arrow-color');
  });
  _highlightedEdges = [];
  window.HIGHLIGHTED_GROUP_ID = null;
  // Vuelve al dimming que corresponda (nodo seleccionado / ninguno).
  if (typeof window.refreshDimming === 'function') window.refreshDimming();
}
// Expuesto para limpiar el highlight desde el tap en canvas / otro nodo (graph-events.js)
window.clearGroupHighlights = _clearGroupHighlights;

function _positionRight(el, anchor) {
  const r  = anchor.getBoundingClientRect();
  const ew = el.offsetWidth  || 200;
  const eh = el.offsetHeight || 100;
  const mg = 8;
  let left = r.right + 4;
  if (left + ew > window.innerWidth - mg) left = r.left - ew - 4;
  let top  = r.top;
  if (top  + eh > window.innerHeight - mg) top = window.innerHeight - eh - mg;
  el.style.left = Math.max(mg, left) + 'px';
  el.style.top  = Math.max(mg, top)  + 'px';
}

function _makeChipShell(label) {
  const chip = document.createElement('div');
  chip.className = 'ui-chip';
  chip.style.cursor = 'pointer';
  const lbl = document.createElement('div');
  lbl.className = 'ui-chip-label';
  lbl.innerText = label;
  const val = document.createElement('div');
  val.className = 'ui-chip-value';
  chip.appendChild(lbl);
  chip.appendChild(val);
  return chip;
}

// Dropdown con scroll al estilo del panel UNITS (scroll fino, alto capado).
function _relScrollDd() {
  const dd = document.createElement('div');
  dd.className = 'shape-dropdown';
  dd.style.cssText = 'position:fixed;z-index:1000000;min-width:180px;';
  const scroll = document.createElement('div');
  scroll.className = 'sp-units-scroll';
  dd.appendChild(scroll);
  return { dd, scroll };
}

// Fila de nodo: círculo de color + nombre + toggle (estilo Filter/Units).
function _relNodeRow(nodeData, selected, onClick) {
  const row = document.createElement('div');
  row.className = 'sp-filter-item';
  const dot = document.createElement('span');
  dot.className = 'sp-filter-color';
  dot.style.background = nodeData.color || 'rgba(255,255,255,0.22)';
  const name = document.createElement('span');
  name.className = 'sp-filter-item-name';
  name.innerText = nodeData.label || nodeData.id;
  const tog = document.createElement('div');
  tog.className = 'sp-toggle-dot' + (selected ? ' sp-toggle-on' : '');
  row.appendChild(dot);
  row.appendChild(name);
  row.appendChild(tog);
  row.addEventListener('click', e => { e.stopPropagation(); onClick && onClick(row); });
  return row;
}

// Fila meta (none) sin círculo de color.
function _relMetaRow(label, selected, onClick) {
  const row = document.createElement('div');
  row.className = 'sp-filter-item sp-filter-meta';
  const name = document.createElement('span');
  name.className = 'sp-filter-item-name';
  name.innerText = label;
  const tog = document.createElement('div');
  tog.className = 'sp-toggle-dot' + (selected ? ' sp-toggle-on' : '');
  row.appendChild(name);
  row.appendChild(tog);
  row.addEventListener('click', e => { e.stopPropagation(); onClick && onClick(); });
  return row;
}

// ─────────────────────────────────────────────────────────────────────
// OPEN / CLOSE
// ─────────────────────────────────────────────────────────────────────

window.openNodeRelationsPanel = function(node, anchorEl) {
  window.closeNodeRelationsPanel();

  const cy     = node.cy();
  const nodeId = node.id();
  const all    = (window.NODES_DATA || []).filter(n => n.id !== nodeId);

  // Mismo contenedor sin fondo que node-style-panel
  const panel = document.createElement('div');
  panel.id = 'node-relations-panel';
  panel.className = 'node-style-panel';

  panel.appendChild(_buildParentChip(node, cy, nodeId, all));
  panel.appendChild(_buildLinkedChip(node, cy, nodeId, all));
  panel.appendChild(_buildGroupChip(node));

  document.body.appendChild(panel);
  window.RELATIONS_PANEL = panel;

  requestAnimationFrame(() => {
    const r  = anchorEl.getBoundingClientRect();
    const pw = panel.offsetWidth  || 220;
    const ph = panel.offsetHeight || 130;
    const mg = 8;
    let left = r.right + mg;
    if (left + pw > window.innerWidth - mg) left = r.left - pw - mg;
    let top  = r.top;
    top = Math.max(mg, Math.min(window.innerHeight - ph - mg, top));
    panel.style.left = left + 'px';
    panel.style.top  = top  + 'px';
  });

  setTimeout(() => {
    document.addEventListener('pointerdown', function _outside(ev) {
      const picker = document.getElementById('node-group-picker');
      if (
        panel.contains(ev.target)   ||
        anchorEl.contains(ev.target)||
        (_activeRelDd  && _activeRelDd.contains(ev.target)) ||
        (picker && picker.contains(ev.target)) ||
        ev.target.closest('.color-picker-popup')
      ) return;
      window.closeNodeRelationsPanel();
      document.removeEventListener('pointerdown', _outside);
    });
  }, 0);
};

window.closeNodeRelationsPanel = function() {
  _closeRelDd();
  _clearGroupHighlights();
  document.getElementById('node-group-picker')?.remove();
  document.getElementById('node-relations-panel')?.remove();
  window.RELATIONS_PANEL = null;
};

// ─────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────

function _getDescendants(cy, nodeId) {
  const result = new Set();
  const queue  = [nodeId];
  while (queue.length) {
    const cur = queue.shift();
    cy.edges()
      .filter(e => e.data('type') === 'parent' && e.target().id() === cur)
      .forEach(e => {
        const childId = e.source().id();
        if (!result.has(childId)) {
          result.add(childId);
          queue.push(childId);
        }
      });
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────
// PARENT CHIP — single select
// ─────────────────────────────────────────────────────────────────────

function _buildParentChip(node, cy, nodeId, all) {
  const _getParentEdges = () =>
    cy.edges().filter(e => e.source().id() === nodeId && e.data('type') === 'parent');

  const initEdge = _getParentEdges();
  const initId   = initEdge.length ? initEdge[0].target().id() : null;
  const initLbl  = initId ? (all.find(n => n.id === initId)?.label || initId) : 'none';

  const chip = _makeChipShell('Parent');
  const val  = chip.querySelector('.ui-chip-value');

  const span = document.createElement('span');
  span.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:90px;';
  span.innerText = initLbl;

  const arrow = document.createElement('span');
  arrow.className = 'sp-arrow';
  arrow.innerText = '›';

  val.appendChild(span);
  val.appendChild(arrow);

  chip.addEventListener('click', e => {
    e.stopPropagation();
    if (_activeRelChip === chip) { _closeRelDd(); return; }
    _closeRelDd();

    const { dd, scroll } = _relScrollDd();
    _activeRelDd   = dd;
    _activeRelChip = chip;

    const curId      = _getParentEdges().length ? _getParentEdges()[0].target().id() : null;
    const descendants = _getDescendants(cy, nodeId);
    const eligible    = all.filter(n => !descendants.has(n.id));

    scroll.appendChild(_relMetaRow('none', !curId, () => {
      _applyParent(cy, nodeId, null);
      span.innerText = 'none';
      _closeRelDd();
    }));

    eligible.forEach(n => {
      scroll.appendChild(_relNodeRow(n, n.id === curId, () => {
        _applyParent(cy, nodeId, n.id);
        span.innerText = n.label || n.id;
        _closeRelDd();
      }));
    });

    document.body.appendChild(dd);
    requestAnimationFrame(() => _positionRight(dd, chip));
  });

  return chip;
}

function _applyParent(cy, nodeId, targetId) {
  const oldEdge = cy.edges().filter(e => e.source().id() === nodeId && e.data('type') === 'parent');
  if (oldEdge.length) {
    cy.getElementById(`hub_${oldEdge.id()}`).remove();
    oldEdge.remove();
  }

  if (targetId) {
    cy.add({ group: 'edges', data: { id: `parent_${nodeId}`, source: nodeId, target: targetId, type: 'parent' } });
    cy.style().update();
    window.refreshConceptHubs?.();
  }

  if (typeof window.queueNodeData === 'function') {
    window.queueNodeData(nodeId, 'parent', targetId || null);
  }
}

// ─────────────────────────────────────────────────────────────────────
// CONCEPT LINK CHIP — multi select (manual edges)
// ─────────────────────────────────────────────────────────────────────

function _buildLinkedChip(node, cy, nodeId, all) {
  const _getLinked = () =>
    cy.edges().filter(e => e.source().id() === nodeId && e.data('type') === 'manual');

  const chip = _makeChipShell('Concept Link');
  const val  = chip.querySelector('.ui-chip-value');

  const span = document.createElement('span');
  span.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80px;';

  const arrow = document.createElement('span');
  arrow.className = 'sp-arrow';
  arrow.innerText = '›';

  const _updateLabel = () => {
    const edges = _getLinked();
    if (!edges.length) { span.innerText = 'none'; return; }
    const names = edges.map(e => {
      const nd = (window.NODES_DATA || []).find(n => n.id === e.target().id());
      return nd?.label || e.target().id();
    });
    span.innerText = names.join(', ');
  };
  _updateLabel();

  val.appendChild(span);
  val.appendChild(arrow);

  chip.addEventListener('click', e => {
    e.stopPropagation();
    if (_activeRelChip === chip) { _closeRelDd(); return; }
    _closeRelDd();

    const { dd, scroll } = _relScrollDd();
    _activeRelDd   = dd;
    _activeRelChip = chip;

    all.forEach(n => {
      const isLinked = () => _getLinked().some(e => e.target().id() === n.id);

      const row = _relNodeRow(n, isLinked(), async (rowEl) => {
        if (isLinked()) {
          const edge = _getLinked().filter(e2 => e2.target().id() === n.id);
          const ids  = edge.map(e2 => e2.id());
          edge.remove();
          ids.forEach(id => window.supabaseClient?.from('links').delete().eq('id', id));
        } else {
          const newId = crypto.randomUUID();
          cy.add({ group: 'edges', data: { id: newId, source: nodeId, target: n.id, type: 'manual' } });
          cy.style().update();
          if (typeof window.refreshConceptHubs === 'function') window.refreshConceptHubs();

          const { error: linkErr } = await window.supabaseClient.from('links').insert({
            id: newId, model_id: window.MODEL_ID,
            source_id: nodeId, target_id: n.id, type: 'manual'
          });
          if (linkErr) {
            // Rollback: el edge no se guardó, sacarlo de Cytoscape
            cy.getElementById(newId).remove();
            cy.style().update();
            console.error('Error creando link:', linkErr.code, linkErr.message);
            return;
          }
        }
        const tog = rowEl.querySelector('.sp-toggle-dot');
        if (tog) tog.className = 'sp-toggle-dot' + (isLinked() ? ' sp-toggle-on' : '');
        _updateLabel();
      });

      scroll.appendChild(row);
    });

    document.body.appendChild(dd);
    requestAnimationFrame(() => _positionRight(dd, chip));
  });

  return chip;
}

// ─────────────────────────────────────────────────────────────────────
// GROUPS CHIP
// ─────────────────────────────────────────────────────────────────────

function _buildGroupChip(node) {
  const nodeId = node.id();
  const groups = Array.isArray(node.data('groups'))
    ? JSON.parse(JSON.stringify(node.data('groups')))
    : [];

  // Mismo patrón que comments chip: chip transparente, área gris propia con margin-left negativo
  const chip = document.createElement('div');
  chip.className = 'ui-chip';
  chip.style.cssText = 'background:transparent;overflow:visible;gap:0;cursor:default;height:auto;align-items:flex-start;';

  const lbl = document.createElement('div');
  lbl.className = 'ui-chip-label';
  lbl.innerText = 'Groups';
  lbl.style.cssText = 'height:24px;flex-shrink:0;position:relative;z-index:1;align-self:flex-start;';

  // Área gris que solapa el label por la izquierda — igual que .comments-ta-wrap
  const val = document.createElement('div');
  val.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:4px;background:#cac9c9;border-radius:12px;padding:4px 8px 4px 22px;margin-left:-18px;max-width:140px;min-height:24px;box-sizing:border-box;align-self:flex-start;';

  const _refresh = () => {
    val.innerHTML = '';

    groups.forEach((g, i) => {
      const gc = document.createElement('div');
      gc.style.cssText = `display:inline-flex;align-items:center;gap:3px;background:${g.color||'#888'};border-radius:99px;padding:2px 8px 2px 11px;cursor:pointer;`;

      // Click → highlight todos los nodos que tienen este grupo (toggle)
      gc.addEventListener('click', ev => {
        ev.stopPropagation();
        const cy = node.cy();
        const wasActive = window.HIGHLIGHTED_GROUP_ID === g.id;
        _clearGroupHighlights();           // limpia highlight previo (incluido border-style)
        if (wasActive) return;             // toggle off si era el mismo grupo
        window.HIGHLIGHTED_GROUP_ID = g.id;
        const _inGroup = new Set();
        cy.nodes().not('[isChip],[isConceptHub]').forEach(n => {
          const gs = n.data('groups');
          if (Array.isArray(gs) && gs.some(gr => gr.id === g.id)) {
            n.style({ 'border-width': 1, 'border-color': g.color, 'border-opacity': 1, 'border-style': 'solid' });
            _highlightedNodes.push(n);
            _inGroup.add(n.id());
          }
        });
        // Edges entre dos nodos del grupo → mismo color (igual criterio que concepts).
        cy.edges().forEach(e => {
          if (e.source().data('isConceptHub') || e.target().data('isConceptHub')) return;
          if (_inGroup.has(e.source().id()) && _inGroup.has(e.target().id())) {
            e.style({ 'line-color': g.color, 'target-arrow-color': g.color });
            _highlightedEdges.push(e);
          }
        });
        // Nodos/links del grupo a su opacidad definida; el resto al 50%.
        if (typeof window.refreshDimming === 'function') window.refreshDimming();
      });

      const colorDot = document.createElement('span');
      colorDot.style.cssText = 'width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,0.35);border:1px solid rgba(255,255,255,0.55);cursor:pointer;flex-shrink:0;display:inline-block;';
      colorDot.addEventListener('click', ev => {
        ev.stopPropagation();
        window.openColorPicker({
          anchorEl: colorDot,
          color: g.color,
          hasAlpha: false,
          onChange: async (newColor) => {
            g.color = newColor;
            gc.style.background = newColor;
            const idx = (window.GROUPS_DATA || []).findIndex(x => x.id === g.id);
            if (idx >= 0) window.GROUPS_DATA[idx].color = newColor;
            node.data('groups', JSON.parse(JSON.stringify(groups)));
            await _sb()?.from('groups').update({ color: newColor }).eq('id', g.id);
          }
        });
      });
      gc.appendChild(colorDot);

      const nameEl = document.createElement('span');
      nameEl.style.cssText = 'font-size:9px;color:#fff;outline:none;min-width:20px;max-width:72px;overflow:hidden;white-space:nowrap;cursor:text;';
      nameEl.contentEditable = true;
      nameEl.spellcheck      = false;
      nameEl.innerText       = g.name || 'Group';
      nameEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); } });
      nameEl.addEventListener('blur', async () => {
        const trimmed = nameEl.innerText.trim();
        if (trimmed && trimmed !== g.name) {
          g.name = trimmed;
          node.data('groups', groups);
          const idx = (window.GROUPS_DATA || []).findIndex(x => x.id === g.id);
          if (idx >= 0) window.GROUPS_DATA[idx].name = g.name;
          await _sb()?.from('groups').update({ name: g.name }).eq('id', g.id);
        }
      });
      nameEl.addEventListener('click', e => e.stopPropagation());

      const x = document.createElement('span');
      x.style.cssText = 'font-size:9px;color:rgba(255,255,255,0.75);cursor:pointer;line-height:1;flex-shrink:0;';
      x.innerText = '×';
      x.addEventListener('click', async ev => {
        ev.stopPropagation();
        const removedId = g.id;
        groups.splice(i, 1);
        node.data('groups', groups);
        _refresh();
        await _sb()?.from('node_groups').delete()
          .eq('node_id', nodeId).eq('group_id', removedId);
      });

      gc.appendChild(nameEl);
      gc.appendChild(x);
      val.appendChild(gc);
    });

    // Botón +
    const addBtn = document.createElement('div');
    addBtn.style.cssText = 'width:16px;height:16px;border-radius:50%;background:rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;font-size:13px;color:#fff;cursor:pointer;flex-shrink:0;line-height:1;';
    addBtn.innerText = '+';
    addBtn.addEventListener('click', e => {
      e.stopPropagation();
      _closeRelDd();
      _openGroupPicker(addBtn, groups, node, _refresh);
    });
    val.appendChild(addBtn);
  };

  _refresh();
  chip.appendChild(lbl);
  chip.appendChild(val);
  return chip;
}

// ─────────────────────────────────────────────────────────────────────
// GROUP PICKER — grupos existentes del modelo + crear nuevo
// ─────────────────────────────────────────────────────────────────────

const GROUP_COLORS = ['#6b7cc4','#c46b7c','#7cc46b','#c4a46b','#6bc4c1','#a46bc4','#c4756b'];

const _sb = () => window.supabaseClient;

function _openGroupPicker(anchor, nodeGroups, node, onRefresh) {
  document.getElementById('node-group-picker')?.remove();

  const nodeId     = node.id();
  const modelGroups = window.GROUPS_DATA || [];
  const currentIds  = new Set(nodeGroups.map(g => g.id));

  const picker = document.createElement('div');
  picker.id = 'node-group-picker';
  picker.className = 'shape-dropdown';
  picker.style.cssText = 'position:fixed;z-index:1000001;min-width:160px;';

  // Grupos existentes en el modelo
  if (modelGroups.length > 0) {
    modelGroups.forEach(g => {
      const row = document.createElement('div');
      row.className = 'shape-option';
      row.style.cssText = 'display:flex;align-items:center;gap:8px;';

      const dot = document.createElement('div');
      dot.className = 'sp-toggle-dot' + (currentIds.has(g.id) ? ' sp-toggle-on' : '');
      dot.style.flexShrink = '0';

      const swatch = document.createElement('div');
      swatch.style.cssText = `width:10px;height:10px;border-radius:50%;background:${g.color||'#888'};flex-shrink:0;`;

      const txt = document.createElement('span');
      txt.innerText = g.name || 'Group';

      // × borra el grupo del SISTEMA (no solo del nodo)
      const del = document.createElement('span');
      del.innerText = '×';
      del.style.cssText = 'margin-left:auto;font-size:11px;color:rgba(255,255,255,0.6);cursor:pointer;flex-shrink:0;padding:0 2px;';
      del.addEventListener('click', async ev => {
        ev.stopPropagation();
        if (await window.deleteGroup(g.id)) { row.remove(); onRefresh(); }
      });

      row.appendChild(dot);
      row.appendChild(swatch);
      row.appendChild(txt);
      row.appendChild(del);

      row.addEventListener('click', async ev => {
        ev.stopPropagation();
        if (currentIds.has(g.id)) {
          currentIds.delete(g.id);
          const idx = nodeGroups.findIndex(x => x.id === g.id);
          if (idx >= 0) nodeGroups.splice(idx, 1);
          dot.className = 'sp-toggle-dot';
          const { error: delErr } = await (_sb()?.from('node_groups').delete()
            .eq('node_id', nodeId).eq('group_id', g.id)) || {};
          if (delErr) console.error('node_groups delete error:', delErr);
        } else {
          currentIds.add(g.id);
          nodeGroups.push({ id: g.id, name: g.name, color: g.color });
          dot.className = 'sp-toggle-dot sp-toggle-on';
          const { error: insErr } = await (_sb()?.from('node_groups').insert({
            node_id: nodeId, group_id: g.id
          })) || {};
          if (insErr) console.error('node_groups insert error:', insErr);
        }
        node.data('groups', nodeGroups);
        onRefresh();
      });

      picker.appendChild(row);
    });

    const sep = document.createElement('div');
    sep.style.cssText = 'height:1px;background:rgba(255,255,255,0.1);margin:4px 6px;';
    picker.appendChild(sep);
  }

  // Crear nuevo grupo
  const newItem = document.createElement('div');
  newItem.className = 'shape-option';
  newItem.innerText = '+ New group';
  newItem.addEventListener('click', async ev => {
    ev.stopPropagation();
    const color = GROUP_COLORS[(modelGroups.length) % GROUP_COLORS.length];
    const newId = crypto.randomUUID();
    const g = { id: newId, name: 'Group', color };

    const { error: gErr } = await (_sb()?.from('groups').insert({
      id: newId, model_id: window.MODEL_ID, name: g.name, color: g.color
    })) || {};
    if (gErr) { console.error('groups insert error:', gErr); return; }

    const { error: ngErr } = await (_sb()?.from('node_groups').insert({
      node_id: nodeId, group_id: newId
    })) || {};
    if (ngErr) console.error('node_groups insert error:', ngErr);

    // Actualizar estado local
    if (window.GROUPS_DATA) window.GROUPS_DATA.push(g);
    nodeGroups.push(g);
    node.data('groups', nodeGroups);
    onRefresh();
    picker.remove();
  });
  picker.appendChild(newItem);

  document.body.appendChild(picker);

  requestAnimationFrame(() => {
    const r  = anchor.getBoundingClientRect();
    const pw = picker.offsetWidth || 160;
    let left = r.right + 6;
    if (left + pw > window.innerWidth - 8) left = r.left - pw - 6;
    picker.style.left = Math.max(8, left) + 'px';
    picker.style.top  = Math.max(8, r.top) + 'px';
  });

  setTimeout(() => {
    document.addEventListener('pointerdown', function _c(ev) {
      if (!picker.contains(ev.target) && !anchor.contains(ev.target)) {
        picker.remove();
        document.removeEventListener('pointerdown', _c);
      }
    });
  }, 0);
}
