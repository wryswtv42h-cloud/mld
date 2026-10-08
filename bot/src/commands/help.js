import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('عرض قائمة أوامر البوت');

export async function execute(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('🤖 أوامر MLD')
    .setDescription('قائمة الأوامر المتاحة')
    .setColor(0xC0C0C0)
    .addFields(
      { name: '/verify send', value: 'إرسال كود الحساب إلى الخاص' },
      { name: '/verify confirm', value: 'يفتح نموذجًا خاصًا لتأكيد الكود واستلام تذكرة التسجيل' },
      { name: '/mld help', value: 'عرض خدمات البوت الموحد' },
      { name: '/mld chat', value: 'إرسال رسالة إلى شات ملاذ بعد ربط حساب الموقع' },
      { name: '/mld zajel', value: 'إرسال رسالة خاصة إلى عضو مسجل بالموقع' },
      { name: '/mld room', value: 'إنشاء شات وروم ديسكورد، للإدارة فقط' },
        { name: '/mld room', value: 'إنشاء شات وروم ديسكورد، لأونر MLD' },
        { name: '/mld broadcast', value: 'إرسال إعلان لقناة MLD الرسمية، لأونر MLD' },
      { name: '/ping', value: 'اختبار سرعة البوت' },
      { name: '/help', value: 'هذي القائمة' }
    )
    .setFooter({
      text: 'MLD | المطور: فهد المطيري',
      iconURL: interaction.client.user.displayAvatarURL()
    })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
