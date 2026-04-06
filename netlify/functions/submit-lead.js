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
    const { name, phone, email, consent } = JSON.parse(event.body);

    // Validate
    if (!name || name.length < 2) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid name' }) };
    }
    if (!phone || !/^[\d\-\+\(\)\s]{9,15}$/.test(phone)) {
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
              'Consent': consent || false,
              'Purchase Status': 'Lead'
            }
          }
        ]
      })
    });

    const result = await response.json();

    if (result.error) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: result.error.message }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, id: result.records[0].id })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server error: ' + error.message })
    };
  }
};
