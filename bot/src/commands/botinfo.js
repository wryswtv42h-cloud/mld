import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('botinfo')
  .setDescription('معلومات البوت ومدة تشغيله');

export async function execute(interaction) {
  const client = interaction.client;
  const seconds = Math.max(0, Math.floor((Date.now() - (client.readyTimestamp || Date.now())) / 1000));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const embed = new EmbedBuilder()
    .setColor(0xff9cde)
    .setTitle('🤖 معلومات بوت MLD')
    .setThumbnail(client.user?.displayAvatarURL({ size: 256 }) || null)
    .addFields(
      { name: 'اسم البوت', value: String(client.user?.username || 'MLD').slice(0, 100), inline: true },
      { name: 'المعرّف', value: String(client.user?.id || 'غير متاح'), inline: true },
      { name: 'السيرفرات', value: String(client.guilds.cache.size), inline: true },
      { name: 'مدة التشغيل', value: days + ' يوم · ' + hours + ' ساعة · ' + minutes + ' دقيقة', inline: false },
      { name: 'Ping', value: Number.isFinite(client.ws.ping) ? client.ws.ping + ' ms' : 'غير متاح', inline: true }
    )
    .setFooter({ text: 'MLD · مجتمع ملاذ' })
    .setTimestamp();
  return interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
}
