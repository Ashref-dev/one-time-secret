# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Security Features

This application implements multiple layers of security:

### Encryption
- **Client-side encryption** using AES-256-GCM in the browser
- **Zero-knowledge architecture**: Server never sees plaintext or encryption keys
- Keys are stored in URL fragments (never sent to server)
- Optional passphrase-based encryption with PBKDF2 key derivation

### Data Handling
- Secrets are deleted immediately after first access (atomic consume)
- Automatic expiration after configurable TTL (5 min - 24 hours)
- No plaintext logging of secrets
- Row-level database locking prevents race conditions

### Infrastructure
- Security headers (CSP, HSTS, X-Frame-Options, etc.)
- Rate limiting (configurable, default 30 req/min)
- Input validation and sanitization
- SQL injection prevention via parameterized queries

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not** open a public issue.

Instead, please email security concerns to: [your-security-email@example.com]

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

You can expect:
- Acknowledgment within 48 hours
- Assessment within 7 days
- Fix timeline communication
- Credit in the release notes (if desired)

## Security Best Practices for Users

1. **Use HTTPS**: Always deploy with TLS enabled
2. **Strong Passphrases**: If using passphrase protection, use strong, unique passphrases
3. **Separate Channels**: Share the link and passphrase through different channels
4. **Verify Recipients**: Ensure you're sharing with the intended recipient
5. **Monitor Access**: Check logs for unauthorized access attempts

## Dependencies

We regularly update dependencies to address security vulnerabilities. Run:

```bash
# Backend
cd backend
go list -u -m all

# Frontend
cd frontend
npm audit
```

## Disclosure Policy

We follow responsible disclosure practices:
- Vulnerabilities are addressed promptly
- Users are notified of security updates
- Credit is given to security researchers
- Details are disclosed after fixes are deployed