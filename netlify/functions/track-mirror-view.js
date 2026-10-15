// עוקב אחר אחוזי צפייה ב-VSL של /mirror - אנונימי, לא קשור ללידים.
// נכתב ל-"פיירדנגל" כדי שלא יזהה את הכותב כ"רשומה חדשה" כל פעם, אלא מסמן את האבן דרך.

// ViewContent ל-Meta רק ב-50% צפייה - לא בכל אבן דרך, כדי לא להציף את החשבון באירועים.
// אותו event_id שכבר נשלח מהדפדפן (fbq), כדי שמטא תמזג ולא תספור פעמיים.
const sendCapiViewContent = async ({ eventId, pageUrl, clientIp, clientUserAgent, fbp, fbc }) => {
  const FB_TOKEN = process.env.FB_CAPI_TOKEN;
  const PIXEL_ID = process.env.FB_PIXEL_ID;
  if (!FB_TOKEN || !PIXEL_ID) return { skipped: true };

  const userData = {};
  if (clientIp) userData.client_ip_address = clientIp;
  if (clientUserAgent) userData.client_user_agent = clientUserAgent;
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;

  const payload = {
    data: [{
      event_name: 'ViewContent',
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      event_source_url: pageUrl,
      action_source: 'website',
      user_data: userData,
      custom_data: { content_name: 'VSL_50' }
    }]
  };

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${PIXEL_ID}/events?access_token=${FB_TOKEN}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
  );
  return await response.json();
};

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
    const { milestone, sessionId, eventId, utmSource, utmMedium, utmCampaign, utmContent, utmTerm, pageUrl } = body;

    const validMilestones = [0, 25, 50, 75, 100];
    const pct = Number(milestone);
    if (!validMilestones.includes(pct)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid milestone' }) };
    }

    // ViewContent ל-Meta רק ב-50%, עצמאי לגמרי מטבלת הצפיות באיירטייבל - אסור שחוסר
    // הגדרה של הטבלה ימנע מהאירוע הזה לצאת.
    let capiResult = null;
    if (pct === 50) {
      const clientIp = (event.headers['cf-connecting-ip']
                      || event.headers['x-nf-client-connection-ip']
                      || event.headers['x-forwarded-for'] || '').split(',')[0].trim();
      const clientUserAgent = event.headers['user-agent'] || '';
      try {
        capiResult = await sendCapiViewContent({
          eventId: eventId || (sessionId + '-50'),
          pageUrl: pageUrl || '',
          clientIp,
          clientUserAgent,
          fbp: body.fbp || '',
          fbc: body.fbc || ''
        });
      } catch (capiErr) {
        console.error('CAPI ViewContent error:', capiErr.message);
        capiResult = { error: capiErr.message };
      }
    }

    const AIRTABLE_TOKEN = process.env.AIRTABLE_API_TOKEN;
    const BASE_ID = process.env.AIRTABLE_MIRROR_BASE_ID;
    const TABLE_NAME = process.env.AIRTABLE_MIRROR_VIEWS_TABLE_NAME;

    if (!AIRTABLE_TOKEN || !BASE_ID || !TABLE_NAME) {
      // אין לאן לכתוב ב-Airtable - לא נכשל בקול, זה לא קריטי כמו ליד. ה-CAPI כבר נשלח למעלה בכל מקרה.
      return { statusCode: 200, headers, body: JSON.stringify({ skipped: true, reason: 'Views table not configured', capi: capiResult }) };
    }

    const fields = {
      'Milestone': pct,
      'Session ID': sessionId || '',
      'UTM Source': utmSource || '',
      'UTM Medium': utmMedium || '',
      'UTM Campaign': utmCampaign || 'mirror',
      'UTM Content': utmContent || '',
      'UTM Term': utmTerm || '',
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
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: !result.error, capi: capiResult }) };

  } catch (error) {
    console.error('Server error (view tracking):', error);
    return { statusCode: 200, headers, body: JSON.stringify({ ok: false }) };
  }
};
