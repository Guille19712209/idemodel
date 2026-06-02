/////////////////////
// engine.js
/////////////////////

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
