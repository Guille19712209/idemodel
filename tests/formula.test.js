// Tests del motor de fórmulas (docs/js/formula.js).
// Correr desde la raíz del repo:  node --test
//
// formula.js es un IIFE que hace `window.Formula = {...}` y lee `window.VALUES_DATA`
// / `window.NODES_DATA` en tiempo de llamada. No es un módulo. Para testearlo sin
// tocarlo: apuntamos `window` a `globalThis`, evaluamos el archivo (corre el IIFE y
// deja `Formula` en globalThis), y probamos contra eso. Cero dependencias.

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

globalThis.window = globalThis;
const code = fs.readFileSync(
  path.join(__dirname, '..', 'docs', 'js', 'formula.js'), 'utf8'
);
// eslint-disable-next-line no-eval
eval(code);                     // corre el IIFE → setea globalThis.Formula
const F = globalThis.Formula;

// uuids válidos para el regex [a-f0-9-]{36}
const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const C = '33333333-3333-3333-3333-333333333333';
const NODES = [{ id: A, label: 'A' }, { id: B, label: 'B' }, { id: C, label: 'C' }];

// Helpers para sembrar el estado global que lee el motor
function setValues(map) { globalThis.VALUES_DATA = map; }
function setNodes(nodes) { globalThis.NODES_DATA = nodes; }

beforeEach(() => { setValues({}); setNodes(NODES); globalThis.MODEL_DATA = {}; });

/////////////////////////////////////////////////////////
// evaluate — aritmética y funciones
/////////////////////////////////////////////////////////

test('evaluate: aritmética y precedencia', () => {
  assert.equal(F.evaluate('2+3*4', A, 1), 14);
  assert.equal(F.evaluate('(2+3)*4', A, 1), 20);
  assert.equal(F.evaluate('2^3', A, 1), 8);          // ^ → **
  assert.equal(F.evaluate('10/4', A, 1), 2.5);
});

test('evaluate: funciones', () => {
  assert.equal(F.evaluate('SUM(1,2,3)', A, 1), 6);
  assert.equal(F.evaluate('AVG(2,4)', A, 1), 3);
  assert.equal(F.evaluate('MIN(5,2,9)', A, 1), 2);
  assert.equal(F.evaluate('MAX(5,2,9)', A, 1), 9);
  assert.equal(F.evaluate('ABS(0-5)', A, 1), 5);
  assert.equal(F.evaluate('ROUND(3.14159,2)', A, 1), 3.14);
  assert.equal(F.evaluate('IF(1>0,10,20)', A, 1), 10);
  assert.equal(F.evaluate('IF(1>2,10,20)', A, 1), 20);
  assert.equal(F.evaluate('AND(1,1)', A, 1), 1);
  assert.equal(F.evaluate('OR(0,0)', A, 1), 0);
  assert.equal(F.evaluate('NOT(0)', A, 1), 1);
});

test('evaluate: vacío / inválido / no-finito → null', () => {
  assert.equal(F.evaluate('', A, 1), null);
  assert.equal(F.evaluate('   ', A, 1), null);
  assert.equal(F.evaluate('1/0', A, 1), null);          // Infinity → null
  assert.equal(F.evaluate('alert(1)', A, 1), null);     // identificador desconocido → null
  assert.equal(F.evaluate('2+', A, 1), null);           // sintaxis rota → null
});

/////////////////////////////////////////////////////////
// evaluate — referencias a nodos (intra y temporal)
/////////////////////////////////////////////////////////

test('evaluate: ref [0] resuelve al valor del período actual', () => {
  setValues({ [`${A}_1`]: { value: 5 } });
  assert.equal(F.evaluate(`node:${A}[0]+3`, B, 1), 8);
});

test('evaluate: ref a valor faltante → 0', () => {
  assert.equal(F.evaluate(`node:${A}[0]+3`, B, 1), 3);
});

test('evaluate: ref temporal [-1] toma el período anterior', () => {
  setValues({ [`${A}_1`]: { value: 10 }, [`${A}_2`]: { value: 99 } });
  assert.equal(F.evaluate(`node:${A}[-1]`, B, 2), 10);
});

test('evaluate: ref temporal por debajo del período 1 → 0', () => {
  setValues({ [`${A}_1`]: { value: 10 } });
  assert.equal(F.evaluate(`node:${A}[-1]`, B, 1), 0);
});

/////////////////////////////////////////////////////////
// tokenize / serialize / toDisplay / fromStorage (round-trip)
/////////////////////////////////////////////////////////

test('tokenize → serialize: display {Label}[off] → storage node:uuid[off]', () => {
  const toks = F.tokenize('{A}[0]+2', NODES);
  assert.equal(F.serialize(toks), `node:${A}[0]+2`);
});

test('toDisplay: storage → display delimitado', () => {
  assert.equal(F.toDisplay(`node:${A}[0]+2`, NODES), '{A}[0]+2');
});

test('round-trip: storage → fromStorage → serialize == storage', () => {
  const stored = `node:${A}[0]+node:${B}[-1]*2`;
  assert.equal(F.serialize(F.fromStorage(stored, NODES)), stored);
});

/////////////////////////////////////////////////////////
// recomputeAll — orden topológico y temporal
/////////////////////////////////////////////////////////

test('recomputeAll: respeta el orden topológico intra-período', () => {
  // B depende de A; el orden de inserción está "al revés" a propósito
  const map = {
    [`${B}_1`]: { node_id: B, period: 1, formula: `node:${A}[0]+1`, value: null },
    [`${A}_1`]: { node_id: A, period: 1, formula: '5', value: null },
  };
  setValues(map);                       // evaluate lee window.VALUES_DATA (mismo obj)
  const { cycles } = F.recomputeAll(map, 1);
  assert.equal(cycles.size, 0);
  assert.equal(map[`${A}_1`].value, 5);
  assert.equal(map[`${B}_1`].value, 6);
});

test('recomputeAll: cadena temporal entre períodos', () => {
  const map = {
    [`${A}_1`]: { node_id: A, period: 1, formula: '10', value: null },
    [`${A}_2`]: { node_id: A, period: 2, formula: `node:${A}[-1]*2`, value: null },
    [`${A}_3`]: { node_id: A, period: 3, formula: `node:${A}[-1]*2`, value: null },
  };
  setValues(map);
  F.recomputeAll(map, 3);
  assert.equal(map[`${A}_1`].value, 10);
  assert.equal(map[`${A}_2`].value, 20);
  assert.equal(map[`${A}_3`].value, 40);
});

test('recomputeAll: ciclo [0] detectado, sin loop infinito', () => {
  const map = {
    [`${A}_1`]: { node_id: A, period: 1, formula: `node:${B}[0]`, value: null },
    [`${B}_1`]: { node_id: B, period: 1, formula: `node:${A}[0]`, value: null },
  };
  setValues(map);
  const { cycles } = F.recomputeAll(map, 1);
  assert.ok(cycles.has(A) && cycles.has(B));
});

/////////////////////////////////////////////////////////
// hasCycle / cyclePath / validate
/////////////////////////////////////////////////////////

test('validate: auto-referencia en período actual/futuro → error', () => {
  const errs = F.validate(`node:${A}[0]+1`, A, 1);
  assert.equal(errs.length, 1);
  // auto-ref al PASADO sí está permitida
  assert.equal(F.validate(`node:${A}[-1]+1`, A, 1).length, 0);
});

test('hasCycle / validate: ciclo con fórmula propuesta', () => {
  // B ya referencia A; proponer A→B cierra el ciclo
  setValues({ [`${B}_1`]: { node_id: B, period: 1, formula: `node:${A}[0]` } });
  assert.equal(F.hasCycle(A, 1, `node:${B}[0]`), true);
  const errs = F.validate(`node:${B}[0]`, A, 1);
  assert.ok(errs.some(e => /cycle/i.test(e)));
  // cyclePath incluye a ambos
  const pathSet = F.cyclePath(A, 1, `node:${B}[0]`);
  assert.ok(pathSet && pathSet.has(A) && pathSet.has(B));
});

/////////////////////////////////////////////////////////
// evaluateCondition (Hide when) → booleano
/////////////////////////////////////////////////////////

test('evaluateCondition: atajo con comparador usa el valor propio del nodo', () => {
  setValues({ [`${A}_1`]: { value: 10 } });
  assert.equal(F.evaluateCondition('>5', A, 1), true);
  assert.equal(F.evaluateCondition('<5', A, 1), false);
});

test('evaluateCondition: "=" suelto se interpreta como igualdad', () => {
  setValues({ [`${A}_1`]: { value: 10 } });
  assert.equal(F.evaluateCondition('=10', A, 1), true);
  assert.equal(F.evaluateCondition('=11', A, 1), false);
});

test('evaluateCondition: vacío → false', () => {
  assert.equal(F.evaluateCondition('', A, 1), false);
});

/////////////////////////////////////////////////////////
// bakeRandom — sella RND, deja FRND vivo
/////////////////////////////////////////////////////////

test('bakeRandom: RND(a,b) entero se sella; FRND queda intacto', () => {
  const orig = Math.random;
  Math.random = () => 0.3;                  // 0 + 0.3*10 = 3
  try {
    assert.equal(F.bakeRandom('RND(0,10)'), '3');
    assert.equal(F.bakeRandom('FRND(0,10)'), 'FRND(0,10)');  // NO se sella
    assert.equal(F.bakeRandom('2+3'), '2+3');                // sin RND, sin cambios
    // dentro de una expresión mayor
    assert.equal(F.bakeRandom(`node:${A}[0]+RND(0,10)`), `node:${A}[0]+3`);
  } finally {
    Math.random = orig;
  }
});
