'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import s from './LoginPage.module.css'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import { authApi } from '@/infrastructure/api/endpoints'

// ─── Global brand config ────
const BRAND = {
  logoSrc: '/qudartinew.png',  // Updated logo filename
}

export default function LoginPage() {
  const router = useRouter()
  const { setAuth, user, token, panel, hasHydrated } = useAuthStore()

  const [form, setForm] = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [remember, setRemember] = useState(false)
  const [focused, setFocused] = useState('')
  const [mounted, setMounted] = useState(false)

  const usernameRef = useRef(null)
  const passwordRef = useRef(null)

  useEffect(() => {
    const h = document.documentElement
    const b = document.body

    const prevHtml = {
      margin: h.style.margin,
      padding: h.style.padding,
      height: h.style.height,
      overflow: h.style.overflow,
    }
    const prevBody = {
      margin: b.style.margin,
      padding: b.style.padding,
      height: b.style.height,
      overflow: b.style.overflow,
    }

    h.style.margin = '0'
    h.style.padding = '0'
    h.style.height = '100%'
    h.style.overflow = 'hidden'

    b.style.margin = '0'
    b.style.padding = '0'
    b.style.height = '100%'
    b.style.overflow = 'hidden'

    setMounted(true)
    requestAnimationFrame(() => usernameRef.current?.focus())

    return () => {
      h.style.margin = prevHtml.margin
      h.style.padding = prevHtml.padding
      h.style.height = prevHtml.height
      h.style.overflow = prevHtml.overflow

      b.style.margin = prevBody.margin
      b.style.padding = prevBody.padding
      b.style.height = prevBody.height
      b.style.overflow = prevBody.overflow
    }
  }, [])

  useEffect(() => {
    if (!hasHydrated) return
    if (user && token) {
      router.replace(panel ? (panel === 'account' ? '/accounts/accounts-dashboard' : '/dashboard') : '/panel-selection')
    }
  }, [hasHydrated, user, token, panel, router])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.username.trim()) {
      setError('Username is required'); usernameRef.current?.focus(); return
    }
    if (!form.password.trim()) {
      setError('Password is required'); passwordRef.current?.focus(); return
    }
    setLoading(true); setError('')
    try {
      const data = await authApi.login(form.username, form.password)
      if (!data?.access || !data?.refresh || !data?.user) {
        throw new Error('Invalid login response')
      }
      setAuth(data.user, data.access, data.refresh)
      router.push('/panel-selection')
    } catch (err) {
      setError(err.message || 'Invalid username or password')
    } finally {
      setLoading(false)
    }
  }

  const onUsernameKey = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); passwordRef.current?.focus() }
  }

  return (
    <div className={s.root}>
      {/* Background Image - PNG file with blur */}
      <Image
        src="/background.png"
        alt="Background"
        fill
        className={s.bgImage}
        priority
        quality={100}
      />
      
      {/* Dark overlay for better text readability */}
      <div className={s.overlay} />
      
      {/* Ambient orbs for premium effect */}
      <div className={`${s.orb} ${s.o1}`} />
      <div className={`${s.orb} ${s.o2}`} />
      <div className={`${s.orb} ${s.o3}`} />
      <div className={s.grain} />

      <div className={`${s.wrap} ${mounted ? s.wrapIn : ''}`}>
        <div className={s.glassCard}>
          {/* Logo - Larger size with new logo */}
          <div className={s.logoSection}>
            <Image
              src={BRAND.logoSrc}
              alt="Logo"
              width={140}
              height={140}
              className={s.logoImg}
              priority
            />
          </div>

          <form onSubmit={handleSubmit} className={s.form} noValidate>
            {/* Username */}
            <div className={`${s.field} ${focused === 'u' ? s.fieldFoc : ''}`}>
              <label htmlFor="username" className={s.label}>Username</label>
              <div className={s.shell}>
                <span className={s.icon}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </span>
                <input
                  ref={usernameRef}
                  id="username"
                  type="text"
                  className={s.input}
                  placeholder="Enter your username"
                  value={form.username}
                  onChange={e => { setForm(f => ({ ...f, username: e.target.value })); setError('') }}
                  onFocus={() => setFocused('u')}
                  onBlur={() => setFocused('')}
                  onKeyDown={onUsernameKey}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password */}
            <div className={`${s.field} ${focused === 'p' ? s.fieldFoc : ''}`}>
              <label htmlFor="password" className={s.label}>Password</label>
              <div className={s.shell}>
                <span className={s.icon}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>
                <input
                  ref={passwordRef}
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  className={s.input}
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setError('') }}
                  onFocus={() => setFocused('p')}
                  onBlur={() => setFocused('')}
                  disabled={loading}
                />
                <button
                  type="button"
                  className={s.eye}
                  onClick={() => setShowPw(!showPw)}
                  aria-label="Toggle password visibility"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {showPw ? (
                      <>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </>
                    ) : (
                      <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </div>

            <div className={s.metaRow}>
              <div
                className={s.remLabel}
                onClick={() => setRemember(v => !v)}
              >
                <div className={`${s.chk} ${remember ? s.chkOn : ''}`} />
                <span>Remember me</span>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className={s.errInside}>
                {error}
              </div>
            )}

            <button type="submit" className={s.btn} disabled={loading}>
              {loading ? 'Loading...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

