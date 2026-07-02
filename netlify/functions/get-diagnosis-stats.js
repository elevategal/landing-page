/**
 * Diagnosis stats endpoint.
 * Reads all leads from Airtable, aggregates by tier/revenue/budget/utm/day.
 * Requires x-stats-password header matching STATS_PASSWORD env var.
 */

const bucketBy = (records, keyFn) => {
  const out = {};
  for (const r of records) {
    const k = keyFn(r) || '(ריק)';
    out[k] = (out[k] || 0) + 1;
  }
  return out;
};

const avgBy = (records, keyFn) => {
  const values = records.map(keyFn).filter(v => typeof v === 'number' && !isNaN(v));
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
};

const dateKey = (isoLike) => {
  if (!isoLike) return null;
  const d = new Date(isoLike);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-stats-password',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  // --- auth ---
  const expected = process.env.STATS_PASSWORD;
  const provided = event.headers['x-stats-password'] || event.headers['X-Stats-Password'];
  if (!expected) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'STATS_PASSWORD env var not configured on server' }) };
  }
  if (!provided || provided !== expected) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  // --- fetch all records from Airtable (paginated) ---
  const AIRTABLE_TOKEN = process.env.AIRTABLE_API_TOKEN;
  const BASE_ID = process.env.AIRTABLE_DIAGNOSIS_BASE_ID;
  const TABLE_NAME = process.env.AIRTABLE_DIAGNOSIS_TABLE_NAME || 'Leads';
  if (!AIRTABLE_TOKEN || !BASE_ID) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Airtable env vars not configured' }) };
  }

  try {
    const all = [];
    let offset = undefined;
    for (let page = 0; page < 20; page++) {
      const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}`);
      url.searchParams.set('pageSize', '100');
      if (offset) url.searchParams.set('offset', offset);

      const resp = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
      });
      const data = await resp.json();
      if (data.error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: data.error.message || data.error.type }) };
      }
      for (const rec of (data.records || [])) {
        all.push({
          id: rec.id,
          createdTime: rec.createdTime,
          f: rec.fields || {}
        });
      }
      if (!data.offset) break;
      offset = data.offset;
    }

    // --- aggregate ---
    const total = all.length;

    const byTier = bucketBy(all, r => r.f['Tier']);
    const byRevenue = bucketBy(all, r => r.f['Monthly Revenue']);
    const byBudget = bucketBy(all, r => r.f['Marketing Budget']);
    const byRunner = bucketBy(all, r => r.f['Runner']);
    const byUtmSource = bucketBy(all, r => r.f['UTM Source']);
    const byUtmCampaign = bucketBy(all, r => r.f['UTM Campaign']);
    const byUtmContent = bucketBy(all, r => r.f['UTM Content']);
    const byButtonVariant = bucketBy(all, r => r.f['Button Variant']);

    const byDay = bucketBy(all, r => dateKey(r.createdTime));

    const avgScore = avgBy(all, r => {
      const s = r.f['Score'];
      return typeof s === 'number' ? s : parseFloat(s);
    });

    // Buckets we care about — count in last N days
    const nowMs = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const withinDays = (n) => all.filter(r => {
      const t = new Date(r.createdTime).getTime();
      return !isNaN(t) && (nowMs - t) <= n * dayMs;
    }).length;

    // Qualified segment (Meta advertising sweet spot)
    const qualified = all.filter(r => {
      const tier = r.f['Tier'];
      const budget = r.f['Marketing Budget'];
      return (tier === 'strong' || tier === 'core') && (budget === '10-30k' || budget === '30k-plus');
    }).length;

    // Latest 10 leads (minimal fields to display)
    const latest = all
      .slice()
      .sort((a, b) => (new Date(b.createdTime).getTime()) - (new Date(a.createdTime).getTime()))
      .slice(0, 10)
      .map(r => ({
        createdTime: r.createdTime,
        name: r.f['Name'] || '',
        phone: r.f['Phone'] || '',
        brand: r.f['Brand'] || '',
        revenue: r.f['Monthly Revenue'] || '',
        budget: r.f['Marketing Budget'] || '',
        score: r.f['Score'] ?? null,
        tier: r.f['Tier'] || '',
        utmSource: r.f['UTM Source'] || '',
        utmCampaign: r.f['UTM Campaign'] || ''
      }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        generatedAt: new Date().toISOString(),
        total,
        today: withinDays(1),
        last7: withinDays(7),
        last30: withinDays(30),
        qualified,
        avgScore,
        byTier,
        byRevenue,
        byBudget,
        byRunner,
        byUtmSource,
        byUtmCampaign,
        byUtmContent,
        byButtonVariant,
        byDay,
        latest
      })
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error: ' + err.message }) };
  }
};
