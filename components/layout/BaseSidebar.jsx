'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import { useState } from 'react'
import { ChevronRight, ChevronLeft } from 'lucide-react'

const FULL_ACCESS_ROLES = new Set(['superuser', 'admin', 'administrator'])
const hasFullAccessRole = (role) => FULL_ACCESS_ROLES.has(String(role || '').trim().toLowerCase())

export default function BaseSidebar({
  collapsed,
  setCollapsed,
  menuItems,
  generalItems,
  alwaysVisibleMenuIds = [],
  sidebarScroll = 'clipped',
  isMobile = false,
  mobileOpen = false,
  setMobileOpen,
}) {
  const { user, logout } = useAuthStore()
  const router = useRouter()
  const pathname = usePathname()
  const [logoHover, setLogoHover] = useState(false)
  const isCollapsed = isMobile ? false : collapsed

  const visibleMenuItems = menuItems.filter((item) => {
    if (alwaysVisibleMenuIds.includes(item.id)) return true
    if (hasFullAccessRole(user?.role)) return true
    return user?.permissions?.includes(item.id)
  })

  const closeMobileDrawer = () => {
    if (isMobile) setMobileOpen?.(false)
  }

  const handleLogoToggle = () => {
    if (isMobile) {
      closeMobileDrawer()
      return
    }
    setCollapsed(!isCollapsed)
  }

  const handleNavigation = (path) => {
    router.push(path)
    closeMobileDrawer()
  }

  const handleLogout = () => {
    logout()
    closeMobileDrawer()
    router.push('/auth/login')
  }

  const isPathActive = (path) => {
    if (!path) return false
    return pathname === path || pathname.startsWith(`${path}/`)
  }

  return (
    <>
      {isMobile && mobileOpen ? (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setMobileOpen?.(false)}
          style={s.mobileBackdrop}
        />
      ) : null}

      <aside
        className={sidebarScroll === 'thin' ? 'sidebar-scroll-thin' : sidebarScroll === 'invisible' ? 'sidebar-scroll-invisible' : undefined}
        style={{
          ...s.sidebar,
          overflowY: sidebarScroll === 'clipped' ? 'hidden' : 'auto',
          width: isCollapsed ? 70 : 240,
          left: isMobile ? 10 : 20,
          top: isMobile ? 10 : 20,
          bottom: isMobile ? 10 : 20,
          borderRadius: isMobile ? 22 : 28,
          transform: isMobile ? (mobileOpen ? 'translateX(0)' : 'translateX(-120%)') : 'translateX(0)',
          boxShadow: isMobile
            ? '0 18px 36px rgba(0,0,0,0.2), 0 4px 10px rgba(0,0,0,0.08)'
            : '0 20px 40px -12px rgba(0, 0, 0, 0.08), 0 4px 12px -4px rgba(0, 0, 0, 0.02)',
        }}
      >
        <div
          style={{
            ...s.logoRow,
            justifyContent: isCollapsed ? 'center' : 'space-between',
            padding: isCollapsed ? '14px 0 10px' : '14px 14px 10px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              gap: 10,
              minWidth: 0,
              flex: 1,
            }}
          >
            <button
              type="button"
              onClick={handleLogoToggle}
              onMouseEnter={() => !isMobile && setLogoHover(true)}
              onMouseLeave={() => !isMobile && setLogoHover(false)}
              style={s.logoBtn}
              title={isMobile ? 'Close menu' : (isCollapsed ? 'Expand' : 'Collapse')}
            >
              {!isMobile && logoHover ? (
                isCollapsed ? <ChevronRight size={18} color="#2d7a33" /> : <ChevronLeft size={18} color="#2d7a33" />
              ) : (
                <img src="/qudartinew.png" alt="Qudrati Logo" style={s.logoImg} />
              )}
            </button>
            {!isCollapsed && (
              <span style={s.logoName}>
                <span style={{ display: 'block', whiteSpace: 'nowrap' }}>Qudarti Food Processors</span>
                <span style={{ display: 'block' }}>(SMC-PVT)LTD.</span>
              </span>
            )}
          </div>
        </div>

        {!isCollapsed && <p style={s.sectionLabel}>MENU</p>}
        <nav style={{ ...s.nav, alignItems: isCollapsed ? 'center' : 'stretch' }}>
          {visibleMenuItems.map((item) => {
            const active = isPathActive(item.path)
            const Icon = item.icon
            return (
              <div key={item.id} style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: isCollapsed ? 'center' : 'flex-start' }}>
                {active && !isCollapsed && <div style={s.activeMarker} />}

                <button
                  onClick={() => handleNavigation(item.path)}
                  title={isCollapsed ? item.label : undefined}
                  style={{
                    ...s.navItem,
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    padding: isCollapsed ? '8px 10px' : '10px 16px',
                    width: isCollapsed ? 48 : '100%',
                    borderRadius: '999px',
                  }}
                  className="nav-item-button"
                  onMouseEnter={(event) => {
                    if (!active && !isCollapsed) {
                      event.currentTarget.style.backgroundColor = '#e8eee8'
                      event.currentTarget.style.transform = 'scale(1.02)'
                    }
                  }}
                  onMouseLeave={(event) => {
                    if (!active && !isCollapsed) {
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

                  {!isCollapsed && (
                    <span style={{ ...s.navLabel, color: active ? '#2d7a33' : '#5a6a5a', fontWeight: active ? 600 : 500 }}>
                      {item.label}
                    </span>
                  )}
                </button>
              </div>
            )
          })}
        </nav>

        {!isCollapsed && <p style={s.sectionLabel}>GENERAL</p>}
        {isCollapsed && <div style={{ height: 12 }} />}
        <nav style={{ ...s.nav, alignItems: isCollapsed ? 'center' : 'stretch' }}>
          {generalItems.map((item) => {
            const active = isPathActive(item.path)
            const Icon = item.icon
            const isLogout = item.isLogout
            return (
              <div key={item.id} style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: isCollapsed ? 'center' : 'flex-start' }}>
                {active && !isCollapsed && <div style={s.activeMarker} />}

                <button
                  onClick={() => (isLogout ? handleLogout() : handleNavigation(item.path))}
                  title={isCollapsed ? item.label : undefined}
                  style={{
                    ...s.navItem,
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    padding: isCollapsed ? '8px 10px' : '10px 16px',
                    width: isCollapsed ? 48 : '100%',
                    borderRadius: '999px',
                  }}
                  className="nav-item-button"
                  onMouseEnter={(event) => {
                    if (!isLogout && !isCollapsed) {
                      event.currentTarget.style.backgroundColor = '#e8eee8'
                      event.currentTarget.style.transform = 'scale(1.02)'
                    }
                  }}
                  onMouseLeave={(event) => {
                    if (!isLogout && !isCollapsed) {
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
                  {!isCollapsed && (
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
    </>
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
    zIndex: 60,
    overflowY: 'hidden',
    overflowX: 'hidden',
    transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.28s ease',
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
  mobileCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    border: '1px solid #d4dfd4',
    background: '#ffffff',
    color: '#2d7a33',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    cursor: 'pointer',
    flexShrink: 0,
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
  mobileBackdrop: {
    position: 'fixed',
    inset: 0,
    border: 'none',
    background: 'rgba(10, 16, 10, 0.34)',
    zIndex: 55,
    padding: 0,
    cursor: 'pointer',
  },
}
