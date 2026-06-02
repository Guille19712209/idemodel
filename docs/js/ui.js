/////////////////////
// UI LAYER
/////////////////////

let CONCEPTS_MAP = {};
window.UI_MODE = "v3";

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
        hidden:    n.hidden || false,
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
      graphEdges.push({
        data: {
          id:           `parent_${n.id}`,
          source:       n.id,
          target:       n.parent,
          type:         'parent',
          concepts:     [],
          conceptLabel: ''
        }
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
