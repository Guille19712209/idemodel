
// concept-panel.js — Panel flotante de gestión de concepts del modelo
// Script regular (non-module). Usa: window.CONCEPTS_DATA, window.MODEL_ID, window.supabaseClient

window.CONCEPT_PANEL = null;
let _cpEdge = null;
let _cpCy   = null;

function _closeConceptPanel() {
  document.getElementById('concept-panel')?.remove();
  window.CONCEPT_PANEL = null;
  _cpEdge = null;
  _cpCy   = null;
}

window.closeConceptPanel = _closeConceptPanel;

window.openConceptPanel = function(edge, cy, hubNode) {
  const edgeId = edge.id();

  // Toggle si ya está abierto para el mismo edge
  if (window.CONCEPT_PANEL) {
    const same = window.CONCEPT_PANEL.dataset.edgeId === edgeId;
    _closeConceptPanel();
    if (same) return;
  }

  _cpEdge = edge;
  _cpCy   = cy;

  const panel = document.createElement('div');
  panel.id = 'concept-panel';
  panel.className = 'concept-panel';
  panel.dataset.edgeId = edgeId;

  _renderPanel(panel, edge, cy);

  document.body.appendChild(panel);
  window.CONCEPT_PANEL = panel;

  // Posición relativa al hub
  requestAnimationFrame(() => {
    const rect  = cy.container().getBoundingClientRect();
    const rp    = hubNode.renderedPosition();
    const sx    = rect.left + rp.x;
    const sy    = rect.top  + rp.y;
    const pw    = panel.offsetWidth  || 300;
    const ph    = panel.offsetHeight || 200;
    const mg    = 8;
    let left = sx + 14;
    if (left + pw > window.innerWidth - mg) left = sx - pw - 14;
    let top = sy - ph / 2;
    top = Math.max(mg, Math.min(window.innerHeight - ph - mg, top));
    panel.style.left = left + 'px';
    panel.style.top  = top  + 'px';
  });

  // Cierre al click exterior
  setTimeout(() => {
    document.addEventListener('pointerdown', function _outside(ev) {
      if (panel.contains(ev.target)) return;
      _closeConceptPanel();
      document.removeEventListener('pointerdown', _outside);
    });
  }, 0);
};

// ─────────────────────────────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────────────────────────────

function _renderPanel(panel, edge, cy) {
  panel.innerHTML = '';

  const concepts   = window.CONCEPTS_DATA || [];
  const assigned   = edge.data('concepts') || [];
  const assignedIds = new Set(assigned.map(c => c.id));
  const edgeId     = edge.id();

  // Header
  const header = document.createElement('div');
  header.className = 'cp-header';
  header.innerText = 'Concepts';
  panel.appendChild(header);

  // List
  const list = document.createElement('div');
  list.className = 'cp-list';

  if (concepts.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'cp-empty';
    empty.innerText = 'No concepts yet';
    list.appendChild(empty);
  } else {
    concepts.forEach(c => list.appendChild(_buildRow(c, assignedIds.has(c.id), edge, cy, panel)));
  }

  panel.appendChild(list);

  // Separador
  const sep = document.createElement('div');
  sep.className = 'cp-sep';
  panel.appendChild(sep);

  // Form crear nuevo
  panel.appendChild(_buildCreateForm(edge, cy, panel));
}

function _buildRow(concept, isAssigned, edge, cy, panel) {
  const row = document.createElement('div');
  row.className = 'cp-row';

  // Color dot
  const dot = document.createElement('div');
  dot.className = 'cp-dot';
  dot.style.background = concept.color || '#888';
  row.appendChild(dot);

  // Name
  const name = document.createElement('div');
  name.className = 'cp-name';
  name.innerText = concept.label || '';
  row.appendChild(name);

  // Comment
  const comment = document.createElement('div');
  comment.className = 'cp-comment';
  comment.innerText = concept.comment || '';
  row.appendChild(comment);

  // Toggle assigned
  const toggle = document.createElement('div');
  toggle.className = 'cp-toggle' + (isAssigned ? ' cp-toggle--on' : '');
  toggle.title = isAssigned ? 'Quitar de este edge' : 'Asignar a este edge';
  toggle.addEventListener('click', async (ev) => {
    ev.stopPropagation();
    if (isAssigned) {
      await _unassign(concept, edge, cy);
    } else {
      await _assign(concept, edge, cy);
    }
    _renderPanel(panel, edge, cy);
  });
  row.appendChild(toggle);

  // Delete from model
  const del = document.createElement('div');
  del.className = 'cp-del';
  del.innerText = '×';
  del.title = 'Eliminar concepto del modelo';
  del.addEventListener('click', async (ev) => {
    ev.stopPropagation();
    await _deleteConcept(concept.id, edge, cy);
    _renderPanel(panel, edge, cy);
  });
  row.appendChild(del);

  return row;
}

function _buildCreateForm(edge, cy, panel) {
  const form = document.createElement('div');
  form.className = 'cp-form';

  // Color picker
  const colorBox = document.createElement('div');
  colorBox.className = 'cp-form-color';
  colorBox.style.background = '#888888';
  colorBox.title = 'Color';

  const colorInput = document.createElement('input');
  colorInput.type  = 'color';
  colorInput.value = '#888888';
  colorInput.className = 'cp-color-input';
  colorInput.addEventListener('input', () => {
    colorBox.style.background = colorInput.value;
  });
  colorBox.appendChild(colorInput);
  colorBox.addEventListener('click', () => colorInput.click());
  form.appendChild(colorBox);

  // Name input
  const nameInput = document.createElement('input');
  nameInput.className   = 'cp-form-name';
  nameInput.placeholder = 'Concept name';
  form.appendChild(nameInput);

  // Comment input
  const commentInput = document.createElement('input');
  commentInput.className   = 'cp-form-comment';
  commentInput.placeholder = 'Brief description';
  form.appendChild(commentInput);

  // Create button
  const btn = document.createElement('div');
  btn.className = 'cp-form-btn';
  btn.innerText = '+';
  btn.addEventListener('click', async (ev) => {
    ev.stopPropagation();
    const name    = nameInput.value.trim();
    const color   = colorInput.value;
    const comment = commentInput.value.trim();
    if (!name) return;

    const modelId = window.MODEL_ID;
    const concept = await window.createConcept(name, modelId, color, comment || null);
    if (!concept) return;

    window.CONCEPTS_DATA = [...(window.CONCEPTS_DATA || []), concept];
    if (window.CONCEPTS_MAP) window.CONCEPTS_MAP[concept.id] = concept;

    await _assign(concept, edge, cy);
    _renderPanel(panel, edge, cy);
  });
  form.appendChild(btn);

  return form;
}

// ─────────────────────────────────────────────────────────────────────
// ASSIGN / UNASSIGN / DELETE
// ─────────────────────────────────────────────────────────────────────

async function _assign(concept, edge, cy) {
  await window.linkConceptToEdge(edge.id(), concept.id);

  const current = edge.data('concepts') || [];
  const updated = [...current, { id: concept.id, name: concept.label, color: concept.color || '#888' }];
  edge.data('concepts', updated);

  _refreshHub(edge, cy);
  if (edge.data('expanded')) _addChip(concept, updated.length - 1, edge, cy);
}

async function _unassign(concept, edge, cy) {
  await window.unlinkConceptFromEdge(edge.id(), concept.id);

  const updated = (edge.data('concepts') || []).filter(c => c.id !== concept.id);
  edge.data('concepts', updated);

  cy.nodes().filter(n => n.data('parentEdge') === edge.id() && n.data('conceptId') === concept.id).remove();
  _reindexChips(edge, cy);
  _refreshHub(edge, cy);
}

async function _deleteConcept(conceptId, edge, cy) {
  await window.deleteConcept(conceptId);
  // deleteConcept ya hace loadData que reconstruye todo — solo cerramos el panel
  _closeConceptPanel();
}

function _refreshHub(edge, cy) {
  const count = (edge.data('concepts') || []).length;
  const hub   = cy.getElementById(`hub_${edge.id()}`);
  const label = (count === 0 || edge.data('expanded')) ? '+' : String(count);
  if (hub.length) hub.data('label', label);
  cy.style().update();
}

function _addChip(concept, index, edge, cy) {
  const center  = _edgeCenter(edge);
  const spacing = 14;
  cy.add({
    group: 'nodes',
    data: {
      id: `chip_${edge.id()}_${index}`,
      parentEdge: edge.id(),
      conceptId: concept.id,
      index,
      label: concept.label,
      color: concept.color || '#888',
      isChip: true
    },
    position: { x: center.x, y: center.y - ((index + 1) * spacing) }
  });
}

function _reindexChips(edge, cy) {
  const spacing = 14;
  const center  = _edgeCenter(edge);
  const concepts = edge.data('concepts') || [];
  cy.nodes().filter(n => n.data('parentEdge') === edge.id() && n.data('isChip')).remove();
  concepts.forEach((c, i) => {
    cy.add({
      group: 'nodes',
      data: {
        id: `chip_${edge.id()}_${i}`,
        parentEdge: edge.id(),
        conceptId: c.id,
        index: i,
        label: c.name,
        color: c.color || '#888',
        isChip: true
      },
      position: { x: center.x, y: center.y - ((i + 1) * spacing) }
    });
  });
}

function _edgeCenter(edge) {
  const p = edge.midpoint();
  return { x: p.x, y: p.y };
}
