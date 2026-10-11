// עוקב אחר אחוזי צפייה ב-VSL של /mirror - אנונימי, לא קשור ללידים.
// נכתב ל-"פיירדנגל" כדי שלא יזהה את הכותב כ"רשומה חדשה" כל פעם, אלא מסמן את האבן דרך.
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' }, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    const body = JSON.parse(event.body || '{}');
    const { milestone, sessionId, utmSource, utmMedium, utmCampaign, utmContent, pageUrl } = body;

    const validMilestones = [0, 25, 50, 75, 100];
    const pct = Number(milestone);
    if (!validMilestones.includes(pct)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid milestone' }) };
    }

    const AIRTABLE_TOKEN = process.env.AIRTABLE_API_TOKEN;
    const BASE_ID = process.env.AIRTABLE_MIRROR_BASE_ID;
    const TABLE_NAME = process.env.AIRTABLE_MIRROR_VIEWS_TABLE_NAME;

    if (!AIRTABLE_TOKEN || !BASE_ID || !TABLE_NAME) {
      // אין לאן לכתוב - לא נכשל בקול, זה לא קריטי כמו ליד. פשוט מדלגים.
      return { statusCode: 200, headers, body: JSON.stringify({ skipped: true, reason: 'Views table not configured' }) };
    }

    const fields = {
      'Milestone': pct,
      'Session ID': sessionId || '',
      'UTM Source': utmSource || '',
      'UTM Medium': utmMedium || '',
      'UTM Campaign': utmCampaign || 'mirror',
      'UTM Content': utmContent || '',
      'Page URL': pageUrl || ''
    };

    const post = (f) => fetch(`https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: [{ fields: f }], typecast: true })
    }).then(r => r.json());

    // אם עמודה חסרה - מורידים אותה ומנסים שוב, בלי לאבד את האירוע כולו
    const attempt = Object.assign({}, fields);
    let result = null;
    for (let i = 0; i < 10; i++) {
      result = await post(attempt);
      if (!result.error || result.error.type !== 'UNKNOWN_FIELD_NAME') break;
      const m = /Unknown field name:\s*"?([^"]+)"?/i.exec(result.error.message || '');
      const bad = m && m[1];
      if (!bad || !(bad in attempt)) break;
      console.warn('Views table missing column, dropped:', bad);
      delete attempt[bad];
      if (!Object.keys(attempt).length) break;
    }

    if (result.error) {
      console.error('Airtable error (view tracking):', JSON.stringify(result.error));
      // לא מחזיר שגיאה ללקוח - זה מעקב סטטיסטי, לא רוצים retry-storm מהדפדפן
      return { statusCode: 200, headers, body: JSON.stringify({ ok: false }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };

  } catch (error) {
    console.error('Server error (view tracking):', error);
    return { statusCode: 200, headers, body: JSON.stringify({ ok: false }) };
  }
};
