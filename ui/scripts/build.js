'use strict';

import fs from 'node:fs/promises';
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';

const from = 'styles/app.css';
const { css } = await postcss([tailwindcss({ optimize: true })]).process(await fs.readFile(from, 'utf8'), { from });

await fs.mkdir('public/build', { recursive: true });
await fs.writeFile('public/build/app.css', css);
await fs.copyFile('node_modules/@preline/dropdown/index.js', 'public/build/dropdown.js');
