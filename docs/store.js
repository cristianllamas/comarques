// Progress lives in localStorage on the learner's own device. It survives updates to the
// app; clearing browser data wipes it. Every read is defensive — a corrupt or
// half-written value must never stop anyone studying.
//
// Shape:
//   { pack: 'comarques-capitals' | null,
//     packs: { [packId]: { items, order, toggle, sessions, lastSession } } }

const KEY = 'geografia.v2';

// The comarques-only app stored its progress here. It is copied into the new shape on
// first load and deliberately left in place: if the app is ever rolled back to the
// pre-packs version, that version finds its data exactly where it left it.
const LEGACY_KEY = 'comarques.v1';
const LEGACY_PACK = 'comarques-capitals';

const packDefaults = () => ({
  items: {},
  order: [],       // shuffled introduction order, see scheduler.ensureOrder
  toggle: false,   // the topic's on/off option (Lluçanès); off by default
  sessions: 0,
  lastSession: 0,
});

const empty = () => ({ pack: null, packs: {} });

function fromLegacy() {
  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) return null;
  const p = JSON.parse(raw);
  if (!p || typeof p !== 'object') return null;
  return {
    pack: LEGACY_PACK,
    packs: {
      [LEGACY_PACK]: {
        ...packDefaults(),
        items: p.items && typeof p.items === 'object' ? p.items : {},
        toggle: !!p.includeLlucanes,
        sessions: Number(p.sessions) || 0,
        lastSession: Number(p.lastSession) || 0,
      },
    },
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const migrated = fromLegacy();
      if (migrated) save(migrated);
      return migrated || empty();
    }
    const p = JSON.parse(raw);
    return {
      pack: typeof p.pack === 'string' ? p.pack : null,
      packs: p.packs && typeof p.packs === 'object' ? p.packs : {},
    };
  } catch {
    return empty();
  }
}

/** The progress for one pack, created with defaults the first time it is opened. */
export function packState(root, id) {
  const cur = root.packs[id];
  const ok = cur && typeof cur === 'object';
  root.packs[id] = {
    ...packDefaults(), ...(ok ? cur : {}),
    items: ok && cur.items && typeof cur.items === 'object' ? cur.items : {},
    order: ok && Array.isArray(cur.order) ? cur.order : [],
  };
  return root.packs[id];
}

export function save(root) {
  try { localStorage.setItem(KEY, JSON.stringify(root)); }
  catch { /* private mode or full quota — studying still works, it just won't persist */ }
}

/** Wipe one pack's progress; the others are untouched. */
export function resetPack(root, id) {
  delete root.packs[id];
  save(root);
}
