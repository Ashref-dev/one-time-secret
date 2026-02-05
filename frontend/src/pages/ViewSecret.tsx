import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import * as crypto from '../lib/crypto';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function ViewSecret() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsPassphrase, setNeedsPassphrase] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [encryptedData, setEncryptedData] = useState<{
    ciphertext: string;
    iv: string;
    salt?: string;
  } | null>(null);

  useEffect(() => {
    retrieveSecret();
  }, [id]);

  const retrieveSecret = async () => {
    if (!id) return;

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

      // Check if we have a key in the URL fragment (client-side encryption)
      const keyFromUrl = crypto.parseKeyFromUrl();

      if (keyFromUrl) {
        // Decrypt with key from URL
        const key = await crypto.importKey(keyFromUrl);
        const decrypted = await crypto.decrypt(data.ciphertext, data.iv, key);
        setSecret(decrypted);
      } else if (data.salt) {
        // Need passphrase to decrypt
        setNeedsPassphrase(true);
        setEncryptedData({
          ciphertext: data.ciphertext,
          iv: data.iv,
          salt: data.salt,
        });
      } else {
        throw new Error('No decryption key available');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handlePassphraseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!passphrase || !encryptedData) return;

    try {
      const decrypted = await crypto.decryptWithPassphrase(
        {
          ciphertext: encryptedData.ciphertext,
          iv: encryptedData.iv,
          salt: encryptedData.salt,
        },
        passphrase
      );
      setSecret(decrypted);
      setNeedsPassphrase(false);
    } catch {
      setError('Incorrect passphrase. Please try again.');
    }
  };

  const copyToClipboard = async () => {
    if (secret) {
      try {
        await navigator.clipboard.writeText(secret);
        alert('Secret copied to clipboard!');
      } catch {
        alert('Failed to copy. Please select and copy manually.');
      }
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div style={{ textAlign: 'center', padding: '3rem 0' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem', width: '40px', height: '40px' }} />
          <p style={{ color: 'var(--text-muted)' }}>Retrieving secret...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="not-found">
          <h1>🔒</h1>
          <h2>Secret Unavailable</h2>
          <p>{error}</p>
          <a href="/" className="btn btn-primary" style={{ marginTop: '1rem' }}>
            Create New Secret
          </a>
        </div>
      </div>
    );
  }

  if (needsPassphrase && encryptedData) {
    return (
      <div className="card">
        <h1 className="card-title">🔐 Passphrase Required</h1>
        <p className="card-subtitle">
          This secret is protected with a passphrase. Enter it to decrypt the content.
        </p>

        {error && (
          <div className="alert alert-error">
            <span>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handlePassphraseSubmit}>
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
      </div>
    );
  }

  if (secret) {
    return (
      <div className="card">
        <div className="warning-banner">
          <span>⚠️</span>
          <span>This secret has been permanently deleted from the server</span>
        </div>

        <h1 className="card-title">🔓 Decrypted Secret</h1>
        <p className="card-subtitle">
          This message will not be shown again. Copy it now if needed.
        </p>

        <div className="secret-display">{secret}</div>

        <button 
          className="btn btn-primary btn-full"
          onClick={copyToClipboard}
          style={{ marginTop: '1rem' }}
        >
          📋 Copy Secret
        </button>

        <div className="info-section" style={{ marginTop: '1.5rem' }}>
          <p>
            <strong>Important:</strong> This secret has been burned (deleted) from our servers. 
            It cannot be retrieved again. Make sure you've copied it if needed.
          </p>
        </div>

        <a 
          href="/" 
          className="btn btn-secondary btn-full"
          style={{ marginTop: '1rem' }}
        >
          Create New Secret
        </a>
      </div>
    );
  }

  return null;
}