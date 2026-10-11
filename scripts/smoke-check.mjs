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
const apiIndex = read('api/src/index.js');
const enhancements = read('web/public/enhancements.js');
const bot = read('bot/src/index.js');
const botRoutes = read('api/src/routes/bots.js');
const uno = read('api/src/games/uno.js');

assert.match(html, /logo\.svg\.JPG/, 'The original logo must remain referenced.');
assert.match(html, /rebuild-polish\.css/, 'The additive responsive stylesheet must be loaded.');
assert.match(app, /const ownerView=.*role.*owner/, 'Owner role must bypass page maintenance locks.');
assert.match(app, /await getPageLocksSnapshot\(\)/, 'Page locks must be fetched before visitor pages render.');
assert.match(app, /game-seat-avatar/, 'Game table seats must render player avatars.');
assert.match(app, /data-member="'\+esc\(p\.discordId\)/, 'Human player names at the table should open member profiles.');
assert.match(gameRoute, /discordId:req\.user\.discord_id\|\|null/, 'New game sessions should retain the Discord ID used by profile lookups.');
assert.match(gameRoute, /avatar:req\.user\.avatar\|\|null/, 'New game sessions should retain the host avatar.');
assert.match(gameSocket, /discordId:socket\.user\?\.discord_id\|\|null/, 'Socket joins should retain the Discord ID used by profile lookups.');
assert.match(gameSocket, /avatar:socket\.user\?\.avatar\|\|null/, 'Socket joins should retain player avatars.');
assert.match(app, /if\(p==="leaders"\)p="top"/, 'Legacy leaderboard route should resolve to the unified statistics page.');
assert.match(app, /المتصدرون والإحصائيات/, 'The unified leaderboard should use a clear Arabic title.');
assert.match(enhancements, /data\.siteProfile/, 'Member previews should include linked MLD profile data.');
assert.ok(apiIndex.indexOf("app.use('/api/', (req, res, next)") < apiIndex.indexOf("app.use('/api/auth', authRoutes)"), 'Database readiness middleware must run before API routes.');
assert.match(apiIndex, /req\.originalUrl/, 'Startup exemptions must use the original URL inside mounted middleware.');


assert.match(bot, /allowedSlashNames = new Set\\(\\['ping', 'serverinfo', 'botinfo'\\]\\)/, 'Main bot slash commands must stay limited to ping, server info, and bot info.');
assert.match(bot, /function buildUserBotSlashCommands/, 'User-created bots must expose a dedicated informational slash-command list.');
assert.match(bot, /client\\.on\\(Events\\.MessageCreate,\\s*async message =>/, 'Prefix command handling must be registered for incoming Discord messages.');
assert.match(botRoutes, /commands\\.slice\\(0,500\\)/, 'The bot dashboard must cap custom prefix commands at 500.');
assert.match(botRoutes, /commandSettings/, 'The bot dashboard must persist per-command enable/disable and alias settings.');
assert.match(uno, /function drawCard\\(state\\)/, 'UNO must recycle the discard pile when the draw pile runs out.');
assert.match(uno, /card\\.value === 'wild4' && hand\\.some/, 'UNO must validate Wild Draw Four legality.');

const jsFiles = [...walk('api/src'), ...walk('bot/src'), ...walk('web/public')].filter((p) => p.endsWith('.js'));
assert.ok(jsFiles.length > 0, 'JavaScript source files should be discovered.');
console.log(`MLD smoke checks passed: ${jsFiles.length} JavaScript files discovered; required logo, lock handling, and game-avatar wiring are present.`);
