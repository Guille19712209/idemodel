/////////////////////
// ARCHIVO api.js
/////////////////////

const SUPABASE_URL = "https://TU_PROJECT.supabase.co";
const SUPABASE_KEY = "TU_ANON_KEY";

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);
///////////////////////////////
// 🔥 MODE CONTROL
///////////////////////////////

const USE_BATCH = true;

async function loadData() {

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    await supabase.auth.signInWithOAuth({ provider: 'google' });
    return;
  }

  const { data: models } = await supabase
    .from('models')
    .select('*')
    .eq('owner_id', user.id)
    .limit(1);

  const modelRow = models?.[0];
  if (!modelRow) {
    console.warn("No hay modelo");
    return;
  }

  const model_id = modelRow.id;

  const [
    nodesRes,
    modelRes,
    conceptsRes,
    linksRes,
    configRes
  ] = await Promise.all([
    supabase.from('nodes').select('*').eq('model_id', model_id),
    supabase.from('model').select('*').eq('model_id', model_id),
    supabase.from('concepts').select('*').eq('model_id', model_id),
    supabase.from('concept_links').select('*').eq('model_id', model_id),
    supabase.from('config').select('*').eq('model_id', model_id)
  ]);

  const configObj = {};
  let workspace = {};

  (configRes.data || []).forEach(row => {
    configObj[row.key] = row.value;

    if (row.key === "workspace") {
      try {
        workspace = JSON.parse(row.value);
      } catch (e) {}
    }
  });

  const data = {
    nodes: nodesRes.data || [],
    model: modelRes.data || [],
    concepts: conceptsRes.data || [],
    conceptLinks: linksRes.data || [],
    config: configObj,
    workspace
  };

  window.handleData(data);
}

// ==============================
// ⚠️ NOTA IMPORTANTE
// ==============================
// Estas funciones NO se usan en este flujo (JSONP)
// Se dejan para futuro si migrás a google.script.run
// ==============================

function apiGetConcepts() {
  return new Promise(resolve => {
    google.script.run.withSuccessHandler(resolve).getConcepts();
  });
}

function apiGetConceptLinks() {
  return new Promise(resolve => {
    google.script.run.withSuccessHandler(resolve).getConceptLinks();
  });
}

function apiAddConceptLink(edgeId, conceptId) {
  return new Promise(resolve => {
    google.script.run.withSuccessHandler(resolve).addConceptLink(edgeId, conceptId);
  });
}

function apiCreateConcept(name, color) {
  return new Promise(resolve => {
    google.script.run.withSuccessHandler(resolve).createConcept(name, color);
  });
}


function sendPositionsToAPI() {}

function sendWorkspaceToAPI() {}

///////////////////////////////
// 🔥 BATCH QUEUE (NUEVO)
///////////////////////////////

let __changeQueue = [];
let __syncTimeout = null;

function __queueChange(change) {

  __changeQueue.push(change);

  if (!__syncTimeout) {
    __syncTimeout = setTimeout(__flushChanges, 2000);
  }
}

function __flushChanges() {

  console.log("FLUSH EXECUTED", __changeQueue);

  if (__changeQueue.length === 0) return;

  // 🔥 COMPACTAR CAMBIOS

const merged = {};

  __changeQueue.forEach(change => {

    if (change.type === "positions") {
      merged.positions = {
        ...(merged.positions || {}),
        ...change.data
      };
    }

    if (change.type === "workspace") {
      merged.workspace = change.data;
    }

    if (change.type === "config") {
      merged.config = change.data;
    }

  });

  const compactedQueue = [];

  if (merged.positions) {
    compactedQueue.push({ type: "positions", data: merged.positions });
  }

  if (merged.workspace) {
    compactedQueue.push({ type: "workspace", data: merged.workspace });
  }

  if (merged.config) {
    compactedQueue.push({ type: "config", data: merged.config });
  }
  
  const payload = JSON.stringify(compactedQueue);

  const url = API_URL +
    "?action=batchUpdate" +
    "&data=" + payload +
    "&_=" + Date.now();

  const script = document.createElement("script");
  script.src = url;

  script.onload = () => script.remove();

  document.body.appendChild(script);

    __changeQueue = [];
    __syncTimeout = null;
  }

///////////////////////////////
// 🔥 WRAPPERS BATCH (NUEVO)
///////////////////////////////

function queueWorkspace(workspace) {
  __queueChange({
    type: "workspace",
    data: workspace
  });
}

function queuePositions(positions) {

  __queueChange({
    type: "positions",
    data: positions
  });

}

function queueConfig(key, value) {
  __queueChange({
    type: "config",
    data: { key, value }
  });
}