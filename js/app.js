let lastVersion = null

const sheetID = "1ueA3rlAOzI7nemlilQiXh0r45O-d6SOu3pkxh9USqn4"

const nodesURL =`https://docs.google.com/spreadsheets/d/${sheetID}/gviz/tq?tqx=out:json&sheet=nodes`

const edgesURL =`https://docs.google.com/spreadsheets/d/${sheetID}/gviz/tq?tqx=out:json&sheet=edges`

const modelURL =`https://docs.google.com/spreadsheets/d/${sheetID}/gviz/tq?tqx=out:json&sheet=model`

const infoURL =`https://docs.google.com/spreadsheets/d/${sheetID}/gviz/tq?tqx=out:json&sheet=info`

const unitsURL =`https://docs.google.com/spreadsheets/d/${sheetID}/gviz/tq?tqx=out:json&sheet=units`

let cy

let nodeLabels = {}

const period = 1


async function loadSheet(url){

 const res = await fetch(url + "&t=" + Date.now(), {cache:"no-store"})

 const text = await res.text()

 const json = JSON.parse(text.substring(47).slice(0,-2))

 const rows = json.table.rows.map(r =>
   r.c.map(c => c ? c.v : "")
 )

 return rows

}



async function init(){

const nodesRows = await loadSheet(nodesURL)
const edgesRows = await loadSheet(edgesURL)



const nodeElements = nodesRows
.filter(r => r[0])
.map(r => {

nodeLabels[r[0]] = r[1]

return {

data:{
 id:String(r[0]),
 name:r[1],
 unit:r[2],
 parent:r[3],
 group:r[4],
 value:"",
 size:r[7],
 bgcolor:r[8],
 txcolor:r[9],
 tx1t:r[10],
 tx2:r[11],
 tx3:r[12]

},

position:{
 x:Number(r[5]),
 y:Number(r[6])
}

}

})



const edgeElements = edgesRows
.slice(1)
.filter(r => r[0] && r[1])
.map(r => ({

data:{
source:String(r[0]),
target:String(r[1])
}

}))



cy = cytoscape({

container: document.getElementById("cy"),

elements:[
...nodeElements,
...edgeElements
],

style:[

{
selector:'node',
style:{
'label':'data(label)',
'text-valign':'center',
'text-halign':'center',
'background-color':'#2E86DE',
'color':'white',
'text-wrap':'wrap'
}
},

{
selector:'edge',
style:{
'curve-style':'bezier',
'target-arrow-shape':'triangle',
'line-color':'#aaa',
'target-arrow-color':'#aaa'
}
}

],

layout:{
name:'preset'
}

})

loadModel()

setInterval(() => {
    loadModel()
}, 2000)

}



async function loadModel(){

const rows = await loadSheet(modelURL)



rows
.filter(r => r[0])
.forEach(r => {

let id = String(r[0])

let value = r[period]

let node = cy.getElementById(id)

if(node.length){

node.data("label",
nodeLabels[id] + "\n" + value
)

}

})



document.getElementById("status").innerText =
"actualizado " + new Date().toLocaleTimeString()

console.log("refresh model")

}


init()
