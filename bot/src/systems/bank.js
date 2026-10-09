import { Events } from 'discord.js';

const integer = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : fallback;
};

export async function ensureBankTable(pool) {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mld_bot_bank (
      bot_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      balance BIGINT NOT NULL DEFAULT 1000 CHECK (balance >= 0),
      loan BIGINT NOT NULL DEFAULT 0 CHECK (loan >= 0),
      investments JSONB NOT NULL DEFAULT '[]'::jsonb,
      last_daily TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (bot_id, guild_id, user_id)
    )
  `);
}

export function setupBank(client, pool) {
  if (!pool) return;
  client.on(Events.MessageCreate, async message => {
    if (!message.guild || message.author.bot || client.mldType !== 'bank') return;
    const cfg = client.mldConfig || {};
    const prefix = String(cfg.prefix || '!').slice(0, 4);
    if (!message.content.startsWith(prefix)) return;
    const [raw, ...args] = message.content.slice(prefix.length).trim().split(/\s+/);
    const cmd = String(raw || '').toLowerCase();
    const aliases = new Set(['رصيد','فلوس','يومي','تحويل','قرض','سداد','تبرع','استثمار','صندوق','تداول']);
    if (!aliases.has(cmd)) return;
    const guildId = message.guild.id, userId = message.author.id, botId = String(client.mldBotId || client.user.id);
    const start = Math.max(0, Math.min(100000000, integer(cfg.startingBalance, 1000)));
    const daily = Math.max(0, Math.min(100000000, integer(cfg.dailyReward, 100)));
    const loanRate = Math.max(0, Math.min(100, Number(cfg.loanInterest ?? 5) || 0));
    const maxLoan = Math.max(0, Math.min(100000000, integer(cfg.maxLoan, 10000)));
    const money = n => new Intl.NumberFormat('en-US').format(Number(n || 0));
    const ensure = async uid => {
      await pool.query(
        'INSERT INTO mld_bot_bank(bot_id,guild_id,user_id,balance) VALUES($1,$2,$3,$4) ON CONFLICT(bot_id,guild_id,user_id) DO NOTHING',
        [botId, guildId, uid, start]
      );
      const r = await pool.query('SELECT balance,loan,investments,last_daily FROM mld_bot_bank WHERE bot_id=$1 AND guild_id=$2 AND user_id=$3', [botId,guildId,uid]);
      return r.rows[0];
    };
    const amount = integer(args.find(x => /^\d+$/.test(x)), -1);
    try {
      await ensure(userId);
      if (cmd === 'رصيد' || cmd === 'فلوس') {
        const row = await ensure(userId);
        return message.reply('💰 رصيدك الحالي: **' + money(row.balance) + '** عملة' + (Number(row.loan) ? '\\n🏦 القرض المستحق: **' + money(row.loan) + '**' : ''));
      }
      if (cmd === 'يومي') {
        const clientDb = await pool.connect();
        try {
          await clientDb.query('BEGIN');
          const row = await clientDb.query('SELECT balance,last_daily FROM mld_bot_bank WHERE bot_id=$1 AND guild_id=$2 AND user_id=$3 FOR UPDATE', [botId,guildId,userId]);
          if (row.rows[0]?.last_daily && Date.now() - new Date(row.rows[0].last_daily).getTime() < 86400000) {
            await clientDb.query('ROLLBACK');
            const left = 86400000 - (Date.now() - new Date(row.rows[0].last_daily).getTime());
            return message.reply('⏳ أخذت مكافأتك اليومية. ارجع بعد **' + Math.ceil(left / 3600000) + ' ساعة**.');
          }
          await clientDb.query('UPDATE mld_bot_bank SET balance=balance+$1,last_daily=NOW(),updated_at=NOW() WHERE bot_id=$2 AND guild_id=$3 AND user_id=$4', [daily,botId,guildId,userId]);
          await clientDb.query('COMMIT');
          return message.reply('🎁 استلمت مكافأتك اليومية: **' + money(daily) + '** عملة.');
        } catch (e) { await clientDb.query('ROLLBACK').catch(()=>{}); throw e; } finally { clientDb.release(); }
      }
      if (cmd === 'تحويل' || cmd === 'تبرع') {
        const target = message.mentions.users.first();
        if (!target || target.bot || target.id === userId || amount <= 0) return message.reply('استخدم: ' + prefix + cmd + ' @عضو مبلغ');
        await ensure(target.id);
        const db = await pool.connect();
        try {
          await db.query('BEGIN');
          const debit = await db.query('UPDATE mld_bot_bank SET balance=balance-$1,updated_at=NOW() WHERE bot_id=$2 AND guild_id=$3 AND user_id=$4 AND balance >= $1 RETURNING balance', [amount,botId,guildId,userId]);
          if (!debit.rowCount) { await db.query('ROLLBACK'); return message.reply('❌ رصيدك ما يكفي لهذا التحويل.'); }
          await db.query('UPDATE mld_bot_bank SET balance=balance+$1,updated_at=NOW() WHERE bot_id=$2 AND guild_id=$3 AND user_id=$4', [amount,botId,guildId,target.id]);
          await db.query('COMMIT');
          return message.reply({content:'✅ تم تحويل **' + money(amount) + '** عملة إلى ' + target.toString() + '.',allowedMentions:{users:[target.id]}});
        } catch (e) { await db.query('ROLLBACK').catch(()=>{}); throw e; } finally { db.release(); }
      }
      if (cmd === 'قرض') {
        if (amount <= 0 || amount > maxLoan) return message.reply('حدد قرضًا من 1 إلى **' + money(maxLoan) + '**.');
        const row = await ensure(userId);
        if (Number(row.loan) > 0) return message.reply('سدّد قرضك الحالي قبل طلب قرض جديد.');
        const due = Math.ceil(amount * (1 + loanRate / 100));
        // Guard the write itself, not only the earlier read: two simultaneous
        // loan commands must never credit the account twice.
        const issued = await pool.query(
          'UPDATE mld_bot_bank SET balance=balance+$1,loan=$2,updated_at=NOW() WHERE bot_id=$3 AND guild_id=$4 AND user_id=$5 AND loan=0 RETURNING loan',
          [amount,due,botId,guildId,userId]
        );
        if (!issued.rowCount) return message.reply('لديك قرض قائم بالفعل. سدّده قبل طلب قرض جديد.');
        return message.reply('🏦 أودعنا **' + money(amount) + '** عملة. إجمالي السداد مع الفائدة (' + loanRate + '%): **' + money(due) + '**.');
      }
      if (cmd === 'سداد') {
        if (amount <= 0) return message.reply('استخدم: ' + prefix + 'سداد مبلغ');
        const db = await pool.connect();
        try {
          await db.query('BEGIN');
          const row = await db.query('SELECT balance,loan FROM mld_bot_bank WHERE bot_id=$1 AND guild_id=$2 AND user_id=$3 FOR UPDATE', [botId,guildId,userId]);
          const due = Number(row.rows[0]?.loan || 0), pay = Math.min(amount,due);
          if (!due) { await db.query('ROLLBACK'); return message.reply('ما عليك أي قرض حاليًا.'); }
          if (Number(row.rows[0].balance) < pay) { await db.query('ROLLBACK'); return message.reply('رصيدك ما يكفي للسداد.'); }
          await db.query('UPDATE mld_bot_bank SET balance=balance-$1,loan=loan-$1,updated_at=NOW() WHERE bot_id=$2 AND guild_id=$3 AND user_id=$4', [pay,botId,guildId,userId]);
          await db.query('COMMIT');
          return message.reply('✅ سددت **' + money(pay) + '** عملة من قرضك.');
        } catch (e) { await db.query('ROLLBACK').catch(()=>{}); throw e; } finally { db.release(); }
      }
      if (cmd === 'استثمار') {
        if (amount <= 0) return message.reply('استخدم: ' + prefix + 'استثمار مبلغ');
        const db = await pool.connect();
        try {
          await db.query('BEGIN');
          const row = await db.query('SELECT balance,investments FROM mld_bot_bank WHERE bot_id=$1 AND guild_id=$2 AND user_id=$3 FOR UPDATE', [botId,guildId,userId]);
          if (Number(row.rows[0].balance) < amount) { await db.query('ROLLBACK'); return message.reply('رصيدك ما يكفي للاستثمار.'); }
          const inv = Array.isArray(row.rows[0].investments) ? row.rows[0].investments : [];
          inv.push({amount,createdAt:new Date().toISOString(),maturesAt:new Date(Date.now()+86400000).toISOString()});
          await db.query('UPDATE mld_bot_bank SET balance=balance-$1,investments=$2::jsonb,updated_at=NOW() WHERE bot_id=$3 AND guild_id=$4 AND user_id=$5', [amount,JSON.stringify(inv),botId,guildId,userId]);
          await db.query('COMMIT');
          return message.reply('📈 استثمار **' + money(amount) + '** بدأ. استخدم ' + prefix + 'تداول بعد 24 ساعة لمحاولة تحصيل العائد.');
        } catch (e) { await db.query('ROLLBACK').catch(()=>{}); throw e; } finally { db.release(); }
      }
      if (cmd === 'تداول') {
        const db = await pool.connect();
        try {
          await db.query('BEGIN');
          const row = await db.query('SELECT investments FROM mld_bot_bank WHERE bot_id=$1 AND guild_id=$2 AND user_id=$3 FOR UPDATE', [botId,guildId,userId]);
          const inv = Array.isArray(row.rows[0]?.investments) ? row.rows[0].investments : [];
          const ready = inv.filter(x => Date.now() >= new Date(x.maturesAt).getTime());
          const waiting = inv.filter(x => Date.now() < new Date(x.maturesAt).getTime());
          if (!ready.length) { await db.query('ROLLBACK'); return message.reply('⏳ ما عندك استثمارات مستحقة بعد. الاستثمار يستحق بعد 24 ساعة.'); }
          let payout=0;
          for (const item of ready) payout += Math.max(0,Math.floor(Number(item.amount)*(0.9+Math.random()*0.3)));
          await db.query('UPDATE mld_bot_bank SET balance=balance+$1,investments=$2::jsonb,updated_at=NOW() WHERE bot_id=$3 AND guild_id=$4 AND user_id=$5', [payout,JSON.stringify(waiting),botId,guildId,userId]);
          await db.query('COMMIT');
          return message.reply('📊 تمت تسوية استثماراتك: **' + money(payout) + '** عملة.');
        } catch (e) { await db.query('ROLLBACK').catch(()=>{}); throw e; } finally { db.release(); }
      }
      if (cmd === 'صندوق') {
        const cost = Math.max(1, integer(cfg.boxCost, 100));
        const reward = Math.floor(Math.random()*cost*3);
        const result = await pool.query('UPDATE mld_bot_bank SET balance=balance-$1+$2,updated_at=NOW() WHERE bot_id=$3 AND guild_id=$4 AND user_id=$5 AND balance >= $1 RETURNING balance', [cost,reward,botId,guildId,userId]);
        if (!result.rowCount) return message.reply('📦 الصندوق يكلف **'+money(cost)+'** عملة ورصيدك لا يكفي.');
        return message.reply('📦 فتحت الصندوق مقابل **'+money(cost)+'** وربحت **'+money(reward)+'** عملة.');
      }
    } catch (error) {
      console.error('Bank command error:', error.message);
      return message.reply('تعذر تنفيذ العملية البنكية الآن. حاول مرة أخرى.').catch(()=>{});
    }
  });
}
