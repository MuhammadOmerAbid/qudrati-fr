'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import { Menu, Search, X } from 'lucide-react'

export default function PanelLayout({
  children,
  panelName,
  wrongPanelRedirect,
  SidebarComponent,
  panelZoom = 1,
}) {
  const { user, token, panel, hasHydrated } = useAuthStore()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isCompactViewport, setIsCompactViewport] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [globalQuery, setGlobalQuery] = useState('')
  const searchInputRef = useRef(null)

  useEffect(() => {
    if (!hasHydrated) return
    if (!user || !token) router.replace('/auth/login')
    else if (!panel) router.replace('/panel-selection')
    else if (panel !== panelName) router.replace(wrongPanelRedirect)
  }, [hasHydrated, user, token, panel, panelName, wrongPanelRedirect, router])

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--sidebar-w', collapsed ? '72px' : '240px')
      return () => document.documentElement.style.removeProperty('--sidebar-w')
    }
  }, [collapsed])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const compactQuery = window.matchMedia('(max-width: 1024px)')
    const mobileQuery = window.matchMedia('(max-width: 900px)')

    const apply = () => {
      const compact = compactQuery.matches
      const mobile = mobileQuery.matches
      setIsCompactViewport(compact)
      setCollapsed(mobile ? false : compact)
      setIsMobile(mobile)
      if (!mobile) setMobileSidebarOpen(false)
    }

    apply()
    compactQuery.addEventListener('change', apply)
    mobileQuery.addEventListener('change', apply)

    return () => {
      compactQuery.removeEventListener('change', apply)
      mobileQuery.removeEventListener('change', apply)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onKeydown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      }

      if (event.key === 'Escape' && mobileSidebarOpen) {
        setMobileSidebarOpen(false)
      }
    }
    window.addEventListener('keydown', onKeydown)
    return () => window.removeEventListener('keydown', onKeydown)
  }, [mobileSidebarOpen])

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.body.style.overflow = isMobile && mobileSidebarOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobile, mobileSidebarOpen])

  const setNativeInputValue = (inputEl, value) => {
    const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
    if (descriptor?.set) descriptor.set.call(inputEl, value)
    else inputEl.value = value
  }

  const syncSearchToPage = (query) => {
    if (typeof window === 'undefined') return 0

    const pageRoot = document.querySelector(`[data-panel-content="${panelName}"]`)
    if (!pageRoot) return 0

    const pageSearchInputs = Array.from(
      pageRoot.querySelectorAll('input[placeholder*="search" i], input[type="search"]'),
    ).filter((inputEl) => inputEl !== searchInputRef.current)

    pageSearchInputs.forEach((inputEl) => {
      setNativeInputValue(inputEl, query)
      inputEl.dispatchEvent(new Event('input', { bubbles: true }))
      inputEl.dispatchEvent(new Event('change', { bubbles: true }))
    })

    window.dispatchEvent(new CustomEvent('panel-global-search', { detail: { panel: panelName, query } }))
    return pageSearchInputs.length
  }

  const runGlobalSearch = (query) => {
    const trimmed = query.trim()
    const syncedCount = syncSearchToPage(trimmed)

    if (!trimmed || syncedCount > 0) return
    if (typeof window !== 'undefined' && typeof window.find === 'function') {
      window.find(trimmed, false, false, true, false, false, false)
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => runGlobalSearch(globalQuery), 120)
    return () => clearTimeout(timeout)
  }, [globalQuery])

  const initial = (user?.username?.[0] || 'U').toUpperCase()
  const accountType = user?.role === 'superuser' ? 'Super User' : 'User'
  const effectiveZoom = isCompactViewport ? 1 : panelZoom

  if (!hasHydrated || !user || !token || !panel) return null

  return (
    <div style={{ ...s.layout, zoom: effectiveZoom }}>
      <SidebarComponent
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        isMobile={isMobile}
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
      />

      <main
        style={{
          ...s.main,
          paddingLeft: isMobile ? 0 : (collapsed ? 88 : 256),
        }}
      >
        <header
          style={{
            ...s.header,
            height: isMobile ? 56 : 64,
            borderRadius: isMobile ? 16 : 40,
            padding: isMobile ? '0 10px' : '0 20px',
            margin: isMobile ? '8px 8px 0 8px' : '14px 20px 0 20px',
            top: isMobile ? 8 : 14,
            gap: isMobile ? 8 : 12,
          }}
        >
          {isMobile ? (
            <button
              type="button"
              style={s.mobileMenuBtn}
              title="Open menu"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <Menu size={16} />
            </button>
          ) : null}

          <form
            style={{
              ...s.searchWrap,
              flex: isMobile ? '1 1 auto' : '0 1 300px',
              minWidth: isMobile ? 120 : 0,
              padding: isMobile ? '5px 12px' : '6px 16px',
            }}
            onSubmit={(event) => {
              event.preventDefault()
              runGlobalSearch(globalQuery)
            }}
          >
            <Search size={14} color="#6c8d6c" style={{ flexShrink: 0 }} />
            <input
              ref={searchInputRef}
              style={s.searchInput}
              placeholder="Search panel data"
              type="text"
              value={globalQuery}
              onChange={(event) => setGlobalQuery(event.target.value)}
            />
            {globalQuery ? (
              <button
                type="button"
                style={s.clearBtn}
                title="Clear search"
                onClick={() => setGlobalQuery('')}
              >
                <X size={12} />
              </button>
            ) : null}
            {!isMobile ? <kbd style={s.searchKbd}>Ctrl F</kbd> : null}
          </form>

          {!isMobile ? <div style={{ flex: 1 }} /> : null}

          <div
            style={{
              ...s.headerRight,
              marginLeft: isMobile ? 0 : 0,
              width: isMobile ? 'auto' : undefined,
            }}
          >
            {!isMobile ? <div style={s.divider} /> : null}

            <div style={s.userPill}>
              <div style={s.avatar}>{initial}</div>
              {!isMobile ? (
                <div style={s.userMeta}>
                  <span style={s.userName}>{user?.username || 'User'}</span>
                  <span style={s.userEmail}>{accountType}</span>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div
          style={{
            ...s.content,
            padding: isMobile ? '14px 10px 20px' : '20px 20px 28px',
          }}
          data-panel-content={panelName}
        >
          {children}
        </div>
      </main>
    </div>
  )
}

const s = {
  layout: {
    minHeight: '100vh',
    width: '100%',
    background: '#ffffff',
    fontFamily: "'Plus Jakarta Sans', 'Segoe UI', sans-serif",
  },
  main: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    transition: 'padding-left 0.25s cubic-bezier(.4,0,.2,1)',
    background: '#ffffff',
  },
  header: {
    margin: '14px 20px 0 20px',
    height: 64,
    backgroundColor: '#e8ece8',
    border: '1px solid #d4dcd4',
    borderRadius: '40px',
    display: 'flex',
    alignItems: 'center',
    padding: '0 20px',
    gap: 12,
    position: 'sticky',
    top: 14,
    zIndex: 30,
    boxShadow: '0 4px 12px rgba(0,0,0,0.02), 0 1px 2px rgba(0,0,0,0.03)',
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    border: '1px solid #dde4dd',
    borderRadius: '40px',
    padding: '6px 16px',
    flex: '0 1 300px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
  },
  searchInput: {
    border: 'none',
    background: 'transparent',
    outline: 'none',
    fontSize: 13,
    color: '#2c3e2c',
    flex: 1,
    minWidth: 0,
    fontFamily: 'inherit',
  },
  clearBtn: {
    width: 22,
    height: 22,
    borderRadius: 22,
    border: 'none',
    background: '#f3f7f3',
    color: '#7a8a7a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
  },
  searchKbd: {
    fontSize: 10,
    color: '#8aa88a',
    backgroundColor: '#f3f7f3',
    padding: '2px 8px',
    borderRadius: '30px',
    fontWeight: 600,
    fontFamily: 'inherit',
    border: 'none',
  },
  mobileMenuBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    border: '1px solid #cde0cd',
    background: '#ffffff',
    color: '#2d7a33',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    cursor: 'pointer',
    flexShrink: 0,
  },
  headerRight: { display: 'flex', alignItems: 'center', gap: 10 },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: '#c8d4c8',
    margin: '0 6px',
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: '30px',
    border: '1px solid #cde0cd',
    backgroundColor: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'all 0.15s ease',
  },
  userPill: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '4px 16px 4px 4px',
    borderRadius: '40px',
    border: '1px solid #cde0cd',
    backgroundColor: '#ffffff',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #1a5c22, #2d9e3a)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 700,
    color: '#fff',
    flexShrink: 0,
    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
  },
  userMeta: { display: 'flex', flexDirection: 'column' },
  userName: { fontSize: 12.5, fontWeight: 700, color: '#1e2a1e', lineHeight: 1.3 },
  userEmail: { fontSize: 10.5, color: '#7a9a7a', lineHeight: 1.3 },
  content: {
    flex: 1,
    padding: '20px 20px 28px',
    backgroundColor: '#ffffff',
  },
}
