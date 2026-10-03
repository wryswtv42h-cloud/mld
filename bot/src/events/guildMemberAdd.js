import { Events, EmbedBuilder } from 'discord.js';

export const name = Events.GuildMemberAdd;

export async function execute(member) {
  try {
    // رسالة ترحيب في الروم العام
    const channel = member.guild.systemChannel;
    if (channel) {
      const embed = new EmbedBuilder()
        .setTitle('👋 أهلاً بك في ملاذ')
        .setDescription(
          `مرحباً ${member}!\n\n` +
          `أنت العضو رقم **${member.guild.memberCount}**\n\n` +
          `لا تنسى تستخدم \`/verify\` لربط حسابك في المنصة.`
        )
        .setColor(0xD4AF37)
        .setThumbnail(member.user.displayAvatarURL())
        .setFooter({ text: 'MLD | المطور: فهد المطيري' })
        .setTimestamp();

      await channel.send({ embeds: [embed] }).catch(() => {});
    }

    // رسالة خاصة للعضو الجديد
    try {
      const dmEmbed = new EmbedBuilder()
        .setTitle('👑 مرحباً بك في MLD')
        .setDescription(
          `أهلاً ${member.user.username}!\n\n` +
          `شكراً لانضمامك لمنصة **ملاذ**.\n\n` +
          `**خطوات البدء:**\n` +
          `1️⃣ استخدم \`/verify\` لربط حسابك\n` +
          `2️⃣ ادخل الموقع وسجّل دخولك\n` +
          `3️⃣ استمتع بكل المميزات\n\n` +
          `للاستفسار تواصل مع: <@w4px>`
        )
        .setColor(0xC0C0C0)
        .setFooter({ text: 'MLD | فهد المطيري' });

      await member.send({ embeds: [dmEmbed] }).catch(() => {});
    } catch (e) {}
  } catch (err) {
    console.error('خطأ في ترحيب العضو:', err);
  }
}
