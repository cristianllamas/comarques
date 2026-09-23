// Progress lives in localStorage on his phone. It survives updates to the app; clearing
// browser data wipes it. Every read is defensive — a corrupt or half-written value must
// never stop him studying.

const KEY = 'comarques.v1';

const DEFAULTS = {
  items: {},
  examDate: null,      // ISO date string; drives interval clipping and exam mode
  includeLlucanes: false, // off by default: 42 comarques, the pre-2023 list
  sessions: 0,
  lastSession: 0,
};

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw);
    return { ...DEFAULTS, ...p, items: p.items && typeof p.items === 'object' ? p.items : {} };
  } catch {
    return { ...DEFAULTS };
  }
}

export function save(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch { /* private mode or full quota — studying still works, it just won't persist */ }
}

export function reset() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
