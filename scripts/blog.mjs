// Reads the Tistory RSS feed and draws the "최근 글" list as cards in the profile style:
//   assets/blog-head-{dark,light}.svg  +  assets/blog-{1..N}-{dark,light}.svg
// and rewrites the README block between <!-- BLOG-CARDS:START --> and <!-- BLOG-CARDS:END -->
// so every card links to its own post.     node scripts/blog.mjs [--fixture posts.json]
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';

const FEED = process.env.BLOG_FEED || 'https://ssirioops.tistory.com/rss';
const BLOG = FEED.replace(/\/rss\/?$/, '');
const MAX = +(process.env.BLOG_MAX || 5);
const T = {
  dark: { bg: '#0A0B0E', card: '#111216', line: '#22242B', ink: '#F2F3F5', muted: '#9A9DA6', accent: '#7D8CFF', soft: '#17191E' },
  light: { bg: '#FFFFFF', card: '#FFFFFF', line: '#E6E6EA', ink: '#0E0F12', muted: '#5C5E66', accent: '#2B47E8', soft: '#F3F3F5' }
};
const SANS = `Pretendard, 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', 'Noto Sans CJK KR', -apple-system, 'Segoe UI', sans-serif`;
const MONO = `'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unent = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim();
const tag = (xml, t) => { const m = xml.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)); return m ? unent(m[1]) : ''; };
// rough text width (no fonts on the runner): Hangul ≈ 1em, latin ≈ .56em
const wid = (s, px) => [...s].reduce((a, c) => a + (/[ᄀ-ᇿ㄰-㆏가-힣一-鿿]/.test(c) ? 1 : /[A-Z0-9]/.test(c) ? .62 : /\s/.test(c) ? .3 : .54) * px, 0);
const fit = (s, px, max) => { if (wid(s, px) <= max) return s; let t = s; while (t && wid(t + '…', px) > max) t = t.slice(0, -1); return t.trimEnd() + '…'; };
const ymd = d => { const x = new Date(d); return isNaN(x) ? '' : new Date(x.getTime() + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, '.'); };

async function posts() {
  const fx = process.argv.indexOf('--fixture');
  if (fx > 0) return JSON.parse(readFileSync(process.argv[fx + 1], 'utf8'));
  const r = await fetch(FEED, { headers: { Accept: 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5', 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' } });
  if (!r.ok) throw new Error(`RSS ${r.status} ${r.statusText}`);
  const xml = await r.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => ({ title: tag(m[1], 'title'), url: tag(m[1], 'link'), date: ymd(tag(m[1], 'pubDate')), category: tag(m[1], 'category') }))
    .filter(p => p.title && p.url).slice(0, MAX);
}

const W = 1280, frame = (t, H, body, label, css = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}"><style>text{font-family:${SANS}}.m{font-family:${MONO}}.up{opacity:0;animation:up .8s cubic-bezier(.2,.7,.2,1) forwards}@keyframes up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@media (prefers-reduced-motion:reduce){.up{animation:none;opacity:1}}${css}</style><rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="20" fill="${t.card}" stroke="${t.line}"/>${body}</svg>`;

function head(t, n) {
  const H = 176;
  return frame(t, H, `<g class="up"><rect x="64" y="70" width="28" height="1.5" fill="${t.accent}"/><text class="m" x="104" y="77" font-size="16" letter-spacing="2.9" fill="${t.accent}">06 · WRITING</text>
<text class="m" x="1216" y="77" font-size="15" letter-spacing="1.6" fill="${t.muted}" text-anchor="end">${esc(BLOG.replace(/^https?:\/\//, '').toUpperCase())} ↗</text>
<text x="62" y="140" font-size="50" font-weight="800" letter-spacing="-2" fill="${t.ink}">최근 글</text>
<text x="1216" y="138" font-size="18" fill="${t.muted}" text-anchor="end">기술 블로그의 새 글 ${n}개</text></g>`, '최근 글 — 기술 블로그');
}
function row(t, p, i) {
  const H = 124, title = fit(p.title, 28, 860);
  const sub = [p.category.split('/').map(s => s.trim()).filter(Boolean).join(' › '), 'Tistory'].filter(Boolean).join(' · ');
  return frame(t, H, `<g class="up" style="animation-delay:${.05 + i * .06}s">
<text class="m" x="64" y="56" font-size="15" letter-spacing="1.5" fill="${t.accent}">${String(i + 1).padStart(2, '0')}</text>
<text class="m" x="64" y="84" font-size="15" letter-spacing=".6" fill="${t.muted}">${esc(p.date)}</text>
<text x="230" y="60" font-size="28" font-weight="700" letter-spacing="-.9" fill="${t.ink}">${esc(title)}</text>
<text x="230" y="92" font-size="17" fill="${t.muted}">${esc(sub)}</text>
<circle cx="1186" cy="62" r="30" fill="${t.soft}" stroke="${t.line}"/><path d="M1178 70 L1194 54 M1182 54 H1194 V66" fill="none" stroke="${t.ink}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></g>`, `${p.date} ${p.title}`);
}

const list = await posts();
mkdirSync('assets', { recursive: true });
for (const th of ['dark', 'light']) {
  writeFileSync(`assets/blog-head-${th}.svg`, head(T[th], list.length));
  list.forEach((p, i) => writeFileSync(`assets/blog-${i + 1}-${th}.svg`, row(T[th], p, i)));
  for (let i = list.length + 1; i <= 10; i++) if (existsSync(`assets/blog-${i}-${th}.svg`)) unlinkSync(`assets/blog-${i}-${th}.svg`);
}
const pic = (n, alt, href) => `  <a href="${esc(href)}"><picture><source media="(prefers-color-scheme: dark)" srcset="./assets/${n}-dark.svg"><img src="./assets/${n}-light.svg" width="100%" alt="${esc(alt)}"></picture></a>`;
const block = ['<!-- BLOG-CARDS:START -->', '<p>', pic('blog-head', '최근 글 — 기술 블로그', BLOG), ...list.map((p, i) => pic(`blog-${i + 1}`, `${p.date} ${p.title}`, p.url)), '</p>', '<!-- BLOG-CARDS:END -->'].join('\n');
const md = readFileSync('README.md', 'utf8');
if (!/<!-- BLOG-CARDS:START -->[\s\S]*<!-- BLOG-CARDS:END -->/.test(md)) throw new Error('README에 BLOG-CARDS 표시가 없습니다');
writeFileSync('README.md', md.replace(/<!-- BLOG-CARDS:START -->[\s\S]*<!-- BLOG-CARDS:END -->/, block));
console.log(`${list.length} posts`, list.map(p => p.date + ' ' + p.title));
