import { Events } from 'discord.js';
import { AudioPlayerStatus, createAudioPlayer, createAudioResource, joinVoiceChannel, NoSubscriberBehavior, VoiceConnectionStatus, entersState } from '@discordjs/voice';
import play from 'play-dl';

const queues = new Map();
const clamp = (n,min,max) => Math.max(min,Math.min(max,Number(n)||0));
const safe = (m,s) => m.reply({content:String(s).slice(0,1800),allowedMentions:{parse:[]}}).catch(()=>{});
const getQueue = (id) => queues.get(String(id));
function voiceState(client,guildId){return getQueue(guildId)}
async function resolveTrack(input){
  const query=String(input||'').trim();
  if(!query)throw new Error('اكتب اسم المقطع أو رابطه.');
  let track;
  if(/^https?:\/\//i.test(query)){
    if(/spotify\.com\//i.test(query))throw new Error('روابط Spotify المباشرة غير مدعومة للتشغيل الآن؛ اكتب اسم الأغنية والاسم الفني للبحث عنها.');
    const info=await play.video_basic_info(query).catch(()=>null);
    if(info?.video_details)track={title:info.video_details.title,url:info.video_details.url,duration:info.video_details.durationRaw,thumbnail:info.video_details.thumbnails?.[0]?.url};
    else {
      const results=await play.search(query,{limit:1});
      track=results?.[0]&&{title:results[0].title,url:results[0].url,duration:results[0].durationRaw,thumbnail:results[0].thumbnails?.[0]?.url};
    }
  }else{
    const results=await play.search(query,{limit:1});
    track=results?.[0]&&{title:results[0].title,url:results[0].url,duration:results[0].durationRaw,thumbnail:results[0].thumbnails?.[0]?.url};
  }
  if(!track?.url)throw new Error('ما لقيت مقطع قابل للتشغيل. جرّب اسمًا آخر أو رابط YouTube/SoundCloud.');
  return track;
}
async function playNext(client,guildId){
  const q=getQueue(guildId);if(!q||q.processing)return;
  if(q.repeat&&q.current)q.items.unshift(q.current);
  const next=q.items.shift();
  if(!next){q.current=null;return;}
  q.processing=true;q.current=next;
  try{
    const stream=await play.stream(next.url,{quality:2});
    const resource=createAudioResource(stream.stream,{inputType:stream.type,inlineVolume:true});
    resource.volume?.setVolumeLogarithmic(Math.max(0.01,q.volume/100));
    q.player.play(resource);
    await q.textChannel?.send({content:'🎵 الآن يعمل: **'+next.title+'** · '+(next.duration||'مدة غير معروفة'),allowedMentions:{parse:[]}}).catch(()=>{});
  }catch(e){
    await q.textChannel?.send({content:'تعذر تشغيل **'+next.title+'**. جرّب رابطًا آخر.',allowedMentions:{parse:[]}}).catch(()=>{});
    q.processing=false;q.current=null;return playNext(client,guildId);
  }
  q.processing=false;
}
function ensureQueue(client,message){
  const guildId=message.guild.id,voice=message.member?.voice?.channel;
  if(!voice)throw new Error('ادخل رومًا صوتيًا أولًا.');
  let q=getQueue(guildId);
  if(q&&q.voiceChannelId!==voice.id)throw new Error('ادخل نفس الروم الصوتي الذي يعمل فيه البوت.');
  if(!q){
    const player=createAudioPlayer({behaviors:{noSubscriber:NoSubscriberBehavior.Pause}});
    const connection=joinVoiceChannel({channelId:voice.id,guildId,adapterCreator:message.guild.voiceAdapterCreator,selfDeaf:true});
    connection.subscribe(player);
    q={guildId,voiceChannelId:voice.id,connection,player,items:[],current:null,repeat:false,volume:clamp(client.mldConfig?.musicVolume??100,0,200),textChannel:message.channel,processing:false};
    queues.set(guildId,q);
    connection.on(VoiceConnectionStatus.Disconnected,()=>{queues.delete(guildId);try{connection.destroy()}catch{}});
    player.on(AudioPlayerStatus.Idle,()=>{if(q.current&&!q.repeat)q.current=null; q.processing=false;playNext(client,guildId).catch(e=>console.error('Music next:',e.message));});
    player.on('error',e=>{console.error('Music player:',e.message);q.processing=false;q.current=null;playNext(client,guildId).catch(()=>{});});
    entersState(connection,VoiceConnectionStatus.Ready,20_000).catch(()=>{});
  }
  q.textChannel=message.channel;
  return q;
}
export function setupMusic(client){
  client.mldMusicQueues=queues;
  client.on(Events.MessageCreate,async message=>{
    if(!message.guild||message.author.bot||client.mldType!=='music')return;
    const cfg=client.mldConfig||{},prefix=String(cfg.prefix||'!').slice(0,4);
    const text=String(message.content||'').trim();if(!text.startsWith(prefix))return;
    const [cmd,...args]=text.slice(prefix.length).trim().split(/\s+/),arg=args.join(' ');
    const controls=new Set(['شغل','شغّل','play','وقف','stop','التالي','skip','قائمة','queue','تكرار','repeat','خلط','shuffle','إيقاف-مؤقت','pause','استئناف','resume','صوت','volume']);
    if(!controls.has(cmd))return;
    try{
      if(['شغل','شغّل','play'].includes(cmd)){
        const track=await resolveTrack(arg),q=ensureQueue(client,message),limit=clamp(cfg.musicQueueLimit??25,1,100);
        if(q.items.length+(q.current?1:0)>=limit)return safe(message,'وصلت للحد الأقصى لقائمة التشغيل ('+limit+').');
        q.items.push(track);
        await safe(message,'➕ أُضيفت للقائمة: **'+track.title+'**'+(q.current?'':' — يبدأ التشغيل الآن.'));
        if(!q.current&&!q.processing)await playNext(client,message.guild.id);
        return;
      }
      const q=getQueue(message.guild.id);
      if(!q)return safe(message,'ما فيه موسيقى شغالة. استخدم '+prefix+'شغل <اسم المقطع أو الرابط>.');
      if(message.member?.voice?.channelId!==q.voiceChannelId)return safe(message,'لازم تكون في نفس الروم الصوتي مع البوت.');
      if(['وقف','stop'].includes(cmd)){q.items=[];q.current=null;q.player.stop(true);q.connection.destroy();queues.delete(message.guild.id);return safe(message,'⏹️ تم إيقاف الموسيقى وفصل البوت من الروم.');}
      if(['التالي','skip'].includes(cmd)){if(!q.current&&!q.items.length)return safe(message,'القائمة فارغة.');q.current=null;q.processing=false;q.player.stop(true);return safe(message,'⏭️ تم تخطي المقطع.');}
      if(['قائمة','queue'].includes(cmd))return safe(message,'🎶 **قائمة التشغيل**\n'+(q.current?'▶️ الآن: '+q.current.title+'\n':'')+(q.items.length?q.items.slice(0,15).map((x,i)=>(i+1)+'. '+x.title).join('\n'):'لا توجد مقاطع تالية.'));
      if(['تكرار','repeat'].includes(cmd)){q.repeat=!q.repeat;return safe(message,q.repeat?'🔁 تكرار المقطع الحالي مفعّل.':'تم إيقاف التكرار.');}
      if(['خلط','shuffle'].includes(cmd)){for(let i=q.items.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[q.items[i],q.items[j]]=[q.items[j],q.items[i]];}return safe(message,'🔀 تم خلط قائمة التشغيل.');}
      if(['إيقاف-مؤقت','pause'].includes(cmd))return safe(message,q.player.pause()?'⏸️ تم إيقاف المقطع مؤقتًا.':'تعذر الإيقاف المؤقت.');
      if(['استئناف','resume'].includes(cmd))return safe(message,q.player.unpause()?'▶️ استؤنف التشغيل.':'تعذر استئناف التشغيل.');
      if(['صوت','volume'].includes(cmd)){if(!args[0])return safe(message,'الصوت الحالي: '+q.volume+'%. غيّره بـ '+prefix+'صوت 70');q.volume=clamp(args[0],0,200);return safe(message,'🔊 مستوى الصوت: '+q.volume+'%. يطبق على المقطع التالي.');}
    }catch(e){return safe(message,'⚠️ '+(e.message||'تعذر تنفيذ أمر الموسيقى.'))}
  });
}
