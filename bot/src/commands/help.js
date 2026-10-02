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
      { name: '/verify', value: 'اربط حسابك في منصة ملاذ' },
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
