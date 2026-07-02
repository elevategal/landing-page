/**
 * Record a diagnosis-funnel step for the current session.
 * The client sends the FARTHEST step reached; the server does a
 * blind Airtable upsert (matched on Session ID). Client is responsible
 * for never sending a step lower than one it already sent, so we don't
 * need a read-then-write cycle.
 *
 * Env vars:
 *   AIRTABLE_API_TOKEN
 *   AIRTABLE_DIAGNOSIS_BASE_ID
 *   AIRTABLE_DIAGNOSIS_SESSIONS_TABLE_NAME  (defaults to 'Sessions')
 */

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
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const AIRTABLE_TOKEN = process.env.AIRTABLE_API_TOKEN;
  const BASE_ID = process.env.AIRTABLE_DIAGNOSIS_BASE_ID;
  const TABLE_NAME = process.env.AIRTABLE_DIAGNOSIS_SESSIONS_TABLE_NAME || 'Sessions';

  if (!AIRTABLE_TOKEN || !BASE_ID) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Airtable env vars not configured' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const {
      sessionId, step, stepOrder,
      utmSource, utmMedium, utmCampaign, utmContent,
      runner
    } = body;

    if (!sessionId || typeof sessionId !== 'string') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'sessionId required' }) };
    }
    if (!step || typeof stepOrder !== 'number') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'step and stepOrder required' }) };
    }

    const fields = {
      'Session ID': sessionId,
      'Farthest Step': step,
      'Farthest Step Order': stepOrder,
      'UTM Source': utmSource || '',
      'UTM Medium': utmMedium || '',
      'UTM Campaign': utmCampaign || '',
      'UTM Content': utmContent || ''
    };
    if (runner) fields['Runner'] = runner;

    const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}`;
    const resp = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        performUpsert: { fieldsToMergeOn: ['Session ID'] },
        records: [{ fields }]
      })
    });
    const data = await resp.json();
    if (data.error) {
      console.error('Airtable error:', JSON.stringify(data.error));
      return { statusCode: 500, headers, body: JSON.stringify({ error: data.error.message || data.error.type }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error: ' + err.message }) };
  }
};
