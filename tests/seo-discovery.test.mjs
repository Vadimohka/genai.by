import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFile(join(root, path), 'utf8');
const slugs = (await readdir(join(root, 'publications'), { withFileTypes: true }))
  .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
const locales = ['', 'be/'];
const articlePaths = locales.flatMap((prefix) => slugs.map((slug) => `${prefix}publications/${slug}/index.html`));
const publicPaths = [...articlePaths, ...locales.flatMap((prefix) => [`${prefix}index.html`, `${prefix}publications/index.html`])];
const pages = new Map(await Promise.all(publicPaths.map(async (path) => [path, await read(path)])));
const decode = (value) => value.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([a-f\d]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replaceAll('&quot;', '"').replaceAll('&apos;', "'").replaceAll('&nbsp;', ' ')
  .replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
const plain = (html) => decode(html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/g, '')
  .replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const attrs = (tag) => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], decode(m[2])]));
const tags = (html, tag) => [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'g'))].map((m) => attrs(m[0]));
const graphs = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  .map((match) => JSON.parse(match[1]));
const nodes = (html) => graphs(html).flatMap((graph) => graph['@graph'] || []);
const walk = (value) => Array.isArray(value) ? value.flatMap(walk)
  : value && typeof value === 'object' ? [value, ...Object.values(value).flatMap(walk)] : [];
const officialSite = (url) => /^https:\/\/vadimohka\.ru\/?$/.test(url || '');
const articleBody = (html, path) => {
  const body = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/)?.[1];
  assert.ok(body, `${path}: static article body is present`);
  return body;
};

// These checks protect discoverability and user-requested facts, rather than
// freezing presentation choices or requiring speculative rich-result markup.
test('indexable pages stay crawlable and allow large image previews', async () => {
  const robots = await read('robots.txt');
  assert.match(robots, /User-agent:\s*\*\s+Allow:\s*\//i);
  assert.doesNotMatch(robots, /^\s*Disallow:\s*\/\s*$/im);
  assert.match(robots, /Sitemap:\s*https:\/\/genai\.by\/sitemap\.xml/);
  for (const [path, html] of pages) {
    const directives = tags(html, 'meta').filter((tag) => ['robots', 'googlebot', 'bingbot'].includes(tag.name?.toLowerCase()))
      .map((tag) => tag.content.toLowerCase());
    assert.ok(directives.length > 0, `${path}: crawler directives exist`);
    assert.ok(directives.every((value) => !/(?:^|[,\s])(?:noindex|nofollow|nosnippet|none)(?:$|[,\s])/.test(value)), `${path}: indexing and snippets remain allowed`);
    assert.ok(directives.some((value) => /max-image-preview:\s*large/.test(value)), `${path}: large previews are allowed`);
  }
});

test('public contact data and every Vadim author entity use the official .ru site', async () => {
  const discoveryPaths = locales.flatMap((prefix) => [`${prefix}ai.json`, `${prefix}llms.txt`, `${prefix}llms-full.txt`]);
  const content = [...pages, ...await Promise.all(discoveryPaths.map(async (path) => [path, await read(path)]))];
  for (const [path, value] of content) {
    assert.ok(!/vadimohka\.com|(?:t\.me|telegram\.me)\/vadimohka\b/i.test(value), `${path}: obsolete contact removed`);
  }
  for (const prefix of locales) {
    const path = `${prefix}index.html`;
    const html = pages.get(path);
    assert.ok(tags(html, 'a').filter((link) => officialSite(link.href)).length >= 2, `${path}: both expert card and contact link point to the site`);
  }
  for (const [path, html] of pages) {
    for (const person of graphs(html).flatMap(walk).filter((item) => item['@id']?.endsWith('#vadim') && item.name)) {
      assert.ok([person.url, ...(Array.isArray(person.sameAs) ? person.sameAs : [person.sameAs])].some(officialSite), `${path}: named Vadim entity has a verifiable official profile`);
    }
  }
});

test('machine-readable home facts match visible Belarus and Russia coverage', async () => {
  for (const prefix of locales) {
    const path = `${prefix}index.html`;
    const html = pages.get(path);
    const inline = graphs(html);
    const discovery = JSON.parse(await read(`${prefix}ai.json`));
    assert.deepEqual(discovery, inline.find((graph) => graph['@graph']?.some((node) => node['@type'] === 'Service')), `${prefix}ai.json mirrors the complete homepage graph`);
    const service = nodes(html).find((item) => item['@type'] === 'Service');
    assert.ok(service, `${path}: service is identified`);
    const countries = (Array.isArray(service.areaServed) ? service.areaServed : [service.areaServed]).map((item) => item?.name);
    assert.ok(countries.some((name) => /^(Беларусь|Белоруссия|Belarus)$/i.test(name)), `${path}: Belarus is served`);
    assert.ok(countries.some((name) => /^(Россия|Расія|Russia|Russian Federation)$/i.test(name)), `${path}: Russia is served`);
    assert.match(html, /\bid="geography"/, `${path}: visible geographic explanation is addressable`);
    const visible = plain(html);
    assert.match(visible, /Беларус/, `${path}: Belarus coverage is visible`);
    assert.match(visible, /Росси|Расі/, `${path}: Russia coverage is visible`);
  }
});

test('article authors and citations are supported by the visible publication', () => {
  for (const path of articlePaths) {
    const html = pages.get(path);
    const article = nodes(html).find((item) => item['@type'] === 'Article');
    assert.ok(article, `${path}: article metadata exists`);
    const visible = plain(html);
    const authors = Array.isArray(article.author) ? article.author : [article.author];
    assert.ok(authors.length > 0, `${path}: authors exist`);
    for (const author of authors) {
      assert.ok(author?.name && visible.includes(author.name), `${path}: author identity matches the visible byline`);
    }
    const sourceLinks = new Set(tags(articleBody(html, path), 'a').map((link) => link.href)
      .filter((href) => /^https?:\/\//.test(href || '') && !href.startsWith('https://genai.by/')));
    const citations = Array.isArray(article.citation) ? article.citation : article.citation ? [article.citation] : [];
    if (sourceLinks.size) assert.ok(citations.length > 0, `${path}: existing external sources are exposed as citations`);
    for (const citation of citations) {
      const url = typeof citation === 'string' ? citation : citation.url;
      assert.ok(sourceLinks.has(url), `${path}: citation is an actual visible source: ${url}`);
    }
  }
});

test('LLM exports are current and include real article text for both languages', async () => {
  const check = spawnSync('python3', ['scripts/build-discovery.py', '--check'], { cwd: root, encoding: 'utf8', timeout: 30000 });
  assert.equal(check.status, 0, check.stderr || check.stdout || check.error?.message || 'discovery check failed');
  // Ignore Markdown punctuation and link destinations when comparing content.
  const words = (value) => decode(value.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1'))
    .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  for (const prefix of locales) {
    const full = await read(`${prefix}llms-full.txt`);
    const normalized = words(full);
    const manifest = JSON.parse(await read(`${prefix}publications/manifest.json`));
    let bodyLength = 0;
    for (const item of manifest) {
      const path = `${prefix}publications/${item.slug}/index.html`;
      const html = pages.get(path);
      const body = articleBody(html, path);
      const canonical = tags(html, 'link').find((link) => link.rel === 'canonical')?.href;
      assert.ok(full.includes(canonical), `${path}: full export retains the canonical source URL`);
      assert.ok(normalized.includes(words(item.title)), `${path}: title is discoverable`);
      const paragraphs = [...body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map((match) => plain(match[1]));
      const opening = paragraphs.find((paragraph) => paragraph.length >= 80);
      assert.ok(opening, `${path}: substantive article paragraph exists`);
      const sample = words(opening).split(' ').slice(0, 20).join(' ');
      assert.ok(normalized.includes(sample), `${path}: full export contains the actual article body`);
      bodyLength += plain(body).length;
    }
    assert.ok(full.length > bodyLength * 0.7, `${prefix}llms-full.txt contains the corpus, not only titles and descriptions`);
  }
});
