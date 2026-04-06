exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // CORS headers
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

    // Monday.com API - token is hidden in environment variable
    const MONDAY_TOKEN = process.env.MONDAY_API_TOKEN;
    const BOARD_ID = 5027628363;

    const mutation = `mutation ($name: String!, $columnValues: JSON!) {
      create_item (board_id: ${BOARD_ID}, item_name: $name, column_values: $columnValues) {
        id
      }
    }`;

    const columnValues = JSON.stringify({
      "phone_mm23htqj": { "phone": phone, "countryShortName": "IL" },
      "email_mm23r2jm": { "email": email, "text": email },
      "color_mm2383c8": { "label": "Working on it" },
      "boolean_mm24kw4r": { "checked": consent ? "true" : "false" }
    });

    const response = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': MONDAY_TOKEN
      },
      body: JSON.stringify({
        query: mutation,
        variables: { name, columnValues }
      })
    });

    const result = await response.json();

    if (result.errors) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: result.errors[0].message }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, id: result.data.create_item.id })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server error' })
    };
  }
};
