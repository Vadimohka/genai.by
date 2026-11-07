import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFile(join(root, path), 'utf8');
const slugs = (await readdir(join(root, 'publications'), { withFileTypes: true }))
  .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
const paths = ['index.html', 'publications/index.html', ...slugs.map((slug) => `publications/${slug}/index.html`)];
const pairs = await Promise.all([...paths, '404.html'].map(async (path) => ({
  path, ru: await read(path), be: await read(`be/${path}`),
})));
const route = (path) => '/' + path.replace(/index\.html$/, '');
const decode = (text) => text.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([a-f\d]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replaceAll('&quot;', '"').replaceAll('&apos;', "'").replaceAll('&#x27;', "'")
  .replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
const text = (markup) => decode(markup.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const attrs = (tag) => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], decode(m[2])]));
const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'g'))].map((m) => attrs(m[0]));
const metadata = (html, key) => tags(html, 'meta').find((item) => item.name === key || item.property === key)?.content;
const data = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  .flatMap((match) => JSON.parse(match[1])['@graph'] || []);
const visible = (html) => text(html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/g, ''));

test('every public page has reciprocal language links and a self canonical', () => {
  assert.equal(paths.length, 42);
  for (const { path, ru, be } of pairs.filter((pair) => pair.path !== '404.html')) {
    for (const [locale, html] of [['ru', ru], ['be', be]]) {
      const own = `https://genai.by${locale === 'be' ? '/be' : ''}${route(path)}`;
      assert.ok(html.includes(`<html lang="${locale}-BY">`), path);
      assert.equal(tags(html, 'link').find((item) => item.rel === 'canonical')?.href, own);
      assert.equal(metadata(html, 'og:url'), own);
      assert.equal(metadata(html, 'og:locale'), `${locale}_BY`);
      assert.equal(metadata(html, 'og:locale:alternate'), locale === 'be' ? 'ru_BY' : 'be_BY');
      const alternates = tags(html, 'link').filter((item) => item.hreflang);
      assert.equal(alternates.length, 3);
      for (const [language, prefix] of [['ru-BY', ''], ['be-BY', '/be'], ['x-default', '']]) {
        assert.equal(alternates.find((item) => item.hreflang === language)?.href, `https://genai.by${prefix}${route(path)}`);
      }
      assert.equal((html.match(/<h1\b/g) || []).length, 1);
    }
    assert.notEqual(metadata(be, 'description'), metadata(ru, 'description'), path);
    assert.notEqual(be.match(/<title>([^<]+)<\/title>/)?.[1], ru.match(/<title>([^<]+)<\/title>/)?.[1], path);
  }
});

test('language controls remain available on every page including 404', () => {
  for (const { path, ru, be } of pairs) {
    for (const [locale, html] of [['ru', ru], ['be', be]]) {
      const switches = [...html.matchAll(/<nav class="language-switch"[^>]*>([\s\S]*?)<\/nav>/g)];
      assert.equal(switches.length, 1, path);
      const links = tags(switches[0][1], 'a');
      assert.equal(links.length, 2);
      assert.deepEqual(links.map((link) => link['data-language']), ['ru', 'be']);
      assert.equal(links[0].href, route(path));
      assert.equal(links[1].href, '/be' + route(path));
      assert.equal(links.filter((link) => link['aria-current'] === 'page').length, 1);
      assert.equal(links.find((link) => link['aria-current'] === 'page').lang, locale);
      assert.ok(links.every((link) => link['aria-label'] && link.hreflang));
      assert.ok(tags(html, 'link').some((link) => link.href?.startsWith('/assets/css/languages.css')));
    }
  }
});

test('translations preserve complete article structure, dates and source links', () => {
  const externalUrls = (value) => {
    if (typeof value === 'string') return /^https?:\/\//.test(value) && !value.startsWith('https://genai.by/') ? [value] : [];
    if (Array.isArray(value)) return value.flatMap(externalUrls);
    return value && typeof value === 'object' ? Object.values(value).flatMap(externalUrls) : [];
  };
  for (const { path, ru, be } of pairs.filter((pair) => pair.path.startsWith('publications/') && pair.path !== 'publications/index.html')) {
    const original = data(ru).find((item) => item['@type'] === 'Article');
    const translated = data(be).find((item) => item['@type'] === 'Article');
    assert.equal(translated.inLanguage, 'be-BY', path);
    assert.equal(translated.datePublished, original.datePublished, path);
    assert.equal(translated.headline, text(be.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1]), path);
    assert.equal(translated.description, metadata(be, 'description'), path);
    assert.equal(translated.mainEntityOfPage, 'https://genai.by/be' + route(path), path);
    assert.deepEqual(externalUrls(translated).sort(), externalUrls(original).sort(), path);
    for (const tag of ['h2', 'h3', 'p', 'table', 'tr', 'li', 'details']) {
      assert.equal(tags(be, tag).length, tags(ru, tag).length, `${path}: full ${tag} structure`);
    }
    const ids = (html) => [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]).sort();
    assert.deepEqual(ids(be), ids(ru), `${path}: section anchors`);
    assert.ok(visible(be).length >= visible(ru).length * 0.8, `${path}: full translated text`);
    assert.equal(tags(be, 'time')[0]?.datetime, tags(ru, 'time')[0]?.datetime, path);
    assert.doesNotMatch(be, /(?:января|февраля|июня|июля|августа|сентября|октября|ноября|декабря) 2026/, path);
  }
});

test('Belarusian navigation and all local resources resolve', async () => {
  const cache = new Map(pairs.flatMap(({ path, ru, be }) => [[path, ru], ['be/' + path, be]]));
  for (const { path, be } of pairs) {
    const current = new URL('https://genai.by/be' + route(path));
    for (const link of tags(be, 'a')) {
      if (!link.href) continue;
      const target = new URL(link.href, current);
      if (target.origin !== current.origin) continue;
      if (link['data-language'] !== 'ru') {
        assert.ok(target.pathname.startsWith('/be/'), `${path}: stays in Belarusian at ${link.href}`);
      }
      const file = target.pathname.slice(1) + (target.pathname.endsWith('/') ? 'index.html' : '');
      await access(join(root, file));
      if (target.hash) {
        const targetHtml = cache.get(file) || await read(file);
        const id = decodeURIComponent(target.hash.slice(1));
        assert.ok(targetHtml.includes(`id="${id}"`), `${path}: ${link.href} has an existing anchor`);
      }
    }
    const resources = [
      ...tags(be, 'link').filter((link) => !['alternate', 'canonical'].includes(link.rel)).map((link) => link.href),
      ...tags(be, 'script').map((tag) => tag.src),
      ...tags(be, 'img').map((tag) => tag.src),
      ...tags(be, 'img').flatMap((tag) => tag.srcset?.split(',').map((item) => item.trim().split(/\s+/)[0]) || []),
    ].filter(Boolean);
    for (const resource of resources) {
      const target = new URL(resource, current);
      if (target.origin === current.origin) await access(join(root, target.pathname.slice(1)));
    }
  }
});

test('catalogue, discovery files and sitemap cover both language versions', async () => {
  const manifest = JSON.parse(await read('be/publications/manifest.json'));
  const original = JSON.parse(await read('publications/manifest.json'));
  const catalogue = await read('be/publications/index.html');
  assert.equal(manifest.length, 40);
  assert.deepEqual(manifest.map((item) => item.slug), original.map((item) => item.slug));
  assert.equal((catalogue.match(/class="publication-card"/g) || []).length, 40);
  for (const item of manifest) {
    const article = data(await read(`be/publications/${item.slug}/index.html`)).find((entry) => entry['@type'] === 'Article');
    assert.equal(item.title, article.headline, item.slug);
    assert.equal(item.description, article.description, item.slug);
    assert.equal(item.published, article.datePublished, item.slug);
    assert.ok(decode(catalogue).includes(item.title), item.slug);
  }
  const sitemap = await read('sitemap.xml');
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.equal(new Set(urls).size, 84);
  for (const path of paths) {
    assert.ok(urls.includes('https://genai.by' + route(path)));
    assert.ok(urls.includes('https://genai.by/be' + route(path)));
  }
  assert.ok(!urls.some((url) => url.includes('404')));
  assert.match(await read('be/404.html'), /content="noindex, follow"/);
  assert.match(await read('404.html'), /src="\/assets\/js\/404.js"/);
  assert.match(await read('be/llms.txt'), /Мова і рэгіён: be-BY/);
  assert.match(await read('be/llms-full.txt'), /https:\/\/genai\.by\/be\/publications\//);
  assert.ok(JSON.parse(await read('be/ai.json'))['@graph'].length > 0);
  const app = JSON.parse(await read('be/site.webmanifest'));
  assert.equal(app.lang, 'be-BY');
  assert.equal(app.start_url, '/be/');
  for (const icon of app.icons) await access(join(root, icon.src.slice(1)));
});

test('mobile menu labels and language links follow the active locale and section', async () => {
  const script = await read('assets/js/main.js');
  for (const lang of ['ru-BY', 'be-BY']) {
    const listeners = new Map();
    const toggleListeners = new Map();
    const windowListeners = new Map();
    const attributes = new Map([['aria-expanded', 'false']]);
    const toggle = {
      setAttribute: (name, value) => attributes.set(name, value),
      getAttribute: (name) => attributes.get(name),
      addEventListener: (name, callback) => toggleListeners.set(name, callback),
      contains: () => false,
    };
    const menu = { hidden: true, querySelectorAll: () => [], contains: () => false };
    const links = [{ href: 'https://genai.by/' }, { href: 'https://genai.by/be/' }];
    const location = { hash: '#experts' };
    const document = {
      documentElement: { lang },
      querySelector: (selector) => selector === '[data-menu-toggle]' ? toggle : selector === '[data-mobile-menu]' ? menu : null,
      querySelectorAll: (selector) => selector === '[data-language-switch] a' ? links : [],
      addEventListener: (name, callback) => listeners.set(name, callback),
    };
    const window = {
      location,
      addEventListener: (name, callback) => windowListeners.set(name, callback),
      matchMedia: () => ({ matches: true }),
    };
    runInNewContext(script, { document, window, URL, Date });
    assert.deepEqual(links.map((link) => new URL(link.href).hash), ['#experts', '#experts']);
    toggleListeners.get('click')();
    assert.equal(menu.hidden, false);
    assert.equal(attributes.get('aria-expanded'), 'true');
    assert.equal(attributes.get('aria-label'), lang.startsWith('be') ? 'Закрыць меню' : 'Закрыть меню');
    listeners.get('keydown')({ key: 'Escape' });
    assert.equal(menu.hidden, true);
    assert.equal(attributes.get('aria-label'), lang.startsWith('be') ? 'Адкрыць меню' : 'Открыть меню');
    location.hash = '#contact';
    windowListeners.get('hashchange')();
    assert.deepEqual(links.map((link) => new URL(link.href).hash), ['#contact', '#contact']);
  }
});

test('unknown Belarusian URLs use localized 404 content without redirecting', async () => {
  const script = await read('assets/js/404.js');
  for (const pathname of ['/be/missing-page', '/missing-page']) {
    const element = (attributes, inSwitcher = false) => ({
      attributes: new Map(Object.entries(attributes)),
      dataset: { language: attributes['data-language'] },
      getAttribute(name) { return this.attributes.get(name); },
      setAttribute(name, value) { this.attributes.set(name, value); },
      removeAttribute(name) { this.attributes.delete(name); },
      closest: () => inSwitcher ? {} : null,
    });
    const links = ['/', '/#contact', '/publications/', 'https://century-ai.by/'].map((href) => element({ href }));
    const languageLinks = [
      element({ href: '/404.html', 'data-language': 'ru', 'aria-current': 'page' }, true),
      element({ href: '/be/404.html', 'data-language': 'be' }, true),
    ];
    const switcher = element({ 'aria-label': 'Язык сайта' });
    switcher.querySelectorAll = () => languageLinks;
    const manifest = element({ href: '/site.webmanifest' });
    const label = element({ 'aria-label': 'Навигация в подвале' });
    const nodes = ['Этой страницы', 'здесь нет', 'На главную'].map((textContent) => ({
      textContent, parentElement: { closest: () => null },
    }));
    const document = {
      documentElement: { lang: 'ru-BY' },
      title: 'Страница не найдена — CAIO / Практика',
      body: {},
      createTreeWalker: () => {
        let index = -1;
        return {
          nextNode() { index += 1; return index < nodes.length; },
          get currentNode() { return nodes[index]; },
        };
      },
      querySelector: (selector) => selector === '[data-language-switch]' ? switcher : manifest,
      querySelectorAll: (selector) => selector === 'a[href]' ? [...links, ...languageLinks] : [label],
    };
    const location = { pathname };
    runInNewContext(script, { document, window: { location }, NodeFilter: { SHOW_TEXT: 4 } });
    const localized = pathname.startsWith('/be/');
    assert.equal(document.documentElement.lang, localized ? 'be-BY' : 'ru-BY');
    assert.equal(document.title, localized ? 'Старонка не знойдзена — CAIO / Практыка' : 'Страница не найдена — CAIO / Практика');
    assert.deepEqual(nodes.map((node) => node.textContent), localized ? ['Гэтай старонкі', 'тут няма', 'На галоўную'] : ['Этой страницы', 'здесь нет', 'На главную']);
    assert.equal(links[0].getAttribute('href'), localized ? '/be/' : '/');
    assert.equal(links[1].getAttribute('href'), localized ? '/be/#contact' : '/#contact');
    assert.equal(links[2].getAttribute('href'), localized ? '/be/publications/' : '/publications/');
    assert.equal(links[3].getAttribute('href'), 'https://century-ai.by/');
    assert.equal(manifest.getAttribute('href'), localized ? '/be/site.webmanifest' : '/site.webmanifest');
    assert.equal(label.getAttribute('aria-label'), localized ? 'Навігацыя ўнізе старонкі' : 'Навигация в подвале');
    assert.equal(switcher.getAttribute('aria-label'), localized ? 'Мова сайта' : 'Язык сайта');
    assert.equal(languageLinks.find((link) => link.getAttribute('aria-current') === 'page').dataset.language, localized ? 'be' : 'ru');
    assert.equal(location.pathname, pathname);
  }
});
