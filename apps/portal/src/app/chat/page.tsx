'use client';

import { useState, useRef, useEffect } from 'react';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeSession = sessions.find((s) => s.id === activeId) ?? sessions[0]!;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [activeSession?.messages.length, isTyping]);

  const handleTextareaInput = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  };

  const sendMessage = () => {
    const text = input.trim();
    if (!text) return;

    const userMsg: Message = { id: `m${Date.now()}`, role: 'user', content: text, time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) };
    setSessions((prev) =>
      prev.map((s) => s.id === activeId ? { ...s, messages: [...s.messages, userMsg], preview: text } : s)
    );
    setInput('');
    if (textareaRef.current) { textareaRef.current.style.height = '44px'; }
    setIsTyping(true);

    setTimeout(() => {
      const aiMsg: Message = {
        id: `m${Date.now() + 1}`,
        role: 'assistant',
        content: `I'm analyzing your query against the IIVKIS knowledge base and current incident data. I found **2 related knowledge articles** and **1 active correlation group** that may be relevant. Let me compile a structured response with recommended actions.`,
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      };
      setSessions((prev) =>
        prev.map((s) => s.id === activeId ? { ...s, messages: [...s.messages, aiMsg] } : s)
      );
      setIsTyping(false);
    }, 1800);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const newChat = () => {
    const id = `s${Date.now()}`;
    const newSession: Session = { id, title: 'New Conversation', preview: 'Start a new conversation...', time: 'Now', messages: [] };
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
          <span className="model-badge">GPT-4o</span>
          <button className="btn-ghost" style={{ padding: '0.4rem 0.875rem', fontSize: '0.8rem' }}>Clear</button>
        </div>

        <div className="chat-messages">
          {activeSession.messages.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginTop: '4rem', animation: 'fade-in 0.5s ease' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>💬</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Start a conversation</div>
              <div style={{ fontSize: '0.82rem', marginTop: '0.5rem' }}>Ask about incidents, knowledge articles, or correlations</div>
            </div>
          )}

          {activeSession.messages.map((msg) => (
            <div key={msg.id} className={`message ${msg.role}`}>
              <div className={`message-avatar ${msg.role === 'user' ? 'user-av' : 'ai-av'}`}>
                {msg.role === 'user' ? 'OP' : 'AI'}
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
