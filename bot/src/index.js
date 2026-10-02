import { Client, GatewayIntentBits, Events, REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

// ===== تسجيل الأوامر =====
async function registerCommands() {
  const commandsPath = join(__dirname, 'commands');
  const commandFiles = readdirSync(commandsPath).filter(f => f.endsWith('.js'));
  const commands = [];

  for (const file of commandFiles) {
    const filePath = join(commandsPath, file);
    const command = await import(pathToFileURL(filePath).href);
    if ('data' in command) commands.push(command.data.toJSON());
  }

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.DISCORD_CLIENT_ID,
        process.env.DISCORD_GUILD_ID
      ),
      { body: commands }
    );
    console.log('✅ تم تسجيل جميع الأوامر');
  } catch (err) {
    console.error('❌ فشل تسجيل الأوامر:', err);
  }
}

// ===== تحميل الأوامر والأحداث =====
async function loadHandlers() {
  client.commands = new Map();

  const commandsPath = join(__dirname, 'commands');
  for (const file of readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
    const cmd = await import(pathToFileURL(join(commandsPath, file)).href);
    if ('data' in cmd && 'execute' in cmd) {
      client.commands.set(cmd.data.name, cmd);
      console.log(`✅ أمر: ${cmd.data.name}`);
    }
  }

  const eventsPath = join(__dirname, 'events');
  for (const file of readdirSync(eventsPath).filter(f => f.endsWith('.js'))) {
    const evt = await import(pathToFileURL(join(eventsPath, file)).href);
    if ('name' in evt && 'execute' in evt) {
      if (evt.once) client.once(evt.name, (...args) => evt.execute(...args));
      else client.on(evt.name, (...args) => evt.execute(...args));
      console.log(`✅ حدث: ${evt.name}`);
    }
  }
}

// ===== تشغيل =====
async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ البوت اتصل بقاعدة البيانات');

    await loadHandlers();
    await client.login(process.env.DISCORD_TOKEN);

    client.once(Events.ClientReady, async () => {
      await registerCommands();
    });
  } catch (err) {
    console.error('❌ فشل تشغيل البوت:', err.message);
    process.exit(1);
  }
}

start();
