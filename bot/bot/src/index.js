import { Client, GatewayIntentBits, Events, ActivityType, REST, Routes, SlashCommandBuilder } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages] });

client.once(Events.ClientReady, async (c) => {
  console.log('🤖 MLD Bot شغال باسم ' + c.user.tag);
  console.log('👑 الحقوق: MLD | المطور: فهد المطيري');
  c.user.setPresence({ activities: [{ name: 'MLD | فهد المطيري', type: ActivityType.Watching }], status: 'online' });
  await registerCommands(c);
});

async function registerCommands(c) {
  const commands = [
    new SlashCommandBuilder().setName('verify').setDescription('اربط حسابك في منصة ملاذ').addStringOption(opt => opt.setName('code').setDescription('كود التحقق').setRequired(true)).toJSON(),
    new SlashCommandBuilder().setName('help').setDescription('مساعدة').toJSON(),
    new SlashCommandBuilder().setName('ping').setDescription('اختبار سرعة البوت').toJSON()
  ];
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID), { body: commands });
    console.log('✅ تم تسجيل الأوامر');
  } catch (err) { console.error('❌ فشل تسجيل الأوامر:', err); }
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName === 'verify') {
    const code = interaction.options.getString('code');
    await interaction.reply({ content: '🔐 جاري التحقق من الكود: ' + code + '\n(اربط البوت بالـ API لإكمال التحقق)', ephemeral: true });
  }
  if (interaction.commandName === 'help') {
    await interaction.reply({ content: '**🤖 أوامر MLD**\n/verify — اربط حسابك\n/ping — اختبار السرعة\n/help — هذي القائمة', ephemeral: true });
  }
  if (interaction.commandName === 'ping') {
    await interaction.reply({ content: '🏓 Pong! ' + client.ws.ping + 'ms', ephemeral: true });
  }
});

client.on(Events.GuildMemberAdd, async (member) => {
  const channel = member.guild.systemChannel;
  if (channel) channel.send({ content: '👋 أهلاً ' + member + ' في **ملاذ**!\nلا تنسى تستخدم /verify لربط حسابك في المنصة.' }).catch(() => {});
});

async function start() {
  try { await client.login(process.env.DISCORD_TOKEN); }
  catch (err) { console.error('❌ فشل تشغيل البوت:', err.message); process.exit(1); }
}

start();
