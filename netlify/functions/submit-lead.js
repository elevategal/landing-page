const crypto = require('crypto');

const hashSha256 = (val) => {
  if (!val) return undefined;
  return crypto.createHash('sha256').update(val.trim().toLowerCase()).digest('hex');
};

const sendCapiLead = async ({ email, phone, name, eventId, eventSourceUrl, clientIp, clientUserAgent, fbp, fbc, testEventCode }) => {
  const FB_TOKEN = process.env.FB_CAPI_TOKEN;
  const PIXEL_ID = '1265390459065125';
  if (!FB_TOKEN) return { skipped: true, reason: 'No FB_CAPI_TOKEN configured' };

  const userData = {};
  if (email) userData.em = [hashSha256(email)];
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
    data: [
      {
        event_name: 'Lead',
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        event_source_url: eventSourceUrl,
        action_source: 'website',
        user_data: userData
      }
    ]
  };
  if (testEventCode) payload.test_event_code = testEventCode;

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${PIXEL_ID}/events?access_token=${FB_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }
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
    const body = JSON.parse(event.body);
    const { name, phone, email, consent, utmSource, utmMedium, utmCampaign, utmContent,
            eventId, eventSourceUrl, fbp, fbc, testEventCode } = body;

    // Validate
    if (!name || name.length < 2) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid name' }) };
    }
    if (!phone || phone.replace(/[\-\s\+\(\)]/g, '').length < 9) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid phone' }) };
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid email' }) };
    }

    const AIRTABLE_TOKEN = process.env.AIRTABLE_API_TOKEN;
    const BASE_ID = 'app0wUm7hxJOq8DWG';
    const TABLE_NAME = 'Table 1';

    const response = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        records: [
          {
            fields: {
              'Name': name,
              'Phone number': phone,
              'Email': email,
              'אישר דיוור': consent || false,
              'Purchase Status': 'Lead',
              'Price': 997,
              'UTM Source': utmSource || '',
              'UTM Medium': utmMedium || '',
              'UTM Campaign': utmCampaign || '',
              'UTM Content': utmContent || ''
            }
          }
        ]
      })
    });

    const result = await response.json();

    if (result.error) {
      console.error('Airtable error:', JSON.stringify(result.error));
      return { statusCode: 500, headers, body: JSON.stringify({ error: result.error.message || result.error.type }) };
    }

    if (!result.records || !result.records.length) {
      console.error('Airtable unexpected response:', JSON.stringify(result));
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Unexpected response from database' }) };
    }

    // Send Lead event to Meta CAPI (server-side, resistant to ad blockers)
    const clientIp = (event.headers['x-nf-client-connection-ip']
                    || event.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const clientUserAgent = event.headers['user-agent'] || '';

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
      body: JSON.stringify({
        success: true,
        id: result.records[0].id,
        capi: capiResult
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server error: ' + error.message })
    };
  }
};
