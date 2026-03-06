import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import * as crypto from '../lib/crypto';

const API_URL = import.meta.env.VITE_API_URL || '/api';

type EncryptedData = {
  ciphertext: string;
  iv: string;
  salt?: string;
};

export default function ViewSecret() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsPassphrase, setNeedsPassphrase] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [encryptedData, setEncryptedData] = useState<EncryptedData | null>(null);

  useEffect(() => {
    retrieveSecret();
  }, [id]);

  const retrieveSecret = async () => {
    if (!id) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/secrets/${id}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('This secret does not exist or has already been viewed');
        }
        throw new Error('Failed to retrieve secret');
      }

      const data = await response.json();
      const keyFromUrl = crypto.parseKeyFromUrl();

      if (keyFromUrl) {
        const key = await crypto.importKey(keyFromUrl);
        const decrypted = await crypto.decrypt(data.ciphertext, data.iv, key);
        setSecret(decrypted);
        return;
      }

      if (data.salt) {
        setNeedsPassphrase(true);
        setEncryptedData({
          ciphertext: data.ciphertext,
          iv: data.iv,
          salt: data.salt,
        });
        return;
      }

      throw new Error('No decryption key available');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handlePassphraseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!passphrase || !encryptedData) {
      return;
    }

    setError(null);

    try {
      const decrypted = await crypto.decryptWithPassphrase(
        {
          ciphertext: encryptedData.ciphertext,
          iv: encryptedData.iv,
          salt: encryptedData.salt,
        },
        passphrase,
      );

      setSecret(decrypted);
      setNeedsPassphrase(false);
      setCopyStatus('idle');
    } catch {
      setError('Incorrect passphrase. Please try again.');
    }
  };

  const copyToClipboard = async () => {
    if (!secret) {
      return;
    }

    try {
      await navigator.clipboard.writeText(secret);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }
  };

  if (loading) {
    return (
      <section className="state-card view-layout reveal delay-2">
        <div className="state-center">
          <span className="spinner spinner-lg" />
          <p className="state-copy">Retrieving secret...</p>
        </div>
      </section>
    );
  }

  if (error && !needsPassphrase) {
    return (
      <section className="state-card view-layout reveal delay-2">
        <div className="not-found">
          <h1>Secret unavailable</h1>
          <h2>Link not found</h2>
          <p role="alert" aria-live="assertive">{error}</p>
          <a href="/" className="btn btn-primary">Create new secret</a>
        </div>
      </section>
    );
  }

  if (needsPassphrase && encryptedData) {
    return (
      <section className="state-card view-layout reveal delay-2">
        <div className="surface-header">
          <h1 className="surface-title">Passphrase required</h1>
          <p className="surface-subtitle">This secret is protected with a passphrase. Enter it to decrypt the content.</p>
        </div>

        {error && (
          <div className="alert alert-error" role="alert" aria-live="assertive">
            <span className="alert-label">Error</span>
            <span>{error}</span>
          </div>
        )}

        <form className="secret-form" onSubmit={handlePassphraseSubmit}>
          <div className="form-group">
            <label htmlFor="passphrase">Passphrase</label>
            <input
              type="password"
              id="passphrase"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Enter the passphrase"
              autoFocus
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-full">
            Decrypt Secret
          </button>
        </form>
      </section>
    );
  }

  if (secret) {
    return (
      <section className="state-card view-layout reveal delay-2">
        <div className="warning-banner">
          <span>This secret has been permanently deleted from the server</span>
        </div>

        <div className="surface-header">
          <h1 className="surface-title">Decrypted secret</h1>
          <p className="surface-subtitle">This message will not be shown again. Copy it now if needed.</p>
        </div>

        <div className="secret-display">{secret}</div>

        <button type="button" className="btn btn-primary btn-full" onClick={copyToClipboard}>
          Copy secret
        </button>

        {copyStatus !== 'idle' && (
          <p className={`inline-status ${copyStatus}`} role="status" aria-live="polite">
            {copyStatus === 'copied' ? 'Secret copied' : 'Copy failed'}
          </p>
        )}

        <div className="note-block">
          <p>
            <strong>Important:</strong> This secret has been burned from the server and cannot be retrieved again.
            Make sure you saved it if needed.
          </p>
        </div>

        <a href="/" className="btn btn-secondary btn-full">
          Create new secret
        </a>
      </section>
    );
  }

  return null;
}
