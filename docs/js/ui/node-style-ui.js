
window.ACTIVE_STYLE_BADGE = null;
window.STYLE_PANEL = null;
const SHAPE_SCALE = {

  ellipse: 1,

  'round-rectangle': 0.8,

  rectangle: 0.8,

  diamond: 0.9

};


window.openNodeStylePanel =
function(node, anchorEl) {

  closeNodeStylePanel();

  const panel =
    document.createElement('div');

  panel.className =
    'node-style-panel';

  /////////////////////////////////////////////////////////
  // SHAPE CHIP
  /////////////////////////////////////////////////////////

  const shapeChip =
    createInlineSelectChip(
      "shape",
      "ellipse"
    );

  panel.appendChild(shapeChip);

  /////////////////////////////////////////////////////////
  // DROPDOWN
  /////////////////////////////////////////////////////////
    
  const currentColor =
    node.style('background-color');
    

  const currentOpacity =
    parseFloat(
      node.style('background-opacity')
    ) || 1;

  const colorChip =
    createColorChip(
      currentColor,
      currentOpacity
    );

    panel.appendChild(colorChip);
/////////////////////////////////////////////////////////
  // SIZE CHIP
  /////////////////////////////////////////////////////////

  const currentSizeType =
    node.data('size_type') || 'fixed';

  const currentSizePx =
    parseFloat(node.data('size_px')) || 80;

  const sizeChip =
    createInlineSelectChip(
      "size",
      currentSizeType
    );

  panel.appendChild(sizeChip);

  /////////////////////////////////////////////////////////
  // SIZE PX INPUT (dentro del sizeChip, como alpha en color)
  /////////////////////////////////////////////////////////

  const sizePxEl =
    document.createElement('div');

  sizePxEl.className = 'ui-chip-alpha';
  sizePxEl.contentEditable = true;
  sizePxEl.spellcheck = false;
  sizePxEl.innerText = currentSizePx + ' px';

  // Insertarlo dentro del ui-chip-value del sizeChip
  sizeChip.querySelector('.ui-chip-value')
    .append(sizePxEl);

  if (currentSizeType !== 'fixed') {
    sizePxEl.style.display = 'none';
  }

  sizePxEl.addEventListener('input', () => {

    const n =
      parseFloat(sizePxEl.innerText.trim());

    if (isNaN(n) || n <= 0) return;

    node.data('size_px', n);
    node.style({ width: n, height: n });

    if (typeof window.queueNodeData === 'function') {
      window.queueNodeData(node.id(), 'size_px', n);
    }

  });


  // Input numérico → aplica al nodo y persiste
  sizePxEl.addEventListener('input', () => {

    const n =
      parseFloat(sizePxEl.innerText.trim());

    if (isNaN(n) || n <= 0) return;

    node.data('size_px', n);
    node.style({ width: n, height: n });

    if (typeof window.queueNodeData === 'function') {
      window.queueNodeData(node.id(), 'size_px', n);
    }

  });

  colorChip.updateNodeStyle =
    function(color, alpha) {

      node.style(
        'background-color',
        color
      );
      node.data('color', color);

      node.style(
        'background-opacity',
        alpha
      );
      node.data('alpha', alpha);

      if (typeof window.queueNodeData === 'function') {

      window.queueNodeData(
        node.id(),
        'color',
        color
      );

      window.queueNodeData(
        node.id(),
        'alpha',
        alpha
      );

    }

    };

  const dropdown =
    document.createElement('div');

  dropdown.className =
    'shape-dropdown hidden';

    /////////////////////////////////////////////////////////
  // SIZE TYPE DROPDOWN
  /////////////////////////////////////////////////////////

  const sizeDropdown =
    document.createElement('div');

  sizeDropdown.className =
    'shape-dropdown hidden';

  ['fixed', 'by unit'].forEach(mode => {

    const item =
      document.createElement('div');

    item.className = 'shape-option';
    item.innerText = mode;

    item.addEventListener('click', () => {

      sizeChip.querySelector('span')
        .innerText = mode;

      sizeDropdown.classList.add('hidden');

      // Mostrar/ocultar el campo px
      sizePxEl.style.display =
      mode === 'fixed' ? '' : 'none';

      // Persiste size_type
      node.data('size_type', mode);

      if (typeof window.queueNodeData === 'function') {
        window.queueNodeData(
          node.id(),
          'size_type',
          mode
        );
      }

    });

    sizeDropdown.appendChild(item);

  });

  // Click en chip abre dropdown
  sizeChip.addEventListener('click', (e) => {

  e.stopPropagation();

  dropdown.classList.add('hidden');
  colorDropdown.classList.add('hidden');

  sizeDropdown.classList.toggle('hidden');

  // Reposicionar siempre al abrir
  if (!sizeDropdown.classList.contains('hidden')) {

    const r = sizeChip.getBoundingClientRect();

    sizeDropdown.style.left =
      r.right + 10 + 'px';

    sizeDropdown.style.top =
      r.top + 'px';

  }

});

  const colorDropdown =
  document.createElement('div');

  colorDropdown.className =
    'color-dropdown hidden';

const shapes = [
  'ellipse',
  'round-rectangle',
  'rectangle',
  'diamond'
];

const COLORS = [

  '#57789b',
  '#d16b6b',
  '#6f9d6d',
  '#b08ccc',
  '#d3a25f',
  '#5f8f95',
  '#8c8c8c',
  '#3f3f3f'

];

/////////////////////////////////////////////////////////
// COLOR ITEMS
/////////////////////////////////////////////////////////

COLORS.forEach(color => {

  const sw =
    document.createElement('div');

  sw.className =
    'color-option';

  sw.style.background =
    color;

 sw.addEventListener('click', () => {

  /////////////////////////////////////////////////////
  // STATE
  /////////////////////////////////////////////////////

  colorChip.currentColor =
    color;

  /////////////////////////////////////////////////////
  // SWATCH
  /////////////////////////////////////////////////////

  const rgb =
    hexToRgb(color);

  colorChip.swatch.style.background =
    `rgba(
      ${rgb},
      ${colorChip.currentAlpha}
    )`;

/////////////////////////////////////////////////////
// APPLY NODE
/////////////////////////////////////////////////////

colorChip.updateNodeStyle(
  color,
  colorChip.currentAlpha
);

  /////////////////////////////////////////////////////

  colorDropdown.classList.add(
    'hidden'
  );

});

  colorDropdown.appendChild(sw);

});

shapes.forEach(shape => {

  const item =
    document.createElement('div');

  item.className =
    'shape-option';

  item.innerText = shape;

  item.addEventListener('click', () => {
    console.log("CLICK SHAPE");

    console.log(
      "QUEUE EXISTS",
      typeof window.queueNodeData
    );

    shapeChip.querySelector('span')
      .innerText = shape;

    dropdown.classList.add('hidden');

    /////////////////////////////////////////////////////
    // APPLY TO NODE
    /////////////////////////////////////////////////////

    node.style('shape', shape);
    node.data('shape', shape);

    if (typeof window.queueNodeData === 'function') {

      window.queueNodeData(
        node.id(),
        'shape',
        shape
      );

    }

      /////////////////////////////////////////////////////////
      // VISUAL SCALE
      /////////////////////////////////////////////////////////

      const baseSize =
      parseFloat(node.data('size')) || 80;

      const scale =
      SHAPE_SCALE[shape] || 1;

      const finalSize =
      baseSize * scale;

      node.data('size_px', finalSize);

      window.queueNodeData(
        node.id(),
        'size_px',
        finalSize
      );

      node.style({

      width: finalSize,
      height: finalSize

      });

  });

    dropdown.appendChild(item);

  });


  /////////////////////////////////////////////////////////
  // CHIP CLICK
  /////////////////////////////////////////////////////////

  shapeChip.addEventListener('click', (e) => {

    e.stopPropagation();

    colorDropdown.classList.add(
  'hidden'
    );

    dropdown.classList.toggle(
      'hidden'
    );

  });

  colorChip.swatch
  .addEventListener('click', (e) => {

    e.stopPropagation();

    dropdown.classList.add(
  'hidden'
  );

  colorDropdown.classList.toggle(
    'hidden'
  );

  });

  /////////////////////////////////////////////////////////
  // POSITION
  /////////////////////////////////////////////////////////

  const rect =
    anchorEl.getBoundingClientRect();

  panel.style.left =
    rect.right + 18 + 'px';

  panel.style.top =
    rect.top + 'px';

  /////////////////////////////////////////////////////////
  // APPEND
  /////////////////////////////////////////////////////////

  document.body.appendChild(panel);

  dropdown.style.position = 'fixed';
  dropdown.style.zIndex = 999999;

  const chipRect =
  shapeChip.getBoundingClientRect();

  dropdown.style.left =
    chipRect.right + 10 + 'px';

  dropdown.style.top =
    chipRect.top + 'px';

  const colorRect =
   colorChip.getBoundingClientRect();

  colorDropdown.style.position =
    'fixed';
  colorDropdown.style.zIndex = 999999;

  colorDropdown.style.left =
    colorRect.right + 10 + 'px';

  colorDropdown.style.top =
    colorRect.top + 'px';

  document.body.appendChild(dropdown);

  sizeDropdown.style.position = 'fixed';
  sizeDropdown.style.zIndex = 999999;

  const sizeChipRect =
    sizeChip.getBoundingClientRect();

  sizeDropdown.style.left =
    sizeChipRect.right + 10 + 'px';

  sizeDropdown.style.top =
    sizeChipRect.top + 'px';

  document.body.appendChild(sizeDropdown);

  document.body.appendChild(
  colorDropdown
  );


  STYLE_PANEL = panel;
  ACTIVE_STYLE_BADGE = anchorEl;

    document
    .querySelectorAll('.graph-badge')
    .forEach(b => {

        if (b === anchorEl) {
        b.classList.add('active');
        b.classList.remove('dimmed');
        }

        else {
        b.classList.remove('active');
        b.classList.add('dimmed');
        }

    });
  STYLE_PANEL.anchorEl = anchorEl;
};



/////////////////////////////////////////////////////////
// CLOSE
/////////////////////////////////////////////////////////

window.closeNodeStylePanel =
function() {

  if (!STYLE_PANEL) return;

  STYLE_PANEL.remove();

  document
    .querySelectorAll(
      '.shape-dropdown, .color-dropdown'
    )
    .forEach(el => el.remove());


  document
  .querySelectorAll('.graph-badge')
  .forEach(b => {

    b.classList.remove('active');
    b.classList.remove('dimmed');

  });

ACTIVE_STYLE_BADGE = null;

  STYLE_PANEL = null;
};

window.updateNodeStylePanel =
function(anchorEl) {

  if (!STYLE_PANEL) return;

  if (!anchorEl) return;

  const rect =
    anchorEl.getBoundingClientRect();

  STYLE_PANEL.style.left =
    rect.right + 18 + 'px';

  STYLE_PANEL.style.top =
    rect.top + 'px';
};

document.addEventListener('pointerdown', (e) => {

  if (!STYLE_PANEL) return;

  const insidePanel =
  STYLE_PANEL.contains(e.target);

  const insideDropdown =
  e.target.closest(
    '.shape-dropdown, .color-dropdown'
  );

  const isBadge =
  e.target.closest('.graph-badge');

  if (
  insidePanel ||
  insideDropdown ||
  isBadge
) return;

  closeNodeStylePanel();

});

