// Draws assets/activity-{dark,light}.svg from your GitHub data (GraphQL), in the same style as the other cards.
//   GH_TOKEN  — a personal access token (classic, scopes: repo, read:user) so private repos/contributions count.
//               Falls back to the workflow's GITHUB_TOKEN (public data only).
//   GH_LOGIN  — whose stats (defaults to the repository owner).
//   --placeholder : write a "waiting for the first run" card   --sample : made-up data for previews (labelled)
import { writeFileSync, mkdirSync } from 'node:fs';

const LOGIN = process.env.GH_LOGIN || process.env.GITHUB_REPOSITORY_OWNER || 'suman-kim';
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const MODE = process.argv.includes('--sample') ? 'sample' : process.argv.includes('--placeholder') ? 'placeholder' : 'live';

const T = {
  dark: { bg: '#0A0B0E', card: '#111216', line: '#22242B', ink: '#F2F3F5', muted: '#9A9DA6', accent: '#7D8CFF', soft: '#17191E', idea: '#FF7A3D', heat: ['#17191E', '#262C5C', '#3B4699', '#5A68D6', '#7D8CFF'] },
  light: { bg: '#FFFFFF', card: '#FFFFFF', line: '#E6E6EA', ink: '#0E0F12', muted: '#5C5E66', accent: '#2B47E8', soft: '#F3F3F5', idea: '#E2560F', heat: ['#F0F1F4', '#C9D0FB', '#93A2F5', '#5C74EE', '#2B47E8'] }
};
const SANS = `Pretendard, 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', 'Noto Sans CJK KR', -apple-system, 'Segoe UI', sans-serif`;
const MONO = `'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const fmt = n => n.toLocaleString('en-US');

async function fetchData() {
  const q = `query($login:String!){user(login:$login){
    contributionsCollection{totalCommitContributions totalPullRequestContributions totalIssueContributions restrictedContributionsCount
      contributionCalendar{totalContributions weeks{contributionDays{date contributionCount}}}}
    repositories(first:100,ownerAffiliations:OWNER,isFork:false,orderBy:{field:PUSHED_AT,direction:DESC}){
      nodes{languages(first:10,orderBy:{field:SIZE,direction:DESC}){edges{size node{name}}}}}}}`;
  const r = await fetch('https://api.github.com/graphql', { method: 'POST', headers: { Authorization: `bearer ${TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'profile-activity-card' }, body: JSON.stringify({ query: q, variables: { login: LOGIN } }) });
  const j = await r.json();
  if (!r.ok || j.errors) throw new Error('GitHub API: ' + JSON.stringify(j.errors || j));
  const u = j.data.user, cc = u.contributionsCollection;
  const days = cc.contributionCalendar.weeks.flatMap(w => w.contributionDays).map(d => ({ date: d.date, n: d.contributionCount }));
  const langs = {};
  for (const repo of u.repositories.nodes) for (const e of repo.languages.edges) langs[e.node.name] = (langs[e.node.name] || 0) + e.size;
  return { total: cc.contributionCalendar.totalContributions, commits: cc.totalCommitContributions + cc.restrictedContributionsCount, prs: cc.totalPullRequestContributions, days, langs };
}
function sampleData() {   // deterministic, obviously-fake numbers for the preview only
  let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const days = []; const end = new Date('2026-11-13T00:00:00Z');
  for (let i = 370; i >= 0; i--) { const d = new Date(end - i * 864e5); const busy = i < 12 ? 1 : d.getUTCDay() % 6 ? .78 : .35; days.push({ date: d.toISOString().slice(0, 10), n: rnd() < busy ? Math.floor(rnd() * rnd() * 14) + 1 : 0 }); }
  const total = days.reduce((a, d) => a + d.n, 0);
  return { total, commits: Math.round(total * .82), prs: 86, days, langs: { TypeScript: 52, Dart: 21, Java: 14, Python: 8, JavaScript: 5 } };
}
function streak(days) {
  let i = days.length - 1; if (days[i] && days[i].n === 0) i--;      // today may not have a contribution yet
  let n = 0; while (i >= 0 && days[i].n > 0) { n++; i--; } return n;
}

function card(t, d, mode, stamp) {
  const W = 1280, H = 520, o = [];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="GitHub 활동 — 최근 1년 기여 ${d ? fmt(d.total) : ''}">`);
  o.push(`<style>text{font-family:${SANS}}.m{font-family:${MONO}}.up{opacity:0;animation:up .9s cubic-bezier(.2,.7,.2,1) forwards}.cell{opacity:0;animation:in .5s ease forwards}@keyframes up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}@keyframes in{to{opacity:1}}@media (prefers-reduced-motion:reduce){.up,.cell{animation:none;opacity:1}}</style>`);
  o.push(`<defs><pattern id="grid" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M64 0H0V64" fill="none" stroke="${t.line}"/></pattern><linearGradient id="gf" x1="0" x2="1"><stop offset="0" stop-color="${t.bg}"/><stop offset=".22" stop-color="${t.bg}" stop-opacity="0"/><stop offset=".78" stop-color="${t.bg}" stop-opacity="0"/><stop offset="1" stop-color="${t.bg}"/></linearGradient><clipPath id="c"><rect width="${W}" height="${H}" rx="24"/></clipPath></defs>`);
  o.push(`<g clip-path="url(#c)"><rect width="${W}" height="${H}" fill="${t.bg}"/><rect width="${W}" height="${H}" fill="url(#grid)" opacity=".5"/><rect width="${W}" height="${H}" fill="url(#gf)"/></g><rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="23.5" fill="none" stroke="${t.line}"/>`);
  // header
  o.push(`<g class="up"><rect x="64" y="70" width="28" height="1.5" fill="${t.accent}"/><text class="m" x="104" y="77" font-size="16" letter-spacing="2.9" fill="${t.accent}">05 · ACTIVITY</text>`);
  o.push(`<text class="m" x="1216" y="77" font-size="15" letter-spacing="1.8" fill="${t.muted}" text-anchor="end">${esc(stamp)}</text>`);
  o.push(`<text x="62" y="144" font-size="50" font-weight="800" letter-spacing="-2" fill="${t.ink}">최근 1년의 기록</text></g>`);
  if (!d) {
    o.push(`<text x="64" y="300" font-size="22" fill="${t.muted}">GitHub Actions가 처음 실행되면 활동 통계가 여기에 그려집니다.</text></svg>`);
    return o.join('');
  }
  // stats column
  const stats = [[fmt(d.total), '기여'], [fmt(d.commits), '커밋'], [fmt(d.prs), 'Pull Request'], [d.streak + '일', '연속 기여']];
  stats.forEach(([n, l], i) => {
    const y = 210 + i * 70;
    o.push(`<g class="up" style="animation-delay:${.08 + i * .06}s"><rect x="64" y="${y}" width="250" height="1" fill="${t.line}"/>`);
    o.push(`<text x="64" y="${y + 48}" font-size="38" font-weight="800" letter-spacing="-1.4" fill="${t.ink}">${esc(n)}</text><text x="314" y="${y + 46}" font-size="18" fill="${t.muted}" text-anchor="end">${esc(l)}</text></g>`);
  });
  // heatmap — last 53 weeks, Sunday-first like GitHub
  const x0 = 368, y0 = 230, c = 13, g = 3, days = d.days.slice(-371);
  const first = new Date(days[0].date + 'T00:00:00Z').getUTCDay();
  const max = Math.max(1, ...days.map(x => x.n)), lvl = n => n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4));
  let lastMonth = -1;
  days.forEach((day, i) => {
    const k = i + first, wk = Math.floor(k / 7), dw = k % 7, x = x0 + wk * (c + g), y = y0 + dw * (c + g);
    if (x + c > 1216) return;
    const mo = +day.date.slice(5, 7);
    if (dw === 0 && mo !== lastMonth) { if (wk < 52) o.push(`<text class="m" x="${x}" y="${y0 - 14}" font-size="13" fill="${t.muted}">${mo}월</text>`); lastMonth = mo; }
    o.push(`<rect class="cell" style="animation-delay:${(.15 + wk * .012).toFixed(3)}s" x="${x}" y="${y}" width="${c}" height="${c}" rx="3" fill="${t.heat[lvl(day.n)]}"><title>${day.date}: ${day.n}</title></rect>`);
  });
  const ly = y0 + 7 * (c + g) + 22;
  const ce = 1216 - 36, cs = ce - (5 * 17 - 4);   // legend: 적음 ■■■■■ 많음
  t.heat.forEach((h, i) => o.push(`<rect x="${cs + i * 17}" y="${ly}" width="13" height="13" rx="3" fill="${h}"/>`));
  o.push(`<text class="m" x="${cs - 8}" y="${ly + 11}" font-size="13" fill="${t.muted}" text-anchor="end">적음</text><text class="m" x="1216" y="${ly + 11}" font-size="13" fill="${t.muted}" text-anchor="end">많음</text>`);
  // top languages
  const entries = Object.entries(d.langs).sort((a, b) => b[1] - a[1]), sum = entries.reduce((a, e) => a + e[1], 0) || 1;
  const top = entries.slice(0, 5), rest = entries.slice(5).reduce((a, e) => a + e[1], 0);
  if (rest) top.push(['기타', rest]);
  const by = 438, bw = 1216 - x0, ops = [1, .74, .52, .36, .24, .14];
  o.push(`<text class="m" x="${x0}" y="${by - 16}" font-size="13" letter-spacing="2.3" fill="${t.muted}">LANGUAGES</text>`);
  let bx = x0;
  top.forEach(([name, v], i) => { const w = Math.max(2, bw * v / sum - 3); o.push(`<rect x="${bx}" y="${by}" width="${w}" height="10" rx="5" fill="${t.accent}" opacity="${ops[i]}"/>`); bx += w + 3; });
  let lx = x0;
  top.forEach(([name, v], i) => {
    const pct = Math.round(v / sum * 1000) / 10, label = `${name} ${pct}%`;
    o.push(`<circle cx="${lx + 5}" cy="${by + 39}" r="5" fill="${t.accent}" opacity="${ops[i]}"/><text x="${lx + 16}" y="${by + 45}" font-size="16" fill="${t.ink}">${esc(name)} <tspan fill="${t.muted}">${pct}%</tspan></text>`);
    lx += 34 + label.length * 9.5;
  });
  if (mode === 'sample') o.push(`<text class="m" x="${W / 2}" y="${H / 2 + 40}" font-size="64" font-weight="700" fill="${t.idea}" opacity=".16" text-anchor="middle" transform="rotate(-8 ${W / 2} ${H / 2})">SAMPLE · 예시 데이터</text>`);
  o.push('</svg>');
  return o.join('');
}

const data = MODE === 'placeholder' ? null : MODE === 'sample' ? sampleData() : await fetchData();
if (data) data.streak = streak(data.days);
const kst = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, '.');
const stamp = MODE === 'placeholder' ? '첫 실행 대기 중' : `매일 자동 갱신 · ${kst}`;
mkdirSync('assets', { recursive: true });
for (const th of ['dark', 'light']) writeFileSync(`assets/activity-${th}.svg`, card(T[th], data, MODE, stamp));
console.log(MODE, data ? { total: data.total, commits: data.commits, prs: data.prs, streak: data.streak, langs: Object.keys(data.langs).length } : '');
