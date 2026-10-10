import { Client, GatewayIntentBits, Events, REST, Routes, PermissionFlagsBits, ChannelType, ActivityType, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, Partials, EmbedBuilder } from 'discord.js';
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
import { setupAuditLogs, ensureAuditLogRooms } from './systems/audit-logs.js';

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
let auditTableReady=null;
async function writeRuntimeLog(botId,actorId,action,details={}){
  if(!pool||!botId)return;
  try{
    if(!auditTableReady)auditTableReady=pool.query("CREATE TABLE IF NOT EXISTS bot_logs (id BIGSERIAL PRIMARY KEY, bot_id UUID NOT NULL, actor_id TEXT, action TEXT NOT NULL, details JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
    await auditTableReady;
    await pool.query("INSERT INTO bot_logs(bot_id,actor_id,action,details) VALUES($1,$2,$3,$4)",[String(botId),String(actorId||''),String(action).slice(0,100),JSON.stringify(details)]);
  }catch(e){console.error('Bot audit log:',e.message);auditTableReady=null;}
}
const reservedUserSlashCommands=new Set(['help','ping','server','membercount','uptime','avatar','userinfo','serverinfo','servericon','roles','channelcount','roll','random','coinflip','eightball','joke']);
function buildUserBotSlashCommands(client){
  const commands=[
    {name:'help',description:'عرض دليل أوامر البوت'},
    {name:'ping',description:'فحص الاتصال وسرعة استجابة البوت'},
    {name:'server',description:'عرض معلومات السيرفر الحالي'},
    {name:'serverinfo',description:'بطاقة معلومات السيرفر'},
    {name:'servericon',description:'عرض أيقونة السيرفر'},
    {name:'membercount',description:'عرض عدد أعضاء السيرفر'},
    {name:'channelcount',description:'عرض عدد القنوات'},
    {name:'roles',description:'عرض أبرز رتب السيرفر'},
    {name:'uptime',description:'عرض مدة تشغيل البوت'},
    {name:'avatar',description:'عرض الصورة الشخصية',options:[{type:6,name:'user',description:'العضو المطلوب (اختياري)',required:false}]},
    {name:'userinfo',description:'عرض معلومات عضو',options:[{type:6,name:'user',description:'العضو المطلوب (اختياري)',required:false}]},
    {name:'roll',description:'رمي نرد بعدد أوجه تختاره',options:[{type:4,name:'max',description:'أعلى رقم (2 إلى 1000000)',required:false,min_value:2,max_value:1000000}]},
    {name:'random',description:'اختيار رقم عشوائي بين حدين',options:[{type:4,name:'min',description:'الحد الأدنى',required:true,min_value:-100000000,max_value:100000000},{type:4,name:'max',description:'الحد الأعلى',required:true,min_value:-100000000,max_value:100000000}]},
    {name:'coinflip',description:'رمي قطعة نقدية'},
    {name:'eightball',description:'إجابة عشوائية عن سؤال',options:[{type:3,name:'question',description:'اكتب سؤالك',required:true,max_length:500}]},
    {name:'joke',description:'نكتة عشوائية خفيفة'}
  ];
  const seen=new Set(commands.map(x=>x.name));
  for(const item of (Array.isArray(client.mldConfig?.commands)?client.mldConfig.commands:[])){
    const name=String(item?.name||'').toLowerCase();
    if(item?.enabled===false||!/^[-a-z0-9_]{1,32}$/.test(name)||seen.has(name))continue;
    commands.push({name,description:String(item.description||'أمر مخصص').trim().slice(0,100)||'أمر مخصص',options:[{type:3,name:'args',description:'نص اختياري للأمر',required:false,max_length:500}]});
    seen.add(name);
    if(commands.length>=100)break;
  }
  return commands.slice(0,100);
}
async function registerUserBotSlashCommands(client,bot){
  if(!client.user||!/^\d{17,20}$/.test(String(bot.guild_id||'')))return;
  const body=buildUserBotSlashCommands(client);
  const signature=JSON.stringify(body);
  if(client.mldSlashSignature===signature)return;
  try{
    const rest=new REST({version:'10'}).setToken(decryptToken(bot.token));
    await rest.put(Routes.applicationGuildCommands(client.user.id,String(bot.guild_id)),{body});
    client.mldSlashSignature=signature;
    console.log(`✅ User bot slash commands registered: ${bot.name} ${body.length}`);
    await writeRuntimeLog(bot.id,'system','bot.slash_commands_registered',{count:body.length,guildId:String(bot.guild_id)});
  }catch(error){
    console.error(`User bot ${bot.name} slash registration:`,error.message);
    await writeRuntimeLog(bot.id,'system','bot.slash_registration_failed',{error:error.message,guildId:String(bot.guild_id)});
  }
}

function buildUserHelpPayload(client, ownerId, selected='general') {
  const config=client.mldConfig||{},type=client.mldType||'general',prefix=String(config.prefix||'!').slice(0,4);
  const categories=[
    {value:'general',label:'الأوامر العامة',emoji:'✨',desc:'معلومات السيرفر وأدوات يومية',rows:[['ping','فحص الاتصال'],['server','معلومات السيرفر'],['serverinfo','بطاقة السيرفر'],['membercount','عدد الأعضاء'],['channelcount','عدد القنوات'],['uptime','مدة تشغيل البوت'],['avatar','الصورة الشخصية'],['userinfo','معلومات عضو'],['roles','عرض الرتب'],['roll','رمي نرد'],['random','رقم عشوائي'],['coinflip','عملة'],['eightball','سؤال وجواب'],['joke','نكتة']]},
    {value:'admin',label:'الإدارة والإشراف',emoji:'🛡️',desc:'أوامر إدارة السيرفر المتاحة حسب نوع البوت',rows:[['warn @عضو السبب','تنبيه عضو'],['kick @عضو السبب','طرد عضو'],['ban @عضو السبب','حظر عضو'],['clear 10','حذف رسائل'],['slowmode 5','تحديد سرعة الرسائل'],['lock','قفل القناة'],['unlock','فتح القناة'],['timeout @عضو دقائق','تقييد عضو'],['untimeout @عضو','إلغاء التقييد'],['nick @عضو الاسم','تغيير لقب'],['roleadd @عضو @رتبة','إضافة رتبة'],['roleremove @عضو @رتبة','إزالة رتبة'],['poll سؤال','تصويت'],['announce #روم نص','إعلان']]},
    {value:'welcome',label:'الترحيب والسجلات',emoji:'👋',desc:'إعدادات الترحيب والمغادرة واللوقات',rows:[['welcome','رسالة الترحيب'],['logs','معلومات السجلات'],['مغادرة','رسالة المغادرة']]},
    {value:'tickets',label:'التذاكر والتقديمات',emoji:'🎫',desc:'التذاكر وطلبات التقديم',rows:[['تذكرة','إنشاء تذكرة'],['ticket','اختصار التذكرة'],['تقديم','بدء التقديم'],['apply','اختصار التقديم'],['طلباتي','متابعة الطلب'],['قفل','إغلاق التذكرة'],['إضافة @عضو','إضافة عضو للتذكرة']]},
    {value:'games',label:'الألعاب',emoji:'🎮',desc:'ألعاب وتحديات داخل Discord',rows:['سالفة','برا السالفة','روليت','مافيا','كت','زر','بومب','تصويت','ايفنت','اعلام','فكك','ترتيب','صحح','جمع','مفرد','حيوانات','شركة','ضرب','طرح','ترجمة','عواصم','اعكس','اسرع','حرف','ادمج','توب','هايد','فخ','حجره','اكس'].map(n=>[n,'لعبة أو أمر نقاط'])},
    {value:'economy',label:'الاقتصاد والبنك',emoji:'💰',desc:'الرصيد والمكافآت والتحويلات',rows:[['رصيد','عرض الرصيد'],['فلوس','اختصار الرصيد'],['يومي','مكافأة يومية'],['تحويل @عضو مبلغ','تحويل رصيد'],['قرض','طلب قرض'],['سداد','سداد قرض'],['استثمار','استثمار'],['صندوق','الصندوق'],['تداول','التداول']]},
    {value:'music',label:'الموسيقى',emoji:'🎵',desc:'التحكم بالتشغيل وقائمة الانتظار',rows:[['شغل اسم/رابط','تشغيل مقطع'],['وقف','إيقاف'],['التالي','تخطي'],['قائمة','قائمة التشغيل'],['تكرار','تكرار المقطع'],['خلط','خلط القائمة'],['إيقاف-مؤقت','إيقاف مؤقت'],['استئناف','استئناف'],['صوت 70','مستوى الصوت']]},
    {value:'custom',label:'أوامري المخصصة',emoji:'🧩',desc:'الأوامر التي أضفتها من لوحة التحكم',rows:(Array.isArray(config.commands)?config.commands.filter(x=>x&&x.enabled!==false).map(x=>[String(x.name),String(x.description||'أمر مخصص')]):[])}
  ];
  const visible=categories.filter(c=>c.value==='general'||c.value==='custom'||(c.value==='admin'&&['moderation','automod','system','allinone'].includes(type))||(c.value==='welcome'&&['welcome','system','allinone'].includes(type))||(c.value==='tickets'&&['tickets','applications','allinone'].includes(type))||(c.value==='games'&&['games','allinone'].includes(type))||(c.value==='economy'&&['bank','economy','allinone'].includes(type))||(c.value==='music'&&['music','allinone'].includes(type)));
  const cat=visible.find(x=>x.value===selected)||visible[0];
  const lines=(cat.rows.length?cat.rows:[['لا توجد أوامر مخصصة','أضف أوامر من لوحة التحكم ثم احفظها.']]).slice(0,35).map(([n,d],i)=>'**'+(i+1)+'. '+(String(n).startsWith('/')?n:prefix+n)+'**\n'+d);
  const embed=new EmbedBuilder().setColor(0xff9cde).setTitle(cat.emoji+' '+cat.label).setDescription(cat.desc+'\n\n'+lines.join('\n\n')).setFooter({text:'MLD · '+cat.rows.length+' أمرًا/مدخلًا · اختر قسمًا من القائمة'}).setTimestamp();
  const menu=new StringSelectMenuBuilder().setCustomId('mldhelpselect:'+ownerId).setPlaceholder('اختر قسم الأوامر…').addOptions(visible.map(c=>({label:c.label,value:c.value,emoji:c.emoji,description:c.desc.slice(0,100),default:c.value===cat.value})));
  return {embeds:[embed],components:[new ActionRowBuilder().addComponents(menu)],allowedMentions:{parse:[]}};
}

function installBotFeatures(client,bot){
  // Unify user-facing bot responses into MLD embeds without changing command logic.
  const toMldEmbedPayload=(input)=>{
    const payload=typeof input==='string'?{content:input}:input&&typeof input==='object'?{...input}:{content:String(input??'')};
    if(payload.content&&!payload.embeds?.length){
      const embed=new EmbedBuilder().setColor(0xff9cde).setDescription(String(payload.content).slice(0,4000)).setFooter({text:'MLD · مجتمع ملاذ'}).setTimestamp();
      payload.embeds=[embed];
      delete payload.content;
    }
    return payload;
  };
  // Register these wrappers before command listeners so their replies are styled consistently.
  client.on(Events.MessageCreate,message=>{
    if(message.author?.bot||message.__mldEmbedReplyWrapped)return;
    const originalReply=message.reply.bind(message);
    message.reply=(payload,...args)=>originalReply(toMldEmbedPayload(payload),...args);
    Object.defineProperty(message,'__mldEmbedReplyWrapped',{value:true});
  });
  client.on(Events.InteractionCreate,interaction=>{
    if(!interaction.isChatInputCommand()&&!interaction.isButton()&&!interaction.isModalSubmit())return;
    for(const method of ['reply','followUp','editReply','update']){
      const original=interaction[method]?.bind(interaction);
      if(!original||interaction['__mldWrapped_'+method])continue;
      interaction[method]=(payload,...args)=>original(toMldEmbedPayload(payload),...args);
      Object.defineProperty(interaction,'__mldWrapped_'+method,{value:true});
    }
  });
  client.mldBotId=String(bot.id||client.user?.id||'');
  setupBank(client,pool);
  setupGames(client,pool);
  setupMusic(client);
  client.mldConfig=bot.settings&&typeof bot.settings==='object'?bot.settings:{};
  client.mldType=bot.bot_type||'general';
  setupAuditLogs(client);
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
    if(interaction.isChatInputCommand()){
      try{
        const config=client.mldConfig||{},name=interaction.commandName;
        const prefix=String(config.prefix||'!').slice(0,4);
        if(name==='ping')return interaction.reply({content:'🏓 البوت متصل ويعمل.',allowedMentions:{parse:[]}});
        if(name==='help'){
          return interaction.reply({...buildUserHelpPayload(client,interaction.user.id),ephemeral:true});
        }
        if(name==='server'){
          if(!interaction.guild)return interaction.reply({content:'هذا الأمر يعمل داخل السيرفر فقط.',ephemeral:true});
          return interaction.reply({embeds:[new EmbedBuilder().setColor(0xff9cde).setTitle('🌌 '+interaction.guild.name).setThumbnail(interaction.guild.iconURL({size:256})).addFields({name:'المالك',value:'<@'+interaction.guild.ownerId+'>',inline:true},{name:'الأعضاء',value:String(interaction.guild.memberCount),inline:true},{name:'القنوات',value:String(interaction.guild.channels.cache.size),inline:true}).setTimestamp()],allowedMentions:{parse:[]}});
        }
        if(name==='membercount'){
          if(!interaction.guild)return interaction.reply({content:'هذا الأمر يعمل داخل السيرفر فقط.',ephemeral:true});
          return interaction.reply({content:'👥 عدد أعضاء **'+interaction.guild.name+'**: **'+interaction.guild.memberCount+'**',allowedMentions:{parse:[]}});
        }
        if(name==='serverinfo'){
          if(!interaction.guild)return interaction.reply({content:'هذا الأمر يعمل داخل السيرفر فقط.',ephemeral:true});
          const g=interaction.guild;
          const embed=new EmbedBuilder().setColor(0xff9cde).setTitle('🌌 '+g.name).setThumbnail(g.iconURL({size:256})).addFields(
            {name:'المالك',value:'<@'+g.ownerId+'>',inline:true},
            {name:'الأعضاء',value:String(g.memberCount),inline:true},
            {name:'القنوات',value:String(g.channels.cache.size),inline:true},
            {name:'الرتب',value:String(g.roles.cache.size),inline:true},
            {name:'تاريخ الإنشاء',value:'<t:'+Math.floor(g.createdTimestamp/1000)+':D>',inline:true},
            {name:'المعرّف',value:g.id,inline:true}
          ).setFooter({text:'MLD · مجتمع ملاذ'}).setTimestamp();
          return interaction.reply({embeds:[embed],allowedMentions:{parse:[]}});
        }
        if(name==='servericon'){
          if(!interaction.guild)return interaction.reply({content:'هذا الأمر يعمل داخل السيرفر فقط.',ephemeral:true});
          const url=interaction.guild.iconURL({size:1024});
          return interaction.reply({content:url?'🖼️ أيقونة السيرفر: '+url:'السيرفر لا يملك أيقونة.' ,allowedMentions:{parse:[]}});
        }
        if(name==='channelcount'){
          if(!interaction.guild)return interaction.reply({content:'هذا الأمر يعمل داخل السيرفر فقط.',ephemeral:true});
          return interaction.reply({content:'📚 عدد قنوات السيرفر: **'+interaction.guild.channels.cache.size+'**',allowedMentions:{parse:[]}});
        }
        if(name==='roles'){
          if(!interaction.guild)return interaction.reply({content:'هذا الأمر يعمل داخل السيرفر فقط.',ephemeral:true});
          const roles=[...interaction.guild.roles.cache.values()].filter(r=>r.id!==interaction.guild.id).sort((a,b)=>b.position-a.position);
          return interaction.reply({content:'🎭 **رتب السيرفر ('+roles.length+')**\\n'+(roles.slice(0,25).map(r=>'• '+r.name+' — '+r.members.size+' عضو').join('\\n')||'لا توجد رتب إضافية.'),allowedMentions:{parse:[]}});
        }
        if(name==='roll'){
          const max=Math.max(2,Math.min(1000000,Number(interaction.options.getInteger('max')||6)));
          return interaction.reply({content:'🎲 النتيجة: **'+(Math.floor(Math.random()*max)+1)+'** (من 1 إلى '+max+')',allowedMentions:{parse:[]}});
        }
        if(name==='random'){
          const min=interaction.options.getInteger('min'),max=interaction.options.getInteger('max');
          if(min>max||max-min>100000000)return interaction.reply({content:'الحد الأعلى يجب أن يكون أكبر من أو يساوي الحد الأدنى، والفارق لا يتجاوز 100 مليون.',ephemeral:true});
          return interaction.reply({content:'🎲 النتيجة العشوائية: **'+(Math.floor(Math.random()*(max-min+1))+min)+'**',allowedMentions:{parse:[]}});
        }
        if(name==='coinflip')return interaction.reply({content:'🪙 النتيجة: **'+(Math.random()<0.5?'صورة':'كتابة')+'**',allowedMentions:{parse:[]}});
        if(name==='eightball'){
          const answers=['أكيد! ✨','غالبًا نعم.','الوضع مبشّر.','ممكن جدًا.','خلنا نشوف 😄','مو واضح للحين.','غالبًا لا.','جرّب مرة ثانية لاحقًا.'];
          return interaction.reply({content:'🔮 **السؤال:** '+interaction.options.getString('question')+'\\n**الإجابة:** '+answers[Math.floor(Math.random()*answers.length)],allowedMentions:{parse:[]}});
        }
        if(name==='joke'){
          const jokes=['مرة واحد قال للبوت: أنت ذكي؟ قال: على حسب الاتصال. 😂','واحد دخل يلعب جولة وحدة، رجع بعد ثلاث ساعات يقول آخر جولة. 😭','قالوا له ليش ما تفوز؟ قال: أنا جاي أرفع المعنويات. 😎'];
          return interaction.reply({content:jokes[Math.floor(Math.random()*jokes.length)],allowedMentions:{parse:[]}});
        }
        if(name==='uptime'){
          const seconds=Math.max(0,Math.floor((Date.now()-(client.readyTimestamp||Date.now()))/1000));
          return interaction.reply({content:'⏱️ مدة تشغيل البوت: '+Math.floor(seconds/86400)+' يوم، '+Math.floor(seconds%86400/3600)+' ساعة، '+Math.floor(seconds%3600/60)+' دقيقة.',allowedMentions:{parse:[]}});
        }
        if(name==='avatar'||name==='userinfo'){
          const user=interaction.options.getUser('user')||interaction.user;
          if(name==='avatar')return interaction.reply({content:'🖼️ صورة '+user.username+': '+user.displayAvatarURL({size:1024}),allowedMentions:{parse:[]}});
          const member=interaction.guild?await interaction.guild.members.fetch(user.id).catch(()=>null):null;
          const roles=member?[...member.roles.cache.values()].filter(r=>r.id!==interaction.guild.id).sort((a,b)=>b.position-a.position).slice(0,12).map(r=>r.toString()).join('، '):'—';
          const embed=new EmbedBuilder().setColor(0xff9cde).setTitle('👤 معلومات العضو').setThumbnail(user.displayAvatarURL({size:256})).addFields({name:'الاسم',value:String(user.tag||user.username).slice(0,100),inline:true},{name:'المعرّف',value:user.id,inline:true},{name:'تاريخ إنشاء الحساب',value:'<t:'+Math.floor(user.createdTimestamp/1000)+':D>',inline:true},{name:'تاريخ دخول السيرفر',value:member?.joinedTimestamp?'<t:'+Math.floor(member.joinedTimestamp/1000)+':D>':'غير معروف',inline:true},{name:'الرتب',value:roles.slice(0,1000)||'لا توجد رتب إضافية'}).setTimestamp();
          return interaction.reply({embeds:[embed],allowedMentions:{parse:[]}});
        }
        const custom=(Array.isArray(config.commands)?config.commands:[]).find(x=>x&&x.enabled!==false&&String(x.name||'').toLowerCase()===name);
        if(custom){
          const reply=String(custom.response||'').slice(0,1800).replaceAll('{user}',interaction.user.username).replaceAll('{server}',interaction.guild?.name||'Discord').replaceAll('{memberCount}',String(interaction.guild?.memberCount||0)).replaceAll('{args}',String(interaction.options.getString('args')||''));
          return interaction.reply({content:reply||'تم تنفيذ الأمر.',allowedMentions:{parse:[]}});
        }
        return interaction.reply({content:'الأمر غير متاح حاليًا. استخدم /help.',ephemeral:true});
      }catch(error){
        console.error('User bot slash command:',error?.stack||error);
        const payload={content:'صار خطأ أثناء تنفيذ الأمر. حاول مرة ثانية.',ephemeral:true};
        if(interaction.replied||interaction.deferred)return interaction.followUp(payload).catch(()=>{});
        return interaction.reply(payload).catch(()=>{});
      }
    }
    if(interaction.isStringSelectMenu?.()&&interaction.customId.startsWith('mldhelpselect:')){
      const ownerId=interaction.customId.split(':')[1];
      if(interaction.user.id!==ownerId&&!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild))return interaction.reply({content:'هذه القائمة تخص عضوًا آخر. استخدم /help لفتح قائمتك.',ephemeral:true}).catch(()=>{});
      return interaction.update(buildUserHelpPayload(client,ownerId,interaction.values?.[0]||'general')).catch(()=>{});
    }
    if(!interaction.isButton())return;
    if(interaction.customId.startsWith('mldhelp:')){
      const [,ownerId,pageRaw]=interaction.customId.split(':');
      if(interaction.user.id!==ownerId&&!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild))return interaction.reply({content:'هذه القائمة تخص عضوًا آخر. استخدم أمر help لفتح قائمتك.',ephemeral:true}).catch(()=>{});
      const page=Number(pageRaw)||1,prefix=String(client.mldConfig?.prefix||'!').slice(0,4),config=client.mldConfig||{},type=client.mldType||'general';
      const rows=[['ping','فحص الاتصال'],['help [رقم]','دليل الأوامر'],['server','معلومات السيرفر'],['membercount','عدد الأعضاء'],['members','اختصار عدد الأعضاء'],['userinfo @عضو','معلومات عضو'],['avatar [@عضو]','الصورة الشخصية']];
      if(['moderation','automod','system','allinone'].includes(type))rows.push(['warn @عضو السبب','تنبيه'],['kick @عضو السبب','طرد'],['ban @عضو السبب','حظر'],['clear 10','حذف رسائل'],['say نص','إرسال نص'],['slowmode ثواني','بطء القناة'],['lock','قفل الكتابة'],['unlock','فتح الكتابة'],['timeout @عضو دقائق','تقييد'],['untimeout @عضو','إلغاء التقييد'],['nick @عضو الاسم','تغيير لقب'],['roleadd @عضو @رتبة','إضافة رتبة'],['roleremove @عضو @رتبة','إزالة رتبة'],['poll سؤال','تصويت'],['announce #روم نص','إعلان']);
      if(['applications','allinone'].includes(type))rows.push(['تقديم','بدء التقديم'],['apply','اختصار التقديم'],['طلباتي','متابعة الطلب'],['تذكرة','إنشاء تذكرة'],['ticket','اختصار التذكرة'],['قفل','إغلاق التذكرة'],['إضافة @عضو','إضافة عضو للتذكرة']);
      if(['games','allinone'].includes(type))rows.push(...['سالفة','برا السالفة','روليت','مافيا','كت','زر','بومب','تصويت','ايفنت','اعلام','فكك','ترتيب','صحح','جمع','مفرد','حيوانات','شركة','ضرب','طرح','ترجمة','عواصم','اعكس','اسرع','حرف','ادمج','توب','هايد','فخ','حجره','اكس','المتجر','تحويل','ايقاف'].map(n=>[n,'لعبة أو أمر نقاط']));
      if(['bank','allinone'].includes(type))rows.push(...[['رصيد','عرض الرصيد'],['فلوس','اختصار الرصيد'],['يومي','مكافأة يومية'],['تحويل @عضو مبلغ','تحويل رصيد'],['تبرع @عضو مبلغ','التبرع'],['قرض','طلب قرض'],['سداد','سداد قرض'],['استثمار','استثمار'],['صندوق','الصندوق'],['تداول','التداول']]);
      if(['music','allinone'].includes(type))rows.push(...[['شغل اسم/رابط','تشغيل مقطع'],['وقف','إيقاف'],['التالي','تخطي'],['قائمة','قائمة التشغيل'],['تكرار','التكرار'],['خلط','خلط القائمة'],['إيقاف-مؤقت','إيقاف مؤقت'],['استئناف','استئناف'],['صوت 70','الصوت']]);
      rows.push(...(Array.isArray(config.commands)?config.commands.filter(x=>x&&x.enabled!==false).map(x=>[String(x.name),String(x.description||'أمر مخصص')]):[]));
      const size=6,total=Math.max(1,Math.ceil(rows.length/size)),p2=Math.max(1,Math.min(total,page)),items=rows.slice((p2-1)*size,p2*size);
      const embed=new EmbedBuilder().setColor(0xff9cde).setTitle('📚 دليل أوامر '+client.user.username).setDescription(items.map(([n,d],i)=>'**'+((p2-1)*size+i+1)+'. '+prefix+n+'**\n'+d).join('\n\n')).setFooter({text:'MLD · صفحة '+p2+' من '+total+' · '+rows.length+' مدخلًا'}).setTimestamp();
      const nav=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('mldhelp:'+ownerId+':'+Math.max(1,p2-1)).setLabel('السابق').setEmoji('⬅️').setStyle(ButtonStyle.Secondary).setDisabled(p2<=1),new ButtonBuilder().setCustomId('mldhelp:'+ownerId+':'+Math.min(total,p2+1)).setLabel('التالي').setEmoji('➡️').setStyle(ButtonStyle.Primary).setDisabled(p2>=total));
      return interaction.update({embeds:[embed],components:[nav]}).catch(()=>{});
    }
    if(!interaction.customId.startsWith('mldapp:'))return;
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
      await writeRuntimeLog(client.mldBotId,interaction.user.id,'bot.application_decision',{guildId,userId,decision:action});
      const user=await client.users.fetch(userId).catch(()=>null);
      await user?.send(action==='accept'?'تم قبول طلبك في '+interaction.guild.name+'.':'تم رفض طلبك في '+interaction.guild.name+'.').catch(()=>{});
    }catch(e){console.error('Application decision:',e.message);await interaction.reply({content:'تعذر تطبيق القرار. تحقق من رتبة البوت وصلاحياته.',ephemeral:true}).catch(()=>{});}
  });
  client.on(Events.MessageCreate,async message=>{
    if(!message.guild||message.author.bot)return;
    try {
    const config=client.mldConfig||{},type=client.mldType||'general';
    const prefix=String(config.prefix||'!').slice(0,4);
    const content=String(message.content||'');
    if(/^(?:help|مساعدة|هيلب)$/i.test(content.trim()))return message.reply({...buildUserHelpPayload(client,message.author.id),allowedMentions:{parse:[]}}).catch(()=>{});
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
        await writeRuntimeLog(client.mldBotId,message.author.id,'bot.automod_action',{guildId:message.guild.id,channelId:message.channel.id,reason});
        const notice=await message.channel.send({content:'⚠️ '+message.author.toString()+' تم حذف رسالتك: '+reason+'.',allowedMentions:{users:[message.author.id]}}).catch(()=>null);
        if(notice)setTimeout(()=>notice.delete().catch(()=>{}),5000);
        await logToChannel(message.guild,config.modLogChannelId,'🛡️ إجراء حماية تلقائي: '+reason+' | العضو '+message.author.tag+' | القناة #'+message.channel.name);
        return;
      }
    }
    const mentionPrefix=client.user?new RegExp('^<@!?'+client.user.id+'>\\s*'):null;
    const mentionMatch=mentionPrefix?content.match(mentionPrefix):null;
    const mentionCommand=!!mentionMatch;
    const commandSource=mentionMatch?content.slice(mentionMatch[0].length).trim():content;
    const hasPrefix=commandSource.startsWith(prefix)||mentionCommand;
    const firstWord=String(commandSource.split(/\s+/)[0]||'').toLowerCase();
    const noPrefixCustom=!hasPrefix?(Array.isArray(client.mldConfig?.commands)?client.mldConfig.commands:[]).find(x=>x&&x.enabled!==false&&x.noPrefix===true&&(String(x.name||'').toLowerCase()===firstWord||(Array.isArray(x.aliases)&&x.aliases.some(a=>String(a).toLowerCase()===firstWord)))):null;
    if(!hasPrefix&&!noPrefixCustom){
      if(message.mentions.has(client.user)&&!content.trim())return message.reply('أنا متصل، لكن قراءة أوامر البادئة تحتاج تفعيل Message Content Intent من Discord Developer Portal.').catch(()=>{});
      return;
    }
    const commandText=hasPrefix?(commandSource.startsWith(prefix)?commandSource.slice(prefix.length).trim():commandSource):commandSource;
    const [raw,...args]=commandText.split(/\s+/);let command=String(raw||'').toLowerCase();const aliasMatch=(Array.isArray(client.mldConfig?.commands)?client.mldConfig.commands:[]).find(x=>x&&x.enabled!==false&&Array.isArray(x.aliases)&&x.aliases.some(a=>String(a).toLowerCase()===command));if(aliasMatch&&!['help','ping','server','serverinfo','servericon','roles','channelcount','roll','random','coinflip','eightball','joke','command','kick','ban','clear','say','announce','slowmode','lock','unlock','timeout','untimeout','warn','nick','roleadd','roleremove','userinfo','avatar','membercount','members','prefix','بادئة','setprefix','تغييرالبادئة','uptime','مدةالتشغيل','botinfo','معلوماتالبوت','joined','انضممت','boosts','التعزيزات','emojis','الايموجيات','إيموجيات','roleinfo','معلوماترتبة','channelinfo','معلوماتروم','عشوائي','invite','رابط','poll','ticket','تذكرة','قفل','close','إضافة','add','تقديم','apply','طلباتي'].includes(command))command=String(aliasMatch.name||command).toLowerCase();
    if(noPrefixCustom)command=String(noPrefixCustom.name||command).toLowerCase();
    if(!command)return;
    const disabledCommands=Array.isArray(client.mldConfig?.disabledCommands)?client.mldConfig.disabledCommands.map(x=>String(x).toLowerCase()):[];
    if(disabledCommands.includes(command)||disabledCommands.includes(String(raw||'').toLowerCase()))return message.reply('هذا الأمر معطّل حاليًا من لوحة تحكم البوت.');
    await writeRuntimeLog(client.mldBotId,message.author.id,'bot.command_used',{command,guildId:message.guild.id,channelId:message.channel.id});
    const requiredPermission={
      kick:PermissionFlagsBits.KickMembers,ban:PermissionFlagsBits.BanMembers,unban:PermissionFlagsBits.BanMembers,'فكحظر':PermissionFlagsBits.BanMembers,allbans:PermissionFlagsBits.BanMembers,'قائمةالمحظورين':PermissionFlagsBits.BanMembers,clear:PermissionFlagsBits.ManageMessages,say:PermissionFlagsBits.ManageMessages,
      announce:PermissionFlagsBits.ManageMessages,slowmode:PermissionFlagsBits.ManageChannels,lock:PermissionFlagsBits.ManageChannels,unlock:PermissionFlagsBits.ManageChannels,
      timeout:PermissionFlagsBits.ModerateMembers,untimeout:PermissionFlagsBits.ModerateMembers,warn:PermissionFlagsBits.ModerateMembers,
      nick:PermissionFlagsBits.ManageNicknames,roleadd:PermissionFlagsBits.ManageRoles,roleremove:PermissionFlagsBits.ManageRoles,rolecreate:PermissionFlagsBits.ManageRoles,'انشاءرتبة':PermissionFlagsBits.ManageRoles,roledelete:PermissionFlagsBits.ManageRoles,'حذفرتبة':PermissionFlagsBits.ManageRoles,command:PermissionFlagsBits.ManageGuild,setprefix:PermissionFlagsBits.ManageGuild,'تغييرالبادئة':PermissionFlagsBits.ManageGuild,invite:PermissionFlagsBits.CreateInstantInvite,'رابط':PermissionFlagsBits.CreateInstantInvite
    }[command];
    if(requiredPermission){
      if(!message.member.permissions.has(requiredPermission)){await writeRuntimeLog(client.mldBotId,message.author.id,'bot.command_denied',{command,guildId:message.guild.id,channelId:message.channel.id,reason:'missing_member_permission'});return message.reply('ما عندك صلاحية Discord المطلوبة لتنفيذ هذا الأمر.');}
      const botMember=message.guild.members.me;
      if(!botMember?.permissions.has(requiredPermission)){await writeRuntimeLog(client.mldBotId,message.author.id,'bot.command_denied',{command,guildId:message.guild.id,channelId:message.channel.id,reason:'missing_bot_permission'});return message.reply('البوت نفسه يحتاج صلاحية Discord المطلوبة لتنفيذ هذا الأمر.');}
    }
    if(command==='id'||command==='معرف'){
      const member=message.mentions.members.first()||message.member;
      const u=member.user;
      return message.reply({embeds:[new EmbedBuilder().setColor(0xff9cde).setTitle('🪪 معلومات المعرّف').setThumbnail(u.displayAvatarURL({size:256})).addFields({name:'العضو',value:u.tag||u.username,inline:true},{name:'معرّف Discord',value:'`'+u.id+'`',inline:true},{name:'تاريخ إنشاء الحساب',value:'<t:'+Math.floor(u.createdTimestamp/1000)+':F>'})],allowedMentions:{parse:[]}});
    }
    if(command==='banner'||command==='بنر'){
      const user=message.mentions.users.first()||message.author;
      const full=await client.users.fetch(user.id,{force:true}).catch(()=>user);
      const url=full.bannerURL?.({size:1024,extension:'png'})||null;
      if(!url)return message.reply('ما عند هذا الحساب بنر ظاهر.');
      return message.reply({embeds:[new EmbedBuilder().setColor(0xff9cde).setTitle('🖼️ بنر '+(full.tag||full.username)).setImage(url).setURL(url)],allowedMentions:{parse:[]}});
    }
    if(command==='profile'||command==='ملفي'||command==='بروفايل'){
      const member=message.mentions.members.first()||message.member;
      const u=member.user;
      const roles=member.roles.cache.filter(r=>r.id!==message.guild.id).sort((a,b)=>b.position-a.position).map(r=>r.toString());
      const embed=new EmbedBuilder().setColor(0xff9cde).setTitle('👤 الملف الشخصي').setThumbnail(u.displayAvatarURL({size:256})).addFields(
        {name:'الاسم',value:member.displayName||u.username,inline:true},
        {name:'المعرّف',value:'`'+u.id+'`',inline:true},
        {name:'انضم للسيرفر',value:member.joinedTimestamp?'<t:'+Math.floor(member.joinedTimestamp/1000)+':R>':'غير معروف',inline:true},
        {name:'الحساب منذ',value:'<t:'+Math.floor(u.createdTimestamp/1000)+':D>',inline:true},
        {name:'الرتب',value:roles.slice(0,12).join('، ')||'لا توجد رتب إضافية',inline:false}
      ).setTimestamp();
      return message.reply({embeds:[embed],allowedMentions:{parse:[]}});
    }
    if(command==='myinv'||command==='دعواتي'){
      try{
        const invites=await message.guild.invites.fetch();
        const mine=invites.filter(inv=>inv.inviter?.id===message.author.id);
        const total=mine.reduce((sum,inv)=>sum+(inv.uses||0),0);
        const lines=mine.sort((a,b)=>(b.uses||0)-(a.uses||0)).first(10).map(inv=>'• '+inv.url+' — **'+(inv.uses||0)+'** استخدام');
        return message.reply({embeds:[new EmbedBuilder().setColor(0xff9cde).setTitle('🔗 دعواتك').setDescription('إجمالي الاستخدامات المسجلة: **'+total+'**\nعدد روابط الدعوة: **'+mine.size+'**\n\n'+(lines.join('\n')||'ما عندك روابط دعوة مسجلة.')).setFooter({text:'MLD · مجتمع ملاذ'})],allowedMentions:{parse:[]}});
      }catch{return message.reply('ما قدرت أقرأ الدعوات. تأكد أن البوت عنده صلاحية إدارة السيرفر.');}
    }
    if(command==='topinv'||command==='توبدعوات'){
      try{
        const invites=await message.guild.invites.fetch();
        const totals=new Map();
        for(const inv of invites.values())if(inv.inviter)totals.set(inv.inviter.id,(totals.get(inv.inviter.id)||0)+(inv.uses||0));
        const sorted=[...totals.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10);
        const lines=await Promise.all(sorted.map(async([id,uses,i])=>{const u=await client.users.fetch(id).catch(()=>null);return '**'+(sorted.findIndex(x=>x[0]===id)+1)+'.** '+(u?.username||'عضو')+' — **'+uses+'** دعوة';}));
        return message.reply({embeds:[new EmbedBuilder().setColor(0xff9cde).setTitle('🏆 أعلى الدعوات').setDescription(lines.join('\n')||'ما فيه بيانات دعوات مسجلة.').setFooter({text:'MLD · مجتمع ملاذ'})],allowedMentions:{parse:[]}});
      }catch{return message.reply('ما قدرت أقرأ الدعوات. تأكد من صلاحيات البوت.');}
    }
    if(command==='user'||command==='مستخدم'){
      const member=message.mentions.members.first()||message.guild.members.cache.get(args[0])||message.member;
      const u=member.user;
      return message.reply({embeds:[new EmbedBuilder().setColor(0xff9cde).setTitle('👤 بطاقة العضو').setThumbnail(u.displayAvatarURL({size:256})).addFields({name:'الاسم',value:member.displayName||u.username,inline:true},{name:'الحساب',value:'<@'+u.id+'>',inline:true},{name:'الرتب',value:member.roles.cache.filter(r=>r.id!==message.guild.id).map(r=>r.toString()).slice(0,10).join('، ')||'لا توجد',inline:false},{name:'انضم للسيرفر',value:member.joinedTimestamp?'<t:'+Math.floor(member.joinedTimestamp/1000)+':R>':'غير معروف',inline:true})],allowedMentions:{parse:[]}});
    }
    if(command==='ping')return message.reply({content:'🏓 البوت متصل ويعمل.',allowedMentions:{parse:[]}});
    if(command==='prefix'||command==='بادئة')
      return message.reply({content:'🔧 بادئة أوامري الحالية: `'+prefix+'`\nجرّب: `'+prefix+'help` أو `'+prefix+'ping`',allowedMentions:{parse:[]}});
    if(command==='setprefix'||command==='تغييرالبادئة'){
      if(!message.member.permissions.has(PermissionFlagsBits.ManageGuild))return message.reply('تحتاج صلاحية إدارة السيرفر لتغيير البادئة.');
      const nextPrefix=String(args[0]||'').trim();
      if(!nextPrefix||nextPrefix.length>4||/\s/.test(nextPrefix))return message.reply('استخدم: '+prefix+'setprefix ! (من 1 إلى 4 رموز بدون مسافات).');
      const next={...config,prefix:nextPrefix};
      try{if(pool)await pool.query('UPDATE bots SET settings=$1::jsonb WHERE id=$2',[JSON.stringify(next),String(client.mldBotId)]);client.mldConfig=next;return message.reply('✅ تم تغيير بادئة الأوامر إلى: `'+nextPrefix+'`');}
      catch(error){console.error('Prefix save:',error.message);return message.reply('تعذر حفظ البادئة. حاول مرة ثانية.');}
    }
    if(command==='uptime'||command==='مدةالتشغيل'){
      const seconds=Math.max(0,Math.floor((Date.now()-(client.readyTimestamp||Date.now()))/1000));
      const days=Math.floor(seconds/86400),hours=Math.floor(seconds%86400/3600),minutes=Math.floor(seconds%3600/60),secs=seconds%60;
      return message.reply({content:'⏱️ مدة تشغيل البوت: '+days+' يوم، '+hours+' ساعة، '+minutes+' دقيقة، '+secs+' ثانية.',allowedMentions:{parse:[]}});
    }
    if(command==='botinfo'||command==='معلوماتالبوت'){
      const embed=new EmbedBuilder().setColor(0xff9cde).setTitle('🤖 '+client.user.username).setThumbnail(client.user.displayAvatarURL({size:256})).addFields(
        {name:'المعرّف',value:client.user.id,inline:true},
        {name:'السيرفرات المتصلة',value:String(client.guilds.cache.size),inline:true},
        {name:'البادئة',value:'`'+prefix+'`',inline:true},
        {name:'مدة التشغيل',value:Math.floor((Date.now()-(client.readyTimestamp||Date.now()))/1000)+' ثانية',inline:true}
      ).setTimestamp();
      return message.reply({embeds:[embed],allowedMentions:{parse:[]}});
    }
    if(command==='joined'||command==='انضممت'){
      const member=message.mentions.members.first()||message.member;
      return message.reply({content:'📅 '+member.toString()+' انضم إلى السيرفر '+(member.joinedTimestamp?'<t:'+Math.floor(member.joinedTimestamp/1000)+':R>':'في وقت غير معروف')+'.',allowedMentions:{users:[member.id]}});
    }
    if(command==='boosts'||command==='التعزيزات'){
      return message.reply({content:'🚀 تعزيزات السيرفر: **'+message.guild.premiumSubscriptionCount+'** · مستوى التعزيز: **'+message.guild.premiumTier+'**',allowedMentions:{parse:[]}});
    }
    if(command==='emojis'||command==='الايموجيات'||command==='إيموجيات'){
      const emojis=[...message.guild.emojis.cache.values()];
      return message.reply({content:'😄 **إيموجيات السيرفر ('+emojis.length+')**\n'+(emojis.slice(0,45).map(e=>e.toString()).join(' ')||'ما فيه إيموجيات مخصصة.')+(emojis.length>45?'\n… والباقي أكثر من 45.':''),allowedMentions:{parse:[]}});
    }
    if(command==='roleinfo'||command==='معلوماترتبة'){
      const role=message.mentions.roles.first()||message.guild.roles.cache.get(args[0])||message.guild.roles.cache.find(r=>r.name.toLowerCase()===args.join(' ').toLowerCase());
      if(!role)return message.reply('منشن الرتبة أو اكتب معرّفها. مثال: '+prefix+'roleinfo @الرتبة');
      return message.reply({content:'🎭 **'+role.name+'**\nالمعرّف: `'+role.id+'`\nالأعضاء: **'+role.members.size+'**\nاللون: **'+(role.hexColor||'#000000')+'**\nالترتيب: **'+role.position+'**',allowedMentions:{parse:[]}});
    }
    if(command==='channelinfo'||command==='معلوماتروم'){
      const channel=message.mentions.channels.first()||message.guild.channels.cache.get(args[0])||message.channel;
      return message.reply({content:'📚 **'+channel.name+'**\nالمعرّف: `'+channel.id+'`\nالنوع: **'+String(channel.type)+'**\nتاريخ الإنشاء: <t:'+Math.floor(channel.createdTimestamp/1000)+':D>',allowedMentions:{parse:[]}});
    }
    if(command==='random'||command==='عشوائي'){
      const min=Number(args[0]),max=Number(args[1]);
      if(!Number.isFinite(min)||!Number.isFinite(max)||min>max||Math.abs(max-min)>100000000)return message.reply('استخدم: '+prefix+'random 1 100');
      return message.reply({content:'🎲 النتيجة: **'+(Math.floor(Math.random()*(max-min+1))+min)+'**',allowedMentions:{parse:[]}});
    }
    if(command==='invite'||command==='رابط'){
      if(!message.member.permissions.has(PermissionFlagsBits.CreateInstantInvite))return message.reply('تحتاج صلاحية إنشاء دعوة.');
      const invite=await message.channel.createInvite({maxAge:3600,maxUses:0,unique:true,reason:'طلب دعوة عبر أمر البوت'});
      return message.reply({content:'🔗 رابط دعوة صالح لمدة ساعة: '+invite.url,allowedMentions:{parse:[]}});
    }
            if(command==='help') {
      return message.reply({...buildUserHelpPayload(client,message.author.id),allowedMentions:{parse:[]}});
    }
    if(command==='command'){
      if(!message.member.permissions.has(PermissionFlagsBits.ManageGuild))return message.reply('إدارة الأوامر من Discord تتطلب صلاحية Manage Server.');
      const rawArgs=content.slice(prefix.length).trim().replace(/^\S+\s*/,'');
      const parts=rawArgs.split('|').map(x=>x.trim());
      const action=String(parts[0]||'').toLowerCase(),name=String(parts[1]||'').toLowerCase();
      const commands=Array.isArray(config.commands)?config.commands.map(x=>({...x})):[],index=commands.findIndex(x=>String(x.name||'').toLowerCase()===name);
      if(action==='list')return message.reply({content:commands.length?'**الأوامر المخصصة**\n'+commands.slice(0,25).map(x=>prefix+x.name+' — '+(x.enabled===false?'معطل':'مفعل')).join('\n'):'لا توجد أوامر مخصصة بعد.',allowedMentions:{parse:[]}});
      if(action==='add'){
        const commandName=String(parts[1]||'').toLowerCase(),description=String(parts[2]||'أمر مخصص'),response=String(parts.slice(3).join(' | ')||'');
        const reserved=['help','ping','server','command','kick','ban','clear','say','announce','slowmode','lock','unlock','timeout','untimeout','warn','nick','roleadd','roleremove','userinfo','avatar','membercount','members','poll','ticket','تذكرة','قفل','close','إضافة','add','تقديم','apply','طلباتي'];
        if(!/^[a-z0-9_-]{1,32}$/.test(commandName)||reserved.includes(commandName)||!response)return message.reply('الصيغة: '+prefix+'command add | اسم_انجليزي | الوصف | الرد. لا يمكن استخدام اسم أمر محجوز.');
        if(commands.some(x=>String(x.name||'').toLowerCase()===commandName))return message.reply('اسم الأمر مستخدم بالفعل.');
        commands.push({name:commandName,description:description.slice(0,100),response:response.slice(0,1800),enabled:true});
      }else if(action==='delete'||action==='remove'){
        if(index<0)return message.reply('الأمر المخصص غير موجود.');
        commands.splice(index,1);
      }else if(action==='toggle'){
        if(index<0)return message.reply('الأمر المخصص غير موجود.');
        commands[index].enabled=commands[index].enabled===false;
      }else if(action==='edit'){
        if(index<0||!parts[2])return message.reply('الصيغة: '+prefix+'command edit | اسم_الأمر | الرد الجديد');
        commands[index].response=parts.slice(2).join(' | ').slice(0,1800);
      }else return message.reply('إدارة الأوامر: '+prefix+'command list / add | اسم_انجليزي | الوصف | الرد / edit | الاسم | الرد / toggle | الاسم / delete | الاسم');
      const next={...config,commands};
      try{if(pool)await pool.query('UPDATE bots SET settings=$1::jsonb WHERE id=$2',[JSON.stringify(next),String(client.mldBotId)]);client.mldConfig=next;return message.reply('تم حفظ الأوامر المخصصة وتطبيقها فورًا.');}
      catch(e){console.error('Command settings save:',e.message);return message.reply('تعذر حفظ الإعدادات في قاعدة البيانات.');}
    }
    if(command==='server')return message.reply({content:'**'+message.guild.name+'**\\nالأعضاء: '+message.guild.memberCount,allowedMentions:{parse:[]}});

    // Common prefix commands are available for every user bot, not only selected bot types.
    if(['membercount','members','عدد','عددالأعضاء'].includes(command))
      return message.reply({content:'👥 عدد أعضاء **'+message.guild.name+'**: **'+message.guild.memberCount+'**',allowedMentions:{parse:[]}});
    if(['userinfo','whois','معلومات','معلوماتي'].includes(command)){
      const user=message.mentions.users.first()||message.author;
      const member=await message.guild.members.fetch(user.id).catch(()=>null);
      const roles=member?[...member.roles.cache.values()].filter(r=>r.id!==message.guild.id).sort((a,b)=>b.position-a.position).slice(0,12).map(r=>r.toString()).join('، '):'—';
      const embed=new EmbedBuilder().setColor(0xff9cde).setTitle('👤 معلومات العضو').setThumbnail(user.displayAvatarURL({size:256})).addFields(
        {name:'الاسم',value:String(user.tag||user.username).slice(0,100),inline:true},
        {name:'المعرّف',value:user.id,inline:true},
        {name:'تاريخ إنشاء الحساب',value:'<t:'+Math.floor(user.createdTimestamp/1000)+':D>',inline:true},
        {name:'تاريخ دخول السيرفر',value:member?.joinedTimestamp?'<t:'+Math.floor(member.joinedTimestamp/1000)+':D>':'غير معروف',inline:true},
        {name:'الرتب',value:roles.slice(0,1000)||'لا توجد رتب إضافية'}
      ).setTimestamp();
      return message.reply({embeds:[embed],allowedMentions:{parse:[]}});
    }
    if(['avatar','pfp','صورة','افتار'].includes(command)){
      const user=message.mentions.users.first()||message.author;
      return message.reply({content:'🖼️ صورة '+user.username+': '+user.displayAvatarURL({size:1024,extension:'png'}),allowedMentions:{parse:[]}});
    }
    if(['servericon','أيقونة','ايقونة'].includes(command)){
      const icon=message.guild.iconURL({size:1024});
      return message.reply({content:icon?'🖼️ أيقونة السيرفر: '+icon:'هذا السيرفر ما عنده أيقونة.',allowedMentions:{parse:[]}});
    }
    if(['serverinfo','معلوماتالسيرفر'].includes(command)){
      const embed=new EmbedBuilder().setColor(0xff9cde).setTitle('🌌 '+message.guild.name).setThumbnail(message.guild.iconURL({size:256})).addFields(
        {name:'المالك',value:'<@'+message.guild.ownerId+'>',inline:true},
        {name:'الأعضاء',value:String(message.guild.memberCount),inline:true},
        {name:'القنوات',value:String(message.guild.channels.cache.size),inline:true},
        {name:'الرتب',value:String(message.guild.roles.cache.size),inline:true},
        {name:'تاريخ الإنشاء',value:'<t:'+Math.floor(message.guild.createdTimestamp/1000)+':D>',inline:true},
        {name:'المعرّف',value:message.guild.id,inline:true}
      ).setTimestamp();
      return message.reply({embeds:[embed],allowedMentions:{parse:[]}});
    }
    if(['roles','الرتب'].includes(command)){
      const roles=[...message.guild.roles.cache.values()].filter(r=>r.id!==message.guild.id).sort((a,b)=>b.position-a.position);
      return message.reply({content:'🎭 **رتب السيرفر ('+roles.length+')**\n'+(roles.slice(0,35).map(r=>'• '+r.name+' — '+r.members.size+' عضو').join('\n')||'لا توجد رتب')+(roles.length>35?'\n… وباقي الرتب':'') ,allowedMentions:{parse:[]}});
    }
    if(['channelcount','القنوات'].includes(command))
      return message.reply({content:'📚 عدد قنوات السيرفر: **'+message.guild.channels.cache.size+'**',allowedMentions:{parse:[]}});
    if(['roll','dice','نرد'].includes(command)){
      const max=Math.max(2,Math.min(1000000,Number(args[0])||6));
      return message.reply({content:'🎲 النتيجة: **'+(Math.floor(Math.random()*max)+1)+'** (من 1 إلى '+max+')',allowedMentions:{parse:[]}});
    }
    if(['coinflip','عملة','flip'].includes(command))
      return message.reply({content:'🪙 '+(Math.random()<0.5?'صورة':'كتابة')+'!',allowedMentions:{parse:[]}});
    if(['8ball','سؤال'].includes(command)){
      if(!args.length)return message.reply('اكتب سؤالك بعد الأمر.');
      const answers=['أكيد! ✨','غالبًا نعم.','الوضع مبشّر.','ممكن جدًا.','خلنا نشوف 😄','مو واضح للحين.','غالبًا لا.','جرّب مرة ثانية لاحقًا.'];
      return message.reply({content:'🔮 '+answers[Math.floor(Math.random()*answers.length)],allowedMentions:{parse:[]}});
    }
    if(['choose','اختيار'].includes(command)){
      const options=args.join(' ').split(/[|،,]/).map(x=>x.trim()).filter(Boolean);
      if(options.length<2)return message.reply('استخدم: '+prefix+'choose خيار 1 | خيار 2');
      return message.reply({content:'🎯 أختار لك: **'+options[Math.floor(Math.random()*options.length)].slice(0,180)+'**',allowedMentions:{parse:[]}});
    }
    if(['poll','تصويت'].includes(command)){
      const question=args.join(' ').slice(0,900);
      if(!question)return message.reply('استخدم: '+prefix+'poll سؤال التصويت');
      const poll=await message.reply({content:'📊 **تصويت المجتمع**\n'+question,allowedMentions:{parse:[]}});
      await Promise.all([poll.react('👍').catch(()=>{}),poll.react('👎').catch(()=>{}),poll.react('🤷').catch(()=>{})]);
      return;
    }
    if(['say','قل'].includes(command)){
      if(!message.member.permissions.has(PermissionFlagsBits.ManageMessages))return message.reply('تحتاج صلاحية إدارة الرسائل.');
      const text=args.join(' ').slice(0,1800);if(!text)return message.reply('اكتب النص بعد الأمر.');
      await message.delete().catch(()=>{});
      return message.channel.send({content:text,allowedMentions:{parse:[]}});
    }
    if(['embed','إيمبد','امبد'].includes(command)){
      if(!message.member.permissions.has(PermissionFlagsBits.ManageMessages))return message.reply('تحتاج صلاحية إدارة الرسائل.');
      const parts=message.content.slice(prefix.length).trim().replace(/^\S+\s*/,'').split('|').map(x=>x.trim());
      if(!parts[0]||!parts[1])return message.reply('استخدم: '+prefix+'embed عنوان | وصف');
      const embed=new EmbedBuilder().setColor(0xff9cde).setTitle(parts[0].slice(0,256)).setDescription(parts.slice(1).join(' | ').slice(0,3500)).setFooter({text:'MLD · '+message.guild.name}).setTimestamp();
      return message.channel.send({embeds:[embed],allowedMentions:{parse:[]}});
    }
    if(['invite','رابط'].includes(command)){
      if(!message.member.permissions.has(PermissionFlagsBits.CreateInstantInvite))return message.reply('تحتاج صلاحية إنشاء دعوات.');
      const invite=await message.channel.createInvite({maxAge:3600,maxUses:0,unique:true,reason:'طلب دعوة عبر أمر البوت'}).catch(()=>null);
      return message.reply(invite?'🔗 رابط الدعوة (صالح ساعة): '+invite.url:'تعذر إنشاء الدعوة؛ تحقق من صلاحيات البوت.');
    }
    if(['joke','نكتة','نكت'].includes(command)){
      const jokes=['مرة مبرمج راح ينام… أخذ معه وضع السكون 😴','قال البوت: عندي شخصية مستقلة… بس تنتظر تحديث الإعدادات. 🤖','واحد قال: آخر جولة! اللعبة قالت: شفناك أمس تقولها. 🎮','ليش البوت ما يضيع؟ لأنه حافظ الـprefix. 😂'];
      return message.reply({content:jokes[Math.floor(Math.random()*jokes.length)],allowedMentions:{parse:[]}});
    }
    if(['hug','حضن','صفعة','slap'].includes(command)){
      const target=message.mentions.members.first();
      if(!target)return message.reply('منشن العضو أولًا.');
      return message.channel.send({content:(['hug','حضن'].includes(command)?'🫂 ':'👋 ')+message.author.toString()+( ['hug','حضن'].includes(command)?' حضن ':' عطى صفعة خفيفة لـ ')+target.toString(),allowedMentions:{users:[message.author.id,target.id]}});
    }

    if(['moderation','automod','system','allinone'].includes(type)){
      const target=message.mentions.members.first();
      const reason=args.slice(1).join(' ').slice(0,400)||'لم يذكر سبب';
      if(command==='serverinfo'||command==='معلوماتالسيرفر'||command==='سيرفر'){
        const g=message.guild;
        const c=g.channels.cache;
        const e=new EmbedBuilder().setColor(0xff9cde).setTitle('🏠 معلومات السيرفر').setThumbnail(g.iconURL({size:256})||null).addFields({name:'الاسم',value:g.name,inline:true},{name:'الأعضاء',value:String(g.memberCount),inline:true},{name:'الرتب',value:String(g.roles.cache.size-1),inline:true},{name:'الرومات النصية',value:String(c.filter(x=>x.type===ChannelType.GuildText||x.type===ChannelType.GuildAnnouncement).size),inline:true},{name:'الرومات الصوتية',value:String(c.filter(x=>x.type===ChannelType.GuildVoice||x.type===ChannelType.GuildStageVoice).size),inline:true},{name:'التعزيزات',value:String(g.premiumSubscriptionCount||0),inline:true},{name:'تاريخ الإنشاء',value:'<t:'+Math.floor(g.createdTimestamp/1000)+':D>',inline:true},{name:'المعرّف',value:g.id,inline:true}).setFooter({text:'MLD · مجتمع ملاذ'}).setTimestamp();
        return message.reply({embeds:[e],allowedMentions:{parse:[]}});
      }
      if(command==='warn'){
        if(!message.member.permissions.has('ModerateMembers'))return message.reply('تحتاج صلاحية Timeout Members لتنفيذ الأمر.');
        if(!target)return message.reply('استخدم الأمر هكذا: '+prefix+'warn @عضو السبب');
        if(message.guild.ownerId!==message.author.id&&target.roles.highest.position>=message.member.roles.highest.position)return message.reply('ما تقدر تنبه عضو رتبته مساوية أو أعلى من رتبتك.');
        await writeRuntimeLog(client.mldBotId,message.author.id,'bot.moderation_warn',{guildId:message.guild.id,channelId:message.channel.id,targetId:target.id,reason});
        await logToChannel(message.guild,config.modLogChannelId,'⚠️ تنبيه إداري (غير دائم) للعضو '+target.user.tag+' بواسطة '+message.author.tag+' | '+reason);
        return message.reply({content:'تم تسجيل التنبيه في سجل الإدارة. هذا التنبيه إشعار فقط ولا يُحفظ كعقوبة دائمة.',allowedMentions:{parse:[]}});
      }
      if(command==='unban'||command==='فكحظر'){
        if(!message.member.permissions.has(PermissionFlagsBits.BanMembers))return message.reply('تحتاج صلاحية حظر الأعضاء لفك الحظر.');
        if(!message.guild.members.me?.permissions.has(PermissionFlagsBits.BanMembers))return message.reply('البوت يحتاج صلاحية حظر الأعضاء.');
        const userId=String(args[0]||'').replace(/[<@!>]/g,'');
        if(!/^\d{17,20}$/.test(userId))return message.reply('استخدم: '+prefix+'unban معرّف_العضو [السبب]');
        const unbanReason=args.slice(1).join(' ').slice(0,400)||'تم فك الحظر بواسطة '+message.author.tag;
        try{await message.guild.bans.remove(userId,unbanReason);await writeRuntimeLog(client.mldBotId,message.author.id,'bot.moderation_unban',{guildId:message.guild.id,targetId:userId,reason:unbanReason});await logToChannel(message.guild,config.modLogChannelId,'♻️ فك حظر المعرّف '+userId+' بواسطة '+message.author.tag+' | '+unbanReason);return message.reply({content:'تم فك الحظر بنجاح عن المعرّف `'+userId+'`.',allowedMentions:{parse:[]}});}catch{return message.reply('تعذر فك الحظر. تأكد أن المعرّف محظور وأن صلاحيات البوت صحيحة.');}
      }
      if(command==='allbans'||command==='قائمةالمحظورين'){
        if(!message.member.permissions.has(PermissionFlagsBits.BanMembers))return message.reply('تحتاج صلاحية حظر الأعضاء لعرض القائمة.');
        if(!message.guild.members.me?.permissions.has(PermissionFlagsBits.BanMembers))return message.reply('البوت يحتاج صلاحية حظر الأعضاء.');
        try{const bans=await message.guild.bans.fetch();const entries=[...bans.values()].slice(0,40).map((entry,index)=>'**'+(index+1)+'.** '+(entry.user.tag||entry.user.username)+' (`'+entry.user.id+'`)'+(entry.reason?' — '+entry.reason.slice(0,100):''));const embed=new EmbedBuilder().setColor(0xff9cde).setTitle('🔨 قائمة المحظورين').setDescription(entries.join('\n').slice(0,4000)||'قائمة الحظر فارغة.').setFooter({text:'عدد المحظورين: '+bans.size+' · يعرض أول 40'}).setTimestamp();return message.reply({embeds:[embed],allowedMentions:{parse:[]}});}catch{return message.reply('تعذر جلب قائمة المحظورين. تحقق من صلاحيات البوت.');}
      }
      if(command==='kick'||command==='ban'){
        const permission=command==='kick'?'KickMembers':'BanMembers';
        if(!message.member.permissions.has(permission))return message.reply('ما عندك صلاحية تنفيذ هذا الإجراء.');
        if(!message.guild.members.me?.permissions.has(permission))return message.reply('البوت يحتاج صلاحية '+(command==='kick'?'Kick Members':'Ban Members')+'.');
        if(!target)return message.reply('اذكر العضو المطلوب.');
        if(target.id===message.author.id||target.id===client.user.id)return message.reply('ما تقدر تستخدم الأمر على نفسك أو البوت.');
        if(message.guild.ownerId!==message.author.id&&target.roles.highest.position>=message.member.roles.highest.position)return message.reply('ما تقدر تستهدف عضو رتبته مساوية أو أعلى من رتبتك.');
        if(target.roles.highest.position>=message.guild.members.me.roles.highest.position)return message.reply('رتبة البوت يجب أن تكون أعلى من رتبة العضو المستهدف.');
        try{if(command==='kick')await target.kick(reason);else await target.ban({reason});await writeRuntimeLog(client.mldBotId,message.author.id,'bot.moderation_'+command,{guildId:message.guild.id,channelId:message.channel.id,targetId:target.id,reason});await logToChannel(message.guild,config.modLogChannelId,'🔨 '+(command==='kick'?'طرد':'حظر')+' العضو '+target.user.tag+' بواسطة '+message.author.tag+' | '+reason);return message.reply({content:'تم '+(command==='kick'?'طرد':'حظر')+' العضو بنجاح.',allowedMentions:{parse:[]}});}catch{return message.reply('تعذر تنفيذ الإجراء. تحقق من ترتيب الرتب وصلاحيات البوت.');}
      }
      if(command==='clear'){
        if(!message.member.permissions.has('ManageMessages'))return message.reply('تحتاج صلاحية إدارة الرسائل.');
        if(!message.guild.members.me?.permissions.has('ManageMessages'))return message.reply('البوت يحتاج صلاحية إدارة الرسائل.');
        const amount=Number(args[0]);if(!Number.isInteger(amount)||amount<1||amount>100)return message.reply('حدد عددًا من 1 إلى 100: '+prefix+'clear 10');
        const deleted=await message.channel.bulkDelete(amount,true).catch(()=>null);if(!deleted)return message.reply('تعذر حذف الرسائل؛ قد تكون أقدم من 14 يومًا.');
        await writeRuntimeLog(client.mldBotId,message.author.id,'bot.moderation_clear',{guildId:message.guild.id,channelId:message.channel.id,deleted:deleted.size});const note=await message.channel.send('تم حذف '+deleted.size+' رسالة.').catch(()=>null);if(note)setTimeout(()=>note.delete().catch(()=>{}),4000);return;
      }
      if(command==='membercount'||command==='members')return message.reply({content:'👥 عدد أعضاء السيرفر: **'+message.guild.memberCount+'**',allowedMentions:{parse:[]}});
      if(command==='userinfo'||command==='avatar'){
        const user=message.mentions.users.first()||message.author;
        if(command==='avatar')return message.reply({content:user.displayAvatarURL({size:1024,extension:'png'}),allowedMentions:{parse:[]}});
        const member=await message.guild.members.fetch(user.id).catch(()=>null);
        const roles=member?[...member.roles.cache.values()].filter(r=>r.id!==message.guild.id).sort((a,b)=>b.position-a.position).slice(0,8).map(r=>r.name).join('، '):'—';
        return message.reply({content:'👤 **'+user.tag+'**\nالمعرّف: '+user.id+'\nانضم: '+(member?.joinedAt?.toLocaleDateString('ar-SA')||'—')+'\nالرتب: '+(roles||'لا توجد رتب إضافية'),allowedMentions:{parse:[]}});
      }
      if(command==='say'){
        if(!message.member.permissions.has(PermissionFlagsBits.ManageMessages))return message.reply('تحتاج صلاحية إدارة الرسائل.');
        const text=args.join(' ').slice(0,1800);if(!text)return message.reply('اكتب النص بعد الأمر.');
        await message.delete().catch(()=>{});return message.channel.send({content:text,allowedMentions:{parse:[]}});
      }
      if(command==='slowmode'){
        if(!message.member.permissions.has(PermissionFlagsBits.ManageChannels))return message.reply('تحتاج صلاحية إدارة القنوات.');
        const seconds=Number(args[0]);if(!Number.isInteger(seconds)||seconds<0||seconds>21600)return message.reply('حدد مدة من 0 إلى 21600 ثانية.');
        await message.channel.setRateLimitPerUser(seconds,'إعداد البوت');
        return message.reply('🐢 تم ضبط وضع البطء على '+seconds+' ثانية.');
      }
      if(command==='lock'||command==='unlock'){
        if(!message.member.permissions.has(PermissionFlagsBits.ManageChannels))return message.reply('تحتاج صلاحية إدارة القنوات.');
        await message.channel.permissionOverwrites.edit(message.guild.id,{SendMessages:command==='lock'?false:null});
        return message.reply(command==='lock'?'🔒 تم قفل الكتابة في القناة.':'🔓 تم فتح الكتابة في القناة.');
      }
      if(command==='timeout'||command==='untimeout'){
        if(!message.member.permissions.has(PermissionFlagsBits.ModerateMembers))return message.reply('تحتاج صلاحية Timeout Members.');
        const target=message.mentions.members.first();if(!target)return message.reply('اذكر العضو المطلوب.');
        if(message.guild.ownerId!==message.author.id&&target.roles.highest.position>=message.member.roles.highest.position)return message.reply('ما تقدر تستهدف عضو رتبته مساوية أو أعلى من رتبتك.');
        if(target.roles.highest.position>=message.guild.members.me.roles.highest.position)return message.reply('رتبة البوت يجب أن تكون أعلى من رتبة العضو المستهدف.');
        if(command==='untimeout'){await target.timeout(null,'إزالة المهلة بواسطة '+message.author.tag);await writeRuntimeLog(client.mldBotId,message.author.id,'bot.moderation_untimeout',{guildId:message.guild.id,channelId:message.channel.id,targetId:target.id});return message.reply('تم إلغاء المهلة عن العضو.');}
        const minutes=Number(args.find(x=>/^\d+$/.test(x)));if(!Number.isInteger(minutes)||minutes<1||minutes>40320)return message.reply('حدد مدة من دقيقة إلى 40320 دقيقة.');
        await target.timeout(minutes*60000,args.slice(1).filter(x=>!/^\d+$/.test(x)).join(' ').slice(0,400)||'بواسطة '+message.author.tag);
        await writeRuntimeLog(client.mldBotId,message.author.id,'bot.moderation_timeout',{guildId:message.guild.id,channelId:message.channel.id,targetId:target.id,minutes});
        return message.reply('⏳ تم تقييد '+target.user.tag+' لمدة '+minutes+' دقيقة.');
      }
      if(command==='nick'){
        if(!message.member.permissions.has(PermissionFlagsBits.ManageNicknames))return message.reply('تحتاج صلاحية إدارة الألقاب.');
        const target=message.mentions.members.first(),nick=args.slice(1).join(' ').slice(0,32);if(!target||!nick)return message.reply('استخدم: '+prefix+'nick @عضو الاسم الجديد');
        if(message.guild.ownerId!==message.author.id&&target.roles.highest.position>=message.member.roles.highest.position)return message.reply('ما تقدر تعدل لقب عضو رتبته مساوية أو أعلى من رتبتك.');
        if(target.roles.highest.position>=message.guild.members.me.roles.highest.position)return message.reply('رتبة البوت يجب أن تكون أعلى من رتبة العضو المستهدف.');
        await target.setNickname(nick,'تعديل من بوت MLD');await writeRuntimeLog(client.mldBotId,message.author.id,'bot.moderation_nick',{guildId:message.guild.id,channelId:message.channel.id,targetId:target.id,nick});return message.reply('تم تعديل لقب العضو.');
      }
      if(command==='rolecreate'||command==='انشاءرتبة'){
        if(!message.member.permissions.has(PermissionFlagsBits.ManageRoles))return message.reply('تحتاج صلاحية إدارة الرتب.');
        if(!message.guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles))return message.reply('البوت يحتاج صلاحية إدارة الرتب.');
        const name=args.filter(x=>!/^#[0-9a-f]{6}$/i.test(x)).join(' ').trim();
        const colorArg=args.find(x=>/^#[0-9a-f]{6}$/i.test(x));
        if(!name)return message.reply('استخدم: '+prefix+'rolecreate اسم_الرتبة [#RRGGBB]');
        try{const role=await message.guild.roles.create({name:name.slice(0,100),color:colorArg||'#ff9cde',reason:'إنشاء رتبة بواسطة '+message.author.tag});await writeRuntimeLog(client.mldBotId,message.author.id,'bot.moderation_rolecreate',{guildId:message.guild.id,roleId:role.id,roleName:role.name});return message.reply('تم إنشاء الرتبة '+role.toString()+' بنجاح.');}catch{return message.reply('تعذر إنشاء الرتبة. تحقق من صلاحيات البوت.');}
      }
      if(command==='roledelete'||command==='حذفرتبة'){
        if(!message.member.permissions.has(PermissionFlagsBits.ManageRoles))return message.reply('تحتاج صلاحية إدارة الرتب.');
        const role=message.mentions.roles.first()||message.guild.roles.cache.get(args[0]);
        if(!role)return message.reply('منشن الرتبة أو اكتب معرّفها.');
        if(role.id===message.guild.id||role.managed||role.position>=message.guild.members.me.roles.highest.position)return message.reply('لا يمكن حذف هذه الرتبة؛ تحقق من كونها غير مُدارة وأن رتبة البوت أعلى منها.');
        if(message.guild.ownerId!==message.author.id&&role.position>=message.member.roles.highest.position)return message.reply('ما تقدر تحذف رتبة مساوية أو أعلى من رتبتك.');
        try{await role.delete('حذف بواسطة '+message.author.tag);await writeRuntimeLog(client.mldBotId,message.author.id,'bot.moderation_roledelete',{guildId:message.guild.id,roleId:role.id,roleName:role.name});return message.reply('تم حذف الرتبة بنجاح.');}catch{return message.reply('تعذر حذف الرتبة. تحقق من الصلاحيات وترتيب الرتب.');}
      }
      if(command==='roleadd'||command==='roleremove'){
        if(!message.member.permissions.has(PermissionFlagsBits.ManageRoles))return message.reply('تحتاج صلاحية إدارة الرتب.');
        const target=message.mentions.members.first(),role=message.mentions.roles.first();if(!target||!role)return message.reply('استخدم: '+prefix+command+' @عضو @رتبة');
        if(role.id===message.guild.id||role.position>=message.guild.members.me.roles.highest.position)return message.reply('رتبة البوت يجب أن تكون أعلى من الرتبة المستهدفة.');
        if(message.guild.ownerId!==message.author.id&&role.position>=message.member.roles.highest.position)return message.reply('ما تقدر تعدل رتبة مساوية أو أعلى من رتبتك.');
        if(message.guild.ownerId!==message.author.id&&target.roles.highest.position>=message.member.roles.highest.position)return message.reply('ما تقدر تعدل على عضو رتبته مساوية أو أعلى من رتبتك.');
        if(command==='roleadd')await target.roles.add(role,'تعديل من بوت MLD');else await target.roles.remove(role,'تعديل من بوت MLD');
        await writeRuntimeLog(client.mldBotId,message.author.id,'bot.moderation_'+command,{guildId:message.guild.id,channelId:message.channel.id,targetId:target.id,roleId:role.id,roleName:role.name});
        return message.reply((command==='roleadd'?'أُضيفت':'أُزيلت')+' رتبة '+role.name+' '+(command==='roleadd'?'إلى':'من')+' '+target.user.tag+'.');
      }
      if(command==='poll'){
        const question=args.join(' ').slice(0,1000);if(!question)return message.reply('استخدم: '+prefix+'poll سؤال التصويت');
        const poll=await message.reply({content:'📊 **تصويت**\n'+question,allowedMentions:{parse:[]}});
        await Promise.all([poll.react('👍').catch(()=>{}),poll.react('👎').catch(()=>{})]);return;
      }
      if(command==='announce'){
        if(!message.member.permissions.has(PermissionFlagsBits.ManageMessages))return message.reply('تحتاج صلاحية إدارة الرسائل.');
        const channel=message.mentions.channels.first(),text=message.content.slice(message.content.indexOf('announce')+8).replace(/<#[0-9]+>/,'').trim().slice(0,1800);
        if(!channel?.isTextBased()||!text)return message.reply('استخدم: '+prefix+'announce #روم نص الإعلان');
        await channel.send({content:text,allowedMentions:{parse:[]}});return message.reply('تم إرسال الإعلان.');
      }
    }
    if(['applications','allinone'].includes(type)){
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
    } catch(error) {
      console.error('Prefix command handler:',error?.stack||error);
      await message.reply('صار خطأ أثناء تنفيذ الأمر. جرّب مرة ثانية أو راجع سجل البوت من اللوحة.').catch(()=>{});
    }
  });
  if(['welcome','general','custom','system','support','allinone'].includes(client.mldType)){
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
  if(['support','allinone'].includes(client.mldType)){
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
async function applyAuditLogSetup(client){
  if(!pool||!client?.isReady?.()||!client.mldConfig?.auditLogsCreateRequested)return;
  try{
    const result=await ensureAuditLogRooms(client);
    if(result.selected&&client.mldConfig?.auditLogsReady){
      const persisted={auditLogsCreateRequested:false,auditLogsReady:true,auditLogsLastCreatedAt:client.mldConfig.auditLogsLastCreatedAt,auditLogChannels:client.mldConfig.auditLogChannels||{}};
      await pool.query('UPDATE bots SET settings=COALESCE(settings,\'{}\'::jsonb) || $1::jsonb WHERE id=$2',[JSON.stringify(persisted),client.mldBotId]);
      await writeRuntimeLog(client.mldBotId,'system','bot.audit_logs_created',{selected:result.selected,created:result.created});
      console.log('📚 MLD audit log rooms configured:',client.mldBotId,result);
    }
  }catch(e){console.error('MLD audit log setup:',e.message);await setBotRuntime(client.mldBotId,'error',e.message);}
}

async function syncUserBots(){
  if(!pool)return;
  try{
    const {rows}=await pool.query('SELECT id,name,token,active,bot_type,settings,watching,guild_id FROM bots WHERE active=true AND locked=true');
    const wanted=new Set(rows.map(x=>String(x.id)));
    for(const [id,client] of userBotClients){
      if(!wanted.has(id)){try{client.destroy();}catch{}userBotClients.delete(id);await setBotRuntime(id,'offline');}
    }
    for(const bot of rows){
      const id=String(bot.id),settings=bot.settings&&typeof bot.settings==='object'?bot.settings:{};
      if(userBotClients.has(id)){const live=userBotClients.get(id);const oldSignature=JSON.stringify(buildUserBotSlashCommands(live));live.mldConfig=settings;live.mldType=bot.bot_type||'general';if(oldSignature!==JSON.stringify(buildUserBotSlashCommands(live)))await registerUserBotSlashCommands(live,{...bot,settings});await applyAuditLogSetup(live);await setBotRuntime(id,'online',null,live.ws?.ping);continue;}
      const c=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.DirectMessages,GatewayIntentBits.MessageContent,GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildVoiceStates,GatewayIntentBits.GuildModeration,GatewayIntentBits.GuildInvites,GatewayIntentBits.GuildEmojisAndStickers,GatewayIntentBits.GuildWebhooks,GatewayIntentBits.GuildIntegrations,GatewayIntentBits.GuildScheduledEvents,GatewayIntentBits.GuildMessageReactions,GatewayIntentBits.AutoModerationConfiguration,GatewayIntentBits.AutoModerationExecution],partials:[Partials.Channel,Partials.Message,Partials.Reaction]});
      c.mldBotId=id;
      installBotFeatures(c,bot);
      c.once(Events.ClientReady,async()=>{try{c.user.setPresence({activities:[{name:String(bot.watching||'MLD | فهد المطيري').slice(0,128),type:ActivityType.Watching}],status:'online'});}catch{}console.log(`🤖 User bot online: ${bot.name} (${c.user.tag})`);setBotRuntime(id,'online',null,c.ws?.ping);await registerUserBotSlashCommands(c,bot);await applyAuditLogSetup(c);});
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
