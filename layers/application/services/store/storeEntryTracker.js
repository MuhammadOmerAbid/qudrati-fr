const STORE_ENTRY_TRACKER_KEY = 'qf-store-entry-tracker-v1'

function getTodayISO() {
  return new Date().toISOString().slice(0, 10)
}

function readTracker() {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORE_ENTRY_TRACKER_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeTracker(data) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORE_ENTRY_TRACKER_KEY, JSON.stringify(data))
}

export function incrementStoreEntries(moduleId, count = 1, dateISO = getTodayISO()) {
  if (typeof window === 'undefined') return
  if (!moduleId || count <= 0) return

  const tracker = readTracker()
  const dayStats = tracker[dateISO] && typeof tracker[dateISO] === 'object' ? tracker[dateISO] : {}
  const prev = Number(dayStats[moduleId]) || 0

  tracker[dateISO] = {
    ...dayStats,
    [moduleId]: prev + Number(count),
  }

  writeTracker(tracker)
  window.dispatchEvent(new CustomEvent('store-entries-updated'))
}

export function getTodayStoreEntries(allowedModuleIds = []) {
  const tracker = readTracker()
  const today = getTodayISO()
  const dayStats = tracker[today] && typeof tracker[today] === 'object' ? tracker[today] : {}

  if (!Array.isArray(allowedModuleIds) || allowedModuleIds.length === 0) {
    return Object.values(dayStats).reduce((sum, value) => sum + (Number(value) || 0), 0)
  }

  return allowedModuleIds.reduce((sum, moduleId) => sum + (Number(dayStats[moduleId]) || 0), 0)
}

