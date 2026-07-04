export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { id, type } = req.query;
  if (!id) {
    return res.status(400).json({ error: 'Missing school id parameter' });
  }

  // Determine target endpoint based on type
  let path = 'rapor';
  if (type === 'domisili-1' || type === 'domisili') {
    path = 'domisili';
  } else if (type === 'domisili-2' || type === 'domisili-khusus') {
    path = 'domisili-khusus';
  }

  const targetUrl = `https://smpapi2.spmbsurabaya.net/api/ranking/negeri/${path}/${id}`;

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://smp.spmbsurabaya.net/',
        'Origin': 'https://smp.spmbsurabaya.net'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Target API returned status ${response.status}` });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
