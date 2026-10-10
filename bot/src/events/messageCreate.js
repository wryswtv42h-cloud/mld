import { Events } from 'discord.js';
import { buildHelpPayload } from '../commands/help.js';

export const name = Events.MessageCreate;

export async function execute(message) {
  if (!message.guild || message.author?.bot) return;
  const text = String(message.content || '').trim().toLowerCase();
  if (!['help', '!help', '?help', 'مساعدة', '!مساعدة', 'هيلب', '!هيلب'].includes(text)) return;
  try {
    await message.reply({ ...buildHelpPayload(message.client), allowedMentions: { parse: [] } });
  } catch (error) {
    console.error('تعذر إرسال قائمة المساعدة:', error?.message || error);
  }
}
