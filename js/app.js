

console.log("idemodel start")

const cy = cytoscape({

  container: document.getElementById('cy'),

  elements:[
    { data:{ id:'a', label:'A'} },
    { data:{ id:'b', label:'B'} },
    { data:{ id:'ab', source:'a', target:'b'} }
  ],

  style:[
    {
      selector:'node',
      style:{
        'background-color':'#4a90e2',
        'label':'data(label)',
        'color':'#fff',
        'text-valign':'center',
        'text-halign':'center'
      }
    },
    {
      selector:'edge',
      style:{
        'width':2,
        'line-color':'#aaa'
      }
    }
  ],

  layout:{
    name:'grid'
  }

})

const sheetCSV =
"https://docs.google.com/spreadsheets/d/e/2PACX-1vT43b07k8koGYDSYEFIC3ibPUaPQAsJ8VBi15AXwH7YQNd6tyYUG0_Id2yHgf3eo1SXcy-AdLr3h_CY/pubhtml?gid=0&single=true&output=csv"

async function loadSheet(){

const r = await fetch(sheetCSV + "&t=" + Date.now())

const txt = await r.text()

return txt

}

function csvToRows(csv){

const rows = csv.split("\n").map(r=>r.split(","))

return rows

}

async function init(){

const csv = await loadSheet()

const rows = csvToRows(csv)

const headers = rows[0]

const data = rows.slice(1)

const elements = []

data.forEach(r=>{

if(!r[0]) return

elements.push({
data:{
id:r[0],
label:r[1]
}
})

})

createGraph(elements)

}



init()

function createGraph(elements){

const cy = cytoscape({

container: document.getElementById('cy'),

elements: elements,

style:[
{
selector:'node',
style:{
'background-color':'#4a90e2',
'label':'data(label)',
'color':'white',
'text-valign':'center',
'text-halign':'center'
}
}
],

layout:{
name:'grid'
}

})

}