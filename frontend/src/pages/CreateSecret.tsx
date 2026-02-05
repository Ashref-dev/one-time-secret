import React, { useState } from 'react';
import * as crypto from '../lib/crypto';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const EXPIRY_OPTIONS = [
  { value: 300, label: '5 minutes' },
  { value: 900, label: '15 minutes' },
  { value: 3600, label: '1 hour' },
  { value: 21600, label: '6 hours' },
  { value: 86400, label: '1 day' },
];

export default function CreateSecret() {
  const [secret, setSecret] = useState('');
  const [expiry, setExpiry] = useState(3600);
  const [usePassphrase, setUsePassphrase] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        alert('Link copied to clipboard!');
      } catch {
        // Fallback
        const input = document.createElement('input');
        input.value = result.url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        alert('Link copied to clipboard!');
      }
    }
  };

  return (
    <div className="card">
      <h1 className="card-title">Share a Secret</h1>
      <p className="card-subtitle">
        Paste a password, key, or any sensitive information. It will be encrypted in your browser 
        and can only be viewed once.
      </p>

      {error && (
        <div className="alert alert-error">
          <span>⚠️</span> {error}
        </div>
      )}

      {result ? (
        <div className="result">
          <div className="result-title">✅ Secret Ready to Share</div>
          <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            Share this link with the recipient. It will only work once.
          </p>
          <div className="url-display">{result.url}</div>
          <button 
            className="btn btn-primary btn-full"
            onClick={copyToClipboard}
          >
            📋 Copy Link
          </button>
          <button 
            className="btn btn-secondary btn-full"
            style={{ marginTop: '0.5rem' }}
            onClick={() => setResult(null)}
          >
            Create Another Secret
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="secret">Your Secret</label>
            <textarea
              id="secret"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Paste your secret here..."
              maxLength={32768}
              required
            />
          </div>

          <div className="options">
            <div className="option">
              <label htmlFor="expiry">Expires After</label>
              <select
                id="expiry"
                value={expiry}
                onChange={(e) => setExpiry(Number(e.target.value))}
              >
                {EXPIRY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="option">
              <label>Protection</label>
              <label className="checkbox-wrapper">
                <input
                  type="checkbox"
                  checked={usePassphrase}
                  onChange={(e) => setUsePassphrase(e.target.checked)}
                />
                <span>Require passphrase</span>
              </label>
            </div>
          </div>

          {usePassphrase && (
            <div className="form-group">
              <label htmlFor="passphrase">Passphrase</label>
              <input
                type="password"
                id="passphrase"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Enter a strong passphrase"
                required={usePassphrase}
              />
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                Share this passphrase separately from the link for extra security.
              </p>
            </div>
          )}

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
              '🔐 Create Secret Link'
            )}
          </button>
        </form>
      )}

      <div className="info-section">
        <h3>🔒 How it works</h3>
        <ul>
          <li>Your secret is encrypted in your browser using AES-256-GCM before being sent to the server</li>
          <li>The encryption key never leaves your device (it's in the URL fragment)</li>
          <li>Secrets can only be viewed once and automatically expire after the set time</li>
          <li>Even if someone gains access to the server, they cannot read your secrets</li>
        </ul>
      </div>
    </div>
  );
}