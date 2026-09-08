import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, css, publicationCss] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../assets/css/styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../assets/css/publications.css', import.meta.url), 'utf8'),
]);

assert.match(css, /--header-clearance:\s*clamp\(/, 'a shared header clearance token keeps sticky content below the fixed header');
assert.match(css, /\.outcome-sticky\s*\{[^}]*top:\s*var\(--header-clearance\)/s, 'the zero card uses the shared header clearance');
assert.match(css, /\.outcome-item\s*\{[^}]*grid-template-columns:\s*clamp\(/s, 'outcome indexes scale with their cards');
assert.match(css, /\.process-step\s*\{[^}]*align-items:\s*start/s, 'process-card content starts on one baseline');
const processCopyRules = [...css.matchAll(/\.process-step\s*>\s*div\s*\{([^}]*)\}/g)];
assert.match(processCopyRules[0][1], /align-self:\s*start/, 'desktop process-card copy has one shared top edge');
assert.match(css, /\.site-footer\s*\{[^}]*padding:\s*clamp\(/s, 'footer spacing scales with the layout');
assert.match(css, /\.site-footer\s*\{[^}]*grid-template-areas:\s*"brand nav companies"\s*"meta meta meta"/s, 'footer has dedicated brand, navigation, companies and metadata areas');
assert.match(css, /\.footer-navigation\s*,\s*\.footer-companies\s*\{/, 'footer navigation and companies share the same stack layout');
assert.match(css, /\.footer-description\s*\{/, 'footer includes a concise practice description');
assert.match(css, /\.footer-company\s*\{/, 'company links have a dedicated footer treatment');
assert.match(css, /\.footer-navigation\s*\{[^}]*grid-template-columns:\s*repeat\(2,/s, 'footer navigation uses a compact two-column grid');
assert.doesNotMatch(css, /\.footer-navigation a,\s*\.footer-company\s*\{[^}]*font-size:\s*clamp\(0\.88rem, 0\.92vw, 1rem\)/s, 'footer links avoid oversized typography');
assert.match(publicationCss, /\.catalogue-hero\s*\{[^}]*margin:\s*0 auto/s, 'catalogue hero aligns to the shared container');
assert.match(publicationCss, /\.publication-shell\s*>\s*main\s*\{[^}]*padding-top:\s*var\(--header-clearance\)/s, 'publication content clears the shared floating header');
assert.doesNotMatch(publicationCss, /\.publication-header\b/, 'publication stylesheet does not define a separate header');
assert.doesNotMatch(publicationCss, /\.publication-footer\b/, 'publication stylesheet does not define a separate footer');
assert.doesNotMatch(html, /<address\b[^>]*class="contact-address"/, 'the contact address is not rendered in the page');
assert.match(html, /<meta name="geo\.address"/, 'geo data remains available to crawlers');
assert.match(html, /assets\/css\/styles\.css\?v=20260908-2/, 'the updated stylesheet is requested with a fresh cache key');

console.log('layout contract passed');
