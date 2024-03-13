'use strict';

import fs from 'fs';
import tl from 'template-literal';
const cache = {};

export function tpl(path, options, cb) { path in cache ? cb(null, cache[path](options)) : fs.readFile(path, (err, data) => err ? cb(err) : cb(null, (cache[path] = tl(data.toString()))(options))) };
