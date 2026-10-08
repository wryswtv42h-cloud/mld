import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import crypto from 'crypto';

const apiKey=()=>process.env.MLD_BOT_API_SECRET||'';
const headers=body=>({'Content-Type':'application/json','X-MLD-Bot-Timestamp':String(Date.now()),'X-MLD-Bot-Signature':crypto.createHmac('sha256',apiKey()).update(body).digest('hex')});

export const data = new SlashCommandBuilder()
  .setName('verify')
  .setDescription('إرسال/تأكيد كود ربط حساب MLD')
  .addSubcommand(s=>s.setName('send').setDescription('إرسال كود التحقق إلى الخاص'))
  .addSubcommand(s=>s.setName('confirm').setDescription('تأكيد الكود بسرية واستلام تذكرة التسجيل'));

export async function execute(interaction) {
  const base = String(process.env.API_URL || '').replace(/\/$/, '');
  if (!base||!apiKey()) return interaction.reply({content:'❌ خدمة التحقق غير مضبوطة على البوت.',ephemeral:true});
  const action=interaction.options.getSubcommand();
  if(action==='confirm'){
    const button=new ButtonBuilder().setCustomId(`mld_verify_open:${interaction.user.id}`).setLabel('إدخال كود التحقق').setStyle(ButtonStyle.Primary);
    return interaction.reply({content:'اضغط الزر لإدخال الكود في نافذة خاصة لا يراها أعضاء السيرفر.',components:[new ActionRowBuilder().addComponents(button)],ephemeral:true});
  }
  await interaction.deferReply({ ephemeral: true });
  try {
    if(action==='send'){
      const body=JSON.stringify({discord_id:interaction.user.id});
      const res=await fetch(base+'/api/auth/bot/send-verification',{method:'POST',headers:headers(body),body,signal:AbortSignal.timeout(10000)});
      const data=await res.json();
      return interaction.editReply(res.ok?'✅ '+data.message:'❌ '+(data.error||'تعذر إرسال الكود'));
    }
  } catch (err) {
    await interaction.editReply('❌ تعذر الاتصال بخدمة MLD. حاول بعد قليل.');
  }
}

export async function handleComponent(interaction){
  if(interaction.isButton()&&interaction.customId===`mld_verify_open:${interaction.user.id}`){
    const modal=new ModalBuilder().setCustomId(`mld_verify_submit:${interaction.user.id}`).setTitle('تأكيد حساب MLD');
    const code=new TextInputBuilder().setCustomId('code').setLabel('كود التحقق من الخاص').setStyle(TextInputStyle.Short).setMinLength(6).setMaxLength(6).setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(code));
    return interaction.showModal(modal);
  }
  if(interaction.isButton())return;
  if(!interaction.isModalSubmit()||interaction.customId!==`mld_verify_submit:${interaction.user.id}`)return;
  await interaction.deferReply({ephemeral:true});
  const base=String(process.env.API_URL||'').replace(/\/$/,''),code=interaction.fields.getTextInputValue('code').trim();
  if(!base||!apiKey())return interaction.editReply('❌ خدمة التحقق غير مضبوطة على البوت.');
  try{
    const body=JSON.stringify({discord_id:interaction.user.id,actor_discord_id:interaction.user.id,verification_code:code});
    const response=await fetch(base+'/api/auth/confirm-discord',{method:'POST',headers:headers(body),body,signal:AbortSignal.timeout(10000)});
    const result=await response.json().catch(()=>({}));
    if(!response.ok)return interaction.editReply('❌ '+(result.error||'تعذر تأكيد الرمز'));
    const sent=await interaction.user.send(`✅ تم تأكيد Discord. أكمل التسجيل خلال 10 دقائق.\nتذكرة التسجيل السرية (لا تشاركها): ||${result.registration_ticket}||`).then(()=>true).catch(()=>false);
    return interaction.editReply(sent?'✅ تأكد الحساب وأرسلت تذكرة التسجيل إلى الخاص.':'✅ تأكد الحساب. تذكرة التسجيل (خاصة بك فقط): ||'+result.registration_ticket+'||');
  }catch(error){console.error('verify modal:',error.message);return interaction.editReply('❌ تعذر الاتصال بخدمة MLD. حاول بعد قليل.');}
}
