import { Events } from 'discord.js';

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
const enabled = (client, name) => !Array.isArray(client.mldConfig?.enabledGames) || !client.mldConfig.enabledGames.length || client.mldConfig.enabledGames.includes(name);
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
  client.on(Events.MessageCreate, async message => {
    if (!message.guild || message.author.bot || client.mldType !== 'games') return;
    const cfg=client.mldConfig||{}, prefix=String(cfg.prefix||'!').slice(0,4), content=String(message.content||'').trim();
    const round=client.mldGameRounds.get(message.channel.id);
    if (round && Date.now()<round.expiresAt && round.userId!==message.author.id && normalize(content)===normalize(round.answer)) {
      client.mldGameRounds.delete(message.channel.id);
      const pts=Math.max(0,Math.min(100000,Number(cfg.gamePoints??10)||10));
      await award(pool,client,message,pts).catch(()=>{});
      return safeReply(message,'🎉 إجابة صحيحة يا '+message.member.displayName+'! ربحت **'+pts+'** نقطة.');
    }
    if (!content.startsWith(prefix)) return;
    const parts=content.slice(prefix.length).trim().split(/\s+/), cmd=String(parts.shift()||'');
    if (!cmd) return;
    if (cmd==='help'||cmd==='ألعاب'||cmd==='العاب') return safeReply(message,'🎮 ألعاب ملاذ: '+GAME_NAMES.join(' • ')+'\nاكتب الأمر بعد '+prefix+' لبدء اللعبة. اكتب '+prefix+'توب لعرض المتصدرين.');
    if (cmd==='توب') {
      if(!pool)return safeReply(message,'لوحة النقاط غير متاحة الآن.');
      const q=await pool.query('SELECT user_id,points,wins FROM mld_discord_game_scores WHERE bot_id=$1 AND guild_id=$2 ORDER BY points DESC,wins DESC LIMIT 10',[String(client.mldBotId||client.user.id),message.guild.id]);
      return safeReply(message,q.rows.length?'🏆 **متصدرون الألعاب**\n'+q.rows.map((r,i)=>(i+1)+'. <@'+r.user_id+'> — '+r.points+' نقطة · '+r.wins+' فوز').join('\n'):'لا توجد نتائج بعد. ابدأ لعبة لتحجز مكانك!');
    }
    if (cmd==='المتجر') return safeReply(message,'🛍️ متجر ألعاب ملاذ\n• 100 نقطة — لقب لاعب مميز (قريبًا)\n• نقاطك تُجمع عند الفوز بالألعاب. لا يتم خصم أي نقاط من حسابك هنا.');
    if (cmd==='ايقاف') { client.mldGameRounds.delete(message.channel.id); return safeReply(message,'⏹️ تم إنهاء الجولة الحالية في هذه القناة.'); }
    if (cmd==='تحويل') {
      const target=message.mentions.users.first(), amount=Number(parts.find(x=>/^\d+$/.test(x)));
      if(!target||target.bot||target.id===message.author.id||!Number.isSafeInteger(amount)||amount<=0)return safeReply(message,'استخدم: '+prefix+'تحويل @عضو عدد_النقاط');
      if(!pool)return safeReply(message,'قاعدة النقاط غير متاحة الآن.');
      const db=await pool.connect();
      try{await db.query('BEGIN');const debit=await db.query('UPDATE mld_discord_game_scores SET points=points-$1,updated_at=NOW() WHERE bot_id=$2 AND guild_id=$3 AND user_id=$4 AND points >= $1 RETURNING points',[amount,String(client.mldBotId||client.user.id),message.guild.id,message.author.id]);if(!debit.rowCount){await db.query('ROLLBACK');return safeReply(message,'نقاطك غير كافية.');}await db.query('INSERT INTO mld_discord_game_scores(bot_id,guild_id,user_id,points) VALUES($1,$2,$3,$4) ON CONFLICT(bot_id,guild_id,user_id) DO UPDATE SET points=mld_discord_game_scores.points+$4,updated_at=NOW()',[String(client.mldBotId||client.user.id),message.guild.id,target.id,amount]);await db.query('COMMIT');return safeReply(message,'✅ حولت '+amount+' نقطة إلى '+target.username+'.');}catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{db.release()}
    }
    const aliases={'برا السالفة':'برا السالفة','روليت':'روليت','مافيا':'مافيا','كت':'كت','زر':'زر','حجره':'حجره','بومب':'بومب','تصويت':'تصويت','ايفنت':'ايفنت','اعلام':'اعلام','فكك':'فكك','ترتيب':'ترتيب','صحح':'صحح','جمع':'جمع','مفرد':'مفرد','حيوانات':'حيوانات','شركة':'شركة','ضرب':'ضرب','طرح':'طرح','ترجمة':'ترجمة','عواصم':'عواصم','اعكس':'اعكس','اسرع':'اسرع','حرف':'حرف','ادمج':'ادمج','هايد':'هايد','فخ':'فخ','اكس':'اكس','سالفة':'سالفة'};
    const name=aliases[cmd]; if(!name)return;
    if(!enabled(client,name))return safeReply(message,'هذه اللعبة معطّلة من لوحة التحكم.');
    if(['زر','حجره'].includes(name)){const choices=['حجر 🪨','ورقة 📄','مقص ✂️'],bot=pick(choices),user=String(parts.join(' '));if(!user)return safeReply(message,'اختر: '+prefix+name+' حجر أو ورقة أو مقص');const map={'حجر':'حجر 🪨','ورقة':'ورقة 📄','مقص':'مقص ✂️','مقصّ':'مقص ✂️'};const p=map[user]||choices.find(x=>x.startsWith(user));if(!p)return safeReply(message,'اختيارك غير معروف. استخدم حجر أو ورقة أو مقص.');const win=p===bot?'تعادل':((p.startsWith('حجر')&&bot.startsWith('مقص'))||(p.startsWith('ورقة')&&bot.startsWith('حجر'))||(p.startsWith('مقص')&&bot.startsWith('ورقة')))?'فزت!':'خسرت!';if(win==='فزت!')await award(pool,client,message,Number(cfg.gamePoints??10)).catch(()=>{});return safeReply(message,'أنت: '+p+'\nأنا: '+bot+'\n'+win);}
    if(name==='روليت'){const n=Math.floor(Math.random()*6)+1;return safeReply(message,'🎲 روليت الحظ: '+n+' من 6 — '+(n===6?'ضربة حظ!':'جرّب مرة ثانية'));}
    if(name==='مافيا')return safeReply(message,'🕵️ مافيا: اجمع 4 لاعبين على الأقل ثم ابدأ التصويت. هذه الجولة السريعة تختار دورك: **'+pick(['مدني','طبيب','محقق','مافيا'])+'**. للتجربة الجماعية اكتب '+prefix+'تصويت <موضوع>.');
    if(name==='كت')return safeReply(message,'⚡ كت: '+pick(['تحدّ صديقك بسباق سرعة','اذكر 5 أشياء تبدأ بحرف م','اكتب أطول كلمة تعرفها خلال 10 ثوانٍ'])+'!');
    if(name==='بومب')return safeReply(message,'💣 بومب! '+pick(['مرّت القنبلة بسلام!','انفجرت عندك! حظ أوفر.','نجوت بفارق ثانية!']));
    if(name==='تصويت')return safeReply(message,'📊 تصويت سريع: '+(parts.join(' ')||'هل نبدأ لعبة جديدة؟')+'\n👍 = مع · 👎 = ضد (أضف التفاعلات يدويًا).');
    if(name==='ايفنت')return safeReply(message,'🎉 إيفنت ملاذ: '+pick(['سباق أسرع إجابة','تحدي الألغاز','جولة حظ','تحدي معلومات عامة'])+' — اكتب '+prefix+'اسرع للبدء.');
    if(name==='سالفة')return safeReply(message,'📖 سالفة: '+pick(['دخل عضو جديد وقال: عندي سؤال… ثم نسي السؤال!','كان فيه لاعب يفوز دائمًا، لين اكتشف أنه يلعب لحاله.','دخلت القطة اجتماع الإدارة وطلبت صلاحية مشرف.'])+'\nكمّل القصة بردك!');
    if(name==='برا السالفة')return safeReply(message,'🕵️ برا السالفة: كل الموجودين يختارون كلمة سرّية في الخاص، وواحد يختار كلمة مختلفة. ناقشوا التلميحات ثم صوّتوا على المشتبه به. اكتب '+prefix+'تصويت <اسم العضو>.');
    if(name==='هايد')return safeReply(message,'🙈 هايد: '+pick(['اختبأت خلف الستارة!','وجدت مخبأ سريًا تحت الطاولة.','انكشف مكانك! الجولة القادمة أفضل.']));
    if(name==='فخ')return safeReply(message,'⚠️ فخ: '+pick(['نجوت من اللغم! +10 نقاط معنوية.','وقعت في الفخ! حاول مجددًا.','اكتشفت الفخ قبل أن ينفجر.']));
    if(name==='اكس')return safeReply(message,'❌⭕ اكس: لعبة XO التفاعلية متعددة الأدوار ستحتاج غرفة مخصصة؛ ابدأ الآن بتحدي صديق: '+prefix+'اكس @عضو.');
    if(name==='اسرع'){const q=pick([['كم 7 × 8؟','56'],['عاصمة اليابان؟','طوكيو'],['كم يومًا في الأسبوع؟','7'],['كم 15 - 6؟','9']]);client.mldGameRounds.set(message.channel.id,{answer:q[1],userId:message.author.id,expiresAt:Date.now()+45000});return safeReply(message,'⚡ أول إجابة صحيحة تربح! '+q[0]+' (45 ثانية)');}
    if(name==='ضرب'||name==='طرح'){const a=Math.floor(Math.random()*20)+1,b=Math.floor(Math.random()*20)+1,ans=name==='ضرب'?a*b:a-b;client.mldGameRounds.set(message.channel.id,{answer:String(ans),userId:message.author.id,expiresAt:Date.now()+45000});return safeReply(message,'🧠 حل بسرعة: '+a+(name==='ضرب'?' × ':' − ')+b+' = ؟ (45 ثانية)');}
    if(questions[name]){const q=pick(questions[name]);client.mldGameRounds.set(message.channel.id,{answer:q[1],userId:message.author.id,expiresAt:Date.now()+45000});return safeReply(message,'🧩 '+q[0]+' (45 ثانية)');}
    if(name==='اعكس'){const word=pick(['ملاذ','مجتمع','برمجة','مغامرة','ألعاب']);client.mldGameRounds.set(message.channel.id,{answer:[...word].reverse().join(''),userId:message.author.id,expiresAt:Date.now()+45000});return safeReply(message,'🔄 اعكس الكلمة: **'+word+'** (45 ثانية)');}
    if(name==='اسرع')return;
  });
}
