'use strict';

import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import crypto from 'crypto';
import multer from 'multer';
import cors from 'cors';
import compression from 'compression';
import { collectDefaultMetrics, register as prometheusRegister } from 'prom-client';
import { tpl } from './libs/render.js';
import { URL } from 'url';
import { errorHandler } from './libs/express-error.js';
import http from 'http';
import https from 'https';

const __dirname = new URL('.', import.meta.url).pathname;

const logger = pinoHttp();
const nonce = crypto.randomBytes(16).toString("hex");

const app = express();
const storage = multer.memoryStorage();
const uploads = multer({ storage });

const TIMEOUT = 500000; // Milliseconds
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || 'server';
const HOST_PORT = process.env.HOST_PORT || 8070;
const protocol = process.env.PROTOCOL === 'https' ? https : http;

collectDefaultMetrics({ register: prometheusRegister });

app.enable('trust proxy');
app.set('view engine', 'html');
app.set('views', './views');
app.engine('html', tpl);
app.use(express.static(__dirname + '/public'));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
// app.use(logger);
app.use(compression());
app.use((req, res, next) => {
  req.setTimeout(TIMEOUT + 1); // set request timeout to 30s
  res.locals.nonce = nonce;
  res.locals.req = req;
  next();
});
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      baseUri: ["'self'"],
      defaultSrc: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      objectSrc: ["'self'"],
      sandbox: ['allow-forms', 'allow-scripts', 'allow-downloads', 'allow-same-origin'],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-hashes'", 'cdn.jsdelivr.net'],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-hashes'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
      upgradeInsecureRequests: [],
    },
  },
  referrerPolicy: { policy: 'same-origin' },
}));
app.use(cors());

app.get('/', async (req, res) => {
  res.render('index', {
    // url: req.body.url,
    copyright: new Date().getFullYear().toString(),
    text: ''
  });
});

app.post('/', uploads.single('doc'), async (req, res, next) => {
  if (!req.body.csrf_token) {
    return res.json({ 'status': 'csrf token not included' });
  }
  if (req.file || req.body.url) {
    let payload = '';
    const options = {
      host: HOST,
      port: HOST_PORT,
      path: '/tika',
      method: 'PUT',
      timeout: TIMEOUT,
      encoding: null,
      headers: {}
    };
    if (req.file) {
      payload = req.file.buffer;
      options.headers = {
        'Content-Type': req.file.mimetype,
        'X-Tika-PDFocrStrategy': 'auto',
      }
    }
    const post = protocol.request(options, (response) => {
      let body = '';
      response.on("data", (data) => body += data);
      response.on("end", () => {
        res.render('index', {
          text: Buffer.from(body, 'utf8').toString('utf8').replace(/<[^>]+>?/gmi, '').replace(/\n?\s{4,}/gmi, '\n\n').trim()
        });
      });
    }).on("error", next);
    post.write(payload);
    post.end();
  } else {
    next(new Error('Something went horribly wrong!'));
  }
});

app.get('/metrics', async (req, res) => {
  res.setHeader('Content-Type', prometheusRegister.contentType);
  res.send(await prometheusRegister.metrics());
});

app.get('/healthz', async (req, res) => {
  res.json({ 'status': 'healthy' });
});

app.use(errorHandler);

protocol.createServer(app).listen(PORT, () => console.log(`Server running on port ${PORT}`));
