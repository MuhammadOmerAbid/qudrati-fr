const DEFAULT_BASES = ['http://localhost:8000/api', 'http://localhost:8001/api']
const PROBE_TIMEOUT_MS = 2500
const RAILWAY_URL = 'https://qudarti-foods-10-production.up.railway.app/api'

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

const getExplicitBase = () => {
  // Hardcoded production URL as fallback
  const hardcoded = RAILWAY_URL

  const privateBase = normalizeBase(process.env.BACKEND_API_URL)
  if (isValidApiBase(privateBase)) return privateBase

  const publicBase = normalizeBase(process.env.NEXT_PUBLIC_API_URL)
  if (isValidApiBase(publicBase)) return publicBase

  return hardcoded
}

const parseCandidateBases = () => {
  const raw = String(process.env.NEXT_PUBLIC_API_CANDIDATES || '').trim()
  if (!raw) return DEFAULT_BASES
  const fromEnv = raw
    .split(',')
    .map((v) => normalizeBase(v))
    .filter(isValidApiBase)
  return fromEnv.length ? fromEnv : DEFAULT_BASES
}

const probeBase = async (base) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
  try {
    const response = await fetch(`${base}/health/`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok) return false
    const body = await response.json().catch(() => null)
    return body?.status === 'ok'
  } catch {
    return false
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function resolveBackendBase() {
  const explicitBase = getExplicitBase()
  if (explicitBase) {
    return { base: explicitBase, message: '' }
  }

  const candidateBases = parseCandidateBases()
  for (const base of candidateBases) {
    if (await probeBase(base)) {
      return { base, message: '' }
    }
  }

  return {
    base: null,
    message: 'Backend API is not reachable. Set BACKEND_API_URL/NEXT_PUBLIC_API_URL or verify NEXT_PUBLIC_API_CANDIDATES.',
  }
}
