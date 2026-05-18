window.hexToRgb =
function(hex) {

  const c =
    hex.replace('#', '');

  const bigint =
    parseInt(c, 16);

  const r =
    (bigint >> 16) & 255;

  const g =
    (bigint >> 8) & 255;

  const b =
    bigint & 255;

  return `${r}, ${g}, ${b}`;

};

window.createInlineSelectChip =
function(label, value) {

  const chip = document.createElement('div');

  chip.className = 'ui-chip';

  chip.innerHTML = `

    <div class="ui-chip-label">
      ${label}
    </div>

    <div class="ui-chip-value">

      <span>${value}</span>

      <div class="ui-chip-arrow"></div>

    </div>

  `;

  return chip;
};

window.createValueChip =
function(label, value) {

  return createInlineSelectChip(
    label,
    value
  );

};

window.createColorChip =
function(color = '#57789b', alpha = 0.7) {

  const chip =
    document.createElement('div');

  chip.className =
    'ui-chip';

  /////////////////////////////////////////////////////////
  // LABEL
  /////////////////////////////////////////////////////////

  const label =
    document.createElement('div');

  label.className =
    'ui-chip-label';

  label.innerText =
    'color';

  /////////////////////////////////////////////////////////
  // VALUE
  /////////////////////////////////////////////////////////

  const value =
    document.createElement('div');

  value.className =
    'ui-chip-value';

  /////////////////////////////////////////////////////////
  // SWATCH
  /////////////////////////////////////////////////////////

  const swatch =
    document.createElement('div');

  swatch.className =
    'ui-color-swatch';

  swatch.style.background =
    color;

  /////////////////////////////////////////////////////////
  // ALPHA
  /////////////////////////////////////////////////////////

  const alphaEl =
    document.createElement('div');

  alphaEl.className =
    'ui-chip-alpha';

  alphaEl.innerText = Math.round(alpha * 100) + ' %';

  alphaEl.contentEditable =
  true;

  alphaEl.spellcheck =
  false;

  /////////////////////////////////////////////////////////

  value.appendChild(alphaEl);

  value.appendChild(swatch);

  chip.appendChild(label);

  chip.appendChild(value);

  /////////////////////////////////////////////////////////

  chip.swatch = swatch;

chip.alphaEl = alphaEl;

/////////////////////////////////////////////////////////
// STATE
/////////////////////////////////////////////////////////

chip.currentAlpha = alpha;

chip.currentColor = color;

chip.updateNodeStyle = null;

/////////////////////////////////////////////////////////
// UPDATE SWATCH
/////////////////////////////////////////////////////////

function updateSwatch() {

  ///////////////////////////////////////////////////////
  // RGB STRING
  ///////////////////////////////////////////////////////

  if (
    chip.currentColor.startsWith('rgb')
  ) {

    const values =
      chip.currentColor
        .replace('rgb(', '')
        .replace('rgba(', '')
        .replace(')', '');

    swatch.style.background =
      `rgba(
        ${values},
        ${chip.currentAlpha}
      )`;

    return;

  }

  ///////////////////////////////////////////////////////
  // HEX
  ///////////////////////////////////////////////////////

  const rgb =
    hexToRgb(
      chip.currentColor
    );

  swatch.style.background =
    `rgba(
      ${rgb},
      ${chip.currentAlpha}
    )`;

}

updateSwatch();

/////////////////////////////////////////////////////////
// ALPHA INPUT
/////////////////////////////////////////////////////////

alphaEl.addEventListener(
  'input',
  () => {

    const n =
      parseFloat(
        alphaEl.innerText
          .replace('%', '')
          .trim()
      );

    if (isNaN(n)) return;

    chip.currentAlpha =
      Math.max(
        0,
        Math.min(1, n / 100)
      );

    updateSwatch();

    /////////////////////////////////////////////////////
    // APPLY NODE
    /////////////////////////////////////////////////////

    if (chip.updateNodeStyle) {

      chip.updateNodeStyle(
        chip.currentColor,
        chip.currentAlpha
      );

    }

  }
);

return chip;
};