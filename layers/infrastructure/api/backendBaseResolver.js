const LOCALHOST_API_REGEX = /^https?:\/\/localhost:(8000|8001)\/api$/i
const DEFAULT_BASES = ['http://localhost:8000/api', 'http://localhost:8001/api']
const PROBE_TIMEOUT_MS = 2500

const normalizeBase = (value) => String(value || '').trim().replace(/\/+$/, '')
const isLocalhostApiBase = (value) => LOCALHOST_API_REGEX.test(normalizeBase(value))

const parseCandidateBases = () => {
  const raw = String(process.env.NEXT_PUBLIC_API_CANDIDATES || '').trim()
  if (!raw) return DEFAULT_BASES
  const fromEnv = raw
    .split(',')
    .map((v) => normalizeBase(v))
    .filter(isLocalhostApiBase)
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
  const candidateBases = parseCandidateBases()
  for (const base of candidateBases) {
    if (await probeBase(base)) {
      return { base, message: '' }
    }
  }

  return {
    base: null,
    message: 'Backend API is not reachable on localhost:8000 or localhost:8001.',
  }
}
