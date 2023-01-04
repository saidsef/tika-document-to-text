'use strict';

const fs    = require('fs');
const tl    = require('template-literal');
const cache = {};

module.exports = (path, options, cb) => path in cache ? cb(null, cache[path](options)) : fs.readFile(path, (err, data) => err ? cb(err) : cb(null, (cache[path] = tl(data.toString()))(options)));
