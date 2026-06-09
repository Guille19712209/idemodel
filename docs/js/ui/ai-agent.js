// ai-agent.js — Agente de IA embebido (BYO key, corre en el browser con los tokens del usuario).
// Arquitectura: historial en formato NEUTRAL + un adapter fino por proveedor que lo traduce.
// El loop agéntico, las tools y la UI son agnósticos del proveedor; sumar uno nuevo = otro adapter.
// La key vive SOLO en localStorage (una por proveedor). Adapters: Claude (Anthropic) y Gemini (Google).
//
// Formato neutral del historial (convo[]):
//   { role:'user',      text }
//   { role:'assistant', text, toolCalls:[{id,name,input}] }
//   { role:'tool',      results:[{id,name,content}] }
//
// Globals que reusa: MODEL_ID, USER_ROLE, NODES_DATA, UNITS_DATA, VALUES_DATA, Formula,
//   buildModelExport (read), saveFormulaForPeriod, pushUndo, reloadCurrentModel, supabaseClient.

(function () {
  // ── Proveedores y modelos ─────────────────────────────────────
  const PROVIDERS = [
    { id: 'claude', name: 'Claude (Anthropic)', keyHint: 'sk-ant-...' },
    { id: 'gemini', name: 'Gemini (Google)',    keyHint: 'AIza...' }
  ];
  const MODELS = {
    claude: [
      { id: 'claude-sonnet-4-6',         name: 'Sonnet 4.6 (rápido)' },
      { id: 'claude-opus-4-8',           name: 'Opus 4.8 (potente)' },
      { id: 'claude-haiku-4-5',          name: 'Haiku 4.5 (económico)' }
    ],
    gemini: [
      { id: 'gemini-2.5-flash',          name: 'Gemini 2.5 Flash (free tier)' },
      { id: 'gemini-2.5-pro',            name: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.0-flash',          name: 'Gemini 2.0 Flash' }
    ]
  };

  // ── Config persistida (localStorage; key por proveedor) ───────
  const cfg = {
    get provider() { return localStorage.getItem('idemodel_ai_provider') || 'claude'; },
    set provider(v){ localStorage.setItem('idemodel_ai_provider', v); },
    keyFor(p)      { return localStorage.getItem('idemodel_ai_key_' + p) || ''; },
    setKeyFor(p,v) { v ? localStorage.setItem('idemodel_ai_key_' + p, v) : localStorage.removeItem('idemodel_ai_key_' + p); },
    get key()      { return this.keyFor(this.provider); },
    set key(v)     { this.setKeyFor(this.provider, v); },
    modelFor(p)    { return localStorage.getItem('idemodel_ai_model_' + p) || MODELS[p][0].id; },
    setModelFor(p,v){ localStorage.setItem('idemodel_ai_model_' + p, v); },
    get model()    { return this.modelFor(this.provider); },
    set model(v)   { this.setModelFor(this.provider, v); },
    get mode()     { return localStorage.getItem('idemodel_ai_mode') || 'confirm'; },
    set mode(v)    { localStorage.setItem('idemodel_ai_mode', v); }
  };

  // ── Adapters por proveedor ────────────────────────────────────
  // Contrato: send({system, convo, tools, model, key}) → { text, toolUses:[{id,name,input}], stop }
  const adapters = {
    claude: {
      async send({ system, convo, tools, model, key }) {
        const messages = convo.map(m => {
          if (m.role === 'user') return { role: 'user', content: [{ type: 'text', text: m.text }] };
          if (m.role === 'assistant') {
            const content = [];
            if (m.text) content.push({ type: 'text', text: m.text });
            (m.toolCalls || []).forEach(tc => content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input }));
            return { role: 'assistant', content };
          }
          // tool results
          return { role: 'user', content: (m.results || []).map(r => ({ type: 'tool_result', tool_use_id: r.id, content: r.content })) };
        });
        // Prompt caching: un breakpoint en `system` cachea tools+system (orden de render:
        // tools → system → messages); otro en el último bloque cachea el prefijo de conversación.
        // En cada vuelta del loop, el grueso del input se lee de caché (~0.1×) en vez de full price.
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && Array.isArray(lastMsg.content) && lastMsg.content.length) {
          lastMsg.content[lastMsg.content.length - 1].cache_control = { type: 'ephemeral' };
        }
        const res = await _fetchRetry('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model, max_tokens: 4096,
            system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
            messages,
            tools: tools.map(t => ({ name: t.name, description: t.description, input_schema: t.parameters }))
          })
        });
        if (!res.ok) throw new Error(await _errText(res));
        const data = await res.json();
        if (data.usage) {
          const u = data.usage;
          console.log(`[ai cache] read=${u.cache_read_input_tokens || 0} write=${u.cache_creation_input_tokens || 0} input=${u.input_tokens || 0} out=${u.output_tokens || 0}`);
        }
        const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
        const toolUses = (data.content || []).filter(b => b.type === 'tool_use')
          .map(b => ({ id: b.id, name: b.name, input: b.input || {} }));
        return { text, toolUses, stop: data.stop_reason === 'tool_use' ? 'tool_use' : 'end' };
      }
    },

    gemini: {
      async send({ system, convo, tools, model, key }) {
        const contents = convo.map(m => {
          if (m.role === 'user') return { role: 'user', parts: [{ text: m.text }] };
          if (m.role === 'assistant') {
            const parts = [];
            if (m.text) parts.push({ text: m.text });
            (m.toolCalls || []).forEach(tc => {
              const fc = { name: tc.name, args: tc.input };
              if (tc.id) fc.id = tc.id;
              parts.push({ functionCall: fc });
            });
            return { role: 'model', parts };
          }
          // tool results
          return { role: 'user', parts: (m.results || []).map(r => {
            const fr = { name: r.name, response: { result: r.content } };
            if (r.id) fr.id = r.id;
            return { functionResponse: fr };
          }) };
        });
        const functionDeclarations = tools.map(t => {
          const d = { name: t.name, description: t.description };
          if (t.parameters && Object.keys(t.parameters.properties || {}).length) d.parameters = t.parameters;
          return d;
        });
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
        const res = await _fetchRetry(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents,
            tools: [{ functionDeclarations }]
          })
        });
        if (!res.ok) throw new Error(await _errText(res));
        const data = await res.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        const text = parts.filter(p => p.text).map(p => p.text).join('\n').trim();
        const toolUses = parts.filter(p => p.functionCall).map(p => ({
          id: p.functionCall.id || crypto.randomUUID(),
          name: p.functionCall.name,
          input: p.functionCall.args || {}
        }));
        return { text, toolUses, stop: toolUses.length ? 'tool_use' : 'end' };
      }
    }
  };

  // Reintenta ante saturación/errores transitorios (503/429/529/5xx) con backoff.
  async function _fetchRetry(url, opts, tries = 4) {
    let delay = 1500;
    for (let i = 0; i < tries; i++) {
      const res = await fetch(url, opts);
      if (res.ok) return res;
      const transient = res.status === 503 || res.status === 429 || res.status === 529 || res.status >= 500;
      if (transient && i < tries - 1) {
        // En 429 la API manda `retry-after` (segundos) con la espera exacta; honrarlo
        // evita reintentar antes de tiempo y quemar reintentos. Cap a 30s para no colgar la UI.
        const ra = parseFloat(res.headers.get('retry-after'));
        const wait = Number.isFinite(ra) ? Math.min(ra * 1000, 30000) : delay;
        await new Promise(r => setTimeout(r, wait));
        delay *= 2;
        continue;
      }
      return res;
    }
  }

  async function _errText(res) {
    let detail = '';
    try { const j = await res.json(); detail = j?.error?.message || j?.error?.[0]?.message || ''; } catch (_) {}
    return `API ${res.status}${detail ? ': ' + detail : ''}`;
  }

  // ── Helpers de dominio ────────────────────────────────────────
  const SB = () => window.supabaseClient;
  function _assertWritable() {
    if (window.USER_ROLE === 'reader') throw new Error('your role is read-only on this model');
    if (!window.MODEL_ID) throw new Error('no model is open');
  }
  const _num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
  const _node = (label) => (window.NODES_DATA || []).find(n => n.label === label);
  const _unit = (name) => (window.UNITS_DATA || []).find(u => u.name === name);
  const _grp  = (name) => (window.GROUPS_DATA || []).find(g => g.name === name);
  const _concept = (label) => (window.CONCEPTS_DATA || []).find(c => c.label === label);
  function _rootParent(n) {
    const byId = Object.fromEntries((window.NODES_DATA || []).map(x => [x.id, x]));
    let cur = n, guard = 0;
    while (cur && cur.parent && byId[cur.parent] && guard++ < 60) cur = byId[cur.parent];
    return cur ? cur.id : n.id;
  }

  // ── Superficie de tools (agnóstica del proveedor) ─────────────
  const TOOLS = [
    {
      name: 'get_model', write: false,
      description: 'Read the full current model as idemodel.model.v1 JSON (the data model and formula language are described in your system prompt). ALWAYS call this first.',
      parameters: { type: 'object', properties: {}, required: [] },
      async run() { return JSON.stringify(await window.buildModelExport({ forAgent: true })); }
    },
    {
      name: 'set_model_settings', write: true,
      description: 'Update model-level settings. CRUCIAL: to make the model span multiple time steps, set "periods" to the desired count (e.g. 12) — formulas for periods beyond model.periods are stored but NOT shown until you raise it. Also sets time_unit, starting_date, name.',
      parameters: {
        type: 'object',
        properties: {
          periods:       { type: 'integer', description: 'Total number of periods the model spans (>=1).' },
          time_unit:     { type: 'string',  description: 'e.g. month, year, week, day.' },
          starting_date: { type: 'string',  description: 'YYYY-MM-DD.' },
          name:          { type: 'string',  description: 'Model name.' }
        },
        required: []
      },
      run: execSetModelSettings
    },
    {
      name: 'create_unit', write: true,
      description: 'Create a unit of measure. Units give visual meaning: when a node uses size_type "by unit", its on-screen size scales between min_sz and max_sz as its value goes from min_value to max_value. Create units BEFORE the nodes that use them.',
      parameters: {
        type: 'object',
        properties: {
          name:          { type: 'string',  description: 'Unique unit name, e.g. "$", "%", "u".' },
          number_format: { type: 'string',  description: 'plain | integer | decimal2 | accounting | percent.' },
          min_value:     { type: 'number',  description: 'Value mapped to the smallest size.' },
          max_value:     { type: 'number',  description: 'Value mapped to the largest size.' },
          min_sz:        { type: 'number',  description: 'Smallest node diameter in px (e.g. 20).' },
          max_sz:        { type: 'number',  description: 'Largest node diameter in px (e.g. 120).' }
        },
        required: ['name']
      },
      run: execCreateUnit
    },
    {
      name: 'update_unit', write: true,
      description: 'Modify an existing unit: number_format (plain|integer|decimal2|accounting|percent), value range (min_value/max_value), size range (min_sz/max_sz), or rename. Only the fields you pass change.',
      parameters: {
        type: 'object',
        properties: {
          unit:          { type: 'string', description: 'Exact current unit name.' },
          name:          { type: 'string', description: 'New name (rename).' },
          number_format: { type: 'string', description: 'plain | integer | decimal2 | accounting | percent.' },
          min_value:     { type: 'number' },
          max_value:     { type: 'number' },
          min_sz:        { type: 'number' },
          max_sz:        { type: 'number' }
        },
        required: ['unit']
      },
      run: execUpdateUnit
    },
    {
      name: 'create_node', write: true,
      description: 'Create a node. Labels must be unique. For quantitative nodes, set unit + size_type "by unit" so size encodes value visually.',
      parameters: {
        type: 'object',
        properties: {
          label:     { type: 'string', description: 'Unique human label.' },
          parent:    { type: 'string', description: 'Optional. Exact label of an existing node to nest under.' },
          unit:      { type: 'string', description: 'Optional. Exact name of an existing unit.' },
          size_type: { type: 'string', description: '"fixed" (default) or "by unit" (scale size by value via its unit).' },
          color:     { type: 'string', description: 'Optional hex color, e.g. "#4caf50". Use color to mark thematic zones.' },
          shape:     { type: 'string', description: 'ellipse | rectangle | roundrectangle | diamond | hexagon.' },
          comment:   { type: 'string', description: 'Optional note.' }
        },
        required: ['label']
      },
      run: execCreateNode
    },
    {
      name: 'update_node', write: true,
      description: 'Modify an existing node: rename, recolor, reshape, re-parent, change unit/size_type, comment, hide, or move (x,y). Only the fields you pass are changed. To clear parent/unit pass an empty string.',
      parameters: {
        type: 'object',
        properties: {
          node:      { type: 'string',  description: 'Exact current label of the node to update.' },
          label:     { type: 'string',  description: 'New unique label (rename).' },
          parent:    { type: 'string',  description: 'New parent label, or "" to detach.' },
          unit:      { type: 'string',  description: 'New unit name, or "" to clear.' },
          size_type: { type: 'string',  description: '"fixed" or "by unit".' },
          color:     { type: 'string',  description: 'Hex color.' },
          shape:     { type: 'string',  description: 'ellipse | rectangle | roundrectangle | diamond | hexagon.' },
          comment:   { type: 'string',  description: 'Note.' },
          hidden:    { type: 'boolean', description: 'Hide/show the node.' }
        },
        required: ['node']
      },
      run: execUpdateNode
    },
    {
      name: 'delete_node', write: true,
      description: 'Delete a node and its formulas, group memberships and links. Children are detached (parent cleared), not deleted.',
      parameters: { type: 'object', properties: { node: { type: 'string', description: 'Exact label.' } }, required: ['node'] },
      run: execDeleteNode
    },
    {
      name: 'set_formula', write: true,
      description: 'Set the formula of a node for one period. Display syntax {Label}[offset] (offset relative to the period; [0]=current, [-1]=previous). A bare number is valid. Empty string clears it.',
      parameters: {
        type: 'object',
        properties: {
          node:    { type: 'string',  description: 'Exact label of the target node.' },
          period:  { type: 'integer', description: 'Period number (1-based).' },
          formula: { type: 'string',  description: 'Formula, e.g. "{Ventas}[0] - {Costos}[0]".' }
        },
        required: ['node', 'period', 'formula']
      },
      run: execSetFormula
    },
    {
      name: 'create_group', write: true,
      description: 'Create a named group (a thematic zone). Assign nodes to it with assign_to_group. Groups drive the spatial zones in arrange_layout.',
      parameters: {
        type: 'object',
        properties: {
          name:  { type: 'string', description: 'Unique group name.' },
          color: { type: 'string', description: 'Optional hex color for the group.' }
        },
        required: ['name']
      },
      run: execCreateGroup
    },
    {
      name: 'assign_to_group', write: true,
      description: 'Add a node to an existing group. Create the group first with create_group.',
      parameters: {
        type: 'object',
        properties: {
          node:  { type: 'string', description: 'Exact node label.' },
          group: { type: 'string', description: 'Exact group name.' }
        },
        required: ['node', 'group']
      },
      run: execAssignGroup
    },
    {
      name: 'create_concept', write: true,
      description: 'Create a qualitative concept (a tag with a label and color). Concepts are attached to manual links between nodes, or to a node\'s parent edge, to express qualitative relationships.',
      parameters: {
        type: 'object',
        properties: {
          label:   { type: 'string', description: 'Unique concept label, e.g. "drives", "risk", "depends on".' },
          color:   { type: 'string', description: 'Optional hex color.' },
          comment: { type: 'string', description: 'Optional note.' }
        },
        required: ['label']
      },
      run: execCreateConcept
    },
    {
      name: 'link_nodes', write: true,
      description: 'Create a qualitative (manual) link between two nodes and optionally tag it with concepts. This is the qualitative relationship edge, separate from parent and formula edges.',
      parameters: {
        type: 'object',
        properties: {
          source:   { type: 'string', description: 'Exact label of the source node.' },
          target:   { type: 'string', description: 'Exact label of the target node.' },
          concepts: { type: 'array', items: { type: 'string' }, description: 'Optional concept labels to attach (create them first with create_concept).' }
        },
        required: ['source', 'target']
      },
      run: execLinkNodes
    },
    {
      name: 'tag_parent_edge', write: true,
      description: 'Attach a concept to a node\'s parent edge (the link from the node to its parent), to qualify that hierarchical relationship.',
      parameters: {
        type: 'object',
        properties: {
          node:    { type: 'string', description: 'Exact label of the child node (must have a parent).' },
          concept: { type: 'string', description: 'Exact concept label.' }
        },
        required: ['node', 'concept']
      },
      run: execTagParentEdge
    },
    {
      name: 'arrange_layout', write: true,
      description: 'Auto-position ALL nodes into spatial zones with organic jitter (not rigidly aligned), so related things cluster together. Call this LAST, after building the model.',
      parameters: {
        type: 'object',
        properties: {
          by:     { type: 'string', description: '"group" (default) clusters by group membership; "parent" clusters by top-level ancestor.' },
          jitter: { type: 'number', description: 'Randomness 0..1 (default 0.6). Higher = looser, more organic.' }
        },
        required: []
      },
      run: execArrangeLayout
    }
  ];
  const TOOL_BY_NAME = Object.fromEntries(TOOLS.map(t => [t.name, t]));

  // ── Executors ─────────────────────────────────────────────────
  async function execSetModelSettings(input) {
    _assertWritable();
    if (typeof window.saveModelField !== 'function') throw new Error('model settings not available');
    const prev = {}, changed = [];
    const apply = async (field, val) => { prev[field] = window.MODEL_DATA?.[field]; await window.saveModelField(field, val); };
    if (input.periods != null)       { await apply('periods', Math.max(1, parseInt(input.periods) || 1)); changed.push(`periods=${window.MODEL_DATA?.periods}`); }
    if (input.time_unit != null)     { await apply('time_unit', String(input.time_unit)); changed.push('time_unit'); }
    if (input.starting_date != null) { await apply('starting_date', String(input.starting_date)); changed.push('starting_date'); }
    if (input.name != null)          { await apply('name', String(input.name)); changed.push('name'); }
    if (!changed.length) return 'nothing to update';
    window.pushUndo?.(async () => { for (const [f, v] of Object.entries(prev)) await window.saveModelField(f, v); });
    return 'updated model settings: ' + changed.join(', ');
  }

  async function execCreateUnit(input) {
    _assertWritable();
    const name = String(input.name || '').trim();
    if (!name) throw new Error('unit name is required');
    if (_unit(name)) throw new Error(`a unit named "${name}" already exists`);
    const fmtOk = ['plain', 'integer', 'decimal2', 'accounting', 'percent'];
    const row = {
      id: crypto.randomUUID(), model_id: window.MODEL_ID, name,
      min_value: _num(input.min_value, 0), max_value: _num(input.max_value, 100),
      min_sz: _num(input.min_sz, 20), max_sz: _num(input.max_sz, 120),
      comment: null, number_format: fmtOk.includes(input.number_format) ? input.number_format : 'plain'
    };
    const { error } = await SB().from('units').insert(row);
    if (error) throw new Error(error.message);
    (window.UNITS_DATA || (window.UNITS_DATA = [])).push(row);
    window.pushUndo?.(async () => {
      await SB().from('units').delete().eq('id', row.id);
      const i = (window.UNITS_DATA || []).findIndex(u => u.id === row.id);
      if (i >= 0) window.UNITS_DATA.splice(i, 1);
    });
    return `created unit "${name}"`;
  }

  async function execUpdateUnit(input) {
    _assertWritable();
    const u = _unit(input.unit);
    if (!u) throw new Error(`unit "${input.unit}" not found`);
    const patch = {}, prev = {};
    const set = (c, v) => { prev[c] = u[c]; patch[c] = v; u[c] = v; };
    if (input.name != null && String(input.name).trim() !== u.name) {
      const t = String(input.name).trim();
      if (_unit(t)) throw new Error(`a unit named "${t}" already exists`);
      set('name', t);
    }
    if (input.number_format != null) {
      const ok = ['plain', 'integer', 'decimal2', 'accounting', 'percent'];
      if (!ok.includes(input.number_format)) throw new Error(`number_format must be one of: ${ok.join(', ')}`);
      set('number_format', input.number_format);
    }
    ['min_value', 'max_value', 'min_sz', 'max_sz'].forEach(c => { if (input[c] != null) set(c, _num(input[c], u[c])); });
    if (!Object.keys(patch).length) return 'nothing to update';
    const { error } = await SB().from('units').update(patch).eq('id', u.id);
    if (error) throw new Error(error.message);
    if (window.UNITS_MAP && window.UNITS_MAP[u.id]) Object.assign(window.UNITS_MAP[u.id], patch);
    window.pushUndo?.(async () => { await SB().from('units').update(prev).eq('id', u.id); Object.assign(u, prev); });
    return `updated unit "${u.name}": ${Object.keys(patch).join(', ')}`;
  }

  async function execCreateNode(input) {
    _assertWritable();
    const label = String(input.label || '').trim();
    if (!label) throw new Error('label is required');
    const nodes = window.NODES_DATA || (window.NODES_DATA = []);
    if (nodes.some(n => n.label === label)) throw new Error(`a node labeled "${label}" already exists`);

    let parentId = null;
    if (input.parent) {
      const p = _node(input.parent);
      if (!p) throw new Error(`parent "${input.parent}" not found`);
      parentId = p.id;
    }
    let unitId = null;
    if (input.unit) {
      const u = _unit(input.unit);
      if (!u) throw new Error(`unit "${input.unit}" not found`);
      unitId = u.id;
    }
    const sizeType = input.size_type === 'by unit' ? 'by unit' : 'fixed';

    const n = nodes.length;
    const row = {
      id: crypto.randomUUID(), model_id: window.MODEL_ID, label,
      parent: parentId, unit_id: unitId, comment: input.comment ?? null,
      shape: input.shape || 'ellipse', color: input.color || '#8c8c8c',
      alpha: 0.5, size_px: 80, size_type: sizeType, hidden: false, text_only: false,
      x: 120 + (n % 8) * 150, y: 120 + Math.floor(n / 8) * 150
    };
    const { error } = await SB().from('nodes').insert(row);
    if (error) throw new Error(error.message);
    nodes.push(row);
    window.pushUndo?.(async () => {
      await SB().from('nodes').delete().eq('id', row.id);
      const i = (window.NODES_DATA || []).findIndex(x => x.id === row.id);
      if (i >= 0) window.NODES_DATA.splice(i, 1);
    });
    return `created node "${label}"`;
  }

  async function execUpdateNode(input) {
    _assertWritable();
    const node = _node(input.node);
    if (!node) throw new Error(`node "${input.node}" not found`);
    const patch = {}, prev = {};
    const set = (col, val) => { prev[col] = node[col]; patch[col] = val; node[col] = val; };

    if (input.label != null && input.label !== node.label) {
      const t = String(input.label).trim();
      if (_node(t)) throw new Error(`a node labeled "${t}" already exists`);
      set('label', t);
    }
    if (input.parent !== undefined) {
      if (!input.parent) set('parent', null);
      else { const p = _node(input.parent); if (!p) throw new Error(`parent "${input.parent}" not found`);
             if (p.id === node.id) throw new Error('a node cannot be its own parent'); set('parent', p.id); }
    }
    if (input.unit !== undefined) {
      if (!input.unit) set('unit_id', null);
      else { const u = _unit(input.unit); if (!u) throw new Error(`unit "${input.unit}" not found`); set('unit_id', u.id); }
    }
    if (input.size_type != null) set('size_type', input.size_type === 'by unit' ? 'by unit' : 'fixed');
    ['color', 'shape', 'comment'].forEach(c => { if (input[c] != null) set(c, input[c]); });
    if (input.hidden != null) set('hidden', !!input.hidden);

    if (!Object.keys(patch).length) return 'nothing to update';
    const { error } = await SB().from('nodes').update(patch).eq('id', node.id);
    if (error) throw new Error(error.message);
    window.pushUndo?.(async () => {
      await SB().from('nodes').update(prev).eq('id', node.id);
      Object.assign(node, prev);
    });
    return `updated "${node.label}": ${Object.keys(patch).join(', ')}`;
  }

  async function execDeleteNode(input) {
    _assertWritable();
    const node = _node(input.node);
    if (!node) throw new Error(`node "${input.node}" not found`);
    const id = node.id, sb = SB();
    await sb.from('time_values').delete().eq('node_id', id);
    await sb.from('node_groups').delete().eq('node_id', id);
    await sb.from('links').delete().or(`source_id.eq.${id},target_id.eq.${id}`);
    await sb.from('nodes').update({ parent: null }).eq('parent', id);
    const { error } = await sb.from('nodes').delete().eq('id', id);
    if (error) throw new Error(error.message);
    const i = (window.NODES_DATA || []).findIndex(x => x.id === id);
    if (i >= 0) window.NODES_DATA.splice(i, 1);
    return `deleted "${input.node}"`;
  }

  async function execSetFormula(input) {
    _assertWritable();
    const node = _node(String(input.node || '').trim());
    if (!node) throw new Error(`node "${input.node}" not found`);
    const period = parseInt(input.period);
    if (!period || period < 1) throw new Error('period must be an integer >= 1');

    const nodesForFormula = (window.NODES_DATA || []).map(n => ({ id: n.id, label: n.label }));
    const display = String(input.formula ?? '');
    let stored;
    try {
      stored = window.Formula
        ? window.Formula.serialize(window.Formula.tokenize(display, nodesForFormula))
        : display;
    } catch (e) {
      throw new Error('invalid formula: ' + (e?.message || e));
    }
    const prev = window.VALUES_DATA?.[`${node.id}_${period}`]?.formula ?? null;
    await window.saveFormulaForPeriod(node.id, period, stored);
    window.pushUndo?.(async () => { await window.saveFormulaForPeriod(node.id, period, prev); });
    return `set formula of "${node.label}" @ period ${period}: ${display || '(cleared)'}`;
  }

  const _GROUP_PALETTE = ['#e57373', '#64b5f6', '#81c784', '#ffb74d', '#ba68c8', '#4db6ac', '#f06292', '#a1887f'];
  async function execCreateGroup(input) {
    _assertWritable();
    const name = String(input.name || '').trim();
    if (!name) throw new Error('group name is required');
    if (_grp(name)) return `group "${name}" already exists`;
    const groups = window.GROUPS_DATA || (window.GROUPS_DATA = []);
    const row = {
      id: crypto.randomUUID(), model_id: window.MODEL_ID, name,
      color: input.color || _GROUP_PALETTE[groups.length % _GROUP_PALETTE.length], comment: null
    };
    const { error } = await SB().from('groups').insert(row);
    if (error) throw new Error(error.message);
    groups.push(row);
    window.pushUndo?.(async () => {
      await SB().from('groups').delete().eq('id', row.id);
      const i = (window.GROUPS_DATA || []).findIndex(g => g.id === row.id);
      if (i >= 0) window.GROUPS_DATA.splice(i, 1);
    });
    return `created group "${name}"`;
  }

  async function execAssignGroup(input) {
    _assertWritable();
    const node = _node(input.node);
    if (!node) throw new Error(`node "${input.node}" not found`);
    const g = _grp(input.group);
    if (!g) throw new Error(`group "${input.group}" not found (create it first)`);
    const sb = SB();
    await sb.from('node_groups').delete().eq('node_id', node.id).eq('group_id', g.id);
    const { error } = await sb.from('node_groups').insert({ node_id: node.id, group_id: g.id });
    if (error) throw new Error(error.message);
    window.pushUndo?.(async () => { await sb.from('node_groups').delete().eq('node_id', node.id).eq('group_id', g.id); });
    return `assigned "${input.node}" to group "${input.group}"`;
  }

  async function execArrangeLayout(input) {
    _assertWritable();
    const nodes = (window.NODES_DATA || []).filter(n => !n.hidden);
    if (!nodes.length) return 'no nodes to arrange';
    const by = input?.by === 'parent' ? 'parent' : 'group';
    const jitter = input?.jitter != null ? Math.max(0, Math.min(1, _num(input.jitter, 0.6))) : 0.6;

    let keyOf;
    if (by === 'group') {
      const { data } = await SB().from('node_groups').select('node_id, group_id').in('node_id', nodes.map(n => n.id));
      const g = {}; (data || []).forEach(r => { if (!g[r.node_id]) g[r.node_id] = r.group_id; });
      keyOf = n => g[n.id] || _rootParent(n);
    } else {
      keyOf = n => _rootParent(n);
    }
    const clusters = {};
    nodes.forEach(n => { const k = keyOf(n); (clusters[k] = clusters[k] || []).push(n); });
    const keys = Object.keys(clusters);
    const cols = Math.max(1, Math.ceil(Math.sqrt(keys.length)));
    const ZONE = 460, STEP = 120;
    const prevPos = nodes.map(n => ({ id: n.id, x: n.x, y: n.y }));

    keys.forEach((k, zi) => {
      const zx = (zi % cols) * ZONE, zy = Math.floor(zi / cols) * ZONE;
      const members = clusters[k];
      const inner = Math.max(1, Math.ceil(Math.sqrt(members.length)));
      members.forEach((n, mi) => {
        const gx = zx + (mi % inner) * STEP;
        const gy = zy + Math.floor(mi / inner) * STEP;
        n.x = Math.round(gx + (Math.random() - 0.5) * STEP * jitter);
        n.y = Math.round(gy + (Math.random() - 0.5) * STEP * jitter);
      });
    });
    for (const n of nodes) await SB().from('nodes').update({ x: n.x, y: n.y }).eq('id', n.id);
    window.pushUndo?.(async () => {
      for (const p of prevPos) { await SB().from('nodes').update({ x: p.x, y: p.y }).eq('id', p.id); }
    });
    return `arranged ${nodes.length} nodes into ${keys.length} zones (by ${by})`;
  }

  async function execCreateConcept(input) {
    _assertWritable();
    const label = String(input.label || '').trim();
    if (!label) throw new Error('concept label is required');
    if (_concept(label)) return `concept "${label}" already exists`;
    const row = await window.createConcept(label, window.MODEL_ID, input.color || null, input.comment || null);
    if (!row || !row.id) throw new Error('failed to create concept');
    window.CONCEPTS_DATA = [...(window.CONCEPTS_DATA || []), row];
    if (window.CONCEPTS_MAP) window.CONCEPTS_MAP[row.id] = row;
    window.pushUndo?.(async () => {
      await SB().from('concepts').delete().eq('id', row.id);
      const i = (window.CONCEPTS_DATA || []).findIndex(c => c.id === row.id);
      if (i >= 0) window.CONCEPTS_DATA.splice(i, 1);
    });
    return `created concept "${label}"`;
  }

  async function execLinkNodes(input) {
    _assertWritable();
    const s = _node(input.source); if (!s) throw new Error(`node "${input.source}" not found`);
    const t = _node(input.target); if (!t) throw new Error(`node "${input.target}" not found`);
    if (s.id === t.id) throw new Error('cannot link a node to itself');
    const linkId = crypto.randomUUID();
    const { error } = await SB().from('links').insert({ id: linkId, model_id: window.MODEL_ID, source_id: s.id, target_id: t.id, type: 'manual' });
    if (error) throw new Error(error.message);
    const names = Array.isArray(input.concepts) ? input.concepts : (input.concepts ? [input.concepts] : []);
    const attached = [];
    for (const cn of names) {
      const c = _concept(cn);
      if (!c) { attached.push(`(missing "${cn}")`); continue; }
      const { error: e2 } = await SB().from('link_concepts').insert({ link_id: linkId, concept_id: c.id });
      if (!e2 || e2.code === '23505') attached.push(cn);
    }
    window.pushUndo?.(async () => {
      await SB().from('link_concepts').delete().eq('link_id', linkId);
      await SB().from('links').delete().eq('id', linkId);
    });
    return `linked "${input.source}" → "${input.target}"` + (attached.length ? ` [${attached.join(', ')}]` : '');
  }

  async function execTagParentEdge(input) {
    _assertWritable();
    const n = _node(input.node); if (!n) throw new Error(`node "${input.node}" not found`);
    if (!n.parent) throw new Error(`"${input.node}" has no parent edge to tag`);
    const c = _concept(input.concept); if (!c) throw new Error(`concept "${input.concept}" not found`);
    const { error } = await SB().from('node_parent_concepts').insert({ node_id: n.id, concept_id: c.id });
    if (error && error.code !== '23505') throw new Error(error.message);
    window.pushUndo?.(async () => { await SB().from('node_parent_concepts').delete().eq('node_id', n.id).eq('concept_id', c.id); });
    return `tagged "${input.node}" parent edge with "${input.concept}"`;
  }

  // ── System prompt ─────────────────────────────────────────────
  const SYSTEM = [
    'You are an AI assistant embedded inside IdeModel, a visual idea-modelling tool.',
    'You help the user build and evolve THEIR currently-open model by calling tools. Aim for a LIVING, visually meaningful model — not a flat list of nodes.',
    'Workflow:',
    '1. ALWAYS call get_model first to read the current state and the embedded _spec (data model + formula language).',
    '2. If the model needs multiple time steps, set the horizon FIRST with set_model_settings (periods=N). Formulas written beyond model.periods stay hidden until you raise it — never skip this for multi-period requests.',
    '3. Create the units you need (create_unit) with sensible min_value/max_value and a size range (e.g. 20..120 px). Units are what make size comparisons meaningful.',
    '4. Create nodes (create_node). For any QUANTITATIVE node, set its unit AND size_type "by unit" so its on-screen size encodes its value — this is the core visual value of the tool, use it generously.',
    '5. Build hierarchy with parent, and group related nodes into thematic zones with create_group + assign_to_group. Use color to reinforce zones.',
    '6. Define formulas (set_formula) for every derived/dependent node, across the relevant periods. {Label}[offset]: [0]=current, [-1]=previous; a node may only self-reference PAST periods.',
    '7. Express qualitative relationships when relevant: create_concept for the idea, then link_nodes (manual links between nodes) or tag_parent_edge, attaching concepts.',
    '8. Call arrange_layout LAST to place nodes into spatial zones with organic jitter (not rigidly aligned).',
    'Principles:',
    '- Reference nodes/units/groups by their exact names. Create a thing before referencing it.',
    '- Prefer a complete, well-structured model: units + size_type "by unit", hierarchy, groups/zones, colors, and formulas — not just bare nodes.',
    '- Make targeted changes that fulfill the request; keep labels unique and concise. After acting, briefly summarize what you built.',
    '',
    'DATA MODEL (get_model returns this shape; nodes are referenced by their unique label, everything else by a local id):',
    '- model: name, periods (how many discrete time steps the model spans), time_unit, starting_date.',
    '- units: number_format is presentation only (plain | integer | decimal2 | accounting | percent); min_value/max_value map to min_sz/max_sz for size-by-value.',
    '- nodes: label, parent (label or null), unit (local id or null), color, shape, size_type ("fixed" | "by unit"), hidden, text_only, comment.',
    '- timeValues: { node, period, formula } — only non-empty formulas are listed.',
    '- groups / concepts: local ids. nodeGroups assigns nodes to groups. links are manual concept edges; parentConcepts/linkConcepts attach concepts.',
    'FORMULA LANGUAGE:',
    '- A node\'s formula computes that node\'s own value; assignment is implicit (no "X =").',
    '- Reference another node by wrapping its exact label in braces + a period offset in brackets: {Label}[offset]. [0]=current period, [-1]=previous, [-2]=two back, [+1]=next.',
    '- A node may reference ONLY its own PAST periods ({Caja}[-1], ...). Never {Caja}[0] or {Caja}[+1] of itself — that is a cycle.',
    '- [-1] in period 1 is undefined. An empty formula means no value that period. A bare number is a valid formula (e.g. "100").',
    '- Operators: + - * / ^ = != > < >= <= AND OR NOT. Functions: SUM AVG MIN MAX ABS ROUND IF AND OR NOT, plus RND(a,b) (sealed once on save) and FRND(a,b) (re-rolls on every recompute).',
    '- Examples: {Ventas}[0] - {Costos}[0] ; {Caja}[-1] + {Ingresos}[0] - {Egresos}[0] ; {Clientes}[-1] * 1.05'
  ].join('\n');

  // ── UI ────────────────────────────────────────────────────────
  let msgsEl, inputEl, sendBtn, running = false;

  const chip = document.createElement('div');
  chip.id = 'ai-chip';
  chip.textContent = 'AI';
  chip.title = 'AI assistant';
  document.body.appendChild(chip);

  const panelEl = document.createElement('div');
  panelEl.id = 'ai-panel';
  panelEl.classList.add('hidden');
  panelEl.innerHTML = `
    <div class="ai-head">
      <div class="ai-title"><span class="ai-spark">✦</span> Assistant</div>
      <div class="ai-head-btns">
        <div class="ai-gear" id="ai-gear" title="Settings">⚙</div>
        <div class="ai-close" id="ai-close">×</div>
      </div>
    </div>
    <div class="ai-settings hidden" id="ai-settings">
      <label class="ai-field">Provider
        <select id="ai-provider"></select>
      </label>
      <label class="ai-field">Model
        <select id="ai-model"></select>
      </label>
      <label class="ai-field">API key (your own — stored only in this browser)
        <input type="password" id="ai-key" placeholder="" autocomplete="off" />
      </label>
      <label class="ai-field">Apply mode
        <select id="ai-mode">
          <option value="confirm">Propose &amp; confirm</option>
          <option value="auto">Auto-apply</option>
        </select>
      </label>
      <div class="ai-settings-actions">
        <div class="ai-settings-clear" id="ai-settings-clear">Clear key</div>
        <div class="ai-settings-save" id="ai-settings-save">Save</div>
      </div>
    </div>
    <div class="ai-msgs" id="ai-msgs"></div>
    <div class="ai-input-row">
      <textarea id="ai-input" rows="1" placeholder="Ask the assistant to build something…"></textarea>
      <div class="ai-send" id="ai-send">↑</div>
    </div>`;
  document.body.appendChild(panelEl);

  msgsEl  = panelEl.querySelector('#ai-msgs');
  inputEl = panelEl.querySelector('#ai-input');
  sendBtn = panelEl.querySelector('#ai-send');
  const settingsEl = panelEl.querySelector('#ai-settings');
  const provSel = panelEl.querySelector('#ai-provider');
  const modelSel = panelEl.querySelector('#ai-model');
  const keyInput = panelEl.querySelector('#ai-key');
  const modeSel = panelEl.querySelector('#ai-mode');

  provSel.innerHTML = PROVIDERS.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

  function fillModels() {
    modelSel.innerHTML = (MODELS[cfg.provider] || []).map(m => `<option value="${m.id}">${m.name}</option>`).join('');
    modelSel.value = cfg.model;
  }
  function syncSettingsUI() {
    provSel.value = cfg.provider; fillModels();
    keyInput.value = cfg.key; modeSel.value = cfg.mode;
    keyInput.placeholder = (PROVIDERS.find(p => p.id === cfg.provider) || {}).keyHint || '';
  }
  syncSettingsUI();

  function openPanel(v) {
    panelEl.classList.toggle('hidden', !v);
    chip.classList.toggle('open', v);
    if (v) {
      if (!cfg.key) settingsEl.classList.remove('hidden');
      setTimeout(() => inputEl.focus(), 50);
      if (!msgsEl.childElementCount) greet();
    }
  }
  chip.addEventListener('click', () => openPanel(panelEl.classList.contains('hidden')));
  panelEl.querySelector('#ai-close').addEventListener('click', () => openPanel(false));
  panelEl.querySelector('#ai-gear').addEventListener('click', () => settingsEl.classList.toggle('hidden'));

  // Cambiar de proveedor: refresca modelos + key + placeholder (key es por proveedor)
  provSel.addEventListener('change', () => {
    cfg.provider = provSel.value;
    convo = [];   // historiales no son compatibles entre proveedores
    syncSettingsUI();
  });
  panelEl.querySelector('#ai-settings-save').addEventListener('click', () => {
    cfg.provider = provSel.value; cfg.model = modelSel.value;
    cfg.key = keyInput.value.trim(); cfg.mode = modeSel.value;
    settingsEl.classList.add('hidden');
    bubble('system', cfg.key ? 'Settings saved.' : 'API key cleared.');
  });

  // Borra del navegador la key del proveedor actual (útil en una compu compartida)
  // y limpia el chat en memoria/pantalla. No revoca la key en el proveedor.
  panelEl.querySelector('#ai-settings-clear').addEventListener('click', () => {
    cfg.key = '';            // removeItem de idemodel_ai_key_<provider>
    keyInput.value = '';
    convo = [];
    msgsEl.innerHTML = '';
    greet();                 // sin key → muestra el aviso de cómo configurarlo
  });

  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
  });
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  });
  sendBtn.addEventListener('click', submit);

  // ── Render helpers ────────────────────────────────────────────
  function bubble(role, text) {
    const el = document.createElement('div');
    el.className = `ai-bubble ai-${role}`;
    el.textContent = text;
    msgsEl.appendChild(el);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    return el;
  }
  function toolCard(name, input) {
    const el = document.createElement('div');
    el.className = 'ai-tool';
    el.innerHTML = `<span class="ai-tool-name">${name}</span> <span class="ai-tool-args"></span>`;
    el.querySelector('.ai-tool-args').textContent = _argsPreview(name, input);
    msgsEl.appendChild(el);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }
  function _argsPreview(name, input) {
    switch (name) {
      case 'get_model':       return '';
      case 'set_model_settings': return Object.entries(input).map(([k, v]) => `${k}=${v}`).join(', ');
      case 'create_unit':     return `"${input.name}"`;
      case 'update_unit':     return `${input.unit}` + (input.number_format ? ` → ${input.number_format}` : '');
      case 'create_node':     return `"${input.label}"` + (input.parent ? ` ⟵ ${input.parent}` : '') + (input.unit ? ` [${input.unit}]` : '');
      case 'update_node':     return `${input.node}`;
      case 'delete_node':     return `${input.node}`;
      case 'set_formula':     return `${input.node} @${input.period}: ${input.formula}`;
      case 'create_group':    return `"${input.name}"`;
      case 'assign_to_group': return `${input.node} → ${input.group}`;
      case 'create_concept':  return `"${input.label}"`;
      case 'link_nodes':      return `${input.source} → ${input.target}` + (input.concepts?.length ? ` [${[].concat(input.concepts).join(', ')}]` : '');
      case 'tag_parent_edge': return `${input.node} : ${input.concept}`;
      case 'arrange_layout':  return `by ${input.by || 'group'}`;
    }
    try { return JSON.stringify(input); } catch (_) { return ''; }
  }
  function confirmCard(name, input) {
    return new Promise((resolve) => {
      const el = document.createElement('div');
      el.className = 'ai-confirm';
      el.innerHTML = `
        <div class="ai-confirm-q">Apply <b>${name}</b>?</div>
        <div class="ai-confirm-args"></div>
        <div class="ai-confirm-btns">
          <div class="ai-btn ai-approve">Approve</div>
          <div class="ai-btn ai-approve-all">Approve all</div>
          <div class="ai-btn ai-reject">Reject</div>
        </div>`;
      el.querySelector('.ai-confirm-args').textContent = _argsPreview(name, input);
      const done = (label, value) => { el.classList.add('ai-done'); el.querySelector('.ai-confirm-btns').textContent = label; resolve(value); };
      el.querySelector('.ai-approve').addEventListener('click', () => done('✓ approved', 'approve'));
      el.querySelector('.ai-approve-all').addEventListener('click', () => done('✓ approved all', 'approveAll'));
      el.querySelector('.ai-reject').addEventListener('click', () => done('✕ rejected', 'reject'));
      msgsEl.appendChild(el);
      msgsEl.scrollTop = msgsEl.scrollHeight;
    });
  }
  function greet() {
    if (cfg.key) {
      bubble('system', 'Hi — describe what you want to build or change in this model. I read it first, then create nodes and formulas (you approve each change unless you switch to auto-apply).');
    } else {
      const el = bubble('system', '');
      el.innerHTML = 'To use the assistant, open ⚙, pick a provider and paste your own API key. '
        + 'It is stored only in this browser and your tokens pay for the usage.<br><br>'
        + '<strong>Your account must have API credits.</strong> The API is pay-as-you-go — a claude.ai chat subscription does not count. '
        + 'Gemini has a free tier if you want to try without paying.';
    }
  }

  // ── Loop agéntico ─────────────────────────────────────────────
  async function submit() {
    const text = inputEl.value.trim();
    if (!text || running) return;
    if (!cfg.key) { settingsEl.classList.remove('hidden'); bubble('system', 'Add your API key in ⚙ first.'); return; }
    inputEl.value = ''; inputEl.style.height = 'auto';
    bubble('user', text);
    await runAgent(text);
  }

  let convo = [];   // historial neutral, multi-turno

  // Poda de payloads grandes: si hay varios get_model en el historial, deja solo el más
  // reciente con contenido y reemplaza los anteriores por un stub (no se re-mandan completos).
  function pruneStaleModelSnapshots() {
    const idxs = [];
    convo.forEach((m, i) => { if (m.role === 'tool' && (m.results || []).some(r => r.name === 'get_model')) idxs.push(i); });
    for (let k = 0; k < idxs.length - 1; k++) {
      const m = convo[idxs[k]];
      m.results = m.results.map(r => r.name === 'get_model'
        ? { ...r, content: '(stale model snapshot omitted — a newer get_model result is below)' }
        : r);
    }
  }

  async function runAgent(userText) {
    const adapter = adapters[cfg.provider];
    running = true; chip.classList.add('busy'); sendBtn.classList.add('busy');
    const thinking = bubble('system', '…');
    convo.push({ role: 'user', text: userText });
    let didWrite = false;
    let approveAll = false;   // "Approve all" aprueba el resto de este pedido

    try {
      while (true) {
        const resp = await adapter.send({ system: SYSTEM, convo, tools: TOOLS, model: cfg.model, key: cfg.key });
        convo.push({ role: 'assistant', text: resp.text, toolCalls: resp.toolUses });
        thinking.remove();
        if (resp.text) bubble('assistant', resp.text);

        if (resp.stop === 'tool_use' && resp.toolUses.length) {
          const results = [];
          for (const tu of resp.toolUses) {
            toolCard(tu.name, tu.input);
            const tool = TOOL_BY_NAME[tu.name];
            if (!tool) { results.push({ id: tu.id, name: tu.name, content: `ERROR: unknown tool ${tu.name}` }); continue; }
            if (tool.write && cfg.mode === 'confirm' && !approveAll) {
              const choice = await confirmCard(tu.name, tu.input);
              if (choice === 'approveAll') approveAll = true;
              else if (choice === 'reject') { results.push({ id: tu.id, name: tu.name, content: 'User rejected this action. Do not retry; ask how to proceed.' }); continue; }
            }
            try {
              const out = await tool.run(tu.input);
              if (tool.write) didWrite = true;
              results.push({ id: tu.id, name: tu.name, content: String(out) });
            } catch (e) {
              results.push({ id: tu.id, name: tu.name, content: 'ERROR: ' + (e?.message || e) });
            }
          }
          convo.push({ role: 'tool', results });
          pruneStaleModelSnapshots();
          continue;
        }
        break;   // end
      }
    } catch (e) {
      thinking.remove();
      bubble('system', '⚠ ' + (e?.message || e));
    } finally {
      running = false; chip.classList.remove('busy'); sendBtn.classList.remove('busy');
      if (didWrite && typeof window.reloadCurrentModel === 'function') {
        try { await window.reloadCurrentModel(); } catch (_) {}
      }
    }
  }
})();
