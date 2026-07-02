/**
 * Diagnosis funnel stats endpoint.
 * Reads all session records from the Sessions Airtable table and
 * aggregates them into a step-by-step funnel with drop-off rates.
 *
 * Requires x-stats-password header matching STATS_PASSWORD env var.
 */

const FUNNEL_STEPS = [
  { key: 'page_view',   order: 1, label: 'נכנסו לדף' },
  { key: 'start',       order: 2, label: 'התחילו שאלון' },
  { key: 'q1_done',     order: 3, label: 'ענו על שאלה 1' },
  { key: 'q2_done',     order: 4, label: 'ענו על שאלה 2' },
  { key: 'q3_done',     order: 5, label: 'ענו על שאלה 3' },
  { key: 'q4_done',     order: 6, label: 'ענו על שאלה 4' },
  { key: 'q5_done',     order: 7, label: 'ענו על שאלה 5' },
  { key: 'result',      order: 8, label: 'הגיעו לתוצאה' },
  { key: 'form_submit', order: 9, label: 'שלחו טופס' }
];

const bucketBy = (records, keyFn) => {
  const out = {};
  for (const r of records) {
    const k = keyFn(r);
    if (k == null || k === '') continue;
    out[k] = (out[k] || 0) + 1;
  }
  return out;
};

const dateKey = (isoLike) => {
  if (!isoLike) return null;
  const d = new Date(isoLike);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

async function fetchAllRecords(baseId, tableName, token) {
  const all = [];
  let offset;
  for (let page = 0; page < 25; page++) {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`);
    url.searchParams.set('pageSize', '100');
    if (offset) url.searchParams.set('offset', offset);
    const resp = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message || data.error.type || 'Airtable error');
    for (const rec of (data.records || [])) {
      all.push({ id: rec.id, createdTime: rec.createdTime, f: rec.fields || {} });
    }
    if (!data.offset) break;
    offset = data.offset;
  }
  return all;
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-stats-password',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

  // Auth
  const expected = process.env.STATS_PASSWORD;
  const provided = event.headers['x-stats-password'] || event.headers['X-Stats-Password'];
  if (!expected) return { statusCode: 500, headers, body: JSON.stringify({ error: 'STATS_PASSWORD env var not configured on server' }) };
  if (!provided || provided !== expected) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };

  const AIRTABLE_TOKEN = process.env.AIRTABLE_API_TOKEN;
  const BASE_ID = process.env.AIRTABLE_DIAGNOSIS_BASE_ID;
  const SESSIONS_TABLE = process.env.AIRTABLE_DIAGNOSIS_SESSIONS_TABLE_NAME || 'Sessions';
  const LEADS_TABLE = process.env.AIRTABLE_DIAGNOSIS_TABLE_NAME || 'Leads';

  if (!AIRTABLE_TOKEN || !BASE_ID) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Airtable env vars not configured' }) };
  }

  try {
    // --- fetch sessions + leads in parallel ---
    let sessions = [];
    let leads = [];
    let sessionsError = null;
    let leadsError = null;
    await Promise.all([
      fetchAllRecords(BASE_ID, SESSIONS_TABLE, AIRTABLE_TOKEN).then(r => sessions = r).catch(e => sessionsError = e.message),
      fetchAllRecords(BASE_ID, LEADS_TABLE, AIRTABLE_TOKEN).then(r => leads = r).catch(e => leadsError = e.message)
    ]);

    // --- build the funnel ---
    // Count sessions reaching each step (using Farthest Step Order)
    const stepCounts = {};
    for (const step of FUNNEL_STEPS) stepCounts[step.key] = 0;
    for (const s of sessions) {
      const reachedOrder = Number(s.f['Farthest Step Order']) || 0;
      for (const step of FUNNEL_STEPS) {
        if (reachedOrder >= step.order) stepCounts[step.key] += 1;
      }
    }
    const totalSessions = sessions.length;
    const totalTop = stepCounts.page_view || 0;
    const funnel = FUNNEL_STEPS.map((step, idx) => {
      const count = stepCounts[step.key];
      const pctOfTop = totalTop > 0 ? Math.round((count / totalTop) * 1000) / 10 : 0;
      const prev = idx > 0 ? stepCounts[FUNNEL_STEPS[idx - 1].key] : count;
      const retention = prev > 0 ? Math.round((count / prev) * 1000) / 10 : 100;
      const dropFromPrev = prev - count;
      return {
        key: step.key,
        order: step.order,
        label: step.label,
        count,
        pctOfTop,
        retention,
        dropFromPrev
      };
    });

    // --- session breakdowns ---
    const nowMs = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const sessionsIn = (n) => sessions.filter(s => {
      const t = new Date(s.createdTime).getTime();
      return !isNaN(t) && (nowMs - t) <= n * dayMs;
    }).length;

    const bySource = bucketBy(sessions, s => s.f['UTM Source']);
    const byCampaign = bucketBy(sessions, s => s.f['UTM Campaign']);
    const byContent = bucketBy(sessions, s => s.f['UTM Content']);
    const byDay = bucketBy(sessions, s => dateKey(s.createdTime));

    // Recent sessions with their farthest step (for scanning drop-offs)
    const recentSessions = sessions
      .slice()
      .sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime())
      .slice(0, 20)
      .map(s => ({
        createdTime: s.createdTime,
        farthestStep: s.f['Farthest Step'] || '',
        farthestOrder: Number(s.f['Farthest Step Order']) || 0,
        utmSource: s.f['UTM Source'] || '',
        utmCampaign: s.f['UTM Campaign'] || ''
      }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        generatedAt: new Date().toISOString(),
        sessionsError,
        leadsError,
        // funnel
        funnel,
        totalSessions,
        // leads count (from the leads table)
        totalLeads: leads.length,
        // session windows
        sessionsToday: sessionsIn(1),
        sessionsLast7: sessionsIn(7),
        sessionsLast30: sessionsIn(30),
        // breakdowns
        bySource,
        byCampaign,
        byContent,
        byDay,
        // recent
        recentSessions
      })
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error: ' + err.message }) };
  }
};
