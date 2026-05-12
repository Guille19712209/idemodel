/////////////////////////////////////////////////////////
// COLOR UTILS (uses CSS variables)
/////////////////////////////////////////////////////////

function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function getNodeColor(ele) {
  return ele.data('color') || getCSSVar('--node-bg');
}

function getEdgeColor() {
  return getCSSVar('--edge-color');
}

function getEdgeActiveColor() {
  return getCSSVar('--edge-active');
}

export {
  getCSSVar,
  getNodeColor,
  getEdgeColor,
  getEdgeActiveColor
};