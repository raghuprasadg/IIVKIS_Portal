import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getKnowledgeArticle } from '../articles';

export default async function KnowledgeArticlePage({
  params,
}: {
  params: Promise<{ articleId: string }>;
}) {
  const { articleId } = await params;
  const article = getKnowledgeArticle(decodeURIComponent(articleId));

  if (!article) {
    notFound();
  }

  const cypher = [
    `MERGE (ka:KnowledgeArticle { id: '${article.id}' })`,
    `SET ka.title = '${article.title.replace(/'/g, "\\'")}',`,
    `    ka.summary = '${article.content.slice(0, 120).replace(/'/g, "\\'")}${article.content.length > 120 ? '...' : ''}',`,
    `    ka.tags = ${JSON.stringify(article.tags)},`,
    `    ka.updatedAt = '${article.updated}'`,
    'WITH ka',
    `UNWIND ${JSON.stringify(article.references)} AS ref`,
    'MATCH (n { id: ref })',
    'MERGE (ka)-[:REFERENCES]->(n)',
  ].join('\n');

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">{article.title}</div>
          <div className="page-subtitle">{article.id} · updated {article.updated} · author {article.author}</div>
        </div>
        <Link href="/knowledge" className="btn-secondary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
          ← Back to knowledge base
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(320px, 0.95fr)', gap: '1.25rem', alignItems: 'start' }}>
        <div className="glass-card" style={{ padding: '1.4rem' }}>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.95rem' }}>
            <span className="badge badge-info">{article.category}</span>
            {article.tags.map((tag) => (
              <span key={tag} style={{ background: 'rgba(0,212,255,0.08)', color: 'var(--color-cyan)', fontSize: '0.7rem', padding: '0.18rem 0.55rem', borderRadius: '999px', border: '1px solid rgba(0,212,255,0.18)' }}>
                #{tag}
              </span>
            ))}
          </div>

          <div style={{ fontSize: '0.9rem', lineHeight: 1.8, color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap' }}>
            {article.content}
          </div>
        </div>

        <div style={{ display: 'grid', gap: '1rem' }}>
          <div className="glass-card" style={{ padding: '1.1rem' }}>
            <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', marginBottom: '0.45rem' }}>How it is stored in the Knowledge Graph</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: '0.75rem' }}>
              The article is modeled as a <strong>KnowledgeArticle</strong> node. Each related system, CI, product, advisory, or vendor is connected through a <strong>REFERENCES</strong> edge.
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--color-cyan)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
              {cypher}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '1.1rem' }}>
            <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', marginBottom: '0.55rem' }}>Linked graph entities</div>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              {article.references.map((ref) => (
                <span
                  key={ref}
                  style={{
                    background: 'rgba(139,92,246,0.12)',
                    color: 'var(--color-violet)',
                    fontSize: '0.72rem',
                    padding: '0.18rem 0.55rem',
                    borderRadius: '999px',
                    border: '1px solid rgba(139,92,246,0.2)',
                  }}
                >
                  {ref}
                </span>
              ))}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '1.1rem' }}>
            <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>Storage note</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              In the current codebase, article records are served from the knowledge API and the graph representation is modeled separately via Neo4j schema and seed files. This page shows the exact article-to-graph mapping expected by the platform.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}