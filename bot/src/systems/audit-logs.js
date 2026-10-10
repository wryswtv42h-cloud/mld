import { EmbedBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';

const raw = `
member_join|دخول الأعضاء|guildMemberAdd|الأعضاء|📥
member_leave|خروج الأعضاء|guildMemberRemove|الأعضاء|📤
member_update|تغييرات الأعضاء|guildMemberUpdate|الأعضاء|👤
member_nickname|تغيير الألقاب|guildMemberUpdate|الأعضاء|✏️
member_roles|إضافة وإزالة الرتب|guildMemberUpdate|الأعضاء|🎭
member_ban|حظر عضو|guildBanAdd|الإشراف|🔨
member_unban|فك حظر عضو|guildBanRemove|الإشراف|🔓
member_timeout|المهلة الزمنية|guildMemberUpdate|الإشراف|⏳
member_kick|طرد عضو|guildAuditLogEntryCreate|الإشراف|🚪
message_delete|حذف الرسائل|messageDelete|الرسائل|🗑️
message_bulk_delete|حذف رسائل جماعي|messageDeleteBulk|الرسائل|🧹
message_edit|تعديل الرسائل|messageUpdate|الرسائل|📝
message_pin|تثبيت وإلغاء تثبيت|messageUpdate|الرسائل|📌
message_attachments|مرفقات الرسائل المحذوفة|messageDelete|الرسائل|📎
channel_create|إنشاء الرومات|channelCreate|القنوات|➕
channel_delete|حذف الرومات|channelDelete|القنوات|➖
channel_update|تعديل الرومات|channelUpdate|القنوات|⚙️
channel_permissions|تغييرات صلاحيات الرومات|channelUpdate|القنوات|🔐
category_changes|تغييرات الفئات|channelUpdate|القنوات|🗂️
role_create|إنشاء الرتب|roleCreate|الرتب والصلاحيات|🆕
role_delete|حذف الرتب|roleDelete|الرتب والصلاحيات|🗑️
role_update|تعديل الرتب|roleUpdate|الرتب والصلاحيات|🎨
role_permissions|تغييرات صلاحيات الرتب|roleUpdate|الرتب والصلاحيات|🛡️
guild_update|تغييرات إعدادات السيرفر|guildUpdate|السيرفر|🏠
guild_icon|تغيير صورة السيرفر|guildUpdate|السيرفر|🖼️
guild_boost|تعزيزات السيرفر|guildMemberUpdate|السيرفر|🚀
invite_create|إنشاء الدعوات|inviteCreate|الدعوات|🔗
invite_delete|حذف الدعوات|inviteDelete|الدعوات|⛓️
voice_join|دخول الرومات الصوتية|voiceStateUpdate|الصوت|🔊
voice_leave|خروج الرومات الصوتية|voiceStateUpdate|الصوت|🔇
voice_move|التنقل بين الرومات الصوتية|voiceStateUpdate|الصوت|🔀
voice_mute_deafen|الكتم والسماعة|voiceStateUpdate|الصوت|🎙️
voice_stream|البث ومشاركة الشاشة|voiceStateUpdate|الصوت|📺
emoji_create|إضافة الإيموجي|emojiCreate|الإيموجي والملصقات|😄
emoji_delete|حذف الإيموجي|emojiDelete|الإيموجي والملصقات|🗑️
emoji_update|تعديل الإيموجي|emojiUpdate|الإيموجي والملصقات|🎨
sticker_create|إضافة الملصقات|stickerCreate|الإيموجي والملصقات|🏷️
sticker_delete|حذف الملصقات|stickerDelete|الإيموجي والملصقات|🗑️
sticker_update|تعديل الملصقات|stickerUpdate|الإيموجي والملصقات|✏️
thread_create|إنشاء المواضيع|threadCreate|المواضيع|🧵
thread_delete|حذف المواضيع|threadDelete|المواضيع|🗑️
thread_update|تعديل المواضيع|threadUpdate|المواضيع|✏️
webhook_update|تغييرات Webhook|webhooksUpdate|التكاملات|🪝
integration_update|تغييرات التكاملات|guildIntegrationsUpdate|التكاملات|🔌
scheduled_event_create|إنشاء فعاليات السيرفر|guildScheduledEventCreate|الفعاليات|📅
scheduled_event_delete|حذف فعاليات السيرفر|guildScheduledEventDelete|الفعاليات|🗑️
scheduled_event_update|تعديل فعاليات السيرفر|guildScheduledEventUpdate|الفعاليات|📝
automod_action|إجراءات الحماية التلقائية|autoModerationActionExecution|الحماية|🛡️
automod_rule|إنشاء قواعد الحماية|autoModerationRuleCreate|الحماية|⚙️
automod_rule_delete|حذف قواعد الحماية|autoModerationRuleDelete|الحماية|🗑️
reaction_add|إضافة التفاعلات|messageReactionAdd|التفاعلات|💟
reaction_remove|إزالة التفاعلات|messageReactionRemove|التفاعلات|💔
reaction_clear|مسح جميع التفاعلات|messageReactionRemoveAll|التفاعلات|🧽
`.trim();

export const AUDIT_LOG_TYPES = raw.split('\n').map(line => {
  const [id,label,event,group,icon] = line.split('|');
  return {id,label,event,group,icon};
});

function getGuild(args) {
  for (const x of args) {
    if (x?.guild) return x.guild;
    if (x?.message?.guild) return x.message.guild;
    if (x?.channel?.guild) return x.channel.guild;
  }
  return null;
}
function who(x) { return x?.user?.tag || x?.author?.tag || x?.member?.user?.tag || x?.tag || x?.name || x?.id || 'غير معروف'; }
function add(fields,name,value) {
  if (value === undefined || value === null || value === '') return;
  fields.push({name,value:String(value).replace(/\u0000/g,'').slice(0,1000),inline:true});
}
function buildDetails(type,args,guild) {
  const a=args[0],b=args[1],fields=[];
  let description='تم رصد حدث في السيرفر.';
  switch(type.event) {
    case 'guildMemberAdd': description='انضم عضو جديد إلى السيرفر.';add(fields,'العضو',who(a));add(fields,'المعرّف',a?.id);add(fields,'عدد الأعضاء',guild.memberCount);break;
    case 'guildMemberRemove': description='غادر عضو السيرفر.';add(fields,'العضو',who(a));add(fields,'المعرّف',a?.id);break;
    case 'guildBanAdd': case 'guildBanRemove': description=type.event==='guildBanAdd'?'تم حظر عضو.':'تم فك حظر عضو.';add(fields,'العضو',who(a));add(fields,'المعرّف',a?.user?.id);add(fields,'السبب',a?.reason);break;
    case 'guildMemberUpdate':
      description='تم تحديث بيانات عضو.';
      add(fields,'العضو',who(b||a));add(fields,'المعرّف',(b||a)?.id);
      if(a?.nickname!==b?.nickname){add(fields,'اللقب السابق',a?.nickname||'بدون');add(fields,'اللقب الجديد',b?.nickname||'بدون');}
      if(a?.communicationDisabledUntilTimestamp!==b?.communicationDisabledUntilTimestamp)add(fields,'المهلة الجديدة',b?.communicationDisabledUntil?.toISOString?.()||'لا توجد');
      if(a?.premiumSinceTimestamp!==b?.premiumSinceTimestamp)add(fields,'تعزيز السيرفر',b?.premiumSinceTimestamp?'مفعّل':'غير مفعّل');
      if(a?.roles?.cache&&b?.roles?.cache){const plus=b.roles.cache.filter(r=>!a.roles.cache.has(r.id)).map(r=>r.name);const minus=a.roles.cache.filter(r=>!b.roles.cache.has(r.id)).map(r=>r.name);if(plus.length)add(fields,'رتب مضافة',plus.join('، '));if(minus.length)add(fields,'رتب محذوفة',minus.join('، '));}break;
    case 'messageDelete': description='تم حذف رسالة.';add(fields,'القناة',a?.channel?.name);add(fields,'الكاتب',who(a?.author));add(fields,'معرّف الكاتب',a?.author?.id);add(fields,'محتوى الرسالة',a?.content);if(a?.attachments?.size)add(fields,'المرفقات',[...a.attachments.values()].map(x=>x.url).join('\n'));break;
    case 'messageDeleteBulk': description='تم حذف مجموعة رسائل.';add(fields,'القناة',a?.first()?.channel?.name);add(fields,'عدد الرسائل',a?.size);break;
    case 'messageUpdate': description='تم تعديل رسالة.';add(fields,'القناة',b?.channel?.name||a?.channel?.name);add(fields,'الكاتب',who(b?.author||a?.author));add(fields,'قبل',a?.content);add(fields,'بعد',b?.content);break;
    case 'channelCreate': case 'channelDelete': case 'channelUpdate': description='حدث تغيير في قناة أو فئة.';add(fields,'القناة',who(b||a));add(fields,'المعرّف',(b||a)?.id);if(a?.name!==b?.name){add(fields,'الاسم السابق',a?.name);add(fields,'الاسم الجديد',b?.name);}break;
    case 'roleCreate': case 'roleDelete': case 'roleUpdate': description='حدث تغيير في رتبة.';add(fields,'الرتبة',who(b||a));add(fields,'المعرّف',(b||a)?.id);if(a?.name!==b?.name){add(fields,'الاسم السابق',a?.name);add(fields,'الاسم الجديد',b?.name);}add(fields,'الصلاحيات',b?.permissions?.toArray?.().join('، '));break;
    case 'guildUpdate': description='تم تعديل إعدادات السيرفر.';add(fields,'السيرفر',b?.name||a?.name);if(a?.name!==b?.name){add(fields,'الاسم السابق',a?.name);add(fields,'الاسم الجديد',b?.name);}break;
    case 'inviteCreate': case 'inviteDelete': description='حدث تغيير في دعوة.';add(fields,'رمز الدعوة',a?.code);add(fields,'القناة',a?.channel?.name);add(fields,'أنشأها',who(a?.inviter));add(fields,'الاستخدامات',a?.uses);break;
    case 'voiceStateUpdate': description='حدث تغيير في حالة الصوت.';add(fields,'العضو',who(b?.member||a?.member));add(fields,'من',a?.channel?.name||'خارج الصوت');add(fields,'إلى',b?.channel?.name||'خارج الصوت');if(a?.serverMute!==b?.serverMute)add(fields,'كتم السيرفر',b?.serverMute?'مفعّل':'ملغي');if(a?.serverDeaf!==b?.serverDeaf)add(fields,'سماعة السيرفر',b?.serverDeaf?'مفعّلة':'ملغاة');if(a?.streaming!==b?.streaming)add(fields,'البث',b?.streaming?'بدأ':'توقف');break;
    case 'emojiCreate': case 'emojiDelete': case 'emojiUpdate': case 'stickerCreate': case 'stickerDelete': case 'stickerUpdate': description='حدث تغيير في إيموجي أو ملصق.';add(fields,'الاسم',who(b||a));add(fields,'المعرّف',(b||a)?.id);break;
    case 'threadCreate': case 'threadDelete': case 'threadUpdate': description='حدث تغيير في موضوع.';add(fields,'الموضوع',who(b||a));add(fields,'القناة الأم',(b||a)?.parent?.name);break;
    case 'guildScheduledEventCreate': case 'guildScheduledEventDelete': case 'guildScheduledEventUpdate': description='حدث تغيير في فعالية.';add(fields,'الفعالية',who(b||a));add(fields,'موعد البداية',(b||a)?.scheduledStartAt?.toISOString?.());break;
    case 'autoModerationActionExecution': description='نفّذت الحماية التلقائية إجراءً.';add(fields,'القاعدة',a?.ruleName||a?.ruleId);add(fields,'الإجراء',a?.action?.type);add(fields,'العضو',a?.userId);add(fields,'القناة',a?.channelId);add(fields,'المحتوى',a?.content);break;
    case 'guildAuditLogEntryCreate': description='تم رصد حركة في سجل تدقيق Discord.';add(fields,'نوع الحركة',a?.action);add(fields,'المنفذ',who(a?.executor));add(fields,'الهدف',who(a?.target));add(fields,'السبب',a?.reason);break;
    default: add(fields,'التفاصيل',who(a));add(fields,'المعرّف',a?.id);
  }
  add(fields,'السيرفر',guild.name);
  return {description,fields:fields.slice(0,20)};
}

export async function ensureAuditLogRooms(client) {
  const cfg=client.mldConfig||{},selected=Array.isArray(cfg.auditLogTypes)?cfg.auditLogTypes.filter(id=>AUDIT_LOG_TYPES.some(t=>t.id===id)):[];
  if(!cfg.auditLogsCreateRequested||!selected.length)return {created:0,selected:selected.length};
  let created=0;
  for(const guild of client.guilds.cache.values()) {
    if(cfg.auditLogsGuildId&&guild.id!==String(cfg.auditLogsGuildId))continue;
    const me=guild.members.me||await guild.members.fetchMe().catch(()=>null);
    if(!me?.permissions.has(PermissionFlagsBits.ManageChannels))throw new Error('يحتاج البوت صلاحية إدارة القنوات لإنشاء رومات اللوقات.');
    const existing=new Map(guild.channels.cache.map(c=>[c.name,c]));
    const groups=[...new Set(selected.map(id=>AUDIT_LOG_TYPES.find(t=>t.id===id).group))];
    const categories=new Map();
    for(const group of groups) {
      const name=('📚・لوقات-'+group).slice(0,90);
      let cat=existing.get(name);
      if(!cat)cat=await guild.channels.create({name,type:ChannelType.GuildCategory,reason:'إعداد نظام لوقات MLD'});
      categories.set(group,cat);
    }
    if(!client.mldAuditLogChannels)client.mldAuditLogChannels=new Map();
    for(const id of selected) {
      const type=AUDIT_LOG_TYPES.find(t=>t.id===id),name=('・'+id.replace(/_/g,'-')).slice(0,90);
      let channel=existing.get(name);
      if(!channel)channel=await guild.channels.create({name,type:ChannelType.GuildText,parent:categories.get(type.group)?.id,topic:'لوق '+type.label+' | MLD',reason:'إنشاء روم لوق من لوحة MLD'});
      client.mldAuditLogChannels.set(guild.id+':'+id,channel.id);created++;
    }
  }
  client.mldConfig={...cfg,auditLogsCreateRequested:false,auditLogsReady:true,auditLogsLastCreatedAt:new Date().toISOString()};
  return {created,selected:selected.length};
}

export function setupAuditLogs(client) {
  if(client.mldAuditLogListenersInstalled)return;
  client.mldAuditLogListenersInstalled=true;
  const events=[...new Set(AUDIT_LOG_TYPES.map(t=>t.event))];
  for(const event of events)client.on(event,async(...args)=>{
    try {
      const guild=getGuild(args);if(!guild)return;
      const cfg=client.mldConfig||{},selected=Array.isArray(cfg.auditLogTypes)?cfg.auditLogTypes:[];
      const relevant=AUDIT_LOG_TYPES.filter(t=>t.event===event&&selected.includes(t.id));
      for(const type of relevant) {
        const a=args[0],b=args[1];
        if(type.id==='member_nickname'&&a?.nickname===b?.nickname)continue;
        if(type.id==='member_roles'&&a?.roles?.cache&&b?.roles?.cache&&a.roles.cache.equals(b.roles.cache))continue;
        if(type.id==='member_timeout'&&a?.communicationDisabledUntilTimestamp===b?.communicationDisabledUntilTimestamp)continue;
        if(type.id==='member_kick'&&a?.action!==20)continue;
        if(type.id==='guild_icon'&&a?.icon===b?.icon)continue;
        if(type.id==='guild_boost'&&a?.premiumSinceTimestamp===b?.premiumSinceTimestamp)continue;
        if(type.id==='message_pin'&&a?.pinned===b?.pinned)continue;
        if(type.id==='channel_permissions'&&a?.permissionOverwrites?.cache&&b?.permissionOverwrites?.cache&&a.permissionOverwrites.cache.equals(b.permissionOverwrites.cache))continue;
        if(type.id==='category_changes'&&a?.parentId===b?.parentId)continue;
        if(type.id==='role_permissions'&&a?.permissions?.bitfield===b?.permissions?.bitfield)continue;
        if(type.id==='voice_join'&&!(a?.channelId==null&&b?.channelId))continue;
        if(type.id==='voice_leave'&&!(a?.channelId&&b?.channelId==null))continue;
        if(type.id==='voice_move'&&!(a?.channelId&&b?.channelId&&a.channelId!==b.channelId))continue;
        if(type.id==='voice_mute_deafen'&&a?.serverMute===b?.serverMute&&a?.serverDeaf===b?.serverDeaf&&a?.selfMute===b?.selfMute&&a?.selfDeaf===b?.selfDeaf)continue;
        if(type.id==='voice_stream'&&a?.streaming===b?.streaming)continue;
        if(type.id==='message_attachments'&&!a?.attachments?.size)continue;
        if(type.id==='automod_rule'&&event!=='autoModerationRuleCreate')continue;
        if(type.id==='automod_rule_delete'&&event!=='autoModerationRuleDelete')continue;
        if(type.id==='reaction_clear'&&event!=='messageReactionRemoveAll')continue;
        const channelId=client.mldAuditLogChannels?.get(guild.id+':'+type.id)||cfg.auditLogChannels?.[type.id];
        const channel=channelId?guild.channels.cache.get(String(channelId)):null;
        if(!channel?.isTextBased())continue;
        const detail=buildDetails(type,args,guild);
        const embed=new EmbedBuilder().setColor(['الحماية','الإشراف'].includes(type.group)?0xE85D75:0xA86FDF).setAuthor({name:'MLD · نظام اللوقات',iconURL:client.user.displayAvatarURL()}).setTitle(type.icon+' '+type.label).setDescription(detail.description).addFields(detail.fields).setFooter({text:'MLD · COMMUNITY • سجل تلقائي'}).setTimestamp();
        await channel.send({embeds:[embed],allowedMentions:{parse:[]}}).catch(()=>{});
      }
    } catch(e) { console.error('MLD audit logs:',e.message); }
  });
}
