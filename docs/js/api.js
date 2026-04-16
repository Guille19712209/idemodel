/////////////////////
// ARCHIVO api.js
/////////////////////


// ==============================
// TEST MINIMO SUPABASE
// ==============================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseClient = createClient(
  "https://rgfftmdxmsftgxmevpqj.supabase.co",
  "sb_publishable_tNeS3BfRScwEchCnj6H_-w_YiZF_49N"
);

// opcional para debug
window.supabaseClient = supabaseClient;

window.addEventListener("DOMContentLoaded", init);

async function init() {

  console.log("INIT...");

  const { data: { user } } = await supabaseClient.auth.getUser();

  console.log("USER:", user);

  if (!user) {
    await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.href
      }
    });
    return;
  }

  console.log("LOGIN OK ✔");

}

/* const SUPABASE_URL = "https://rgfftmdxmsftgxmevpqj.supabase.co";
const SUPABASE_KEY = "sb_publishable_tNeS3BfRScwEchCnj6H_-w_YiZF_49N";

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

// arrancar directo
loadData_UI();

///////////////////////////////
// 🔥 MODE CONTROL
///////////////////////////////

const USE_BATCH = true;

async function loadData_UI() {

  const { data: { user } } = await supabaseClient.auth.getUser();

  if (!user) {
  await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.href
    }
  });
  return;
  }
  
  // 🔒 WHITELIST CHECK
  const { data: allowedUsers } = await supabaseClient
    .from('allowed_users')
    .select('*')
    .eq('email', user.email);

  if (!allowedUsers || allowedUsers.length === 0) {
    alert("Access not allowed!");

    await supabaseClient.auth.signOut();
    return;
  }


  const { data: models } = await supabaseClient
    .from('models')
    .select('*')
    .eq('owner_id', user.id)
    .limit(1);

let modelRow = models?.[0];

if (!modelRow) {

  console.log("Creando modelo inicial...");

  const { data: newModel, error } = await supabaseClient
    .from('models')
    .insert({
      name: "Mi primer modelo",
      owner_id: user.id
    })
    .select()
    .single();

  if (error) {
    console.error("Error creando modelo:", error);
    return;
  }

  modelRow = newModel;
}

// 🔥 crear datos iniciales si no hay nodos

const { data: existingNodes } = await supabaseClient
  .from('nodes')
  .select('*')
  .eq('model_id', modelRow.id);

if (!existingNodes || existingNodes.length === 0) {

  console.log("Creando nodos iniciales...");

  await supabaseClient.from('nodes').insert([
    {
      id: 'nodo_1',
      label: 'Ventas',
      x: 0,
      y: 0,
      model_id: modelRow.id
    },
    {
      id: 'nodo_2',
      label: 'Costos',
      x: 150,
      y: 0,
      model_id: modelRow.id
    },
    {
      id: 'nodo_3',
      label: 'Resultado',
      x: 75,
      y: 100,
      model_id: modelRow.id
    }
  ]);

}

  const model_id = modelRow.id;

  const [
    nodesRes,
    modelRes,
    conceptsRes,
    linksRes,
    configRes
  ] = await Promise.all([
    supabaseClient.from('nodes').select('*').eq('model_id', model_id),
    supabaseClient.from('model').select('*').eq('model_id', model_id),
    supabaseClient.from('concepts').select('*').eq('model_id', model_id),
    supabaseClient.from('concept_links').select('*').eq('model_id', model_id),
    supabaseClient.from('config').select('*').eq('model_id', model_id)
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



async function __flushChanges() {

  console.log("FLUSH EXECUTED", __changeQueue);

  if (__changeQueue.length === 0) return;

  const merged = {};

  __changeQueue.forEach(change => {
    if (change.type === "positions") {
      merged.positions = {
        ...(merged.positions || {}),
        ...change.data
      };
    }
  });

  if (merged.positions) {

    const updates = Object.entries(merged.positions);

    for (const [id, pos] of updates) {

      const { error } = await supabaseClient
        .from('nodes')
        .update({
          x: pos.x,
          y: pos.y
        })
        .eq('id', id);

      if (error) {
        console.error("Error guardando:", error);
      }
    }

    console.log("POSITIONS SAVED ✔");
  }

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

window.queuePositions = queuePositions;
window.queueWorkspace = queueWorkspace;
window.queueConfig = queueConfig;

window.sendWorkspaceToAPI = function() {
  // noop por ahora
}; */