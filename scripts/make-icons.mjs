// Renders public/icons/icon.svg to the PNG sizes required by the PWA manifest.
// Uses the Playwright Chromium that is already a dev dependency, so no extra tooling is needed.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const svg = await readFile(path.join(root, 'public/icons/icon.svg'), 'utf8');
const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

const targets = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
];

const browser = await chromium.launch();
try {
  for (const { file, size, maskable } of targets) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    // Maskable icons need the artwork inside the central safe zone (80%) on a full-bleed background.
    const body = maskable
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
           <rect width="512" height="512" fill="#0b1d3a"/>
           <g transform="translate(51.2 51.2) scale(0.8)">${inner}</g></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">${inner}</svg>`;
    await page.setContent(`<body style="margin:0;background:transparent">${body}</body>`);
    const png = await page.screenshot({ omitBackground: true, type: 'png' });
    await writeFile(path.join(root, 'public/icons', file), png);
    await page.close();
    console.warn(`wrote ${file}`);
  }
} finally {
  await browser.close();
}
