'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import AccountEntryPage from '@/components/accounts/AccountEntryPage'
import { loadVoucherDetailFromLedger } from '@/application/services/accounts/accountsWorkflow'

const fmt = (amount) => `Rs ${Number(amount || 0).toLocaleString()}`

export default function VoucherPrintPage() {
  const router = useRouter()
  const [voucherId, setVoucherId] = useState('')
  const [voucher, setVoucher] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const id = String(params.get('id') || '').trim()
    setVoucherId(id)
    if (!id) return
    setVoucher(loadVoucherDetailFromLedger(id))
  }, [])

  const content = useMemo(() => {
    if (!voucher) {
      return (
        <div style={s.emptyWrap}>
          <p style={s.emptyTitle}>Voucher not found</p>
          <p style={s.emptySub}>Please open this page from vouchers listing.</p>
          <button type="button" style={s.secondaryBtn} onClick={() => router.push('/accounts/vouchers')}>Back to Vouchers</button>
        </div>
      )
    }

    return (
      <>
        <div style={s.header}>
          <h2 style={s.company}>Qudrati Foods</h2>
          <p style={s.vType}>{voucher.type}</p>
          <p style={s.vNo}>Voucher # {voucher.voucherNo}</p>
        </div>

        <div style={s.metaGrid}>
          <div style={s.metaItem}><span style={s.k}>Date</span><span style={s.v}>{voucher.date || '-'}</span></div>
          <div style={s.metaItem}><span style={s.k}>Party</span><span style={s.v}>{voucher.party || '-'}</span></div>
          <div style={s.metaItem}><span style={s.k}>Account</span><span style={s.v}>{voucher.account || '-'}</span></div>
          <div style={s.metaItem}><span style={s.k}>Reference</span><span style={s.v}>{voucher.reference || '-'}</span></div>
          <div style={s.metaItem}><span style={s.k}>Narration</span><span style={s.v}>{voucher.description || '-'}</span></div>
          <div style={s.metaItem}><span style={s.k}>Amount</span><span style={s.amount}>{fmt(voucher.amount)}</span></div>
        </div>

        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Account</th>
                <th style={{ ...s.th, textAlign: 'right' }}>Debit</th>
                <th style={{ ...s.th, textAlign: 'right' }}>Credit</th>
              </tr>
            </thead>
            <tbody>
              {voucher.lines.map((line) => (
                <tr key={line.id}>
                  <td style={s.td}>{line.accountName}</td>
                  <td style={{ ...s.td, textAlign: 'right' }}>{fmt(line.debit)}</td>
                  <td style={{ ...s.td, textAlign: 'right' }}>{fmt(line.credit)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ ...s.td, fontWeight: 800 }}>Total</td>
                <td style={{ ...s.td, textAlign: 'right', fontWeight: 800 }}>{fmt(voucher.totalDebit)}</td>
                <td style={{ ...s.td, textAlign: 'right', fontWeight: 800 }}>{fmt(voucher.totalCredit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div style={s.signatures}>
          <div style={s.sig}><div style={s.sigLine} /><p style={s.sigText}>Prepared By</p></div>
          <div style={s.sig}><div style={s.sigLine} /><p style={s.sigText}>Approved By</p></div>
          <div style={s.sig}><div style={s.sigLine} /><p style={s.sigText}>Received By</p></div>
        </div>

        <div style={s.actions} className="no-print">
          <button type="button" style={s.secondaryBtn} onClick={() => router.push('/accounts/vouchers')}>Back</button>
          <button type="button" style={s.primaryBtn} onClick={() => window.print()}>Print Voucher</button>
        </div>
      </>
    )
  }, [router, voucher])

  return (
    <AccountEntryPage
      title="Print Voucher"
      subtitle={voucherId ? `Voucher ${voucherId}` : 'Voucher print preview'}
      backHref="/accounts/vouchers"
      hideSave
    >
      {content}
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }

          table {
            width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
          }

          th,
          td {
            overflow-wrap: break-word !important;
            word-break: normal !important;
          }

          @page {
            size: A4 portrait;
            margin: 10mm;
          }
        }
      `}</style>
    </AccountEntryPage>
  )
}

const s = {
  header: {
    textAlign: 'center',
    borderBottom: '2px solid #e2e8e2',
    paddingBottom: 16,
    marginBottom: 14,
  },
  company: { margin: 0, fontSize: 24, fontWeight: 800, color: '#1a3d1f' },
  vType: { margin: '6px 0 0', fontSize: 15, fontWeight: 700, color: '#166534' },
  vNo: { margin: '4px 0 0', fontSize: 12.5, color: '#64748b' },
  metaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 10,
    marginBottom: 12,
  },
  metaItem: {
    border: '1px solid #e2e8e2',
    borderRadius: 10,
    padding: '8px 10px',
    background: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  k: { fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' },
  v: { fontSize: 12.5, color: '#111827', fontWeight: 600 },
  amount: { fontSize: 16, color: '#14532d', fontWeight: 800 },
  tableWrap: { border: '1px solid #e2e8e2', borderRadius: 12, overflow: 'hidden', marginTop: 4 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    padding: '9px 10px',
    background: '#f1f5f9',
    color: '#475569',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    textAlign: 'left',
  },
  td: { padding: '9px 10px', borderTop: '1px solid #e2e8e2', fontSize: 12.5, color: '#111827' },
  signatures: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 16,
    marginTop: 24,
  },
  sig: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 },
  sigLine: { width: '100%', height: 1, background: '#1a3d1f' },
  sigText: { margin: 0, fontSize: 11, color: '#64748b', fontWeight: 600 },
  actions: { marginTop: 18, display: 'flex', justifyContent: 'flex-end', gap: 10 },
  primaryBtn: {
    border: 'none',
    borderRadius: 999,
    padding: '10px 16px',
    background: '#14532d',
    color: '#fff',
    fontSize: 12.5,
    fontWeight: 700,
    cursor: 'pointer',
  },
  secondaryBtn: {
    border: '1px solid #d1d5db',
    borderRadius: 999,
    padding: '10px 16px',
    background: '#ffffff',
    color: '#1f2937',
    fontSize: 12.5,
    fontWeight: 700,
    cursor: 'pointer',
  },
  emptyWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '16px 0',
  },
  emptyTitle: { margin: 0, fontSize: 18, color: '#1a3d1f', fontWeight: 800 },
  emptySub: { margin: 0, fontSize: 12.5, color: '#64748b' },
}

