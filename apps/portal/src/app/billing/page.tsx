'use client';

import { useEffect, useState } from 'react';

import { getRoleCapabilities, readSessionUser, type DemoUser } from '../lib/demo-users';

const INVOICES = [
  { period: 'Apr 2026', total: '$18,420', status: 'Open', due: '2026-04-28' },
  { period: 'Mar 2026', total: '$17,190', status: 'Paid', due: '2026-03-28' },
  { period: 'Feb 2026', total: '$16,880', status: 'Paid', due: '2026-02-28' },
] as const;

const CHARGES = [
  { name: 'Platform subscription', amount: '$9,500' },
  { name: 'Telemetry overage', amount: '$2,120' },
  { name: 'LLM usage', amount: '$4,880' },
  { name: 'Premium support', amount: '$1,920' },
] as const;

export default function BillingPage() {
  const [sessionUser, setSessionUser] = useState<DemoUser | null>(null);

  useEffect(() => {
    setSessionUser(readSessionUser());
  }, []);

  const capabilities = getRoleCapabilities(sessionUser);

  if (!capabilities.canViewBilling) {
    return (
      <div>
        <div className="page-header">
          <div>
            <div className="page-title">Billing</div>
            <div className="page-subtitle">Billing views are reserved for customer and platform administration.</div>
          </div>
        </div>
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>Access restricted</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            Sign in as Customer Admin or Platform Admin to review invoices, charges, and usage costs.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Billing</div>
          <div className="page-subtitle">Invoice history, charge composition, and spend tracking</div>
        </div>
        <button className="btn-primary">Download Invoice Pack</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '1.5rem' }}>
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Invoices</div>
          {INVOICES.map((invoice) => (
            <div key={invoice.period} style={{ display: 'grid', gridTemplateColumns: '1fr 0.8fr 0.7fr 0.8fr', gap: '1rem', padding: '0.8rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontWeight: 600 }}>{invoice.period}</div>
              <div style={{ color: 'var(--color-green)' }}>{invoice.total}</div>
              <div>
                <span className={invoice.status === 'Paid' ? 'pill pill-green' : 'pill pill-cyan'}>{invoice.status}</span>
              </div>
              <div style={{ color: 'var(--color-text-muted)' }}>{invoice.due}</div>
            </div>
          ))}
        </div>

        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.75rem' }}>Current period charges</div>
          {CHARGES.map((charge) => (
            <div key={charge.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>{charge.name}</span>
              <span style={{ fontWeight: 600 }}>{charge.amount}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}