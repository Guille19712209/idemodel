/////////////////////
// ARCHIVO api.js
/////////////////////

console.log("API VERSION NUEVA"); 

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

const supabaseClient = createClient(
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
    console.warn("No hay modelo");
    return;
  }

  const model_id = mu[0].model_id;

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
    conceptsRes
  ] = await Promise.all([

    supabaseClient.from('nodes').select('*').eq('model_id', model_id),
    supabaseClient.from('links').select('*').eq('model_id', model_id),
    supabaseClient.from('time_values').select('*').eq('model_id', model_id),
    supabaseClient.from('units').select('*').eq('model_id', model_id),
    supabaseClient.from('groups').select('*').eq('model_id', model_id),
    supabaseClient.from('concepts').select('*').eq('model_id', model_id)

  ]);

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

      const { error } = await supabaseClient
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