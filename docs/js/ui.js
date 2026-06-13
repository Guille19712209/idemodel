/////////////////////
// UI LAYER
/////////////////////

let CONCEPTS_MAP = {};
window.UI_MODE = "v3";

window.evalFormula = function(formula, nodeId, period) {
  if (formula == null || formula === '') return null;
  if (window.Formula) return window.Formula.evaluate(formula, nodeId, period || window.CURRENT_PERIOD || 1);
  const n = parseFloat(String(formula).trim());
  return isNaN(n) ? null : n;
};

// Formateo de números según el formato de la unidad.
// formatNumber(value, fmt): aplica un formato concreto.
// formatValue(value, unitId): busca el formato de la unidad del nodo y lo aplica.
window.formatNumber = function(value, fmt) {
  if (value === '' || value == null) return '';
  const n = Number(value);
  if (!isFinite(n)) return String(value);
  switch (fmt) {
    case 'integer':
      return Math.round(n).toLocaleString('en-US');
    case 'decimal2':
      return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case 'accounting': {
      const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return n < 0 ? `(${s})` : s;
    }
    case 'percent':
      return n.toLocaleString('en-US', { maximumFractionDigits: 2 }) + '%';
    default:   // 'plain'
      return String(value);
  }
};
window.formatValue = function(value, unitId) {
  const unit = (window.UNITS_MAP && window.UNITS_MAP[unitId]) ||
               (window.UNITS_DATA || []).find(u => u.id === unitId);
  return window.formatNumber(value, unit?.number_format || 'plain');
};

// Recalcula todo VALUES_DATA en orden topológico (propaga a dependientes) y refresca el grafo.
// Llamar después de guardar cualquier fórmula.
window.recomputeFormulas = function() {
  if (!window.Formula || !window.VALUES_DATA) return;
  const periods = window.MODEL_DATA?.periods || window._currentModel?.periods;
  const res = window.Formula.recomputeAll(window.VALUES_DATA, periods);
  window.FORMULA_CYCLES = res.cycles;
  if (res.cycles.size) console.warn('Fórmulas con ciclo de dependencia:', [...res.cycles]);
  if (typeof window.refreshPeriod === 'function') window.refreshPeriod();
  window.markFormulaCycles?.();
};

/////////////////////////////////////////////////////////
// LOADER
/////////////////////////////////////////////////////////

function hideLoader() {
  const el = document.getElementById("loader");
  if (!el) return;
  el.classList.add("hidden");
  setTimeout(() => { el.remove(); }, 300);
}

/////////////////////////////////////////////////////////
// DATA FLOW (CRÍTICO — no tocar)
/////////////////////////////////////////////////////////

window.handleData = function(data) {
  console.log("DATA COMPLETA:", data);

  if (typeof setState === "function") {
    const current = getState();
    setState({ ...current, model_id: data.model_id });
  }

  const currentPeriod = window.CURRENT_PERIOD || 1;
  window.CURRENT_PERIOD = currentPeriod;

  const valuesMap = {};
  (data.values || []).forEach(v => {
    valuesMap[`${v.node_id}_${v.period}`] = v;
  });
  window.VALUES_DATA = valuesMap;

  const unitsMap = Object.fromEntries(
    (data.units || []).map(u => [u.id, u])
  );

  window.UNITS_DATA  = data.units  || [];
  window.UNITS_MAP   = unitsMap;
  window.NODES_DATA  = data.nodes  || [];
  window.GROUPS_DATA = data.groups || [];

  // Evaluar fórmulas en orden topológico. Defensivo: nunca debe cortar la carga.
  try {
    if (window.Formula) {
      const res = window.Formula.recomputeAll(valuesMap, data.model?.periods);
      window.FORMULA_CYCLES = res.cycles;
      if (res.cycles.size) console.warn('Fórmulas con ciclo de dependencia:', [...res.cycles]);
    } else {
      Object.values(valuesMap).forEach(v => {
        if (v.formula != null) v.value = window.evalFormula(v.formula, v.node_id, v.period);
      });
    }
  } catch (e) {
    console.error('recomputeAll error (no corta la carga):', e);
  }

  const groupsById = Object.fromEntries((data.groups || []).map(g => [g.id, g]));
  const nodeGroupsMap = {};
  (data.nodeGroups || []).forEach(ng => {
    if (!nodeGroupsMap[ng.node_id]) nodeGroupsMap[ng.node_id] = [];
    const g = groupsById[ng.group_id];
    if (g) nodeGroupsMap[ng.node_id].push({ id: g.id, name: g.name, color: g.color });
  });

  const conceptsMap = Object.fromEntries(
    (data.concepts || []).map(c => [c.id, c])
  );

  CONCEPTS_MAP = conceptsMap;
  window.CONCEPTS_DATA = data.concepts || [];

  const conceptsByLink = {};
  (data.linkConcepts || []).forEach(lc => {
    if (!conceptsByLink[lc.link_id]) conceptsByLink[lc.link_id] = [];
    const concept = conceptsMap[lc.concept_id];
    if (concept) {
      conceptsByLink[lc.link_id].push({
        id: concept.id,
        name: concept.label,
        color: concept.color || "#888"
      });
    }
  });

  const conceptsByParentNode = {};
  (data.parentConcepts || []).forEach(pc => {
    if (!conceptsByParentNode[pc.node_id]) conceptsByParentNode[pc.node_id] = [];
    const concept = conceptsMap[pc.concept_id];
    if (concept) {
      conceptsByParentNode[pc.node_id].push({
        id: concept.id,
        name: concept.label,
        color: concept.color || "#888"
      });
    }
  });

  // Globales para el timeline panel
  window.NODE_GROUPS_MAP = nodeGroupsMap; // nodeId → [{id, name, color}]

  const _nodeConceptsMap = {};
  data.links.forEach(l => {
    (conceptsByLink[l.id] || []).forEach(c => {
      [l.source_id, l.target_id].forEach(nid => {
        if (!_nodeConceptsMap[nid]) _nodeConceptsMap[nid] = new Set();
        _nodeConceptsMap[nid].add(c.id);
      });
    });
  });
  window.NODE_CONCEPTS_MAP = _nodeConceptsMap; // nodeId → Set<conceptId>

  const graphNodes = data.nodes.map(n => {
    const row  = valuesMap[`${n.id}_${currentPeriod}`];
    const unit = unitsMap[n.unit_id];
    return {
      data: {
        id:        n.id,
        label:     n.label,
        value:     row?.value || "",
        unit:      unit?.name || "",
        unit_id:   n.unit_id || null,
        shape:     n.shape,
        color:     n.color,
        alpha:     n.alpha,
        size:      n.size_px || n.size,
        size_px:   n.size_px,
        size_type: n.size_type || 'fixed',
        hidden:    n.hidden    || false,   // EFECTIVO (= manual || condición); se recalcula
        hidden_manual: n.hidden || false,  // flag manual persistido (fuente de verdad de toggle)
        hide_when: n.hide_when || '',      // condición "Hide when" (fórmula booleana)
        text_only: n.text_only || false,
        parent_id: n.parent || null,
        groups:    nodeGroupsMap[n.id] || [],
        comment:   n.comment || ''
      },
      position: { x: n.x || 0, y: n.y || 0 }
    };
  });

  // type:parent no se persiste — se deriva de nodes.parent en tiempo de carga
  const graphEdges = data.links
    .filter(l => l.type !== 'parent')
    .map(l => {
      const concepts = conceptsByLink[l.id] || [];
      return {
        data: {
          id:           l.id,
          source:       l.source_id,
          target:       l.target_id,
          type:         l.type || "manual",
          concepts,
          conceptLabel: concepts.length > 0 ? String(concepts.length) : ''
        }
      };
    });

  const nodeIdSet = new Set(data.nodes.map(n => n.id));
  data.nodes.forEach(n => {
    if (n.parent && nodeIdSet.has(n.parent)) {
      const concepts = conceptsByParentNode[n.id] || [];
      graphEdges.push({
        data: {
          id:           `parent_${n.id}`,
          source:       n.id,
          target:       n.parent,
          type:         'parent',
          concepts,
          conceptLabel: concepts.length > 0 ? String(concepts.length) : ''
        }
      });
    }
  });

  // Derivar formula edges desde formulas en time_values (no se persisten en links)
  const formulaEdgeMap = new Map();
  Object.values(valuesMap).forEach(v => {
    if (!v.formula) return;
    for (const m of v.formula.matchAll(/node:([a-f0-9-]{36})\[/g)) {
      const src = m[1], tgt = v.node_id;
      if (src === tgt) continue;
      const key = `${src}_${tgt}`;
      if (!formulaEdgeMap.has(key)) formulaEdgeMap.set(key, { src, tgt });
    }
  });
  formulaEdgeMap.forEach(({ src, tgt }, key) => {
    if (nodeIdSet.has(src) && nodeIdSet.has(tgt)) {
      graphEdges.push({
        data: { id: `formula_${key}`, source: src, target: tgt,
                type: 'formula', concepts: [], conceptLabel: '' }
      });
    }
  });

  window.renderGraph({
    nodes:     graphNodes,
    edges:     graphEdges,
    workspace: data.model?.workspace || null
  });

  window._currentModel = data.model || {};

  const nameInput = document.getElementById('model-name');
  if (nameInput && data.model?.name) nameInput.value = data.model.name;

  if (new URLSearchParams(window.location.search).get('focus') === 'name' && nameInput) {
    setTimeout(() => {
      nameInput.focus();
      nameInput.select();
      const _u = new URL(window.location.href);
      _u.searchParams.delete('focus');
      window.history.replaceState({}, '', _u.toString());
    }, 400);
  }

  const metaEl = document.getElementById('model-meta');
  if (metaEl) {
    const author  = window.MODEL_AUTHOR || '';
    const version = data.model?.version  || '';
    metaEl.innerText = [author, version].filter(Boolean).join(' · ');
  }

  if (data.model?.background_color) {
    const color = data.model.background_color;
    document.documentElement.style.setProperty('--bg-graph', color);
    const graph = document.getElementById('graph');
    if (graph) graph.style.background = color;
    const wrapper = document.getElementById('graph-wrapper');
    if (wrapper) wrapper.style.background = color;
  }

  if (data.model?.background_image_url) {
    const graph = document.getElementById('graph');
    if (graph) {
      const baseUrl  = data.model.background_image_url.split('?')[0];
      const freshUrl = `${baseUrl}?t=${Date.now()}`;
      graph.style.backgroundImage    = `url(${freshUrl})`;
      graph.style.backgroundSize     = 'cover';
      graph.style.backgroundPosition = 'center';
    }
  }

  window.updateTopUIContrast({
    bgColor:  data.model?.background_color  || null,
    hasImage: !!data.model?.background_image_url
  });

  if (typeof window.initTimeControls === 'function') window.initTimeControls();
  // Evaluación inicial de condiciones "Hide when" (hidden efectivo = manual || condición)
  if (typeof window.recomputeHideConditions === 'function') window.recomputeHideConditions();
};

/////////////////////////////////////////////////////////
// ADD NODE BUTTON
/////////////////////////////////////////////////////////

const _addNodeBtn = document.getElementById("add-node-btn");
_addNodeBtn.addEventListener("mousedown", (e) => e.stopPropagation());
_addNodeBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  if (typeof window.createNewNode === 'function') window.createNewNode();
});

/////////////////////////////////////////////////////////
// TOP UI CONTRAST
/////////////////////////////////////////////////////////

window.updateTopUIContrast = function({ bgColor, hasImage } = {}) {
  if (hasImage === undefined) {
    const g  = document.getElementById('graph');
    const bi = g ? g.style.backgroundImage : '';
    hasImage = !!(bi && bi !== 'none' && bi !== '');
  }

  const color     = bgColor ?? window._currentModel?.background_color ?? '#ececec';
  const textColor = hasImage
    ? '#ffffff'
    : (window.getContrastColor ? window.getContrastColor(color) : '#111111');

  document.documentElement.style.setProperty('--top-ui-color', textColor);

  ['app-name', 'model-name', 'model-meta'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.color = textColor;
  });

  const titleBlock = document.getElementById('model-title-block');
  if (titleBlock) {
    titleBlock.classList.toggle('top-ui-on-image', hasImage);
  }
};
