import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';

const CATEGORIES = {
  general: { label: 'الأوامر العامة', emoji: '✨', description: 'معلومات السيرفر وأدوات يومية', commands: [
    ['/ping', 'قياس سرعة استجابة البوت'], ['/server', 'ملخص السيرفر الحالي'], ['/serverinfo', 'بطاقة معلومات السيرفر'], ['/servericon', 'عرض أيقونة السيرفر'], ['/membercount', 'عدد أعضاء السيرفر'], ['/channelcount', 'عدد القنوات'], ['/roles', 'عرض أبرز الرتب'], ['/uptime', 'مدة تشغيل البوت'], ['/avatar', 'عرض صورة عضو'], ['/userinfo', 'معلومات عضو'], ['/roll', 'رمي نرد'], ['/random', 'اختيار رقم عشوائي'], ['/coinflip', 'رمي قطعة نقدية'], ['/eightball', 'إجابة عشوائية عن سؤال'], ['/joke', 'نكتة خفيفة']
  ]},
  mld: { label: 'خدمات ملاذ', emoji: '🌸', description: 'خدمات الموقع المربوطة بديسكورد', commands: [
    ['/mld help', 'عرض خدمات ملاذ'], ['/mld login', 'رابط دخول آمن للموقع'], ['/mld chat', 'إرسال رسالة للشات العام'], ['/mld zajel', 'إرسال زاجل لعضو'], ['/mld room', 'إنشاء غرفة مرتبطة بالموقع — للأونر'], ['/mld broadcast', 'إعلان رسمي — للأونر']
  ]},
  account: { label: 'الحساب والتحقق', emoji: '🔐', description: 'ربط حسابك وتأكيد هويتك', commands: [
    ['/verify send', 'إرسال كود التحقق إلى الخاص'], ['/verify confirm', 'إدخال كود التحقق في نموذج خاص']
  ]},
  custom: { label: 'الأوامر المخصصة', emoji: '🧩', description: 'أوامر البوت المضافة من لوحة التحكم', commands: [
    ['أوامر / المخصصة', 'تظهر بعد حفظها وتحديث أوامر Discord'], ['متغيرات الرد', '{user} اسمك، {server} اسم السيرفر، {memberCount} عدد الأعضاء، {args} النص المدخل']
  ]}
};

export const data = new SlashCommandBuilder().setName('help').setDescription('عرض دليل أوامر البوت التفاعلي');

export function buildHelpPayload(client, category = 'general') {
  const item = CATEGORIES[category] || CATEGORIES.general;
  const embed = new EmbedBuilder()
    .setColor(0xff9cde)
    .setAuthor({ name: 'MLD · COMMUNITY', iconURL: client.user?.displayAvatarURL?.() })
    .setTitle(item.emoji + ' ' + item.label)
    .setDescription(item.description + '\n\n' + item.commands.map(([name, desc]) => '**' + name + '**\n' + desc).join('\n\n'))
    .setFooter({ text: 'اختر قسمًا من القائمة لاستعراض أوامره · MLD' }).setTimestamp();
  const menu = new StringSelectMenuBuilder().setCustomId('mld_help_category').setPlaceholder('اختر قسم الأوامر…')
    .addOptions(Object.entries(CATEGORIES).map(([value, cat]) => ({ label: cat.label, value, description: cat.description, emoji: cat.emoji, default: value === category })));
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)], allowedMentions: { parse: [] } };
}

export async function execute(interaction) {
  await interaction.reply({ ...buildHelpPayload(interaction.client), ephemeral: true });
}

export async function handleHelpSelect(interaction) {
  if (!interaction.isStringSelectMenu?.() || interaction.customId !== 'mld_help_category') return false;
  await interaction.update(buildHelpPayload(interaction.client, interaction.values?.[0] || 'general'));
  return true;
}
