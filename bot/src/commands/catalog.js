import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here=dirname(fileURLToPath(import.meta.url));
const catalogPath=join(here,'../../../web/public/command-catalog.json');
export const CATALOG_COMMANDS=JSON.parse(readFileSync(catalogPath,'utf8'));
export const CATALOG_COMMAND_MAP=new Map(CATALOG_COMMANDS.map(item=>[item.name,item]));

const choose=a=>a[Math.floor(Math.random()*a.length)];
const numArgs=args=>args.map(Number).filter(Number.isFinite);
const safeText=value=>String(value||'').slice(0,1800);
const escapeMentions={parse:[]};
const facts={
 general:[['كم عدد ألوان قوس قزح؟','سبعة'],['ما أكبر كوكب في المجموعة الشمسية؟','المشتري'],['ما عاصمة اليابان؟','طوكيو'],['كم ضلعًا للمثلث؟','ثلاثة'],['ما الغاز الذي تحتاجه النباتات للبناء الضوئي؟','ثاني أكسيد الكربون'],['ما أسرع حيوان بري؟','الفهد'],['كم دقيقة في الساعة؟','60'],['ما أقرب نجم إلى الأرض؟','الشمس']],
 science:[['ما الرمز الكيميائي للماء؟','H₂O'],['ما مركز الذرة؟','النواة'],['ما وحدة قياس القوة؟','نيوتن'],['ما الكوكب الأحمر؟','المريخ']],
 biology:[['ما العضو الذي يضخ الدم؟','القلب'],['ما المادة الوراثية الأساسية؟','DNA'],['ما الخلايا التي تنقل الأكسجين؟','كريات الدم الحمراء']],
 chemistry:[['ما الرمز الكيميائي للأكسجين؟','O'],['ما الرقم الهيدروجيني المتعادل تقريبًا؟','7']],
 geography:[['ما أكبر محيط؟','المحيط الهادئ'],['ما عاصمة السعودية؟','الرياض'],['ما القارة الأكبر مساحة؟','آسيا']],
 history:[['في أي عام انتهت الحرب العالمية الثانية؟','1945'],['ما الحضارة التي بنت الأهرامات الكبرى؟','الحضارة المصرية القديمة']],
 animals:[['ما أكبر حيوان معروف؟','الحوت الأزرق'],['كم رجلًا للعنكبوت؟','ثمانية']],
 math:[['ما ناتج 9 × 7؟','63'],['ما الجذر التربيعي لـ 81؟','9'],['ما نصف 250؟','125']],
 technology:[['ما اختصار وحدة المعالجة المركزية؟','CPU'],['ما معنى HTTP؟','بروتوكول نقل النص التشعبي']],
 space:[['ما اسم مجرتنا؟','درب التبانة'],['ما الكوكب المعروف بحلقاته الواضحة؟','زحل']],
 capitals:[['ما عاصمة فرنسا؟','باريس'],['ما عاصمة مصر؟','القاهرة'],['ما عاصمة الإمارات؟','أبوظبي']],
 flags:[['أي دولة علمها ورقة القيقب؟','كندا'],['أي دولة علمها دائرة حمراء على خلفية بيضاء؟','اليابان']],
 sports:[['كم لاعبًا يبدأ في فريق كرة القدم داخل الملعب؟','11'],['كم نقطة للرميّة الحرة في كرة السلة؟','نقطة واحدة']],
 music:[['كم وترًا في الغيتار القياسي غالبًا؟','ستة']],
 movies:[['ما الاسم الشائع لفئة الأفلام المضحكة؟','كوميديا']],
 language:[['ما جمع كلمة كتاب؟','كتب']],
 gaming:[['ما معنى NPC في الألعاب؟','شخصية غير قابلة للعب']],
 nature:[['ما العملية التي تصنع بها النباتات غذاءها؟','البناء الضوئي']],
 ocean:[['ما اسم أكبر محيط في العالم؟','الهادئ']],
 weather:[['ما الأداة المستخدمة لقياس درجة الحرارة؟','مقياس الحرارة']],
 psychology:[['ما اسم الذاكرة قصيرة المدى المستخدمة لمعالجة المعلومات؟','الذاكرة العاملة']],
 economics:[['ما المقصود بالتضخم؟','ارتفاع عام ومستمر في الأسعار']],
 architecture:[['ما اسم الرسم التخطيطي للمبنى؟','مخطط معماري']],
 transport:[['ما وسيلة النقل التي تسير على قضبان؟','القطار']],
 culture:[['ما المقصود بالتراث الثقافي؟','المعارف والعادات والفنون الموروثة']]
};
function runText(op,args){
 const value=args.join(' ');
 if(!value&& !['slug','quoteoftheday'].includes(op))return 'اكتب النص بعد الأمر.';
 const s=value;
 const actions={
 reverse:()=>[...s].reverse().join(''),upper:()=>s.toLocaleUpperCase('ar'),lower:()=>s.toLocaleLowerCase('ar'),
 title:()=>s.replace(/(^|\s)\S/g,x=>x.toLocaleUpperCase()),words:()=>String(s.trim().split(/\s+/).filter(Boolean).length),
 chars:()=>String([...s].length),lines:()=>String(s.split(/\r?\n/).length),trim:()=>s.trim(),clean:()=>s.replace(/\s+/g,' ').trim(),
 sort:()=>s.split(/\s+/).filter(Boolean).sort((a,b)=>a.localeCompare(b,'ar')).join(' '),shuffle:()=>[...s].sort(()=>Math.random()-.5).join(''),
 unique:()=>[...new Set([...s])].join(''),remove_spaces:()=>s.replace(/\s/g,''),remove_punctuation:()=>s.replace(/[.,!?;:،؛؟"'()[\]{}]/g,''),
 emoji:()=>[...s].filter(c=>/\p{Extended_Pictographic}/u.test(c)).join('')||'لا توجد إيموجيات',codepoints:()=>[...s].map(c=>c.codePointAt(0).toString(16)).join(' '),
 bytes:()=>String(Buffer.byteLength(s,'utf8')),base64:()=>Buffer.from(s,'utf8').toString('base64'),hex:()=>Buffer.from(s,'utf8').toString('hex'),
 binary:()=>[...Buffer.from(s,'utf8')].map(n=>n.toString(2).padStart(8,'0')).join(' '),rot13:()=>s.replace(/[a-z]/gi,c=>String.fromCharCode(c.charCodeAt(0)+(c.toLowerCase()<'n'?13:-13))),
 slug:()=>s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,''),
 palindrome:()=>[...s.toLowerCase().replace(/[\W_]/g,'')].join('')===[...s.toLowerCase().replace(/[\W_]/g,'')].reverse().join('')?'نعم، النص متناظر':'لا، النص غير متناظر',
 vowels:()=>String((s.match(/[aeiou]/gi)||[]).length),consonants:()=>String((s.match(/[bcdfghjklmnpqrstvwxyz]/gi)||[]).length),
 digits:()=>String((s.match(/\d/g)||[]).length),hashtags:()=>s.match(/#[\p{L}\p{N}_]+/gu)?.join(' ')||'لا توجد وسوم',
 mentions:()=>s.match(/<@!?\d{17,20}>/g)?.join(' ')||'لا توجد منشنات',links:()=>s.match(/https?:\/\/\S+/g)?.join('\n')||'لا توجد روابط',
 markdown:()=>'> '+s.replace(/\n/g,'\n> '),quote:()=>'"'+s.replace(/"/g,'\\"')+'"',unquote:()=>s.replace(/^["'“”]+|["'“”]+$/g,''),
 json:()=>{try{return JSON.stringify(JSON.parse(s),null,2)}catch{return 'النص ليس JSON صالحًا.'}},prettyjson:()=>{try{return JSON.stringify(JSON.parse(s),null,2)}catch{return 'النص ليس JSON صالحًا.'}},
 compactjson:()=>{try{return JSON.stringify(JSON.parse(s))}catch{return 'النص ليس JSON صالحًا.'}},csv:()=>s.split(/\s+/).filter(Boolean).map(x=>'"'+x.replace(/"/g,'""')+'"').join(','),
 wordsort:()=>s.split(/\s+/).filter(Boolean).sort((a,b)=>a.localeCompare(b,'ar')).join('\n'),alphabetize:()=>[...s].sort((a,b)=>a.localeCompare(b,'ar')).join(''),
 initials:()=>s.trim().split(/\s+/).filter(Boolean).map(x=>x[0]).join(''),acronym:()=>s.trim().split(/\s+/).filter(Boolean).map(x=>x[0]).join('').toUpperCase(),
 repeat:()=>Array(Math.max(1,Math.min(10,Number(args[1])||2))).fill(s).join(' '),wrap:()=>s.match(/.{1,40}/g)?.join('\n')||'',censor:()=>s.replace(/[aeiou]/gi,'*')
 };
 if(op==='decodebase64'){try{return Buffer.from(s,'base64').toString('utf8')}catch{return 'تعذر فك Base64.'}}
 if(op==='decodehex'){try{return Buffer.from(s.replace(/\s/g,''),'hex').toString('utf8')}catch{return 'تعذر فك Hex.'}}
 if(op==='decodebinary'){try{return s.trim().split(/\s+/).map(x=>String.fromCharCode(parseInt(x,2))).join('')}catch{return 'تعذر فك Binary.'}}
 if(op==='unquote')return actions.unquote();
 return safeText((actions[op]||(()=> 'هذا أمر نصوص؛ اكتب النص بعد الأمر.'))());
}
function runMath(op,args){
 const a=numArgs(args);const x=a[0],y=a[1];
 if(!a.length)return 'اكتب أرقامًا بعد الأمر.';
 const calc={
 add:()=>x+y,subtract:()=>x-y,multiply:()=>x*y,divide:()=>y===0?'لا يمكن القسمة على صفر.':x/y,average:()=>a.reduce((s,n)=>s+n,0)/a.length,
 median:()=>{const b=[...a].sort((m,n)=>m-n);return b[Math.floor((b.length-1)/2)]},min:()=>Math.min(...a),max:()=>Math.max(...a),sum:()=>a.reduce((s,n)=>s+n,0),product:()=>a.reduce((s,n)=>s*n,1),
 square:()=>x*x,cube:()=>x*x*x,sqrt:()=>x<0?'لا يمكن حساب الجذر الحقيقي لعدد سالب.':Math.sqrt(x),power:()=>Math.pow(x,y??2),percent:()=>x/100*(y??100),percentage:()=>y?x/y*100:'المقام لا يمكن أن يكون صفرًا.',ratio:()=>y?x/y:'المقام لا يمكن أن يكون صفرًا.',
 round:()=>Math.round(x),ceil:()=>Math.ceil(x),floor:()=>Math.floor(x),abs:()=>Math.abs(x),factorial:()=>{if(x<0||x>170||!Number.isInteger(x))return 'أدخل عددًا صحيحًا بين 0 و170.';let n=1;for(let i=2;i<=x;i++)n*=i;return n;},
 modulo:()=>y?x%y:'المقسوم عليه لا يمكن أن يكون صفرًا.',gcd:()=>{let p=Math.abs(x),q=Math.abs(y);while(q)[p,q]=[q,p%q];return p},lcm:()=>{let p=Math.abs(x),q=Math.abs(y),m=p,n=q;while(n)[m,n]=[n,m%n];return p&&q?p/m*q:0},
 prime:()=>{if(!Number.isInteger(x)||x<2)return false;for(let i=2;i<=Math.sqrt(x);i++)if(x%i===0)return false;return true},isprime:()=>{if(!Number.isInteger(x)||x<2)return 'ليس عددًا أوليًا';for(let i=2;i<=Math.sqrt(x);i++)if(x%i===0)return 'ليس عددًا أوليًا';return 'عدد أولي'},
 even:()=>x%2===0?'زوجي':'فردي',odd:()=>x%2!==0?'فردي':'زوجي',fibonacci:()=>{const n=Math.max(0,Math.min(100,Math.floor(x)));let p=0,q=1,out=[];for(let i=0;i<n;i++){out.push(p);[p,q]=[q,p+q]}return out.join(', ')},
 triangle:()=>x*(x+1)/2,area_circle:()=>Math.PI*x*x,circumference:()=>2*Math.PI*x,circle_area:()=>Math.PI*x*x,rectangle_area:()=>x*y,triangle_area:()=>x*y/2,rectangle_perimeter:()=>2*(x+y),hypotenuse:()=>Math.hypot(x,y),distance:()=>Math.hypot(x,y),
 mean:()=>a.reduce((s,n)=>s+n,0)/a.length,variance:()=>{const m=a.reduce((s,n)=>s+n,0)/a.length;return a.reduce((s,n)=>s+(n-m)**2,0)/a.length},standarddev:()=>{const m=a.reduce((s,n)=>s+n,0)/a.length;return Math.sqrt(a.reduce((s,n)=>s+(n-m)**2,0)/a.length)},
 convert_celsius:()=>x+'°C = '+(x*9/5+32).toFixed(2)+'°F',convert_fahrenheit:()=>x+'°F = '+((x-32)*5/9).toFixed(2)+'°C',convert_km_miles:()=>x+' كم = '+(x*0.621371).toFixed(3)+' ميل',convert_miles_km:()=>x+' ميل = '+(x/0.621371).toFixed(3)+' كم',
 convert_kg_lb:()=>x+' كجم = '+(x*2.20462).toFixed(3)+' رطل',convert_lb_kg:()=>x+' رطل = '+(x/2.20462).toFixed(3)+' كجم',convert_cm_in:()=>x+' سم = '+(x/2.54).toFixed(3)+' بوصة',convert_in_cm:()=>x+' بوصة = '+(x*2.54).toFixed(3)+' سم'
 };
 const value=(calc[op]||(()=> 'عملية رياضية غير معروفة.'))();
 return typeof value==='number'&&Number.isFinite(value)?new Intl.NumberFormat('en-US',{maximumFractionDigits:8}).format(value):String(value);
}
function runRandom(op,args,message){
 const pick=a=>a[Math.floor(Math.random()*a.length)];
 if(['number','randomnumber'].includes(op)){const min=Number(args[0]??1),max=Number(args[1]??100);if(!Number.isFinite(min)||!Number.isFinite(max)||min>max||max-min>1e9)return 'استخدم رقمين بترتيب صحيح.';return '🎲 '+(Math.floor(Math.random()*(max-min+1))+min)}
 if(['dice','d4','d6','d8','d10','d12','d20','d100'].includes(op)){const sides=op==='dice'?6:Number(op.slice(1));return '🎲 نتيجتك: '+(1+Math.floor(Math.random()*sides))}
 if(op==='coin')return pick(['🪙 صورة','🪙 كتابة']);
 if(['choice','choose','pick','winner'].includes(op)){const options=args.join(' ').split('|').map(x=>x.trim()).filter(Boolean);return options.length? 'الاختيار: **'+pick(options)+'**':'اكتب خيارات وافصل بينها بعلامة |'}
 if(op==='shuffle')return args.join(' ').split(/\s+/).sort(()=>Math.random()-.5).join(' ')||'اكتب عناصر للفّها عشوائيًا.';
 if(op==='yesno')return pick(['نعم','لا','ممكن','جرّب مرة ثانية']);
 if(op==='truth')return pick(['ما الشيء الذي تتمنى تغييره في نفسك؟','ما أجمل ذكرى عندك؟','ما هدفك هذا الشهر؟']);
 if(op==='dare')return pick(['قل مجاملة صادقة لشخص في الروم.','اكتب شيئًا تعلمته مؤخرًا.','أرسل إيموجي يعبّر عن يومك.']);
 if(op==='wouldyourather')return pick(['تعيش قرب البحر أم الجبال؟','تسافر للماضي أم المستقبل؟','تقرأ الأفكار أم تتكلم كل اللغات؟']);
 if(op==='password')return [...Array(16)].map(()=> 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*'[Math.floor(Math.random()*67)]).join('');
 if(op==='color'||op==='hexcolor')return '#'+Math.floor(Math.random()*16777215).toString(16).padStart(6,'0');
 if(op==='randommember'){const m=message.guild.members.cache.filter(x=>!x.user.bot);return pick([...m.values()])?.toString()||'لا يوجد أعضاء في الكاش.'}
 if(op==='randomrole')return pick([...message.guild.roles.cache.filter(x=>x.id!==message.guild.id).values()])?.toString()||'لا توجد رتب.';
 if(op==='randomchannel')return pick([...message.guild.channels.cache.filter(x=>x.isTextBased()).values()])?.toString()||'لا توجد قنوات نصية.';
 const animals=['أسد','فيل','ثعلب','حصان','دلفين','صقر','قط','ذئب'],foods=['كبسة','بيتزا','سوشي','برغر','مندي','باستا'],countries=['السعودية','اليابان','كندا','مصر','إيطاليا','البرازيل'],words=['ملاذ','مجرة','مطر','قمر','نخلة','بحر','نجمة'];
 if(op==='randomanimal')return pick(animals);if(op==='randomfood')return pick(foods);if(op==='randomcountry')return pick(countries);if(op==='randomcapital')return pick(['الرياض','طوكيو','القاهرة','باريس','أبوظبي']);if(op==='randomword')return pick(words);if(op==='randomletter')return pick([... 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي']);if(op==='randomemoji')return pick(['🌸','✨','🎮','🛡️','🎲','🦋','🌙']);
 if(op==='team'||op==='splitteams'||op==='teams'||op==='pair')return args.length?args.sort(()=>Math.random()-.5).join(' | '):'اكتب أسماء الأعضاء وافصل بينها بمسافات.';
 if(op==='lottery'||op==='bingo'||op==='roulette')return '🎯 رقم الجولة العشوائي: '+(1+Math.floor(Math.random()*36));
 if(op==='rockpaperscissors')return pick(['حجر','ورقة','مقص']);
 if(op==='nickname')return pick(['النجم','الأسطورة','الهادئ','الذيب','المبدع','القائد']);
 if(op==='compliment')return pick(['وجودك يضيف للروم طاقة حلوة ✨','ذوقك جميل وملاحظتك للتفاصيل رهيبة 🌸','شخصيتك لها بصمة واضحة 💗']);
 if(op==='roast')return pick(['حتى الـ Wi-Fi يستحي من بطء ردك 😂','أنت نسخة تجريبية من الأسطورة 😭']);
 return '🎲 نتيجة عشوائية: '+pick(['نجاح','حظ جيد','محاولة ثانية','مفاجأة']);
}
function runServer(op,guild,client){
 const channels=guild.channels.cache,roles=guild.roles.cache,members=guild.members.cache;
 const map={info:()=>guild.name,members:()=>guild.memberCount,humans:()=>members.filter(x=>!x.user.bot).size,bots:()=>members.filter(x=>x.user.bot).size,channels:()=>channels.size,textchannels:()=>channels.filter(x=>x.isTextBased()).size,voicechannels:()=>channels.filter(x=>x.isVoiceBased()).size,categories:()=>channels.filter(x=>x.type===4).size,roles:()=>roles.size-1,emojis:()=>guild.emojis.cache.size,stickers:()=>guild.stickers.cache.size,boosts:()=>guild.premiumSubscriptionCount||0,boostlevel:()=>guild.premiumTier,owner:()=>'<@'+guild.ownerId+'>',created:()=>'<t:'+Math.floor(guild.createdTimestamp/1000)+':F>',age:()=>Math.floor((Date.now()-guild.createdTimestamp)/86400000)+' يوم',icon:()=>guild.iconURL({size:1024})||'لا توجد أيقونة',banner:()=>guild.bannerURL({size:1024})||'لا يوجد بنر',verification:()=>String(guild.verificationLevel),features:()=>guild.features.join(', ')||'لا توجد',rules:()=>guild.rulesChannel?.toString()||'غير محدد',systemchannel:()=>guild.systemChannel?.toString()||'غير محدد',afkchannel:()=>guild.afkChannel?.toString()||'غير محدد',afktimeout:()=>guild.afkTimeout+' ثانية',admins:()=>members.filter(x=>x.permissions.has(PermissionFlagsBits.Administrator)).size,moderators:()=>members.filter(x=>x.permissions.has(PermissionFlagsBits.ModerateMembers)).size,online:()=>members.filter(x=>x.presence?.status&&x.presence.status!=='offline').size,offline:()=>members.filter(x=>x.presence?.status==='offline').size,newbies:()=>members.filter(x=>Date.now()-x.joinedTimestamp<7*86400000).size,oldest:()=>{const x=members.filter(m=>m.joinedTimestamp).sort((a,b)=>a.joinedTimestamp-b.joinedTimestamp).first();return x?.toString()||'غير متوفر'},newest:()=>{const x=members.filter(m=>m.joinedTimestamp).sort((a,b)=>b.joinedTimestamp-a.joinedTimestamp).first();return x?.toString()||'غير متوفر'},rolecount:()=>roles.size-1,channelcount:()=>channels.size,emoji_count:()=>guild.emojis.cache.size,botcount:()=>members.filter(x=>x.user.bot).size,membercount:()=>guild.memberCount,boosters:()=>guild.members.cache.filter(x=>x.premiumSince).size,vanity:()=>guild.vanityURLCode||'لا يوجد رابط مخصص',prefix:()=>String(client.mldConfig?.prefix||'!'),config:()=>JSON.stringify({type:client.mldType,prefix:client.mldConfig?.prefix||'!',protection:client.mldConfig?.automodEnabled!==false},null,2),activity:()=>client.user?.presence?.activities?.map(x=>x.name).join(', ')||'لا يوجد نشاط',stats:()=> 'أعضاء: '+guild.memberCount+' · قنوات: '+channels.size+' · رتب: '+(roles.size-1),growth:()=> 'انضمام أحدث عضو: '+(members.filter(m=>m.joinedTimestamp).sort((a,b)=>b.joinedTimestamp-a.joinedTimestamp).first()?.joinedAt?.toLocaleDateString('ar-SA')||'غير متوفر')};
 return String((map[op]||map.info)());
}
function runMember(op,message){
 const member=message.mentions.members.first()||message.guild.members.cache.get(String(message.content.match(/\b\d{17,20}\b/)?.[0]||''))||message.member;
 const user=member.user;
 const map={info:()=>user.tag,id:()=>user.id,avatar:()=>user.displayAvatarURL({size:1024}),banner:()=> 'يمكن عرض بنر العضو إذا كان متاحًا عبر API المستخدم.',nickname:()=>member.nickname||user.username,username:()=>user.username,joined:()=>member.joinedTimestamp?'<t:'+Math.floor(member.joinedTimestamp/1000)+':F>':'غير متوفر',created:()=>'<t:'+Math.floor(user.createdTimestamp/1000)+':F>',age:()=>Math.floor((Date.now()-user.createdTimestamp)/86400000)+' يوم',roles:()=>member.roles.cache.filter(r=>r.id!==message.guild.id).map(r=>r.toString()).join(', ')||'لا توجد رتب',top_role:()=>member.roles.highest.toString(),permissions:()=>member.permissions.toArray().join(', ')||'لا توجد',status:()=>member.presence?.status||'غير معروف',activity:()=>member.presence?.activities?.map(a=>a.name).join(', ')||'لا يوجد نشاط',activities:()=>member.presence?.activities?.map(a=>a.name+' ('+a.type+')').join('\n')||'لا يوجد نشاط',bots:()=>String(user.bot),ishuman:()=>String(!user.bot),isowner:()=>String(message.guild.ownerId===user.id),isadmin:()=>String(member.permissions.has(PermissionFlagsBits.Administrator)),ismoderator:()=>String(member.permissions.has(PermissionFlagsBits.ModerateMembers)),isboosting:()=>String(!!member.premiumSince),boosts:()=>member.premiumSince?'<t:'+Math.floor(member.premiumSinceTimestamp/1000)+':R>':'لا يعزز السيرفر',mention:()=>member.toString(),profile:()=>user.displayAvatarURL({size:512}),badges:()=>user.flags?.toArray().join(', ')||'لا توجد شارات ظاهرة',voicepresence:()=>member.voice.channel?.toString()||'ليس في قناة صوتية',presence:()=>member.presence?.status||'غير معروف',color:()=>member.displayHexColor,highestrole:()=>member.roles.highest.toString(),accountage:()=>Math.floor((Date.now()-user.createdTimestamp)/86400000)+' يوم',serverage:()=>member.joinedTimestamp?Math.floor((Date.now()-member.joinedTimestamp)/86400000)+' يوم':'غير متوفر',sharedroles:()=>member.roles.cache.filter(r=>message.member.roles.cache.has(r.id)&&r.id!==message.guild.id).map(r=>r.name).join(', ')||'لا توجد رتب مشتركة',sharedpermissions:()=>member.permissions.toArray().filter(p=>message.member.permissions.has(p)).join(', ')||'لا توجد صلاحيات مشتركة',memberflags:()=>member.user.flags?.toArray().join(', ')||'لا توجد',displayname:()=>member.displayName,joinposition:()=>String(message.guild.members.cache.filter(m=>m.joinedTimestamp&&m.joinedTimestamp<=member.joinedTimestamp).size),roleslist:()=>member.roles.cache.map(r=>r.name).join(', '),rolescompare:()=>member.roles.cache.filter(r=>message.member.roles.cache.has(r.id)&&r.id!==message.guild.id).map(r=>r.name).join(', ')||'لا توجد',compare:()=> 'الرتب: '+member.roles.cache.size+' · الصلاحيات: '+member.permissions.toArray().length,activitysummary:()=>member.presence?.activities?.map(a=>a.name).join('، ')||'لا يوجد نشاط'};
 return String((map[op]||map.info)());
}
async function runModeration(op,message,args,client,config,prefix,writeRuntimeLog){
 const guild=message.guild,member=message.mentions.members.first(),role=message.mentions.roles.first(),channel=message.mentions.channels.first()||message.channel;
 const rest=args.filter(x=>!/^<@!?\d{17,20}>$/.test(x)&&!/^<@&\d{17,20}>$/.test(x)&&!/^<#\d{17,20}>$/.test(x));
 const reason=rest.join(' ').slice(0,400)||'بدون سبب محدد';
 const me=guild.members.me;
 const hierarchy=target=>target&&target.id!==guild.ownerId&&target.roles.highest.position<message.member.roles.highest.position&&target.roles.highest.position<me.roles.highest.position;
 const log=async(action,details={})=>{await writeRuntimeLog(client.mldBotId,message.author.id,'bot.catalog_'+action,{guildId:guild.id,channelId:message.channel.id,...details}).catch(()=>{});};
 if(['warn','kick','ban','timeout','untimeout','nick','roleadd','roleremove','mute','unmute','deafen','undeafen','disconnect','move','softban'].includes(op)&&!member&&['warn','kick','ban','timeout','untimeout','nick','roleadd','roleremove','mute','unmute','deafen','undeafen','disconnect','move','softban'].includes(op))return message.reply('حدد العضو باستخدام المنشن.');
 if(['warn','kick','ban','timeout','untimeout','nick','roleadd','roleremove','mute','unmute','deafen','undeafen','disconnect','move','softban'].includes(op)&&member&&!hierarchy(member))return message.reply('لا يمكن تنفيذ الأمر على مالك السيرفر أو عضو رتبته مساوية/أعلى من رتبتك أو رتبة البوت.');
 if(op==='warn'){await log(op,{targetId:member.id,reason});return message.reply('⚠️ تم تسجيل تنبيه إداري على '+member.toString()+'؛ السبب: '+reason);}
 if(op==='kick'){await member.kick(reason);await log(op,{targetId:member.id,reason});return message.reply('تم طرد '+member.user.tag+'.');}
 if(op==='ban'||op==='softban'){await guild.members.ban(member.id,{reason,deleteMessageSeconds:op==='softban'?86400:0});if(op==='softban')await guild.members.unban(member.id,'Softban completed');await log(op,{targetId:member.id,reason});return message.reply(op==='softban'?'تم تنفيذ الحظر المؤقت لإزالة الرسائل ثم فك الحظر.':'تم حظر '+member.user.tag+'.');}
 if(op==='unban'){const id=String(args.find(x=>/^\d{17,20}$/.test(x))||'');if(!id)return message.reply('استخدم: '+prefix+'mod_unban معرّف_العضو');await guild.members.unban(id,reason);await log(op,{targetId:id,reason});return message.reply('تم فك الحظر عن المعرّف '+id+'.');}
 if(op==='timeout'||op==='untimeout'){if(op==='timeout'){const mins=Number(args.find(x=>/^\d+$/.test(x))||10);if(!Number.isFinite(mins)||mins<1||mins>40320)return message.reply('مدة المهلة من 1 إلى 40320 دقيقة.');await member.timeout(mins*60000,reason)}else await member.timeout(null,reason);await log(op,{targetId:member.id,reason});return message.reply(op==='timeout'?'تم تقييد العضو لمدة محددة.':'تم إلغاء تقييد العضو.');}
 if(op==='clear'||op==='purge'){const n=Number(args.find(x=>/^\d+$/.test(x))||10);if(!Number.isInteger(n)||n<1||n>100)return message.reply('حدد عددًا بين 1 و100.');const deleted=await message.channel.bulkDelete(n,true);await log(op,{count:deleted.size});return message.channel.send('🧹 تم حذف '+deleted.size+' رسالة.').then(m=>setTimeout(()=>m.delete().catch(()=>{}),4000));}
 if(op==='slowmode'){const n=Number(args.find(x=>/^\d+$/.test(x))||5);if(!Number.isInteger(n)||n<0||n>21600)return message.reply('استخدم قيمة بين 0 و21600 ثانية.');await channel.setRateLimitPerUser(n,reason);return message.reply('تم ضبط بطء القناة على '+n+' ثانية.');}
 if(op==='lock'||op==='unlock'||op==='hide'||op==='show'){const values={SendMessages:op==='lock'?false:op==='unlock'?null:undefined,ViewChannel:op==='hide'?false:op==='show'?null:undefined};const edit={};for(const [k,v] of Object.entries(values))if(v!==undefined)edit[k]=v;await channel.permissionOverwrites.edit(guild.roles.everyone.id,edit,reason);await log(op,{targetChannelId:channel.id});return message.reply('تم تحديث صلاحيات '+channel.toString()+'.');}
 if(op==='renamechannel'||op==='channelrename'){const name=rest.join(' ').replace(/^<#[0-9]{17,20}>\s*/,'').replace(/[\\/]/g,'-').slice(0,90);if(!name)return message.reply('اكتب اسم القناة الجديد.');await channel.setName(name,reason);return message.reply('تم تغيير اسم القناة إلى '+name+'.');}
 if(op==='settopic'){const topic=rest.join(' ').slice(0,1024);if(!topic)return message.reply('اكتب وصف القناة الجديد.');await channel.setTopic(topic,reason);return message.reply('تم تحديث وصف القناة.');}
 if(op==='nick'){const name=rest.join(' ').slice(0,32);if(!name)return message.reply('اكتب اللقب الجديد.');await member.setNickname(name,reason);return message.reply('تم تغيير لقب العضو.');}
 if(op==='roleadd'||op==='roleremove'){if(!role)return message.reply('حدد الرتبة بمنشن الرتبة.');if(role.position>=me.roles.highest.position)return message.reply('رتبة البوت يجب أن تكون أعلى من الرتبة المحددة.');if(op==='roleadd')await member.roles.add(role,reason);else await member.roles.remove(role,reason);return message.reply('تم تحديث رتب العضو.');}
 if(op==='rolecreate'){const name=rest.join(' ').replace(/#[0-9a-f]{6}/i,'').trim().slice(0,90);const color=rest.find(x=>/^#[0-9a-f]{6}$/i.test(x));if(!name)return message.reply('استخدم: '+prefix+'mod_rolecreate اسم_الرتبة #ff9cde');const created=await guild.roles.create({name,color:color||'#ff9cde',reason});return message.reply('تم إنشاء الرتبة '+created.toString()+'.');}
 if(op==='roledelete'){if(!role)return message.reply('حدد الرتبة المراد حذفها.');if(role.position>=me.roles.highest.position)return message.reply('رتبة البوت يجب أن تكون أعلى من الرتبة.');await role.delete(reason);return message.reply('تم حذف الرتبة.');}
 if(op==='rolecolor'||op==='rolehoist'||op==='rolementionable'){if(!role)return message.reply('حدد الرتبة أولًا.');const color=rest.find(x=>/^#[0-9a-f]{6}$/i.test(x));if(op==='rolecolor'){if(!color)return message.reply('أضف لونًا مثل #ff9cde.');await role.setColor(color,reason)}else if(op==='rolehoist')await role.setHoist(!role.hoist,reason);else await role.setMentionable(!role.mentionable,reason);return message.reply('تم تحديث إعدادات الرتبة.');}
 if(op==='move'||op==='moveme'){const target=op==='moveme'?message.member:member;const targetChannel=message.mentions.channels.first()||guild.channels.cache.get(rest.find(x=>/^\d{17,20}$/.test(x))||'');if(!targetChannel?.isVoiceBased())return message.reply('حدد قناة صوتية صحيحة.');await target.voice.setChannel(targetChannel,reason);return message.reply('تم نقل العضو إلى '+targetChannel.toString()+'.');}
 if(['mute','unmute','deafen','undeafen','disconnect'].includes(op)){if(!member.voice.channel)return message.reply('العضو ليس في قناة صوتية.');if(op==='disconnect')await member.voice.disconnect(reason);else if(op==='mute'||op==='unmute')await member.voice.setMute(op==='mute',reason);else await member.voice.setDeaf(op==='deafen',reason);return message.reply('تم تنفيذ أمر الصوت بنجاح.');}
 if(op==='allbans'){const bans=await guild.bans.fetch();return message.reply({content:'**قائمة المحظورين ('+bans.size+')**\n'+bans.map(x=>x.user.tag+' · '+x.user.id).slice(0,25).join('\n')||'لا توجد حالات حظر.',allowedMentions:{parse:[]}});}
 if(op==='cleanbots'){const messages=await message.channel.messages.fetch({limit:100});const deleted=await message.channel.bulkDelete(messages.filter(m=>m.author.bot),true);return message.reply('تم حذف '+deleted.size+' رسالة من البوتات.');}
 if(op==='cleanwebhooks'){const hooks=await channel.fetchWebhooks();let n=0;for(const hook of hooks.values()){await hook.delete(reason);n++}return message.reply('تم حذف '+n+' Webhook من القناة.');}
 if(op==='cleaninvites'){const invites=await guild.invites.fetch();let n=0;for(const invite of invites.values()){await invite.delete(reason).catch(()=>{});n++}return message.reply('تمت محاولة حذف '+n+' دعوة.');}
 if(op==='lockdown'||op==='unlockdown'){let changed=0;for(const ch of guild.channels.cache.filter(c=>c.isTextBased()&&c.permissionOverwrites).values()){await ch.permissionOverwrites.edit(guild.roles.everyone.id,{SendMessages:op==='lockdown'?false:null},reason).then(()=>changed++).catch(()=>{})}await log(op,{changed});return message.reply((op==='lockdown'?'تم تفعيل الإغلاق العام. ':'تم إلغاء الإغلاق العام. ')+'القنوات التي تم تحديثها: '+changed+'.');}
 if(op==='massrole'){const confirmed=String(args[0]||'').toLowerCase()==='confirm',action=String(args[1]||'').toLowerCase();if(!confirmed||!['add','remove'].includes(action))return message.reply('لتجنب الخطأ: استخدم '+prefix+'mod_massrole confirm add @رتبة أو confirm remove @رتبة.');if(!role)return message.reply('حدد الرتبة.');const targets=guild.members.cache.filter(m=>!m.user.bot&&m.id!==guild.ownerId);let n=0;for(const m of targets.values()){if(m.roles.highest.position>=me.roles.highest.position)continue;await m.roles[action==='add'?'add':'remove'](role,reason).then(()=>n++).catch(()=>{})}return message.reply('تم تحديث الرتبة لـ '+n+' عضوًا.');}
 if(op==='channelclone'){const clone=await channel.clone({reason});return message.reply('تم استنساخ القناة: '+clone.toString());}
 if(op==='channelcreate'){const name=rest.join('-').replace(/[^\p{L}\p{N}_-]/gu,'').slice(0,90);if(!name)return message.reply('اكتب اسم القناة.');const created=await guild.channels.create({name,type:0,reason});return message.reply('تم إنشاء القناة '+created.toString()+'.');}
 if(op==='channeldelete'){await channel.delete(reason);return message.reply('تم حذف القناة.');}
 if(op==='categorycreate'){const name=rest.join(' ').slice(0,90);if(!name)return message.reply('اكتب اسم الفئة.');const created=await guild.channels.create({name,type:4,reason});return message.reply('تم إنشاء الفئة '+created.toString()+'.');}
 return message.reply('أمر إشراف غير مدعوم حاليًا.');
}

export async function runCatalogCommand({entry,message,args,client,config,prefix,pool,writeRuntimeLog}){
 const {kind,operation:op,name}=entry;
 try{
  if(kind==='mod')return runModeration(op,message,args,client,config,prefix,writeRuntimeLog);
  if(kind==='text')return message.reply({content:runText(op,args),allowedMentions:escapeMentions});
  if(kind==='math')return message.reply({content:runMath(op,args),allowedMentions:escapeMentions});
  if(kind==='random')return message.reply({content:runRandom(op,args,message),allowedMentions:escapeMentions});
  if(kind==='server')return message.reply({content:'📊 **'+entry.label+'**\n'+runServer(op,message.guild,client),allowedMentions:escapeMentions});
  if(kind==='member')return message.reply({content:'👤 **'+entry.label+'**\n'+runMember(op,message),allowedMentions:escapeMentions});
  if(kind==='quiz'||kind==='game'){
   const bank=facts[op]||facts[Object.keys(facts).find(k=>op.includes(k))]||facts.general;
   const [question,answer]=choose(bank);
   return message.reply({content:(kind==='game'?'🎮 تحدي':'🧠 سؤال')+' **'+entry.label+'**\n'+question+'\n||الإجابة: '+answer+'||',allowedMentions:escapeMentions});
  }
  if(kind==='security'){
   const settings={antilink:'antiLinksEnabled',antispam:'antiSpamEnabled',protection:'automodEnabled',wordfilter:'blockedWordsEnabled',invitespam:'antiInviteEnabled',capsfilter:'capsFilterEnabled',mentionfilter:'mentionFilterEnabled',raidmode:'raidModeEnabled',antiinvite:'antiLinksEnabled',antiscam:'antiScamEnabled',antiphishing:'antiScamEnabled',antibot:'antiBotEnabled',verification:'verificationEnabled',captcha:'verificationEnabled',welcome:'welcomeEnabled',leave:'leaveEnabled',goodbye:'leaveEnabled',autorole:'autoRoleEnabled',logchannel:'modLogChannelId',modlog:'modLogChannelId',auditlog:'modLogChannelId',safeurls:'safeUrlsEnabled',whitelist:'whitelistEnabled',blacklist:'blacklistEnabled',denywords:'blockedWordsEnabled'};
   const key=settings[op];
   if(!message.member.permissions.has(PermissionFlagsBits.ManageGuild))return message.reply('تحتاج صلاحية إدارة السيرفر لتغيير إعدادات الحماية.');
   if(!key)return message.reply({content:'🛡️ '+entry.label+'\nهذا الأمر يعرض حالة إعداد الحماية. الأوامر الفعلية المفعّلة حاليًا: antilink، antispam، blockedword، protection.',allowedMentions:escapeMentions});
   const next={...config},arg=String(args[0]||'status').toLowerCase();
   if(['on','enable','تشغيل','تفعيل'].includes(arg))next[key]=true;
   else if(['off','disable','إيقاف','تعطيل'].includes(arg))next[key]=false;
   if(!pool)return message.reply('قاعدة البيانات غير متاحة لحفظ الإعدادات.');
   await pool.query('UPDATE bots SET settings=$1::jsonb WHERE id=$2',[JSON.stringify(next),String(client.mldBotId)]);
   client.mldConfig=next;
   await writeRuntimeLog(client.mldBotId,message.author.id,'bot.catalog_security_setting',{guildId:message.guild.id,setting:key,value:next[key]});
   return message.reply({content:'🛡️ '+entry.label+': **'+(next[key]===false?'معطل':next[key]===true?'مفعل':'غير محدد')+'**\nاستخدم '+prefix+name+' on/off/status.',allowedMentions:escapeMentions});
  }
  if(kind==='social'){
   const value=args.join(' ').trim();
   const canned={quoteoftheday:['لا تؤجل حلمًا تقدر تبدأه اليوم.','الاستمرار الصغير يصنع فرقًا كبيرًا.'],jokeoftheday:['مرة واحد نسي كلمة المرور، قالوا له تذكرها قال: لو أتذكرها ما نسيتها 😂'],factoftheday:['الأخطبوط لديه ثلاثة قلوب.','ضوء الشمس يستغرق نحو 8 دقائق للوصول للأرض.'],wordoftheday:['ملاذ: مكان للراحة والأمان.'],questionoftheday:['ما الشيء الذي تتمنى تتعلمه هذا الأسبوع؟'],icebreaker:['لو تقدر تسافر الآن لأي مكان، وين تروح؟'],fortune:['حظك اليوم: فرصة جديدة تنتظرك؛ استغلها.'],cookie:['🥠 تذكّر: خطوة واحدة ثابتة أفضل من انتظار الكمال.'],compliment:['وجودك يضيف للروم طاقة جميلة ✨'],hug:['🤗 حضن افتراضي دافئ'],slap:['✋ مزحة خفيفة، بدون أذى'],pat:['🫳 تربيتة لطيفة'],highfive:['🙌 هاي فايف!'],wave:['👋 هلا والله!'],thanks:['العفو، بالخدمة دائمًا 💗'],goodmorning:['☀️ صباح الخير، يومك سعيد!'],goodnight:['🌙 تصبح على خير وأحلام جميلة.']};
   if(op==='poll'||op==='vote'){
    if(!value)return message.reply('اكتب سؤال التصويت بعد الأمر.');
    const poll=await message.channel.send({content:'📊 **تصويت:** '+value,allowedMentions:escapeMentions});
    await poll.react('👍').catch(()=>{});await poll.react('👎').catch(()=>{});return message.reply('تم إنشاء التصويت: '+poll.url);
   }
   if(op==='suggest'||op==='suggestion'){
    if(!value)return message.reply('اكتب الاقتراح بعد الأمر.');
    const ch=message.guild.channels.cache.get(String(config.suggestionsChannelId||''))||message.channel;
    const embed=new EmbedBuilder().setColor(0xff9cde).setTitle('💡 اقتراح جديد').setDescription(value.slice(0,3500)).setFooter({text:'MLD · '+message.author.tag}).setTimestamp();
    const sent=await ch.send({embeds:[embed],allowedMentions:escapeMentions});await sent.react('👍').catch(()=>{});await sent.react('👎').catch(()=>{});
    return message.reply('تم إرسال الاقتراح: '+sent.url);
   }
   if(op==='announce'||op==='broadcast'||op==='say'){
    if(!message.member.permissions.has(PermissionFlagsBits.ManageMessages))return message.reply('تحتاج صلاحية إدارة الرسائل.');
    if(!value)return message.reply('اكتب نص الرسالة بعد الأمر.');
    return message.channel.send({content:value.slice(0,1800),allowedMentions:escapeMentions});
   }
   return message.reply({content:(canned[op]||['✨ MLD · '+entry.label])[0]+'\n'+(value?'من '+message.author.toString()+' · '+value.slice(0,500):''),allowedMentions:escapeMentions});
  }
  return null;
 }catch(error){console.error('Catalog command failed:',name,error?.message||error);return message.reply('تعذر تنفيذ الأمر. تحقق من المدخلات وصلاحيات البوت.').catch(()=>{});}
}
