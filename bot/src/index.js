import { Client, GatewayIntentBits, Events, REST, Routes } from 'discord.js';
import http from 'http';
import crypto from 'crypto';
import pg from 'pg';
import dotenv from 'dotenv';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

const { Pool } = pg;
const pool = process.env.DATABASE_URL ? new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false},max:3}) : null;
const userBotClients = new Map();
const cinemaBotClients = new Map();
const botKey = crypto.createHash('sha256').update(process.env.JWT_SECRET || 'mld').digest();
function decryptToken(value){
  if(!String(value).startsWith('enc:')) return value;
  const [,iv,tag,data]=String(value).split(':');
  const d=crypto.createDecipheriv('aes-256-gcm',botKey,Buffer.from(iv,'base64url'));
  d.setAuthTag(Buffer.from(tag,'base64url'));
  return Buffer.concat([d.update(Buffer.from(data,'base64url')),d.final()]).toString('utf8');
}
async function setBotRuntime(id,status,error=null){
  if(!pool)return;
  try{await pool.query('UPDATE bots SET runtime_status=$1,last_seen_at=CASE WHEN $1=\'online\' THEN NOW() ELSE last_seen_at END,last_error=$2 WHERE id=$3',[status,error?String(error).slice(0,500):null,id]);}catch{}
}
function installBotFeatures(client,bot){
  client.mldConfig=bot.settings&&typeof bot.settings==='object'?bot.settings:{};
  client.mldType=bot.bot_type||'general';
  client.on(Events.MessageCreate,async message=>{
    if(!message.guild||message.author.bot)return;
    const config=client.mldConfig||{},prefix=String(config.prefix||'!').slice(0,4);
    if(!message.content.startsWith(prefix))return;
    const [raw,...args]=message.content.slice(prefix.length).trim().split(/\s+/),command=String(raw||'').toLowerCase();
    if(!command)return;
    if(command==='ping')return message.reply('🏓 Pong! · MLD Bot online');
    if(command==='help') {
      const custom=Array.isArray(config.commands)?config.commands.filter(x=>x&&x.enabled!==false).map(x=>prefix+x.name+' — '+(x.description||'أمر مخصص')):[];
      return message.reply('**أوامر '+client.user.username+'**\n'+[prefix+'ping — فحص الاتصال',prefix+'help — قائمة الأوامر',prefix+'server — معلومات السيرفر',...custom].join('\n').slice(0,1800));
    }
    if(command==='server')return message.reply('**'+message.guild.name+'**\nالأعضاء: '+message.guild.memberCount);
    const custom=(Array.isArray(config.commands)?config.commands:[]).find(x=>x&&x.enabled!==false&&String(x.name||'').toLowerCase()===command);
    if(custom){
      const reply=String(custom.response||'').slice(0,1800).replaceAll('{user}',message.author.username).replaceAll('{server}',message.guild.name).replaceAll('{memberCount}',String(message.guild.memberCount)).replaceAll('{args}',args.join(' '));
      if(reply)await message.reply({content:reply,allowedMentions:{repliedUser:false,parse:[]}});
    }
  });
  if(client.mldType==='welcome'||client.mldType==='general'||client.mldType==='custom'){
    client.on(Events.GuildMemberAdd,async member=>{
      const cfg=client.mldConfig||{},channelId=String(cfg.welcomeChannelId||'');
      if(!channelId)return;
      const channel=member.guild.channels.cache.get(channelId);
      if(!channel?.isTextBased())return;
      const message=String(cfg.welcomeMessage||'ياهلا {user} في {server}!').replaceAll('{user}',member.toString()).replaceAll('{server}',member.guild.name).replaceAll('{memberCount}',String(member.guild.memberCount));
      await channel.send({content:message.slice(0,1800),allowedMentions:{users:[member.id]} }).catch(()=>{});
    });
  }
}
async function syncUserBots(){
  if(!pool)return;
  try{
    const {rows}=await pool.query('SELECT id,name,token,active,bot_type,settings FROM bots WHERE active=true AND locked=true');
    const wanted=new Set(rows.map(x=>String(x.id)));
    for(const [id,client] of userBotClients){
      if(!wanted.has(id)){try{client.destroy();}catch{}userBotClients.delete(id);await setBotRuntime(id,'offline');}
    }
    for(const bot of rows){
      const id=String(bot.id),settings=bot.settings&&typeof bot.settings==='object'?bot.settings:{};
      if(userBotClients.has(id)){const live=userBotClients.get(id);live.mldConfig=settings;live.mldType=bot.bot_type||'general';continue;}
      const c=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent,GatewayIntentBits.GuildMembers]});
      installBotFeatures(c,bot);
      c.once(Events.ClientReady,()=>{console.log(`🤖 User bot online: ${bot.name} (${c.user.tag})`);setBotRuntime(id,'online');});
      c.on('error',e=>{console.error(`User bot ${bot.name}:`,e.message);setBotRuntime(id,'error',e.message);});
      try{await c.login(decryptToken(bot.token));userBotClients.set(id,c);}
      catch(e){console.error(`❌ User bot ${bot.name} failed:`,e.message);await setBotRuntime(id,'error',e.message);try{c.destroy();}catch{}}
    }
  }catch(e){console.error('User bot sync:',e.message);}
}

async function syncCinemaBots(){
  if(!pool)return;
  try{
    const {rows}=await pool.query('SELECT id,name,token,active FROM cinema_bots WHERE active=true AND token IS NOT NULL');
    const wanted=new Set(rows.map(x=>String(x.id)));
    for(const [id,client] of cinemaBotClients){
      if(!wanted.has(id)){try{client.destroy();}catch{}cinemaBotClients.delete(id);await pool.query("UPDATE cinema_bots SET runtime_status='offline' WHERE id=$1",[id]).catch(()=>{});}
    }
    for(const bot of rows){
      const id=String(bot.id);if(cinemaBotClients.has(id))continue;
      const client=new Client({intents:[GatewayIntentBits.Guilds]});
      client.once(Events.ClientReady,async()=>{console.log('🎬 Cinema bot online: '+bot.name+' ('+client.user.tag+')');await pool.query("UPDATE cinema_bots SET runtime_status='online',last_seen_at=NOW(),last_error=NULL WHERE id=$1",[id]).catch(()=>{});});
      client.on('error',async err=>{console.error('Cinema bot '+bot.name+':',err.message);await pool.query("UPDATE cinema_bots SET runtime_status='error',last_error=$1 WHERE id=$2",[String(err.message).slice(0,500),id]).catch(()=>{});});
      try{await client.login(decryptToken(bot.token));cinemaBotClients.set(id,client);}
      catch(err){console.error('Cinema bot failed: '+bot.name,err.message);await pool.query("UPDATE cinema_bots SET runtime_status='error',last_error=$1 WHERE id=$2",[String(err.message).slice(0,500),id]).catch(()=>{});try{client.destroy();}catch{}}
    }
  }catch(err){console.error('Cinema bot sync:',err.message);}
}

const API_URL = String(process.env.API_URL || '').replace(/\/$/, '');
const voiceStarted = new Map();

const PORT = Number(process.env.PORT || 3000);
const healthServer = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, {'content-type':'application/json; charset=utf-8'});
    return res.end(JSON.stringify({ok:true, service:'mld-bot', status:'online'}));
  }
  res.writeHead(404); res.end('Not Found');
});
healthServer.listen(PORT, '0.0.0.0', () => console.log(`🌐 MLD Bot health على ${PORT}`));

async function track(discordId, type, minutes = 0) {
  if (!API_URL || !discordId) return;
  try {
    await fetch(`${API_URL}/api/public/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bot ${process.env.DISCORD_TOKEN}`
      },
      body: JSON.stringify({ discordId: String(discordId), type, minutes })
    });
  } catch (e) {
    console.error('إحصائيات MLD:', e.message);
  }
}

function setupStatsTracking(client) {
  client.on(Events.MessageCreate, async message => {
    if (!message.guild || message.author?.bot) return;
    await track(message.author.id, 'message');
    for (const id of message.mentions.users.keys()) {
      if (id !== message.author.id) await track(id, 'mention_received');
    }
    if (message.mentions.users.size) await track(message.author.id, 'mention_sent');
  });

  client.on(Events.GuildMemberAdd, member => {
    if (!member.user.bot) track(member.id, 'join');
  });

  client.on(Events.GuildMemberRemove, member => {
    if (!member.user.bot) track(member.id, 'leave');
  });

  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;
    const id = member.id;
    if (!oldState.channelId && newState.channelId) {
      voiceStarted.set(id, Date.now());
      await track(id, 'voice_join');
      return;
    }
    if (oldState.channelId && !newState.channelId) {
      const started = voiceStarted.get(id);
      if (started) {
        const minutes = Math.floor((Date.now() - started) / 60000);
        if (minutes > 0) await track(id, 'voice_minutes', minutes);
      }
      voiceStarted.delete(id);
      return;
    }
    if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      const started = voiceStarted.get(id);
      if (started) {
        const minutes = Math.floor((Date.now() - started) / 60000);
        if (minutes > 0) await track(id, 'voice_minutes', minutes);
      }
      voiceStarted.set(id, Date.now());
    }
  });
}


const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildVoiceStates]
});

async function registerCommands() {
  const commandsPath = join(__dirname, 'commands');
  const commandFiles = readdirSync(commandsPath).filter(f => f.endsWith('.js'));
  const commands = [];
  for (const file of commandFiles) {
    const command = await import(pathToFileURL(join(commandsPath, file)).href);
    if ('data' in command) commands.push(command.data.toJSON());
  }

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID), { body: commands });
    console.log('✅ تم تسجيل جميع الأوامر');
  } catch (err) {
    console.error('❌ فشل تسجيل الأوامر:', err);
  }
}

async function loadHandlers() {
  client.commands = new Map();
  const commandsPath = join(__dirname, 'commands');
  for (const file of readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
    const cmd = await import(pathToFileURL(join(commandsPath, file)).href);
    if ('data' in cmd && 'execute' in cmd) {
      client.commands.set(cmd.data.name, cmd);
      console.log(`✅ أمر: ${cmd.data.name}`);
    }
  }

  const eventsPath = join(__dirname, 'events');
  for (const file of readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
    const evt = await import(pathToFileURL(join(eventsPath, file)).href);
    if ('name' in evt && 'execute' in evt) {
      if (evt.once) client.once(evt.name, (...args) => evt.execute(...args));
      else client.on(evt.name, (...args) => evt.execute(...args));
      console.log(`✅ حدث: ${evt.name}`);
    }
  }
}

async function start() {
  try {
    setupStatsTracking(client);
    await loadHandlers();
    client.once(Events.ClientReady, async () => await registerCommands());
    await client.login(process.env.DISCORD_TOKEN);
    if (pool) { await syncUserBots(); await syncCinemaBots(); setInterval(()=>{syncUserBots();syncCinemaBots();}, 30000); }
  } catch (err) {
    console.error('❌ فشل تشغيل البوت:', err.message);
    process.exit(1);
  }
}

start();
