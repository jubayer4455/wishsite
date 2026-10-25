const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nywtmiauzroatyitaxbx.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55d3RtaWF1enJvYXR5aXRheGJ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjkxNzk3NiwiZXhwIjoyMTA4NDkzOTc2fQ.DUErZVdCFAN_smlShwXyNhVGvbA1YkynQztOJADw8lY';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'jubayer@admin';
const BUCKET = 'amader-golpo';

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json'
};

async function ensureBucket() {
  try {
    await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true })
    });
  } catch (e) {}
}

async function readStorageProposal(id) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/proposals/${encodeURIComponent(id)}.json?t=${Date.now()}`, {
    headers: { 'Cache-Control': 'no-cache' }
  });
  if (res.status === 200) {
    return await res.json();
  }
  return null;
}

async function writeStorageProposal(record) {
  await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/proposals/${encodeURIComponent(record.id)}.json`, {
    method: 'POST',
    headers: { ...headers, 'x-upsert': 'true' },
    body: JSON.stringify(record)
  });

  let list = [];
  try {
    const idxRes = await fetch(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/index.json?t=${Date.now()}`);
    if (idxRes.status === 200) {
      const data = await idxRes.json();
      if (Array.isArray(data.proposals)) list = data.proposals;
    }
  } catch (e) {}

  const existingIdx = list.findIndex(x => x.id === record.id);
  if (existingIdx >= 0) {
    list[existingIdx] = record;
  } else {
    list.unshift(record);
  }
  list = list.slice(0, 300);

  await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/index.json`, {
    method: 'POST',
    headers: { ...headers, 'x-upsert': 'true' },
    body: JSON.stringify({ proposals: list })
  });
}

async function deleteStorageProposal(id) {
  try {
    await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/proposals/${encodeURIComponent(id)}.json`, {
      method: 'DELETE',
      headers
    });
  } catch (e) {}

  let list = [];
  try {
    const idxRes = await fetch(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/index.json?t=${Date.now()}`);
    if (idxRes.status === 200) {
      const data = await idxRes.json();
      if (Array.isArray(data.proposals)) list = data.proposals;
    }
  } catch (e) {}

  list = list.filter(x => x.id !== id);
  await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/index.json`, {
    method: 'POST',
    headers: { ...headers, 'x-upsert': 'true' },
    body: JSON.stringify({ proposals: list })
  });
}

async function tryPostgresUpsert(record) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/proposals`, {
      method: 'POST',
      headers: {
        ...headers,
        Prefer: 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify(record)
    });
    if (res.ok) {
      const rows = await res.json();
      return rows[0] || record;
    }
  } catch (e) {}
  return null;
}

async function tryPostgresGet(id) {
  try {
    const url = id
      ? `${SUPABASE_URL}/rest/v1/proposals?id=eq.${encodeURIComponent(id)}&select=*`
      : `${SUPABASE_URL}/rest/v1/proposals?select=*&order=created_at.desc&limit=200`;
    const res = await fetch(url, { headers });
    if (res.ok) {
      const data = await res.json();
      return id ? (data[0] || null) : data;
    }
  } catch (e) {}
  return null;
}

async function tryPostgresDelete(id) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/proposals?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers
    });
  } catch (e) {}
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-admin-key');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  try {
    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const id = urlObj.searchParams.get('id');
    const adminKey = req.headers['x-admin-key'] || '';

    if (req.method === 'GET') {
      if (id) {
        const pgRecord = await tryPostgresGet(id);
        if (pgRecord) {
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ ok: true, proposal: pgRecord }));
        }
        const stRecord = await readStorageProposal(id);
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ ok: Boolean(stRecord), proposal: stRecord }));
      } else {
        if (adminKey !== ADMIN_PASSWORD) {
          res.statusCode = 403;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ ok: false, error: 'Unauthorized: Invalid Admin Password' }));
        }
        const pgList = await tryPostgresGet(null);
        const idxRes = await fetch(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/index.json?t=${Date.now()}`);
        const stData = idxRes.status === 200 ? await idxRes.json() : { proposals: [] };
        const stList = Array.isArray(stData.proposals) ? stData.proposals : [];

        const map = new Map();
        stList.forEach(item => { if (item && item.id) map.set(item.id, item); });
        if (Array.isArray(pgList)) {
          pgList.forEach(item => { if (item && item.id) map.set(item.id, item); });
        }
        const merged = Array.from(map.values()).sort((a, b) =>
          String(b.created_at || '').localeCompare(String(a.created_at || ''))
        );

        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ ok: true, proposals: merged }));
      }
    }

    if (req.method === 'DELETE') {
      if (adminKey !== ADMIN_PASSWORD) {
        res.statusCode = 403;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
      }
      if (!id) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ ok: false, error: 'Missing id' }));
      }
      await tryPostgresDelete(id);
      await deleteStorageProposal(id);
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ ok: true }));
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    } else if (!body) {
      body = await new Promise((resolve) => {
        let raw = '';
        req.on('data', chunk => { raw += chunk; });
        req.on('end', () => {
          try { resolve(JSON.parse(raw || '{}')); } catch (e) { resolve({}); }
        });
      });
    }

    if (req.method === 'POST') {
      const now = new Date().toISOString();
      const pid = (body.id || Math.random().toString(36).slice(2, 10)).trim();
      const record = {
        id: pid,
        mode: (body.mode || 'proposal').trim(),
        to_name: (body.to_name || '').trim().slice(0, 40),
        from_name: (body.from_name || '').trim().slice(0, 40),
        whatsapp: (body.whatsapp || '').replace(/\D/g, ''),
        question: (body.question || '').trim().slice(0, 120),
        love_note: (body.love_note || '').trim().slice(0, 500),
        theme: (body.theme || 'pink').trim(),
        match_score: Number(body.match_score || 98),
        status: body.status || 'created',
        no_dodges: Number(body.no_dodges || 0),
        riddle_attempts: Number(body.riddle_attempts || 0),
        math_question: body.math_question || '',
        math_answer: body.math_answer || '',
        date_day: body.date_day || '',
        date_time: body.date_time || '',
        time_slot: body.time_slot || '',
        when_formatted: body.when_formatted || '',
        location: body.location || '',
        foods: Array.isArray(body.foods) ? body.foods : [],
        gifts: Array.isArray(body.gifts) ? body.gifts : [],
        dress_code: (body.dress_code || '').trim().slice(0, 120),
        reply_note: (body.reply_note || '').trim().slice(0, 300),
        summary_text: body.summary_text || '',
        payload: body.payload && typeof body.payload === 'object' ? body.payload : {},
        created_at: now,
        opened_at: null,
        accepted_at: null,
        confirmed_at: null,
        updated_at: now
      };

      await ensureBucket();
      await tryPostgresUpsert(record);
      await writeStorageProposal(record);

      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ ok: true, proposal: record }));
    }

    if (req.method === 'PATCH') {
      const pid = (body.id || id || '').trim();
      if (!pid) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ ok: false, error: 'Missing id' }));
      }

      let existing = (await tryPostgresGet(pid)) || (await readStorageProposal(pid));
      const now = new Date().toISOString();
      if (!existing) {
        existing = {
          id: pid,
          mode: body.mode || 'proposal',
          to_name: (body.to_name || '').trim().slice(0, 40),
          from_name: (body.from_name || '').trim().slice(0, 40),
          whatsapp: (body.whatsapp || '').replace(/\D/g, ''),
          question: (body.question || '').trim().slice(0, 120),
          love_note: (body.love_note || '').trim().slice(0, 500),
          theme: (body.theme || 'pink').trim(),
          match_score: Number(body.match_score || 98),
          status: 'created',
          no_dodges: 0,
          riddle_attempts: 0,
          math_question: '',
          math_answer: '',
          date_day: '',
          date_time: '',
          time_slot: '',
          when_formatted: '',
          location: '',
          foods: [],
          gifts: [],
          dress_code: '',
          reply_note: '',
          summary_text: '',
          payload: {},
          created_at: now,
          opened_at: null,
          accepted_at: null,
          confirmed_at: null,
          updated_at: now
        };
      }

      const statusOrder = { created: 1, opened: 2, accepted: 3, confirmed: 4 };
      const nextStatus = body.status && (statusOrder[body.status] >= (statusOrder[existing.status] || 0))
        ? body.status
        : existing.status;

      const nextPayload = { ...(existing.payload || {}), ...(body.payload || {}) };
      if (body.append_entry) {
        const entries = Array.isArray(nextPayload.entries) ? [...nextPayload.entries] : [];
        entries.unshift({ ...body.append_entry, at: now });
        nextPayload.entries = entries.slice(0, 100);
      }

      const updated = {
        ...existing,
        mode: body.mode !== undefined ? body.mode : (existing.mode || 'proposal'),
        to_name: body.to_name !== undefined ? body.to_name : existing.to_name,
        from_name: body.from_name !== undefined ? body.from_name : existing.from_name,
        whatsapp: body.whatsapp !== undefined ? body.whatsapp : existing.whatsapp,
        question: body.question !== undefined ? body.question : (existing.question || ''),
        love_note: body.love_note !== undefined ? body.love_note : (existing.love_note || ''),
        theme: body.theme !== undefined ? body.theme : (existing.theme || 'pink'),
        match_score: body.match_score !== undefined ? body.match_score : (existing.match_score || 98),
        status: nextStatus,
        no_dodges: Math.max(Number(existing.no_dodges || 0), Number(body.no_dodges || 0)),
        riddle_attempts: Math.max(Number(existing.riddle_attempts || 0), Number(body.riddle_attempts || 0)),
        math_question: body.math_question !== undefined ? body.math_question : existing.math_question,
        math_answer: body.math_answer !== undefined ? body.math_answer : existing.math_answer,
        date_day: body.date_day !== undefined ? body.date_day : existing.date_day,
        date_time: body.date_time !== undefined ? body.date_time : existing.date_time,
        time_slot: body.time_slot !== undefined ? body.time_slot : existing.time_slot,
        when_formatted: body.when_formatted !== undefined ? body.when_formatted : existing.when_formatted,
        location: body.location !== undefined ? body.location : existing.location,
        foods: Array.isArray(body.foods) ? body.foods : existing.foods,
        gifts: Array.isArray(body.gifts) ? body.gifts : (existing.gifts || []),
        dress_code: body.dress_code !== undefined ? body.dress_code : (existing.dress_code || ''),
        reply_note: body.reply_note !== undefined ? body.reply_note : (existing.reply_note || ''),
        summary_text: body.summary_text !== undefined ? body.summary_text : existing.summary_text,
        payload: nextPayload,
        opened_at: existing.opened_at || (body.status === 'opened' ? now : null),
        accepted_at: existing.accepted_at || (body.status === 'accepted' ? now : null),
        confirmed_at: body.status === 'confirmed' ? now : existing.confirmed_at,
        updated_at: now
      };

      await tryPostgresUpsert(updated);
      await writeStorageProposal(updated);

      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ ok: true, proposal: updated }));
    }

    res.statusCode = 405;
    res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: false, error: err.message }));
  }
};
