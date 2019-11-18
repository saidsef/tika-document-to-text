'use strict';

const express = require('express');
const helmet  = require('helmet');
const morgan  = require('morgan');
const https   = require('https');
const promMid = require('express-prometheus-middleware');
const tl      = require('./libs/render');
const app     = express();

const PORT      = process.env.PORT || 8080;
const HOST      = process.env.HOST || 'tika';
const HOST_PORT = process.env.HOST_PORT || 7070;

app.enable('trust proxy');
app.set('view engine', 'html');
app.set('views', './views');
app.engine('html', tl);
app.use(promMid({metricsPath: '/metrics', collectDefaultMetrics: true, requestDurationBuckets: [0.1, 0.5, 1, 1.5]}));
app.use(express.static(__dirname + '/public'));
app.use(express.urlencoded({extended: true, limit: '50mb'})); 
app.use(express.json({limit: '50mb'}));
app.use(helmet());
app.use(morgan('combined'));

app.get('/', (req, res, next) => {
  res.render('index', {
    url: req.body.url,
    text: req.body.text
  });
});

app.post('/', (req, res, next) => {
  console.log('begin post action');
  let payload = JSON.stringify({ url: req.body.url });
  let options = {
    host: HOST,
    port: HOST_PORT,
    path: '/api/v1/url',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': payload.length
    },
    method: 'POST'
  };
  let post = https.request(options, (response) => {
      response.setEncoding("utf8");
      let body = '';
      response.on("data", (data) => {
        body += data;
      });
      response.on("end", () => {
        body = JSON.parse(body);
        res.render('index', {
          url: req.body.url,
          text: body['data']
        });
      });
    });
    post.write(payload);
    post.end();
});

app.get('/healthz', (req, res, next) => {
  res.json({'status': 'healthy'});
});

app.listen(PORT);