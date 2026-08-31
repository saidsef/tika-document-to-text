'use strict';

import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';

// Point the app at the stub Tika below before it is imported, since app.js reads env at load.
const TIKA_PORT = 8171;
process.env.HOST = '127.0.0.1';
process.env.HOST_PORT = String(TIKA_PORT);
process.env.PORT = '8170';
process.env.TIKA_TIMEOUT_MS = '1500';
process.env.MAX_UPLOAD_BYTES = '1024';

/** Behaviour of the stub Tika for the current test. */
let tikaBehaviour = 'ok';

/** Path the app called, asserted below. */
let tikaPath = '';

const tika = http.createServer((req, res) => {
  let size = 0;
  tikaPath = req.url;
  req.on('data', (chunk) => { size += chunk.length; });
  req.on('end', () => {
    if (tikaBehaviour === 'hang') return;
    if (tikaBehaviour === 'unsupported') {
      res.writeHead(422);
      res.end('');
      return;
    }
    if (tikaBehaviour === 'busy') {
      res.writeHead(429, { 'Retry-After': '5' });
      res.end(JSON.stringify({ status: 'CLIENT_UNAVAILABLE_WITHIN_MS' }));
      return;
    }
    if (tikaBehaviour === 'crashed') {
      res.writeHead(503, { 'Retry-After': '5' });
      res.end(JSON.stringify({ status: 'OOM' }));
      return;
    }
    if (tikaBehaviour === 'broken') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 'tk:exception:container-exception': 'java.io.IOException: at Object.boom' }));
      return;
    }
    if (tikaBehaviour === 'empty') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 'Content-Type': 'image/png' }));
      return;
    }
    if (tikaBehaviour === 'unsure-language') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        'tk:content': `extracted ${size} bytes`,
        'Content-Type': 'text/plain',
        'tk:detected-language': 'eng',
        'tk:detected-language-confidence': 'LOW',
      }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      'tk:content': `extracted ${size} bytes <script>alert(1)</script>`,
      'Content-Type': 'text/plain',
      'tk:detected-language': 'en',
      'tk:detected-language-confidence': 'HIGH',
    }));
  });
});

const { server } = await import('../app.js');
const base = `http://127.0.0.1:${process.env.PORT}`;

const upload = async (bytes, filename = 'sample.txt') => {
  const body = new FormData();
  body.append('doc', new Blob([bytes], { type: 'text/plain' }), filename);
  return fetch(`${base}/`, { method: 'POST', body });
};

before(async () => {
  await new Promise((resolve) => tika.listen(TIKA_PORT, '127.0.0.1', resolve));
});

after(() => {
  tika.close();
  server.close();
});

describe('GET /', () => {
  it('renders the form with a per-request CSP nonce', async () => {
    const [one, two] = await Promise.all([fetch(`${base}/`), fetch(`${base}/`)]);
    const [a, b] = await Promise.all([one.text(), two.text()]);

    assert.equal(one.status, 200);
    assert.match(a, /<h1[^>]*>Document to Text<\/h1>/);

    const nonceOf = (html) => html.match(/src="\/js\/app\.js" nonce="([^"]+)"/)[1];
    assert.notEqual(nonceOf(a), nonceOf(b), 'nonce must not be reused across requests');
  });

  it('sets a CSP that allows no inline script or style', async () => {
    const csp = (await fetch(`${base}/`)).headers.get('content-security-policy');
    assert.doesNotMatch(csp, /unsafe-inline/);
    assert.doesNotMatch(csp, /unsafe-hashes/);
    assert.match(csp, /script-src 'self' 'nonce-/);
  });

  it('allows the stylesheet CDN to be reached for its sourcemap', async () => {
    const csp = (await fetch(`${base}/`)).headers.get('content-security-policy');
    // Sourcemap fetches fall back to default-src unless connect-src is set explicitly.
    assert.match(csp, /connect-src 'self' cdn\.jsdelivr\.net/);
    assert.doesNotMatch(csp, /connect-src[^;]*\*/, 'must not widen to a wildcard');
  });

  it('states the real upload limit so the browser can reject oversized files first', async () => {
    const html = await (await fetch(`${base}/`)).text();
    // MAX_UPLOAD_BYTES is 1024 here, so a megabyte-only label would read "0 MB".
    assert.match(html, /up to 1 kB</);
    assert.match(html, /data-max-bytes="1024"/);
  });

  it('renders the current year in the footer', async () => {
    const html = await (await fetch(`${base}/`)).text();
    assert.ok(html.includes(`Copyright ${new Date().getFullYear()} saidsef`));
  });
});

describe('POST /', () => {
  it('returns the extracted text and detected metadata', async () => {
    tikaBehaviour = 'ok';
    const res = await upload('hello');
    const html = await res.text();

    assert.equal(res.status, 200);
    assert.match(html, /extracted 5 bytes/);
    assert.match(html, /Detected: text\/plain · en/);
    assert.equal(tikaPath, '/tika/json/body', 'bare /tika returns Markdown in Tika 4');
    assert.ok(html.includes(`Copyright ${new Date().getFullYear()}`), 'footer must not read "undefined"');
  });

  it('escapes markup coming back from Tika', async () => {
    tikaBehaviour = 'ok';
    const html = await (await upload('hello')).text();
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  });

  it('rejects a request with no file as 400', async () => {
    const res = await fetch(`${base}/`, { method: 'POST' });
    assert.equal(res.status, 400);
    assert.match(await res.text(), /Choose a document to convert/);
  });

  it('rejects an upload over the size limit as 413', async () => {
    const res = await upload('x'.repeat(2048));
    assert.equal(res.status, 413);
    assert.match(await res.text(), /too large/);
  });

  it('surfaces a Tika rejection rather than passing it off as text', async () => {
    tikaBehaviour = 'unsupported';
    const res = await upload('hello');
    assert.equal(res.status, 422);
    assert.match(await res.text(), /No text could be read/);
  });

  it('reports a saturated fork pool as retryable, not as an unreadable file', async () => {
    tikaBehaviour = 'busy';
    const res = await upload('hello');
    assert.equal(res.status, 429);
    assert.equal(res.headers.get('retry-after'), '5');
    assert.match(await res.text(), /busy right now/);
  });

  it('reports a crashed fork as a converter failure', async () => {
    tikaBehaviour = 'crashed';
    const res = await upload('hello');
    assert.equal(res.status, 502);
    assert.match(await res.text(), /ran out of time or memory/);
  });

  it('treats a 200 carrying a container exception as a failure', async () => {
    tikaBehaviour = 'broken';
    const res = await upload('hello');
    assert.equal(res.status, 502);
    const html = await res.text();
    assert.match(html, /Tika could not read this file/);
    assert.doesNotMatch(html, /IOException|at Object\./, 'must not leak the stack trace');
  });

  it('distinguishes a document with no text from a failed parse', async () => {
    tikaBehaviour = 'empty';
    const res = await upload('hello');
    assert.equal(res.status, 422);
    assert.match(await res.text(), /No text could be read/);
  });

  it('hides a low-confidence language guess', async () => {
    tikaBehaviour = 'unsure-language';
    const html = await (await upload('hello')).text();
    assert.match(html, /Detected: text\/plain/);
    assert.doesNotMatch(html, /Detected:[^<]*eng/, 'a LOW confidence guess is worse than none');
  });

  it('aborts and reports 504 when Tika stops responding', async () => {
    tikaBehaviour = 'hang';
    const res = await upload('hello');
    assert.equal(res.status, 504);
    assert.match(await res.text(), /Conversion timed out/);
  });

  it('never leaks internal error detail to the browser', async () => {
    tikaBehaviour = 'unsupported';
    const html = await (await upload('hello')).text();
    assert.doesNotMatch(html, /ECONNREFUSED|at Object\.|node:internal/);
  });
});

describe('operational endpoints', () => {
  it('reports health', async () => {
    const res = await fetch(`${base}/healthz`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'healthy' });
  });

  it('exposes prometheus metrics', async () => {
    const res = await fetch(`${base}/metrics`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /process_cpu_user_seconds_total/);
  });

  it('serves robots.txt and sitemap.xml pointing at the request origin', async () => {
    const robots = await (await fetch(`${base}/robots.txt`)).text();
    assert.match(robots, /^User-agent: \*/);
    assert.ok(robots.includes(`Sitemap: ${base}/sitemap.xml`));

    const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
    assert.ok(sitemap.includes(`<loc>${base}/</loc>`));
  });

  it('does not reflect a hostile Host header into the page or the sitemap', async () => {
    // fetch() refuses to set Host, so go through the raw client.
    const get = (path, host) => new Promise((resolve, reject) => {
      http.get({ host: '127.0.0.1', port: process.env.PORT, path, headers: { Host: host } }, (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => resolve(body));
      }).on('error', reject);
    });

    const html = await get('/', 'evil.test"><script>alert(1)</script><link rel="x');
    assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
    assert.doesNotMatch(html, /rel="canonical"/, 'an untrusted host must yield no canonical URL');

    const sitemap = await get('/sitemap.xml', 'evil.test</loc></url><url><loc>http://spam');
    assert.doesNotMatch(sitemap, /spam/);
    assert.doesNotMatch(sitemap, /<urlset/, 'no absolute origin means no sitemap at all');

    // A path smuggled into the Host header makes it malformed, not merely odd.
    const smuggled = await get('/', 'evil.test/../../etc');
    assert.doesNotMatch(smuggled, /rel="canonical"/);

    // A legitimate host still produces the SEO tags.
    const good = await get('/', 'tika.example.com');
    assert.match(good, /rel="canonical" href="http:\/\/tika\.example\.com\/"/);
  });

  it('holds a slow upload as long as the ingress will', () => {
    // Node defaults requestTimeout to 300s, which 408s a large upload over a slow link.
    assert.equal(server.requestTimeout, 3600000);
    assert.ok(server.headersTimeout > server.keepAliveTimeout, 'a lower headers timeout reopens the 502 race');
    assert.ok(server.headersTimeout < server.requestTimeout, 'Node needs headersTimeout below requestTimeout');
  });

  it('serves static assets with a cache policy', async () => {
    const res = await fetch(`${base}/js/app.js`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('cache-control'), /max-age=\d+/);
  });
});
