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

const tika = http.createServer((req, res) => {
  let size = 0;
  req.on('data', (chunk) => { size += chunk.length; });
  req.on('end', () => {
    if (tikaBehaviour === 'hang') return;
    if (tikaBehaviour === 'unsupported') {
      res.writeHead(422);
      res.end('Unsupported Media Type');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/plain', 'X-Tika-Detected-Language': 'en' });
    res.end(`extracted ${size} bytes <script>alert(1)</script>`);
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

  it('surfaces a Tika rejection as 502 rather than passing it off as text', async () => {
    tikaBehaviour = 'unsupported';
    const res = await upload('hello');
    assert.equal(res.status, 502);
    assert.match(await res.text(), /Tika could not read this file \(HTTP 422\)/);
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

  it('serves static assets with a cache policy', async () => {
    const res = await fetch(`${base}/js/app.js`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('cache-control'), /max-age=\d+/);
  });
});
