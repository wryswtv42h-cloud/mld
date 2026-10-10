import { Events } from 'discord.js';

export const name = Events.InteractionCreate;

export async function execute(interaction) {
  if (interaction.isButton() || interaction.isModalSubmit()) {
    if (interaction.customId?.startsWith('mld_verify_open:') || interaction.customId?.startsWith('mld_verify_submit:')) {
      try { await interaction.client.commands.get('verify')?.handleComponent?.(interaction); }
      catch (error) { console.error('خطأ في نافذة التحقق:', error); if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: '❌ تعذر إكمال التحقق', ephemeral: true }); }
      return;
    }
    if (interaction.isModalSubmit()) return;
  }
  if (interaction.isStringSelectMenu?.() && interaction.customId === 'mld_help_category') {
    try { await interaction.client.commands.get('help')?.handleHelpSelect?.(interaction); }
    catch (error) { console.error('خطأ في قائمة المساعدة:', error); if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: 'تعذر تحميل القسم، جرّب مرة أخرى.', ephemeral: true }).catch(() => {}); }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`لا يوجد أمر باسم ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`خطأ في ${interaction.commandName}:`, error);
    const msg = { content: '❌ حدث خطأ أثناء تنفيذ الأمر', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg);
    } else {
      await interaction.reply(msg);
    }
  }
}
