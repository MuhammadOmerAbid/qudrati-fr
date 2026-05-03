const DEFAULT_BASES = ['http://localhost:8000/api', 'http://localhost:8001/api']
const PROBE_TIMEOUT_MS = 2500
const RAILWAY_FALLBACK = 'https://qudarti-foods-10-production.up.railway.app/api'

const normalizeBase = (value) => String(value || '').trim().replace(/\/+$/, '')
const isValidApiBase = (value) => {
  const normalized = normalizeBase(value)
  if (!normalized) return false
  try {
    const parsed = new URL(normalized)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

const uniqueBases = (values) => {
  const seen = new Set()
  const out = []
  values.forEach((value) => {
    const normalized = normalizeBase(value)
    if (!isValidApiBase(normalized) || seen.has(normalized)) return
    seen.add(normalized)
    out.push(normalized)
  })
  return out
}

const parseCandidateBases = () => {
  const raw = String(process.env.NEXT_PUBLIC_API_CANDIDATES || '').trim()
  if (!raw) return []

  return raw
    .split(',')
    .map((v) => normalizeBase(v))
    .filter(isValidApiBase)
}

const getOrderedCandidates = () => {
  const privateBase = normalizeBase(process.env.BACKEND_API_URL)
  const publicBase = normalizeBase(process.env.NEXT_PUBLIC_API_URL)
  const envCandidates = parseCandidateBases()

  return uniqueBases([
    privateBase,
    publicBase,
    ...envCandidates,
    ...DEFAULT_BASES,
    RAILWAY_FALLBACK,
  ])
}

const probeBase = async (base) => {
  const probePaths = ['/auth/login/', '/health/']

  for (const path of probePaths) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
    try {
      const response = await fetch(`${base}${path}`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      })

      if (response.status < 500) return true
    } catch {
      // try next probe path
    } finally {
      clearTimeout(timeoutId)
    }
  }

  return false
}

export async function resolveBackendBase() {
  const candidateBases = getOrderedCandidates()

  for (const base of candidateBases) {
    if (await probeBase(base)) {
      return { base, message: '' }
    }
  }

  return {
    base: null,
    message: `Backend API is not reachable. Checked: ${candidateBases.join(', ')}`,
  }
}
