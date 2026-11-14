# Lara deployment and recovery

Lara needs a server and a durable PostgreSQL database in production. The server deliberately refuses to start in production without `DATABASE_URL`; a temporary cloud disk must never silently become the recovery database.

## Free hosting choice

Use a **Render Free web service** with a **Neon Free PostgreSQL project**. Keep the database on Neon's Free plan and the Render service on the `free` compute plan. Do not add paid disks, workers, scheduled services, or paid AI APIs.

Current provider limits were checked on 14 November 2026:

- Render Free has 0.1 CPU and 512 MB RAM. It sleeps after 15 minutes without incoming traffic and restarts on a later request. Its local files disappear on restarts or redeploys. The workspace shares 750 free instance hours monthly across its free web services. These limits mean Lara cannot promise continuous background execution. [Render Free documentation](https://render.com/docs/free)
- Render's free PostgreSQL expires after 30 days; free Key Value loses data on restart. Neither is suitable for Lara's durable recovery state. [Render Free datastores](https://render.com/docs/free#free-postgres)
- Neon Free has no time limit or credit-card requirement. The current allowance is 1 GB storage and 100 CU-hours per project monthly, with 5 GB of public network transfer. Idle compute scales to zero. [Neon pricing](https://neon.com/pricing), [Neon plans](https://neon.com/docs/introduction/plans)
- Render bandwidth and build overages can incur charges when the hosting account has a payment method. A free compute plan alone does not establish an account-wide spending cap. Keep build spending at zero and review workspace billing limits. Without a payment method, excess usage suspends the affected free capabilities. [Render usage limits](https://render.com/docs/free#monthly-usage-limits)

The free deployment is appropriate for a personal workload within these quotas. Neither provider promises unlimited capacity or uninterrupted service on the free plan. Do not add artificial keep-alive traffic to defeat provider sleep limits.

## Server configuration

Set these values in the hosting dashboard or through the provider's secret configuration:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | The PostgreSQL connection string; keep secret and out of Git |
| `DATABASE_SSL` | `true` for a public Neon database |
| `PUBLIC_ORIGIN` | Lara's exact HTTPS origin, without a trailing slash |
| `TRUST_PROXY` | `1` on Render |
| `MAX_ACCOUNTS` | `20` or fewer for a small personal installation |

Lara requires Node.js 22.13 or newer. The start command is `npm start`. Use the repository's locked package installation and asset build before starting. The HTTP readiness endpoint is `/healthz`; configure it as the Render HTTP health-check path. The server listens on the provider's `PORT` and `0.0.0.0`.

Check that a specific deployment reaches the provider's `live` state, then verify the real HTTPS URL. A queued or successful build is not proof that the server is reachable. [Render deployment lifecycle](https://render.com/docs/deploys), [HTTP health checks](https://render.com/docs/health-checks)

## Deployment verification

1. Open the public HTTPS app and confirm `/healthz` reports PostgreSQL.
2. Create a workspace and save its Recovery Kit outside that device.
3. Run a starter goal; open its artifact and inspect its verification evidence.
4. Add memory, sign out, and recover in a separate browser session using the kit.
5. Confirm the same memory, goals, and artifacts reappear.
6. Export a data backup and import it into a separate workspace. Imported goals remain paused, imported artifacts remain private, and old completion claims are not trusted.
7. Restart or redeploy the server and verify that the saved data remains available.

## Two different recovery files

The **Recovery Kit** contains the secret that signs into an existing workspace. Anyone holding it can access that workspace; keep it private in an independent location such as a password manager, encrypted drive, or printed offline copy. It does not rely on a phone or email.

A **data backup** contains memory, chat, goals, and artifact contents. It restores the data if the hosting database is lost. Save this separately and periodically; a Recovery Kit cannot recover a deleted database. Imported artifacts are isolated and private, and imported goals do not automatically execute.

Rotate the recovery key through Settings after a device is lost. Approval replaces the old key and revokes other sessions. Save the new kit immediately. Logout only ends the current session.

## Operational limits

The server uses leased goals and transactional completion: a paused, cancelled, or superseded run cannot commit a completed artifact. After process interruption, unfinished goals can be reclaimed and rebuilt, then verified again. Long-running tasks depend on the free server remaining awake.

The built-in operator executes bounded artifact builders and scoped security reviews. Optional local AI depends on the device's browser and available memory. It does not create a paid API dependency. HTTPS reviews require target ownership verification and do not provide arbitrary device access or exploit execution.

Keep provider credentials out of recovery kits, exports, Git, and application chat. The app's recovery key is unrelated to the hosting provider's database credential.
