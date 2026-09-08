import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('../', import.meta.url);
const publicationsRoot = new URL('../publications/', import.meta.url);
const legacyBrand = String.fromCharCode(67, 104, 111, 116, 97);
const newArchiveSlugs = new Set([
  'ai-systems-inventory', 'ai-pilot-production-decision', 'ai-business-value-measurement',
  'ai-process-ownership-training', 'ai-data-quality-contract', 'social-listening-trend-validation',
  'recommendation-system-business-metrics', 'financial-ai-assistant-reconciliation',
  'ai-programming-education-independent-skills', 'ai-learning-assistant-validation',
  'digital-application-statuses', 'reproducible-allocation-algorithms',
  'iot-monitoring-data-reliability', 'computer-vision-production-validation',
  'serverless-ai-background-jobs', 'ai-model-efficiency-benchmark',
  'logistics-event-document-integration', 'xr-pilot-value-validation',
]);
const expectedAuthors = {
  'ai-project-cost-timeline': ['Виталий Бахмат', 'vitaliy'],
  'private-ai-tco': ['Виталий Бахмат', 'vitaliy'],
  'software-development-cost-belarus': ['Виталий Бахмат', 'vitaliy'],
  'how-to-choose-software-contractor': ['Виталий Бахмат', 'vitaliy'],
  'software-requirements-acceptance-support': ['Виталий Бахмат', 'vitaliy'],
  'ai-agent-vs-chatbot-vs-workflow': ['Егор Крячев', 'egor'],
  'ai-agent-action-security': ['Егор Крячев', 'egor'],
  'ai-agent-human-handoff': ['Егор Крячев', 'egor'],
  'ai-agent-evaluation-guide': ['Егор Крячев', 'egor'],
  'how-ai-automates-companies': ['Егор Крячев', 'egor'],
  'ai-agent-vs-generic-chatbot': ['Егор Крячев', 'egor'],
  'rag-evaluation-citations': ['Вадим Владымцев', 'vadim'],
  'private-on-prem-ai': ['Вадим Владымцев', 'vadim'],
  'rag-vs-fine-tuning': ['Вадим Владымцев', 'vadim'],
  'rag-access-control': ['Вадим Владымцев', 'vadim'],
  'rag-knowledge-base-updates': ['Вадим Владымцев', 'vadim'],
  'private-ai-cloud-hybrid-on-prem': ['Вадим Владымцев', 'vadim'],
  'private-ai-threat-model': ['Вадим Владымцев', 'vadim'],
  'knowledge-base-launch': ['Вадим Владымцев', 'vadim'],
  'new-models-may-2026': ['Вадим Владымцев', 'vadim'],
  'ai-fundraising-nko': ['Вадим Владымцев', 'vadim'],
  'ai-systems-inventory': ['Вадим Владымцев', 'vadim'],
  'ai-pilot-production-decision': ['Вадим Владымцев', 'vadim'],
  'ai-business-value-measurement': ['Вадим Владымцев', 'vadim'],
  'ai-process-ownership-training': ['Вадим Владымцев', 'vadim'],
  'ai-data-quality-contract': ['Вадим Владымцев', 'vadim'],
  'social-listening-trend-validation': ['Вадим Владымцев', 'vadim'],
  'recommendation-system-business-metrics': ['Вадим Владымцев', 'vadim'],
  'financial-ai-assistant-reconciliation': ['Вадим Владымцев', 'vadim'],
  'ai-programming-education-independent-skills': ['Вадим Владымцев', 'vadim'],
  'ai-learning-assistant-validation': ['Вадим Владымцев', 'vadim'],
  'digital-application-statuses': ['Вадим Владымцев', 'vadim'],
  'reproducible-allocation-algorithms': ['Вадим Владымцев', 'vadim'],
  'iot-monitoring-data-reliability': ['Вадим Владымцев', 'vadim'],
  'computer-vision-production-validation': ['Вадим Владымцев', 'vadim'],
  'serverless-ai-background-jobs': ['Вадим Владымцев', 'vadim'],
  'ai-model-efficiency-benchmark': ['Вадим Владымцев', 'vadim'],
  'logistics-event-document-integration': ['Вадим Владымцев', 'vadim'],
  'xr-pilot-value-validation': ['Вадим Владымцев', 'vadim'],
};

const expectedPublished = {
  'ai-project-cost-timeline': '2026-07-21T00:00:00+03:00',
  'private-ai-tco': '2026-08-18T00:00:00+03:00',
  'software-development-cost-belarus': '2026-08-18T00:00:00+03:00',
  'how-to-choose-software-contractor': '2026-08-18T00:00:00+03:00',
  'software-requirements-acceptance-support': '2026-08-18T00:00:00+03:00',
  'ai-agent-vs-chatbot-vs-workflow': '2026-07-21T00:00:00+03:00',
  'ai-agent-action-security': '2026-08-18T00:00:00+03:00',
  'ai-agent-human-handoff': '2026-08-18T00:00:00+03:00',
  'ai-agent-evaluation-guide': '2026-08-18T00:00:00+03:00',
  'how-ai-automates-companies': '2026-08-23T00:00:00+03:00',
  'ai-agent-vs-generic-chatbot': '2026-04-15T00:00:00',
  'rag-evaluation-citations': '2026-07-21T00:00:00+03:00',
  'private-on-prem-ai': '2026-07-21T00:00:00+03:00',
  'rag-vs-fine-tuning': '2026-08-18T00:00:00+03:00',
  'rag-access-control': '2026-08-18T00:00:00+03:00',
  'rag-knowledge-base-updates': '2026-08-18T00:00:00+03:00',
  'private-ai-cloud-hybrid-on-prem': '2026-08-18T00:00:00+03:00',
  'private-ai-threat-model': '2026-08-18T00:00:00+03:00',
  'knowledge-base-launch': '2026-05-05T00:00:00',
  'new-models-may-2026': '2026-05-04T00:00:00',
  'ai-fundraising-nko': '2026-08-31T00:00:00+03:00',
  'iot-monitoring-data-reliability': '2026-08-01T00:00:00+03:00',
  'ai-data-quality-contract': '2026-08-03T00:00:00+03:00',
  'social-listening-trend-validation': '2026-08-05T00:00:00+03:00',
  'recommendation-system-business-metrics': '2026-08-07T00:00:00+03:00',
  'ai-programming-education-independent-skills': '2026-08-09T00:00:00+03:00',
  'ai-learning-assistant-validation': '2026-08-11T00:00:00+03:00',
  'computer-vision-production-validation': '2026-08-13T00:00:00+03:00',
  'serverless-ai-background-jobs': '2026-08-15T00:00:00+03:00',
  'ai-model-efficiency-benchmark': '2026-08-17T00:00:00+03:00',
  'financial-ai-assistant-reconciliation': '2026-08-19T00:00:00+03:00',
  'xr-pilot-value-validation': '2026-08-21T00:00:00+03:00',
  'digital-application-statuses': '2026-08-23T00:00:00+03:00',
  'reproducible-allocation-algorithms': '2026-08-25T00:00:00+03:00',
  'ai-process-ownership-training': '2026-09-01T00:00:00+03:00',
  'logistics-event-document-integration': '2026-09-02T00:00:00+03:00',
  'ai-systems-inventory': '2026-09-05T00:00:00+03:00',
  'ai-pilot-production-decision': '2026-09-07T00:00:00+03:00',
  'ai-business-value-measurement': '2026-09-08T00:00:00+03:00',
};
const monthNames = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const visibleDate = (published) => {
  const [year, month, day] = published.slice(0, 10).split('-').map(Number);
  return `${day} ${monthNames[month - 1]} ${year}`;
};
const assertSharedFooter = (html, label) => {
  assert.match(html, /<footer class="site-footer">/, `${label} has the shared footer`);
  assert.match(html, /<p class="footer-description">Практика для AI-лидеров и команд, которые внедряют AI<\/p>/, `${label} footer explains the practice`);
  assert.match(html, /<nav class="footer-navigation" aria-label="Навигация в подвале">[\s\S]*?href="\/\#experts"[\s\S]*?href="\/\#work"[\s\S]*?href="\/\#format"[\s\S]*?href="\/publications\/"[\s\S]*?href="\/\#contact"/, `${label} footer has the complete navigation`);
  assert.match(html, /<div class="footer-companies">[\s\S]*?<a class="footer-company" href="https:\/\/century-ai\.by\/"[^>]*>CENTURY[\s\S]*?<a class="footer-company" href="https:\/\/stacklevel\.group\/"[^>]*>STACKLEVEL GROUP/, `${label} footer links to both companies`);
  assert.match(html, /<div class="footer-meta">[\s\S]*?Минск · Беларусь/, `${label} footer has location`);
  assert.match(html, /<div class="footer-meta">[\s\S]*?data-year/, `${label} footer has the current year`);
};

const stripMarkup = (html) => html
  .replace(/<script\b[\s\S]*?<\/script>/gi, '')
  .replace(/<style\b[\s\S]*?<\/style>/gi, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&[a-z0-9#]+;/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const dirs = (await readdir(publicationsRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

assert.deepEqual(dirs, Object.keys(expectedAuthors).sort(), 'all and only the selected publications exist');

const catalogue = await readFile(new URL('../publications/index.html', import.meta.url), 'utf8');
assert.equal((catalogue.match(/class="publication-card"/g) || []).length, 39, 'catalogue lists 39 publications');
assert.match(catalogue, /Бизнес[\s\S]*Автоматизация[\s\S]*Наука, технологии и инновации/, 'catalogue groups publications by assigned author topic');
assert.match(catalogue, /<meta property="og:type" content="website">/, 'catalogue identifies itself as a website page');
assert.doesNotMatch(catalogue, /class="publication-card-id">\s*[DA]\d{2}\b/, 'catalogue hides source numbering');
assert.match(catalogue, /ai-fundraising-nko/, 'catalogue links the NGO fundraising publication');
assert.match(catalogue, /<span class="mono-label">11 материалов<\/span><h2 id="group-business">Бизнес<\/h2>/, 'business group count includes new business publications');
assert.match(catalogue, /"numberOfItems":39/, 'catalogue structured data counts all publications');
assert.match(catalogue, /<header class="site-header" data-header>/, 'catalogue uses the shared site header');
assert.doesNotMatch(catalogue, /publication-header|publication-footer/, 'catalogue has no separate header or footer components');
assert.match(catalogue, /<nav class="desktop-nav"[^>]*>[\s\S]*?href="\/\#experts"[\s\S]*?href="\/\#work"[\s\S]*?href="\/\#format"[\s\S]*?href="\/publications\/"/, 'catalogue uses the shared desktop navigation');
assert.match(catalogue, /<nav class="mobile-nav"[\s\S]*?data-mobile-menu hidden>/, 'catalogue uses the shared mobile navigation');
assert.match(catalogue, /<script src="\/assets\/js\/main\.js" defer><\/script>/, 'catalogue loads the shared navigation script');
assertSharedFooter(catalogue, 'catalogue');
for (const [slug, [author, anchor]] of Object.entries(expectedAuthors)) {
  const card = catalogue.match(new RegExp(`<article class="publication-card">(?:(?!<\\/article>)[\\s\\S])*?href="/publications/${slug}/"(?:(?!<\\/article>)[\\s\\S])*?<\\/article>`))?.[0];
  assert.ok(card, `catalogue contains the ${slug} card`);
  assert.match(card, new RegExp(`<a[^>]+href="/\\#${anchor}"[^>]*>${author}</a>`), `catalogue credits ${slug} to its assigned author`);
  assert.match(card, new RegExp(`<time datetime="${expectedPublished[slug].replaceAll('+', '\\+')}\">${visibleDate(expectedPublished[slug])}</time>`), `catalogue shows the ${slug} publication date without a timezone shift`);
}
const jointCard = catalogue.match(/<article class="publication-card">(?:(?!<\/article>)[\s\S])*?href="\/publications\/ai-fundraising-nko\/"(?:(?!<\/article>)[\s\S])*?<\/article>/)?.[0];
assert.match(jointCard, /href="\/\#vadim">Вадим Владымцев<\/a>[\s\S]*href="\/\#vitaliy">Виталий Бахмат<\/a>/, 'catalogue credits both NGO article authors');

for (const slug of dirs) {
  const html = await readFile(join(publicationsRoot.pathname, slug, 'index.html'), 'utf8');
  const [author, anchor] = expectedAuthors[slug];
  assert.equal((html.match(/<h1\b/g) || []).length, 1, `${slug} has one H1`);
  assert.match(html, /<header class="site-header" data-header>/, `${slug} uses the shared site header`);
  assert.doesNotMatch(html, /publication-header|publication-footer/, `${slug} has no separate header or footer components`);
  assert.match(html, /<nav class="desktop-nav"[^>]*>[\s\S]*?href="\/\#experts"[\s\S]*?href="\/\#work"[\s\S]*?href="\/\#format"[\s\S]*?href="\/publications\/"/, `${slug} uses the shared desktop navigation`);
  assert.match(html, /<nav class="mobile-nav"[\s\S]*?data-mobile-menu hidden>/, `${slug} uses the shared mobile navigation`);
  assert.match(html, /<script src="\/assets\/js\/main\.js" defer><\/script>/, `${slug} loads the shared navigation script`);
  assert.match(html, new RegExp(`<a[^>]+href="/\\#${anchor}"[^>]*>${author}</a>`), `${slug} links its visible author to the expert profile`);
  assert.match(html, new RegExp(`<link rel="canonical" href="https://genai\\.by/publications/${slug}/">`), `${slug} has a self canonical`);
  assert.match(html, /"@type":"Article"/, `${slug} exposes Article structured data`);
  assert.match(html, /<meta property="og:type" content="article">/, `${slug} identifies itself as an article`);
  assert.match(html, new RegExp(`"name":"${author}"`), `${slug} exposes the assigned author in structured data`);
  assert.doesNotMatch(html, /Материал CENTURY|сторонний материал|isBasedOn/i, `${slug} has no external-material attribution`);
  assert.doesNotMatch(html, /Полезный файл|<h2[^>]*>Скачать|Применить это к своему проекту|century-ai\.by\/artifacts|<a[^>]*>Скачать<\/a>/i, `${slug} has no download or apply-to-project blocks`);
  assertSharedFooter(html, slug);
  assert.match(html, new RegExp(`"datePublished":"${expectedPublished[slug].replaceAll('+', '\\+')}"`), `${slug} exposes the shifted publication date`);
  assert.match(html, new RegExp(`<time datetime="${expectedPublished[slug].replaceAll('+', '\\+')}\">${visibleDate(expectedPublished[slug])}</time>`), `${slug} shows the publication date without a timezone shift`);
  assert.doesNotMatch(html, /dateModified|Обновлено|updated/i, `${slug} omits update dates`);
  assert.doesNotMatch(html, new RegExp(legacyBrand, 'i'), `${slug} contains no old brand or domain`);
  assert.doesNotMatch(html, /<form\b|mc\.yandex|googletagmanager|cloudflareinsights/i, `${slug} excludes source forms and analytics`);
  const visibleChars = stripMarkup(html).length;
  const compactArticle = slug.startsWith('knowledge-') || slug.startsWith('new-models') || slug.endsWith('generic-chatbot') || slug === 'ai-fundraising-nko';
  assert.ok(visibleChars > (compactArticle ? 1800 : 3500), `${slug} keeps the full article text`);
}

const jointArticle = await readFile(new URL('../publications/ai-fundraising-nko/index.html', import.meta.url), 'utf8');
assert.match(jointArticle, /<a[^>]+href="\/\#vadim"[^>]*>Вадим Владымцев<\/a>/, 'joint article links Vadim');
assert.match(jointArticle, /<a[^>]+href="\/\#vitaliy"[^>]*>Виталий Бахмат<\/a>/, 'joint article links Vitaliy');
assert.match(jointArticle, /"author":\[[^\]]*"name":"Вадим Владымцев"[^\]]*"name":"Виталий Бахмат"/, 'joint article exposes both authors in structured data');
assert.match(jointArticle, /31 августа 2026/, 'joint article shows 31 August 2026');
assert.match(jointArticle, /ИИ не заменит фандрайзера/, 'joint article keeps the supplied title and text');
for (const phrase of [
  'быстро разобрать условия грантового конкурса',
  'подготовить структуру и первый черновик заявки',
  'сформулировать или уточнить проблему',
  'найти повторы, логические пробелы и слабые места',
  'освободить время для более важных задач',
  '70% опрошенных гражданских проектов',
  'ИИ — это ассистент, а не автор проекта и не замена фандрайзеру',
  'персональные данные благополучателей, доноров и сотрудников',
  'условия конкретного грантодателя',
  'стратегию, экспертизу, отношения с донорами',
]) {
  assert.match(jointArticle, new RegExp(phrase), `joint article preserves: ${phrase}`);
}

const home = await readFile(new URL('../index.html', import.meta.url), 'utf8');
assert.ok((home.match(/href="publications\/"/g) || []).length >= 2, 'home navigation and footer link to publications');
assertSharedFooter(home, 'home');

const errorPage = await readFile(new URL('../404.html', import.meta.url), 'utf8');
assertSharedFooter(errorPage, '404 page');

const sitemap = await readFile(new URL('../sitemap.xml', import.meta.url), 'utf8');
assert.equal((sitemap.match(/<loc>/g) || []).length, 41, 'sitemap contains home, catalogue, and 39 articles');
for (const [slug, published] of Object.entries(expectedPublished)) {
  const escapedUrl = `https://genai.by/publications/${slug}/`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(sitemap, new RegExp(`<url>\\s*<loc>${escapedUrl}</loc>\\s*<lastmod>${published.slice(0, 10)}</lastmod>\\s*</url>`), `${slug} sitemap date matches publication date`);
}

const manifest = JSON.parse(await readFile(new URL('../publications/manifest.json', import.meta.url), 'utf8'));
assert.equal(manifest.length, 39, 'public manifest lists all publications');
for (const item of manifest) {
  assert.equal(item.published, expectedPublished[item.slug], `${item.slug} manifest date is shifted by one week`);
  assert.ok(!('modified' in item), `${item.slug} manifest omits modified date`);
  assert.ok(!('ident' in item), `${item.slug} manifest omits source numbering`);
  assert.ok(!('source_url' in item), `${item.slug} manifest omits source provenance`);
}
const jointManifest = manifest.find((item) => item.slug === 'ai-fundraising-nko');
assert.deepEqual(jointManifest.author_keys, ['vadim', 'vitaliy'], 'manifest records both authors');
for (const [slug, [, authorKey]] of Object.entries(expectedAuthors)) {
  const item = manifest.find((entry) => entry.slug === slug);
  if (slug !== 'ai-fundraising-nko') assert.equal(item.author_key, authorKey, `${slug} manifest keeps its assigned author`);
}

const newDates = [...newArchiveSlugs].map((slug) => expectedPublished[slug].slice(0, 10));
assert.equal(new Set(newDates).size, newDates.length, 'new publications use at most one publication per day');
assert.ok(newDates.every((date) => date >= '2026-08-01' && date <= '2026-09-08'), 'new publication dates stay within 1 August–8 September');

const belarusSlugs = [
  'software-development-cost-belarus',
  'how-to-choose-software-contractor',
  'software-requirements-acceptance-support',
];
for (const slug of belarusSlugs) {
  const html = await readFile(new URL(`../publications/${slug}/index.html`, import.meta.url), 'utf8');
  assert.match(html, /pravo\.by/, `${slug} links to Belarus legislation`);
  assert.match(html, /cpd\.by/, `${slug} links to the national personal data authority`);
  assert.doesNotMatch(html, /gov\.uk|cisa\.gov|iso\.org|atlassian\.com/, `${slug} does not use foreign policy sources`);
}
const belarusMarketArticle = await readFile(new URL('../publications/software-development-cost-belarus/index.html', import.meta.url), 'utf8');
assert.match(belarusMarketArticle, /belstat\.gov\.by/, 'Belarus market article links to official national statistics');

console.log('publications contract passed');
