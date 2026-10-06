#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const requiredFiles = [
  'index.html',
  'css/variables.css',
  'css/layout.css',
  'css/components.css',
  'css/print.css',
  'js/app.js',
  'js/manual.js',
  'js/simulator.js',
  'js/checklist.js',
  'js/storage.js',
  'assets/favicon.svg',
  'assets/images/og-preview.png',
  'assets/images/og-preview.svg',
  'vercel.json',
  'robots.txt',
  'sitemap.xml'
];

console.log('[build:preflight] Validating required static assets...');
for (const file of requiredFiles) {
  const fullPath = path.join(rootDir, file);
  if (!fs.existsSync(fullPath)) {
    console.error(`[build:preflight] FAILED: Missing required asset: ${file}`);
    process.exit(1);
  }
}

console.log('[build:preflight] Validating vercel.json schema & headers...');
try {
  const vercelRaw = fs.readFileSync(path.join(rootDir, 'vercel.json'), 'utf8');
  const vercelConfig = JSON.parse(vercelRaw);
  if (!Array.isArray(vercelConfig.headers) || vercelConfig.headers.length === 0) {
    throw new Error('vercel.json must declare security and caching headers');
  }
} catch (err) {
  console.error('[build:preflight] FAILED: vercel.json validation error:', err.message);
  process.exit(1);
}

console.log('[build:preflight] Validating index.html asset references...');
const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
const assetRegex = /(?:src|href)="([^"#?][^"]*)"/g;
let match;
const missingAssets = [];
while ((match = assetRegex.exec(html)) !== null) {
  const assetRef = match[1];
  if (
    assetRef.startsWith('http://') ||
    assetRef.startsWith('https://') ||
    assetRef.startsWith('mailto:') ||
    assetRef.startsWith('tel:') ||
    assetRef.startsWith('data:')
  ) {
    continue;
  }
  const assetPath = path.join(rootDir, assetRef);
  if (!fs.existsSync(assetPath)) {
    missingAssets.push(assetRef);
  }
}

if (missingAssets.length > 0) {
  console.error('[build:preflight] FAILED: Broken asset references in index.html:', missingAssets);
  process.exit(1);
}

console.log('Build pre-flight verified: all required static assets, configurations, and internal links exist.');
process.exit(0);
