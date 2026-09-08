'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import { panelPasswordApi } from '@/infrastructure/api/endpoints'

// Icons as simple SVG components
const MonitorIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
    <line x1="8" y1="21" x2="16" y2="21"></line>
    <line x1="12" y1="17" x2="12" y2="21"></line>
  </svg>
)

const WarehouseIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 8.5V18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.5"></path>
    <path d="M2 8.5L12 3l10 5.5"></path>
    <path d="M8 13h8"></path>
    <path d="M12 13v7"></path>
  </svg>
)

const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
)

const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
)

export default function PanelSelectPage() {
  const router = useRouter()
  const { user, token, panel, setPanel, hasHydrated } = useAuthStore()
  const [selected, setSelected] = useState('store')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const passwordRef = useRef(null)

  useEffect(() => {
    if (!hasHydrated) return

    if (!user || !token) {
      router.replace('/auth/login')
    } else if (panel) {
      router.replace(panel === 'account' ? '/accounts/accounts-dashboard' : '/dashboard')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHydrated, user, token, panel])

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowLeft') setSelected('account')
      if (e.key === 'ArrowRight') setSelected('store')
      if (e.key === 'Enter' && document.activeElement?.tagName !== 'INPUT') {
        passwordRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleSubmit = async () => {
    if (!password.trim()) {
      setError('Password is required')
      return
    }
    setVerifying(true)
    setError('')
    try {
      await panelPasswordApi.verify(password)
      setPanel(selected)
      router.push(selected === 'account' ? '/accounts/accounts-dashboard' : '/dashboard')
    } catch {
      setError('Wrong panel password. Please try again.')
    } finally {
      setVerifying(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  if (!hasHydrated || !user || !token) return null

  const panels = [
    { id: 'account', label: 'Account Panel', icon: MonitorIcon },
    { id: 'store', label: 'Store Panel', icon: WarehouseIcon },
  ]

  return (
    <div style={styles.root}>
      <style>{`
        @keyframes subtleFloat {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.4; }
          50% { transform: translate(20px, -15px) scale(1.05); opacity: 0.6; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-2px); }
          80% { transform: translateX(2px); }
        }
        input:focus {
          border-color: #22c55e !important;
          box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1) !important;
        }
      `}</style>
      {/* Background Image with Blur */}
      <Image
        src="/background.png"
        alt="Background"
        fill
        className="bgImage"
        priority
        quality={100}
        style={styles.bgImage}
      />
      
      {/* Dark overlay for better text readability */}
      <div style={styles.overlay} />
      
      {/* Ambient orbs for premium effect */}
      <div style={{ ...styles.orb, ...styles.o1 }} />
      <div style={{ ...styles.orb, ...styles.o2 }} />
      <div style={{ ...styles.orb, ...styles.o3 }} />
      <div style={styles.grain} />

      {/* Content */}
      <div style={styles.contentWrapper}>
        {/* Logo Section */}
        <div style={styles.logoSection}>
          <Image
            src="/qudartinew.png"
            alt="Logo"
            width={130}
            height={130}
            style={styles.logoImg}
            priority
          />
        </div>

        {/* Panel Selection Cards */}
        <div style={styles.panelContainer}>
          <div style={styles.cardsGrid}>
            {panels.map((p) => {
              const active = selected === p.id
              const IconComponent = p.icon
              return (
                <button
                  key={p.id}
                  onClick={() => setSelected(p.id)}
                  style={{
                    ...styles.panelCard,
                    ...(active ? styles.panelCardActive : styles.panelCardInactive)
                  }}
                >
                  {/* Radio dot */}
                  <span
                    style={{
                      ...styles.radioDot,
                      ...(active ? styles.radioDotActive : styles.radioDotInactive)
                    }}
                  />
                  <div style={{ ...styles.iconWrapper, ...(active && styles.iconWrapperActive) }}>
                    <IconComponent />
                  </div>
                  <span style={{ ...styles.panelLabel, ...(active && styles.panelLabelActive) }}>
                    {p.label}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Password Field - Properly aligned */}
          <div style={styles.passwordCard}>
            <label style={styles.label}>Password</label>
            <div style={styles.inputContainer}>
              <input
                ref={passwordRef}
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError('')
                }}
                onKeyDown={handleKey}
                placeholder="Enter your password"
                style={styles.passwordInput}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                style={styles.eyeButton}
              >
                {showPw ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div style={styles.errorMessage}>
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              style={password.trim() && !verifying ? styles.button : styles.buttonDisabled}
              disabled={!password.trim() || verifying}
            >
              {verifying ? 'Verifying...' : 'Next'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
        </div>
      </div>
    </div>
  )
}

const styles = {
  root: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  bgImage: {
    position: 'absolute',
    inset: 0,
    zIndex: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    pointerEvents: 'none',
    filter: 'blur(4px)',
    transform: 'scale(1.02)',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    zIndex: 0,
    background: 'rgba(0, 0, 0, 0.55)',
    pointerEvents: 'none',
  },
  orb: {
    position: 'absolute',
    borderRadius: '50%',
    filter: 'blur(120px)',
    pointerEvents: 'none',
    zIndex: 0,
    animation: 'subtleFloat 20s ease-in-out infinite',
  },
  o1: {
    width: '500px',
    height: '500px',
    top: '-200px',
    left: '-150px',
    background: 'radial-gradient(circle, rgba(59, 130, 246, 0.12), transparent 70%)',
  },
  o2: {
    width: '450px',
    height: '450px',
    bottom: '-150px',
    right: '-120px',
    background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08), transparent 70%)',
    animationDelay: '8s',
  },
  o3: {
    width: '300px',
    height: '300px',
    top: '50%',
    left: '50%',
    background: 'radial-gradient(circle, rgba(99, 102, 241, 0.06), transparent 70%)',
    animationDelay: '14s',
    transform: 'translate(-50%, -50%)',
  },
  grain: {
    position: 'absolute',
    inset: 0,
    zIndex: 0,
    opacity: 0.02,
    pointerEvents: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")`,
    backgroundSize: '256px 256px',
  },
  contentWrapper: {
    position: 'relative',
    zIndex: 10,
    width: '100%',
    maxWidth: '480px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: '100vh',
    padding: '40px 24px',
  },
  logoSection: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    marginBottom: '60px',
    marginTop: '20px',
  },
  logoImg: {
    width: '130px',
    height: '130px',
    objectFit: 'contain',
    filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.3))',
  },
  panelContainer: {
    width: '100%',
    maxWidth: '420px',
    margin: '0 auto',
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
    marginBottom: '24px',
  },
  panelCard: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    padding: '32px 20px',
    borderRadius: '20px',
    border: '2px solid',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    background: '#ffffff',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
  },
  panelCardActive: {
    borderColor: '#22c55e',
    background: '#ffffff',
    boxShadow: '0 10px 30px rgba(34, 197, 94, 0.15)',
  },
  panelCardInactive: {
    borderColor: '#e5e7eb',
    background: '#ffffff',
  },
  radioDot: {
    position: 'absolute',
    top: '12px',
    left: '12px',
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    border: '2px solid',
    transition: 'all 0.2s ease',
  },
  radioDotActive: {
    borderColor: '#22c55e',
    background: '#22c55e',
    boxShadow: '0 0 8px rgba(34, 197, 94, 0.3)',
  },
  radioDotInactive: {
    borderColor: '#d1d5db',
    background: '#ffffff',
  },
  iconWrapper: {
    color: '#6b7280',
    transition: 'all 0.2s ease',
  },
  iconWrapperActive: {
    color: '#22c55e',
  },
  panelLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
    transition: 'all 0.2s ease',
  },
  panelLabelActive: {
    color: '#22c55e',
  },
  passwordCard: {
    background: '#ffffff',
    borderRadius: '20px',
    padding: '24px',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e5e7eb',
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '12px',
    fontWeight: '600',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#6b7280',
  },
  inputContainer: {
    position: 'relative',
    width: '100%',
    marginBottom: '20px',
  },
  passwordInput: {
    width: '100%',
    padding: '12px 40px 12px 16px',
    fontSize: '14px',
    fontFamily: 'inherit',
    background: '#f9fafb',
    border: '1.5px solid #e5e7eb',
    borderRadius: '12px',
    color: '#1f2937',
    outline: 'none',
    transition: 'all 0.25s ease',
    textAlign: 'left',
    boxSizing: 'border-box',
  },
  eyeButton: {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#9ca3af',
    display: 'flex',
    alignItems: 'center',
    padding: 0,
    transition: 'color 0.2s ease',
  },
  errorMessage: {
    padding: '8px 0',
    marginBottom: '20px',
    fontSize: '12px',
    fontWeight: '500',
    color: '#ef4444',
    textAlign: 'center',
    animation: 'shake 0.35s ease',
  },
  button: {
    width: '100%',
    padding: '12px 18px',
    fontSize: '14px',
    fontWeight: '600',
    fontFamily: 'inherit',
    letterSpacing: '0.03em',
    background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.25s ease',
    boxShadow: '0 2px 8px rgba(34, 197, 94, 0.3)',
  },
  buttonDisabled: {
    width: '100%',
    padding: '12px 18px',
    fontSize: '14px',
    fontWeight: '600',
    fontFamily: 'inherit',
    letterSpacing: '0.03em',
    background: '#e5e7eb',
    color: '#9ca3af',
    border: 'none',
    borderRadius: '12px',
    cursor: 'not-allowed',
  },
  footer: {
    width: '100%',
    maxWidth: '420px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: '60px',
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.6)',
  },
}

