import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const origin = 'https://genai.by';
const slugs = (await readdir(new URL('publications/', root), { withFileTypes: true }))
  .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
const routes = ['index.html', '404.html', 'publications/index.html',
  ...slugs.map((slug) => 'publications/' + slug + '/index.html')];
const paths = ['', 'be/'].flatMap((prefix) => routes.map((path) => prefix + path));
const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr']);
const decode = (value) => value
  .replace(/&#x([a-f\d]+);/gi, (_, number) => String.fromCodePoint(parseInt(number, 16)))
  .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
  .replace(/&(quot|apos|lt|gt|nbsp|amp);/g, (_, name) => ({
    quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', amp: '&',
  })[name]);
const text = (value) => value.replace(/\s+/g, ' ').trim();
const has = (node, attribute) => Object.hasOwn(node.attrs, attribute);
const route = (pathname) => pathname.replace(/\/index\.html$/, '/');

// Inspect document semantics without depending on CSS classes or declarations.
// Script/style bodies are excluded, so JSON-LD and code cannot create fake nodes.
function parse(html) {
  const document = { tag: '#document', attrs: {}, parent: null, text: '', index: -1 };
  const stack = [document];
  const nodes = [];
  const markup = html.replace(/<!--[\s\S]*?-->/g, '')
    .replace(/(<(script|style)\b[^>]*>)[\s\S]*?(<\/\2\s*>)/gi, '$1$3');
  for (const token of markup.match(/<[^>]*>|[^<]+/g) || []) {
    if (token.startsWith('</')) {
      const tag = token.match(/^<\/([\w:-]+)/)?.[1].toLowerCase();
      for (let index = stack.length - 1; index > 0; index -= 1) {
        if (stack[index].tag === tag) { stack.length = index; break; }
      }
    } else if (token.startsWith('<')) {
      const match = token.match(/^<([a-z][\w:-]*)\b([^>]*)>/i);
      if (!match) continue;
      const attrs = Object.fromEntries([...match[2].matchAll(
        /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>]+)))?/g,
      )].map((attribute) => [
        attribute[1].toLowerCase(), decode(attribute[2] ?? attribute[3] ?? attribute[4] ?? ''),
      ]));
      const node = { tag: match[1].toLowerCase(), attrs, parent: stack.at(-1),
        text: '', index: nodes.length };
      nodes.push(node);
      if (!voidTags.has(node.tag) && !token.endsWith('/>')) stack.push(node);
    } else {
      for (const node of stack) node.text += decode(token);
    }
  }
  return nodes;
}

const pages = await Promise.all(paths.map(async (path) => {
  const html = await readFile(new URL(path, root), 'utf8');
  const nodes = parse(html);
  return { path, nodes, url: new URL('/' + path.replace(/index\.html$/, ''), origin),
    ids: new Map(nodes.filter((node) => node.attrs.id).map((node) => [node.attrs.id, node])),
    home: path === 'index.html' || path === 'be/index.html',
    error: path === '404.html' || path === 'be/404.html' };
}));
const byRoute = new Map(pages.map((page) => [page.url.pathname, page]));
const inside = (node, ancestor) => {
  for (let current = node.parent; current; current = current.parent) {
    if (current === ancestor) return true;
  }
  return false;
};
const one = (nodes, message) => {
  assert.equal(nodes.length, 1, message);
  return nodes[0];
};
const label = (node, page) => text(node.attrs['aria-label'] || (
  node.attrs['aria-labelledby'] || ''
).split(/\s+/).filter(Boolean).map((id) => page.ids.get(id)?.text || '').join(' '));
const linkTarget = (node, page) => {
  const target = new URL(node.attrs.href, page.url);
  return route(target.pathname) + target.hash;
};

test('every page has a usable skip link, main landmark and primary heading', () => {
  for (const page of pages) {
    const main = one(page.nodes.filter((node) => node.tag === 'main'), page.path + ': one main');
    const h1 = one(page.nodes.filter((node) => node.tag === 'h1'), page.path + ': one H1');
    assert.ok(main.attrs.id, page.path + ': main is an anchor target');
    assert.ok(inside(h1, main) && text(h1.text), page.path + ': H1 belongs to the main content');
    for (const node of [main, h1]) {
      assert.ok(!has(node, 'hidden') && node.attrs['aria-hidden'] !== 'true',
        page.path + ': primary content is available to assistive technology');
    }
    const skip = one(page.nodes.filter((node) => node.tag === 'a' && node.attrs.href
      && node.index < main.index
      && new URL(node.attrs.href, page.url).origin === origin
      && linkTarget(node, page) === page.url.pathname + '#' + main.attrs.id),
    page.path + ': one skip link targets this page main');
    assert.ok(text(skip.text) || label(skip, page), page.path + ': skip link has an accessible name');
    const header = one(page.nodes.filter((node) => node.tag === 'header' && !inside(node, main)),
      page.path + ': one site header outside main');
    assert.ok(skip.index < header.index && header.index < main.index,
      page.path + ': skip link and site navigation precede the content');
  }
});

test('site navigation and mobile controls keep their semantic relationships', () => {
  for (const page of pages) {
    const main = page.nodes.find((node) => node.tag === 'main');
    const header = page.nodes.find((node) => node.tag === 'header' && !inside(node, main));
    const home = page.path.startsWith('be/') ? '/be/' : '/';
    const links = page.nodes.filter((node) => node.tag === 'a' && node.attrs.href && inside(node, header));
    assert.ok(links.some((node) => [home, home + '#top'].includes(linkTarget(node, page))),
      page.path + ': header links to the locale homepage');
    for (const nav of page.nodes.filter((node) => node.tag === 'nav' && inside(node, header))) {
      assert.ok(label(nav, page), page.path + ': navigation landmarks are labeled');
    }
    const toggles = page.nodes.filter((node) => has(node, 'data-menu-toggle'));
    const menus = page.nodes.filter((node) => has(node, 'data-mobile-menu'));
    if (page.error && toggles.length === 0 && menus.length === 0) continue;
    const toggle = one(toggles, page.path + ': one mobile menu control');
    const menu = one(menus, page.path + ': one mobile menu');
    assert.ok(inside(toggle, header) && inside(menu, header), page.path + ': menu belongs to the header');
    assert.equal(toggle.tag, 'button', page.path + ': menu control is a native button');
    assert.equal(toggle.attrs.type, 'button', page.path + ': menu control does not submit a form');
    assert.ok(label(toggle, page) || text(toggle.text), page.path + ': menu control has a name');
    assert.ok(menu.attrs.id && toggle.attrs['aria-controls'] === menu.attrs.id,
      page.path + ': aria-controls identifies the actual menu');
    assert.equal(toggle.attrs['aria-expanded'], 'false', page.path + ': menu starts collapsed');
    assert.ok(has(menu, 'hidden'), page.path + ': collapsed menu starts hidden');
    assert.ok(menu.tag === 'nav' || menu.attrs.role === 'navigation',
      page.path + ': mobile menu is a navigation landmark');
    const mobileTargets = new Set(page.nodes.filter((node) =>
      node.tag === 'a' && node.attrs.href && inside(node, menu)).map((node) => linkTarget(node, page)));
    const desktopNavs = page.nodes.filter((node) => node.tag === 'nav' && inside(node, header)
      && node !== menu && !has(node, 'data-language-switch'));
    const desktopTargets = new Set(page.nodes.filter((node) => node.tag === 'a' && node.attrs.href
      && desktopNavs.some((nav) => inside(node, nav))).map((node) => linkTarget(node, page)));
    for (const target of [home + '#experts', home + '#work', home + '#format', home + 'publications/']) {
      assert.ok(mobileTargets.has(target), page.path + ': mobile navigation reaches ' + target);
      assert.ok(desktopTargets.has(target), page.path + ': desktop navigation reaches ' + target);
    }
  }
});

test('document IDs, navigation anchors and ARIA references resolve in both locales', () => {
  for (const page of pages) {
    const identified = page.nodes.filter((node) => node.attrs.id);
    assert.equal(page.ids.size, identified.length, page.path + ': IDs are unique');
    for (const node of page.nodes) {
      for (const attribute of ['aria-controls', 'aria-labelledby', 'aria-describedby']) {
        for (const id of (node.attrs[attribute] || '').split(/\s+/).filter(Boolean)) {
          assert.ok(page.ids.has(id), page.path + ': ' + attribute + ' resolves #' + id);
        }
      }
      if (node.tag !== 'a' || !node.attrs.href) continue;
      const target = new URL(node.attrs.href, page.url);
      if (target.origin !== origin || !target.hash) continue;
      const destination = byRoute.get(route(target.pathname));
      assert.ok(destination, page.path + ': anchor destination exists at ' + target.pathname);
      const id = decodeURIComponent(target.hash.slice(1));
      assert.ok(destination.ids.has(id), page.path + ': anchor resolves ' + target.pathname + '#' + id);
    }
  }
});

test('both homepages introduce the experts before describing the work', () => {
  for (const page of pages.filter((item) => item.home)) {
    const main = page.nodes.find((node) => node.tag === 'main');
    const experts = page.ids.get('experts');
    const work = page.ids.get('work');
    assert.ok(experts && work && inside(experts, main) && inside(work, main),
      page.path + ': experts and work are part of main content');
    assert.ok(experts.index < work.index,
      page.path + ': experts precede work in DOM and reading order');
  }
});

test('homepage location metadata agrees with the public city and country', () => {
  for (const page of pages.filter((item) => item.home)) {
    const metadata = new Map(page.nodes.filter((node) => node.tag === 'meta')
      .map((node) => [node.attrs.name, node.attrs.content]));
    for (const key of ['geo.region', 'geo.placename']) {
      assert.ok(metadata.get(key)?.trim(), page.path + ': ' + key + ' is available to crawlers');
    }
    const body = page.nodes.find((node) => node.tag === 'body');
    assert.equal(metadata.get('geo.region'), 'BY-HM', page.path + ': primary location is Minsk, Belarus');
    assert.ok(text(body.text).includes(text(metadata.get('geo.placename'))),
      page.path + ': crawler city matches the visible location');
    assert.ok(!metadata.has('geo.address'), page.path + ': no unpublished street address is asserted');
    const geography = page.ids.get('geography');
    assert.ok(geography && /Беларус/.test(text(geography.text)),
      page.path + ': primary country is explained in visible content');
    const contact = page.ids.get('contact');
    assert.ok(contact, page.path + ': contact section remains addressable');
    assert.ok(!page.nodes.some((node) => node.tag === 'address' && inside(node, contact)),
      page.path + ': contact section does not render a physical address');
  }
});

test('page templates share existing resources and consistent versioned stylesheets', async () => {
  const commonStyles = ['/assets/css/fonts.css', '/assets/css/styles.css', '/assets/css/languages.css'];
  const versionedStyles = new Set(['/assets/css/styles.css', '/assets/css/languages.css',
    '/assets/css/publications.css']);
  const references = new Map();
  const files = new Set();
  for (const page of pages) {
    const resources = page.nodes.flatMap((node) => {
      if (node.tag === 'link' && (node.attrs.rel || '').split(/\s+/).includes('stylesheet')) {
        return [new URL(node.attrs.href, page.url)];
      }
      return node.tag === 'script' && node.attrs.src ? [new URL(node.attrs.src, page.url)] : [];
    }).filter((url) => url.origin === origin);
    const required = [...commonStyles, '/assets/js/main.js'];
    if (page.path.includes('publications/')) required.push('/assets/css/publications.css');
    if (page.error) required.push('/assets/js/404.js');
    for (const pathname of required) {
      assert.equal(resources.filter((url) => url.pathname === pathname).length, 1,
        page.path + ': loads one shared ' + pathname);
    }
    for (const resource of resources) {
      files.add(resource.pathname);
      if (versionedStyles.has(resource.pathname)) {
        assert.match(resource.searchParams.get('v') || '', /^[a-z\d][a-z\d._-]*$/i,
          page.path + ': stylesheet has a nonempty build version');
      }
      const previous = references.get(resource.pathname);
      if (previous !== undefined) {
        assert.equal(resource.search, previous,
          page.path + ': shared resource version agrees across templates and locales');
      } else references.set(resource.pathname, resource.search);
    }
  }
  await Promise.all([...files].map(async (pathname) => {
    await access(new URL('.' + pathname, root));
  }));
});
