'use strict';

import express from 'express';
import helmet from 'helmet';
import crypto from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import compression from 'compression';
import { collectDefaultMetrics, register as prometheusRegister } from 'prom-client';
import { tpl } from './libs/render.js';
import { errorHandler, httpError } from './libs/express-error.js';

const PUBLIC_DIR = fileURLToPath(new URL('./public', import.meta.url));
const VIEWS_DIR = fileURLToPath(new URL('./views', import.meta.url));

const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || 'server';
const HOST_PORT = Number(process.env.HOST_PORT) || 8070;
const TIMEOUT = Number(process.env.TIKA_TIMEOUT_MS) || 500000;
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES) || 50 * 1024 * 1024;

// Selects the scheme for the outbound call to Tika only. Inbound TLS terminates at the ingress.
const tika = process.env.PROTOCOL === 'https' ? https : http;

const CANONICAL_ORIGIN = process.env.CANONICAL_ORIGIN || '';

/**
 * Absolute origin for canonical, Open Graph and sitemap URLs.
 * The Host header is client-controlled, so it is run through the URL parser:
 * anything it rejects, or any path smuggled into the header, yields no origin
 * rather than being reflected into the page.
 */
function originOf(req) {
  if (CANONICAL_ORIGIN) return CANONICAL_ORIGIN;
  const host = req.get('host') || '';
  try {
    const url = new URL(`${req.protocol}://${host}`);
    // Host is `uri-host [ ":" port ]` and nothing else, so anything the parser
    // moved into a path or query means the header was malformed.
    return url.host === host.toLowerCase() ? url.origin : '';
  } catch {
    return '';
  }
}

const app = express();
const uploads = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

collectDefaultMetrics({ register: prometheusRegister });

app.enable('trust proxy');
app.set('view engine', 'html');
app.set('views', VIEWS_DIR);
app.engine('html', tpl);

app.use(compression());

// Values every render needs. Runs before helmet so the CSP header can read res.locals.nonce.
app.use((req, res, next) => {
  // Outlast the Tika call so the timeout error still has a live socket to render onto.
  req.setTimeout(TIMEOUT + 5000);
  res.locals.nonce = crypto.randomBytes(16).toString('base64');
  res.locals.copyright = String(new Date().getFullYear());
  res.locals.origin = originOf(req);
  res.locals.esc = escapeHtml;
  res.locals.text = '';
  res.locals.detectedType = '';
  res.locals.detectedLang = '';
  res.locals.error = '';
  next();
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      baseUri: ["'self'"],
      defaultSrc: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      // DevTools fetches bootstrap.min.css.map, and a sourcemap request is governed by
      // connect-src, not style-src. Without this it falls back to default-src and is blocked.
      connectSrc: ["'self'", 'cdn.jsdelivr.net'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      objectSrc: ["'none'"],
      sandbox: ['allow-forms', 'allow-scripts', 'allow-downloads', 'allow-same-origin'],
      // No 'unsafe-inline' anywhere: every script is external and carries this nonce,
      // and every style lives in a stylesheet.
      scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.nonce}'`],
      styleSrc: ["'self'", 'cdn.jsdelivr.net'],
      upgradeInsecureRequests: [],
    },
  },
  referrerPolicy: { policy: 'same-origin' },
}));
app.use(express.static(PUBLIC_DIR, { maxAge: '1h' }));

const HTML_ESCAPES = new Map([
  ['&', '&amp;'], ['<', '&lt;'], ['>', '&gt;'], ['"', '&quot;'], ["'", '&#39;'],
]);

/** Escape a value for interpolation into HTML text or a double-quoted attribute. */
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES.get(c));
}

app.get('/', (req, res) => res.render('index'));

app.post('/', uploads.single('doc'), (req, res, next) => {
  if (!req.file) return next(httpError(400, 'Choose a document to convert.'));

  const request = tika.request({
    host: HOST,
    port: HOST_PORT,
    path: '/tika',
    method: 'PUT',
    timeout: TIMEOUT,
    headers: {
      'Content-Type': req.file.mimetype || 'application/octet-stream',
      'Content-Length': req.file.buffer.length,
      'Accept': 'text/plain',
      ...(req.file.mimetype === 'application/pdf' && { 'X-Tika-PDFocrStrategy': 'ocr_and_text_extraction' }),
    },
  }, (response) => {
    const chunks = [];
    response.on('data', (chunk) => chunks.push(chunk));
    response.on('error', next);
    response.on('end', () => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        return next(httpError(502, `Tika could not read this file (HTTP ${response.statusCode}).`));
      }
      res.render('index', {
        text: Buffer.concat(chunks).toString('utf8').replace(/\n?\s{4,}/g, '\n\n').trim(),
        detectedType: response.headers['content-type'] || '',
        detectedLang: response.headers['x-tika-detected-language'] || '',
      });
    });
  });

  // `timeout` only fires the event; without this the socket is never torn down.
  request.on('timeout', () => request.destroy(httpError(504, 'Conversion timed out.')));
  request.on('error', next);
  request.end(req.file.buffer);
});

app.get('/robots.txt', (req, res) => {
  const sitemap = res.locals.origin ? `Sitemap: ${res.locals.origin}/sitemap.xml\n` : '';
  res.type('text/plain').send(`User-agent: *\nAllow: /\n${sitemap}`);
});

app.get('/sitemap.xml', (req, res, next) => {
  // <loc> must be absolute, so without a trusted origin there is no sitemap to serve.
  if (!res.locals.origin) return next(httpError(404, 'Not found.'));
  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
    `<url><loc>${res.locals.origin}/</loc><changefreq>monthly</changefreq></url>` +
    `</urlset>\n`
  );
});

app.get('/metrics', async (req, res) => {
  res.setHeader('Content-Type', prometheusRegister.contentType);
  res.send(await prometheusRegister.metrics());
});

app.get('/healthz', (req, res) => res.json({ status: 'healthy' }));

app.use(errorHandler);

export const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
// Must exceed the ingress keep-alive so nginx never reuses a socket Node is closing (avoids 502s).
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

export default app;
