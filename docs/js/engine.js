/////////////////////
// engine.js
/////////////////////

// Logger de debug gateado. En producción DEBUG=false → no-op (sin ruido ni PII en consola).
// Para diagnosticar: en la consola del browser, `window.DEBUG = true`. Reemplaza a los
// console.log de flujo (auth/carga/persistencia); los console.error/warn quedan siempre vivos.
window.DEBUG = window.DEBUG || false;
window.dlog  = (...args) => { if (window.DEBUG) console.log(...args); };

// Estado global compartido — usado por graph.js para posiciones y workspace
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

/////////////////////////////////////////////////////////
// UNDO STACK
/////////////////////////////////////////////////////////

const _undoStack = [];

window.pushUndo = function(fn) {
  _undoStack.push(fn);
  if (_undoStack.length > 30) _undoStack.shift();
  _syncUndoBadge();
};

window.performUndo = async function() {
  if (!_undoStack.length) return;
  const fn = _undoStack.pop();
  try { await fn(); } catch(e) { console.error('undo error', e); }
  _syncUndoBadge();
};

function _syncUndoBadge() {
  const el = document.getElementById('undo-badge');
  if (el) el.style.background = _undoStack.length ? '#272727' : '#1a1a1a';
}

document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    window.performUndo();
  }
}, true);
