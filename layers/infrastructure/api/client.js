import axios from 'axios'

const RESOLVE_ENDPOINT = '/api/backend-base'
const RESOLVE_TIMEOUT_MS = 4000
const DEFAULT_BASES = ['http://localhost:8000/api', 'http://localhost:8001/api']
const API_URL = process.env.NEXT_PUBLIC_API_URL
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

const parseCandidateBases = () => {
  const raw = String(process.env.NEXT_PUBLIC_API_CANDIDATES || '').trim()
  if (!raw) return DEFAULT_BASES
  const fromEnv = raw
    .split(',')
    .map((v) => normalizeBase(v))
    .filter(isValidApiBase)
  return fromEnv.length ? fromEnv : DEFAULT_BASES
}

const hasPublicApiUrl = isValidApiBase(API_URL)
const explicitBase = hasPublicApiUrl
  ? normalizeBase(API_URL)
  : normalizeBase(RAILWAY_FALLBACK)

const isLocalHostname = () => {
  if (typeof window === 'undefined') return false
  const host = String(window.location?.hostname || '').toLowerCase()
  return host === 'localhost' || host === '127.0.0.1'
}
  
const candidateBases = parseCandidateBases()
let resolvedBase = explicitBase
let resolveBasePromise = null

const discoverBaseViaServer = async () => {
  if (typeof window === 'undefined') return ''
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), RESOLVE_TIMEOUT_MS)
  try {
    const response = await fetch(RESOLVE_ENDPOINT, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok) return ''
    const body = await response.json().catch(() => null)
    const base = normalizeBase(body?.base)
    return isValidApiBase(base) ? base : ''
  } catch {
    return ''
  } finally {
    clearTimeout(timeoutId)
  }
}

const resolveApiBase = async (force = false) => {
  // Keep deployed behavior intact, but let localhost auto-discover local backend
  // when NEXT_PUBLIC_API_URL is not explicitly configured.
  if (explicitBase && (hasPublicApiUrl || !isLocalHostname())) return explicitBase
  if (typeof window === 'undefined') return candidateBases[0]

  if (!force) {
    if (resolvedBase) return resolvedBase
    if (resolveBasePromise) return resolveBasePromise
  }

  resolveBasePromise = (async () => {
    const discovered = await discoverBaseViaServer()
    if (discovered) {
      resolvedBase = discovered
      return discovered
    }

    resolvedBase = explicitBase || ''
    return resolvedBase
  })().finally(() => {
    resolveBasePromise = null
  })

  return resolveBasePromise
}

const shouldRetryWithNewBase = (err) => {
  const status = err?.response?.status
  return !err?.response || [404, 502, 503, 504].includes(status)
}

const isAuthPath = (url = '') => {
  const normalized = String(url || '')
  return normalized.includes('/auth/login/') || normalized.includes('/auth/token/refresh/')
}

const responseErrorMessage = (err) => {
  const data = err?.response?.data
  if (typeof data === 'string') {
    if (data.trim().startsWith('<')) return err?.response?.status ? `Server error (${err.response.status})` : 'Server error'
    return data
  }
  return data?.detail
    || Object.values(data || {}).flat().join(', ')
    || err.message
    || 'Request failed'
}

export const api = axios.create({
  baseURL: explicitBase || '',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

// Helper functions for token management
export const setTokens = (access, refresh) => {
  if (typeof window !== 'undefined') {
    const authData = {
      state: {
        token: access,
        refreshToken: refresh
      }
    }
    localStorage.setItem('qud-auth', JSON.stringify(authData))
  }
}

export const getTokens = () => {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem('qud-auth')
    if (raw) {
      const { state } = JSON.parse(raw)
      return { access: state?.token, refresh: state?.refreshToken }
    }
  }
  return null
}

export const clearTokens = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('qud-auth')
  }
}

// Attach token
api.interceptors.request.use(async (config) => {
  const base = await resolveApiBase()
  if (!base) {
    throw new Error(
      `Backend API not reachable. Set NEXT_PUBLIC_API_URL (for Vercel/Railway) or run backend on one of: ${candidateBases.join(', ')}`
    )
  }
  config.baseURL = base
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem('qud-auth')
    if (raw) {
      const { state } = JSON.parse(raw)
      if (state?.token) config.headers.Authorization = `Bearer ${state.token}`
    }
  }
  return config
})

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const orig = err.config || {}
    const requestUrl = String(orig?.url || '')

    if (!orig._baseRetry && shouldRetryWithNewBase(err)) {
      orig._baseRetry = true
      const base = await resolveApiBase(true)
      if (base) {
        orig.baseURL = base
        return api(orig)
      }
    }

    if (isAuthPath(requestUrl)) {
      return Promise.reject(new Error(responseErrorMessage(err)))
    }

    if (err.response?.status === 401 && !orig._retry) {
      orig._retry = true
      try {
        const raw = localStorage.getItem('qud-auth')
        if (!raw) throw new Error('no session')
        const { state } = JSON.parse(raw)
        if (!state?.refreshToken || typeof state.refreshToken !== 'string') {
          throw new Error('no refresh token')
        }
        let base = await resolveApiBase()
        if (!base) throw new Error('no api base')
        let refreshResponse
        try {
          refreshResponse = await axios.post(`${base}/auth/token/refresh/`, { refresh: state.refreshToken })
        } catch (refreshErr) {
          if (!shouldRetryWithNewBase(refreshErr)) throw refreshErr
          await resolveApiBase(true)
          base = await resolveApiBase()
          if (!base) throw new Error('no api base')
          refreshResponse = await axios.post(`${base}/auth/token/refresh/`, { refresh: state.refreshToken })
        }
        const parsed = JSON.parse(raw)
        parsed.state.token = refreshResponse.data.access
        if (refreshResponse.data.refresh) parsed.state.refreshToken = refreshResponse.data.refresh
        localStorage.setItem('qud-auth', JSON.stringify(parsed))
        orig.baseURL = base
        orig.headers = orig.headers || {}
        orig.headers.Authorization = `Bearer ${refreshResponse.data.access}`
        return api(orig)
      } catch {
        if (typeof window !== 'undefined') window.location.href = '/auth/login'
        return Promise.reject(new Error('Session expired. Please sign in again.'))
      }
    }
    return Promise.reject(new Error(responseErrorMessage(err)))
  }
)

export const get = (url, params) => api.get(url, { params }).then(r => r.data)
export const post = (url, body) => api.post(url, body).then(r => r.data)
export const put = (url, body) => api.put(url, body).then(r => r.data)
export const patch = (url, body) => api.patch(url, body).then(r => r.data)
export const del = (url) => api.delete(url).then(r => r.data)

export const download = async (url, params, filename) => {
  const res = await api.get(url, { params, responseType: 'blob' })
  const href = URL.createObjectURL(res.data)
  Object.assign(document.createElement('a'), { href, download: filename }).click()
  URL.revokeObjectURL(href)
}
