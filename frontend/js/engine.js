
// =====================
// VALIDACIÓN
// =====================
function validateFormula(formula, nodes) {

  if (formula === null || formula === undefined) {
    return { valid: false };
  }

  // 🔥 convertir a string SIEMPRE
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

  formula = String(formula); // 👈 clave

  const labels = nodes.map(n => n.label);

  return labels.filter(label => formula.includes(label));
}
// =====================
// CONCEPT
// =====================
function buildConceptEdges(nodes) {

  return nodes
    .filter(n => n.concept && String(n.concept).trim() !== "")
    .map((n, i) => ({
      data: {
        id: "c_" + i,
        source: String(n.concept),
        target: String(n.id),
        type: "concept"
      }
    }));
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

// construcción de edges

function buildEdges(nodes, model) {

  const edges = [];

  // 1️⃣ parent
  nodes.forEach(n => {
    if (n.parent) {
      edges.push({
        data: {
          id: "parent_" + n.id,
          source: n.parent,
          target: n.id,
          type: "parent"
        }
      });
    }
  });

  // 2️⃣ concept
  const conceptGroups = {};

  nodes.forEach(n => {
    if (!n.concept) return;

    if (!conceptGroups[n.concept]) {
      conceptGroups[n.concept] = [];
    }

    conceptGroups[n.concept].push(n.id);
  });

  Object.values(conceptGroups).forEach(group => {
    if (group.length < 2) return;

    for (let i = 1; i < group.length; i++) {
      edges.push({
        data: {
          id: "concept_" + group[0] + "_" + group[i],
          source: group[0],
          target: group[i],
          type: "concept"
        }
      });
    }
  });


  return edges;
}



function buildGraphData(data) {

  const nodes = data.nodes;
  const model = data.model;

  // 🔵 nodos para cytoscape
  const cyNodes = nodes
    .filter(n => n.id)
    .map(n => ({
      data: {
        id: String(n.id),
        label: n.label
      }
    }));

  // 🟢 parent
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

  // 🟡 concept
  const conceptEdges = buildConceptEdges(nodes);

  // ⚫ formulas
  const formulaEdges = buildFormulaEdges(nodes, model);

  return {
    nodes: cyNodes,
    edges: [
      ...parentEdges,
      ...conceptEdges,
      ...formulaEdges
    ]
  };
}





// análisis
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

// (próximo)
function evaluateModel(nodes, model) {

  const values = {};

  // 🔁 recorrer model
  model.forEach(row => {

    let formula = row.formula;
    const nodeId = row.node_id;

    if (formula === null || formula === undefined) return;

    formula = String(formula);

    // 👉 reemplazar labels por valores
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

