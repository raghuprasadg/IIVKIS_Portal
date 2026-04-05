'use client';

import { useEffect, useRef, useState } from 'react';

import { getRoleCapabilities, readSessionUser } from '../lib/demo-users';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  time: string;
}

interface Session {
  id: string;
  title: string;
  preview: string;
  time: string;
  messages: Message[];
}

interface KnowledgeArticle {
  id: string;
  title: string;
  tags: string[];
  summary: string;
  nextActions: string[];
}

interface IncidentSignal {
  id: string;
  title: string;
  source: string;
  status: string;
  tags: string[];
}

const KB_ARTICLES: KnowledgeArticle[] = [
  {
    id: 'KA-0821',
    title: 'ServiceNow MID Server Connection Pool Exhaustion',
    tags: ['servicenow', 'timeout', 'mid', 'connection', 'pool'],
    summary: 'ServiceNow API timeouts are commonly caused by MID thread starvation and exhausted HTTP pools.',
    nextActions: [
      'Validate MID Server health and thread counts',
      'Review recent change windows for integration worker config changes',
      'Check retry/backoff policy to reduce burst pressure',
    ],
  },
  {
    id: 'KA-0634',
    title: 'Vault PKI Certificate Renewal Runbook',
    tags: ['vault', 'certificate', 'pki', 'tls', 'renewal'],
    summary: 'Expiring certificates usually map to failed PKI CronJobs or RBAC drift in renewal namespaces.',
    nextActions: [
      'Verify certificate expiry and issuer chain from vault-01',
      'Run PKI renewal job manually and review RBAC permissions',
      'Stage rolling restart after new cert propagation',
    ],
  },
  {
    id: 'KA-1102',
    title: 'Neo4j Latency After Unbounded Traversal Queries',
    tags: ['neo4j', 'latency', 'cypher', 'index'],
    summary: 'P95 query spikes are often caused by unbounded traversals and index fragmentation after imports.',
    nextActions: [
      'Run query profile for top offenders and enforce traversal depth limits',
      'Inspect index health with db.indexes()',
      'Throttle background ingestion jobs while rebuilding indexes',
    ],
  },
  {
    id: 'KA-1320',
    title: 'Network Edge Incident Correlation (Cisco/Palo Alto/Fortinet/F5)',
    tags: ['cisco', 'palo alto', 'fortinet', 'f5', 'network', 'firewall', 'load balancer'],
    summary: 'Edge incidents correlate best when config-change windows and traffic/error anomalies overlap on shared CIs.',
    nextActions: [
      'Cross-check ServiceNow change records +/- 15 minutes around the first alert',
      'Confirm CI overlap across router, firewall, and ADC nodes',
      'Use confidence threshold >= 70% for grouped escalation',
    ],
  },
];

const INCIDENT_SIGNALS: IncidentSignal[] = [
  {
    id: 'INC-2401',
    title: 'ServiceNow API timeout cascade',
    source: 'ServiceNow',
    status: 'In Progress',
    tags: ['servicenow', 'timeout', 'integration'],
  },
  {
    id: 'INC-2351',
    title: 'Cisco core router BGP flap storm',
    source: 'Cisco',
    status: 'Investigating',
    tags: ['cisco', 'router', 'bgp', 'network'],
  },
  {
    id: 'INC-2350',
    title: 'Palo Alto policy push rollback',
    source: 'Palo Alto',
    status: 'In Progress',
    tags: ['palo alto', 'firewall', 'policy'],
  },
  {
    id: 'INC-2348',
    title: 'Fortinet HA failover jitter',
    source: 'Fortinet',
    status: 'Monitoring',
    tags: ['fortinet', 'ha', 'firewall'],
  },
  {
    id: 'INC-2347',
    title: 'F5 BIG-IP iRule regression',
    source: 'F5',
    status: 'Open',
    tags: ['f5', 'bigip', 'irule', 'load balancer'],
  },
];

const CORRELATION_GROUPS = [
  { id: 'CG-041', name: 'API Timeout + DB Slow Query Cluster', confidence: 87 },
  { id: 'CG-052', name: 'Network Edge Config Drift (Cisco/Palo Alto/Fortinet/F5)', confidence: 79 },
  { id: 'CG-040', name: 'Vault Auth Errors -> Keycloak Degradation', confidence: 72 },
];

const INITIAL_SESSIONS: Session[] = [
  {
    id: 's1',
    title: 'ServiceNow API Timeout',
    preview: 'What are the known causes of ServiceNow API timeouts?',
    time: '14:32',
    messages: [
      {
        id: 'm1',
        role: 'user',
        content: 'We have an active incident INC-2401 where the ServiceNow API is timing out intermittently. What are the known causes and what should I check first?',
        time: '14:32',
      },
      {
        id: 'm2',
        role: 'assistant',
        content: `I found **3 relevant knowledge articles** for ServiceNow API timeout patterns.\n\n**KA-0821 — ServiceNow MID Server Connection Pool Exhaustion**\nThis is the most likely cause given your description. When the connection pool is exhausted, requests queue up and eventually time out. Check:\n- \`glide.db.pool.connections\` system property (should be ≥ 50 for production)\n- MID Server thread count under **System Diagnostics → Stats**\n\n**Recommended immediate actions:**\n1. Navigate to **System Logs → Application Logs** and filter for \`ConnectionTimeoutException\`\n2. Check MID Server health: *MID Server → Servers → [your server] → Validate*\n3. Review recent changes in the **Change Management** module from the past 24h\n\n**Correlated signals:** This incident appears in Correlation Group CG-041 along with slow DB queries on \`pg-primary\` and connection pool saturation on \`snow-conn-pool\`. The correlation confidence is **87%** — I recommend treating these as a single root cause investigation.\n\nShall I pull the full runbook for MID Server recovery?`,
        time: '14:32',
      },
      {
        id: 'm3',
        role: 'user',
        content: 'Yes, please provide the MID Server recovery runbook steps.',
        time: '14:35',
      },
    ],
  },
  {
    id: 's2',
    title: 'Vault Certificate Renewal',
    preview: 'Certificate for vault-01 expires in 6 days...',
    time: '13:15',
    messages: [
      {
        id: 'm1',
        role: 'user',
        content: 'Certificate for vault-01 expires in 6 days. What is the renewal procedure?',
        time: '13:15',
      },
      {
        id: 'm2',
        role: 'assistant',
        content: 'Found the Vault PKI certificate renewal runbook (KA-0634). The standard procedure involves requesting a new cert via the PKI secrets engine, updating the vault config, and performing a rolling restart.',
        time: '13:16',
      },
    ],
  },
  {
    id: 's3',
    title: 'Neo4j Query Latency',
    preview: 'Graph queries taking 3x longer than baseline',
    time: 'Yesterday',
    messages: [
      {
        id: 'm1',
        role: 'user',
        content: 'Graph queries taking 3x longer than baseline since 09:00 UTC',
        time: '09:47',
      },
      {
        id: 'm2',
        role: 'assistant',
        content: 'This matches KA-1102 — Neo4j index fragmentation after bulk imports. Run `CALL db.indexes()` and check for indexes with status POPULATING or FAILED.',
        time: '09:48',
      },
    ],
  },
];

export default function ChatPage() {
  const [sessions, setSessions] = useState<Session[]>(INITIAL_SESSIONS);
  const [activeId, setActiveId] = useState<string>('s1');
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [displayName, setDisplayName] = useState('Operator');
  const [sessionUser, setSessionUser] = useState<ReturnType<typeof readSessionUser>>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeSession = sessions.find((s) => s.id === activeId) ?? sessions[0]!;
  const capabilities = getRoleCapabilities(sessionUser);

  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Trace-Id': `portal-chat-${Date.now()}`,
    };

    const token = (typeof window !== 'undefined' ? localStorage.getItem('iivkis_token') : null)
      || process.env.NEXT_PUBLIC_DEV_BEARER_TOKEN
      || '';

    if (token) {
      headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    }

    return headers;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [activeSession?.messages.length, isTyping]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setSessionUser(readSessionUser());

    const fromStorage =
      localStorage.getItem('iivkis_user_name')
      || localStorage.getItem('user_name')
      || localStorage.getItem('username')
      || localStorage.getItem('displayName')
      || '';

    const session = readSessionUser();
    if (session?.displayName) {
      setDisplayName(session.displayName);
      return;
    }

    const normalized = fromStorage.trim();
    if (normalized) setDisplayName(normalized);
  }, []);

  const buildWelcomeMessage = (name: string): string => {
    return `Hi ${name}, I am your IIVKIS co-working assistant. I can work with you on incidents, correlations, and runbooks. Share an incident ID or goal, and we will triage it together.`;
  };

  useEffect(() => {
    if (!activeSession) return;
    if (activeSession.messages.length > 0) return;

    const welcomeMessage: Message = {
      id: `m${Date.now()}`,
      role: 'assistant',
      content: buildWelcomeMessage(displayName),
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    };

    setSessions((prev) =>
      prev.map((s) => (s.id === activeSession.id && s.messages.length === 0)
        ? { ...s, messages: [welcomeMessage], preview: `Welcome ${displayName}` }
        : s)
    );
  }, [activeId, activeSession, displayName]);

  if (!capabilities.canUseChat) {
    return (
      <div>
        <div className="page-header">
          <div>
            <div className="page-title">AI Chat</div>
            <div className="page-subtitle">AI troubleshooting is reserved for engineering and platform roles.</div>
          </div>
        </div>
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>Access restricted</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            Customer Admins do not use the AI troubleshooting console. Sign in as Customer Engineer or Platform Admin to open guided incident chat.
          </div>
        </div>
      </div>
    );
  }

  const scoreByKeywords = (text: string, keywords: string[]): number => {
    const normalized = text.toLowerCase();
    return keywords.reduce((score, keyword) => score + (normalized.includes(keyword) ? 1 : 0), 0);
  };

  const buildAssistantResponse = (query: string): string => {
    const q = query.toLowerCase();

    const rankedArticles = KB_ARTICLES
      .map((article) => ({ article, score: scoreByKeywords(q, article.tags) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map((x) => x.article);

    const relatedIncidents = INCIDENT_SIGNALS
      .filter((inc) => scoreByKeywords(q, [inc.source.toLowerCase(), ...inc.tags]) > 0)
      .slice(0, 3);

    const relatedCorrelation = CORRELATION_GROUPS
      .filter((g) => {
        if (q.includes('network') || q.includes('cisco') || q.includes('palo') || q.includes('fortinet') || q.includes('f5')) {
          return g.id === 'CG-052';
        }
        if (q.includes('servicenow') || q.includes('timeout')) {
          return g.id === 'CG-041';
        }
        if (q.includes('vault') || q.includes('certificate')) {
          return g.id === 'CG-040';
        }
        return false;
      })
      .slice(0, 1);

    const lines: string[] = [];
    lines.push('I analyzed your query against the current incident and knowledge context.');

    if (rankedArticles.length > 0) {
      lines.push('');
      lines.push('**Top knowledge matches:**');
      rankedArticles.forEach((a) => {
        lines.push(`- **${a.id} — ${a.title}**: ${a.summary}`);
      });
    }

    if (relatedIncidents.length > 0) {
      lines.push('');
      lines.push('**Related incidents:**');
      relatedIncidents.forEach((inc) => {
        lines.push(`- ${inc.id} (${inc.source}) — ${inc.title} [${inc.status}]`);
      });
    }

    const topCorrelation = relatedCorrelation[0];
    if (topCorrelation) {
      lines.push('');
      lines.push('**Correlation insight:**');
      lines.push(`- ${topCorrelation.id} — ${topCorrelation.name} (confidence ${topCorrelation.confidence}%)`);
    }

    const chosenArticle = rankedArticles[0];
    if (chosenArticle) {
      lines.push('');
      lines.push('**Recommended next actions:**');
      chosenArticle.nextActions.forEach((step, idx) => {
        lines.push(`${idx + 1}. ${step}`);
      });
    } else {
      lines.push('');
      lines.push('Please share the vendor/system name, incident ID, and time window so I can produce targeted troubleshooting steps.');
    }

    return lines.join('\n');
  };

  const handleTextareaInput = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;

    const sessionId = activeId;
    const sessionSnapshot = sessions.find((s) => s.id === sessionId);

    const userMsg: Message = { id: `m${Date.now()}`, role: 'user', content: text, time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) };
    setSessions((prev) =>
      prev.map((s) => s.id === sessionId ? { ...s, messages: [...s.messages, userMsg], preview: text } : s)
    );
    setInput('');
    if (textareaRef.current) { textareaRef.current.style.height = '44px'; }
    setIsTyping(true);

    const historyForApi = [
      ...(sessionSnapshot?.messages ?? []).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: text },
    ];

    try {
      const response = await fetch('/api/chat/reply', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          content: text,
          messages: historyForApi,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        data?: { content?: string; status?: string };
        error?: { message?: string };
      };

      const normalizeBackendError = (message?: string): string | null => {
        if (!message) return null;
        const lower = message.toLowerCase();
        if (
          lower.includes('fetch failed')
          || lower.includes('could not reach orchestrator')
          || lower.includes('llm_unavailable')
          || lower.includes('llm provider is unavailable')
        ) {
          return 'I could not reach the orchestration service right now. Check ORCHESTRATOR_URL and ensure the orchestrator is running and reachable from the portal service.';
        }
        return message;
      };

      const apiContent = payload.data?.content?.trim();
      const aiContent = apiContent && apiContent.length > 0
        ? (normalizeBackendError(apiContent) ?? apiContent)
        : normalizeBackendError(payload.error?.message) ||
          'AI backend is unavailable. Please verify API/orchestrator services and LLM configuration.';

      const aiMsg: Message = {
        id: `m${Date.now() + 1}`,
        role: 'assistant',
        content: aiContent,
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      };

      setSessions((prev) =>
        prev.map((s) => s.id === sessionId ? { ...s, messages: [...s.messages, aiMsg] } : s)
      );
    } catch {
      const aiMsg: Message = {
        id: `m${Date.now() + 1}`,
        role: 'assistant',
        content: buildAssistantResponse(text),
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      };
      setSessions((prev) =>
        prev.map((s) => s.id === sessionId ? { ...s, messages: [...s.messages, aiMsg] } : s)
      );
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const newChat = () => {
    const id = `s${Date.now()}`;
    const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    const welcomeMessage: Message = {
      id: `m${Date.now()}`,
      role: 'assistant',
      content: buildWelcomeMessage(displayName),
      time: now,
    };

    const newSession: Session = {
      id,
      title: 'New Conversation',
      preview: `Welcome ${displayName}`,
      time: 'Now',
      messages: [welcomeMessage],
    };

    setSessions((prev) => [newSession, ...prev]);
    setActiveId(id);
  };

  const formatContent = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} style={{ color: 'var(--color-text-primary)' }}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} style={{ background: 'rgba(255,255,255,0.1)', padding: '1px 6px', borderRadius: '4px', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.82em' }}>{part.slice(1, -1)}</code>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="chat-layout" style={{ height: '100vh' }}>
      {/* Session List */}
      <div className="chat-sessions">
        <div className="chat-sessions-header">
          <button className="btn-primary" style={{ width: '100%' }} onClick={newChat}>
            ＋ New Chat
          </button>
        </div>
        <div className="chat-sessions-list">
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`session-item${s.id === activeId ? ' active' : ''}`}
              onClick={() => setActiveId(s.id)}
            >
              <div className="session-title">💬 {s.title}</div>
              <div className="session-preview">{s.preview}</div>
              <div className="session-time">{s.time}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Chat */}
      <div className="chat-main">
        <div className="chat-header">
          <div className="chat-header-title">{activeSession.title}</div>
          <span className="model-badge">AI Live</span>
          <button className="btn-ghost" style={{ padding: '0.4rem 0.875rem', fontSize: '0.8rem' }}>Clear</button>
        </div>

        <div className="chat-messages">
          {activeSession.messages.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginTop: '4rem', animation: 'fade-in 0.5s ease' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>💬</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                Hi {displayName}, ready to co-work?
              </div>
              <div style={{ fontSize: '0.82rem', marginTop: '0.5rem' }}>
                I will assist with incidents, knowledge lookups, and correlation decisions.
              </div>
            </div>
          )}

          {activeSession.messages.map((msg) => (
            <div key={msg.id} className={`message ${msg.role}`}>
              <div className={`message-avatar ${msg.role === 'user' ? 'user-av' : 'ai-av'}`}>
                {msg.role === 'user' ? (sessionUser?.displayName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'ME') : 'AI'}
              </div>
              <div className="message-meta">
                <div className="message-bubble">
                  {msg.content.split('\n').map((line, i) => (
                    <span key={i}>
                      {formatContent(line)}
                      {i < msg.content.split('\n').length - 1 && <br />}
                    </span>
                  ))}
                </div>
                <div className="message-time">{msg.time}</div>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="message assistant">
              <div className="message-avatar ai-av">AI</div>
              <div className="message-bubble">
                <div className="typing-indicator">
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area">
          <div className="chat-input-wrap">
            <button className="chat-icon-btn" title="Attach file">📎</button>
            <textarea
              ref={textareaRef}
              className="chat-textarea"
              placeholder="Ask about incidents, knowledge articles, or get a troubleshooting plan…"
              value={input}
              onChange={(e) => { setInput(e.target.value); handleTextareaInput(); }}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <button className="chat-send-btn" onClick={sendMessage} title="Send">➤</button>
          </div>
          <div className="chat-hint">Shift+Enter for new line · Enter to send</div>
        </div>
      </div>
    </div>
  );
}
