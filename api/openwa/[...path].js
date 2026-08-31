export default async function handler(req, res) {
  // Extract path from query (e.g. /api/openwa/api/sessions/...)
  const pathSegments = req.query.path || [];
  const targetPath = Array.isArray(pathSegments) ? pathSegments.join('/') : pathSegments;
  const targetUrl = `https://openwa-attendance-bot.onrender.com/${targetPath}`;
  const defaultApiKey = 'FacPassAttendanceOpenWaMasterKey2026';

  try {
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': req.headers['x-api-key'] || defaultApiKey,
    };

    const fetchOptions = {
      method: req.method,
      headers,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const data = await response.json().catch(() => ({}));
      return res.status(response.status).json(data);
    } else {
      const text = await response.text();
      return res.status(response.status).send(text);
    }
  } catch (error) {
    console.error('Error proxying to OpenWA on Vercel:', error);
    return res.status(502).json({ error: 'Failed to proxy request to OpenWA bot', details: error.message });
  }
}
