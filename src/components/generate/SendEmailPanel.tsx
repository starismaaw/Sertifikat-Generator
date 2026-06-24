import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
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

  // Status valid di-derive saat render (rerender-derived-state), bukan via useEffect.
  const rows = useMemo<PanelRow[]>(() =>
    certificates.map(cert => {
      const o = overrides[cert.email];
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
      for (const r of sendable) next[r.cert.email] = { status: 'sending' };
      return next;
    });

    const result = await sendCertificates(
      { subject, body, recipients: sendable.map(r => r.cert) },
      (done, total) => setProgress({ done, total }),
    );

    setOverrides(prev => {
      const next = { ...prev };
      for (const s of result.sent) next[s.email] = { status: 'sent' };
      for (const f of result.failed) {
        if (f.status === 'failed') next[f.email] = { status: 'failed', error: f.error };
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
      <div className="apple-card apple-mt-md">{children}</div>
    </PanelContext.Provider>
  );
}

function TemplateEditor() {
  const { subject, body, setSubject, setBody, phase } = usePanel();
  const disabled = phase === 'sending';
  return (
    <div className="apple-form-group">
      <label className="apple-label">Subjek email</label>
      <input className="apple-input" value={subject} disabled={disabled}
        onChange={e => setSubject(e.target.value)} />
      <label className="apple-label apple-mt-sm">Isi email</label>
      <textarea className="apple-input" value={body} disabled={disabled} rows={8}
        onChange={e => setBody(e.target.value)} />
      <span className="apple-hint">
        Placeholder: {'{nama}'}, {'{nomor}'}, {'{acara}'}, {'{tanggal}'}, {'{peran}'}
      </span>
    </div>
  );
}

const STATUS_LABEL: Record<RowStatus, string> = {
  valid: 'Siap', 'invalid-email': 'Email tidak valid',
  sending: 'Mengirim…', sent: 'Terkirim', failed: 'Gagal',
};

function RecipientTable() {
  const { rows } = usePanel();
  return (
    <table className="apple-table apple-mt-sm">
      <thead><tr><th>Nama</th><th>Email</th><th>Status</th></tr></thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.cert.email + r.cert.nama}>
            <td>{r.cert.nama}</td>
            <td>{r.cert.email || <span className="apple-fine">—</span>}</td>
            <td>{STATUS_LABEL[r.status]}{r.error ? ` · ${r.error}` : ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SendButton() {
  const { rows, phase, progress, summary, send } = usePanel();
  const sendableCount = rows.filter(r => r.status === 'valid' || r.status === 'failed').length;
  return (
    <div className="apple-mt-md">
      {phase === 'sending' ? (
        <span className="apple-caption">Mengirim {progress.done} dari {progress.total}…</span>
      ) : (
        <button className="apple-btn apple-btn-primary apple-btn-lg"
          disabled={sendableCount === 0} onClick={send}>
          {phase === 'done' && summary && summary.failed.length > 0
            ? `Kirim Ulang yang Gagal (${sendableCount})`
            : `Kirim Email (${sendableCount})`}
        </button>
      )}
      {phase === 'done' && summary && (
        <div className="apple-caption apple-mt-sm">
          {summary.sent.length} terkirim · {summary.failed.length} gagal
        </div>
      )}
    </div>
  );
}

SendEmailPanel.TemplateEditor = TemplateEditor;
SendEmailPanel.RecipientTable = RecipientTable;
SendEmailPanel.SendButton = SendButton;
