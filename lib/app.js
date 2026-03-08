

async function loadModel(){


const edgesCSV ="https://docs.google.com/spreadsheets/d/e/2PACX-1vT43b07k8koGYDSYEFIC3ibPUaPQAsJ8VBi15AXwH7YQNd6tyYUG0_Id2yHgf3eo1SXcy-AdLr3h_CY/pub?gid=527960938&single=true&output=csv&t=" + Date.now()
fetch(edgesCSV)

const nodesCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT43b07k8koGYDSYEFIC3ibPUaPQAsJ8VBi15AXwH7YQNd6tyYUG0_Id2yHgf3eo1SXcy-AdLr3h_CY/pub?gid=0&single=true&output=csv&t=" + Date.now()
fetch(nodesCSV)


const nodes = parseNodes(nodesCSV)
const edges = parseEdges(edgesCSV)

initGraph(nodes,edges)

}

function parseNodes(csv){

const lines = csv.trim().split("\n")

return lines.slice(1).map(l=>{

const c = l.split(",")

return {
data:{
id:c[0],
label:c[1],
value: "123",
size:c[6],
unit:c[2]
},
position:{
x:parseFloat(c[4]) || Math.random()*600,
y:parseFloat(c[5]) || Math.random()*400
}
}

})

}

function parseEdges(csv){

const lines = csv.trim().split("\n")

return lines.slice(1).map(l=>{

const c = l.split(",")

return {
data:{
source:c[0],
target:c[1]
}
}

})

}

function initGraph(nodes,edges){

var cy = cytoscape({

container: document.getElementById('cy'),

elements:[
...nodes,
...edges
],

layout:{
name:"preset"
},

style:[

{
selector:"node",
style:{

'background-color':'#2E86AB',
'color':'white',
'font-family': 'Poppins',
'font-size': '12px',
'font-weight': 500,
'text-valign':'center',
'text-halign':'center',
'width': 'data(size)',
'height': 'data(size)',
}
},

{
selector:"edge",
style:{
'width':2,
'line-color':'#999',
'target-arrow-shape':'triangle',
'target-arrow-color':'#999',
'curve-style':'bezier'
}
}

]

})

cy.nodes().forEach(node => {
node.grabbable(true)
})

cy.on('dragfree','node', function(evt){

const node = evt.target

console.log(
node.id(),
node.position()
)

})

cy.on('tap','node', function(evt){

const node = evt.target

alert(node.data('label'))

})

cy.nodeHtmlLabel([
{
  query:'node',
  tpl:function(data){

    return `
    <div class="nodeLabel">

      <div class="nodeTitle">${data.label}</div>
      <div class="nodeValue">${data.value}</div>
      <div class="nodeUnit">${data.unit}</div>

    </div>
    `
  }
}
])

}


loadModel()



