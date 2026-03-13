
const API_URL = "https://script.google.com/macros/s/AKfycby_MB4tF-tw6IEFFXbO4W-Gf6tKBBjB25_osZKpapBuAnLts_8dAQZg7z1Vl6pas9P7/exec"


let cy

let model = {
nodes:[],
edges:[],
table:[]
}

function initGraph(){

cy = cytoscape({

container: document.getElementById('graph'),

elements:[],

style:[

{
selector:'node',
style:{
'label':'data(label)',
'background-color':'#0074D9',
'color':'white',
'text-valign':'center'
}
},

{
selector:'edge',
style:{
'width':2,
'line-color':'#999',
'target-arrow-shape':'triangle'
}
}

],

layout:{name:'preset'}

})

cy.on('tap','node',function(evt){

const id = evt.target.id()

highlightRow(id)

})

}

function createNode(){

const id = prompt("node id")

if(!id) return

const node = {
data:{id:id,label:id},
position:{x:200,y:200}
}

model.nodes.push(node)

cy.add(node)

model.table.push({
node:id,
values:["","",""]
})

renderTable()

}

function renderTable(){

const tableDiv = document.getElementById("table")

let html = "<table>"

html += "<tr><th>node</th><th>t1</th><th>t2</th><th>t3</th></tr>"

model.table.forEach(row=>{

html += `<tr id="row_${row.node}">`

html += `<td>${row.node}</td>`

row.values.forEach(v=>{

html += `<td contenteditable="true">${v}</td>`

})

html += "</tr>"

})

html += "</table>"

tableDiv.innerHTML = html

}

function highlightRow(id){

document.querySelectorAll("tr").forEach(tr=>{
tr.classList.remove("selected")
})

const row = document.getElementById("row_"+id)

if(row){
row.classList.add("selected")
row.scrollIntoView({behavior:"smooth"})
}

}

function loadModel(){

fetch(API_URL+"?action=loadModel")

.then(r=>r.json())

.then(data=>{

model.nodes = data.nodes
model.table = data.table

cy.elements().remove()

cy.add(model.nodes)

renderTable()

})

}

window.onload = function(){

initGraph()

}
