# Lara security model

Lara is a small personal operator with explicit tools and a durable workspace. It is not an unrestricted computer agent, a device-management system, or a guarantee that generated work is safe or correct. This document describes the intended boundaries and the limitations that remain.

## What is protected

Private workspace data includes conversations, memory, goals, artifact files, approval records, and recovery access. Every private API operation is associated with an authenticated workspace. Artifact publishing is an explicit action: a published link is readable by anyone who possesses it.

The hosted server and database administrator remain trusted. Workspace content is not end-to-end encrypted. Protect the hosting account, database credentials, and exported backups accordingly. The Recovery Kit is an access credential; it is different from a data backup.

## Access and recovery

Each workspace receives a cryptographically random 256-bit recovery key. The server stores its one-way hash, not the original key. Browser sessions use HttpOnly, SameSite cookies, with Secure cookies on HTTPS deployments. Recovery and workspace creation are rate-limited.

Keep the Recovery Kit somewhere independent of your usual device, such as an encrypted computer backup or a securely stored printed copy. Anyone with that key can recover the workspace. Lara has no email or phone fallback and cannot reconstruct a lost key. Signing in with a recovery key does not mean the browser, server, or hosting account is trustworthy.

Recovery-key replacement requires approval and invalidates other device sessions. Save the replacement kit immediately. An exported workspace backup contains private data and can be imported into a new workspace, but does not itself carry the sign-in credential.

## Approval and execution boundaries

Routine reading, building, drafting, and memory edits can run automatically. Publishing, unpublishing, memory deletion, and replacement of the recovery key require an explicit pending approval followed by a separate decision. Expired or already handled approvals are rejected. A memory-delete request is bound to the memory version that was reviewed.

Lara does not currently connect to email delivery, purchases, account settings, or a general shell. A conversational request cannot grant itself those capabilities. Neither website content nor generated artifact text is interpreted as an instruction to change permissions.

Queued goals and worker leases live in the database. Pause/cancel requests stop work cooperatively, abort network requests, and are checked again before an artifact is committed. This prevents a completed artifact from being committed after a cancelled goal. A process crash or free-host sleep can delay execution; it is not a continuously available service guarantee.

## Generated files

Private and published HTML is served under a restrictive content security policy and sandbox. Scripts may run in the artifact, but it receives an opaque origin and cannot read Lara cookies or call Lara APIs. External network connections, frames, plugins, and form submissions are blocked. The service worker must not cache private APIs or artifact content.

The built-in page and app builders generate known self-contained programs. Their tests cover document structure, JavaScript syntax, task state changes, integer-cent expense accounting, notes, timer behavior, and storage errors. This does not verify every browser, assistive technology, or possible prompt.

AI-generated HTML receives static structure and JavaScript parsing checks only. It is saved with `requiresReview: true`; interactive behavior remains explicitly unverified until it is opened and checked. Syntax is not proof of correct behavior. Downloaded standalone files run in the browser context where they are opened, so review them before supplying sensitive information. The generated document embeds a network-denying CSP in addition to the server's preview policy.

Standalone apps keep their own records in browser storage when that browser permits it. Sandboxed previews may deny storage; the app then shows an in-memory-only warning. Those local records are separate from Lara's server backup. Export them from the standalone app before changing devices. Destructive app actions use in-page confirmation, so they work without allowing modal dialogs in the sandbox.

Budget workbooks contain ordinary formulas and cached initial results. They do not contain macros, external workbook links, or executable scripts. Initial planned amounts are assumptions and actuals start at zero. Open in a spreadsheet application to recalculate after editing.

## Outbound network policy

Research and external security checks can read bounded public HTTPS text on port 443. The request layer:

- Rejects URL credentials, non-HTTPS schemes, alternate ports, local names, and local/reserved IP ranges.
- Normalizes URL numeric address forms before applying the address policy.
- Rejects IPv4-mapped IPv6, NAT64, 6to4, local IPv6, and reserved transition/documentation ranges.
- Rejects metadata/control addresses, including link-local metadata, carrier-grade NAT ranges, and Azure's platform IP `168.63.129.16`.
- Resolves all returned address records, rejects the whole result if any address is disallowed, and pins a validated address for the HTTPS socket to resist DNS rebinding.
- Requires certificate verification, validates every redirect, caps redirects at three, and limits response time and received bytes without trusting Content-Length.
- Accepts readable text types and avoids decompression bombs by requesting uncompressed content and rejecting unsupported compressed responses.

These restrictions are deliberately conservative and may reject some legitimate sources. They are not a network firewall or a substitute for host-level egress controls. A public source may itself be inaccurate or malicious. Research notes quote retrieved text with timestamps and response fingerprints; they do not treat those quotations as independently verified facts. Source-discovery queries and fetches are visible to the external providers.

## Authorized website security workflow

The supported external security action is a **passive review of one public HTTPS origin**. It is not a penetration test of arbitrary devices or networks.

1. Confirm that you own the website or have authorization for the specific origin.
2. Obtain your workspace's security challenge from Lara's goal interface.
3. Serve that exact token as a plain-text response at `https://your-origin/.well-known/lara-authorization.txt`.
4. The proof must return HTTP 200 directly over valid HTTPS. Redirects are not accepted. The token is checked against this workspace's server-held challenge.
5. Create the security goal with the HTTPS target and authorization confirmation.
6. Lara verifies the challenge, then makes one GET request to the origin root and records TLS/HTTP observations and security-header presence. It does not follow the root to a different origin.
7. Read the report, including missing or unassessed controls. Remove the public challenge file afterward if no further reviews are needed.

There is no port scanning, exploit execution, password guessing, authenticated crawling, denial-of-service testing, persistence, or security-setting change in this workflow. Header presence alone does not establish that a policy is effective. A completed review means the scoped report was generated, including any findings; it does not mean the target is secure.

The self-security review records **configured controls**, not independently audited results. It explicitly labels missing runtime information as unassessed. It does not replace access-control tests, dependency review, backup-restore exercises, or an independent assessment.

## Operational limitations

Free hosting can sleep, impose quotas, suspend inactive accounts, change terms, or become unavailable. A database must be genuinely persistent for device recovery to preserve data; an ephemeral free filesystem is insufficient. Keep independent data exports and exercise restoration. No app can promise zero vulnerabilities or perfect availability.

Browser voice recognition may send audio to the browser vendor's service, and support varies by device. Optional browser AI downloads a model and depends on the device's WebGPU, memory, and storage. Neither feature changes Lara's server-side approval boundaries.

Before exposing a deployment to more users, validate HTTPS/cookies and the configured public origin, audit dependencies, test cross-workspace access and approval replay, set resource limits, and document how to restore the database. Do not place credentials, Recovery Kits, or private exports in the source repository or public artifacts.
