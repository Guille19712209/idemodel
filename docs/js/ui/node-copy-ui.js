// node-copy-ui.js — Panel del badge "copy": duplica un nodo (atributos + edges + fórmulas)
// generando N copias con nombre + número correlativo. Toggle "Copy childs" duplica el subárbol.
// Script regular (non-module). Reusa: NODES_DATA, VALUES_DATA, MODEL_ID, USER_ROLE,
//   supabaseClient, reloadCurrentModel, pushUndo. Mismo lenguaje visual que node-style-ui.js.

window.COPY_PANEL = null;
let _copyOutsideHandler = null;

const _sbCopy = () => window.supabaseClient;
const _numXY  = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };

/////////////////////////////////////////////////////////
// PANEL
/////////////////////////////////////////////////////////

window.openNodeCopyPanel = function(node, anchorEl) {
  closeNodeCopyPanel();
  if (window.USER_ROLE === 'reader') return;

  const panel = document.createElement('div');
  panel.className = 'node-style-panel';

  // ── Chip "Copy childs" (toggle) ──────────────────────────────
  let _childs = false;

  const childsChip = document.createElement('div');
  childsChip.className = 'ui-chip';
  childsChip.style.cursor = 'pointer';

  const childsLbl = document.createElement('div');
  childsLbl.className = 'ui-chip-label';
  childsLbl.innerText = 'Copy childs';

  const childsVal = document.createElement('div');
  childsVal.className = 'ui-chip-value';

  const childsDot = document.createElement('div');
  childsDot.className = 'sp-toggle-dot';
  childsVal.appendChild(childsDot);
  childsChip.appendChild(childsLbl);
  childsChip.appendChild(childsVal);

  childsChip.addEventListener('click', (e) => {
    e.stopPropagation();
    _childs = !_childs;
    childsDot.className = 'sp-toggle-dot' + (_childs ? ' sp-toggle-on' : '');
  });

  panel.appendChild(childsChip);

  // ── Chip "Copies" (label + input numérico + go!) ─────────────
  const copiesChip = document.createElement('div');
  copiesChip.className = 'ui-chip';
  copiesChip.style.cursor = 'default';

  const copiesLbl = document.createElement('div');
  copiesLbl.className = 'ui-chip-label';
  copiesLbl.innerText = 'Copies';

  const copiesVal = document.createElement('div');
  copiesVal.className = 'ui-chip-value';

  const copiesInput = document.createElement('div');
  copiesInput.className = 'ui-chip-alpha';
  copiesInput.contentEditable = true;
  copiesInput.spellcheck = false;
  copiesInput.innerText = '1';
  copiesInput.style.cssText = 'min-width:22px;text-align:right;padding:0 6px;cursor:text;font-size:11px;color:#373737;';

  const goBtn = document.createElement('div');
  goBtn.innerText = 'go!';
  goBtn.style.cssText =
    'cursor:pointer;font-size:11px;font-weight:600;color:#11151c;' +
    'background:#7eb8ff;border-radius:8px;padding:2px 10px;margin-left:6px;user-select:none;';

  copiesVal.appendChild(copiesInput);
  copiesVal.appendChild(goBtn);
  copiesChip.appendChild(copiesLbl);
  copiesChip.appendChild(copiesVal);
  panel.appendChild(copiesChip);

  // Línea de error / estado
  const errLine = document.createElement('div');
  errLine.style.cssText = 'font-size:10px;color:#ff6b6b;display:none;padding:0 4px;';
  panel.appendChild(errLine);

  // Solo dígitos en el input
  copiesInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); goBtn.click(); }
  });

  let _running = false;
  goBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (_running) return;
    let copies = parseInt(String(copiesInput.innerText).replace(/[^\d]/g, ''), 10);
    if (!Number.isFinite(copies) || copies < 1) copies = 1;
    if (copies > 50) copies = 50;
    copiesInput.innerText = String(copies);

    _running = true;
    goBtn.innerText = '…';
    goBtn.style.opacity = '0.6';
    errLine.style.display = 'none';
    try {
      await runCopy(node, { childs: _childs, copies });
      closeNodeCopyPanel();   // éxito: reloadCurrentModel ya re-renderizó
    } catch (err) {
      console.error('[copy] error:', err);
      errLine.innerText = err?.message || 'Copy failed.';
      errLine.style.display = 'block';
      goBtn.innerText = 'go!';
      goBtn.style.opacity = '1';
      _running = false;
    }
  });

  // ── Posición (a la derecha del badge, como el panel de estilo) ─
  const rect = anchorEl.getBoundingClientRect();
  panel.style.left = rect.right + 18 + 'px';
  panel.style.top  = rect.top + 'px';

  document.body.appendChild(panel);
  window.COPY_PANEL = panel;

  // Auto-cierre por click fuera (ignora el propio panel y los badges)
  _copyOutsideHandler = (ev) => {
    if (!window.COPY_PANEL) return;
    if (window.COPY_PANEL.contains(ev.target)) return;
    if (ev.target.closest && ev.target.closest('.graph-badge')) return;
    closeNodeCopyPanel();
  };
  setTimeout(() => document.addEventListener('pointerdown', _copyOutsideHandler, true), 0);
};

window.closeNodeCopyPanel = function() {
  if (_copyOutsideHandler) {
    document.removeEventListener('pointerdown', _copyOutsideHandler, true);
    _copyOutsideHandler = null;
  }
  if (window.COPY_PANEL) { window.COPY_PANEL.remove(); window.COPY_PANEL = null; }
};

/////////////////////////////////////////////////////////
// MOTOR DE COPIA
/////////////////////////////////////////////////////////

// Subárbol root-first (BFS por `parent`): garantiza padre-antes-de-hijo para el insert.
function _collectSet(rootId, includeChilds) {
  const nodes = window.NODES_DATA || [];
  const byId  = Object.fromEntries(nodes.map(n => [n.id, n]));
  const order = [];
  const seen  = new Set();
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift();
    if (seen.has(id) || !byId[id]) continue;
    seen.add(id);
    order.push(byId[id]);
    if (includeChilds) {
      nodes.forEach(c => { if (c.parent === id && !seen.has(c.id)) queue.push(c.id); });
    }
  }
  return order;
}

// Reescribe node:<uuid> → node:<newUuid> para los uuids que estén en idMap (set copiado).
// Las referencias a nodos de afuera quedan intactas.
function _rewriteFormula(formula, idMap) {
  if (!formula) return formula;
  return formula.replace(/node:([0-9a-fA-F-]{36})/g, (m, id) =>
    idMap.has(id) ? `node:${idMap.get(id)}` : m);
}

async function runCopy(rootNode, { childs, copies }) {
  if (window.USER_ROLE === 'reader') throw new Error('read-only role');
  const modelId = window.MODEL_ID;
  if (!modelId) throw new Error('no model open');

  const setOrdered = _collectSet(rootNode.id(), childs);
  if (!setOrdered.length) throw new Error('nothing to copy');
  const setIds = new Set(setOrdered.map(n => n.id));
  const setArr = [...setIds];

  // ── Datos fuente: relaciones (fetch puntual); nodes/time_values de los globals ──
  const [ngRes, linksSrcRes, linksTgtRes, npcRes] = await Promise.all([
    _sbCopy().from('node_groups').select('node_id, group_id').in('node_id', setArr),
    _sbCopy().from('links').select('*').in('source_id', setArr),
    _sbCopy().from('links').select('*').in('target_id', setArr),
    _sbCopy().from('node_parent_concepts').select('node_id, concept_id').in('node_id', setArr)
  ]);
  const srcNodeGroups = ngRes.data || [];
  const srcParentConcepts = npcRes.data || [];
  // Dedupe de links por id (un link puede matchear en ambas queries). Solo 'manual'
  // (concept links): los 'parent' viven en la tabla pero se derivan de nodes.parent.
  const srcLinksMap = new Map();
  [...(linksSrcRes.data || []), ...(linksTgtRes.data || [])]
    .filter(l => l.type === 'manual')
    .forEach(l => srcLinksMap.set(l.id, l));
  const srcLinks = [...srcLinksMap.values()];

  let srcLinkConcepts = [];
  if (srcLinks.length) {
    const lcRes = await _sbCopy().from('link_concepts').select('*').in('link_id', srcLinks.map(l => l.id));
    srcLinkConcepts = lcRes.data || [];
  }

  const valuesData = window.VALUES_DATA || {};
  const srcValues  = Object.values(valuesData).filter(v => setIds.has(v.node_id));

  // ── Construir filas para todas las copias ──
  const usedLabels = new Set((window.NODES_DATA || []).map(n => n.label));
  const nextFree   = (base, startK) => { let k = startK; while (usedLabels.has(`${base} ${k}`)) k++; return k; };

  const allNodes = [], allTimeValues = [], allNodeGroups = [],
        allLinks = [], allLinkConcepts = [], allParentConcepts = [], allNewIds = [];

  let lastSuffix = 0;

  for (let i = 1; i <= copies; i++) {
    const idMap = new Map();
    setOrdered.forEach(n => idMap.set(n.id, crypto.randomUUID()));

    // Sufijo correlativo del root (creciente entre copias); childs lo heredan si está libre.
    const rootBase = setOrdered[0].label;   // setOrdered[0] es el root (BFS)
    const suffix   = nextFree(rootBase, lastSuffix + 1);
    lastSuffix     = suffix;

    const labelMap = new Map();
    setOrdered.forEach(n => {
      const base = n.label;
      const k    = (n.id === rootNode.id()) ? suffix : nextFree(base, suffix);
      const label = `${base} ${k}`;
      usedLabels.add(label);
      labelMap.set(n.id, label);
    });

    // nodes
    setOrdered.forEach(n => {
      const newId = idMap.get(n.id);
      allNewIds.push(newId);
      const parent = idMap.has(n.parent) ? idMap.get(n.parent) : (n.parent || null);
      allNodes.push({
        id:        newId,
        model_id:  modelId,
        label:     labelMap.get(n.id),
        unit_id:   n.unit_id || null,
        x:         _numXY(n.x) + 40 * i,
        y:         _numXY(n.y) + 40 * i,
        size_type: n.size_type || null,
        color:     n.color || null,
        shape:     n.shape || null,
        parent,
        alpha:     n.alpha != null ? n.alpha : null,
        size_px:   n.size_px != null ? n.size_px : null,
        hidden:    n.hidden != null ? n.hidden : null,
        comment:   n.comment || null,
        text_only: n.text_only != null ? n.text_only : false
      });
    });

    // time_values (fórmulas reescritas)
    srcValues.forEach(v => {
      allTimeValues.push({
        model_id: modelId,
        node_id:  idMap.get(v.node_id),
        period:   v.period,
        formula:  _rewriteFormula(v.formula, idMap)
      });
    });

    // node_groups
    srcNodeGroups.forEach(ng => {
      allNodeGroups.push({ node_id: idMap.get(ng.node_id), group_id: ng.group_id });
    });

    // links + link_concepts
    const linkIdMap = new Map();
    srcLinks.forEach(l => {
      const newLinkId = crypto.randomUUID();
      linkIdMap.set(l.id, newLinkId);
      allLinks.push({
        id:        newLinkId,
        model_id:  modelId,
        source_id: idMap.get(l.source_id) || l.source_id,
        target_id: idMap.get(l.target_id) || l.target_id,
        type:      l.type
      });
    });
    srcLinkConcepts.forEach(lc => {
      if (linkIdMap.has(lc.link_id)) {
        allLinkConcepts.push({ link_id: linkIdMap.get(lc.link_id), concept_id: lc.concept_id });
      }
    });

    // node_parent_concepts
    srcParentConcepts.forEach(pc => {
      allParentConcepts.push({ node_id: idMap.get(pc.node_id), concept_id: pc.concept_id });
    });
  }

  // ── Insert en orden de dependencia; rollback si algo falla ──
  const _ins = async (table, rows) => {
    if (!rows.length) return;
    const { error } = await _sbCopy().from(table).insert(rows);
    if (error) throw new Error(`${table}: ${error.message}`);
  };

  try {
    await _ins('nodes', allNodes);                 // root-antes-de-hijo dentro de cada copia
    await _ins('time_values', allTimeValues);
    await _ins('node_groups', allNodeGroups);
    await _ins('links', allLinks);
    await _ins('link_concepts', allLinkConcepts);
    await _ins('node_parent_concepts', allParentConcepts);
  } catch (err) {
    // Rollback: borrar los nodes nuevos (cascada limpia el resto)
    try { await _sbCopy().from('nodes').delete().in('id', allNewIds); } catch (_) {}
    throw err;
  }

  // ── Re-render + undo ──
  window.removeNodeBadges?.();   // limpia badges (el #badge-layer persiste al re-render)
  await window.reloadCurrentModel?.();

  window.pushUndo?.(async () => {
    try { await _sbCopy().from('nodes').delete().in('id', allNewIds); } catch (_) {}
    await window.reloadCurrentModel?.();
  });
}
