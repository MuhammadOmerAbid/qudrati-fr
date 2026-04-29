'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import { useState } from 'react'
import { ChevronRight, ChevronLeft } from 'lucide-react'

export default function BaseSidebar({
  collapsed,
  setCollapsed,
  menuItems,
  generalItems,
  alwaysVisibleMenuIds = [],
  sidebarScroll = 'clipped',
}) {
  const { user, logout } = useAuthStore()
  const router = useRouter()
  const pathname = usePathname()
  const [logoHover, setLogoHover] = useState(false)

  const visibleMenuItems = menuItems.filter((item) => {
    if (alwaysVisibleMenuIds.includes(item.id)) return true
    if (user?.role === 'superuser') return true
    return user?.permissions?.includes(item.id)
  })

  const handleNavigation = (path) => router.push(path)
  const handleLogout = () => {
    logout()
    router.push('/auth/login')
  }

  const isPathActive = (path) => {
    if (!path) return false
    return pathname === path || pathname.startsWith(`${path}/`)
  }

  return (
    <aside
      className={sidebarScroll === 'thin' ? 'sidebar-scroll-thin' : sidebarScroll === 'invisible' ? 'sidebar-scroll-invisible' : undefined}
      style={{
        ...s.sidebar,
        overflowY: sidebarScroll === 'clipped' ? 'hidden' : 'auto',
        width: collapsed ? 70 : 240,
      }}
    >
      <div
        style={{
          ...s.logoRow,
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? '14px 0 10px' : '14px 14px 10px',
        }}
      >
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          onMouseEnter={() => setLogoHover(true)}
          onMouseLeave={() => setLogoHover(false)}
          style={s.logoBtn}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {logoHover ? (
            collapsed ? <ChevronRight size={18} color="#2d7a33" /> : <ChevronLeft size={18} color="#2d7a33" />
          ) : (
            <img src="/qudartinew.png" alt="Qudrati Logo" style={s.logoImg} />
          )}
        </button>
        {!collapsed && (
          <span style={s.logoName}>
            <span style={{ display: 'block', whiteSpace: 'nowrap' }}>Qudarti Food Processors</span>
            <span style={{ display: 'block' }}>(SMC-PVT)LTD.</span>
          </span>
        )}
      </div>

      {!collapsed && <p style={s.sectionLabel}>MENU</p>}
      <nav style={{ ...s.nav, alignItems: collapsed ? 'center' : 'stretch' }}>
        {visibleMenuItems.map((item) => {
          const active = isPathActive(item.path)
          const Icon = item.icon
          return (
            <div key={item.id} style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: collapsed ? 'center' : 'flex-start' }}>
              {active && !collapsed && <div style={s.activeMarker} />}

              <button
                onClick={() => handleNavigation(item.path)}
                title={collapsed ? item.label : undefined}
                style={{
                  ...s.navItem,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  padding: collapsed ? '8px 10px' : '10px 16px',
                  width: collapsed ? 48 : '100%',
                  borderRadius: '999px',
                }}
                className="nav-item-button"
                onMouseEnter={(event) => {
                  if (!active && !collapsed) {
                    event.currentTarget.style.backgroundColor = '#e8eee8'
                    event.currentTarget.style.transform = 'scale(1.02)'
                  }
                }}
                onMouseLeave={(event) => {
                  if (!active && !collapsed) {
                    event.currentTarget.style.backgroundColor = 'transparent'
                    event.currentTarget.style.transform = 'scale(1)'
                  }
                }}
              >
                <div style={s.iconWrapper}>
                  <Icon
                    size={20}
                    strokeWidth={active ? 2.2 : 1.7}
                    color={active ? '#2d7a33' : '#7a8a7a'}
                  />
                </div>

                {!collapsed && (
                  <span style={{ ...s.navLabel, color: active ? '#2d7a33' : '#5a6a5a', fontWeight: active ? 600 : 500 }}>
                    {item.label}
                  </span>
                )}
              </button>
            </div>
          )
        })}
      </nav>

      {!collapsed && <p style={s.sectionLabel}>GENERAL</p>}
      {collapsed && <div style={{ height: 12 }} />}
      <nav style={{ ...s.nav, alignItems: collapsed ? 'center' : 'stretch' }}>
        {generalItems.map((item) => {
          const active = isPathActive(item.path)
          const Icon = item.icon
          const isLogout = item.isLogout
          return (
            <div key={item.id} style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: collapsed ? 'center' : 'flex-start' }}>
              {active && !collapsed && <div style={s.activeMarker} />}

              <button
                onClick={() => (isLogout ? handleLogout() : handleNavigation(item.path))}
                title={collapsed ? item.label : undefined}
                style={{
                  ...s.navItem,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  padding: collapsed ? '8px 10px' : '10px 16px',
                  width: collapsed ? 48 : '100%',
                  borderRadius: '999px',
                }}
                className="nav-item-button"
                onMouseEnter={(event) => {
                  if (!isLogout && !collapsed) {
                    event.currentTarget.style.backgroundColor = '#e8eee8'
                    event.currentTarget.style.transform = 'scale(1.02)'
                  }
                }}
                onMouseLeave={(event) => {
                  if (!isLogout && !collapsed) {
                    event.currentTarget.style.backgroundColor = 'transparent'
                    event.currentTarget.style.transform = 'scale(1)'
                  }
                }}
              >
                <div style={s.iconWrapper}>
                  <Icon
                    size={20}
                    strokeWidth={1.7}
                    color={isLogout ? '#ef4444' : (active ? '#2d7a33' : '#7a8a7a')}
                  />
                </div>
                {!collapsed && (
                  <span style={{ ...s.navLabel, color: isLogout ? '#ef4444' : (active ? '#2d7a33' : '#5a6a5a') }}>
                    {item.label}
                  </span>
                )}
              </button>
            </div>
          )
        })}
      </nav>
    </aside>
  )
}

const s = {
  sidebar: {
    position: 'fixed',
    left: '20px',
    top: '20px',
    bottom: '20px',
    backgroundColor: '#f2f4f2',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 50,
    overflowY: 'hidden',
    overflowX: 'hidden',
    transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    borderRadius: '28px',
    boxShadow: '0 20px 40px -12px rgba(0, 0, 0, 0.08), 0 4px 12px -4px rgba(0, 0, 0, 0.02)',
    border: '1px solid #e2e8e2',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '14px 14px 10px',
    position: 'relative',
  },
  logoBtn: {
    width: 46,
    height: 46,
    border: 'none',
    borderRadius: '999px',
    backgroundColor: '#e8eee8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    padding: 0,
    transition: 'all 0.2s',
  },
  logoImg: {
    width: 31,
    height: 31,
    objectFit: 'contain',
  },
  logoName: {
    fontSize: 12.5,
    fontWeight: 700,
    color: '#1a3d1f',
    lineHeight: 1.28,
    letterSpacing: '0',
    whiteSpace: 'normal',
    wordBreak: 'break-word',
    flex: 1,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '1.5px',
    color: '#9aaa9a',
    padding: '8px 20px 4px',
    margin: 0,
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '4px 12px',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 14,
    fontWeight: 500,
    border: 'none',
    cursor: 'pointer',
    background: 'transparent',
    color: '#5a6a5a',
    whiteSpace: 'nowrap',
    textAlign: 'left',
    position: 'relative',
    minHeight: 44,
    transition: 'all 0.25s cubic-bezier(0.2, 0.9, 0.4, 1.1)',
  },
  iconWrapper: {
    width: 28,
    height: 28,
    borderRadius: '999px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  navLabel: {
    flex: 1,
    fontSize: 14,
  },
  activeMarker: {
    position: 'absolute',
    left: -12,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 4,
    height: 28,
    backgroundColor: '#2d7a33',
    borderRadius: '0 4px 4px 0',
    boxShadow: '0 2px 4px rgba(45, 122, 51, 0.15)',
  },
}

