import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, css] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../assets/css/styles.css', import.meta.url), 'utf8'),
]);

assert.match(css, /--header-clearance:\s*clamp\(/, 'a shared header clearance token keeps sticky content below the fixed header');
assert.match(css, /\.outcome-sticky\s*\{[^}]*top:\s*var\(--header-clearance\)/s, 'the zero card uses the shared header clearance');
assert.match(css, /\.outcome-item\s*\{[^}]*grid-template-columns:\s*clamp\(/s, 'outcome indexes scale with their cards');
assert.match(css, /\.process-step\s*\{[^}]*align-items:\s*start/s, 'process-card content starts on one baseline');
const processCopyRules = [...css.matchAll(/\.process-step\s*>\s*div\s*\{([^}]*)\}/g)];
assert.match(processCopyRules[0][1], /align-self:\s*start/, 'desktop process-card copy has one shared top edge');
assert.match(css, /\.site-footer\s*\{[^}]*padding:\s*clamp\(/s, 'footer spacing scales with the layout');
assert.doesNotMatch(html, /<address\b[^>]*class="contact-address"/, 'the contact address is not rendered in the page');
assert.match(html, /<meta name="geo\.address"/, 'geo data remains available to crawlers');
assert.match(html, /assets\/css\/styles\.css\?v=20260901-8/, 'the updated stylesheet is requested with a fresh cache key');

console.log('layout contract passed');
