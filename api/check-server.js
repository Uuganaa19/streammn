// Vercel Serverless Function — Server availability checker
// Checks if an embed server URL returns a valid response

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=30'); // cache 30 seconds

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ ok: false, error: 'No URL provided' });
  }

  // Decode the URL
  let targetUrl;
  try {
    targetUrl = decodeURIComponent(url);
  } catch(e) {
    return res.status(400).json({ ok: false, error: 'Invalid URL' });
  }

  // Only allow embed server domains
  const ALLOWED_DOMAINS = [
    'vidsrc.cc', 'vidsrc.to', 'vidsrc.me',
    '2embed.stream', 'autoembed.co', 'embed.su',
    'vidsrc.xyz', 'vidsrc.net', 'embedder.net'
  ];
  const isAllowed = ALLOWED_DOMAINS.some(d => targetUrl.includes(d));
  if (!isAllowed) {
    return res.status(403).json({ ok: false, error: 'Domain not allowed' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch(targetUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://streammn1.vercel.app/',
      }
    });

    clearTimeout(timeout);

    // Read body to check for error phrases
    const text = await response.text();
    const lowerText = text.toLowerCase();

    const ERROR_PHRASES = [
      'not found', 'unavailable', '404', 'error',
      'no stream', 'media not found', 'video not found',
      'something went wrong', 'cannot be played'
    ];

    const hasError = ERROR_PHRASES.some(p => {
      // Only flag if error phrase is in a prominent place (first 2000 chars)
      return lowerText.slice(0, 2000).includes(p);
    });

    const ok = response.status < 400 && !hasError;

    return res.status(200).json({
      ok,
      status: response.status,
      url: targetUrl,
    });

  } catch(e) {
    const timedOut = e.name === 'AbortError';
    return res.status(200).json({
      ok: false,
      error: timedOut ? 'timeout' : e.message,
      url: targetUrl,
    });
  }
}
