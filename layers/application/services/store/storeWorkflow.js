const STORE_RESET_EXACT_KEYS = new Set([
  'store.productionOrderDrafts',
  'store.finishedGoodsDrafts',
  'qf-gate-outward-records',
  'qf-gate-outward-manual-customers',
  'qf-store-entry-tracker-v1',
])

const STORE_RESET_PREFIXES = [
  'store.',
  'qf-gate-outward-',
  'qf-store-entry-tracker',
]

function isStoreResetKey(key) {
  const safeKey = String(key || '').trim()
  if (!safeKey) return false
  if (STORE_RESET_EXACT_KEYS.has(safeKey)) return true
  return STORE_RESET_PREFIXES.some((prefix) => safeKey.startsWith(prefix))
}

function collectStoreKeys(storageRef, bag) {
  if (!storageRef) return
  for (let index = 0; index < storageRef.length; index += 1) {
    const key = storageRef.key(index)
    if (!isStoreResetKey(key)) continue
    bag.add(key)
  }
}

export function getStoreResetStats() {
  if (typeof window === 'undefined') return { keys: [], count: 0 }
  const keys = new Set()
  collectStoreKeys(window.localStorage, keys)
  collectStoreKeys(window.sessionStorage, keys)
  const list = Array.from(keys).sort()
  return { keys: list, count: list.length }
}

export function resetStoreStateOnClient() {
  if (typeof window === 'undefined') return { removedKeys: [], removedCount: 0 }

  const { keys } = getStoreResetStats()
  keys.forEach((key) => {
    window.localStorage.removeItem(key)
    window.sessionStorage.removeItem(key)
  })

  window.dispatchEvent(new CustomEvent('store:state-reset', { detail: { keys } }))
  window.dispatchEvent(new CustomEvent('store-entries-updated'))

  return { removedKeys: keys, removedCount: keys.length }
}
