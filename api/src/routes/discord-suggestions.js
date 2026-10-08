import express from 'express';
const router=express.Router();
router.get('/',async(req,res)=>{
  try{
    const q=String(req.query.q||'').trim();
    if(q.length<2)return res.json({members:[]});
    const token=process.env.DISCORD_TOKEN||process.env.DISCORD_BOT_TOKEN;
    const guild=process.env.DISCORD_GUILD_ID;
    if(!token||!guild)return res.json({members:[]});
    const r=await fetch(`https://discord.com/api/v10/guilds/${guild}/members/search?query=${encodeURIComponent(q)}&limit=10`,{headers:{Authorization:`Bot ${token}`}});
    if(!r.ok)return res.json({members:[]});
    const a=await r.json();
    res.json({members:a.map(x=>({id:x.user?.id,username:x.user?.username,global_name:x.user?.global_name,avatar:x.user?.avatar})).filter(x=>x.username)});
  }catch{res.json({members:[]})}
});
export default router;