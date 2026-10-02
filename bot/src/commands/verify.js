import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('verify')
  .setDescription('اربط حسابك في منصة ملاذ')
  .addStringOption(opt =>
    opt.setName('code')
      .setDescription('كود التحقق المرسل لك')
      .setRequired(true));

export async function execute(interaction) {
  const code = interaction.options.getString('code');

  await interaction.reply({
    content: `🔐 جاري التحقق من الكود: \`${code}\`\n` +
      `سيتم ربط حسابك خلال لحظات...`,
    ephemeral: true
  });

  // هنا يتم إرسال الكود للـ API للتحقق
  try {
    const res = await fetch(process.env.API_URL + '/api/auth/verify-discord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        discordId: interaction.user.id,
        code
      })
    });
    const data = await res.json();

    if (data.error) {
      await interaction.followUp({
        content: `❌ ${data.error}`,
        ephemeral: true
      });
    } else {
      await interaction.followUp({
        content: `✅ تم ربط حسابك بنجاح!`,
        ephemeral: true
      });
    }
  } catch (err) {
    await interaction.followUp({
      content: `❌ تعذر الاتصال بالسيرفر`,
      ephemeral: true
    });
  }
}
