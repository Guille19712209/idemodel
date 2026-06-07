// help-manual.js — render del manual de usuario en manual.html
// Fetch de MANUAL.<lang>.md → marked → contenido + índice (TOC) navegable.
// Idioma por ?lang= (default 'es'); pensado para sumar 'en' después sin refactor.

(function () {
  const LANG = (new URLSearchParams(location.search).get('lang') || 'es').toLowerCase();

  // Slug estable (debe coincidir con el de help-panel.js para los deep links #ancla)
  function slugify(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD').replace(/\p{Diacritic}/gu, '')   // saca acentos
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  const contentEl = document.getElementById('content');
  const tocListEl = document.getElementById('toc-list');
  const searchEl  = document.getElementById('toc-search');

  fetch(`MANUAL.${LANG}.md`, { cache: 'no-cache' })
    .then(r => { if (!r.ok) throw new Error(r.status); return r.text(); })
    .then(md => render(md))
    .catch(err => {
      contentEl.innerHTML =
        `<div class="loading">No se pudo cargar el manual (MANUAL.${LANG}.md). ${err.message || ''}</div>`;
    });

  function render(md) {
    marked.setOptions({ headerIds: false, mangle: false });
    contentEl.innerHTML = marked.parse(md);

    // Asignar ids únicos a los headings y construir el TOC (h2 + h3)
    const used = new Set();
    const tocItems = [];
    contentEl.querySelectorAll('h1, h2, h3, h4').forEach(h => {
      let id = slugify(h.textContent);
      if (!id) return;
      let unique = id, i = 2;
      while (used.has(unique)) unique = `${id}-${i++}`;
      used.add(unique);
      h.id = unique;
      const lvl = parseInt(h.tagName[1], 10);
      if (lvl === 2 || lvl === 3) tocItems.push({ id: unique, text: h.textContent, lvl });
    });

    tocListEl.innerHTML = '';
    tocItems.forEach(it => {
      const a = document.createElement('a');
      a.href = '#' + it.id;
      a.textContent = it.text;
      a.className = it.lvl === 3 ? 'lvl-3' : 'lvl-2';
      a.dataset.id = it.id;
      tocListEl.appendChild(a);
    });

    _setupScrollSpy();
    _setupFilter();

    // Si venimos con #ancla (deep link desde el buscador), saltar ahí una vez renderizado
    if (location.hash) {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) requestAnimationFrame(() => target.scrollIntoView({ behavior: 'auto', block: 'start' }));
    }
  }

  function _setupScrollSpy() {
    const links = Array.from(tocListEl.querySelectorAll('a'));
    const byId = Object.fromEntries(links.map(a => [a.dataset.id, a]));
    const heads = links.map(a => document.getElementById(a.dataset.id)).filter(Boolean);
    if (!heads.length) return;

    let active = null;
    const setActive = (id) => {
      if (id === active) return;
      active = id;
      links.forEach(a => a.classList.toggle('active', a.dataset.id === id));
    };

    const io = new IntersectionObserver((entries) => {
      // El primero visible cerca del top manda
      const visible = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible.length && byId[visible[0].target.id]) setActive(visible[0].target.id);
    }, { rootMargin: '-70px 0px -70% 0px', threshold: 0 });

    heads.forEach(h => io.observe(h));
  }

  function _setupFilter() {
    searchEl.addEventListener('input', () => {
      const q = searchEl.value.trim().toLowerCase();
      tocListEl.querySelectorAll('a').forEach(a => {
        a.classList.toggle('hidden', q && !a.textContent.toLowerCase().includes(q));
      });
    });
  }
})();
