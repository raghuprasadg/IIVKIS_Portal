'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { getRoleCapabilities, readSessionUser, type DemoUser } from '../lib/demo-users';

import { FEATURED_VENDORS, KNOWLEDGE_ARTICLES, KNOWLEDGE_CATEGORIES } from './articles';

export default function KnowledgePage() {
  const [sessionUser, setSessionUser] = useState<DemoUser | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');

  useEffect(() => {
    setSessionUser(readSessionUser());
  }, []);

  const capabilities = getRoleCapabilities(sessionUser);

  if (!capabilities.canUseKnowledge) {
    return (
      <div>
        <div className="page-header">
          <div>
            <div className="page-title">Knowledge Base</div>
            <div className="page-subtitle">Technical knowledge content is reserved for engineering and platform roles.</div>
          </div>
        </div>
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>Access restricted</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            Customer Admins use integrations, subscriptions, analytics, and settings instead of the engineer knowledge workspace.
          </div>
        </div>
      </div>
    );
  }

  const filtered = KNOWLEDGE_ARTICLES.filter((a) => {
    const matchCat = category === 'All' || a.category === category;
    const matchSearch = !search ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.tags.some(t => t.includes(search.toLowerCase()));
    return matchCat && matchSearch;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Knowledge Base</div>
          <div className="page-subtitle">{KNOWLEDGE_ARTICLES.length} articles · vendor, cloud, and ops runbooks</div>
        </div>
        {capabilities.canCreateKnowledge ? (
          <button className="btn-primary">＋ New Article</button>
        ) : (
          <span className="badge badge-info">Read-only knowledge access</span>
        )}
      </div>

      <div className="glass-card" style={{ padding: '1rem 1.25rem', marginBottom: '1rem' }}>
        <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>Vendor coverage</div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {FEATURED_VENDORS.map((vendor) => (
            <span key={vendor} className="pill pill-violet" style={{ fontSize: '0.68rem' }}>
              {vendor}
            </span>
          ))}
        </div>
      </div>

      <div className="filter-bar">
        <input
          type="text"
          className="glass-input"
          placeholder="Search articles or tags…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: '280px' }}
        />
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {KNOWLEDGE_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={category === c ? 'btn-primary' : 'btn-secondary'}
              style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem' }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="card-grid" style={{ marginTop: '1.5rem' }}>
        {filtered.map((a) => (
          <Link
            key={a.id}
            href={`/knowledge/${encodeURIComponent(a.id)}`}
            className="glass-card"
            style={{ padding: '1.25rem', cursor: 'pointer', textDecoration: 'none', color: 'inherit', display: 'block' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{a.id}</span>
              <span className="badge badge-info">{a.category}</span>
            </div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.75rem', lineHeight: 1.4 }}>{a.title}</div>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              {a.tags.map(tag => (
                <span key={tag} style={{ background: 'rgba(0,212,255,0.08)', color: 'var(--color-cyan)', fontSize: '0.7rem', padding: '0.15rem 0.55rem', borderRadius: '999px', border: '1px solid rgba(0,212,255,0.18)' }}>
                  #{tag}
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
              <span>👁 {a.views} views</span>
              <span>Updated {a.updated}</span>
              <div className="user-avatar" style={{ width: '1.4rem', height: '1.4rem', fontSize: '0.6rem' }}>{a.author}</div>
            </div>
            <div style={{ marginTop: '0.85rem', fontSize: '0.76rem', color: 'var(--color-cyan)', fontWeight: 600 }}>
              Open article →
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
          No articles found for &quot;{search}&quot;
        </div>
      )}
    </div>
  );
}
