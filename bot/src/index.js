import { Client, GatewayIntentBits, Events, REST, Routes, PermissionFlagsBits, ChannelType, ActivityType, ActionRowBuilder, ButtonBuilder, ButtonStyle, Partials } from 'discord.js';
import http from 'http';
import crypto from 'crypto';
import pg from 'pg';
import dotenv from 'dotenv';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { setupBank, ensureBankTable } from './systems/bank.js';
import { setupGames } from './systems/games.js';
import { setupMusic } from './systems/music.js';

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
async function setBotRuntime(id,status,error=null,ping=null){
  if(!pool)return;
  try{await pool.query("UPDATE bots SET runtime_status=$1,last_seen_at=CASE WHEN $1='online' THEN NOW() ELSE last_seen_at END,last_error=$2,bot_ping=COALESCE($4,bot_ping) WHERE id=$3",[status,error?String(error).slice(0,500):null,id,Number.isFinite(Number(ping))&&Number(ping)>=0?Math.round(Number(ping)):null]);}catch{}
}
function installBotFeatures(client,bot){
  client.mldBotId=String(bot.id||client.user?.id||'');
  setupBank(client,pool);
  setupGames(client,pool);
  setupMusic(client);
  client.mldConfig=bot.settings&&typeof bot.settings==='object'?bot.settings:{};
  client.mldType=bot.bot_type||'general';
  client.mldRecentMessages=new Map();
  client.mldPendingApplications=new Map();
  const logToChannel=async(guild,channelId,text)=>{
    if(!channelId)return;
    const channel=guild.channels.cache.get(String(channelId));
    if(channel?.isTextBased())await channel.send({content:String(text).slice(0,1800),allowedMentions:{parse:[]}}).catch(()=>{});
  };
  client.on(Events.MessageCreate,async message=>{
    if(message.author.bot||message.guild||!client.mldPendingApplications.has(message.author.id))return;
    const pending=client.mldPendingApplications.get(message.author.id);
    if(Date.now()-pending.createdAt>30*60*1000){client.mldPendingApplications.delete(message.author.id);return message.reply('انتهت مهلة التقديم. ارجع للسيرفر واكتب !تقديم من جديد.').catch(()=>{});}
    client.mldPendingApplications.delete(message.author.id);
    try{
      const guild=await client.guilds.fetch(pending.guildId),channel=guild.channels.cache.get(String(client.mldConfig?.applicationsChannelId||''));
      if(!channel?.isTextBased())return message.reply('ما تم تحديد روم الطلبات في لوحة التحكم.').catch(()=>{});
      const row=new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('mldapp:accept:'+pending.guildId+':'+message.author.id).setLabel('قبول').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('mldapp:reject:'+pending.guildId+':'+message.author.id).setLabel('رفض').setStyle(ButtonStyle.Danger)
      );
      await channel.send({content:'📝 طلب تقديم جديد\nالعضو: <@'+message.author.id+'> ('+message.author.id+')\nالإجابة: '+String(message.content||'').slice(0,1500),components:[row],allowedMentions:{users:[message.author.id]}});
      await message.reply('وصل تقديمك للإدارة بنجاح.').catch(()=>{});
    }catch(e){console.error('Application submission:',e.message);await message.reply('تعذر إرسال التقديم، حاول لاحقًا.').catch(()=>{});}
  });
  client.on(Events.InteractionCreate,async interaction=>{
    if(!interaction.isButton()||!interaction.customId.startsWith('mldapp:'))return;
    const [,action,guildId,userId]=interaction.customId.split(':');
    if(!interaction.guild||interaction.guild.id!==guildId)return interaction.reply({content:'هذا الزر تابع لسيرفر آخر.',ephemeral:true}).catch(()=>{});
    if(!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)&&!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator))return interaction.reply({content:'تحتاج صلاحية إدارة الرتب لقبول أو رفض التقديم.',ephemeral:true}).catch(()=>{});
    try{
      const cfg=client.mldConfig||{};
      if(action==='accept'&&/^\d{17,20}$/.test(String(cfg.juniorRoleId||''))){
        const member=await interaction.guild.members.fetch(userId);
        await member.roles.add(String(cfg.juniorRoleId),'قبول طلب تقديم من لوحة بوت MLD');
      }else if(action==='accept'&&!cfg.juniorRoleId){
        return interaction.reply({content:'حدد رتبة الجونيور في إعدادات البوت أولًا.',ephemeral:true});
      }
      await interaction.update({content:interaction.message.content+'\n\nالقرار: '+(action==='accept'?'مقبول بواسطة ':'مرفوض بواسطة ')+interaction.user.toString(),components:[]});
      const user=await client.users.fetch(userId).catch(()=>null);
      await user?.send(action==='accept'?'تم قبول طلبك في '+interaction.guild.name+'.':'تم رفض طلبك في '+interaction.guild.name+'.').catch(()=>{});
    }catch(e){console.error('Application decision:',e.message);await interaction.reply({content:'تعذر تطبيق القرار. تحقق من رتبة البوت وصلاحياته.',ephemeral:true}).catch(()=>{});}
  });
  client.on(Events.MessageCreate,async message=>{
    if(!message.guild||message.author.bot)return;
    const config=client.mldConfig||{},type=client.mldType||'general';
    const prefix=String(config.prefix||'!').slice(0,4);
    const content=String(message.content||'');
    const words=String(config.blockedWords||'').split(/[\n,،]/).map(x=>x.trim().toLowerCase()).filter(Boolean);
    const autoMod=type==='automod'||config.automodEnabled===true;
    if(autoMod){
      const linksOn=config.antiLinksEnabled===undefined?type==='automod':!!config.antiLinksEnabled;
      const spamOn=config.antiSpamEnabled===undefined?type==='automod':!!config.antiSpamEnabled;
      const linkPattern=/(https?:|discord\.gg|www\.)/i;
      const key=message.channel.id+':'+message.author.id,now=Date.now();
      const history=(client.mldRecentMessages.get(key)||[]).filter(t=>now-t<8000);history.push(now);client.mldRecentMessages.set(key,history);
      const blockedWord=words.some(w=>w&&content.toLowerCase().includes(w));
      const blockedLink=linksOn&&linkPattern.test(content);
      const spam=spamOn&&history.length>=5;
      if(blockedWord||blockedLink||spam){
        await message.delete().catch(()=>{});
        const reason=blockedWord?'كلمة ممنوعة':blockedLink?'رابط غير مسموح':'تكرار الرسائل (سبام)';
        const notice=await message.channel.send({content:'⚠️ '+message.author.toString()+' تم حذف رسالتك: '+reason+'.',allowedMentions:{users:[message.author.id]}}).catch(()=>null);
        if(notice)setTimeout(()=>notice.delete().catch(()=>{}),5000);
        await logToChannel(message.guild,config.modLogChannelId,'🛡️ إجراء حماية تلقائي: '+reason+' | العضو '+message.author.tag+' | القناة #'+message.channel.name);
        return;
      }
    }
    if(!content.startsWith(prefix))return;
    const [raw,...args]=content.slice(prefix.length).trim().split(/\s+/),command=String(raw||'').toLowerCase();
    if(!command)return;
    if(command==='ping')return message.reply({content:'🏓 البوت متصل ويعمل.',allowedMentions:{parse:[]}});
    if(command==='help') {
      const custom=Array.isArray(config.commands)?config.commands.filter(x=>x&&x.enabled!==false).map(x=>prefix+x.name+' — '+(x.description||'أمر مخصص')):[];
      const moderation=type==='moderation'||type==='automod'?'\\n'+[prefix+'warn @عضو السبب',prefix+'kick @عضو السبب',prefix+'ban @عضو السبب',prefix+'clear 10'].join('\\n'):'';
      return message.reply({content:'**أوامر '+client.user.username+'**\\n'+[prefix+'ping — فحص الاتصال',prefix+'help — قائمة الأوامر',prefix+'server — معلومات السيرفر',...custom].join('\\n').concat(moderation).slice(0,1800),allowedMentions:{parse:[]}});
    }
    if(command==='server')return message.reply({content:'**'+message.guild.name+'**\\nالأعضاء: '+message.guild.memberCount,allowedMentions:{parse:[]}});
    if(type==='moderation'||type==='automod'){
      const target=message.mentions.members.first();
      const reason=args.slice(1).join(' ').slice(0,400)||'لم يذكر سبب';
      if(command==='warn'){
        if(!message.member.permissions.has('ModerateMembers'))return message.reply('تحتاج صلاحية Timeout Members لتنفيذ الأمر.');
        if(!target)return message.reply('استخدم الأمر هكذا: '+prefix+'warn @عضو السبب');
        await logToChannel(message.guild,config.modLogChannelId,'⚠️ تنبيه إداري (غير دائم) للعضو '+target.user.tag+' بواسطة '+message.author.tag+' | '+reason);
        return message.reply({content:'تم تسجيل التنبيه في سجل الإدارة. هذا التنبيه إشعار فقط ولا يُحفظ كعقوبة دائمة.',allowedMentions:{parse:[]}});
      }
      if(command==='kick'||command==='ban'){
        const permission=command==='kick'?'KickMembers':'BanMembers';
        if(!message.member.permissions.has(permission))return message.reply('ما عندك صلاحية تنفيذ هذا الإجراء.');
        if(!message.guild.members.me?.permissions.has(permission))return message.reply('البوت يحتاج صلاحية '+(command==='kick'?'Kick Members':'Ban Members')+'.');
        if(!target)return message.reply('اذكر العضو المطلوب.');
        if(target.id===message.author.id||target.id===client.user.id)return message.reply('ما تقدر تستخدم الأمر على نفسك أو البوت.');
        try{if(command==='kick')await target.kick(reason);else await target.ban({reason});await logToChannel(message.guild,config.modLogChannelId,'🔨 '+(command==='kick'?'طرد':'حظر')+' العضو '+target.user.tag+' بواسطة '+message.author.tag+' | '+reason);return message.reply({content:'تم '+(command==='kick'?'طرد':'حظر')+' العضو بنجاح.',allowedMentions:{parse:[]}});}catch{return message.reply('تعذر تنفيذ الإجراء. تحقق من ترتيب الرتب وصلاحيات البوت.');}
      }
      if(command==='clear'){
        if(!message.member.permissions.has('ManageMessages'))return message.reply('تحتاج صلاحية إدارة الرسائل.');
        if(!message.guild.members.me?.permissions.has('ManageMessages'))return message.reply('البوت يحتاج صلاحية إدارة الرسائل.');
        const amount=Number(args[0]);if(!Number.isInteger(amount)||amount<1||amount>100)return message.reply('حدد عددًا من 1 إلى 100: '+prefix+'clear 10');
        const deleted=await message.channel.bulkDelete(amount,true).catch(()=>null);if(!deleted)return message.reply('تعذر حذف الرسائل؛ قد تكون أقدم من 14 يومًا.');
        const note=await message.channel.send('تم حذف '+deleted.size+' رسالة.').catch(()=>null);if(note)setTimeout(()=>note.delete().catch(()=>{}),4000);return;
      }
    }
    if(type==='applications'){
      if(command==='تقديم'||command==='apply'){
        if(!config.applicationsChannelId)return message.reply('الإدارة لم تحدد روم التقديمات في لوحة التحكم بعد.');
        client.mldPendingApplications.set(message.author.id,{guildId:message.guild.id,createdAt:Date.now()});
        try{await message.author.send('التقديم على رتبة في '+message.guild.name+'\nاكتب إجابتك على أسئلة التقديم في رسالة واحدة هنا، واذكر خبرتك وسبب رغبتك بالانضمام. لديك 30 دقيقة.');return message.reply('أرسلت لك رسالة التقديم في الخاص.')}catch{return message.reply('افتح الرسائل الخاصة من أعضاء السيرفر ثم أعد الأمر.');}
      }
      if(command==='طلباتي')return message.reply('للاستفسار عن حالة طلبك، راجع روم التقديمات أو تواصل مع الإدارة.');
      if(command==='تذكرة'||command==='ticket'){
        const supportRole=String(config.supportRoleId||'');
        const overwrites=[{id:message.guild.id,deny:[PermissionFlagsBits.ViewChannel]},{id:message.author.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]},{id:client.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.ManageChannels]}];
        if(/^\d{17,20}$/.test(supportRole))overwrites.push({id:supportRole,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]});
        const parent=message.guild.channels.cache.get(String(config.ticketsChannelId||''));
        const channel=await message.guild.channels.create({name:'ticket-'+message.author.username.toLowerCase().replace(/[^a-z0-9-]/g,'-').slice(0,70)+'-'+message.author.id.slice(-4),type:ChannelType.GuildText,topic:'MLD_TICKET:'+message.author.id,permissionOverwrites:overwrites,parent:parent?.type===ChannelType.GuildCategory?parent.id:undefined}).catch(e=>{console.error('Ticket create:',e.message);return null});
        if(!channel)return message.reply('تعذر إنشاء التذكرة. تأكد من صلاحية Manage Channels للبوت.');
        await channel.send({content:'تذكرة '+message.author.toString()+' — اشرح طلبك هنا. استخدم '+prefix+'قفل لإغلاق التذكرة.',allowedMentions:{users:[message.author.id]}});
        return message.reply('فتحت تذكرتك: '+channel.toString());
      }
      if(command==='قفل'||command==='close'){
        if(!String(message.channel.topic||'').startsWith('MLD_TICKET:'))return message.reply('هذا الأمر يعمل داخل قناة تذكرة فقط.');
        if(!message.member.permissions.has(PermissionFlagsBits.ManageChannels)&&!String(message.channel.topic).endsWith(message.author.id))return message.reply('إغلاق التذكرة متاح لصاحبها أو الإدارة.');
        const fetched=await message.channel.messages.fetch({limit:100}).catch(()=>null);
        const transcript=fetched?[...fetched.values()].reverse().map(m=>'['+m.createdAt.toISOString()+'] '+m.author.tag+': '+String(m.content||'[مرفق]').replace(/\n/g,' ')).join('\n').slice(0,17000):'تعذر جمع الرسائل.';
        const log=message.guild.channels.cache.get(String(config.ticketsChannelId||config.applicationsChannelId||''));
        if(log?.isTextBased()&&log.id!==message.channel.id)await log.send({content:'Transcript '+message.channel.name+'\n'+transcript,allowedMentions:{parse:[]}}).catch(()=>{});
        await message.channel.permissionOverwrites.edit(message.guild.id,{ViewChannel:false}).catch(()=>{});
        return message.channel.send('أُغلقت التذكرة وحُفظ نص المحادثة في روم السجلات إن كان مضبوطًا.');
      }
      if(command==='إضافة'||command==='add'){
        if(!message.member.permissions.has(PermissionFlagsBits.ManageChannels))return message.reply('الأمر للإدارة داخل التذكرة.');
        const target=message.mentions.members.first();if(!target||!String(message.channel.topic||'').startsWith('MLD_TICKET:'))return message.reply('استخدم الأمر داخل تذكرة مع منشن العضو.');
        await message.channel.permissionOverwrites.edit(target.id,{ViewChannel:true,SendMessages:true,ReadMessageHistory:true});return message.reply('أُضيف '+target.toString()+' إلى التذكرة.');
      }
    }
    const custom=(Array.isArray(config.commands)?config.commands:[]).find(x=>x&&x.enabled!==false&&String(x.name||'').toLowerCase()===command);
    if(custom){
      const reply=String(custom.response||'').slice(0,1800).replaceAll('{user}',message.author.username).replaceAll('{server}',message.guild.name).replaceAll('{memberCount}',String(message.guild.memberCount)).replaceAll('{args}',args.join(' '));
      if(reply)await message.reply({content:reply,allowedMentions:{repliedUser:false,parse:[]}});
    }
  });
  if(['welcome','general','custom','system','support'].includes(client.mldType)){
    client.on(Events.GuildMemberAdd,async member=>{
      const cfg=client.mldConfig||{},channelId=String(cfg.welcomeChannelId||'');
      if(!channelId)return;
      const channel=member.guild.channels.cache.get(channelId);
      if(!channel?.isTextBased())return;
      const message=String(cfg.welcomeMessage||'ياهلا {user} في {server}!').replaceAll('{user}',member.toString()).replaceAll('{server}',member.guild.name).replaceAll('{memberCount}',String(member.guild.memberCount));
      await channel.send({content:message.slice(0,1800),allowedMentions:{users:[member.id]} }).catch(()=>{});
    });
    client.on(Events.GuildMemberRemove,async member=>{
      const cfg=client.mldConfig||{},channelId=String(cfg.leaveChannelId||'');
      if(!channelId)return;
      const channel=member.guild.channels.cache.get(channelId);
      if(!channel?.isTextBased())return;
      const message=String(cfg.leaveMessage||'{user} غادر السيرفر.').replaceAll('{user}',member.user?.username||'عضو').replaceAll('{server}',member.guild.name).replaceAll('{memberCount}',String(member.guild.memberCount));
      await channel.send({content:message.slice(0,1800),allowedMentions:{parse:[]} }).catch(()=>{});
    });
  }
  if(client.mldType==='support'){
    client.on(Events.VoiceStateUpdate,async(oldState,newState)=>{
      if(oldState.channelId||!newState.channelId)return;
      const member=newState.member,room=newState.channel,cfg=client.mldConfig||{};
      if(!member||member.user.bot||!Array.isArray(cfg.supportRooms)||!cfg.supportRooms.map(String).includes(String(room.id)))return;
      const greet=String(cfg.greetMessage||'أهلاً {user}! انتظر دقائق وبيجيك أداري.').replaceAll('{user}',member.displayName||member.user.username).replaceAll('{server}',newState.guild.name).slice(0,1500);
      const textRoom=newState.guild.channels.cache.get(String(cfg.supportTextChannelId||''))||null;
      try{if(textRoom?.isTextBased())await textRoom.send({content:'🔊 دخل '+member.toString()+' روم الدعم الصوتي.\\n'+greet,allowedMentions:{users:[member.id],parse:[]}});}catch(e){console.error('Support greeting:',e.message);}
      try{
        if(cfg.mentionAdmin&&cfg.adminRole&&textRoom?.isTextBased())await textRoom.send({content:'<@&'+String(cfg.adminRole).replace(/[^0-9]/g,'')+'> يوجد عضو يحتاج الدعم.',allowedMentions:{roles:[String(cfg.adminRole)]}});
      }catch(e){console.error('Support mention:',e.message);}
      try{
        const topic='MLD_SUPPORT:'+member.id;
        let ticket=newState.guild.channels.cache.find(ch=>ch.type===ChannelType.GuildText&&ch.topic===topic);
        if(!ticket){
          const overwrites=[
            {id:newState.guild.id,deny:[PermissionFlagsBits.ViewChannel]},
            {id:member.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]},
            {id:client.user.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.ManageChannels]}
          ];
          if(cfg.adminRole&&/^\d{17,20}$/.test(String(cfg.adminRole)))overwrites.push({id:String(cfg.adminRole),allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]});
          ticket=await newState.guild.channels.create({name:('support-'+member.user.username).toLowerCase().replace(/[^a-z0-9-]/g,'-').replace(/-+/g,'-').slice(0,80)||('support-'+member.id.slice(-5)),type:ChannelType.GuildText,topic,permissionOverwrites:overwrites});
          await ticket.send({content:'🛡️ طلب دعم جديد من '+member.toString()+'. اشرح مشكلتك هنا وسيتمكن فريق الدعم من الرد.',allowedMentions:{users:[member.id]}});
        }
      }catch(e){console.error('Support ticket:',e.message);}
    });
  }

}
async function syncUserBots(){
  if(!pool)return;
  try{
    const {rows}=await pool.query('SELECT id,name,token,active,bot_type,settings,watching FROM bots WHERE active=true AND locked=true');
    const wanted=new Set(rows.map(x=>String(x.id)));
    for(const [id,client] of userBotClients){
      if(!wanted.has(id)){try{client.destroy();}catch{}userBotClients.delete(id);await setBotRuntime(id,'offline');}
    }
    for(const bot of rows){
      const id=String(bot.id),settings=bot.settings&&typeof bot.settings==='object'?bot.settings:{};
      if(userBotClients.has(id)){const live=userBotClients.get(id);live.mldConfig=settings;live.mldType=bot.bot_type||'general';await setBotRuntime(id,'online',null,live.ws?.ping);continue;}
      const c=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.DirectMessages,GatewayIntentBits.MessageContent,GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildVoiceStates],partials:[Partials.Channel]});
      c.mldBotId=id;
      installBotFeatures(c,bot);
      c.once(Events.ClientReady,()=>{try{c.user.setPresence({activities:[{name:String(bot.watching||'MLD | فهد المطيري').slice(0,128),type:ActivityType.Watching}],status:'online'});}catch{}console.log(`🤖 User bot online: ${bot.name} (${c.user.tag})`);setBotRuntime(id,'online',null,c.ws?.ping);});
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
    if(pool) await ensureBankTable(pool);
    await loadHandlers();
    client.once(Events.ClientReady, async () => await registerCommands());
    await client.login(process.env.DISCORD_TOKEN);
    if (pool) { await syncUserBots(); await syncCinemaBots(); setInterval(()=>{syncUserBots();syncCinemaBots();}, 10000); }
  } catch (err) {
    console.error('❌ فشل تشغيل البوت:', err.message);
    process.exit(1);
  }
}

start();
