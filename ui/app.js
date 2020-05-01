'use strict';

const express      = require('express');
const helmet       = require('helmet');
const morgan       = require('morgan');
const multer       = require('multer');
const cors         = require('cors');
const compression  = require('compression');
const promMid      = require('express-prometheus-middleware');
const tl           = require('./libs/render');
const errorHandler = require('./libs/express-error');

const app     = express();
const storage = multer.memoryStorage();
const uploads = multer({ storage: storage});

const PORT      = process.env.PORT || 8080;
const HOST      = process.env.HOST || 'server';
const HOST_PORT = process.env.HOST_PORT || 7071;
const protocol  = (process.env.PROTOCOL == 'https') ? require('https') : require('http');

app.enable('trust proxy');
app.set('view engine', 'html');
app.set('views', './views');
app.engine('html', tl);
app.use(promMid({metricsPath: '/metrics', collectDefaultMetrics: true, requestDurationBuckets: [0.1, 0.5, 1, 1.5]}));
app.use(express.static(__dirname + '/public'));
app.use(express.urlencoded({extended: true, limit: '50mb'})); 
app.use(express.json({limit: '50mb'}));
app.use(compression());
app.use(morgan('combined'));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      baseUri: ["'self'"],
      defaultSrc: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      objectSrc: ["'self'"],
      sandbox: ['allow-forms', 'allow-scripts'],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "'unsafe-hashes'", 'code.jquery.com', 'cdnjs.cloudflare.com', 'code.responsivevoice.org'],
      styleSrc: ["'self'", "'unsafe-inline'", 'stackpath.bootstrapcdn.com'],
      upgradeInsecureRequests: true,
    },
  },
  referrerPolicy: { policy: 'same-origin' },
  featurePolicy: {
    features: {
      fullscreen: ["'self'"],
      vibrate: ["'self'"],
      geolocation: ["'self'"],
      wakeLock: ["'self'"],
    },
  },
}));
app.use(cors());
app.options('*', cors());

app.get('/', (req, res, next) => {
  res.render('index', {
    url: req.body.url,
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
        'fileUrl': req.body.url
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
          text: body
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

app.get('/healthz', (req, res, next) => {
  res.json({'status': 'healthy'});
});

app.use(errorHandler);

new protocol.createServer(app).listen(PORT);