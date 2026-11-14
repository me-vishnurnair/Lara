# Lara

A self-hostable personal operator: a responsive installable web app, durable goal worker, private artifacts, editable memory, and recovery without a phone. No paid AI API is required.

## Run

Node.js 22.13+ (24 LTS recommended):

```sh
npm ci
npm run build
npm start
```

Open `http://localhost:3000`. Local development stores data in `data/lara.sqlite`. Create a workspace and save its **Recovery Kit** somewhere accessible if this device is lost. A Recovery Kit grants account access; keep it private. Export a separate data backup from Settings to recover from a hosting/database loss.

Production requires `DATABASE_URL` for PostgreSQL and HTTPS. The app deliberately refuses to store production recovery data on ephemeral SQLite. See [deployment notes](docs/DEPLOYMENT.md) and [.env.example](.env.example). Never commit `.env` files.

## What works

- Built-in conversational operator: create work, remember facts, report goal status, pause/cancel/resume, and prepare exact approvals. Saved conversation and memory survive sessions. This mode uses explicit tools and intent routing rather than an external language model.
- Optional **on-device AI**: Settings → Enable on-device AI downloads an open SmolLM2 model. Supported WebGPU browsers can have broader conversations and generate custom single-file HTML apps/pages. Prompts run locally; conversation history is saved in the workspace. The small model has limited reasoning/coding ability. No API key is used. Voice dictation uses the browser's speech facility, which may send audio to its provider; microphone input is always explicit.
- Durable goals: plan/do/check traces, pause/stop controls, leases and restart recovery. Jobs run in the server even if the browser disconnects while the server stays available.
- Real outputs: responsive HTML pages, interactive task/expense/notes/focus apps, four-sheet Excel budgets with working formulas, cited extractive research notes fetched from HTTPS sources, and security configuration reports.
- Exact, expiring, one-use approvals for publishing, unpublishing, memory deletion and recovery-key rotation. Unsupported send/pay/device-management integrations are not simulated.
- Memory editing, JSON backup export/import, and independent access recovery. Imports merge without overwriting current work; imported goals are paused and their previous verification is not trusted.

Built-in workflow checks include artifact structure, HTML escaping, executable script syntax, formula round trips and source retrieval evidence. Automated test coverage exercises app behavior and budget calculations. AI-generated custom code remains a **draft** until the owner opens it, tests its behavior, and records the result. That evidence is explicitly labeled manual.

## Security scope

Lara performs a self-configuration review and a non-destructive review of public HTTPS sites you control. External targets must serve a per-workspace ownership token. It does not exploit arbitrary devices, execute shell commands from prompts, or bypass authentication. See [security boundaries and authorized-target setup](docs/SECURITY.md).

Sessions use HttpOnly, SameSite cookies; recovery credentials are random 256-bit bearer keys stored only as hashes. Private artifact routes enforce ownership. HTML artifacts run under a restricted CSP sandbox; download standalone apps to use persistent local browser storage. Files and backups are stored in the configured database, not encrypted end-to-end against the server administrator.

## Verify

```sh
npm test
npm run check
```

The tests cover persistence/recovery, tenant isolation, CSRF, approvals, pause/cancel races, forged imports, SSRF/DNS/redirect restrictions, actual template app interactions and spreadsheet formulas. Passing tests do not establish perfect security or prove every possible generated app correct.

## Free hosting limits

Use a Render **Free** web service with a Neon **Free** PostgreSQL project. Never use Render's expiring free PostgreSQL for recovery data. No paid APIs, upgrades, paid workers or disks are required.

Render sleeps after 15 idle minutes and can take about a minute to wake. Its 750 free server hours are shared by every free service in the workspace. A server that is asleep cannot run jobs; saved work resumes when it wakes. Neon and Render impose free usage limits. Do not attach a payment method or enable paid overages if zero spend is essential; configure build spending to zero. This is useful free hosting, not an unlimited always-on service.

Default capacity is 20 workspaces, 100 goals and 20 MB of artifacts per workspace. There is no paid usage escalation in Lara. Keep backups outside the hosting accounts.
