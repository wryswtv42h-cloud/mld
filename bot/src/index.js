import 'dotenv/config';
import {createServer} from 'node:http';
import {Client,GatewayIntentBits,Events,ActivityType,Partials} from 'discord.js';
import pg from 'pg';

const token=process.env.DISCORD_TOKEN||process.env.DISCORD_BOT_TOKEN;
const guildId=process.env.DISCORD_GUILD_ID||'';
const PORT=Number(process.env.PORT||3000);
const {Pool}=pg;
const pool=process.env.DATABASE_URL?new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL.includes('localhost')?false:{rejectUnauthorized:false},max:5}):null;
const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers,GatewayIntentBits.DirectMessages],partials:[Partials.Channel]});
const health=createServer((req,res)=>{res.setHeader('content-type','application/json; charset=utf-8');if(req.url==='/health'||req.url==='/'){res.writeHead(200);res.end(JSON.stringify({ok:true,service:'mld-group-bot',discord:client.isReady()}));return}res.writeHead(404);res.end(JSON.stringify({error:'not found'}))});
health.listen(PORT,'0.0.0.0',()=>console.log('MLD Group Bot health endpoint listening on '+PORT));
const discordHeaders={'Authorization':'Bot '+token,'Content-Type':'application/json'};
async function sendDM(discordId,content){try{const d=await fetch('https://discord.com/api/v10/users/@me/channels',{method:'POST',headers:discordHeaders,body:JSON.stringify({recipient_id:String(discordId)})});if(!d.ok)return false;const channel=await d.json();const r=await fetch('https://discord.com/api/v10/channels/'+channel.id+'/messages',{method:'POST',headers:discordHeaders,body:JSON.stringify({content})});return r.ok}catch{return false}}
client.once(Events.ClientReady,async c=>{console.log('MLD Group Bot online as '+c.user.tag);c.user.setActivity('قروبات ملاذ | MLD',{type:ActivityType.Watching});});
client.on(Events.InteractionCreate,async interaction=>{
 const match=/^group-invite-(accept|reject):(\d+)$/.exec(String(interaction.customId||''));
 if(!interaction.isButton()||!match)return;
 if(!pool){await interaction.reply({content:'خدمة القروبات غير متصلة بقاعدة البيانات.',ephemeral:true}).catch(()=>{});return}
 const groupId=match[2],decision=match[1]==='accept'?'accepted':'rejected',discordId=String(interaction.user.id);
 let clientDb,group,invites,members,shouldActivate=false,declined=false;
 try{
  clientDb=await pool.connect();await clientDb.query('BEGIN');
  const found=await clientDb.query('SELECT id,name,status,owner_id,members,invitations,color FROM groups_table WHERE id=$1 FOR UPDATE',[groupId]);group=found.rows[0];
  if(!group){await clientDb.query('ROLLBACK');await interaction.reply({content:'هذا القروب لم يعد موجودًا.',ephemeral:true});return}
  invites=Array.isArray(group.invitations)?group.invitations:[];
  const invite=invites.find(item=>String(item.discordId)===discordId);
  if(!invite){await clientDb.query('ROLLBACK');await interaction.reply({content:'هذه الدعوة ليست موجهة لحسابك.',ephemeral:true});return}
  if(invite.status!=='pending'){await clientDb.query('ROLLBACK');await interaction.reply({content:'تم تسجيل ردك مسبقًا: '+invite.status,ephemeral:true});return}
  if(group.status!=='pending_invites'){await clientDb.query('ROLLBACK');await interaction.reply({content:'حالة هذا القروب لا تسمح بتسجيل رد جديد.',ephemeral:true});return}
  invite.status=decision;invite.respondedAt=new Date().toISOString();members=Array.isArray(group.members)?group.members:[];
  if(decision==='accepted'){
   const user=await clientDb.query('SELECT id,username,discord_id FROM users WHERE discord_id=$1',[discordId]);
   if(user.rows[0]&&!members.some(m=>String(m.id)===String(user.rows[0].id)))members.push({id:String(user.rows[0].id),username:user.rows[0].username,discordId,owner:false});
  }
  declined=decision==='rejected';
  const allAccepted=invites.every(item=>item.status==='accepted');
  shouldActivate=allAccepted;
  const nextStatus=declined?'rejected':shouldActivate?'activating':'pending_invites';
  await clientDb.query('UPDATE groups_table SET invitations=$1::jsonb,members=$2::jsonb,status=$3 WHERE id=$4',[JSON.stringify(invites),JSON.stringify(members),nextStatus,groupId]);
  await clientDb.query('COMMIT');
  await interaction.update({content:declined?'تم تسجيل رفضك للدعوة. لن يتم تفعيل هذا القروب.':shouldActivate?'اكتملت الموافقات، جارٍ تجهيز القروب ورتبته…':'تم تسجيل موافقتك! ينتظر القروب موافقة بقية المدعوين.',embeds:[],components:[]});
  const ownerRow=await pool.query('SELECT id,username,discord_id FROM users WHERE id=$1',[group.owner_id]);const owner=ownerRow.rows[0];
  if(declined){if(owner?.discord_id)await sendDM(owner.discord_id,'تم رفض دعوة أحد الأشخاص لقروب '+group.name+'. لن يتم تفعيل الطلب؛ أنشئ طلبًا جديدًا مع خمسة أشخاص آخرين.');return}
  if(!shouldActivate)return;
  if(!guildId)throw Error('DISCORD_GUILD_ID missing');
  const hex=/^#[0-9a-f]{6}$/i.test(group.color||'')?group.color:'#b68cff';
  const roleRes=await fetch('https://discord.com/api/v10/guilds/'+guildId+'/roles',{method:'POST',headers:discordHeaders,body:JSON.stringify({name:String(group.name).slice(0,100),color:parseInt(hex.slice(1),16),hoist:true,mentionable:false,permissions:'0'})});
  if(!roleRes.ok)throw Error('Could not create group role: '+roleRes.status);
  const role=await roleRes.json();
  if(owner&&!members.some(m=>String(m.id)===String(owner.id)))members.unshift({id:String(owner.id),username:owner.username,discordId:owner.discord_id,owner:true});
  for(const member of members){if(!member.discordId)continue;const response=await fetch('https://discord.com/api/v10/guilds/'+guildId+'/members/'+member.discordId+'/roles/'+role.id,{method:'PUT',headers:discordHeaders});if(!response.ok)console.error('Could not assign group role',member.discordId,response.status)}
  await pool.query("UPDATE groups_table SET status='active',members=$1::jsonb,discord_role_id=$2,activated_at=NOW() WHERE id=$3 AND status='activating'",[JSON.stringify(members),role.id,groupId]);
  for(const member of members){if(!member.discordId||member.discordId===discordId)continue;await sendDM(member.discordId,'اكتملت الموافقات! قروب '+group.name+' صار فعّالًا، وتم منحك رتبة القروب في Discord.')}
 }catch(error){
  console.error('Group invitation interaction failed:',error.message);
  if(clientDb)await clientDb.query('ROLLBACK').catch(()=>{});
  if(shouldActivate&&group)await pool.query("UPDATE groups_table SET status='pending_invites' WHERE id=$1 AND status='activating'",[groupId]).catch(()=>{});
  if(interaction.deferred||interaction.replied)await interaction.followUp({content:'تعذر إكمال الإجراء الآن. أبلغ راعي القروب إذا استمرت المشكلة.',ephemeral:true}).catch(()=>{});
  else await interaction.reply({content:'تعذر إكمال الإجراء الآن. أبلغ راعي القروب إذا استمرت المشكلة.',ephemeral:true}).catch(()=>{});
 }finally{clientDb?.release()}
});
if(!token)console.error('DISCORD_TOKEN is missing');else client.login(token).catch(error=>{console.error('Discord login failed:',error.message);process.exitCode=1});
