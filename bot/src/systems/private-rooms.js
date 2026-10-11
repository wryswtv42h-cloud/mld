import { Events, ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';

const roomPerms=[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.AttachFiles,PermissionFlagsBits.EmbedLinks];

function canManageRoom(interaction,channel){
  const ownerId=String(channel?.topic||'').match(/^MLD_PRIVATE:(\d+)$/)?.[1];
  return !!ownerId&&(String(interaction.user?.id)===ownerId||!!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)||!!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator));
}
function memberIdFrom(value){
  const raw=String(value||'').trim(),mention=raw.match(/^<@!?(\d+)>$/);
  const id=mention?mention[1]:raw;
  return /^\d{17,20}$/.test(id)?id:null;
}
function roomControls(channelId){
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('mld-private:add:'+channelId).setLabel('إضافة عضو').setEmoji('➕').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('mld-private:kick:'+channelId).setLabel('طرد عضو من الروم').setEmoji('👤').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('mld-private:delete:'+channelId).setLabel('حذف الشات').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
  );
}
export function setupPrivateRooms(client){
  if(client.mldPrivateRoomsInstalled)return;
  client.mldPrivateRoomsInstalled=true;
  client.on(Events.InteractionCreate,async interaction=>{
    try{
      if(interaction.isButton()&&interaction.customId==='mld-private:create'){
        const guild=interaction.guild;
        if(!guild)return interaction.reply({content:'زر إنشاء الروم يعمل داخل السيرفر فقط.',ephemeral:true});
        const member=await guild.members.fetch(interaction.user.id).catch(()=>null);
        if(!member)return interaction.reply({content:'تعذر العثور على عضويتك في السيرفر.',ephemeral:true});
        const channels=await guild.channels.fetch();
        const existing=[...channels.values()].find(ch=>ch?.type===ChannelType.GuildText&&String(ch.topic||'')==='MLD_PRIVATE:'+interaction.user.id);
        if(existing)return interaction.reply({content:'عندك روم خاص موجود بالفعل: '+existing.toString(),ephemeral:true,allowedMentions:{parse:[]}});
        const slug=String(interaction.user.username||'member').toLowerCase().replace(/[^a-z0-9-]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,35)||'member';
        const name=('خاص-'+slug+'-'+interaction.user.id.slice(-4)).slice(0,90);
        const channel=await guild.channels.create({
          name,
          type:ChannelType.GuildText,
          topic:'MLD_PRIVATE:'+interaction.user.id,
          permissionOverwrites:[
            {id:guild.roles.everyone.id,deny:[PermissionFlagsBits.ViewChannel]},
            {id:interaction.user.id,allow:roomPerms},
            {id:client.user.id,allow:[...roomPerms,PermissionFlagsBits.ManageChannels,PermissionFlagsBits.ManageMessages]}
          ],
          reason:'إنشاء روم خاص عبر لوحة MLD'
        });
        await channel.send({
          content:'🔐 روم خاص أنشأه '+interaction.user.toString()+'. لا يراه إلا صاحب الروم والأعضاء الذين يضيفهم. استخدم لوحة التحكم لإدارة الأعضاء.',
          components:[roomControls(channel.id)],
          allowedMentions:{users:[interaction.user.id]}
        });
        return interaction.reply({content:'تم إنشاء رومك الخاص: '+channel.toString(),ephemeral:true,allowedMentions:{parse:[]}});
      }
      if(interaction.isButton()&&interaction.customId.startsWith('mld-private:')){
        const [,action,channelId]=interaction.customId.split(':');
        if(!['add','kick','delete'].includes(action)||!/^\d{17,20}$/.test(String(channelId||'')))return;
        const channel=await interaction.guild?.channels.fetch(channelId).catch(()=>null);
        if(!channel||channel.type!==ChannelType.GuildText||!String(channel.topic||'').startsWith('MLD_PRIVATE:'))return interaction.reply({content:'هذا الروم الخاص غير موجود أو لم يعد صالحًا.',ephemeral:true});
        if(!canManageRoom(interaction,channel))return interaction.reply({content:'إدارة الروم متاحة لصاحب الروم أو للإدارة المخوّلة فقط.',ephemeral:true});
        if(action==='delete'){
          await interaction.reply({content:'جارٍ حذف الروم الخاص…',ephemeral:true});
          await channel.delete('حذف روم خاص من لوحة MLD');
          return;
        }
        const modal=new ModalBuilder()
          .setCustomId('mld-private:member:'+action+':'+channel.id)
          .setTitle(action==='add'?'إضافة عضو للروم':'طرد عضو من الروم');
        const input=new TextInputBuilder()
          .setCustomId('memberId')
          .setLabel('معرّف العضو أو منشنه')
          .setPlaceholder('123456789012345678 أو @عضو')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(40);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }
      if(interaction.isModalSubmit()&&interaction.customId.startsWith('mld-private:member:')){
        const [, ,action,channelId]=interaction.customId.split(':');
        if(!['add','kick'].includes(action))return;
        const channel=await interaction.guild?.channels.fetch(channelId).catch(()=>null);
        if(!channel||channel.type!==ChannelType.GuildText||!String(channel.topic||'').startsWith('MLD_PRIVATE:'))return interaction.reply({content:'الروم الخاص غير موجود.',ephemeral:true});
        if(!canManageRoom(interaction,channel))return interaction.reply({content:'ما عندك صلاحية إدارة هذا الروم.',ephemeral:true});
        const targetId=memberIdFrom(interaction.fields.getTextInputValue('memberId'));
        if(!targetId)return interaction.reply({content:'المعرّف غير صحيح. استخدم منشن العضو أو معرّفه الرقمي.',ephemeral:true});
        if(targetId===String(channel.topic).slice('MLD_PRIVATE:'.length))return interaction.reply({content:'صاحب الروم لا يمكن طرده من رومه.',ephemeral:true});
        const target=await interaction.guild.members.fetch(targetId).catch(()=>null);
        if(!target)return interaction.reply({content:'هذا العضو غير موجود في السيرفر.',ephemeral:true});
        if(action==='add'){
          await channel.permissionOverwrites.edit(target.id,{ViewChannel:true,SendMessages:true,ReadMessageHistory:true,AttachFiles:true,EmbedLinks:true});
          await channel.send({content:'➕ تمت إضافة '+target.toString()+' إلى الروم الخاص.',allowedMentions:{users:[target.id]}});
          return interaction.reply({content:'تمت إضافة العضو للروم الخاص.',ephemeral:true});
        }
        await channel.permissionOverwrites.edit(target.id,{ViewChannel:false,SendMessages:false,ReadMessageHistory:false});
        await channel.send({content:'👤 تمت إزالة '+target.toString()+' من الروم الخاص.',allowedMentions:{parse:[]}});
        return interaction.reply({content:'تم طرد العضو من الروم الخاص فقط، ولم يتم طرده من السيرفر.',ephemeral:true});
      }
    }catch(error){
      console.error('MLD private rooms:',error?.stack||error);
      if(interaction.isRepliable()&&!interaction.replied&&!interaction.deferred)await interaction.reply({content:'تعذر تنفيذ إدارة الروم الخاص. تحقق من صلاحيات البوت.',ephemeral:true}).catch(()=>{});
    }
  });
}
