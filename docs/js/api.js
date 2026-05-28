/////////////////////
// ARCHIVO api.js
/////////////////////

console.log("API FILE TEST 777");

async function createModelForUser(userId) {

  // 1. crear modelo
  const { data: model, error: modelError } = await supabaseClient
    .from("models")
    .insert({
      name: "Mi modelo"
    })
    .select()
    .single();

  if (modelError || !model) {
    console.error("ERROR creando modelo:", modelError);
    return null;
  }

  console.log("MODELO CREADO:", model);

  const { error: confirmError } = await supabaseClient
  .from("models")
  .select("id")
  .eq("id", model.id)
  .single();

if (confirmError) {
  console.error("Modelo no visible aún en DB:", confirmError);
  return null;
}

  // 2. relación model_users
  const { error: relError } = await supabaseClient
    .from("model_users")
    .insert({
      model_id: model.id,
      user_id: userId,
      role: "owner"
    });

  if (relError) {
    console.error("ERROR model_users:", relError);
    return null;
  }

  // 3. crear units
  console.log("CREANDO UNITS PARA:", model.id);
  await createDefaultUnits(model.id);

  // 4. devolver ID (IMPORTANTE)
  return model.id;
}

function waitForHandleData(callback, retries = 20) {

  if (typeof window.handleData === "function") {
    callback();
    return;
  }

  if (retries <= 0) {
    console.error("handleData nunca apareció");
    return;
  }

  setTimeout(() => {
    waitForHandleData(callback, retries - 1);
  }, 50);
}

// ==============================
// TEST MINIMO SUPABASE
// ==============================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

export const supabaseClient = createClient(
  "https://rgfftmdxmsftgxmevpqj.supabase.co",
  "sb_publishable_tNeS3BfRScwEchCnj6H_-w_YiZF_49N"
);

window.supabaseClient = supabaseClient;

window.addEventListener("DOMContentLoaded", init);

async function init() {

  console.log("INIT...");

  // =========================
  // 1. SESSION
  // =========================

  const { data: sessionData } = await supabaseClient.auth.getSession();
  const session = sessionData.session;

  if (!session) {
    await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href }
    });
    return;
  }

  const user = session.user;
  window.__USER_ID = user.id;
  console.log("USER:", user);

  // =========================
  // 2. VALIDAR USUARIO (tabla users)
  // =========================

 let { data: userDb, error } = await supabaseClient
  .from('users')
  .select('*')
  .eq('id', user.id)
  .maybeSingle();

if (error) {
  console.error("Error users:", error);
  mostrarError("Error consultando usuario");
  return;
}



// 2. SI NO EXISTE POR ID → buscar por email
if (!userDb) {

  const { data: existingByEmail } = await supabaseClient
    .from('users')
    .select('*')
    .eq('email', user.email)
    .maybeSingle();

  if (existingByEmail) {

    console.log("Usuario existe por email → usar existente");

    userDb = existingByEmail;

  } else {

    console.log("Usuario no existe → creando");

    const { data: newUser, error: insertError } = await supabaseClient
      .from('users')
      .insert({
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || '',
        status: 'ACTIVE'
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creando user:", insertError);
      mostrarError("Error creando usuario");
      return;
    }

    userDb = newUser;
  } 
}

console.log("USER DB:", userDb);

// 🔒 VALIDACIÓN FINAL
if (userDb.status !== 'ACTIVE') {
  mostrarNoAutorizado();
  return;
}

  console.log("USUARIO VALIDADO ✔");

  window.CURRENT_USER_NAME  = userDb.name  || userDb.email || '—';
  window.CURRENT_USER_COLOR = userDb.color || null;

  // =========================
  // 3. CARGAR MODELO
  // =========================

  await loadData(userDb.id);
}

async function loadData(userId) {

  console.log("LOAD DATA...");

  const cleanUserId = userId.trim();

  // ==========================
  // 1. OBTENER MODEL ID
  // ==========================
  const { data: mu, error: muError } = await supabaseClient
    .from('model_users')
    .select('model_id')
    .eq('user_id', cleanUserId)
    .limit(1);

  if (muError) {
    console.error("ERROR model_users:", muError);
    return;
  }

 if (!mu || mu.length === 0) {
  console.warn("No hay modelo → creando uno...");

  const newModelId = await createModelForUser(cleanUserId);

  if (!newModelId) {
    console.error("No se pudo crear modelo");
    return;
  }

  // 🔥 IMPORTANTE: NO seguir con ID viejo
  return loadData(cleanUserId);


  }

  const _urlM    = new URLSearchParams(window.location.search).get('m');
  const model_id = _urlM || mu[0].model_id;
  window.MODEL_ID = model_id;

  console.log("MODEL:", model_id);

  // ==========================
  // 2. FETCH PRINCIPAL
  // ==========================
  const [
    nodesRes,
    linksRes,
    valuesRes,
    unitsRes,
    groupsRes,
    conceptsRes,
    modelRes,
    authorRes
  ] = await Promise.all([

    supabaseClient.from('nodes').select('*').eq('model_id', model_id),
    supabaseClient.from('links').select('*').eq('model_id', model_id),
    supabaseClient.from('time_values').select('*').eq('model_id', model_id),
    supabaseClient.from('units').select('*').eq('model_id', model_id),
    supabaseClient.from('groups').select('*').eq('model_id', model_id),
    supabaseClient.from('concepts').select('*').eq('model_id', model_id),
    supabaseClient.from('models').select('*').eq('id', model_id).single(),
    supabaseClient.from('model_users').select('user_id, role, users(name, color)').eq('model_id', model_id).eq('role', 'owner').limit(1)

  ]);

  // Exponer modelo y author globalmente
  window.MODEL_DATA         = modelRes.data || {};
  const _authorRow          = authorRes.data?.[0];
  window.MODEL_AUTHOR       = _authorRow
    ? (_authorRow.users?.name || _authorRow.user_id.slice(0, 8) + '...')
    : '—';
  window.MODEL_AUTHOR_COLOR = _authorRow?.users?.color || null;

  // ==========================
  // 3. LINK IDS
  // ==========================
  const linkIds = (linksRes.data || []).map(l => l.id);

  console.log("LINK IDS:", linkIds);

  // ==========================
  // 4. FETCH LINK_CONCEPTS
  // ==========================
  let linkConcepts = [];

  if (linkIds.length > 0) {

    const { data: lcData, error: lcError } = await supabaseClient
      .from('link_concepts')
      .select('*')
      .in('link_id', linkIds);

    if (lcError) {
      console.error("ERROR link_concepts:", lcError);
    } else {
      linkConcepts = lcData || [];
    }

  }

  console.log("LINK CONCEPTS:", linkConcepts);

  // ==========================
  // 5. DATA FINAL
  // ==========================
  const data = {
    model_id,
    model: modelRes.data || {},
    nodes: nodesRes.data || [],
    links: linksRes.data || [],
    values: valuesRes.data || [],
    units: unitsRes.data || [],
    groups: groupsRes.data || [],
    concepts: conceptsRes.data || [],
    linkConcepts: linkConcepts
  };

  console.log("DATA FINAL:", data);

  // ==========================
  // 6. HANDOFF
  // ==========================
  window.handleData(data);
}


// ==============================
// QUEUE POSITIONS (simple)
// ==============================

window.queuePositions = async function(positions) {


  console.log("SAVING POSITIONS...", positions);

  try {

    for (const [id, pos] of Object.entries(positions)) {

        if (id.startsWith("badge_")) {
          continue;
        }

      const { error } =
      await window.supabaseClient
        .from('nodes')
        .update({
          x: pos.x,
          y: pos.y
        })
        .eq('id', id);

      if (error) {
        console.error("ERROR saving:", error);
      }
    }

    console.log("POSITIONS SAVED ✔");

  } catch (e) {
    console.error("SAVE ERROR:", e);
  }
};

/////////////////////////////////////////////////////////
// NODE DATA
/////////////////////////////////////////////////////////

window.queueNodeData =
async function(nodeId, field, value) {

  const payload = {};

  ///////////////////////////////////////////////////////
  // FIELDS
  ///////////////////////////////////////////////////////

  if (field === "title") {
    payload.label = value;
  }

  if (field === "unit") {
    payload.unit_id = value;
  }

  if (field === "shape") {
    payload.shape = value;
  }

  if (field === "color") {
    payload.color = value;
  }

  if (field === "alpha") {
    payload.alpha = value;
  }

  if (field === "size_px") {
    payload.size_px = value;
  }

  if (field === "size_type") {
    payload.size_type = value;
  }


  if (Object.keys(payload).length === 0) {
    return;
  }

  ///////////////////////////////////////////////////////

  try {

    const { error } =
      await window.supabaseClient
        .from('nodes')
        .update(payload)
        .eq('id', nodeId);

    if (error) {

      console.error(
        "NODE DATA ERROR:",
        error
      );

      return;
    }

    console.log(
      "NODE DATA SAVED ✔"
    );

  } catch (e) {

    console.error(
      "NODE DATA EXCEPTION:",
      e
    );

  }

};

window.queueWorkspace = async function(workspace) {
  const modelId = window.MODEL_ID;
  if (!modelId) return;
  try {
    const { error } = await window.supabaseClient
      .from('models')
      .update({ workspace })
      .eq('id', modelId);
    if (error) throw error;
  } catch (e) {
    console.error('queueWorkspace ERROR:', e);
  }
};

window.queueValueData = async function(nodeId, value) {
  const modelId = window.MODEL_ID;
  const period  = window.CURRENT_PERIOD || 1;
  if (!modelId || !nodeId) return;

  const numVal = value === '' ? null : parseFloat(value);
  if (value !== '' && isNaN(numVal)) return;

  const key      = `${nodeId}_${period}`;
  const existing = window.VALUES_DATA?.[key];

  try {
    if (existing) {
      const { error } = await window.supabaseClient
        .from('time_values')
        .update({ value: numVal })
        .eq('id', existing.id);
      if (error) throw error;
      existing.value = numVal;
    } else {
      const { data, error } = await window.supabaseClient
        .from('time_values')
        .insert({ model_id: modelId, node_id: nodeId, period, value: numVal })
        .select()
        .single();
      if (error) throw error;
      if (!window.VALUES_DATA) window.VALUES_DATA = {};
      window.VALUES_DATA[key] = data;
    }
    console.log('VALUE SAVED ✔', nodeId, period, numVal);
  } catch (e) {
    console.error('queueValueData ERROR:', e);
  }
};

function mostrarNoAutorizado() {

  const app = document.getElementById("app");

  if (app) {
    app.innerHTML = `
      <div style="
        display:flex;
        height:100%;
        align-items:center;
        justify-content:center;
        background:#111;
        color:white;
        font-family:sans-serif;
      ">
        <div>
          <h2>Acceso no habilitado</h2>
          <p>Tu usuario no está registrado.</p>
        </div>
      </div>
    `;
  } else {
    document.body.innerHTML = "<h2>No autorizado</h2>";
  }
}

function mostrarError(msg) {
  const app = document.getElementById("app");

  if (app) {
    app.innerHTML = `<h2 style="color:white">${msg}</h2>`;
  }
}

window.linkConceptToEdge = async function(edgeId, conceptId) {

  const { error } = await supabaseClient
    .from('link_concepts')
    .upsert({
      link_id: edgeId,
      concept_id: conceptId
    }, {
      onConflict: 'link_id,concept_id'
    });

  if (error) {
    console.error("linkConcept error", error);
  }
};

function randomColor() {
  return "#" + Math.floor(Math.random()*16777215).toString(16);
}

window.unlinkConceptFromEdge = async function(edgeId, conceptId) {

    // 🔥 DEBUG AUTH
  const { data } = await supabaseClient.auth.getSession();
  console.log("SESSION DEBUG:", data.session);

  const { error } = await supabaseClient
    .from('link_concepts')
    .delete()
    .eq('link_id', edgeId)
    .eq('concept_id', conceptId);

  if (error) {
    console.error("unlinkConcept error", error);
  }
};

window.createConcept = async function(name, model_id, color, comment) {

  const { data, error } = await supabaseClient
    .from('concepts')
    .insert({
      label: name,
      color: color || "#888888",
      comment: comment || null,
      model_id
    })
    .select()
    .single();

  if (error) {
    console.error("createConcept error", error);
    return null;
  }

  return data;
};

window.deleteConcept = async function(conceptId) {

  const model_id = getState().model_id;

  // 1. borrar relaciones
  await supabaseClient
    .from('link_concepts')
    .delete()
    .eq('concept_id', conceptId);

  // 2. 🔥 borrar concepto con filtro correcto
  const { data, error } = await supabaseClient
    .from('concepts')
    .delete()
    .eq('id', conceptId)
    .select();

  console.log("DELETE RESULT:", data);

  if (error) {
    console.error("deleteConcept error", error);
    return;
  }

  // 🔴 SI ESTO VIENE VACÍO → NO BORRÓ NADA
  if (!data || data.length === 0) {
    console.warn("NO SE BORRÓ NINGUNA FILA");
    return;
  }

  delete CONCEPTS_MAP[conceptId];

  await loadData(window.__USER_ID);

  // 🔥 re-render panel abierto
  if (document.getElementById("bottom-panel")?.classList.contains("open")) {
    window.openCreateConceptPanel();
  }
};

/* POBLAR TABLA UNITS CON NUEVO MODELO */

async function createDefaultUnits(modelId) {
  const units = [
    { name: "$", min_value: 0, max_value: 1000000, min_sz: 20, max_sz: 120 },
    { name: "%", min_value: 0, max_value: 100, min_sz: 20, max_sz: 80 },
    { name: "#", min_value: 0, max_value: 1000, min_sz: 20, max_sz: 100 },
    { name: "u", min_value: 0, max_value: 100, min_sz: 20, max_sz: 80 },

    { name: "m2", min_value: 0, max_value: 5000, min_sz: 20, max_sz: 120 },
    { name: "m3", min_value: 0, max_value: 10000, min_sz: 20, max_sz: 120 },
    { name: "kg", min_value: 0, max_value: 10000, min_sz: 20, max_sz: 120 },
    { name: "ton", min_value: 0, max_value: 1000, min_sz: 20, max_sz: 120 },
  ];

  console.log("CREANDO UNITS PARA:", modelId);

  // 🔥 DEBUG ACÁ
  const { data } = await supabaseClient.auth.getSession();
  console.log("SESSION DEBUG:", data.session);


  const payload = units.map(u => ({
    model_id: modelId,
    ...u
  }));

  const { error } = await supabaseClient
    .from("units")
    .insert(payload);

    if (error) {
      console.error("Error creando units:", error);
    } else {
      console.log("Units creadas ✔");
    }
  }

  export async function fetchUnits(modelId) {
  const { data, error } = await supabaseClient
    .from("units")
    .select("*")
    .eq("model_id", modelId);


  if (error) {
    console.error("Error cargando units:", error);
    return [];
  }

  return data;
  }

