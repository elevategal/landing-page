const crypto = require('crypto');

const hashSha256 = (val) => {
  if (!val) return undefined;
  return crypto.createHash('sha256').update(val.trim().toLowerCase()).digest('hex');
};

// Meta CAPI - רץ רק אם FB_CAPI_TOKEN מוגדר בסביבה
const sendCapiLead = async ({ email, phone, name, eventId, eventSourceUrl, clientIp, clientUserAgent, fbp, fbc, testEventCode }) => {
  const FB_TOKEN = process.env.FB_CAPI_TOKEN;
  const PIXEL_ID = process.env.FB_PIXEL_ID || '1265390459065125';
  if (!FB_TOKEN) return { skipped: true, reason: 'No FB_CAPI_TOKEN configured' };

  const userData = {};
  if (email) {
    userData.em = [hashSha256(email)];
    userData.external_id = [hashSha256(email)];
  }
  if (phone) userData.ph = [hashSha256(phone.replace(/[\-\s\+\(\)]/g, ''))];
  if (name) {
    const parts = name.trim().split(' ');
    userData.fn = [hashSha256(parts[0])];
    if (parts.length > 1) userData.ln = [hashSha256(parts[parts.length - 1])];
  }
  userData.country = [hashSha256('il')];
  if (clientIp) userData.client_ip_address = clientIp;
  if (clientUserAgent) userData.client_user_agent = clientUserAgent;
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;

  const payload = {
    data: [{
      event_name: 'Lead',
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      event_source_url: eventSourceUrl,
      action_source: 'website',
      user_data: userData
    }]
  };
  if (testEventCode) payload.test_event_code = testEventCode;

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
    const {
      name, phone, email, industry, budget, whoRuns, records, leads, qualified,
      utmSource, utmMedium, utmCampaign, utmContent,
      eventId, eventSourceUrl, fbp, fbc, testEventCode
    } = body;

    if (!name || name.trim().length < 2) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid name' }) };
    }
    if (!phone || phone.replace(/[\-\s\+\(\)]/g, '').length < 9) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid phone' }) };
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid email' }) };
    }

    const AIRTABLE_TOKEN = process.env.AIRTABLE_API_TOKEN;
    const BASE_ID = process.env.AIRTABLE_MIRROR_BASE_ID;
    const TABLE_NAME = process.env.AIRTABLE_MIRROR_TABLE_NAME || 'Table 1';

    if (!AIRTABLE_TOKEN || !BASE_ID) {
      console.error('Missing AIRTABLE_API_TOKEN or AIRTABLE_MIRROR_BASE_ID');
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server not configured' }) };
    }

    const clientIp = (event.headers['cf-connecting-ip']
                    || event.headers['x-nf-client-connection-ip']
                    || event.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const clientUserAgent = event.headers['user-agent'] || '';

    // שמות העמודות באיירטייבל - חייבים להיות זהים לאלה שבבייס
    const fields = {
      'Name': name.trim(),
      'Phone number': phone.trim(),
      'Email': email.trim(),
      'תחום העיסוק': industry || '',
      'תקציב חודשי': budget || '',
      'מי מריץ': whoRuns || '',
      'מקליט שיחות': records || '',
      'לידים בחודש האחרון': leads || '',
      'Status': qualified === false ? 'Not qualified' : 'Lead',
      'UTM Source': utmSource || '',
      'UTM Medium': utmMedium || '',
      'UTM Campaign': utmCampaign || 'mirror',
      'UTM Content': utmContent || '',
      'FBP': fbp || '',
      'FBC': fbc || '',
      'Client IP': clientIp || '',
      'User Agent': clientUserAgent || '',
      'Event Source URL': eventSourceUrl || ''
    };

    // typecast: מאפשר לאיירטייבל להתאים את הערך לסוג העמודה,
    // ולהוסיף אופציה ל-single select אם היא לא קיימת (למשל Status = Lead)
    const post = (f) => fetch(`https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: [{ fields: f }], typecast: true })
    }).then(r => r.json());

    // כותב, ואם עמודה לא קיימת בבייס - מוריד אותה, מעביר את הערך ל-Notes, ומנסה שוב.
    // ככה ליד אף פעם לא הולך לאיבוד, גם אם הטבלה לא בנויה כמו שצריך.
    const attempt = Object.assign({}, fields);
    const dropped = {};
    let result = null;

    for (let i = 0; i < 25; i++) {
      if ('Notes' in attempt && Object.keys(dropped).length) {
        attempt['Notes'] = Object.entries(dropped)
          .filter(([, v]) => v !== '' && v !== undefined && v !== null)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n');
      }

      result = await post(attempt);

      if (!result.error || result.error.type !== 'UNKNOWN_FIELD_NAME') break;

      const m = /Unknown field name:\s*"?([^"]+)"?/i.exec(result.error.message || '');
      const bad = m && m[1];
      if (!bad || !(bad in attempt)) break;

      if (bad !== 'Notes') dropped[bad] = attempt[bad];
      delete attempt[bad];
      console.warn('Airtable column missing, dropped:', bad);

      if (!Object.keys(attempt).length) break;
    }

    // אם עמודות נפלו ו-Notes לא היה בכלל ברשימת השדות, מוסיפים אותו עכשיו
    // על הרשומה שנוצרה, כדי שהטלפון והאימייל לא ילכו לאיבוד.
    if (Object.keys(dropped).length) {
      console.warn('Columns missing from the mirror table:', Object.keys(dropped).join(', '));

      const dump = Object.entries(dropped)
        .filter(([, v]) => v !== '' && v !== undefined && v !== null)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');

      if (dump && !('Notes' in attempt) && result.records && result.records.length) {
        const patch = await fetch(
          `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}/${result.records[0].id}`,
          {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields: { 'Notes': dump }, typecast: true })
          }
        ).then(r => r.json()).catch(e => ({ error: { message: e.message } }));

        if (patch.error) {
          console.error('Could not write the dropped values to Notes:', JSON.stringify(patch.error));
        }
      }
    }

    if (result.error) {
      console.error('Airtable error:', JSON.stringify(result.error));
      return { statusCode: 500, headers, body: JSON.stringify({ error: result.error.message || result.error.type }) };
    }
    if (!result.records || !result.records.length) {
      console.error('Airtable unexpected response:', JSON.stringify(result));
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Unexpected response from database' }) };
    }

    let capiResult = null;
    try {
      capiResult = await sendCapiLead({
        email, phone, name, eventId, eventSourceUrl,
        clientIp, clientUserAgent, fbp, fbc, testEventCode
      });
    } catch (capiErr) {
      console.error('CAPI Lead error:', capiErr.message);
      capiResult = { error: capiErr.message };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, id: result.records[0].id, capi: capiResult })
    };

  } catch (error) {
    console.error('Server error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error: ' + error.message }) };
  }
};
