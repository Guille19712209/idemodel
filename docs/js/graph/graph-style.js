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

/////////////////////////////////////////////////////////
// COUNTRY SHAPES — siluetas custom para nodos (shape:'polygon').
// Puntos normalizados a [-1,1], escala única (no deforman) + flip Y; generados desde
// GeoJSON (Natural Earth 110m) con corrección equirectangular cos(latMedia). El nodo se
// pinta con su background-color normal. Para sumar un país: agregar su string acá.
/////////////////////////////////////////////////////////
const COUNTRY_SHAPES = {
  italy: '-0.038 -0.924  0.191 -0.868  0.173 -0.761  0.212 -0.669  0.084 -0.700  -0.046 -0.623  -0.037 -0.516  -0.057 -0.454  -0.004 -0.343  0.146 -0.234  0.227 -0.054  0.405 0.121  0.530 0.120  0.569 0.168  0.524 0.211  0.668 0.289  0.785 0.355  0.923 0.468  0.939 0.509  0.909 0.587  0.820 0.485  0.681 0.450  0.614 0.590  0.730 0.671  0.711 0.784  0.644 0.797  0.558 0.983  0.491 1.000  0.492 0.934  0.525 0.817  0.560 0.771  0.497 0.645  0.448 0.535  0.382 0.508  0.334 0.414  0.231 0.375  0.162 0.288  0.044 0.274  -0.081 0.175  -0.228 0.034  -0.337 -0.091  -0.387 -0.306  -0.466 -0.331  -0.597 -0.403  -0.670 -0.373  -0.763 -0.273  -0.829 -0.257  -0.811 -0.351  -0.898 -0.379  -0.939 -0.547  -0.884 -0.613  -0.931 -0.694  -0.924 -0.756  -0.855 -0.709  -0.778 -0.720  -0.688 -0.793  -0.661 -0.759  -0.584 -0.766  -0.550 -0.853  -0.431 -0.826  -0.361 -0.863  -0.348 -0.952  -0.251 -0.921  -0.232 -0.962  -0.074 -1.000'
};
if (typeof window !== 'undefined') window.COUNTRY_SHAPES = COUNTRY_SHAPES;

// Shapes custom del usuario (por modelo): id → puntos. Se pueblan al cargar el modelo
// desde `models.custom_shapes` jsonb = [{ id, name, points }] (ver registerCustomShapes).
if (typeof window !== 'undefined') window.CUSTOM_SHAPES = window.CUSTOM_SHAPES || {};

// Lookup unificado: primero los custom del modelo, después los built-in (países). null = no es polígono.
function polyPointsFor(name) {
  if (!name) return null;
  const cs = (typeof window !== 'undefined' && window.CUSTOM_SHAPES) || {};
  return cs[name] || COUNTRY_SHAPES[name] || null;
}
if (typeof window !== 'undefined') window.polyPointsFor = polyPointsFor;

// Carga la biblioteca de shapes custom del modelo en el registro runtime.
function registerCustomShapes(list) {
  if (typeof window === 'undefined') return;
  const map = {};
  (list || []).forEach(s => { if (s && s.id && s.points) map[s.id] = s.points; });
  window.CUSTOM_SHAPES = map;
}
if (typeof window !== 'undefined') window.registerCustomShapes = registerCustomShapes;

// Aplica un shape a un nodo (instantáneo, bypass). Maneja polígonos (país o custom) + built-in.
function applyNodeShape(node, shapeVal) {
  const pts = polyPointsFor(shapeVal);
  if (pts) node.style({ 'shape': 'polygon', 'shape-polygon-points': pts });
  else { node.removeStyle('shape-polygon-points'); node.style('shape', shapeVal || 'ellipse'); }
}
if (typeof window !== 'undefined') window.applyNodeShape = applyNodeShape;

// Convierte un SVG (texto) en un string de puntos para shape-polygon-points, muestreando el
// contorno con la API nativa del navegador (resuelve curvas/beziers). Normaliza a [-1,1] con
// escala única (no deforma). SVG ya es Y-down = Cytoscape → sin flip. Toma el path/polígono más
// grande (un solo anillo; islas/huecos no aplican). Devuelve null si no encuentra geometría.
function svgToPolygon(svgText, samples = 80) {
  if (typeof document === 'undefined' || !svgText) return null;
  let doc;
  try { doc = new DOMParser().parseFromString(svgText, 'image/svg+xml'); }
  catch (e) { return null; }
  if (doc.querySelector('parsererror')) return null;

  const NS = 'http://www.w3.org/2000/svg';
  const host = document.createElementNS(NS, 'svg');
  host.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;left:-9999px;';
  document.body.appendChild(host);

  // Candidatos: <path> directos + <polygon>/<polyline> convertidos a path. Elijo el de mayor bbox.
  const dList = [];
  doc.querySelectorAll('path').forEach(p => { const d = p.getAttribute('d'); if (d) dList.push(d); });
  doc.querySelectorAll('polygon, polyline').forEach(p => {
    const pts = (p.getAttribute('points') || '').trim();
    if (pts) { const nums = pts.split(/[\s,]+/); let d = 'M' + nums.slice(0, 2).join(',') + ' L' + nums.slice(2).join(' ') + ' Z'; dList.push(d); }
  });

  let best = null, bestArea = -1;
  dList.forEach(d => {
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d); host.appendChild(path);
    let L = 0; try { L = path.getTotalLength(); } catch (e) {}
    if (L > 0) {
      const raw = [];
      for (let i = 0; i < samples; i++) { const pt = path.getPointAtLength(L * i / samples); raw.push([pt.x, pt.y]); }
      const xs = raw.map(p => p[0]), ys = raw.map(p => p[1]);
      const a = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
      if (a > bestArea) { bestArea = a; best = raw; }
    }
    host.removeChild(path);
  });
  host.remove();
  if (!best || best.length < 3) return null;

  const xs = best.map(p => p[0]), ys = best.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, s = 2 / Math.max(maxX - minX, maxY - minY);
  return best.map(([x, y]) => `${((x - cx) * s).toFixed(3)} ${((y - cy) * s).toFixed(3)}`).join('  ');
}
if (typeof window !== 'undefined') window.svgToPolygon = svgToPolygon;

export {
  getCSSVar,
  getNodeColor,
  getEdgeColor,
  getEdgeActiveColor
};