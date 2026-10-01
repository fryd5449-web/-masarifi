import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

test('home links to separate operations and limits recent list to five', () => {
  const home = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(home.includes('href="./operations.html"'));
  assert.ok(app.includes('.slice(0, 5)'));
  assert.ok(!app.includes('showAll'));
});

test('pending orders card appears between purchases and sales and has explicit actions', () => {
  const home = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.ok(home.indexOf('id="pendingHeading"') > home.indexOf('id="purchasesHeading"'));
  assert.ok(home.indexOf('id="pendingHeading"') < home.indexOf('id="salesHeading"'));
  for (const operation of ['addPendingOrder', 'confirmPendingOrder', 'deletePendingOrder']) assert.ok(app.includes(operation));
  assert.ok(home.includes('id="pendingOrdersList"'));
});

test('manifest and touch icons resolve under the GitHub Pages subpath', () => {
  const manifest = JSON.parse(readFileSync(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.name, 'فلافي');
  assert.equal(new URL(manifest.start_url,'https://fryd5449-web.github.io/-masarifi/manifest.webmanifest').pathname,'/-masarifi/index.html');
  for (const icon of manifest.icons) assert.ok(existsSync(new URL('../' + icon.src, import.meta.url)));
  for (const page of ['index.html','operations.html']) {
    const html = readFileSync(new URL('../' + page, import.meta.url), 'utf8');
    assert.ok(html.includes('rel="apple-touch-icon"')); assert.ok(html.includes('href="./favicon.png"'));
  }
});
