const crypto = require('crypto');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  try {
    const { email, phone, name, value, testEventCode, eventId } = JSON.parse(event.body);

    if (!email && !phone) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Need email or phone' }) };
    }

    const FB_TOKEN = process.env.FB_CAPI_TOKEN;
    const PIXEL_ID = '1265390459065125';

    const hashSha256 = (val) => {
      if (!val) return undefined;
      return crypto.createHash('sha256').update(val.trim().toLowerCase()).digest('hex');
    };

    const userData = {};
    if (email) userData.em = [hashSha256(email)];
    if (phone) userData.ph = [hashSha256(phone.replace(/[\-\s\+\(\)]/g, ''))];
    if (name) {
      const parts = name.trim().split(' ');
      userData.fn = [hashSha256(parts[0])];
      if (parts.length > 1) userData.ln = [hashSha256(parts[parts.length - 1])];
    }
    userData.country = [hashSha256('il')];

    const fbEvent = {
      data: [
        {
          event_name: 'Purchase',
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventId,
          action_source: 'system_generated',
          user_data: userData,
          custom_data: {
            currency: 'ILS',
            value: value || 997
          }
        }
      ]
    };
    if (testEventCode) fbEvent.test_event_code = testEventCode;

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${PIXEL_ID}/events?access_token=${FB_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fbEvent)
      }
    );

    const result = await response.json();

    if (result.error) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: result.error.message }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, events_received: result.events_received })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server error: ' + error.message })
    };
  }
};
