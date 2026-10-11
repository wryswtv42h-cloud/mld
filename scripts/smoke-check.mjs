import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');
const mustExist = (path) => assert.ok(existsSync(join(root, path)), `Missing required path: ${path}`);
const walk = (dir) => readdirSync(join(root, dir)).flatMap((name) => {
  const path = join(dir, name);
  return statSync(join(root, path)).isDirectory() ? walk(path) : [path];
});

mustExist('web/public/logo.svg.JPG');
mustExist('web/public/index.html');
mustExist('web/public/app.js');
mustExist('web/public/rebuild-polish.css');
mustExist('api/src/routes/games.js');
mustExist('api/src/socket/games.js');
mustExist('bot/src/index.js');

const html = read('web/public/index.html');
const app = read('web/public/app.js');
const gameRoute = read('api/src/routes/games.js');
const gameSocket = read('api/src/socket/games.js');

assert.match(html, /logo\.svg\.JPG/, 'The original logo must remain referenced.');
assert.match(html, /rebuild-polish\.css/, 'The additive responsive stylesheet must be loaded.');
assert.match(app, /const ownerView=[^\\n]*role[^\\n]*owner/, 'Owner role must bypass page maintenance locks.');
assert.match(app, /await getPageLocksSnapshot\(\)/, 'Page locks must be fetched before visitor pages render.');
assert.match(app, /game-seat-avatar/, 'Game table seats must render player avatars.');
assert.match(app, /data-member=\"\'+esc\(p\.userId\)/, 'Human player names at the table should open member profiles.');
assert.match(gameRoute, /avatar:req\.user\.avatar\|\|null/, 'New game sessions should retain the host avatar.');
assert.match(gameSocket, /avatar:socket\.user\?\.avatar\|\|null/, 'Socket joins should retain player avatars.');

const jsFiles = [...walk('api/src'), ...walk('bot/src'), ...walk('web/public')].filter((p) => p.endsWith('.js'));
assert.ok(jsFiles.length > 0, 'JavaScript source files should be discovered.');
console.log(`MLD smoke checks passed: ${jsFiles.length} JavaScript files discovered; required logo, lock handling, and game-avatar wiring are present.`);
