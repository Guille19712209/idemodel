/////////////////////
// FORMULA ENGINE
/////////////////////

(function() {

  const FUNCTIONS = ['SUM','AVG','MIN','MAX','ABS','ROUND','IF','AND','OR','NOT'];
  const NODE_RE   = /node:([a-f0-9-]{36})\[([+-]?\d+)\]/g;

  // Implementaciones de funciones disponibles en fórmulas
  const _FN = {
    SUM:   (...a) => a.reduce((s, v) => s + (v ?? 0), 0),
    AVG:   (...a) => a.length ? a.reduce((s, v) => s + (v ?? 0), 0) / a.length : 0,
    MIN:   (...a) => Math.min(...a),
    MAX:   (...a) => Math.max(...a),
    ABS:   (x)   => Math.abs(x),
    ROUND: (x, n = 0) => Math.round(x * Math.pow(10, n || 0)) / Math.pow(10, n || 0),
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

      // Node reference: Label[offset]
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

  // storage string → display text
  function toDisplay(stored, nodes) {
    if (!stored) return '';
    const im = _idMap(nodes);
    return stored.replace(NODE_RE, (_, id, off) => `${im[id] || id.slice(0,8)}[${off}]`);
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
      tokens.push({ type: 'ref', text: `${label}[${m[2]}]`,
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

    // Normalizar nombres de función a mayúsculas
    expr = expr.replace(/\b(SUM|AVG|MIN|MAX|ABS|ROUND|IF|AND|OR|NOT)\b/gi,
      fn => fn.toUpperCase());

    // Safety: quitar nombres de función conocidos, el resto solo puede ser numérico/operadores
    const cleaned = expr.replace(/\b(SUM|AVG|MIN|MAX|ABS|ROUND|IF|AND|OR|NOT)\b/g, '');
    if (/[^0-9+\-*/().%,\s!<>=&|]/.test(cleaned)) return null;

    try {
      const fn = new Function(
        'SUM','AVG','MIN','MAX','ABS','ROUND','IF','AND','OR','NOT',
        '"use strict"; return (' + expr + ')'
      );
      const result = fn(
        _FN.SUM, _FN.AVG, _FN.MIN, _FN.MAX, _FN.ABS,
        _FN.ROUND, _FN.IF, _FN.AND, _FN.OR, _FN.NOT
      );
      if (typeof result === 'number' && isFinite(result))
        return Math.round(result * 1e10) / 1e10;
      return null;
    } catch(e) { return null; }
  }

  // Validate storage formula for node → array of error strings
  function validate(stored, currentNodeId) {
    const errors = [];
    if (!stored || !currentNodeId) return errors;
    const re = /node:([a-f0-9-]{36})\[([+-]?\d+)\]/g;
    let m;
    while ((m = re.exec(stored)) !== null) {
      if (m[1] === currentNodeId && parseInt(m[2]) >= 0) {
        errors.push('Un nodo no puede referenciarse en el período actual o futuro');
      }
    }
    return errors;
  }

  window.Formula = { tokenize, serialize, toDisplay, fromStorage, evaluate, validate, FUNCTIONS };

})();
