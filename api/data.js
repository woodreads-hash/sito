const { sitemapXml, robotsTxt } = require('./_lib/seo');

module.exports = async (req, res) => {
  const type = String((req.query && req.query.type) || '').toLowerCase();

  if (type === 'sitemap') {
    const xml = await sitemapXml();
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.status(200).send(xml);
    return;
  }

  if (type === 'robots') {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400');
    res.status(200).send(robotsTxt());
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.status(200).send('{}');
};
