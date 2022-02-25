'use strict';

const express      = require('express');
const helmet       = require('helmet');
const morgan       = require('morgan');
const crypto       = require('crypto').randomBytes(16).toString("hex");
const multer       = require('multer');
const cors         = require('cors');
const compression  = require('compression');
const Prometheus   = require('prom-client');
const tl           = require('./libs/render');
const errorHandler = require('./libs/express-error');

const app     = express();
const storage = multer.memoryStorage();
const uploads = multer({ storage: storage});

const TIMEOUT   = 180000; //Milliseconds
const PORT      = process.env.PORT || 8080;
const HOST      = process.env.HOST || 'server';
const HOST_PORT = process.env.HOST_PORT || 7071;
const protocol  = (process.env.PROTOCOL == 'https') ? require('https') : require('http');

const metrics = new Prometheus.Registry();
Prometheus.collectDefaultMetrics({ metrics });

app.enable('trust proxy');
app.set('view engine', 'html');
app.set('views', './views');
app.engine('html', tl);
app.use(express.static(__dirname + '/public'));
app.use(express.urlencoded({extended: true, limit: '50mb'})); 
app.use(express.json({limit: '50mb'}));
app.use(compression());
app.use(morgan('combined'));
app.use((req, res, next) => {
  req.setTimeout((30 * 1000) + 1); // set request timeout to 30s
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

app.get('/', (req, res, next) => {
  res.render('index', {
    url: req.body.url,
    copyright: new Date().getFullYear().toString(),
    text: ''
  });
});

app.post('/', uploads.single('doc'), (req, res, next) => {
  if (req.file || req.body.url) {
    let payload = '';
    let options = {
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
      options['headers'] = {
        'fileUrl': req.body.url,
        'X-Tika-PDFextractInlineImages': true,
        'X-Tika-PDFocrStrategy': "OCR_ONLY",
        'X-Tika-OCRmaxFileSizeToOcr': 0,
        'X-Tika-OCRtimeout': TIMEOUT
      };
    }
    let post = protocol.request(options, (response) => {
      response.setEncoding("utf8");
      let body = '';
      response.on("data", (data) => {
        body += data;
      });
      response.on("end", () => {
        res.render('index', {
          text: body.toString().replace(/<[^>]+>?/gmi, '').replace(/\n?\s{3,}/gmi, '\n\n').trim()
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
  res.setHeader('Content-Type', metrics.contentType)
  res.send(await metrics.metrics())
});

app.get('/healthz', (req, res, next) => {
  res.json({'status': 'healthy'});
});

app.use(errorHandler);

new protocol.createServer(app).listen(PORT);
