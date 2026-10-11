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
mustExist('bot/src/commands/ping.js');
mustExist('bot/src/commands/serverinfo.js');
mustExist('bot/src/commands/botinfo.js');

const html = read('web/public/index.html');
const app = read('web/public/app.js');
const gameRoute = read('api/src/routes/games.js');
const gameSocket = read('api/src/socket/games.js');
const apiIndex = read('api/src/index.js');
const enhancements = read('web/public/enhancements.js');
const bot = read('bot/src/index.js');
const botServerInfo = read('bot/src/commands/serverinfo.js');
const botBotInfo = read('bot/src/commands/botinfo.js');
const botRoutes = read('api/src/routes/bots.js');
const uno = read('api/src/games/uno.js');
const jackaroo = read('api/src/games/jaccaro.js');

assert.match(html, /logo\.svg\.JPG/, 'The original logo must remain referenced.');
assert.match(html, /rebuild-polish\.css/, 'The additive responsive stylesheet must be loaded.');
assert.match(app, /const ownerView=.*role.*owner/, 'Owner role must bypass page maintenance locks.');
assert.match(app, /await getPageLocksSnapshot\(\)/, 'Page locks must be fetched before visitor pages render.');
assert.match(app, /authSnapshotToken===token/, 'Session refresh cache must be bound to the active login token.');
assert.ok(app.includes('["8ball","سؤال وجواب"]'), 'The dashboard toggle must use the same 8ball command name as the handler.');
assert.ok(app.includes('["servericon","أيقونة السيرفر"]'), 'The dashboard must expose toggles for implemented utility commands.');
assert.ok(html.includes('app.js?v=20261011-protection-toggles1'), 'The browser cache key must change when app behavior changes.');
assert.match(app, /game-seat-avatar/, 'Game table seats must render player avatars.');
assert.match(app, /data-member="'\+esc\(p\.discordId\)/, 'Human player names at the table should open member profiles.');
assert.match(gameRoute, /discordId:req\.user\.discord_id\|\|null/, 'New game sessions should retain the Discord ID used by profile lookups.');
assert.match(gameRoute, /avatar:req\.user\.avatar\|\|null/, 'New game sessions should retain the host avatar.');
assert.match(gameSocket, /discordId:socket\.user\?\.discord_id\|\|null/, 'Socket joins should retain the Discord ID used by profile lookups.');
assert.match(gameSocket, /avatar:socket\.user\?\.avatar\|\|null/, 'Socket joins should retain player avatars.');
assert.match(app, /if\(p==="leaders"\)p="top"/, 'Legacy leaderboard route should resolve to the unified statistics page.');
assert.match(app, /المتصدرون والإحصائيات/, 'The unified leaderboard should use a clear Arabic title.');
assert.match(enhancements, /data\.siteProfile/, 'Member previews should include linked MLD profile data.');
assert.ok(!app.includes('if(e.target.closest("[data-member]"))'), 'Only the enhancements module should own the member profile modal handler.');
assert.ok(apiIndex.indexOf("app.use('/api/', (req, res, next)") < apiIndex.indexOf("app.use('/api/auth', authRoutes)"), 'Database readiness middleware must run before API routes.');
assert.match(apiIndex, /req\.originalUrl/, 'Startup exemptions must use the original URL inside mounted middleware.');


assert.ok(bot.includes("allowedSlashNames = new Set(['ping', 'serverinfo', 'botinfo'])"), 'Main bot slash commands must stay limited to ping, server info, and bot info.');
assert.ok(bot.includes('function buildUserBotSlashCommands'), 'User-created bots must expose a dedicated informational slash-command list.');
assert.match(botServerInfo, /setName\('serverinfo'\)/, 'The approved server information slash command must exist.');
assert.match(botBotInfo, /setName\('botinfo'\)/, 'The approved bot information slash command must exist.');
assert.ok(bot.includes('client.on(Events.MessageCreate, async message =>'), 'Prefix command handling must be registered for incoming Discord messages.');
assert.ok(bot.includes('client.mldConfig?.commandSettings?.help?.enabled===false'), 'The help command toggle must also apply to no-prefix help.');
assert.ok(bot.includes("if(command==='blockedword')"), 'Blocked-word management must be implemented as a real prefix command.');
assert.ok(bot.includes("const autoMod=config.automodEnabled===undefined?type==='automod':config.automodEnabled===true"), 'Protection can be disabled explicitly even for automod bot types.');
assert.ok(bot.includes('const knownCommandNames=new Set('), 'Only recognized prefix commands should bypass automatic link filtering.');
assert.ok(bot.includes("if(command==='antilink'||command==='antispam')"), 'Link and spam protection must be independently configurable.');
assert.ok(app.includes('["blockedword","الكلمات الممنوعة"]'), 'The dashboard must expose the blocked-word command toggle.');
assert.ok(botRoutes.includes('commands.slice(0,500)'), 'The bot dashboard must cap custom prefix commands at 500.');
assert.ok(botRoutes.includes('commandSettings'), 'The bot dashboard must persist per-command enable/disable and alias settings.');
assert.ok(uno.includes('function drawCard(state)'), 'UNO must recycle the discard pile when the draw pile runs out.');
assert.ok(uno.includes("card.value === 'wild4' && hand.some"), 'UNO must validate Wild Draw Four legality.');
assert.ok(uno.includes("s.players.length === 2 ? 2 : 1"), 'UNO reverse must skip the opponent in two-player games.');
assert.ok(jackaroo.includes("case 'swap': {"), 'Jackaroo swap cards must have a real game effect.');
assert.ok(jackaroo.includes('function drawCard(state)'), 'Jackaroo must handle an exhausted draw pile safely.');
assert.ok(app.includes('اكتب اسم اللاعب الذي تريد تبديل موقعك معه'), 'The Jackaroo UI must let the player select a swap target.');
assert.ok(gameSocket.includes("setInterval(async()=>{try{const {rows}=await query(\"DELETE FROM games WHERE last_activity < NOW() - INTERVAL '5 minutes'"), 'Idle game sessions should be cleaned up after five minutes without activity.');
assert.ok(gameSocket.includes("socket.on('disconnect',async()=>"), 'Disconnected players should be marked offline or removed from waiting rooms.');
assert.ok(gameSocket.includes('const sessionLocks=new Map()'), 'Concurrent game events must use per-session serialization.');
assert.equal(gameSocket.split('withSessionLock(sessionId,async()=>').length-1, 5, 'Joining, starting, moving, leaving, and ending should be serialized per session.');
assert.ok(gameSocket.includes('last_activity=NOW()'), 'Joining, leaving, chatting and playing should refresh session activity.');
assert.ok((await read('api/src/db.js')).includes('ALTER TABLE games ADD COLUMN IF NOT EXISTS last_activity timestamptz'), 'Existing game tables should migrate safely to activity tracking.');

const jsFiles = [...walk('api/src'), ...walk('bot/src'), ...walk('web/public')].filter((p) => p.endsWith('.js'));
assert.ok(jsFiles.length > 0, 'JavaScript source files should be discovered.');
console.log(`MLD smoke checks passed: ${jsFiles.length} JavaScript files discovered; required logo, lock handling, and game-avatar wiring are present.`);
