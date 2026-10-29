/**
 * Local storage access that never throws: private browsing, a full quota or a blocked storage
 * reads as nothing stored and drops the write, so the game always starts.
 *
 * @module ui/storage
 */

/** Engine save string of the reign in progress. */
export const SAVE_KEY = 'grand_audit_save'
/** Archive of record: points, invested perks, unlocked feats. */
export const ARCHIVE_KEY = 'grand_audit_archive'
/** History of concluded reigns (`RunRecord` document). */
export const HISTORY_KEY = 'grand_audit_history'
/** Player settings. */
export const SETTINGS_KEY = 'grand_audit_settings'

/** Reads a stored value; `null` when absent or when storage is unavailable. */
export function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Writes a stored value, or removes the key when `value` is `null`; storage errors are dropped. */
export function writeKey(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Storage unavailable or full: the game keeps running on its in memory state.
  }
}
