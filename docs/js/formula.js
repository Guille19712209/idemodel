/////////////////////
// FORMULA ENGINE
/////////////////////

(function() {

  const FUNCTIONS = ['SUM','AVG','MIN','MAX','ABS','ROUND','RND','FRND','IF','AND','OR','NOT'];
  const NODE_RE   = /node:([a-f0-9-]{36})\[([+-]?\d+)\]/g;
  // RND(a,b) con argumentos numéricos literales — se "sella" al guardar (bakeRandom).
  // `\bRND` evita matchear el "RND" dentro de FRND (que NO se sella: queda viva y
  // se re-tira en cada recompute).
  const RND_RE    = /\bRND\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/gi;

  // Implementaciones de funciones disponibles en fórmulas
  const _FN = {
    SUM:   (...a) => a.reduce((s, v) => s + (v ?? 0), 0),
    AVG:   (...a) => a.length ? a.reduce((s, v) => s + (v ?? 0), 0) / a.length : 0,
    MIN:   (...a) => Math.min(...a),
    MAX:   (...a) => Math.max(...a),
    ABS:   (x)   => Math.abs(x),
    ROUND: (x, n = 0) => Math.round(x * Math.pow(10, n || 0)) / Math.pow(10, n || 0),
    RND:   (a, b) => { const lo = Math.min(a, b), hi = Math.max(a, b); return Math.random() * (hi - lo) + lo; },
    // FRND: random "vivo" — no se sella; se re-tira en cada evaluación. Mismo redondeo
    // que el RND sellado (args enteros → entero; si no, 2 decimales).
    FRND:  (a, b) => {
      const lo = Math.min(a, b), hi = Math.max(a, b);
      const r  = Math.random() * (hi - lo) + lo;
      return (Number.isInteger(a) && Number.isInteger(b)) ? Math.round(r) : Math.round(r * 100) / 100;
    },
    IF:    (c, t, f)  => c ? t : f,
    AND:   (...a) => a.every(Boolean) ? 1 : 0,
    OR:    (...a) => a.some(Boolean)  ? 1 : 0,
    NOT:   (x)   => x ? 0 : 1,
  };

  function _labelMap(nodes) {
    const m = {};
    (nodes || window.NODES_DATA || []).forEach(n => { if (n.label) m[n.label] = n.id; });
    return m;
  }
  function _idMap(nodes) {
    const m = {};
    (nodes || window.NODES_DATA || []).forEach(n => { if (n.id) m[n.id] = n.label; });
    return m;
  }

  // Tokenize display text → tokens
  // token types: 'ref' | 'number' | 'op' | 'func' | 'space' | 'text'
  function tokenize(text, nodes) {
    const lm = _labelMap(nodes);
    const labels = Object.keys(lm).sort((a, b) => b.length - a.length);
    const tokens = [];
    let i = 0;

    while (i < text.length) {

      // Node reference DELIMITADA: {Label}[offset] — forma canónica, sin ambigüedad
      // de prefijos/espacios (la llave de cierre marca el límite exacto de la etiqueta).
      if (text[i] === '{') {
        const closeBrace = text.indexOf('}', i + 1);
        if (closeBrace !== -1 && text[closeBrace + 1] === '[') {
          const closeBr = text.indexOf(']', closeBrace + 2);
          if (closeBr !== -1) {
            const label     = text.slice(i + 1, closeBrace);
            const offsetStr = text.slice(closeBrace + 2, closeBr);
            if (/^[+-]?\d+$/.test(offsetStr) && lm[label] != null) {
              tokens.push({ type: 'ref', text: `{${label}}[${offsetStr}]`,
                display: label, nodeId: lm[label], offset: parseInt(offsetStr) });
              i = closeBr + 1;
              continue;
            }
          }
        }
      }

      // Node reference (legacy, sin llaves): Label[offset] — longest-match como fallback
      let refMatched = false;
      for (const label of labels) {
        if (text.slice(i, i + label.length) === label && text[i + label.length] === '[') {
          const closeIdx = text.indexOf(']', i + label.length);
          if (closeIdx !== -1) {
            const offsetStr = text.slice(i + label.length + 1, closeIdx);
            if (/^[+-]?\d+$/.test(offsetStr)) {
              tokens.push({ type: 'ref', text: label + '[' + offsetStr + ']',
                display: label, nodeId: lm[label], offset: parseInt(offsetStr) });
              i = closeIdx + 1;
              refMatched = true;
              break;
            }
          }
        }
      }
      if (refMatched) continue;

      // Function name
      let funcMatched = false;
      for (const fn of FUNCTIONS) {
        if (text.slice(i, i + fn.length).toUpperCase() === fn &&
            (i + fn.length >= text.length || /[\s(]/.test(text[i + fn.length]))) {
          tokens.push({ type: 'func', text: fn });
          i += fn.length;
          funcMatched = true;
          break;
        }
      }
      if (funcMatched) continue;

      // Number
      const numM = text.slice(i).match(/^\d+(\.\d+)?/);
      if (numM) {
        tokens.push({ type: 'number', text: numM[0] });
        i += numM[0].length;
        continue;
      }

      // Two-char operators
      const two = text.slice(i, i + 2);
      if (['!=', '>=', '<='].includes(two)) {
        tokens.push({ type: 'op', text: two }); i += 2; continue;
      }

      const ch = text[i];
      if ('+-*/^()=><,'.includes(ch)) {
        tokens.push({ type: 'op', text: ch });
      } else if (ch === ' ' || ch === '\t') {
        tokens.push({ type: 'space', text: ch });
      } else {
        const last = tokens[tokens.length - 1];
        if (last && last.type === 'text') last.text += ch;
        else tokens.push({ type: 'text', text: ch });
      }
      i++;
    }
    return tokens;
  }

  // tokens → storage string
  function serialize(tokens) {
    return tokens.map(t =>
      (t.type === 'ref' && t.nodeId) ? `node:${t.nodeId}[${t.offset}]` : t.text
    ).join('');
  }

  // storage string → display text. Referencias en forma delimitada {Label}[offset].
  function toDisplay(stored, nodes) {
    if (!stored) return '';
    const im = _idMap(nodes);
    return stored.replace(NODE_RE, (_, id, off) => `{${im[id] || id.slice(0,8)}}[${off}]`);
  }

  // storage string → tokens (for editor init)
  function fromStorage(stored, nodes) {
    if (!stored) return [];
    const im = _idMap(nodes);
    const lm = _labelMap(nodes);
    const tokens = [];
    const re = /node:([a-f0-9-]{36})\[([+-]?\d+)\]/g;
    let last = 0, m;
    while ((m = re.exec(stored)) !== null) {
      if (m.index > last) {
        tokenize(stored.slice(last, m.index), nodes)
          .forEach(t => { if (t.type !== 'ref') tokens.push(t); });
      }
      const label = im[m[1]] || m[1].slice(0, 8);
      tokens.push({ type: 'ref', text: `{${label}}[${m[2]}]`,
        display: label, nodeId: m[1], offset: parseInt(m[2]) });
      last = re.lastIndex;
    }
    if (last < stored.length) {
      tokenize(stored.slice(last), nodes)
        .forEach(t => { if (t.type !== 'ref') tokens.push(t); });
    }
    return tokens;
  }

  // Evaluate storage formula → number | null
  function evaluate(stored, currentNodeId, currentPeriod) {
    if (!stored || !stored.trim()) return null;

    const vd  = window.VALUES_DATA || {};
    const per = parseInt(currentPeriod) || 1;

    // Reemplazar referencias a nodos por valores numéricos
    let expr = stored.replace(NODE_RE, (_, nodeId, offset) => {
      const tp = per + parseInt(offset);
      if (tp < 1) return '0';
      const row = vd[`${nodeId}_${tp}`];
      return String(row?.value != null ? row.value : 0);
    });

    expr = expr.replace(/\^/g, '**');

    // Normalizar nombres de función a mayúsculas (FRND antes que RND para no partirlo)
    expr = expr.replace(/\b(SUM|AVG|MIN|MAX|ABS|ROUND|FRND|RND|IF|AND|OR|NOT)\b/gi,
      fn => fn.toUpperCase());

    // Safety: quitar nombres de función conocidos, el resto solo puede ser numérico/operadores
    const cleaned = expr.replace(/\b(SUM|AVG|MIN|MAX|ABS|ROUND|FRND|RND|IF|AND|OR|NOT)\b/g, '');
    if (/[^0-9+\-*/().%,\s!<>=&|]/.test(cleaned)) return null;

    try {
      const fn = new Function(
        'SUM','AVG','MIN','MAX','ABS','ROUND','RND','FRND','IF','AND','OR','NOT',
        '"use strict"; return (' + expr + ')'
      );
      const result = fn(
        _FN.SUM, _FN.AVG, _FN.MIN, _FN.MAX, _FN.ABS,
        _FN.ROUND, _FN.RND, _FN.FRND, _FN.IF, _FN.AND, _FN.OR, _FN.NOT
      );
      if (typeof result === 'number' && isFinite(result))
        return Math.round(result * 1e10) / 1e10;
      return null;
    } catch(e) { return null; }
  }

  // Dependencias intra-período de una fórmula: nodeIds referenciados con offset 0
  function _depsCurrentPeriod(stored) {
    const deps = new Set();
    if (!stored) return deps;
    const re = /node:([a-f0-9-]{36})\[([+-]?\d+)\]/g;
    let m;
    while ((m = re.exec(stored)) !== null) {
      if (parseInt(m[2]) === 0) deps.add(m[1]);
    }
    return deps;
  }

  // Recalcula TODOS los values de valuesMap en orden correcto:
  // - período por período ascendente (resuelve refs temporales [-k] ya calculadas)
  // - dentro de cada período, orden topológico sobre refs [0]
  // - detecta ciclos (nodos que se referencian circularmente en el mismo período)
  // Muta valuesMap[key].value in-place. Retorna { cycles: Set<nodeId> }.
  function recomputeAll(valuesMap, maxPeriod) {
    valuesMap = valuesMap || window.VALUES_DATA || {};

    let maxP = parseInt(maxPeriod) || 0;
    if (!maxP) {
      Object.values(valuesMap).forEach(r => { if (r.period > maxP) maxP = r.period; });
      maxP = maxP || (window.MODEL_DATA?.periods || 1);
    }

    const cycleNodes = new Set();

    for (let p = 1; p <= maxP; p++) {
      const rows = Object.values(valuesMap).filter(
        r => r.period === p && r.formula != null && r.formula !== ''
      );
      if (!rows.length) continue;

      const inPeriod = new Set(rows.map(r => r.node_id));

      // Grafo de dependencias intra-período (solo refs [0] que tienen fórmula en este período)
      const deps = {};
      rows.forEach(r => {
        const d = _depsCurrentPeriod(r.formula);
        const filtered = new Set();
        d.forEach(dep => { if (inPeriod.has(dep) && dep !== r.node_id) filtered.add(dep); });
        deps[r.node_id] = filtered;
      });

      // Orden topológico DFS con detección de ciclos
      const order   = [];
      const visited = {}; // 1 = visitando, 2 = terminado

      function visit(id, stack) {
        if (visited[id] === 2) return;
        if (visited[id] === 1) {
          const idx = stack.indexOf(id);
          for (let k = Math.max(0, idx); k < stack.length; k++) cycleNodes.add(stack[k]);
          return;
        }
        visited[id] = 1;
        stack.push(id);
        (deps[id] || new Set()).forEach(dep => visit(dep, stack));
        stack.pop();
        visited[id] = 2;
        order.push(id);
      }
      rows.forEach(r => { if (visited[r.node_id] !== 2) visit(r.node_id, []); });

      // Evaluar en orden topológico — value se escribe in-place, evaluate() lo lee al resolver el siguiente
      order.forEach(id => {
        const row = valuesMap[`${id}_${p}`];
        if (row && row.formula != null) row.value = evaluate(row.formula, id, p);
      });
    }

    return { cycles: cycleNodes };
  }

  // ¿El nodo queda dentro de un ciclo de dependencias [0] en el período dado?
  // overrideFormula: fórmula propuesta para nodeId (para validar ANTES de guardar).
  function hasCycle(nodeId, period, overrideFormula) {
    const vd = window.VALUES_DATA || {};
    const p  = parseInt(period) || 1;
    const depsOf = (id) => {
      const f = (id === nodeId && overrideFormula !== undefined)
        ? overrideFormula
        : vd[`${id}_${p}`]?.formula;
      return _depsCurrentPeriod(f);
    };
    const seen  = new Set();
    const stack = [...depsOf(nodeId)];
    while (stack.length) {
      const cur = stack.pop();
      if (cur === nodeId) return true;
      if (seen.has(cur)) continue;
      seen.add(cur);
      depsOf(cur).forEach(d => stack.push(d));
    }
    return false;
  }

  // Devuelve el Set de nodos que forman el ciclo de dependencias [0] que
  // involucra a nodeId con la fórmula propuesta (incluido nodeId), o null si
  // no hay ciclo. Sirve para resaltar los nodos ANTES de guardar.
  function cyclePath(nodeId, period, overrideFormula) {
    const vd = window.VALUES_DATA || {};
    const p  = parseInt(period) || 1;
    const depsOf = (id) => {
      const f = (id === nodeId && overrideFormula !== undefined)
        ? overrideFormula
        : vd[`${id}_${p}`]?.formula;
      return _depsCurrentPeriod(f);
    };
    const path = [];
    const seen = new Set();
    let found  = null;
    function dfs(id) {
      if (found) return;
      path.push(id);
      for (const d of depsOf(id)) {
        if (d === nodeId) { found = new Set([...path, nodeId]); return; }
        if (!seen.has(d)) { seen.add(d); dfs(d); if (found) return; }
      }
      path.pop();
    }
    seen.add(nodeId);
    dfs(nodeId);
    return found;
  }

  // Validate storage formula for node → array of error strings
  function validate(stored, currentNodeId, period) {
    const errors = [];
    if (!stored || !currentNodeId) return errors;
    const re = /node:([a-f0-9-]{36})\[([+-]?\d+)\]/g;
    let m;
    while ((m = re.exec(stored)) !== null) {
      if (m[1] === currentNodeId && parseInt(m[2]) >= 0) {
        errors.push('A node cannot reference itself in the current or future period');
      }
    }
    if (period != null && errors.length === 0 && hasCycle(currentNodeId, period, stored)) {
      errors.push('This formula creates a dependency cycle');
    }
    return errors;
  }

  // "Sella" las llamadas RND(a,b) con argumentos numéricos: las reemplaza por un
  // número al azar entre a y b. Se llama al GUARDAR, así el valor queda fijo
  // (la arquitectura recalcula seguido; un RND vivo parpadearía en cada recálculo).
  // Si a,b son enteros → resultado entero; si no → 2 decimales.
  function bakeRandom(stored) {
    if (!stored || stored.indexOf('RND') === -1 && stored.indexOf('rnd') === -1) return stored;
    return stored.replace(RND_RE, (_, a, b) => {
      let lo = parseFloat(a), hi = parseFloat(b);
      if (lo > hi) { const t = lo; lo = hi; hi = t; }
      const r = Math.random() * (hi - lo) + lo;
      const isInt = Number.isInteger(lo) && Number.isInteger(hi);
      return String(isInt ? Math.round(r) : Math.round(r * 100) / 100);
    });
  }

  window.Formula = { tokenize, serialize, toDisplay, fromStorage, evaluate, validate, recomputeAll, hasCycle, cyclePath, bakeRandom, FUNCTIONS };

})();
