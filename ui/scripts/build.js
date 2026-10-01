'use strict';

import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';

const require = createRequire(import.meta.url);
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const INPUT = fileURLToPath(new URL('../styles/app.css', import.meta.url));
const OUTPUT = fileURLToPath(new URL('../public/build/', import.meta.url));

// The Preline plugins ship as self-contained browser bundles that initialise themselves.
const PRELINE_PLUGINS = ['dropdown', 'tooltip'];

await fs.mkdir(OUTPUT, { recursive: true });

const { css } = await postcss([tailwindcss({ base: ROOT, optimize: { minify: true } })])
  .process(await fs.readFile(INPUT, 'utf8'), { from: INPUT, to: `${OUTPUT}app.css` });
await fs.writeFile(`${OUTPUT}app.css`, css);

await Promise.all(PRELINE_PLUGINS.map((plugin) =>
  fs.copyFile(require.resolve(`@preline/${plugin}`), `${OUTPUT}${plugin}.js`)));

console.log(`Built public/build/app.css (${(css.length / 1024).toFixed(1)} kB) and ${PRELINE_PLUGINS.length} Preline plugins`);
