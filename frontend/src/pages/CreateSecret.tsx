import React, { useState } from 'react';
import * as crypto from '../lib/crypto';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const EXPIRY_OPTIONS = [
  { value: 86400, label: '1 day' },
  { value: 21600, label: '6 hours' },
  { value: 3600, label: '1 hour' },
  { value: 900, label: '15 minutes' },
  { value: 300, label: '5 minutes' },
];
const MAX_SECRET_SIZE = 32768;

export default function CreateSecret() {
  const [secret, setSecret] = useState('');
  const [expiry, setExpiry] = useState(86400);
  const [usePassphrase, setUsePassphrase] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!secret.trim()) {
      setError('Please enter a secret to share');
      return;
    }

    if (usePassphrase && !passphrase.trim()) {
      setError('Please enter a passphrase');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setCopyStatus('idle');

    try {
      let encryptedData: crypto.EncryptedData;
      let key: string | null = null;

      if (usePassphrase) {
        // Encrypt with passphrase
        encryptedData = await crypto.encryptWithPassphrase(secret, passphrase);
      } else {
        // Generate random key and encrypt
        const cryptoKey = await crypto.generateKey();
        encryptedData = await crypto.encrypt(secret, cryptoKey);
        key = await crypto.exportKey(cryptoKey);
      }

      // Store on server
      const response = await fetch(`${API_URL}/secrets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ciphertext: encryptedData.ciphertext,
          iv: encryptedData.iv,
          salt: encryptedData.salt,
          expires_in: expiry,
          burn_after_read: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to store secret');
      }

      const { id } = await response.json();

      // Generate shareable URL
      const url = key 
        ? crypto.generateShareableUrl(id, key)
        : `${window.location.origin}/s/${id}`;

      setResult({ url });
      setCopyStatus('idle');
      
      // Clear form
      setSecret('');
      setPassphrase('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (result) {
      try {
        await navigator.clipboard.writeText(result.url);
        setCopyStatus('copied');
      } catch {
        // Fallback
        const input = document.createElement('input');
        input.value = result.url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        setCopyStatus('copied');
      }
    }
  };

  return (
    <div className="create-layout">
      <section className="card card-hero">
        <h1 className="card-title">Share a secret</h1>
        <p className="card-subtitle">
          Paste a password, key, or sensitive information. It stays encrypted in your browser and can be viewed once.
        </p>

        {error && (
          <div className="alert alert-error" role="alert" aria-live="assertive">
            <span className="alert-label">Error</span>
            <span>{error}</span>
          </div>
        )}

        {result ? (
          <div className="result">
            <div className="result-title">Secret ready to share</div>
            <p className="result-text">
              Share this link with the recipient. It will only work once.
            </p>
            <div className="url-display">{result.url}</div>
            <button
              className="btn btn-primary btn-full"
              onClick={copyToClipboard}
            >
              Copy link
            </button>
            {copyStatus !== 'idle' && (
              <p className={`inline-status ${copyStatus}`} role="status" aria-live="polite">
                {copyStatus === 'copied' ? 'Link copied' : 'Copy failed'}
              </p>
            )}
            <button
              className="btn btn-secondary btn-full"
              style={{ marginTop: '0.5rem' }}
              onClick={() => {
                setResult(null);
                setCopyStatus('idle');
              }}
            >
              Create another secret
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="secret">Your secret</label>
              <textarea
                id="secret"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Paste your secret here..."
                maxLength={MAX_SECRET_SIZE}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="none"
                required
              />
              <div className="char-count" aria-live="polite">
                {secret.length} / {MAX_SECRET_SIZE}
              </div>
            </div>

            <div className="options">
              <div className="option">
                <label htmlFor="expiry">Expires after</label>
                <select
                  id="expiry"
                  value={expiry}
                  onChange={(e) => setExpiry(Number(e.target.value))}
                  aria-describedby="expiry-help"
                >
                  {EXPIRY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="helper-text" id="expiry-help">Default: 1 day.</p>
              </div>

              <div className="option">
                <label htmlFor="passphrase-toggle">Passphrase</label>
                <label className="switch">
                  <input
                    id="passphrase-toggle"
                    type="checkbox"
                    checked={usePassphrase}
                    onChange={(e) => setUsePassphrase(e.target.checked)}
                    aria-label="Require passphrase"
                  />
                  <span className="switch-track" aria-hidden="true" />
                  <span className="switch-text">Require passphrase</span>
                </label>
              </div>
            </div>

            <div className="form-group passphrase-field" data-active={usePassphrase}>
              <label htmlFor="passphrase">Passphrase</label>
              <input
                type="password"
                id="passphrase"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Enter a strong passphrase"
                required={usePassphrase}
                disabled={!usePassphrase}
                autoComplete="new-password"
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="none"
                aria-describedby="passphrase-help"
              />
              <p className="helper-text" id="passphrase-help">
                Share this passphrase separately from the link for extra security.
              </p>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="spinner" />
                  Encrypting & Creating...
                </>
              ) : (
                'Create secret link'
              )}
            </button>
          </form>
        )}
      </section>

      <aside className="side-panel">
        <div className="info-section compact">
          <h3>How it works</h3>
          <ul>
            <li>Your secret is encrypted in your browser before it is sent to the server.</li>
            <li>The encryption key never leaves your device (it is stored in the URL fragment).</li>
            <li>Secrets can be viewed once and expire automatically.</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
