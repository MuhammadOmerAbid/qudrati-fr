'use client'

import { ArrowLeft, Save } from 'lucide-react'
import { useRouter } from 'next/navigation'
import AccountLayout from '@/presentation/layouts/AccountLayout'

export default function AccountEntryPage({
  title,
  subtitle,
  backHref,
  onSave,
  saveLabel = 'Save',
  saving = false,
  saveDisabled = false,
  hideSave = false,
  children,
  footer,
}) {
  const router = useRouter()

  return (
    <AccountLayout>
      <div style={s.wrapper}>
        <div style={s.pageHeader}>
          <div style={s.headerLeft}>
            <button type="button" style={s.backBtn} onClick={() => router.push(backHref)}>
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 style={s.pageTitle}>{title}</h1>
              <p style={s.pageSubtitle}>{subtitle}</p>
            </div>
          </div>

          {!hideSave ? (
            <button
              type="button"
              style={saving || saveDisabled ? s.saveBtnDisabled : s.saveBtn}
              onClick={onSave}
              disabled={saving || saveDisabled}
            >
              <Save size={15} /> {saving ? 'Saving...' : saveLabel}
            </button>
          ) : null}
        </div>

        <div style={s.card}>
          {children}
        </div>

        {footer ? <div style={s.footer}>{footer}</div> : null}
      </div>
    </AccountLayout>
  )
}

export const accountEntryStyles = {
  fieldWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: 700,
    color: '#607360',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  },
  input: {
    width: '100%',
    border: '1px solid #d4dfd4',
    borderRadius: 12,
    background: '#ffffff',
    color: '#1e2f1f',
    padding: '10px 12px',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  inputError: {
    borderColor: '#fca5a5',
    background: '#fff1f2',
  },
  errorText: {
    fontSize: 12,
    color: '#b91c1c',
  },
  row2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))',
    gap: 12,
  },
  row3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))',
    gap: 12,
  },
  mutedText: {
    margin: 0,
    fontSize: 12,
    color: '#7a8a7a',
  },
}

const s = {
  wrapper: {
    maxWidth: 980,
    margin: '0 auto',
    width: '100%',
  },
  pageHeader: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
    flexWrap: 'wrap',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 999,
    border: '1.5px solid #d4dfd4',
    background: '#ffffff',
    color: '#2d7a33',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },
  pageTitle: {
    margin: '0 0 4px',
    fontSize: 'clamp(20px, 5vw, 30px)',
    fontWeight: 800,
    lineHeight: 1.2,
    letterSpacing: '-0.6px',
    color: '#1a3d1f',
  },
  pageSubtitle: {
    margin: 0,
    fontSize: 13.5,
    color: '#6f836f',
    fontWeight: 500,
  },
  card: {
    background: '#f2f4f2',
    border: '1px solid #e2e8e2',
    borderRadius: 20,
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    padding: 'clamp(14px, 3vw, 24px)',
  },
  footer: {
    marginTop: 14,
  },
  saveBtn: {
    border: 'none',
    borderRadius: 999,
    padding: '11px 22px',
    background: 'linear-gradient(135deg, rgb(26, 61, 31) 0%, rgb(45, 122, 51) 100%)',
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    boxShadow: '0 10px 20px rgba(26,61,31,0.22)',
  },
  saveBtnDisabled: {
    border: 'none',
    borderRadius: 999,
    padding: '11px 22px',
    background: '#9cae9c',
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'not-allowed',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
  },
}

