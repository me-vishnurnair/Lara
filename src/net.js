import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const MAX_BYTES = 768 * 1024;
const TIMEOUT_MS = 12000;

/** Conservative public-address policy. Documentation and transition ranges are not targets. */
export function isPublicAddress(input) {
  const address = String(input).replace(/^\[|\]$/g, '').toLowerCase();
  const family = isIP(address);
  if (family === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (address === '168.63.129.16') || // Azure host/platform control endpoint, despite its public-looking address.
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 192 && b === 0 && (c === 0 || c === 2)) ||
      (a === 192 && b === 88 && c === 99) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113));
  }
  if (family !== 6 || address.includes('.') || address.includes('%')) return false;
  const [left, right = ''] = address.split('::');
  const first = left ? left.split(':') : [];
  const last = right ? right.split(':') : [];
  const groups = address.includes('::') ? [...first, ...Array(8 - first.length - last.length).fill('0'), ...last] : first;
  const words = groups.map(part => parseInt(part, 16));
  if (words.length !== 8 || words[0] < 0x2000 || words[0] > 0x3fff) return false;
  if (words[0] === 0x2002 || (words[0] === 0x3fff && words[1] < 0x1000)) return false;
  if (words[0] === 0x2001 && (words[1] === 0 || words[1] === 2 || words[1] === 0xdb8 ||
    (words[1] >= 0x10 && words[1] <= 0x2f))) return false;
  return true;
}

export function validatePublicUrl(input) {
  let url;
  try { url = new URL(input); } catch { throw new Error('Use a complete public HTTPS URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) {
    throw new Error('Only public HTTPS URLs on port 443 without credentials are supported.');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
    host.endsWith('.internal') || host.endsWith('.test') || host.endsWith('.invalid') ||
    (!isIP(host) && !host.includes('.')) || (isIP(host) && !isPublicAddress(host))) {
    throw new Error('Private, local, reserved, or metadata addresses are not allowed.');
  }
  url.hash = '';
  return url;
}

export function validateResolvedAddresses(records) {
  if (!Array.isArray(records) || !records.length || records.some(record => !record ||
    !isPublicAddress(record.address) || isIP(record.address) !== record.family)) {
    throw new Error('The target resolves to a private, reserved, or disallowed address.');
  }
  return records.map(record => ({ address: record.address, family: record.family })).sort((a, b) => a.family - b.family);
}

export function validateRedirect(location, base) {
  let resolved;
  try { resolved = new URL(location, base); } catch { throw new Error('The source returned an invalid redirect.'); }
  return validatePublicUrl(resolved.href);
}

async function publicResolution(host, signal) {
  if (isIP(host)) return [{ address: host, family: isIP(host) }];
  let abortListener;
  const aborted = new Promise((_, reject) => {
    abortListener = () => reject(signal.reason || new Error('Request cancelled.'));
    signal.addEventListener('abort', abortListener, { once: true });
    if (signal.aborted) abortListener();
  });
  try {
    const records = await Promise.race([lookup(host, { all: true, verbatim: true }), aborted]);
    // Pin one validated address for the socket; a second DNS lookup cannot rebind the target.
    return validateResolvedAddresses(records);
  } finally { signal.removeEventListener('abort', abortListener); }
}

async function requestOnce(url, { signal, limit, timeoutMs, accept }) {
  const controller = new AbortController();
  const forwardAbort = () => controller.abort(signal.reason || new Error('Request cancelled.'));
  if (signal) {
    signal.addEventListener('abort', forwardAbort, { once: true });
    if (signal.aborted) forwardAbort();
  }
  const timer = setTimeout(() => controller.abort(new Error('The HTTPS request timed out.')), timeoutMs);
  timer.unref?.();
  try {
    const host = url.hostname.replace(/^\[|\]$/g, '');
    const records = await publicResolution(host, controller.signal);
    return await new Promise((resolve, reject) => {
      const req = https.request(url, {
        method: 'GET', signal: controller.signal, agent: false, rejectUnauthorized: true,
        headers: { 'User-Agent': 'Lara/1.0 (user-requested research and passive checks)', Accept: accept, 'Accept-Encoding': 'identity' },
        lookup: (_hostname, options, callback) => {
          if (options?.all) callback(null, [records[0]]);
          else callback(null, records[0].address, records[0].family);
        },
      }, res => {
        const headers = res.headers;
        const status = res.statusCode || 0;
        const tlsAuthorized = Boolean(res.socket?.authorized);
        const tlsProtocol = res.socket?.getProtocol?.() || 'TLS';
        const declared = Number(headers['content-length'] || 0);
        if (declared > limit) { res.destroy(); reject(new Error('Source is too large to read safely.')); return; }
        const type = String(headers['content-type'] || 'text/plain').split(';')[0].trim().toLowerCase();
        const allowed = type.startsWith('text/') || /^(application\/(json|ld\+json|xml|xhtml\+xml))$/.test(type);
        if (status >= 200 && status < 300 && !allowed) {
          res.destroy(); reject(new Error('Only text, HTML, XML, and JSON sources can be read.')); return;
        }
        if (headers['content-encoding'] && headers['content-encoding'] !== 'identity') {
          res.destroy(); reject(new Error('The source requires an unsupported compressed response.')); return;
        }
        const chunks = [];
        let bytes = 0;
        res.on('data', chunk => {
          bytes += chunk.length;
          if (bytes > limit) { res.destroy(new Error('Source is too large to read safely.')); return; }
          chunks.push(chunk);
        });
        res.once('error', reject);
        res.once('end', () => resolve({
          url: url.href, status, headers, text: Buffer.concat(chunks).toString('utf8'), bytes,
          tlsAuthorized, tlsProtocol,
        }));
      });
      req.once('error', error => reject(controller.signal.aborted ? controller.signal.reason : error));
      req.end();
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }
}

/** Read public text over validated TLS. Redirects re-run URL, DNS and IP checks. */
export async function safeFetchText(input, options = {}) {
  const { signal, accept = 'text/html,application/json,text/plain;q=0.9,*/*;q=0.1' } = options;
  const maxRedirects = Math.max(0, Math.min(Number.isInteger(options.maxRedirects) ? options.maxRedirects : 3, 3));
  const limit = Math.max(128, Math.min(Number(options.limit) || MAX_BYTES, 2 * 1024 * 1024));
  const timeoutMs = Math.max(1000, Math.min(Number(options.timeoutMs) || TIMEOUT_MS, 20000));
  let url = validatePublicUrl(input);
  for (let redirect = 0; redirect <= maxRedirects; redirect++) {
    const result = await requestOnce(url, { signal, limit, timeoutMs, accept });
    if ([301, 302, 303, 307, 308].includes(result.status)) {
      if (!result.headers.location || redirect === maxRedirects) throw new Error('The source redirected beyond the allowed limit.');
      url = validateRedirect(result.headers.location, url);
      continue;
    }
    return result;
  }
  throw new Error('Unable to read source.');
}
