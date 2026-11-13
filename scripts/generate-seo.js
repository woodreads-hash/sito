const fs = require('fs');
const path = require('path');
const { sitemapXml, robotsTxt } = require('../api/_lib/seo');

(async () => {
  const root = path.resolve(__dirname, '..');
  const [sitemap, robots] = await Promise.all([sitemapXml(), Promise.resolve(robotsTxt())]);
  fs.writeFileSync(path.join(root, 'sitemap.xml'), sitemap, 'utf8');
  fs.writeFileSync(path.join(root, 'robots.txt'), robots, 'utf8');
})();
