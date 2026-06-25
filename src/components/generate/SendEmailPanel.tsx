import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { isValidEmail } from '../../lib/emailValidation';
import { loadTemplate, saveTemplate } from '../../lib/emailTemplate';
import {
  sendCertificates, type OutgoingCertificate, type SendSummary,
} from '../../lib/emailSender';

type RowStatus = 'valid' | 'invalid-email' | 'sending' | 'sent' | 'failed';
interface PanelRow { cert: OutgoingCertificate; status: RowStatus; error?: string; }
type Phase = 'idle' | 'sending' | 'done';

interface PanelContextValue {
  rows: PanelRow[];
  subject: string;
  body: string;
  setSubject: (s: string) => void;
  setBody: (s: string) => void;
  phase: Phase;
  progress: { done: number; total: number };
  summary: SendSummary | null;
  send: () => Promise<void>;
}

const PanelContext = createContext<PanelContextValue | null>(null);
function usePanel(): PanelContextValue {
  const ctx = useContext(PanelContext);
  if (!ctx) throw new Error('SendEmailPanel.* harus di dalam <SendEmailPanel>');
  return ctx;
}

export function SendEmailPanel({
  eventId, certificates, children,
}: {
  eventId: string;
  certificates: OutgoingCertificate[];
  children: ReactNode;
}) {
  const initial = useMemo(() => loadTemplate(eventId), [eventId]);
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState<SendSummary | null>(null);
  const [overrides, setOverrides] = useState<Record<string, { status: RowStatus; error?: string }>>({});

  const rows = useMemo<PanelRow[]>(() =>
    certificates.map(cert => {
      const o = overrides[cert.filename];
      if (o) return { cert, status: o.status, error: o.error };
      return { cert, status: isValidEmail(cert.email) ? 'valid' : 'invalid-email' };
    }), [certificates, overrides]);

  async function send() {
    const sendable = rows.filter(r => r.status === 'valid' || r.status === 'failed');
    if (sendable.length === 0) return;
    saveTemplate(eventId, { subject, body });
    setPhase('sending');
    setProgress({ done: 0, total: sendable.length });
    setOverrides(prev => {
      const next = { ...prev };
      for (const r of sendable) next[r.cert.filename] = { status: 'sending' };
      return next;
    });

    const emailToFilename = new Map(sendable.map(r => [r.cert.email, r.cert.filename]));
    const result = await sendCertificates(
      { subject, body, recipients: sendable.map(r => r.cert) },
      (done, total) => setProgress({ done, total }),
    );

    setOverrides(prev => {
      const next = { ...prev };
      for (const s of result.sent) {
        const key = emailToFilename.get(s.email) ?? s.email;
        next[key] = { status: 'sent' };
      }
      for (const f of result.failed) {
        if (f.status === 'failed') {
          const key = emailToFilename.get(f.email) ?? f.email;
          next[key] = { status: 'failed', error: f.error };
        }
      }
      return next;
    });
    setSummary(result);
    setPhase('done');
  }

  const value: PanelContextValue = {
    rows, subject, body, setSubject, setBody, phase, progress, summary, send,
  };

  return (
    <PanelContext.Provider value={value}>
      <div className="sg-card" style={{ marginTop: 12 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-hairline)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-ink)' }}>
            Kirim sertifikat lewat email
          </h3>
          <div style={{ fontSize: 13, color: 'var(--color-ink-muted)', marginTop: 2 }}>
            {certificates.length} penerima
          </div>
        </div>
        <div className="sg-two-col" style={{ padding: 20, gap: 20 }}>
          {children}
        </div>
      </div>
    </PanelContext.Provider>
  );
}

const PLACEHOLDERS = ['{nama}', '{nomor}', '{acara}', '{tanggal}', '{peran}'];

function TemplateEditor() {
  const { subject, body, setSubject, setBody, phase } = usePanel();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const disabled = phase === 'sending';

  function insertPlaceholder(ph: string) {
    const ta = textareaRef.current;
    if (!ta) { setBody(body + ph); return; }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = body.slice(0, start) + ph + body.slice(end);
    setBody(next);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + ph.length, start + ph.length);
    }, 0);
  }

  return (
    <div>
      <div className="sg-form-group">
        <label className="sg-label">Subjek email</label>
        <input
          className="sg-input"
          value={subject}
          disabled={disabled}
          onChange={e => setSubject(e.target.value)}
        />
      </div>
      <div className="sg-form-group">
        <label className="sg-label">Isi email</label>
        <div className="sg-card" style={{ overflow: 'hidden' }}>
          {/* Chip toolbar */}
          <div className="sg-email-toolbar">
            <span className="sg-email-toolbar-label">Sisipkan:</span>
            {PLACEHOLDERS.map(ph => (
              <button
                key={ph}
                className="sg-placeholder-chip"
                onClick={() => insertPlaceholder(ph)}
                disabled={disabled}
              >
                {ph}
              </button>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            className="sg-input"
            value={body}
            disabled={disabled}
            rows={6}
            onChange={e => setBody(e.target.value)}
            style={{
              border: 'none',
              borderRadius: 0,
              resize: 'vertical',
              fontSize: 13.5,
              lineHeight: 1.65,
              minHeight: 120,
            }}
          />
        </div>
        <div className="sg-hint" style={{ marginTop: 4 }}>
          Klik chip di atas untuk menyisipkan placeholder ke posisi kursor
        </div>
      </div>
    </div>
  );
}

function statusIcon(status: RowStatus) {
  if (status === 'sent') {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M2 6.5L5 9.5L10 3.5" stroke="#138a2e" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === 'sending') {
    return <span style={{
      display: 'inline-block', width: 10, height: 10,
      border: '1.5px solid transparent', borderTopColor: 'var(--color-primary)',
      borderRadius: '50%', animation: 'sg-spin 0.9s linear infinite',
    }} />;
  }
  if (status === 'failed') {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M3 3l6 6M9 3l-6 6" stroke="var(--color-accent-red)" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }
  return null;
}

const STATUS_LABEL: Record<RowStatus, string> = {
  valid: 'Siap', 'invalid-email': 'Email tidak valid',
  sending: 'Mengirim…', sent: 'Terkirim', failed: 'Gagal',
};

const STATUS_COLOR: Record<RowStatus, string> = {
  valid: 'var(--color-ink-secondary)',
  'invalid-email': 'var(--color-ink-muted)',
  sending: 'var(--color-primary)',
  sent: '#138a2e',
  failed: 'var(--color-accent-red)',
};

function RecipientTable() {
  const { rows, phase, progress, summary, send } = usePanel();
  const sendableCount = rows.filter(r => r.status === 'valid' || r.status === 'failed').length;
  const sentCount = rows.filter(r => r.status === 'sent').length;
  const failedCount = rows.filter(r => r.status === 'failed').length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-ink)' }}>Penerima</span>
        {sentCount > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999,
            background: 'rgba(26,174,57,0.1)', color: '#138a2e',
          }}>
            {sentCount} terkirim
          </span>
        )}
        {failedCount > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999,
            background: 'rgba(217,119,6,0.1)', color: '#b45309',
          }}>
            {failedCount} gagal
          </span>
        )}
      </div>

      <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--color-hairline)', borderRadius: 8 }}>
        <table className="apple-table" style={{ fontSize: 13 }}>
          <thead>
            <tr><th>Nama</th><th>Email</th><th>Status</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 500 }}>{r.cert.nama}</td>
                <td style={{ color: r.cert.email ? 'var(--color-ink)' : 'var(--color-ink-faint)', fontSize: 12 }}>
                  {r.cert.email || '—'}
                </td>
                <td>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: STATUS_COLOR[r.status], fontSize: 12.5 }}>
                    {statusIcon(r.status)}
                    {STATUS_LABEL[r.status]}
                    {r.error && <span style={{ color: 'var(--color-accent-red)', fontSize: 11 }}>· {r.error}</span>}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 14 }}>
        {phase === 'sending' ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--color-ink-muted)', marginBottom: 6 }}>
              <span>{progress.done} / {progress.total} terkirim</span>
              <span>{Math.round((progress.done / progress.total) * 100)}%</span>
            </div>
            <div className="apple-progress-track">
              <div className="apple-progress-fill shimmer" style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="sg-btn sg-btn-primary sg-btn-pill"
              style={{ flex: 1, justifyContent: 'center', fontSize: 13.5 }}
              disabled={sendableCount === 0}
              onClick={send}
            >
              {phase === 'done' && summary && summary.failed.length > 0
                ? `Ulangi yang gagal (${sendableCount})`
                : `Kirim ${sendableCount} email`}
            </button>
            {phase === 'done' && summary && summary.failed.length > 0 && (
              <button className="sg-btn sg-btn-outline" onClick={send}>
                Kirim ulang
              </button>
            )}
          </div>
        )}
        {phase === 'done' && summary && (
          <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--color-ink-muted)' }}>
            {summary.sent.length} terkirim · {summary.failed.length} gagal
          </div>
        )}
      </div>
    </div>
  );
}

function SendButton() {
  return null; // Integrated into RecipientTable
}

SendEmailPanel.TemplateEditor = TemplateEditor;
SendEmailPanel.RecipientTable = RecipientTable;
SendEmailPanel.SendButton = SendButton;
