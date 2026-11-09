export const SAVE_KEY = 'neonheist.save.v1';
export const SETTINGS_KEY = 'neonheist.settings.v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1) return null;
    return data;
  } catch { return null; }
}

export function writeSave(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, v: 1, savedAt: Date.now() }));
    return true;
  } catch { return false; }
}

export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch {} }

export function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'); } catch { return null; }
}
export function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
}
