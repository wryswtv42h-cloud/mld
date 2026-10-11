import { SlashCommandBuilder, EmbedBuilder, ChannelType } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('serverinfo')
  .setDescription('معلومات السيرفر الحالي');

export async function execute(interaction) {
  const guild = interaction.guild;
  if (!guild) return interaction.reply({ content: 'هذا الأمر يعمل داخل السيرفر فقط.', ephemeral: true });
  const channels = guild.channels.cache;
  const owner = await guild.fetchOwner().catch(() => null);
  const embed = new EmbedBuilder()
    .setColor(0xff9cde)
    .setTitle('🏠 معلومات السيرفر')
    .addFields(
      { name: 'اسم السيرفر', value: String(guild.name).slice(0, 100), inline: true },
      { name: 'المالك', value: owner ? String(owner.user.tag || owner.user.username).slice(0, 100) : 'غير متاح', inline: true },
      { name: 'الأعضاء', value: String(guild.memberCount), inline: true },
      { name: 'الرومات النصية', value: String(channels.filter(c => [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(c.type)).size), inline: true },
      { name: 'الرومات الصوتية', value: String(channels.filter(c => [ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(c.type)).size), inline: true },
      { name: 'الرتب', value: String(Math.max(0, guild.roles.cache.size - 1)), inline: true },
      { name: 'التعزيزات', value: String(guild.premiumSubscriptionCount || 0), inline: true },
      { name: 'تاريخ الإنشاء', value: '<t:' + Math.floor(guild.createdTimestamp / 1000) + ':D>', inline: true },
      { name: 'المعرّف', value: guild.id, inline: true }
    )
    .setFooter({ text: 'MLD · مجتمع ملاذ' })
    .setTimestamp();
  const icon = guild.iconURL({ size: 256 });
  if (icon) embed.setThumbnail(icon);
  return interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
}
