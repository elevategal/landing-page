const crypto = require('crypto');

const hashSha256 = (val) => {
  if (!val) return undefined;
  return crypto.createHash('sha256').update(val.trim().toLowerCase()).digest('hex');
};

// נקרא ע"י אוטומציה ב-Airtable, כשמישהו מסמן ליד כ-"רלוונטי" אחרי שיחה.
// שולח אירוע CAPI נפרד (QualifiedLead, לא Lead) - לא מתמזג עם אירוע ה-Lead
// המקורי, כי זה אות איכות חדש שמגיע מאוחר יותר, לא דה-דופליקציה של אותה המרה.
const sendCapiQualifiedLead = async ({ email, phone, name, eventSourceUrl, testEventCode }) => {
  const FB_TOKEN = process.env.FB_CAPI_TOKEN;
  const PIXEL_ID = process.env.FB_PIXEL_ID;
  if (!FB_TOKEN || !PIXEL_ID) return { skipped: true, reason: 'No FB_CAPI_TOKEN/FB_PIXEL_ID configured' };

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

  const payload = {
    data: [{
      event_name: 'QualifiedLead',
      event_time: Math.floor(Date.now() / 1000),
      event_id: 'qualified-' + Date.now() + '-' + Math.floor(Math.random() * 1e6),
      event_source_url: eventSourceUrl || '',
      action_source: 'system_generated', // האירוע נוצר מסימון ידני ב-Airtable, לא מפעולה בדפדפן
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
    const { name, phone, email, eventSourceUrl, testEventCode } = body;

    if (!email && !phone) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Need at least email or phone to match the lead' }) };
    }

    const capiResult = await sendCapiQualifiedLead({ name, phone, email, eventSourceUrl, testEventCode });

    if (capiResult.error) {
      console.error('CAPI QualifiedLead error:', JSON.stringify(capiResult.error));
      return { statusCode: 500, headers, body: JSON.stringify({ error: capiResult.error }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, capi: capiResult }) };

  } catch (error) {
    console.error('Server error (qualified lead):', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error: ' + error.message }) };
  }
};
