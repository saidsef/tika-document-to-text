'use strict';

const express      = require('express');
const helmet       = require('helmet');
const logger       = require('pino-http')();
const crypto       = require('crypto').randomBytes(16).toString("hex");
const multer       = require('multer');
const cors         = require('cors');
const compression  = require('compression');
const Prometheus   = require('prom-client');
const { tpl }      = require('./libs/render');
const URL          = require('url').URL
const { errorHandler } = require('./libs/express-error');

const app     = express();
const storage = multer.memoryStorage();
const uploads = multer({ storage: storage});

const TIMEOUT   = 500000; // Milliseconds
const PORT      = process.env.PORT || 8080;
const HOST      = process.env.HOST || 'server';
const HOST_PORT = process.env.HOST_PORT || 7071;
const protocol  = (process.env.PROTOCOL == 'https') ? require('https') : require('http');

const prometheus = require('prom-client');
prometheus.collectDefaultMetrics({ register: prometheus.defaultRegistry });

app.enable('trust proxy');
app.set('view engine', 'html');
app.set('views', './views');
app.engine('html', tpl);
app.use(express.static(__dirname + '/public'));
app.use(express.urlencoded({extended: true, limit: '50mb'}));
app.use(express.json({limit: '50mb'}));
app.use(logger);
app.use(compression());
app.use((req, res, next) => {
  req.setTimeout(TIMEOUT + 1); // set request timeout to 30s
  res.locals.nonce = crypto;
  res.locals.req   = req;
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
  featurePolicy: {
    features: {
      fullscreen: ["'self'"],
      geolocation: ["'self'"],
    },
  },
}));
app.use(cors());

app.get('/', async (req, res, next) => {
  res.render('index', {
    url: req.body.url,
    copyright: new Date().getFullYear().toString(),
    text: ''
  });
});

app.post('/', uploads.single('doc'), (req, res, next) => {
  if (!req.body.csrf_token) {
    return req.json({'status' : 'csrf token not included'});
  }
  if (req.file || req.body.url) {
    let payload = '';
    const options = {
      host: HOST,
      port: HOST_PORT,
      path: '/tika',
      method: 'PUT',
      timeout: TIMEOUT,
      encoding: null
    };
    if (req.file) {
      payload = req.file.buffer;
      options['headers'] = {
        'Content-Type': req.file.mimetype
      };
    }
    if (req.body.url && req.body.url.length > 5) {
      payload = req.body.url;
      if (typeof payload != 'string' || ! new URL(payload)) {
        throw new Error('Not a valid urls');
      }

      options['headers'] = {
        'fileUrl': payload,
        'X-Tika-PDFextractInlineImages': true,
        'X-Tika-PDFocrStrategy': "ocr_and_text_extraction",
        'X-Tika-OCRmaxFileSizeToOcr': 0,
        'X-Tika-Skip-Embedded': true,
        'X-Tika-OCRtimeout': TIMEOUT
      };
    }
    const post = protocol.request(options, (response) => {
      response.setEncoding("utf8");
      let body = '';
      response.on("data", (data) => {
        body += data;
      });
      response.on("end", () => {
        res.render('index', {
          text: Buffer.from(body, 'utf8').toString('utf8').replace(/<[^>]+>?/gmi, '').replace(/\n?\s{4,}/gmi, '\n\n').trim()
        });
      });
      response.on("error", (error) => {
        next(error);
      });
    });
    post.write(payload);
    post.end();
  } else {
    next(new Error('Something went horribly wrong!'));
  }
});

app.get('/metrics', async (req, res, next) => {
  res.setHeader('Content-Type', prometheus.register.contentType)
  res.send(await prometheus.register.metrics())
});

app.get('/healthz', async (req, res, next) => {
  res.json({'status': 'healthy'});
});

app.use(errorHandler);

protocol.createServer(app).listen(PORT);
