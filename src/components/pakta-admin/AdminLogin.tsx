import { useState } from 'react';
import { usePaktaAdmin } from '../../contexts/PaktaAdminContext';

export function AdminLogin() {
  const { setPassword } = usePaktaAdmin();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    if (!input.trim()) { setError('Sandi tidak boleh kosong'); return; }
    setLoading(true);
    setError('');
    // Temporarily set password to test it
    // We do a cheap list_events call to verify
    try {
      const res = await fetch('/api/pakta-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-pakta-admin': input },
        body: JSON.stringify({ action: 'list_events' }),
      });
      if (!res.ok) throw new Error('Sandi salah');
      setPassword(input);
    } catch {
      setError('Sandi tidak valid. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="apple-page apple-page-compact" style={{ maxWidth: 400, paddingTop: 80 }}>
      <div className="apple-card">
        <div className="apple-card-header">
          <h1 className="apple-h2">Admin Pakta Integritas</h1>
          <p className="apple-caption" style={{ marginTop: 4 }}>
            Masukkan sandi untuk mengakses dasbor admin.
          </p>
        </div>
        <div className="apple-card-body">
          {error && <p className="apple-error" style={{ marginBottom: 12 }}>{error}</p>}
          <div className="apple-form-group">
            <label className="apple-label" htmlFor="admin-password">Sandi Admin</label>
            <input
              id="admin-password"
              className="apple-input"
              type="password"
              value={input}
              autoFocus
              placeholder="Masukkan sandi"
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>
          <button
            className="apple-btn apple-btn-primary"
            style={{ width: '100%', marginTop: 8 }}
            disabled={loading}
            onClick={handleLogin}
          >
            {loading ? 'Memverifikasi…' : 'Masuk'}
          </button>
        </div>
      </div>
    </div>
  );
}
