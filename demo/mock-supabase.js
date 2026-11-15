// Nachbau von Supabase für die Vorschau: Daten liegen nur in diesem Browser.
// Zugriffsregel wie in supabase-setup.sql: jede Person sieht nur eigene Zeilen (owner_id).
(function () {
  const DB_KEY = 'duzio-demo-db-v1', SESSION_KEY = 'duzio-demo-session-v1';
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };
  const S = 'u-simon';
  const day = (o) => { const d = new Date(); d.setDate(d.getDate() + o); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
  const now = () => new Date().toISOString();

  function seed() {
    const f = (id, name, kcal, protein, fat, carbs, extra = {}) => ({ id, owner_id: S, name, brand: '', barcode: null, unit: 'g', kcal, protein, fat, carbs, sugar: null, fiber: null, salt: null, portions: [], source: 'own', fav: false, created_at: now(), updated_at: now(), ...extra });
    const foods = [
      f('f-skyr', 'Skyr Natur', 63, 11, 0.2, 4, { brand: 'Milsani', fav: true, portions: [{ n: 'Becher', g: 450 }], source: 'off', barcode: '4061458021234' }),
      f('f-muesli', 'Knuspermüsli', 430, 9, 14, 64, { portions: [{ n: 'Portion', g: 50 }] }),
      f('f-whey', 'Whey Protein Vanille', 380, 75, 6, 6, { fav: true, portions: [{ n: 'Messlöffel', g: 30 }] }),
      f('f-brot', 'Schwarzbrot', 220, 7, 1.5, 41, { portions: [{ n: 'Scheibe', g: 45 }] }),
      f('f-eier', 'Ei', 155, 13, 11, 1.1, { portions: [{ n: 'Stück', g: 60 }] }),
      f('f-toast', 'Proteintoast', 260, 22, 8, 20, { portions: [{ n: 'Scheibe', g: 33 }] }),
      f('f-banane', 'Banane', 89, 1.1, 0.3, 23, { portions: [{ n: 'Stück', g: 120 }] }),
    ];
    const ing = (name, g, aisle, kcal, protein, fat, carbs) => ({ name, g, label: '', aisle, food_id: null, kcal, protein, fat, carbs });
    const recipes = [
      { id: 'r-bowl', owner_id: S, title: 'Hähnchen-Reis-Bowl', servings: 2, minutes: 25, tags: ['High Protein', 'Meal Prep'], fav: true, note: 'Hält im Kühlschrank 3 Tage.',
        ingredients: [ing('Hühnerbrust', 400, 'Fleisch & Fisch', 110, 23, 1.5, 0), ing('Basmatireis', 150, 'Trockenware & Konserven', 350, 8, 1, 77), ing('Brokkoli', 300, 'Obst & Gemüse', 34, 2.8, 0.4, 7), ing('Sojasauce', 20, 'Gewürze & Öle', 60, 8, 0, 6), ing('Olivenöl', 10, 'Gewürze & Öle', 884, 0, 100, 0)],
        steps: ['Reis nach Packung kochen.', 'Hühnerbrust würfeln und in Olivenöl 8 Minuten anbraten.', 'Brokkoli 5 Minuten dämpfen.', 'Alles mit Sojasauce anrichten.'], created_at: now(), updated_at: now() },
      { id: 'r-overnight', owner_id: S, title: 'Overnight Oats mit Skyr', servings: 1, minutes: 5, tags: ['Frühstück'], fav: false, note: '',
        ingredients: [ing('Haferflocken', 60, 'Trockenware & Konserven', 370, 13, 7, 59), ing('Skyr Natur', 200, 'Kühlregal', 63, 11, 0.2, 4), ing('Heidelbeeren', 80, 'Obst & Gemüse', 57, 0.7, 0.3, 14)],
        steps: ['Alles verrühren und über Nacht kalt stellen.'], created_at: now(), updated_at: now() },
    ];
    const e = (id, d, meal, name, amount, unit_label, grams, kcal, protein, fat, carbs, extra = {}) => ({ id, owner_id: S, day: day(d), meal, name, food_id: null, recipe_id: null, amount, unit_label, grams, kcal, protein, fat, carbs, planned: false, created_at: now(), ...extra });
    const entries = [
      e('e1', 0, 'breakfast', 'Skyr Natur', 1, 'Becher', 450, 284, 49.5, 0.9, 18, { food_id: 'f-skyr' }),
      e('e2', 0, 'breakfast', 'Knuspermüsli', 1, 'Portion', 50, 215, 4.5, 7, 32, { food_id: 'f-muesli' }),
      e('e3', 0, 'lunch', 'Hähnchen-Reis-Bowl', 1, 'Portion', 440, 548, 56, 8.8, 62, { recipe_id: 'r-bowl' }),
      e('e4', 0, 'snack', 'Banane', 1, 'Stück', 120, 107, 1.3, 0.4, 27.6, { food_id: 'f-banane' }),
      ...[-6, -5, -4, -3, -2, -1].map((d, k) => e('h' + k, d, 'lunch', 'Hähnchen-Reis-Bowl', 1, 'Portion', 440, 1700 + k * 120, 120, 60, 190, { recipe_id: 'r-bowl' })),
      e('p1', 1, 'lunch', 'Hähnchen-Reis-Bowl', 2, 'Portion', 880, 1096, 112, 17.6, 124, { recipe_id: 'r-bowl', planned: true }),
      e('p2', 2, 'breakfast', 'Overnight Oats mit Skyr', 1, 'Portion', 340, 393, 30, 4.6, 70, { recipe_id: 'r-overnight', planned: true }),
    ];
    return {
      duzio_profile: [{ owner_id: S, sex: 'm', birth_year: 2000, height_cm: 175, activity: 1.55, goal: 'gain', goal_kg: 78, kcal_goal: null, macro: { c: 45, p: 30, f: 25 }, water_goal: 2500, updated_at: now() }],
      duzio_foods: foods, duzio_recipes: recipes, duzio_entries: entries,
      duzio_water: [{ owner_id: S, day: day(0), ml: 1250 }],
      duzio_weights: [-56, -42, -28, -21, -14, -7, 0].map((d, k) => ({ owner_id: S, day: day(d), kg: [75.2, 75.6, 75.9, 76.1, 76.0, 76.4, 76.6][k] })),
      duzio_shopping: [
        { id: 's1', owner_id: S, name: 'Milch', qty: null, unit: '', aisle: 'Kühlregal', done: false, created_at: now() },
        { id: 's2', owner_id: S, name: 'Paradeiser', qty: 500, unit: 'g', aisle: 'Obst & Gemüse', done: false, created_at: now() },
        { id: 's3', owner_id: S, name: 'Kaffeebohnen', qty: null, unit: '', aisle: 'Getränke', done: true, created_at: now() },
      ],
    };
  }

  let db = (() => { try { return JSON.parse(ls.get(DB_KEY)) || seed(); } catch { return seed(); } })();
  const save = () => ls.set(DB_KEY, JSON.stringify(db));
  let session = (() => { try { return JSON.parse(ls.get(SESSION_KEY)); } catch { return null; } })();
  const me = () => session?.user?.id || null;
  const KEYS = { duzio_profile: ['owner_id'], duzio_water: ['owner_id', 'day'], duzio_weights: ['owner_id', 'day'] };
  const keyOf = (t) => KEYS[t] || ['id'];

  // Abfrage wie supabase-js: select/insert/update/upsert/delete mit eq, in, gte, lte, order, limit; await-bar
  function query(table) {
    const q = { op: 'select', filters: [], orderBy: null, lim: null, payload: null };
    const rows = () => (db[table] ||= []).filter((r) => r.owner_id === me() && q.filters.every((f) => f(r)));
    const run = () => {
      if (!me()) return { data: null, error: { message: 'not authenticated' } };
      if (q.op === 'select') {
        let out = rows().map((r) => ({ ...r }));
        if (q.orderBy) out.sort((a, b) => String(a[q.orderBy]).localeCompare(String(b[q.orderBy]), 'de'));
        if (q.lim) out = out.slice(0, q.lim);
        return { data: out, error: null };
      }
      if (q.op === 'insert' || q.op === 'upsert') {
        const list = Array.isArray(q.payload) ? q.payload : [q.payload];
        for (const r of list) {
          if (r.owner_id && r.owner_id !== me()) return { data: null, error: { message: 'row-level security' } };
          const row = { ...r, owner_id: me() }, k = keyOf(table);
          const i = db[table].findIndex((x) => k.every((c) => x[c] === row[c]));
          if (i >= 0 && q.op === 'insert') return { data: null, error: { message: 'duplicate key' } };
          if (i >= 0) db[table][i] = { ...db[table][i], ...row }; else db[table].push({ created_at: new Date().toISOString(), ...row });
        }
        save();
        return { data: null, error: null };
      }
      if (q.op === 'update') { rows().forEach((r) => Object.assign(r, q.payload, { owner_id: me() })); save(); return { data: null, error: null }; }
      if (q.op === 'delete') { const del = new Set(rows()); db[table] = db[table].filter((r) => !del.has(r)); save(); return { data: null, error: null }; }
    };
    const api = {
      select() { return api; },
      insert(p) { q.op = 'insert'; q.payload = p; return api; },
      upsert(p) { q.op = 'upsert'; q.payload = p; return api; },
      update(p) { q.op = 'update'; q.payload = p; return api; },
      delete() { q.op = 'delete'; return api; },
      eq(c, v) { q.filters.push((r) => r[c] === v); return api; },
      in(c, v) { q.filters.push((r) => v.includes(r[c])); return api; },
      gte(c, v) { q.filters.push((r) => r[c] >= v); return api; },
      lte(c, v) { q.filters.push((r) => r[c] <= v); return api; },
      order(c) { q.orderBy = c; return api; },
      limit(n) { q.lim = n; return api; },
      then(res, rej) { return Promise.resolve().then(run).then(res, rej); },
    };
    return api;
  }

  const listeners = [];
  const emit = (ev) => listeners.forEach((fn) => fn(ev, session));
  window.__DEMO = true;
  window.__mockSupabase = {
    createClient: () => ({
      from: query,
      auth: {
        getSession: async () => ({ data: { session } }),
        onAuthStateChange(fn) { listeners.push(fn); setTimeout(() => fn(session ? 'SIGNED_IN' : 'SIGNED_OUT', session), 0); return { data: { subscription: { unsubscribe() {} } } }; },
        async signInWithPassword({ email, password }) {
          if (email !== 'simon@demo.at' || password !== 'demo123') return { error: { message: 'Invalid login credentials' } };
          session = { user: { id: S, email } };
          ls.set(SESSION_KEY, JSON.stringify(session));
          emit('SIGNED_IN');
          return { error: null };
        },
        async signOut() { session = null; ls.del(SESSION_KEY); emit('SIGNED_OUT'); return { error: null }; },
      },
    }),
  };
})();
