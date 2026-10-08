import { SlashCommandBuilder } from 'discord.js';
import crypto from 'crypto';

const apiBase=()=>String(process.env.API_URL||'').replace(/\/$/,'');
const apiKey=()=>process.env.MLD_BOT_API_SECRET||'';
const signedHeaders=body=>({
  'Content-Type':'application/json',
  'X-MLD-Bot-Timestamp':String(Date.now()),
  'X-MLD-Bot-Signature':crypto.createHmac('sha256',apiKey()).update(body).digest('hex')
});

export const data=new SlashCommandBuilder()
  .setName('mld')
  .setDescription('خدمات ملاذ: الشات، الزاجل، الغرف، والإعلانات')
  .addSubcommand(s=>s.setName('help').setDescription('عرض خدمات وأوامر ملاذ'))
  .addSubcommand(s=>s.setName('login').setDescription('استلام رابط دخول آمن لحساب الموقع'))
  .addSubcommand(s=>s.setName('chat').setDescription('إرسال رسالة إلى شات ملاذ العام').addStringOption(o=>o.setName('message').setDescription('الرسالة').setRequired(true).setMaxLength(1500)))
  .addSubcommand(s=>s.setName('zajel').setDescription('إرسال زاجل إلى عضو في الموقع').addStringOption(o=>o.setName('to').setDescription('اسم مستخدم الموقع أو Discord ID').setRequired(true)).addStringOption(o=>o.setName('message').setDescription('الرسالة').setRequired(true).setMaxLength(1500)).addBooleanOption(o=>o.setName('anonymous').setDescription('إخفاء اسم المرسل')))
  .addSubcommand(s=>s.setName('room').setDescription('إنشاء غرفة شات وربطها بروم Discord (أونر MLD)').addStringOption(o=>o.setName('name').setDescription('اسم الغرفة').setRequired(true).setMaxLength(80)).addBooleanOption(o=>o.setName('private').setDescription('جعل الغرفة خاصة')))
  .addSubcommand(s=>s.setName('broadcast').setDescription('نشر إعلان رسمي لقناة الإعلانات (أونر MLD)').addStringOption(o=>o.setName('title').setDescription('العنوان').setRequired(true).setMaxLength(180)).addStringOption(o=>o.setName('message').setDescription('محتوى الإعلان').setRequired(true).setMaxLength(1800)));

export async function execute(interaction){
  const sub=interaction.options.getSubcommand();
  if(sub==='help')return interaction.reply({ephemeral:true,content:'**خدمات بوت ملاذ**\n`/verify send` إرسال كود التحقق\n`/verify confirm` تأكيد الكود واستلام تذكرة التسجيل\n`/mld login` رابط دخول الموقع\n`/mld chat` إرسال للشات العام\n`/mld zajel` زاجل لعضو\n`/mld room` إنشاء شات وروم Discord\n`/mld broadcast` إعلان للأونر'});
  if(sub==='broadcast'&&!interaction.inGuild())return interaction.reply({ephemeral:true,content:'❌ استخدم هذا الأمر داخل سيرفر MLD.'});
  if(!apiBase()||!apiKey())return interaction.reply({ephemeral:true,content:'❌ خدمة البوت غير مهيأة. اطلب من مالك النظام ضبط إعدادات API.'});
  await interaction.deferReply({ephemeral:true});
  let path=sub==='login'?'/api/auth/bot/login-ticket':'/api/community/bot/'+sub,payload={discord_id:interaction.user.id};
  if(sub==='chat')payload.content=interaction.options.getString('message',true);
  if(sub==='zajel')Object.assign(payload,{recipient:interaction.options.getString('to',true),content:interaction.options.getString('message',true),anonymous:interaction.options.getBoolean('anonymous')||false});
  if(sub==='room')Object.assign(payload,{name:interaction.options.getString('name',true),is_private:interaction.options.getBoolean('private')||false,discord_guild_id:interaction.guildId});
  if(sub==='broadcast')Object.assign(payload,{title:interaction.options.getString('title',true),content:interaction.options.getString('message',true),discord_guild_id:interaction.guildId});
  const body=JSON.stringify(payload);
  try{
    const response=await fetch(apiBase()+path,{method:'POST',headers:signedHeaders(body),body,signal:AbortSignal.timeout(15000)});
    const result=await response.json().catch(()=>({}));
    if(!response.ok)return interaction.editReply('❌ '+(result.error||'تعذر تنفيذ الطلب'));
    if(sub==='login'){
      const siteBase=String(process.env.WEB_URL||apiBase().replace(/\/api\/?$/,'')).replace(/\/api\/?$/,'').replace(/\/$/,'');
      const link=`${siteBase}/#login_ticket=${encodeURIComponent(result.ticket)}`;
      const sent=await interaction.user.send(`رابط الدخول الآمن لحسابك في MLD (صالح لدقيقتين واستخدام واحد):\n${link}`).then(()=>true).catch(()=>false);
      return interaction.editReply(sent?'✅ أرسلت رابط الدخول الآمن إلى الخاص.':'تعذر فتح الخاص. رابطك الخاص: '+link);
    }
    if(sub==='room'&&result.discord_text_channel_id){
      const channel=await interaction.guild.channels.fetch(result.discord_text_channel_id).catch(()=>null);
      const voice=result.discord_voice_channel_id?await interaction.guild.channels.fetch(result.discord_voice_channel_id).catch(()=>null):null;
      return interaction.editReply('✅ أنشأت الغرفة'+(channel?' '+channel:'')+(voice?' و'+voice:'')+' وربطتها بشات الموقع.');
    }
    return interaction.editReply('✅ '+(result.message||'تم تنفيذ الطلب بنجاح.'));
  }catch(error){console.error('MLD command:',error.message);return interaction.editReply('❌ تعذر الاتصال بخدمة ملاذ. حاول بعد قليل.');}
}