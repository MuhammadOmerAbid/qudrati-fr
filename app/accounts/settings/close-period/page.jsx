'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/application/state/auth/useAuthStore'
import AccountEntryPage, { accountEntryStyles as es } from '@/components/accounts/AccountEntryPage'
import { closeAccountingPeriod, loadClosedAccountingPeriodsFromStorage } from '@/application/services/accounts/accountsWorkflow'

const CONFIRM_PHRASE = 'CLOSE PERIOD'

function currentPeriodLabel() {
  return new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

function toKey(value) {
  return String(value || '').trim().toLowerCase()
}

export default function ClosePeriodPage() {
  const router = useRouter()
  const { user } = useAuthStore()

  const [confirmText, setConfirmText] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const periodLabel = currentPeriodLabel()

  const alreadyClosed = useMemo(() => (
    loadClosedAccountingPeriodsFromStorage().some((item) => toKey(item.periodLabel) === toKey(periodLabel))
  ), [periodLabel])

  const handleSave = async () => {
    if (confirmText !== CONFIRM_PHRASE || alreadyClosed) return
    setSaving(true)
    setFormError('')
    const actor = user?.name || user?.username || 'system'

    try {
      closeAccountingPeriod({
        periodLabel,
        notes: notes.trim(),
        closedBy: actor,
      })
      router.push('/accounts/settings')
    } catch (error) {
      setFormError(error?.message || 'Unable to close period')
      setSaving(false)
    }
  }

  return (
    <AccountEntryPage
      title="Close Accounting Period"
      subtitle={`Lock postings for ${periodLabel}`}
      backHref="/accounts/settings"
      onSave={handleSave}
      saveLabel="Confirm Close"
      saveDisabled={confirmText !== CONFIRM_PHRASE || alreadyClosed}
      saving={saving}
      footer={formError ? <p style={es.errorText}>{formError}</p> : null}
    >
      <div style={s.warnBox}>
        Closing period will block posting/editing entries in this month. Use only after reconciliation and review.
      </div>

      {alreadyClosed ? (
        <p style={s.closedText}>This period is already closed.</p>
      ) : null}

      <div style={es.fieldWrap}>
        <label style={es.label}>Notes</label>
        <textarea
          style={{ ...es.input, minHeight: 86, resize: 'vertical' }}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Optional closing note"
        />
      </div>

      <div style={es.fieldWrap}>
        <label style={es.label}>Type {CONFIRM_PHRASE} to confirm</label>
        <input
          style={es.input}
          placeholder={CONFIRM_PHRASE}
          value={confirmText}
          onChange={(event) => setConfirmText(event.target.value)}
        />
      </div>
    </AccountEntryPage>
  )
}

const s = {
  warnBox: {
    marginBottom: 10,
    background: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: 12,
    padding: '11px 12px',
    color: '#92400e',
    fontSize: 12.5,
    lineHeight: 1.5,
    fontWeight: 600,
  },
  closedText: {
    margin: '0 0 10px',
    borderRadius: 10,
    padding: '8px 10px',
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#991b1b',
    fontSize: 12.5,
    fontWeight: 700,
  },
}

