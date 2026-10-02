import { Events, ActivityType } from 'discord.js';

export const name = Events.ClientReady;
export const once = true;

export async function execute(client) {
  console.log(`🤖 MLD Bot شغال باسم ${client.user.tag}`);
  console.log(`👑 الحقوق: MLD | المطور: فهد المطيري`);
  console.log(`🌐 الديسكورد: w4px`);

  // الحالة المقفلة — لا تتغير أبداً
  client.user.setPresence({
    activities: [{
      name: 'MLD | فهد المطيري',
      type: ActivityType.Watching
    }],
    status: 'online'
  });
}
