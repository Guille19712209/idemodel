/////////////////////
// ARCHIVO api.js
/////////////////////

console.log("API VERSION NUEVA"); 

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

  const { data } = await supabaseClient.auth.getUser();
  const user = data.user;

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
  await loadData(user.id);
}

async function loadData(userId) {

  console.log("LOAD DATA...");

  console.log("USER ID RAW:", userId);
  console.log("USER ID LENGTH:", userId.length);

  const cleanUserId = userId.trim();

  console.log("USER ID CLEAN:", cleanUserId);
  console.log("USER ID CLEAN LENGTH:", cleanUserId.length);

  // 1. obtener modelo del usuario
  const { data: mu } = await supabaseClient
    .from('model_users')
    .select('model_id')
    .eq('user_id', cleanUserId)
    .limit(1);
    
  if (!mu || mu.length === 0) {
    console.warn("No hay modelo");
    return;
  }

  const model_id = mu[0].model_id;

  console.log("MODEL:", model_id);

  // 2. traer datos reales
  const [
    nodesRes,
    linksRes,
    valuesRes,
    unitsRes,
    groupsRes
  ] = await Promise.all([

    supabaseClient.from('nodes').select('*').eq('model_id', model_id),
    supabaseClient.from('links').select('*').eq('model_id', model_id),
    supabaseClient.from('time_values').select('*').eq('model_id', model_id),
    supabaseClient.from('units').select('*').eq('model_id', model_id),
    supabaseClient.from('groups').select('*').eq('model_id', model_id)

  ]);

  const data = {
    nodes: nodesRes.data || [],
    links: linksRes.data || [],
    values: valuesRes.data || [],
    units: unitsRes.data || [],
    groups: groupsRes.data || []
  };

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
