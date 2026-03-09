

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