# CI/CD

This repository is set up for the simplest secure production deployment model for a Tailscale-only VPS:

1. GitHub Actions runs CI on GitHub-hosted runners.
2. After CI passes on `main`, GitHub Actions joins your Tailnet with Tailscale.
3. The deploy job SSHes to the VPS over Tailscale.
4. The VPS pulls the latest code, rebuilds with Docker Compose, restarts containers, and runs post-deploy verification.

Why this model:

- No inbound public SSH is required.
- Production secrets stay on the VPS in `.env`.
- GitHub only stores deploy transport secrets: Tailscale credentials, SSH key, host, and path.
- The deploy logic is auditable in version control.

## One-Time VPS Setup

Use a dedicated deploy user if possible.

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker deploy
sudo mkdir -p /opt/ots
sudo chown deploy:deploy /opt/ots
```

As the deploy user:

```bash
cd /opt/ots
git clone https://github.com/Ashref-dev/one-time-secret.git .
cp .env.example .env
# Edit .env with real production values
```

Generate an SSH keypair dedicated to GitHub Actions and add the public key to the deploy user's `~/.ssh/authorized_keys`.

## GitHub Environment Setup

Create a GitHub environment named `production` and put these values there:

- `TS_OAUTH_CLIENT_ID`
- `TS_OAUTH_SECRET`
- `PROD_SSH_PRIVATE_KEY`
- `PROD_SSH_KNOWN_HOSTS`
- `PROD_HOST`
- `PROD_USER`
- `PROD_APP_DIR`

Recommended values:

- `PROD_HOST`: the VPS MagicDNS name or Tailscale IP
- `PROD_USER`: `deploy`
- `PROD_APP_DIR`: `/opt/ots`

Recommended hardening:

- Restrict the Tailscale OAuth client to `tag:ci`
- Add a Tailnet policy allowing `tag:ci` to reach the VPS on SSH only
- Add required reviewers to the `production` environment if you want a human approval gate

## Generating `PROD_SSH_KNOWN_HOSTS`

Run from a machine that can reach the VPS over Tailscale:

```bash
ssh-keyscan -H aspire.tailnet-name.ts.net
```

Store the output as the `PROD_SSH_KNOWN_HOSTS` secret.

## Secrets That Must Not Go To GitHub

Keep these only on the VPS:

- application `.env`
- database passwords
- any runtime credentials used by the containers

## Deploy Flow

On every push to `main`:

1. `.github/workflows/ci.yml` runs build/test checks
2. `.github/workflows/deploy-production.yml` starts only after CI succeeds
3. The runner connects to Tailscale
4. It SSHes to the VPS and runs `scripts/deploy-vps.sh`

## Notes

- This repo currently uses targeted backend tests in CI because the full `go test ./...` suite depends on a Testcontainers/Docker stack that is not stable in GitHub-hosted runners with the current dependency set.
- If you later want zero-SSH deployment, the next step up would be a self-hosted GitHub Actions runner on the VPS. That is more moving parts, not less.
