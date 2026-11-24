const { onRequest } = require('firebase-functions/v2/https');

/**
 * Proxy HTTP opcional para buscar HTML público de portais NFC-e (SEFAZ)
 * contornando restrições de CORS/X-Frame-Options do navegador.
 */
exports.fetchNfce = onRequest({ cors: true, maxInstances: 5 }, async (req, res) => {
  const targetUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
  if (!targetUrl) {
    res.status(400).json({ error: 'Parâmetro url é obrigatório.' });
    return;
  }

  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    res.status(400).json({ error: 'URL inválida.' });
    return;
  }

  const host = parsed.hostname.toLowerCase();
  const isAllowedHost =
    host.endsWith('.gov.br') &&
    (host.includes('fazenda') ||
      host.includes('sefaz') ||
      host.includes('nfce') ||
      host.includes('satsp') ||
      host.includes('dfe'));

  if (!isAllowedHost) {
    res.status(403).json({ error: 'Domínio não permitido pelo proxy NFC-e.' });
    return;
  }

  try {
    const response = await fetch(parsed.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      signal: AbortSignal.timeout(12000),
    });

    const html = await response.text();
    res.status(response.status).type('text/html; charset=utf-8').send(html);
  } catch (err) {
    res.status(502).json({
      error: `Falha ao consultar SEFAZ: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
});
