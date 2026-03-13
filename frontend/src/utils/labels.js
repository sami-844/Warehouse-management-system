/**
 * UI Labels utility — loads admin-editable labels from backend,
 * falls back to hardcoded defaults if API unavailable.
 */

let _labels = {}; // key → value map
let _loaded = false;

/** Load labels from API into memory. Call once on app startup. */
export async function loadLabels() {
  try {
    const res = await fetch('/api/admin/labels');
    if (!res.ok) throw new Error('Labels API error');
    const data = await res.json();
    const arr = Array.isArray(data) ? data : (data?.items || []);
    _labels = {};
    arr.forEach(l => { _labels[l.key] = l.value; });
    _loaded = true;
  } catch (e) {
    console.warn('Could not load UI labels, using defaults');
    _loaded = false;
  }
}

/**
 * Get a label value by key. Falls back to the provided default if not loaded.
 * @param {string} key  - e.g. "nav.products" or "section.inventory"
 * @param {string} fallback - default text if label not found
 * @returns {string}
 */
export function label(key, fallback) {
  if (_loaded && _labels[key] !== undefined) return _labels[key];
  return fallback;
}

/** Check if labels have been loaded */
export function labelsLoaded() {
  return _loaded;
}
