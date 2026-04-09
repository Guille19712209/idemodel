/////////////////////
// ARCHIVO engine.js
/////////////////////

let conceptMap = {};

// =====================
// VALIDACIÓN
// =====================
function validateFormula(formula, nodes) {

  if (formula === null || formula === undefined) {
    return { valid: false };
  }

  formula = String(formula);

  const labels = nodes.map(n => n.label);

  const words = formula.match(/[a-zA-Z_]+/g) || [];

  const invalid = words.filter(w => !labels.includes(w));

  if (invalid.length > 0) {
    return { valid: false, invalid };
  }

  return { valid: true };
}

// =====================
// DEPENDENCIAS
// =====================
function extractDependencies(formula, nodes) {

  if (!formula) return [];

  formula = String(formula);

  const labels = nodes.map(n => n.label);

  return labels.filter(label => formula.includes(label));
}


// =====================
// FORMULAS
// =====================
function buildFormulaEdges(nodes, model) {

  const labelToId = {};
  nodes.forEach(n => {
    labelToId[n.label] = n.id;
  });

  const uniqueFormulas = {};

  model.forEach(row => {
    if (!row.formula) return;

    if (!uniqueFormulas[row.node_id]) {
      uniqueFormulas[row.node_id] = row.formula;
    }
  });

  const edges = [];

  Object.entries(uniqueFormulas).forEach(([nodeId, formula]) => {

    const validation = validateFormula(formula, nodes);

    if (!validation.valid) {
      console.warn("Formula inválida:", formula, validation);
      return;
    }

    const deps = extractDependencies(formula, nodes);

    deps.forEach(dep => {
      edges.push({
        data: {
          id: "f_" + dep + "_" + nodeId,
          source: labelToId[dep],
          target: nodeId,
          type: "formula"
        }
      });
    });

  });

  return edges;
}


// =====================
// GRAPH BUILDER (V2)
// =====================
function buildGraphData(data) {

  const nodes = data.nodes;
  const model = data.model;
  const conceptLinks = data.conceptLinks || [];
  const concepts = data.concepts || [];

  conceptMap = {};

  concepts.forEach(c => {
    conceptMap[c.id] = c;
  });

  // 🔵 nodos para cytoscape
  const cyNodes = nodes
    .filter(n => n.id)
    .map(n => ({
      data: {
        id: String(n.id),
        label: n.label,
        value: n.value || '',
        unit: n.unit || ''
      },
      position: {
        x: Number(n.x) || 100,
        y: Number(n.y) || 100
      }
    }));

  // 🟢 parent edges
  const parentEdges = nodes
    .filter(n => n.parent && String(n.parent).trim() !== "")
    .map((n, i) => ({
      data: {
        id: "p_" + i,
        source: String(n.parent),
        target: String(n.id),
        type: "parent"
      }
    }));

  // ⚫ formula edges
  const formulaEdges = buildFormulaEdges(nodes, model);

  // 🔗 edges base
  const edges = [
    ...parentEdges,
    ...formulaEdges
  ];

  // =====================
  // EDGE INDEX
  // =====================

  function buildEdgeId(source, target, type) {
    return `${source}_${target}_${type}`.toLowerCase().trim();
  }

  const edgeIndex = {};

  edges.forEach(e => {
    const source = e.data.source;
    const target = e.data.target;
    const type = e.data.type;

    const id = buildEdgeId(source, target, type);

    edgeIndex[id] = {
      id,
      source,
      target,
      type,
      concepts: []
    };
  });

  // =====================
  // APPLY CONCEPT LINKS
  // =====================

  conceptLinks.forEach(link => {

    const edgeId = String(link.edge_id).toLowerCase().trim();
    const conceptId = String(link.concept_id).trim();

    const edge = edgeIndex[edgeId];

    if (edge) {
      if (!edge.concepts.includes(conceptId)) {
        edge.concepts.push(conceptId);
      }
    }
  });

  // =====================
  // LABELS (UX)
  // =====================

  function getConceptLabel(concepts) {
    if (!concepts || concepts.length === 0) return "";
    return String(concepts.length);
  }

  // =====================
  // CY EDGES
  // =====================

  const cyEdges = Object.values(edgeIndex).map(edge => ({
    data: {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,

      // 🔥 CONCEPTOS ENRIQUECIDOS (clave para chips)
      concepts: edge.concepts.map(cid => {
        const c = conceptMap[cid] || {};
        return {
          id: cid,
          name: c.name || cid,
          color: c.color || "#888"
        };
      }),

      conceptLabel: getConceptLabel(edge.concepts),
      conceptColor: getConceptColor(edge.concepts)
    }
  }));

  return {
    nodes: cyNodes,
    edges: cyEdges,
    edgeIndex
  };
}


// =====================
// ANÁLISIS
// =====================
function detectCycles(edges) {

  const graph = {};

  edges.forEach(e => {
    const { source, target } = e.data;

    if (!graph[source]) graph[source] = [];
    graph[source].push(target);
  });

  const visited = new Set();
  const stack = new Set();

  function dfs(node) {

    if (stack.has(node)) return true;
    if (visited.has(node)) return false;

    visited.add(node);
    stack.add(node);

    const neighbors = graph[node] || [];

    for (let n of neighbors) {
      if (dfs(n)) return true;
    }

    stack.delete(node);
    return false;
  }

  return Object.keys(graph).some(n => dfs(n));
}


// =====================
// EVALUACIÓN
// =====================
function evaluateModel(nodes, model) {

  const values = {};

  model.forEach(row => {

    let formula = row.formula;
    const nodeId = row.node_id;

    if (formula === null || formula === undefined) return;

    formula = String(formula);

    nodes.forEach(n => {

      const val = values[n.id] ?? 0;

      const regex = new RegExp("\\b" + n.label + "\\b", "g");
      formula = formula.replace(regex, val);
    });

    try {
      const result = eval(formula);
      values[nodeId] = result;
    } catch (e) {
      console.warn("Error evaluando:", formula);
      values[nodeId] = null;
    }

  });

  return values;
}

function getConceptColor(concepts) {
  if (!concepts || concepts.length === 0) return "#999";

  const first = concepts[0];
  const concept = conceptMap[first];

  if (!concept) return "#999";

  return concept.color || "#999";
}