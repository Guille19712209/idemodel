// help-panel.js — chip "Help!" arriba-centro de la app.
// Opciones en la misma línea: "Go to user manual" (→ manual.html) y "About?" (buscador
// in-app sobre MANUAL.<lang>.md, resultados en un overlay flotante).
// Idioma: localStorage 'idemodel_help_lang' (default 'es'); listo para sumar 'en'.

(function () {
  const LANG = (localStorage.getItem('idemodel_help_lang') || 'es').toLowerCase();

  // Slug estable — DEBE coincidir con el de help-manual.js para los deep links #ancla.
  function slugify(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD').replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // ── DOM del chip ──────────────────────────────────────────────
  const ui = document.createElement('div');
  ui.id = 'help-ui';
  ui.innerHTML = `
    <div class="help-pill help-main" id="help-main">Help!</div>
    <div class="help-options" id="help-options">
      <div class="help-pill" id="help-manual">Go to user manual</div>
      <div class="help-pill help-about" id="help-about">
        <span>Search</span>
        <input type="text" id="help-about-input" placeholder="about?" />
      </div>
    </div>`;
  document.body.appendChild(ui);

  const mainBtn   = ui.querySelector('#help-main');
  const optionsEl = ui.querySelector('#help-options');
  const manualBtn = ui.querySelector('#help-manual');
  const aboutWrap = ui.querySelector('#help-about');
  const aboutIn   = ui.querySelector('#help-about-input');

  // ── Panel de resultados ───────────────────────────────────────
  const panel = document.createElement('div');
  panel.id = 'help-results';
  panel.innerHTML = `
    <div class="help-res-head">
      <div class="q" id="help-res-q"></div>
      <div class="close" id="help-res-close">×</div>
    </div>
    <div class="help-res-body" id="help-res-body"></div>`;
  document.body.appendChild(panel);
  const resQ    = panel.querySelector('#help-res-q');
  const resBody = panel.querySelector('#help-res-body');
  panel.querySelector('#help-res-close').addEventListener('click', closeResults);

  // ── Abrir / cerrar el chip ────────────────────────────────────
  let open = false;
  function setOpen(v) {
    open = v;
    optionsEl.classList.toggle('open', v);
    mainBtn.classList.toggle('open', v);
    if (v) { ensureManual(); setTimeout(() => { aboutWrap.classList.add('expanded'); autoSizeAbout(); }, 120); }
    else   { aboutWrap.classList.remove('expanded'); aboutIn.style.width = ''; closeResults(); }
  }

  // El input arranca corto (CSS) y se estira con el contenido, agrandando el pill
  function autoSizeAbout() {
    if (!aboutWrap.classList.contains('expanded')) return;
    aboutIn.style.width = '0px';
    aboutIn.style.width = Math.min(Math.max(aboutIn.scrollWidth, 65), 260) + 'px';
  }
  mainBtn.addEventListener('click', (e) => { e.stopPropagation(); setOpen(!open); if (open) aboutIn.focus(); });

  manualBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    window.open(`manual.html?lang=${LANG}`, '_blank');
  });

  aboutIn.addEventListener('click', e => e.stopPropagation());
  aboutIn.addEventListener('input', autoSizeAbout);
  aboutIn.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { runSearch(aboutIn.value); }
    if (e.key === 'Escape') { closeResults(); }
  });

  // Click fuera cierra
  document.addEventListener('click', (e) => {
    if (!ui.contains(e.target) && !panel.contains(e.target)) { if (open) setOpen(false); }
  });

  // ── Manual: fetch + parseo en secciones ───────────────────────
  let SECTIONS = null;     // [{ level, title, slug, crumb, body }]
  let _loading = null;

  function ensureManual() {
    if (SECTIONS || _loading) return _loading;
    _loading = fetch(`MANUAL.${LANG}.md`, { cache: 'no-cache' })
      .then(r => { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(md => { SECTIONS = parseSections(md); })
      .catch(() => { SECTIONS = []; });
    return _loading;
  }

  function parseSections(md) {
    const lines = md.split(/\r?\n/);
    const out = [];
    let cur = null, crumb = '', fenced = false;
    const stripInline = s => s.replace(/[*_`]/g, '').trim();

    for (const line of lines) {
      if (/^```/.test(line)) { fenced = !fenced; if (cur) cur.body.push(line); continue; }
      const m = !fenced && line.match(/^(#{1,4})\s+(.*)$/);
      if (m) {
        const level = m[1].length;
        const title = stripInline(m[2]);
        if (cur) out.push(cur);
        cur = { level, title, slug: slugify(title), crumb: level <= 2 ? 'Manual' : crumb, body: [] };
        if (level === 2) crumb = title;   // las h3/h4 siguientes cuelgan de esta h2
      } else if (cur) {
        cur.body.push(line);
      }
    }
    if (cur) out.push(cur);
    out.forEach(s => { s.text = cleanBody(s.body.join(' ')); });
    return out;
  }

  function cleanBody(s) {
    return s
      .replace(/\|/g, ' ')                       // tablas
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')   // links → texto
      .replace(/[#>*_`]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ── Búsqueda ──────────────────────────────────────────────────
  async function runSearch(rawQuery) {
    const q = (rawQuery || '').trim();
    if (!q) return;
    await ensureManual();
    const terms = q.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
      .split(/\s+/).filter(t => t.length >= 2);
    const norm = t => t.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

    const scored = (SECTIONS || []).map(sec => {
      const titleN = norm(sec.title), bodyN = norm(sec.text);
      let score = 0;
      terms.forEach(t => {
        if (titleN.includes(t)) score += 5;
        const occ = bodyN.split(t).length - 1;
        score += Math.min(occ, 4);
      });
      return { sec, score };
    }).filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);

    renderResults(q, terms, scored);
  }

  function renderResults(q, terms, scored) {
    resQ.innerHTML = `Results for <b>${escapeHtml(q)}</b>`;
    resBody.innerHTML = '';
    if (!scored.length) {
      resBody.innerHTML = `<div class="help-res-empty">No results in the manual. Try other words or open the full manual.</div>`;
    } else {
      scored.forEach(({ sec }) => {
        const a = document.createElement('a');
        a.className = 'help-res-item';
        a.href = `manual.html?lang=${LANG}#${sec.slug}`;
        a.target = '_blank';
        a.innerHTML = `
          <div class="crumb">${escapeHtml(sec.crumb || 'Manual')}</div>
          <div class="title">${escapeHtml(sec.title)}</div>
          <div class="snippet">${snippet(sec.text, terms)}</div>`;
        resBody.appendChild(a);
      });
    }
    panel.classList.add('open');
  }

  // Fragmento alrededor de la primera coincidencia, con términos resaltados
  function snippet(text, terms) {
    const norm = text.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    let idx = -1;
    for (const t of terms) { const i = norm.indexOf(t); if (i !== -1 && (idx === -1 || i < idx)) idx = i; }
    if (idx === -1) idx = 0;
    const start = Math.max(0, idx - 60);
    let frag = text.slice(start, start + 200).trim();
    if (start > 0) frag = '…' + frag;
    if (start + 200 < text.length) frag = frag + '…';
    let html = escapeHtml(frag);
    terms.forEach(t => {
      const re = new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      html = html.replace(re, '<mark>$1</mark>');
    });
    return html;
  }

  function closeResults() { panel.classList.remove('open'); }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
})();
