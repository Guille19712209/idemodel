// ==============================
// IDEMODEL API - APPS SCRIPT
// ==============================

const SHEET_NODES = "nodes"
const SHEET_MODEL = "model"
const SHEET_META = "meta"
const SHEET_UNITS = "units"

// 🔥 NUEVO
const SHEET_CONCEPT_LINKS = "concept_links"


function doGet(e) {

  // =====================
  // NODES
  // =====================
  const sheet = getSheet(SHEET_NODES);
  const values = sheet.getDataRange().getValues();

  const headers = values[0];

  const nodes = values
    .slice(1)
    .filter(row => row[0] && row[0].toString().trim() !== "")
    .map(row => {
      let obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });

  // =====================
  // MODEL
  // =====================
  const sheetModel = getSheet(SHEET_MODEL);
  const valuesModel = sheetModel.getDataRange().getValues();

  const headersModel = valuesModel[0];

  const model = valuesModel
    .slice(1)
    .filter(row => row[0] && row[0].toString().trim() !== "")
    .map(row => {
      let obj = {};
      headersModel.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });

  // =====================
  // 🔥 CONCEPT LINKS (NUEVO)
  // =====================
  const conceptLinks = getConceptLinks();

  // =====================
  // RESULT
  // =====================
  const result = { 
    nodes, 
    model,
    conceptLinks // 🔥 CLAVE
  };

  const callback = e.parameter.callback;

  if (callback) {
    return ContentService
      .createTextOutput(callback + "(" + JSON.stringify(result) + ")")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return json(result);
}


// ==============================
// 🔥 GET CONCEPT LINKS
// ==============================
function getConceptLinks() {

  const sheet = getSheet(SHEET_CONCEPT_LINKS);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  data.shift(); // headers

  return data
    .filter(row => row[0])
    .map(row => ({
      edge_id: String(row[0]),
      concept_id: String(row[1])
    }));
}


// ==============================
// POST (ACTIONS)
// ==============================

function doPost(e) {
  const data = JSON.parse(e.postData.contents);

  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName("data");

  sheet.appendRow([
    new Date(),
    data.nodeId,
    data.label,
    data.t1,
    data.t2,
    data.t3
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({
      message: "guardado estructurado"
    }))
    .setMimeType(ContentService.MimeType.JSON);
}


function getPeriods(){
  const sheet = getSheet(SHEET_META)
  const data = sheet.getDataRange().getValues()

  const rows = data.slice(1)

  const row = rows.find(r => r[0] === "periods")

  if(!row) return []

  let raw = row[1]

  if(typeof raw !== "string"){
    raw = String(raw)
  }

  return raw
    .split(",")
    .map(x => Number(x.trim()))
    .filter(x => !isNaN(x))
}


// ==============================
// WRITE FUNCTIONS
// ==============================
function saveCell(node_id, period, formula){

  const sheet = getSheet(SHEET_VALUES)
  const data = sheet.getDataRange().getValues()

  for(let i=1;i<data.length;i++){
    if(data[i][0] == node_id && data[i][1] == period){
      sheet.getRange(i+1,3).setValue(formula)
      return
    }
  }

  sheet.appendRow([node_id, period, formula])
}


// ------------------------------
function createNode(node_id){

  if(!node_id) throw new Error("INVALID_NODE")

  const sheet = getSheet(SHEET_NODES)
  const data = sheet.getDataRange().getValues()

  const exists = data.some((r,i) => i>0 && r[0] == node_id)

  if(exists){
    throw new Error("NODE_EXISTS")
  }

  sheet.appendRow([node_id])
}


// ------------------------------
function deleteNode(node_id){

  const sheetN = getSheet(SHEET_NODES)
  const dataN = sheetN.getDataRange().getValues()

  for(let i=dataN.length-1;i>=1;i--){
    if(dataN[i][0] == node_id){
      sheetN.deleteRow(i+1)
    }
  }

  const sheetV = getSheet(SHEET_VALUES)
  const dataV = sheetV.getDataRange().getValues()

  for(let i=dataV.length-1;i>=1;i--){
    if(dataV[i][0] == node_id){
      sheetV.deleteRow(i+1)
    }
  }
}


// ==============================
// HELPERS
// ==============================
function getSheet(name){
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  return ss.getSheetByName(name)
}

function json(obj){
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
}