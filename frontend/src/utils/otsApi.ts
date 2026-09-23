/* Typed client for the OTS Go backend. */

const API_URL = import.meta.env.VITE_API_URL || '/api';

export interface CreateSecretPayload {
  ciphertext: string;
  iv: string;
  salt?: string;
  expires_in: number;
  burn_after_read: boolean;
}

export async function createSecret(payload: CreateSecretPayload): Promise<{ id: string }> {
  const res = await fetch(`${API_URL}/secrets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Create failed (${res.status})`);
  }
  return res.json();
}

export async function fetchSecret(id: string): Promise<{ ciphertext: string; iv: string; salt?: string }> {
  const res = await fetch(`${API_URL}/secrets/${encodeURIComponent(id)}`);
  if (res.status === 404) throw new Error('GONE');
  if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
  return res.json();
}

export async function burnSecret(id: string): Promise<void> {
  await fetch(`${API_URL}/secrets/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
}
