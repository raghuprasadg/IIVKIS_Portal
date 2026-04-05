'use client';

import { useState } from 'react';

import { saveConsoleMode } from './lib/console-mode';
import { findUser, saveSessionUser } from './lib/demo-users';

interface Props {
  onSuccess: () => void;
}

export default function LoginForm({ onSuccess }: Props) {
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
        setError('Invalid username or password.');
      }
      setLoading(false);
    }, 400);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>

      {/* Hint strip */}
      <div style={{
        background: 'rgba(0,212,255,0.06)',
        border: '1px solid rgba(0,212,255,0.15)',
        borderRadius: '8px',
        padding: '0.5rem 0.65rem',
        fontSize: '0.62rem',
        color: 'var(--color-text-muted)',
        lineHeight: 1.6,
      }}>
        <div style={{ fontWeight: 600, color: 'var(--color-cyan)', marginBottom: '3px' }}>Demo credentials</div>
        <div><span style={{ color: 'var(--color-text-secondary)' }}>Platform&nbsp;Admin&nbsp;</span>admin@iivkis.io</div>
        <div><span style={{ color: 'var(--color-text-secondary)' }}>Customer&nbsp;Admin&nbsp;</span>cadmin@acme.corp</div>
        <div><span style={{ color: 'var(--color-text-secondary)' }}>Customer&nbsp;Engineer&nbsp;</span>user@acme.corp</div>
      </div>

      <input
        type="text"
        placeholder="Username / email"
        autoComplete="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
        className="glass-input"
        style={{ padding: '0.42rem 0.65rem', fontSize: '0.74rem' }}
      />

      <div style={{ position: 'relative' }}>
        <input
          type={showPw ? 'text' : 'password'}
          placeholder="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="glass-input"
          style={{ padding: '0.42rem 2rem 0.42rem 0.65rem', fontSize: '0.74rem' }}
        />
        <button
          type="button"
          onClick={() => setShowPw((v) => !v)}
          style={{
            position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '0.8rem', color: 'var(--color-text-muted)', padding: 0,
          }}
          aria-label={showPw ? 'Hide password' : 'Show password'}
        >
          {showPw ? '🙈' : '👁️'}
        </button>
      </div>

      {error && (
        <div style={{ fontSize: '0.68rem', color: 'var(--color-coral)', padding: '0.3rem 0' }}>
          ⚠ {error}
        </div>
      )}

      <button
        type="submit"
        className="btn-primary"
        disabled={loading}
        style={{ width: '100%', padding: '0.48rem 0.65rem', fontSize: '0.76rem', opacity: loading ? 0.7 : 1 }}
      >
        {loading ? 'Signing in…' : 'Sign In'}
      </button>
    </form>
  );
}
