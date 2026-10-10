import { Events, EmbedBuilder, PermissionFlagsBits } from 'discord.js';

const GAME_NAMES = ['سالفة','برا السالفة','روليت','مافيا','كت','زر','بومب','تصويت','ايفنت','اعلام','فكك','ترتيب','صحح','جمع','مفرد','حيوانات','شركة','ضرب','طرح','ترجمة','عواصم','اعكس','اسرع','حرف','ادمج','توب','هايد','فخ','حجره','اكس','المتجر','تحويل','ايقاف'];
const questions = {
  'اعلام': [['🇸🇦','السعودية'],['🇯🇵','اليابان'],['🇫🇷','فرنسا'],['🇧🇷','البرازيل'],['🇨🇦','كندا'],['🇪🇬','مصر'],['🇹🇷','تركيا']],
  'ترجمة': [['apple','تفاحة'],['book','كتاب'],['water','ماء'],['friend','صديق'],['moon','قمر'],['school','مدرسة']],
  'عواصم': [['السعودية','الرياض'],['مصر','القاهرة'],['اليابان','طوكيو'],['فرنسا','باريس'],['الإمارات','أبوظبي'],['الأردن','عمّان']],
  'حيوانات': [['أكبر حيوان في العالم؟','الحوت الأزرق'],['حيوان يُلقّب بسفينة الصحراء؟','الجمل'],['ما الحيوان المعروف بملك الغابة؟','الأسد']],
  'شركة': [['ما الشركة التي تصنع الآيفون؟','آبل'],['ما الشركة المطورة لويندوز؟','مايكروسوفت'],['ما الشركة المالكة لأندرويد؟','جوجل']],
  'جمع': [['جمع كلمة كتاب؟','كتب'],['جمع كلمة مدينة؟','مدن'],['جمع كلمة قلم؟','أقلام']],
  'مفرد': [['مفرد كلمة أقلام؟','قلم'],['مفرد كلمة أشجار؟','شجرة'],['مفرد كلمة كتب؟','كتاب']],
  'صحح': [['صحح العبارة: الشمس تدور حول الأرض','الأرض تدور حول الشمس'],['صحح العبارة: عدد أيام الأسبوع 8','عدد أيام الأسبوع 7'],['صحح العبارة: الماء يغلي عند 50 درجة مئوية عند الضغط الجوي المعتاد','الماء يغلي عند 100 درجة مئوية']],
  'فكك': [['رتب الحروف: ب ت ا ك','كتاب'],['رتب الحروف: ة ر ا س د م','مدرسة'],['رتب الحروف: ر م ق','قمر']],
  'ترتيب': [['رتب الحروف: ب ت ا ك','كتاب'],['رتب الحروف: ل ي م ز','زميل'],['رتب الحروف: ة ب ع ل','لعبة']],
  'ادمج': [['ادمج كلمتي شمس + زهرة','عباد الشمس'],['ادمج كلمتي بيت + شعر','بيت الشعر']],
  'حرف': [['اذكر دولة تبدأ بحرف م','مصر'],['اذكر حيوانًا يبدأ بحرف ق','قرد'],['اذكر فاكهة تبدأ بحرف ت','تفاح']],
  'توب': [['رتّب من الأصغر إلى الأكبر: 3، 1، 2','1 2 3'],['رتّب من الأصغر إلى الأكبر: 8، 4، 6','4 6 8']]
};
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const normalize = s => String(s || '').toLowerCase().replace(/[ًٌٍَُِّْـ]/g,'').replace(/[؟?!.,،]/g,'').trim().replace(/\s+/g,' ');
const enabled = (client, name) => { const list=client.mldConfig?.enabledGames; if(!Array.isArray(list))return true; const aliases={ 'فخ':['فخ','فخ / لغم'], 'المتجر':['المتجر','متجر'], 'فكك':['فكك'], 'حجره':['حجره','حجرة'] }; return (aliases[name]||[name]).some(x=>list.includes(x)); };
const safeReply = (message, content) => message.reply({content:String(content).slice(0,1800),allowedMentions:{parse:[]}}).catch(()=>{});
async function ensureScores(pool) {
  if (!pool) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS mld_discord_game_scores (
    bot_id TEXT NOT NULL, guild_id TEXT NOT NULL, user_id TEXT NOT NULL,
    points BIGINT NOT NULL DEFAULT 0 CHECK(points >= 0), wins BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(bot_id,guild_id,user_id)
  )`);
}
async function award(pool, client, message, points=10) {
  if (!pool) return;
  await pool.query(`INSERT INTO mld_discord_game_scores(bot_id,guild_id,user_id,points,wins)
    VALUES($1,$2,$3,$4,1) ON CONFLICT(bot_id,guild_id,user_id)
    DO UPDATE SET points=mld_discord_game_scores.points+$4,wins=mld_discord_game_scores.wins+1,updated_at=NOW()`,
    [String(client.mldBotId||client.user.id),message.guild.id,message.author.id,points]);
}
export function setupGames(client, pool) {
  if (pool) ensureScores(pool).catch(e=>console.error('Game score table:',e.message));
  client.mldGameRounds = new Map();
  client.mldXO = new Map();
  client.mldMafiaGames = new Map();
  client.mldGameScoresReady = pool ? ensureScores(pool) : Promise.resolve();
  client.on(Events.MessageCreate, async message => {
    if (!message.guild || message.author.bot || !['games','allinone'].includes(client.mldType)) return;
    const cfg=client.mldConfig||{}, prefix=String(cfg.prefixes?.games||cfg.prefix||'!').slice(0,4), content=String(message.content||'').trim();
    const hasPrefix=content.startsWith(prefix), commandText=hasPrefix?content.slice(prefix.length).trim():content;
    const [rawGameCommand]=commandText.split(/\s+/), commandSettings=cfg.commandSettings&&typeof cfg.commandSettings==='object'?cfg.commandSettings:{};
    const coreAlias=Object.entries(commandSettings).find(([key,item])=>item&&item.enabled!==false&&Array.isArray(item.aliases)&&item.aliases.some(alias=>String(alias).toLowerCase()===String(rawGameCommand||'').toLowerCase()));
    if(!hasPrefix&&!(cfg.shortcutsEnabled===true&&coreAlias))return;
    if(commandSettings[coreAlias?.[0]||String(rawGameCommand||'')]?.enabled===false)return safeReply(message,'هذا الأمر معطّل من لوحة التحكم.');
    if(pool){try{await client.mldGameScoresReady}catch(e){console.error('Game score table unavailable:',e.message);return safeReply(message,'نظام النقاط غير متاح مؤقتًا. حاول لاحقًا.')}}
    const round=client.mldGameRounds.get(message.channel.id);
    if (round && Date.now()<round.expiresAt && round.userId!==message.author.id && normalize(content)===normalize(round.answer)) {
      client.mldGameRounds.delete(message.channel.id);
      const pts=Math.max(0,Math.min(100000,Number(cfg.gamePoints??10)||10));
      await award(pool,client,message,pts).catch(()=>{});
      return safeReply(message,'🎉 إجابة صحيحة يا '+message.member.displayName+'! ربحت **'+pts+'** نقطة.');
    }
    const parts=commandText.split(/\s+/); let cmd=String(parts.shift()||''); if(coreAlias)cmd=coreAlias[0];
    if (!cmd) return;
    if (cmd==='ألعاب'||cmd==='العاب') return safeReply(message,'🎮 ألعاب ملاذ: '+GAME_NAMES.join(' • ')+'\nاكتب الأمر بعد '+prefix+' لبدء اللعبة. اكتب '+prefix+'توب لعرض المتصدرين.');
    if (cmd==='توب') {
      if(!enabled(client,'توب'))return safeReply(message,'هذه اللعبة معطّلة من لوحة التحكم.');
      if(!pool)return safeReply(message,'لوحة النقاط غير متاحة الآن.');
      const q=await pool.query('SELECT user_id,points,wins FROM mld_discord_game_scores WHERE bot_id=$1 AND guild_id=$2 ORDER BY points DESC,wins DESC LIMIT 10',[String(client.mldBotId||client.user.id),message.guild.id]);
      return safeReply(message,q.rows.length?'🏆 **متصدرون الألعاب**\n'+q.rows.map((r,i)=>(i+1)+'. <@'+r.user_id+'> — '+r.points+' نقطة · '+r.wins+' فوز').join('\n'):'لا توجد نتائج بعد. ابدأ لعبة لتحجز مكانك!');
    }
    if (cmd==='المتجر') { if(!enabled(client,'المتجر'))return safeReply(message,'هذه اللعبة معطّلة من لوحة التحكم.'); return safeReply(message,'🛍️ متجر ألعاب ملاذ\n• 100 نقطة — لقب لاعب مميز (قريبًا)\n• نقاطك تُجمع عند الفوز بالألعاب. لا يتم خصم أي نقاط من حسابك هنا.'); }
    if (cmd==='ايقاف') { client.mldGameRounds.delete(message.channel.id); return safeReply(message,'⏹️ تم إنهاء الجولة الحالية في هذه القناة.'); }
    if (cmd==='تحويل') {
      if(!enabled(client,'تحويل'))return safeReply(message,'هذه اللعبة معطّلة من لوحة التحكم.');
      const target=message.mentions.users.first(), amount=Number(parts.find(x=>/^\d+$/.test(x)));
      if(!target||target.bot||target.id===message.author.id||!Number.isSafeInteger(amount)||amount<=0)return safeReply(message,'استخدم: '+prefix+'تحويل @عضو عدد_النقاط');
      if(!pool)return safeReply(message,'قاعدة النقاط غير متاحة الآن.');
      const db=await pool.connect();
      try{await db.query('BEGIN');const debit=await db.query('UPDATE mld_discord_game_scores SET points=points-$1,updated_at=NOW() WHERE bot_id=$2 AND guild_id=$3 AND user_id=$4 AND points >= $1 RETURNING points',[amount,String(client.mldBotId||client.user.id),message.guild.id,message.author.id]);if(!debit.rowCount){await db.query('ROLLBACK');return safeReply(message,'نقاطك غير كافية.');}await db.query('INSERT INTO mld_discord_game_scores(bot_id,guild_id,user_id,points) VALUES($1,$2,$3,$4) ON CONFLICT(bot_id,guild_id,user_id) DO UPDATE SET points=mld_discord_game_scores.points+$4,updated_at=NOW()',[String(client.mldBotId||client.user.id),message.guild.id,target.id,amount]);await db.query('COMMIT');return safeReply(message,'✅ حولت '+amount+' نقطة إلى '+target.username+'.');}catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{db.release()}
    }
    const aliases={'برا السالفة':'برا السالفة','روليت':'روليت','مافيا':'مافيا','كت':'كت','زر':'زر','حجره':'حجره','بومب':'بومب','تصويت':'تصويت','ايفنت':'ايفنت','اعلام':'اعلام','فكك':'فكك','ترتيب':'ترتيب','صحح':'صحح','جمع':'جمع','مفرد':'مفرد','حيوانات':'حيوانات','شركة':'شركة','ضرب':'ضرب','طرح':'طرح','ترجمة':'ترجمة','عواصم':'عواصم','اعكس':'اعكس','اسرع':'اسرع','حرف':'حرف','ادمج':'ادمج','هايد':'هايد','فخ':'فخ','اكس':'اكس','اسرع':'اسرع','ضرب':'ضرب','طرح':'طرح','سالفة':'سالفة'};
    const name=aliases[cmd] || (cmd==='برا'?'برا السالفة':null); if(!name)return;
    if(!enabled(client,name))return safeReply(message,'هذه اللعبة معطّلة من لوحة التحكم.');
    if(['زر','حجره'].includes(name)){const choices=['حجر 🪨','ورقة 📄','مقص ✂️'],bot=pick(choices),user=String(parts.join(' '));if(!user)return safeReply(message,'اختر: '+prefix+name+' حجر أو ورقة أو مقص');const map={'حجر':'حجر 🪨','ورقة':'ورقة 📄','مقص':'مقص ✂️','مقصّ':'مقص ✂️'};const p=map[user]||choices.find(x=>x.startsWith(user));if(!p)return safeReply(message,'اختيارك غير معروف. استخدم حجر أو ورقة أو مقص.');const win=p===bot?'تعادل':((p.startsWith('حجر')&&bot.startsWith('مقص'))||(p.startsWith('ورقة')&&bot.startsWith('حجر'))||(p.startsWith('مقص')&&bot.startsWith('ورقة')))?'فزت!':'خسرت!';if(win==='فزت!')await award(pool,client,message,Number(cfg.gamePoints??10)).catch(()=>{});return safeReply(message,'أنت: '+p+'\nأنا: '+bot+'\n'+win);}
    if(name==='روليت'){const n=Math.floor(Math.random()*6)+1;return safeReply(message,'🎲 روليت الحظ: '+n+' من 6 — '+(n===6?'ضربة حظ!':'جرّب مرة ثانية'));}
    if(name==='مافيا'){
      const action=String(parts[0]||'').toLowerCase(),channelId=message.channel.id;
      let game=client.mldMafiaGames.get(channelId);
      if(['إنهاء','انهاء','إلغاء','الغاء'].includes(action)){
        if(!game)return safeReply(message,'ما فيه جولة مافيا شغالة هنا.');
        if(game.hostId!==message.author.id&&!message.member.permissions.has(PermissionFlagsBits.ManageGuild))return safeReply(message,'مضيف الجولة أو الإدارة فقط يقدرون ينهونها.');
        client.mldMafiaGames.delete(channelId);return safeReply(message,'⏹️ انتهت جولة المافيا.');
      }
      if(['انضم','join'].includes(action)){
        if(!game||game.phase!=='join')return safeReply(message,'ما فيه غرفة تستقبل لاعبين. اكتب '+prefix+'مافيا لفتح غرفة جديدة.');
        if(game.players.includes(message.author.id))return safeReply(message,'أنت منضم بالفعل.');
        if(game.players.length>=12)return safeReply(message,'الغرفة مكتملة (12 لاعبًا).');
        game.players.push(message.author.id);
        return safeReply(message,'✅ انضم '+message.member.displayName+' إلى المافيا ('+game.players.length+'/12). المضيف يبدأ بـ '+prefix+'مافيا ابدأ.');
      }
      if(['ابدأ','ابدء','start'].includes(action)){
        if(!game||game.phase!=='join')return safeReply(message,'افتح غرفة أولًا بـ '+prefix+'مافيا.');
        if(game.hostId!==message.author.id&&!message.member.permissions.has(PermissionFlagsBits.ManageGuild))return safeReply(message,'مضيف الغرفة أو الإدارة فقط يقدرون يبدأون الجولة.');
        if(game.players.length<4)return safeReply(message,'تحتاج 4 لاعبين على الأقل. اكتب '+prefix+'مافيا انضم للانضمام.');
        const shuffled=[...game.players].sort(()=>Math.random()-.5),mafiaCount=Math.max(1,Math.floor(shuffled.length/4));
        game.roles={};game.alive=[...shuffled];game.votes={};game.phase='vote';game.day=1;
        shuffled.forEach((id,index)=>game.roles[id]=index<mafiaCount?'مافيا':'مدني');
        try{
          for(const uid of shuffled){const user=await client.users.fetch(uid);await user.send('🕵️ **دورك في مافيا ملاذ**\nدورك: **'+game.roles[uid]+'**\n'+(game.roles[uid]==='مافيا'?'تظاهر أنك مدني وحاول البقاء.':'اكتشف المافيا وصوّت عليها.')+'\nالسيرفر: '+message.guild.name+' · الجولة '+game.day);}
        }catch{
          client.mldMafiaGames.delete(channelId);
          return safeReply(message,'تعذر إرسال الأدوار بالخاص لأحد اللاعبين. فعّل الرسائل الخاصة من أعضاء السيرفر ثم افتح جولة جديدة.');
        }
        return safeReply(message,'🌙 **بدأت جولة المافيا!**\nاللاعبون: '+game.alive.map(uid=>'<@'+uid+'>').join('، ')+'\nتم إرسال الأدوار بالخاص. ناقشوا ثم صوّتوا بـ '+prefix+'مافيا تصويت @عضو\nلإنهاء الجولة: '+prefix+'مافيا إنهاء');
      }
      if(['تصويت','صوت','vote'].includes(action)){
        if(!game||game.phase!=='vote')return safeReply(message,'ما فيه جولة تصويت حاليًا.');
        if(!game.alive.includes(message.author.id))return safeReply(message,'أنت خارج الجولة أو لست لاعبًا فيها.');
        const target=message.mentions.users.first();
        if(!target||!game.alive.includes(target.id)||target.id===message.author.id)return safeReply(message,'منشن لاعبًا حيًا غيرك: '+prefix+'مافيا تصويت @عضو');
        game.votes[message.author.id]=target.id;
        const voted=Object.keys(game.votes).filter(uid=>game.alive.includes(uid)).length;
        if(voted<game.alive.length)return safeReply(message,'🗳️ تم تسجيل صوتك ('+voted+'/'+game.alive.length+').');
        const tally={};for(const uid of game.alive){const to=game.votes[uid];if(to)tally[to]=(tally[to]||0)+1;}
        const maxVotes=Math.max(0,...Object.values(tally)),leaders=Object.keys(tally).filter(uid=>tally[uid]===maxVotes);
        if(!leaders.length||leaders.length>1){game.votes={};game.day++;return safeReply(message,'🤝 تعادل التصويت. ما خرج أحد. تبدأ جولة '+game.day+'؛ أعيدوا التصويت بـ '+prefix+'مافيا تصويت @عضو');}
        const eliminated=leaders[0],role=game.roles[eliminated];game.alive=game.alive.filter(uid=>uid!==eliminated);game.votes={};
        const mafiaAlive=game.alive.filter(uid=>game.roles[uid]==='مافيا').length,others=game.alive.length-mafiaAlive;
        if(mafiaAlive===0||mafiaAlive>=others){client.mldMafiaGames.delete(channelId);return safeReply(message,'⚖️ خرج <@'+eliminated+'> وكان دوره **'+role+'**.\n'+(mafiaAlive===0?'🏆 فاز المدنيون! اكتشفوا كل المافيا.':'🕵️ فازت المافيا! سيطرت على الجولة.')+'\nاللاعبون الباقون: '+(game.alive.map(uid=>'<@'+uid+'>').join('، ')||'لا أحد'));}
        game.day++;return safeReply(message,'⚖️ خرج <@'+eliminated+'> وكان دوره **'+role+'**.\nالباقون: '+game.alive.map(uid=>'<@'+uid+'>').join('، ')+'\nتبدأ جولة '+game.day+'. صوّتوا بـ '+prefix+'مافيا تصويت @عضو');
      }
      if(['حالة','اللاعبون','status'].includes(action)){
        return safeReply(message,game?'🕵️ حالة المافيا · '+(game.phase==='join'?'تجميع اللاعبين':'جولة '+game.day)+'\nاللاعبون: '+(game.phase==='join'?game.players:game.alive).map(uid=>'<@'+uid+'>').join('، '):'ما فيه جولة مافيا. اكتب '+prefix+'مافيا لفتح واحدة.');
      }
      if(!game){game={hostId:message.author.id,players:[message.author.id],phase:'join',votes:{},roles:{},alive:[]};client.mldMafiaGames.set(channelId,game);return safeReply(message,'🕵️ **غرفة مافيا جديدة**\nالمضيف: '+message.author.toString()+'\nاللاعبون: 1/12 · تحتاج 4 لاعبين على الأقل.\nالانضمام: '+prefix+'مافيا انضم\nالبدء: '+prefix+'مافيا ابدأ\nالحالة: '+prefix+'مافيا حالة');}
      return safeReply(message,'أوامر المافيا: '+prefix+'مافيا انضم · '+prefix+'مافيا ابدأ · '+prefix+'مافيا تصويت @عضو · '+prefix+'مافيا حالة · '+prefix+'مافيا إنهاء');
    }
    if(name==='اعلام'){
      const flags=[['السعودية','sa'],['اليابان','jp'],['فرنسا','fr'],['البرازيل','br'],['كندا','ca'],['مصر','eg'],['تركيا','tr'],['الإمارات','ae'],['إيطاليا','it'],['ألمانيا','de'],['أستراليا','au'],['كوريا الجنوبية','kr']];
      const [answer,code]=pick(flags);client.mldGameRounds.set(message.channel.id,{answer,userId:message.author.id,expiresAt:Date.now()+45000});
      const embed=new EmbedBuilder().setColor(0xff9cde).setTitle('🌍 تحدي الأعلام').setDescription('ما اسم الدولة التي يمثلها العلم؟\nأول إجابة صحيحة خلال 45 ثانية تربح.').setImage('https://flagcdn.com/w640/'+code+'.png').setFooter({text:'MLD · ألعاب ملاذ'}).setTimestamp();
      return message.reply({embeds:[embed],allowedMentions:{parse:[]}});
    }
    if(name==='كت')return safeReply(message,'⚡ كت: '+pick(['تحدّ صديقك بسباق سرعة','اذكر 5 أشياء تبدأ بحرف م','اكتب أطول كلمة تعرفها خلال 10 ثوانٍ'])+'!');
    if(name==='بومب')return safeReply(message,'💣 بومب! '+pick(['مرّت القنبلة بسلام!','انفجرت عندك! حظ أوفر.','نجوت بفارق ثانية!']));
    if(name==='تصويت'){const poll=await message.reply({content:'📊 **تصويت ملاذ**\n'+(parts.join(' ')||'هل نبدأ لعبة جديدة؟')+'\nصوّت بالتفاعل أدناه.',allowedMentions:{parse:[]}});await Promise.all([poll.react('👍').catch(()=>{}),poll.react('👎').catch(()=>{})]);return;}
    if(name==='ايفنت')return safeReply(message,'🎉 إيفنت ملاذ: '+pick(['سباق أسرع إجابة','تحدي الألغاز','جولة حظ','تحدي معلومات عامة'])+' — اكتب '+prefix+'اسرع للبدء.');
    if(name==='سالفة')return safeReply(message,'📖 سالفة: '+pick(['دخل عضو جديد وقال: عندي سؤال… ثم نسي السؤال!','كان فيه لاعب يفوز دائمًا، لين اكتشف أنه يلعب لحاله.','دخلت القطة اجتماع الإدارة وطلبت صلاحية مشرف.'])+'\nكمّل القصة بردك!');
    if(name==='برا السالفة')return safeReply(message,'🕵️ برا السالفة: كل الموجودين يختارون كلمة سرّية في الخاص، وواحد يختار كلمة مختلفة. ناقشوا التلميحات ثم صوّتوا على المشتبه به. اكتب '+prefix+'تصويت <اسم العضو>.');
    if(name==='هايد')return safeReply(message,'🙈 هايد: '+pick(['اختبأت خلف الستارة!','وجدت مخبأ سريًا تحت الطاولة.','انكشف مكانك! الجولة القادمة أفضل.']));
    if(name==='فخ')return safeReply(message,'⚠️ فخ: '+pick(['نجوت من اللغم! +10 نقاط معنوية.','وقعت في الفخ! حاول مجددًا.','اكتشفت الفخ قبل أن ينفجر.']));
    if(name==='اكس'){
      let game=client.mldXO.get(message.channel.id);
      if(!game){
        const opponent=message.mentions.users.first();
        if(!opponent||opponent.bot||opponent.id===message.author.id)return safeReply(message,'ابدأ تحدي XO هكذا: '+prefix+'اكس @الخصم');
        game={players:[message.author.id,opponent.id],symbols:{[message.author.id]:'❌',[opponent.id]:'⭕'},turn:message.author.id,board:Array(9).fill('')};
        client.mldXO.set(message.channel.id,game);
        const board=game.board.map((v,i)=>v||String(i+1)+'️⃣').reduce((out,v,i)=>out+(i%3===0?'\n':' | ')+v,'');
        return safeReply(message,'❌⭕ **بدأت XO!**\n'+opponent.toString()+' تحدّاك. يبدأ '+message.author.toString()+'.\n'+board+'\nاكتب '+prefix+'اكس رقم الخانة (1–9).');
      }
      if(!game.players.includes(message.author.id))return;
      if(game.turn!==message.author.id)return safeReply(message,'انتظر دور خصمك.');
      const cell=Number(parts[0]);
      if(!Number.isInteger(cell)||cell<1||cell>9)return safeReply(message,'اختر خانة من 1 إلى 9: '+prefix+'اكس 5');
      if(game.board[cell-1])return safeReply(message,'الخانة مأخوذة، اختر خانة ثانية.');
      game.board[cell-1]=game.symbols[message.author.id];
      const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
      const won=lines.some(line=>line.every(i=>game.board[i]===game.symbols[message.author.id]));
      const board=game.board.map((v,i)=>v||String(i+1)+'️⃣').reduce((out,v,i)=>out+(i%3===0?'\n':' | ')+v,'');
      if(won){client.mldXO.delete(message.channel.id);await award(pool,client,message,Math.max(0,Number(cfg.gamePoints??10)||10)).catch(()=>{});return safeReply(message,'🏆 فاز '+message.author.toString()+'!\n'+board);}
      if(game.board.every(Boolean)){client.mldXO.delete(message.channel.id);return safeReply(message,'🤝 تعادل!\n'+board);}
      game.turn=game.players.find(id=>id!==message.author.id);
      return safeReply(message,board+'\nدور <@'+game.turn+'> ('+game.symbols[game.turn]+').');
    }
    if(name==='اسرع'){const q=pick([['كم 7 × 8؟','56'],['عاصمة اليابان؟','طوكيو'],['كم يومًا في الأسبوع؟','7'],['كم 15 - 6؟','9']]);client.mldGameRounds.set(message.channel.id,{answer:q[1],userId:message.author.id,expiresAt:Date.now()+45000});return safeReply(message,'⚡ أول إجابة صحيحة تربح! '+q[0]+' (45 ثانية)');}
    if(name==='ضرب'||name==='طرح'){const a=Math.floor(Math.random()*20)+1,b=Math.floor(Math.random()*20)+1,ans=name==='ضرب'?a*b:a-b;client.mldGameRounds.set(message.channel.id,{answer:String(ans),userId:message.author.id,expiresAt:Date.now()+45000});return safeReply(message,'🧠 حل بسرعة: '+a+(name==='ضرب'?' × ':' − ')+b+' = ؟ (45 ثانية)');}
    if(questions[name]){const q=pick(questions[name]);client.mldGameRounds.set(message.channel.id,{answer:q[1],userId:message.author.id,expiresAt:Date.now()+45000});return safeReply(message,'🧩 '+q[0]+' (45 ثانية)');}
    if(name==='اعكس'){const word=pick(['ملاذ','مجتمع','برمجة','مغامرة','ألعاب']);client.mldGameRounds.set(message.channel.id,{answer:[...word].reverse().join(''),userId:message.author.id,expiresAt:Date.now()+45000});return safeReply(message,'🔄 اعكس الكلمة: **'+word+'** (45 ثانية)');}
    if(name==='اسرع')return;
  });
}
