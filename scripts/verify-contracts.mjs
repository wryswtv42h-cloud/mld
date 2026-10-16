import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');
const html = read('index.html');
const css = read('style.css');
const web = read('app.js');
const api = read('api/src/index.js');
const bot = read('bot/src/index.js');

assert.match(html, /<html[^>]+lang="ar"[^>]+dir="rtl"/, 'The site must remain Arabic RTL');
assert.match(html, /\/web\/public\/logo\.svg\.JPG/, 'The original logo must be referenced by the UI');
assert.ok(existsSync(join(root, 'web/public/logo.svg.JPG')), 'The original logo file must be preserved');
assert.match(html, /style\.css\?v=20261016/, 'The rebuilt stylesheet must bypass stale browser cache');
assert.match(html, /app\.js\?v=20261016/, 'The rebuilt app script must bypass stale browser cache');
assert.match(css, /--pink:#ff9cde/i, 'The logo pink identity color must exist');
assert.match(css, /--purple:#a86fdf/i, 'The logo purple identity color must exist');
assert.match(css, /prefers-reduced-motion/, 'Reduced-motion preference must be supported');
assert.match(web, /aria-busy','true'/, 'Dynamic pages must expose their loading state accessibly');
for (const page of ['members', 'leaderboard', 'roles', 'games', 'cinema', 'feedback', 'zajel', 'groups', 'applications', 'tickets', 'bots', 'profile', 'admin', 'owner', 'addbot']) {
  assert.match(web, new RegExp('^' + page + ':\\[', 'm'), `Missing page configuration: ${page}`);
}
for (const route of [
  '/api/auth/register/start', '/api/auth/register/verify', '/api/auth/login',
  '/api/auth/me', '/api/leaderboard', '/api/games', '/api/cinema',
  '/api/bots', '/api/admin/overview', '/api/admin/settings', '/api/public/stats'
]) assert.ok(api.includes(`'${route}'`) || api.includes(`"${route}"`), `Missing critical API route: ${route}`);
for (const module of ["'feedback','feedback'", "'groups','groups_table'", "'tickets','tickets'", "'applications','applications'"]) {
  assert.ok(api.includes(module), `Missing generic module route registration: ${module}`);
}
assert.match(api, /authRateWindows/, 'Authentication endpoints must be rate-limited');
assert.match(api, /INTERVAL '5 minutes'/, 'Abandoned game sessions must be cleaned up');
assert.match(api, /X-Content-Type-Options/, 'Security response headers must be enabled');
assert.match(bot, /syncingManagedBots/, 'Managed bot sync must prevent overlapping runs');
assert.match(bot, /max:3/, 'The managed bot database pool must be bounded');
const commandCount = new Set([...bot.matchAll(/case\\s+['"]([^'"]+)['"]\\s*:/g)].map((m) => m[1])).size;
assert.ok(commandCount >= 200, `Expected at least 200 distinct command cases; found ${commandCount}`);

console.log(`MLD source contract checks passed. Pages, logo, brand palette, API modules, security controls and ${commandCount} command cases verified.`);
