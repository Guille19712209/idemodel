window.queueNodeData =
async function(nodeId, field, value) {

  const payload = {};

  if (field === "title") {
    payload.label = value;
  }

  if (field === "unit") {
    payload.unit_id = value;
  }

  if (field === "value") {
    payload.value = value;
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

  try {

    const { error } = await window.supabaseClient
      .from('nodes')
      .update(payload)
      .eq('id', nodeId);

    if (error) {
      console.error("NODE DATA ERROR:", error);
      return;
    }

    console.log("NODE DATA SAVED ✔");

  } catch (e) {

    console.error("NODE DATA EXCEPTION:", e);

  }

};