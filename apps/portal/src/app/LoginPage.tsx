'use client';

import Image from 'next/image';
import { useState } from 'react';

import { saveConsoleMode } from './lib/console-mode';
import { findUser, saveSessionUser, DEMO_USERS } from './lib/demo-users';

interface Props {
  onSuccess: () => void;
}

const CAPABILITIES = [
  {
    icon: '🧠',
    title: 'AI-Powered Troubleshooting',
    desc: 'Natural-language chat backed by LLM orchestration to diagnose incidents across any vendor stack in seconds.',
  },
  {
    icon: '🔗',
    title: 'Multi-Vendor Knowledge Graph',
    desc: 'Unified knowledge base covering Cisco, Palo Alto, Fortinet, F5, ServiceNow, Datadog and 30+ integrations.',
  },
  {
    icon: '📡',
    title: 'Real-Time Correlation Engine',
    desc: 'Automated signal correlation groups related alerts, reduces noise by 70% and surfaces root-cause chains.',
  },
  {
    icon: '🏢',
    title: 'Multi-Tenant Architecture',
    desc: 'Operator and customer consoles with strict data isolation, role-based access, and per-tenant SLA tracking.',
  },
];

export default function LoginPage({ onSuccess }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setTimeout(() => {
      const user = findUser(username.trim(), password);
      if (user) {
        saveSessionUser(user);
        saveConsoleMode(user.mode);
        onSuccess();
      } else {
        setError('Invalid username or password. Check the demo credentials below.');
      }
      setLoading(false);
    }, 500);
  };

  const quickLogin = (u: typeof DEMO_USERS[number]) => {
    setUsername(u.username);
    setPassword(u.password);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: 'linear-gradient(135deg, #0a0a1a 0%, #0d1b2a 50%, #0f2337 100%)',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Animated background orbs */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', width: '600px', height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,212,255,0.08) 0%, transparent 70%)',
          top: '-150px', left: '-100px',
          animation: 'orb-drift 14s ease-in-out infinite alternate',
        }} />
        <div style={{
          position: 'absolute', width: '500px', height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(123,47,255,0.09) 0%, transparent 70%)',
          bottom: '-100px', right: '-80px',
          animation: 'orb-drift 18s ease-in-out infinite alternate-reverse',
        }} />
        <div style={{
          position: 'absolute', width: '300px', height: '300px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,212,255,0.05) 0%, transparent 70%)',
          top: '40%', left: '40%',
          animation: 'orb-drift 22s ease-in-out infinite alternate',
        }} />
        {/* Grid overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage:
            'linear-gradient(rgba(0,212,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }} />
      </div>

      {/* ── LEFT PANEL – Brand & Briefing ── */}
      <div style={{
        flex: '0 0 55%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '3rem 4rem',
        position: 'relative',
        zIndex: 1,
      }}>

        {/* Logo + wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '2.5rem' }}>
          <Image src="/iivkis-logo-nav.svg" alt="IIVKIS logo" width={190} height={50} style={{ height: '56px', width: 'auto' }} />
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: '2.6rem',
          fontWeight: 800,
          lineHeight: 1.15,
          letterSpacing: '-0.03em',
          marginBottom: '1rem',
          background: 'linear-gradient(135deg, #ffffff 30%, #00d4ff 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          Intelligent IT Vendor<br />Knowledge Integration
        </h1>
        <p style={{
          fontSize: '1.05rem',
          color: 'rgba(255,255,255,0.55)',
          lineHeight: 1.7,
          maxWidth: '480px',
          marginBottom: '2.5rem',
        }}>
          A unified AI-powered operations platform that ingests signals from every vendor tool,
          correlates incidents in real-time, and surfaces actionable intelligence — so your teams
          resolve issues faster than ever.
        </p>

        {/* Capability highlights */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', maxWidth: '540px' }}>
          {CAPABILITIES.map((c) => (
            <div key={c.title} style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              padding: '1rem 1.1rem',
              transition: 'border-color 0.2s',
            }}>
              <div style={{ fontSize: '1.4rem', marginBottom: '0.4rem' }}>{c.icon}</div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff', marginBottom: '0.3rem' }}>{c.title}</div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.55 }}>{c.desc}</div>
            </div>
          ))}
        </div>

        {/* Copyright */}
        <div style={{ marginTop: '2.5rem', fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)' }}>
          © {new Date().getFullYear()} Raghuprasad Gundeti · All rights reserved · IIVKIS v0.5.0
        </div>
      </div>

      {/* ── RIGHT PANEL – Login Card ── */}
      <div style={{
        flex: '0 0 45%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        position: 'relative',
        zIndex: 1,
      }}>

        {/* Vertical divider */}
        <div style={{
          position: 'absolute',
          left: 0, top: '8%', bottom: '8%',
          width: '1px',
          background: 'linear-gradient(to bottom, transparent, rgba(0,212,255,0.25) 30%, rgba(123,47,255,0.25) 70%, transparent)',
        }} />

        <div style={{
          width: '100%',
          maxWidth: '420px',
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '20px',
          padding: '2.5rem',
          boxShadow: '0 8px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,212,255,0.06)',
        }}>

          {/* Card header */}
          <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '14px',
              background: 'linear-gradient(135deg, #0AA3D6, #7b2fff)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.5rem', margin: '0 auto 1rem',
              boxShadow: '0 0 24px rgba(0,212,255,0.3)',
            }}>🔐</div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#fff', marginBottom: '0.3rem' }}>
              Sign In
            </h2>
            <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)' }}>
              Access the IIVKIS Operations Portal
            </p>
          </div>

          {/* Login form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Username */}
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: '0.4rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Username / Email
              </label>
              <input
                type="text"
                placeholder="e.g. admin@iivkis.io"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '10px',
                  color: '#fff',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.875rem',
                  padding: '0.75rem 1rem',
                  outline: 'none',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#00d4ff'; e.target.style.boxShadow = '0 0 0 3px rgba(0,212,255,0.1)'; }}
                onBlur={(e)  => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: '0.4rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '10px',
                    color: '#fff',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '0.875rem',
                    padding: '0.75rem 2.8rem 0.75rem 1rem',
                    outline: 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#00d4ff'; e.target.style.boxShadow = '0 0 0 3px rgba(0,212,255,0.1)'; }}
                  onBlur={(e)  => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; e.target.style.boxShadow = 'none'; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  style={{
                    position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: '1rem', color: 'rgba(255,255,255,0.4)', padding: 0, lineHeight: 1,
                  }}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: 'rgba(255,107,107,0.1)',
                border: '1px solid rgba(255,107,107,0.25)',
                borderRadius: '8px',
                padding: '0.6rem 0.9rem',
                fontSize: '0.74rem',
                color: '#ff6b6b',
                display: 'flex', gap: '0.5rem', alignItems: 'flex-start',
              }}>
                <span>⚠</span><span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.875rem',
                background: loading ? 'rgba(0,212,255,0.3)' : 'linear-gradient(135deg, #00d4ff, #0099cc)',
                border: 'none',
                borderRadius: '10px',
                color: '#0a0a1a',
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.9rem',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.15s, transform 0.15s',
                boxShadow: '0 0 24px rgba(0,212,255,0.25)',
                marginTop: '0.25rem',
                letterSpacing: '0.02em',
              }}
              onMouseEnter={(e) => { if (!loading) (e.target as HTMLButtonElement).style.opacity = '0.88'; }}
              onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.opacity = '1'; }}
            >
              {loading ? 'Authenticating…' : '→  Sign In'}
            </button>
          </form>

          {/* Demo credentials table */}
          <div style={{
            marginTop: '1.75rem',
            background: 'rgba(0,212,255,0.04)',
            border: '1px solid rgba(0,212,255,0.12)',
            borderRadius: '12px',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '0.6rem 1rem',
              background: 'rgba(0,212,255,0.07)',
              borderBottom: '1px solid rgba(0,212,255,0.12)',
              fontSize: '0.68rem',
              fontWeight: 700,
              color: '#00d4ff',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              display: 'flex', alignItems: 'center', gap: '0.4rem',
            }}>
              <span>🔑</span> Demo Credentials — Prototype Only
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Role', 'Username', 'Password'].map((h) => (
                    <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.62rem' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DEMO_USERS.map((u) => (
                  <tr
                    key={u.username}
                    onClick={() => quickLogin(u)}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,212,255,0.06)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    title="Click to fill credentials"
                  >
                    <td style={{ padding: '0.5rem 0.75rem', color: u.role === 'Operator Admin' ? '#00d4ff' : u.role === 'Customer Admin' ? '#b97aff' : '#ffa500', fontWeight: 600 }}>{u.role}</td>
                    <td style={{ padding: '0.5rem 0.75rem', color: 'rgba(255,255,255,0.7)', fontFamily: 'JetBrains Mono, monospace' }}>{u.username}</td>
                    <td style={{ padding: '0.5rem 0.75rem', color: 'rgba(255,255,255,0.45)', fontFamily: 'JetBrains Mono, monospace' }}>{u.password}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: '0.45rem 0.75rem', fontSize: '0.6rem', color: 'rgba(255,255,255,0.25)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              Click any row to auto-fill credentials
            </div>
          </div>

        </div>
      </div>

      {/* Keyframe for orb drift */}
      <style>{`
        @keyframes orb-drift {
          from { transform: translate(0, 0) scale(1); }
          to   { transform: translate(40px, 30px) scale(1.08); }
        }
      `}</style>
    </div>
  );
}
