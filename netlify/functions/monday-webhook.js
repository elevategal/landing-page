const crypto = require('crypto');

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json'
  };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body);

    // Monday.com webhook challenge (required for initial setup)
    if (body.challenge) {
      return { statusCode: 200, headers, body: JSON.stringify({ challenge: body.challenge }) };
    }

    // Get the event data
    const eventData = body.event;
    if (!eventData) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'No event data' }) };
    }

    // Only trigger on "סטטוס רכישה" column change (color_mm25ph68)
    if (eventData.columnId !== 'color_mm25ph68') {
      return { statusCode: 200, headers, body: JSON.stringify({ message: 'Ignored - not purchase status column' }) };
    }

    // Check if the new value is "Done" (label id 1 = purchased)
    const newValue = eventData.value ? JSON.parse(eventData.value) : null;
    if (!newValue || !newValue.label || !newValue.label.text || newValue.label.text.toLowerCase() !== 'done') {
      return { statusCode: 200, headers, body: JSON.stringify({ message: 'Ignored - not Done status' }) };
    }

    // Fetch the item details from Monday to get email/phone/name
    const MONDAY_TOKEN = process.env.MONDAY_API_TOKEN;
    const itemId = eventData.pulseId;

    const query = `query {
      items(ids: [${itemId}]) {
        name
        column_values {
          id
          text
        }
      }
    }`;

    const mondayResponse = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': MONDAY_TOKEN
      },
      body: JSON.stringify({ query })
    });

    const mondayResult = await mondayResponse.json();
    const item = mondayResult.data.items[0];

    if (!item) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Item not found' }) };
    }

    // Extract contact info
    const name = item.name;
    let email = '';
    let phone = '';

    item.column_values.forEach(col => {
      if (col.id === 'email_mm23r2jm') email = col.text || '';
      if (col.id === 'phone_mm23htqj') phone = col.text || '';
    });

    // Send Purchase event to Facebook Conversion API
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
          action_source: 'system_generated',
          user_data: userData,
          custom_data: {
            currency: 'ILS',
            value: 1700
          }
        }
      ]
    };

    const fbResponse = await fetch(
      `https://graph.facebook.com/v18.0/${PIXEL_ID}/events?access_token=${FB_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fbEvent)
      }
    );

    const fbResult = await fbResponse.json();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        item: name,
        fb_events_received: fbResult.events_received || 0
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
