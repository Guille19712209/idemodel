/////////////////////
// ARCHIVO engine.js
/////////////////////

///////////////////////////////
// 🔥 GLOBAL STATE (NUEVO)
///////////////////////////////

const __STATE = {
  nodes: [],
  edges: [],
  concepts: [],
  dirty: false
};

function setState(partial) {
  Object.assign(__STATE, partial);
  __STATE.dirty = true;
}

function getState() {
  return __STATE;
}

let conceptMap = {};
window.UNITS = [];

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

window.handleData = function(data) {
  console.log("DATA COMPLETA:", data);
  window.UNITS = data.units || [];

  if (typeof setState === "function") {
    const current = getState();
    setState({ ...current, model_id: data.model_id });
  }

  if (window.renderGraph) {
    window.renderGraph(data);
  }
};



