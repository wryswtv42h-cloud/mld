import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('اختبار سرعة البوت');

export async function execute(interaction) {
  const sent = await interaction.reply({
    content: '🏓 جاري القياس...',
    fetchReply: true
  });

  const latency = sent.createdTimestamp - interaction.createdTimestamp;

  await interaction.editReply({
    content: `🏓 Pong!\n` +
      `**سرعة الاستجابة:** ${latency}ms\n` +
      `**سرعة WebSocket:** ${interaction.client.ws.ping}ms`
  });
}
