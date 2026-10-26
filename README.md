# Suron — self-hosted OSINT platform

> _One Eye to find them._

Suron bundles several OSINT tools behind a single modern web UI in one Docker
container, designed to be served at **osint.alt-dev.com** through a Cloudflare
tunnel. Deep-blue Mordor theme, passkey-only authentication.

## What's inside

| Capability | Backed by |
|---|---|
| Username hunting across ~480 sites | [Sherlock](https://github.com/sherlock-project/sherlock) |
| Target site crawling (URLs, endpoints, intel, secrets) | [Photon](https://github.com/s0md3v/Photon) |
| Searchable index of ~1,400 curated OSINT resources | [awesome-osint](https://github.com/jivoi/awesome-osint) |

Stack: Next.js 15 (App Router, standalone output), SQLite (better-sqlite3),
Tailwind CSS v4, @simplewebauthn. Scans run as sandboxed subprocesses with
hard kill-timeouts; results persist as jobs you can revisit.

## Authentication model

- **No stored passwords, ever.** `SETUP_PASSWORD` (env var) gates the one-time
  `/setup` page: it creates the single admin account and registers a passkey in
  the same flow. The password is compared in constant time and never written
  anywhere.
- After setup, login is **passkey-only** (WebAuthn, discoverable credentials).
  Sessions are httpOnly cookies backed by a server-side session table (7-day TTL).
- Every API route and page is gated server-side.

## Quick start (production)

```bash
cp .env.example .env     # set SETUP_PASSWORD and CLOUDFLARE_TUNNEL_TOKEN
docker compose up -d --build
```

Then in Cloudflare Zero Trust → Networks → Tunnels, point the tunnel's public
hostname `osint.alt-dev.com` at `http://suron:3000`. The app publishes no host
ports — traffic only enters through the tunnel. Visit the site once to run
setup and register your passkey.

> WebAuthn requires a secure context: the RP defaults (`RP_ID=osint.alt-dev.com`,
> `RP_ORIGIN=https://osint.alt-dev.com`) are set in docker-compose.yml and must
> match the public hostname.

### Reusing an existing tunnel (host port 3000 is taken)

On 192.168.1.10, host port 3000 already belongs to Semaphore's UI
(`semaphore.dunwoody.alt-dev.com`). Suron's default setup never touches host
ports — the bundled cloudflared reaches it at `http://suron:3000` on the
compose network, which cannot conflict. To skip the bundled tunnel and reuse
the existing one instead, on the deploy host:

```bash
cp docker-compose.hostport.example.yml docker-compose.override.yml
echo 'CLOUDFLARE_TUNNEL_TOKEN=' >> .env   # empty = bundled tunnel stays off
```

Suron then publishes host port **3001** (`SURON_HOST_PORT` to change it); add
a public hostname `osint.alt-dev.com → http://192.168.1.10:3001` on the
existing tunnel. Both files are untracked, so redeploys leave them alone, and
`RP_ID`/`RP_ORIGIN` stay unchanged — the public hostname is what matters, not
the internal port.

## Local development

```bash
npm install
make tools               # or: git clone the three repos into tools/
npm run build:resources  # parse awesome-osint into lib/generated/resources.json
SETUP_PASSWORD=devpw npm run dev
```

`localhost` is a valid WebAuthn RP, so passkeys work in dev without TLS.
Sherlock/Photon scans need the tools installed locally (see Dockerfile for the
exact pip installs) or just test those inside the container.

## Deployment via Semaphore

`deploy/deploy-suron_osint.yml` is an Ansible playbook for manual runs from
Semaphore. Copy (or sync) it into the playbook repo at
`/home/alter/dev/Dunwoody-Estates-Home` on 192.168.1.10. It:

1. clones/updates this repo on the target (`suron_dir`, default `/opt/suron`)
2. renders `.env` on first deploy from the Semaphore **Service-Variables**
   group if `suron_setup_password` is defined there (mode 0600, `no_log`);
   an existing `.env` is never touched, and without the variable it must
   already exist on the host
3. drops the host-port override for Nginx Proxy Manager (port
   `suron_host_port`, default 3001) unless `suron_bundled_tunnel=true`
4. `docker compose build --pull && docker compose up -d --remove-orphans`
5. health-checks `/api/auth/state` inside the container and prints a recap

Zero-touch first deploy: add `suron_setup_password` to the Service-Variables
group (and nothing else — the bundled tunnel stays off and NPM fronts host
port 3001). Don't point `suron_cloudflared_token` at the existing
`cloudflared_tunnel_token`; that token belongs to the dunwoody tunnel.

The play targets the inventory group `suron` by default — add exactly one
Docker host to that group in the inventory repo, or pass
`suron_hosts=<host-or-group>` as a Semaphore extra var. Never point it at
`all`: Suron is single-instance (one tunnel token, one admin), and on a mixed
inventory any host without Docker fails the preflight assert and
`any_errors_fatal` aborts the whole run. Also override
`suron_repo` / `suron_branch` / `suron_dir` as extra vars if needed.

## Repo layout

```
app/                  Next.js routes (pages + API)
components/           Dashboard, resource explorer, shell
lib/                  db, auth/WebAuthn, job runner, tool wrappers
scripts/              awesome-osint README → resources.json parser
tools/                local clones of the three upstream repos (gitignored)
deploy/               Semaphore/Ansible playbook
Dockerfile            multi-stage: node build + python tool runtime
docker-compose.yml    suron + cloudflared (token-based tunnel)
```

## Operational notes

- **Data** lives in the `suron-data` volume (`/data`): SQLite DB + raw Photon
  job output.
- **Job limits**: scans are killed after 5 minutes; results over 2 MB are
  truncated per-list. Sherlock runs with `--local` (bundled site list, no
  startup fetch) and a 10 s per-site timeout.
- **Photon flags to avoid** (`--dns`, `--wayback`, `--clone`, `--headers`) are
  never passed — several are broken upstream or hang in a server context.
- Use this against targets you are authorized to investigate.
