// Generates profile/README.md and profile/assets/*.svg. Run: cd tools && npm i && npm run build
//
// GitHub strips CSS from READMEs and SVGs loaded through <img> cannot fetch webfonts or
// follow links. So all text is converted to JetBrains Mono outlines here, and every
// clickable item is its own image wrapped in an <a>.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import opentype from 'opentype.js'

const here = dirname(fileURLToPath(import.meta.url))
const profileDir = join(here, '..', 'profile')
const assetsDir = join(profileDir, 'assets')
const assetBase = 'https://raw.githubusercontent.com/vntechies/.github/main/profile/assets'
const site = 'https://vntechies.dev'

// ---------------------------------------------------------------- content

// Keep in step with heroStats in the blog's pages/index.js
const neofetch = [
  ['Học viên đã tham gia', '200+'],
  ['Tỷ lệ đỗ chứng chỉ', '95%'],
  ['Mentor đang hỗ trợ', '9+'],
  ['Lộ trình', 'AWS · DevOps · Data'],
  ['Lab', 'miễn phí, nền tảng riêng'],
]

const taglineLines = [
  'Kho tri thức, đào tạo',
  'và hướng nghiệp cho',
  'cộng đồng Cloud,',
  'DevOps và AI',
]
const tagline = taglineLines.join(' ')

// Same order and labels as headerNavLinks in the blog's data/Links.js
const nav = [
  { id: 'courses', label: 'Khoá học', href: '/courses', featured: true },
  { id: 'aws-paths', label: 'AWS Paths', href: '/aws-certification-paths' },
  { id: 'blog', label: 'Blog', href: '/blog' },
  { id: 'series', label: 'Series', href: '/series' },
  { id: 'career', label: 'Career Center', href: '/career' },
]

// Keep in step with heroCourseLinks in the blog's pages/index.js
const courses = [
  {
    slug: 'aws-saa-c03',
    title: 'Khoá học AWS Solution Architect',
    subtitle: 'Luyện thi & thực chiến AWS cùng chuyên gia',
    href: '/courses/aws/saa/gioi-thieu',
  },
  {
    slug: 'devops-vde-c01',
    title: 'Khoá học DevOps Engineer',
    subtitle: 'DevOps từ cơ bản đến nâng cao',
    href: '/courses/devops/gioi-thieu',
  },
  {
    slug: 'data-vdt-c01',
    title: 'Data Engineer Bootcamp',
    subtitle: 'Thực chiến cho Data Engineer',
    href: '/courses/data-engineer-bootcamp/gioi-thieu',
  },
  {
    slug: 'aws-dea-c01',
    title: 'AWS Certified Data Engineer – Associate',
    subtitle: '12 module, lab thực hành & luyện thi DEA-C01',
    href: '/courses/aws/dea/gioi-thieu',
  },
]

const socials = [
  { id: 'youtube', href: 'https://www.youtube.com/@vntechies' },
  { id: 'facebook', href: 'https://facebook.com/vntechies' },
  { id: 'discord', href: 'https://discord.com/invite/YecagKUqpS' },
  { id: 'linkedin', href: 'https://linkedin.com/company/vntechies' },
  { id: 'tiktok', href: 'https://www.tiktok.com/@vntechies' },
]

// ---------------------------------------------------------------- theme

// gruvbox-dark-hard, from the blog's lib/gruvbox-palette.js and css/tailwind.css
const ansi = [
  '#1d2021',
  '#cc241d',
  '#98971a',
  '#d79921',
  '#458588',
  '#b16286',
  '#689d6a',
  '#a89984',
  '#928374',
  '#fb4934',
  '#b8bb26',
  '#fabd2f',
  '#83a598',
  '#d3869b',
  '#8ec07c',
  '#ebdbb2',
]
const c = {
  bg: '#1d2021',
  bar: '#282828',
  line: '#3c3836',
  shadow: '#504945',
  fg: '#ebdbb2',
  muted: '#bdae93',
  subtle: '#a89984',
  orange: '#fe8019',
  yellow: '#fabd2f',
  green: '#b8bb26',
  aqua: '#8ec07c',
  blue: '#83a598',
  purple: '#d3869b',
}
// Course slugs cycle through these, as on the homepage
const hues = [c.orange, c.aqua, c.purple, c.blue]

// "VN" pixel logo, copied from the blog's components/home/HeroTerminal.js
const logo = ['X...X.X...X', 'X...X.XX..X', 'X...X.X.X.X', '.X.X..X..XX', '..X...X...X']

// ---------------------------------------------------------------- svg helpers

const fonts = {
  regular: opentype.loadSync(join(here, 'fonts/JetBrainsMono-Regular.ttf')),
  bold: opentype.loadSync(join(here, 'fonts/JetBrainsMono-Bold.ttf')),
}

const escapeXml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const measure = (str, size, weight = 'regular') => fonts[weight].getAdvanceWidth(str, size)

// Outlines one run of text. Fails the build rather than silently drawing .notdef boxes.
function text(str, x, y, { size = 16, fill = c.fg, weight = 'regular', anchor = 'start' } = {}) {
  const font = fonts[weight]
  const nfc = str.normalize('NFC')
  for (const ch of nfc) {
    if (font.charToGlyph(ch).index === 0) throw new Error(`No glyph for "${ch}" in "${str}"`)
  }
  const width = measure(nfc, size, weight)
  const left = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x
  const d = font
    .getPath(nfc, left, y, size, { kerning: false, features: { liga: false, rlig: false } })
    .toPathData(2)
  return `<path fill="${fill}" d="${d}"/>`
}

// Lays out [string, options] runs left to right and returns the markup and the end x
function runs(parts, x, y, shared = {}) {
  let cursor = x
  const out = parts.map(([str, options = {}]) => {
    const merged = { ...shared, ...options }
    const markup = str ? text(str, cursor, y, merged) : ''
    cursor += measure(str.normalize('NFC'), merged.size ?? 16, merged.weight)
    return markup
  })
  return { markup: out.join(''), end: cursor }
}

const rect = (x, y, w, h, fill) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`

const outline = (w, h, stroke) =>
  `<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" fill="none" stroke="${stroke}"/>`

const svg = (w, h, title, body, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${escapeXml(title)}"><title>${escapeXml(title)}</title>${defs}${body}</svg>\n`

// Window chrome from components/Terminal.js: bordered box, muted titlebar, three dots.
// The 4px hard shadow is --app-shadow-lg; it sits in the right and bottom margin.
function terminalFrame(w, h, title, { barHeight = 36, shadow = 4 } = {}) {
  const innerW = w - shadow
  const innerH = h - shadow
  const dots = [ansi[9], ansi[11], ansi[10]]
    .map((fill, i) => `<circle cx="${17 + i * 18}" cy="${barHeight / 2}" r="5.5" fill="${fill}"/>`)
    .join('')
  return [
    rect(shadow, shadow, innerW, innerH, c.shadow),
    rect(0, 0, innerW, innerH, c.bg),
    rect(0, 0, innerW, barHeight, c.bar),
    rect(0, barHeight, innerW, 1, c.line),
    dots,
    text(title, innerW / 2, barHeight / 2 + 4.5, { size: 13, fill: c.subtle, anchor: 'middle' }),
    outline(innerW, innerH, c.line),
  ].join('')
}

const prompt = (cwd, x, y, command, size = 17) =>
  runs(
    [
      [cwd, { fill: c.aqua }],
      [' $ ', { fill: c.green }],
      [command, { fill: c.fg }],
    ],
    x,
    y,
    { size }
  )

// ---------------------------------------------------------------- hero

function hero() {
  const W = 880
  const H = 450
  const size = 20
  const strip = 6
  const bar = 36
  const shadow = 4
  const innerW = W - shadow
  const pad = 28
  const top = strip + bar

  const paletteStrip = ansi
    .map((fill, i) => rect((i * innerW) / 16, 0, innerW / 16 + 0.5, strip, fill))
    .join('')

  const cell = 26
  const logoX = pad
  const logoY = top + 80
  const pixels = (offset, fill) =>
    logo
      .join('')
      .split('')
      .map((v, i) =>
        v === 'X'
          ? rect(
              logoX + (i % 11) * cell + offset,
              logoY + Math.floor(i / 11) * cell + offset,
              cell + 0.3,
              cell + 0.3,
              fill
            )
          : ''
      )
      .join('')

  const infoX = logoX + 11 * cell + 40
  const lineH = 31
  let y = top + 92

  const rows = []
  rows.push(
    runs(
      [
        ['học-viên', { fill: c.orange, weight: 'bold' }],
        ['@', { fill: c.subtle }],
        ['vntechies', { fill: c.orange, weight: 'bold' }],
      ],
      infoX,
      y,
      { size }
    ).markup
  )
  y += lineH - 5
  rows.push(text('─'.repeat(30), infoX, y, { size, fill: c.subtle }))
  y += lineH
  for (const [key, value] of neofetch) {
    rows.push(
      runs(
        [
          [`${key}:`, { fill: c.yellow, weight: 'bold' }],
          [` ${value}`, { fill: c.fg }],
        ],
        infoX,
        y,
        { size }
      ).markup
    )
    y += lineH
  }

  const swatch = { w: 40, h: 20 }
  const swatchY = y - 12
  const swatches = ansi
    .map((fill, i) =>
      rect(
        infoX + (i % 8) * swatch.w,
        swatchY + Math.floor(i / 8) * swatch.h,
        swatch.w + 0.3,
        swatch.h + 0.3,
        fill
      )
    )
    .join('')
  // ansi[0] is the terminal background, so without a rule the block looks notched
  const swatchRule = `<rect x="${infoX + 0.5}" y="${swatchY + 0.5}" width="${swatch.w * 8 - 1}" height="${swatch.h * 2 - 1}" fill="none" stroke="${c.shadow}"/>`

  const taglineY = logoY + 5 * cell + 42
  const taglineMarkup = taglineLines
    .map((line, i) => text(line, logoX, taglineY + i * 27, { size: 18, fill: c.muted }))
    .join('')

  const first = prompt('~/vntechies', pad, top + 42, '', size)
  const command = text('neofetch', first.end, top + 42, { size, fill: c.fg })
  const lastY = H - shadow - 24
  const last = prompt('~/vntechies', pad, lastY, '', size)

  // The base state is the finished frame and `backwards` fill only hides things during
  // the delay, so anything that ignores CSS animation still draws the full picture.
  const defs = `<defs><pattern id="g" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="12" cy="12" r="1" fill="${c.fg}" fill-opacity=".07"/></pattern><style>
.t{animation:t .7s steps(8) .3s backwards}
.a{animation:a .01s linear backwards}
.a1{animation-delay:1.1s}.a2{animation-delay:1.25s}.a3{animation-delay:1.4s}.a4{animation-delay:1.55s}.a5{animation-delay:1.7s}.a6{animation-delay:1.85s}.a7{animation-delay:2s}.a8{animation-delay:2.15s}.a9{animation-delay:2.3s}.a10{animation-delay:2.45s}
.c{animation:b 1.06s steps(1) infinite}
@keyframes t{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
@keyframes a{from{opacity:0}to{opacity:0}}
@keyframes b{0%,49%{opacity:1}50%,100%{opacity:0}}
@media (prefers-reduced-motion:reduce){.t,.a,.c{animation:none}}
</style></defs>`

  const frame = terminalFrame(W, H - strip, 'vntechies — zsh — 80×24', { barHeight: bar, shadow })
  const body = [
    `<g transform="translate(0 ${strip})">${frame}</g>`,
    paletteStrip,
    rect(1, top + 1, innerW - 2, H - shadow - top - 2, 'url(#g)'),
    first.markup,
    `<g class="t">${command}</g>`,
    `<g class="a a1">${pixels(6, ansi[1])}${pixels(0, c.orange)}</g>`,
    ...rows.map((row, i) => `<g class="a a${Math.min(i + 1, 7)}">${row}</g>`),
    `<g class="a a8">${swatches}${swatchRule}</g>`,
    `<g class="a a9">${taglineMarkup}</g>`,
    `<g class="a a10">${last.markup}<g class="c">${rect(last.end, lastY - 16, 12, 21, c.fg)}</g></g>`,
  ].join('')

  return svg(W, H, `VNTechies: ${tagline}`, body, defs)
}

// ---------------------------------------------------------------- tiles

const pageWidth = 880
const gap = 10

// Tiles in a row share the page width. The gap is baked into every tile but the last as
// transparent space, because README markup has no way to space inline images.
function tileRow(count) {
  const tile = (pageWidth - gap * (count - 1)) / count
  const isLast = (i) => i === count - 1
  return {
    tile,
    imageWidth: (i) => (isLast(i) ? tile : tile + gap),
    // Shaved on the last tile so rounding can never push it onto a new line
    percent: (i) =>
      `${(((isLast(i) ? tile : tile + gap) / pageWidth) * 100 - (isLast(i) ? 0.1 : 0)).toFixed(2)}%`,
  }
}
const navRow = tileRow(nav.length)
const courseRow = tileRow(2)
const socialRow = tileRow(socials.length)

function navTile({ label, featured }, index) {
  const H = 52
  const shadow = 4
  const innerW = navRow.tile - shadow
  const innerH = H - shadow
  const body = [
    rect(shadow, shadow, innerW, innerH, c.shadow),
    rect(0, 0, innerW, innerH, featured ? c.orange : c.bg),
    outline(innerW, innerH, featured ? c.orange : c.line),
    text(label, innerW / 2, innerH / 2 + 5.5, {
      size: 15,
      weight: 'bold',
      fill: featured ? c.bg : c.fg,
      anchor: 'middle',
    }),
  ].join('')
  return svg(navRow.imageWidth(index), H, label, body)
}

function sectionBar(command, right) {
  const W = pageWidth
  const H = 48
  const body = [
    rect(0, 0, W, H, c.bg),
    outline(W, H, c.line),
    prompt('~/vntechies', 18, 30, command, 16).markup,
    text(right, W - 18, 30, { size: 14, fill: c.subtle, anchor: 'end' }),
  ].join('')
  return svg(W, H, `${command}: ${right}`, body)
}

function courseCard({ slug, title, subtitle }, index) {
  const H = 176
  const pad = 20
  const body = [
    terminalFrame(courseRow.tile, H, '~/courses', { barHeight: 32 }),
    runs(
      [
        ['drwxr-xr-x ', { fill: c.subtle }],
        [`${slug}/`, { fill: hues[index % hues.length], weight: 'bold' }],
      ],
      pad,
      64,
      { size: 15 }
    ).markup,
    text(title, pad, 96, { size: 16, fill: c.fg, weight: 'bold' }),
    text(subtitle, pad, 120, { size: 14, fill: c.muted }),
    text('→ xem khoá học', pad, 150, { size: 14, fill: c.orange, weight: 'bold' }),
  ].join('')
  return svg(courseRow.imageWidth(index % 2), H, `${title}: ${subtitle}`, body)
}

function socialTile({ id }, index) {
  const W = socialRow.tile
  const H = 44
  const body = [
    rect(0, 0, W, H, c.bg),
    outline(W, H, c.line),
    text(`[${id}]`, W / 2, H / 2 + 5, {
      size: 14,
      fill: c.yellow,
      weight: 'bold',
      anchor: 'middle',
    }),
  ].join('')
  return svg(socialRow.imageWidth(index), H, id, body)
}

function paletteFooter() {
  const W = pageWidth
  const H = 10
  const body = ansi.map((fill, i) => rect((i * W) / 16, 0, W / 16 + 0.5, H, fill)).join('')
  return svg(W, H, 'Gruvbox palette', body)
}

// ---------------------------------------------------------------- output

mkdirSync(assetsDir, { recursive: true })
const write = (name, content) => writeFileSync(join(assetsDir, name), content)

write('hero.svg', hero())
write('section-courses.svg', sectionBar('ls -la ./courses', `total ${courses.length}`))
write('section-community.svg', sectionBar('cat ./community', 'tham gia cùng chúng tôi'))
write('palette.svg', paletteFooter())
nav.forEach((item, i) => write(`nav-${item.id}.svg`, navTile(item, i)))
courses.forEach((course, i) => write(`course-${course.slug}.svg`, courseCard(course, i)))
socials.forEach((social, i) => write(`social-${social.id}.svg`, socialTile(social, i)))

const img = (file, alt, width) =>
  `<img src="${assetBase}/${file}" alt="${escapeXml(alt)}" width="${width}">`
// No whitespace between tiles: inline images would otherwise pick up word gaps
const link = (href, image) => `<a href="${href}">${image}</a>`
const courseLink = (k, i) =>
  link(
    `${site}${k.href}`,
    img(`course-${k.slug}.svg`, `${k.title}: ${k.subtitle}`, courseRow.percent(i))
  )

const heroAlt = `VNTechies: ${tagline}. ${neofetch.map(([k, v]) => `${k}: ${v}`).join('. ')}.`

const readme = `<!-- Generated by tools/build.mjs. Edit that file, not this one. -->

<p align="center">
${link(site, img('hero.svg', heroAlt, '100%'))}
</p>

<p align="center">
${nav.map((n, i) => link(`${site}${n.href}`, img(`nav-${n.id}.svg`, n.label, navRow.percent(i)))).join('')}
</p>

<p align="center">
${img('section-courses.svg', 'Khoá học', '100%')}
</p>

<p align="center">
${courses.slice(0, 2).map(courseLink).join('')}
<br>
${courses.slice(2).map(courseLink).join('')}
</p>

<p align="center">
${img('section-community.svg', 'Cộng đồng', '100%')}
</p>

<p align="center">
${socials.map((s, i) => link(s.href, img(`social-${s.id}.svg`, s.id, socialRow.percent(i)))).join('')}
</p>

<p align="center">
${img('palette.svg', '', '100%')}
</p>
`

writeFileSync(join(profileDir, 'README.md'), readme)
console.log('Built profile/README.md and', nav.length + courses.length + socials.length + 4, 'SVGs')
