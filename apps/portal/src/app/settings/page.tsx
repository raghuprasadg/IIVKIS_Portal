'use client';

import { useState } from 'react';

const SECTIONS = ['General', 'Notifications', 'Integrations', 'Security', 'Appearance'];

export default function SettingsPage() {
  const [active, setActive] = useState('General');
  const [saved, setSaved] = useState(false);

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-subtitle">System configuration &amp; preferences</div>
        </div>
        <button className="btn-primary" onClick={save}>
          {saved ? '✓ Saved' : 'Save Changes'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '1.5rem' }}>
        {/* Sidebar */}
        <div className="glass-card" style={{ padding: '0.75rem', alignSelf: 'start' }}>
          {SECTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setActive(s)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '0.6rem 0.85rem',
                background: active === s ? 'rgba(0,212,255,0.12)' : 'none',
                border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem',
                color: active === s ? 'var(--color-cyan)' : 'var(--color-text-secondary)',
                fontWeight: active === s ? 600 : 400, marginBottom: '2px',
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Panel */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          {active === 'General' && <GeneralSettings />}
          {active === 'Notifications' && <NotificationSettings />}
          {active === 'Integrations' && <IntegrationSettings />}
          {active === 'Security' && <SecuritySettings />}
          {active === 'Appearance' && <AppearanceSettings />}
        </div>
      </div>
    </div>
  );
}

function Field({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div>
        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{label}</div>
        {description && <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>{description}</div>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ defaultChecked = false }: { defaultChecked?: boolean }) {
  const [on, setOn] = useState(defaultChecked);
  return (
    <div
      onClick={() => setOn(!on)}
      style={{ width: '40px', height: '22px', background: on ? 'var(--color-cyan)' : 'rgba(255,255,255,0.1)', borderRadius: '11px', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
    >
      <div style={{ position: 'absolute', top: '3px', left: on ? '21px' : '3px', width: '16px', height: '16px', background: '#fff', borderRadius: '50%', transition: 'left 0.2s' }} />
    </div>
  );
}

function GeneralSettings() {
  return (
    <div>
      <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>General</div>
      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>Portal identity and behaviour</div>
      <Field label="Organisation Name" description="Displayed in the portal header and reports">
        <input defaultValue="IIVKIS Operations" className="glass-input" style={{ width: '200px', padding: '0.4rem 0.75rem', fontSize: '0.82rem' }} />
      </Field>
      <Field label="Default Timezone" description="Used for all displayed timestamps">
        <select className="glass-input" style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem' }}>
          <option>UTC</option><option>US/Eastern</option><option>Europe/London</option><option>Asia/Kolkata</option>
        </select>
      </Field>
      <Field label="Incident Auto-Refresh" description="Refresh interval for the incidents list">
        <select className="glass-input" style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem' }}>
          <option>30 seconds</option><option>1 minute</option><option>5 minutes</option><option>Off</option>
        </select>
      </Field>
      <Field label="Maintenance Mode" description="Disable incoming alerts while in maintenance">
        <Toggle />
      </Field>
    </div>
  );
}

function NotificationSettings() {
  return (
    <div>
      <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Notifications</div>
      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>Alert and notification preferences</div>
      <Field label="P0/P1 Email Alerts" description="Send email for critical and high severity incidents">
        <Toggle defaultChecked />
      </Field>
      <Field label="Slack Notifications" description="Post to #incidents Slack channel on new incidents">
        <Toggle defaultChecked />
      </Field>
      <Field label="SLA Breach Warnings" description="Notify 30 minutes before an SLA breach">
        <Toggle defaultChecked />
      </Field>
      <Field label="Correlation Alerts" description="Alert when a new correlation group is detected">
        <Toggle />
      </Field>
      <Field label="Digest Frequency" description="How often to send the daily summary digest">
        <select className="glass-input" style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem' }}>
          <option>Daily at 09:00</option><option>Twice daily</option><option>Weekly</option><option>Off</option>
        </select>
      </Field>
    </div>
  );
}

function IntegrationSettings() {
  return (
    <div>
      <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Integrations</div>
      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>API keys and connection settings</div>
      {[['ServiceNow Instance URL', 'https://your-instance.service-now.com'], ['ServiceNow API Token', '••••••••••••••••'], ['PagerDuty API Key', '••••••••••••••••'], ['Jira Base URL', 'https://your-org.atlassian.net'], ['Slack Webhook URL', '••••••••••••••••']].map(([label, placeholder]) => (
        <Field key={label} label={label as string}>
          <input defaultValue={placeholder} type={String(placeholder).startsWith('•') ? 'password' : 'text'} className="glass-input" style={{ width: '240px', padding: '0.4rem 0.75rem', fontSize: '0.82rem' }} />
        </Field>
      ))}
    </div>
  );
}

function SecuritySettings() {
  return (
    <div>
      <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Security</div>
      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>Authentication and access control</div>
      <Field label="Enforce MFA" description="Require multi-factor authentication for all users">
        <Toggle defaultChecked />
      </Field>
      <Field label="Session Timeout" description="Auto-logout idle sessions">
        <select className="glass-input" style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem' }}>
          <option>30 minutes</option><option>1 hour</option><option>4 hours</option><option>8 hours</option>
        </select>
      </Field>
      <Field label="Audit Logging" description="Log all user actions to the audit trail">
        <Toggle defaultChecked />
      </Field>
      <Field label="IP Allowlist" description="Restrict access to specific IP ranges">
        <Toggle />
      </Field>
      <Field label="Keycloak Realm" description="OIDC identity provider configuration">
        <input defaultValue="iivkis" className="glass-input" style={{ width: '160px', padding: '0.4rem 0.75rem', fontSize: '0.82rem' }} />
      </Field>
    </div>
  );
}

function AppearanceSettings() {
  return (
    <div>
      <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Appearance</div>
      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>Visual preferences</div>
      <Field label="Theme" description="Portal colour scheme">
        <select className="glass-input" style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem' }}>
          <option>Dark (default)</option><option>Light</option><option>System</option>
        </select>
      </Field>
      <Field label="Accent Colour" description="Primary highlight colour">
        <input type="color" defaultValue="#00d4ff" style={{ width: '36px', height: '32px', border: 'none', background: 'none', cursor: 'pointer' }} />
      </Field>
      <Field label="Compact Mode" description="Reduce spacing for denser information display">
        <Toggle />
      </Field>
      <Field label="Animations" description="Enable UI transition animations">
        <Toggle defaultChecked />
      </Field>
    </div>
  );
}
