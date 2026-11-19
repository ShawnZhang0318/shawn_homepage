// Original, deterministic layout. No reference-site code or image-generated states.
import { OriginalInk } from './original-ink.js';
export const PAGE = { width: 1054, height: 1493, left: 88, right: 1015, step: 56, first: 158 };
export const INK = { black: '#181b17', red: '#a73728', green: '#344a25', highlight: '#eda94c' };
const FAMILY = 'Caveat, WenKai';
// Only the expanded bullet description is new typography.
const DETAIL_FAMILY = 'Caveat, DetailHand';
// One size below the 37px name tier; only expanded description text uses this.
const DETAIL_SIZE = 36;

export function entries(content) {
  return [...content.companies.map((e, i) => ({ ...e, number: String(i + 3).padStart(2, '0'), section: 'Companies' })),
    ...content.projects.map((e, i) => ({ ...e, number: String(i + 5).padStart(2, '0'), section: 'Projects' }))];
}

export class PaperSurface {
  constructor(content, originalImage) {
    this.content = content;
    this.items = entries(content);
    this.selected = null;
    this.hovered = null;
    this.canvas = document.createElement('canvas');
    this.canvas.width = PAGE.width * 2;
    this.canvas.height = PAGE.height * 2;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.scale(2, 2);
    this.original = new OriginalInk(originalImage);
    this.background = this.makeBackground();
    this.draw();
  }
  makeBackground() {
    const c = document.createElement('canvas'); c.width = PAGE.width; c.height = PAGE.height;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#f4e9d7'; ctx.fillRect(0, 0, c.width, c.height);
    // Seeded fibres; only regenerated on construction, never flicker between selections.
    let seed = 170178;
    const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 42000; i++) {
      ctx.fillStyle = `rgba(${rand() > .5 ? '255,255,255' : '120,90,60'},${rand() * .045})`;
      ctx.fillRect(rand() * c.width, rand() * c.height, 1 + rand() * 5, 1 + rand() * 2);
    }
    const wash = ctx.createLinearGradient(0, 0, c.width, c.height);
    wash.addColorStop(0, '#ffffff08'); wash.addColorStop(.6, '#e4c9ae09'); wash.addColorStop(1, '#79533a0b');
    ctx.fillStyle = wash; ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = '#969aad60'; ctx.lineWidth = 1;
    for (let y = PAGE.first; y < c.height; y += PAGE.step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(c.width, y); ctx.stroke(); }
    ctx.strokeStyle = '#bd72566b'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(67, 0); ctx.lineTo(67, c.height); ctx.stroke();
    return c;
  }
  font(size, weight = 600) { return `${weight} ${size}px ${FAMILY}`; }
  text(value, x, y, size = 37, color = INK.black, weight = 600, maxWidth = null) {
    const ctx = this.ctx; ctx.save(); ctx.font = this.font(size, weight); ctx.fillStyle = color;
    // Use actual ink bounds: most glyphs rest on the rule; descenders pass below it.
    const descent = ctx.measureText('H国').actualBoundingBoxDescent || 0;
    ctx.textBaseline = 'alphabetic';
    if (maxWidth && ctx.measureText(value).width > maxWidth) {
      ctx.font = this.font(size * maxWidth / ctx.measureText(value).width, weight);
    }
    ctx.fillText(value, x, y - descent); ctx.restore();
  }
  wrap(text, width, size = DETAIL_SIZE) {
    const ctx = this.ctx; ctx.font = `600 ${size}px ${DETAIL_FAMILY}`;
    // Keep Latin words together, allow CJK breaks, avoid leading closing punctuation.
    const tokens = text.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*|\s+|./gu) || [];
    const lines = []; let line = '';
    for (const token of tokens) {
      if (line && ctx.measureText(line + token).width > width && !/^[，。；：、！？）》”]/u.test(token)) {
        lines.push(line.trimEnd()); line = token.trimStart();
      } else line += token;
    }
    if (line) lines.push(line.trimEnd()); return lines;
  }
  region(kind, x, y, w, h, id = null) { this.regions.push({ kind, x, y, w, h, id }); }
  circle(number, x, y, radius = 24) {
    const c = this.ctx; c.save(); c.strokeStyle = INK.red; c.lineWidth = 2.8;
    c.beginPath(); c.ellipse(x, y - 12, radius, radius * .77, -.1, 0, Math.PI * 2); c.stroke(); c.restore();
  }
  heading(label, y) { this.original.draw(this.ctx, label.toLowerCase(), y); }
  education(y, compact) {
    const start = y - 46;
    this.heading('Education', y); y += PAGE.step;
    this.original.draw(this.ctx, 'school1', y);
    y += PAGE.step; this.original.draw(this.ctx, 'msc', y);
    y += PAGE.step * (compact ? 1 : 2);
    this.original.draw(this.ctx, 'school2', y);
    y += PAGE.step; this.original.draw(this.ctx, 'bsc', y);
    y += PAGE.step; this.original.draw(this.ctx, 'technology', y);
    this.region('static', 70, start, 960, y - start + 18, 'education');
    return y + PAGE.step * 2;
  }
  list(section, y) {
    this.heading(section, y); this.region('static', 70, y - 48, 960, 56, section); y += PAGE.step;
    const items = this.items.filter(e => e.section === section);
    for (const item of items) {
      if (this.hovered === item.id) {
        const c = this.ctx; c.save(); c.fillStyle = INK.highlight; c.globalAlpha = .42;
        c.beginPath(); c.moveTo(77, y - 32); c.lineTo(1026, y - 35); c.lineTo(1020, y + 7); c.lineTo(81, y + 10); c.fill(); c.restore();
      }
      if (item.section === 'Companies') this.original.draw(this.ctx, item.id, y);
      else {
        this.text(item.number, 88, y);
        this.text(item.display_name, 166, y, 37, INK.black, 600, 540);
        this.text(item.dates, 730, y, 34, INK.green, 600, 285);
      }
      if (this.selected === item.id) {
        this.circle(item.number, 111, y);
        this.ctx.save(); this.ctx.strokeStyle = INK.red; this.ctx.lineWidth = 2;
        this.ctx.beginPath(); this.ctx.moveTo(165, y + 8);
        this.ctx.lineTo(Math.min(703, 166 + this.measure(item.display_name, 37)), y + 6); this.ctx.stroke(); this.ctx.restore();
      }
      this.region('item', 74, y - 43, 954, 55, item.id); y += PAGE.step;
    }
    if (section === 'Projects' && !items.length) {
      for (const n of ['05', '06', '07']) { this.original.draw(this.ctx, n, y); this.region('static', 70, y - 43, 960, 56, `project-${n}`); y += PAGE.step; }
    }
    return y + (section === 'Companies' ? PAGE.step : 0);
  }
  measure(text, size, weight = 600) { this.ctx.font = this.font(size, weight); return this.ctx.measureText(text).width; }
  detailText(value, x, y, size) {
    const ctx = this.ctx; ctx.save();
    ctx.font = `600 ${size}px ${DETAIL_FAMILY}`;
    ctx.textBaseline = 'alphabetic'; ctx.fillStyle = INK.black; ctx.strokeStyle = INK.black;
    // Keep the established handwriting weight and stroke treatment; only size changes.
    ctx.lineWidth = .45; ctx.lineJoin = 'round';
    const descent = ctx.measureText('H国').actualBoundingBoxDescent || 0;
    ctx.strokeText(value, x, y - descent); ctx.fillText(value, x, y - descent);
    ctx.restore();
  }
  detail(item, y) {
    const start = y - 50;
    if (item.section === 'Companies') {
      this.original.draw(this.ctx, `number-${item.id}`, y);
      this.original.draw(this.ctx, `name-${item.id}`, y);
      this.original.draw(this.ctx, `date-${item.id}`, y);
    } else {
      this.text(item.number, 88, y, 40, INK.red);
      this.text(item.display_name, 164, y, 49, INK.black, 650, 548);
      this.text(item.dates, 730, y, 30, INK.green, 600, 282);
    }
    this.circle(item.number, 111, y, 27);
    for (const bullet of item.bullets) {
      const lines = this.wrap(bullet, 830, DETAIL_SIZE);
      for (let i = 0; i < lines.length; i++) {
        y += PAGE.step; if (i === 0) this.text('·', 142, y, 30);
        this.detailText(lines[i], 166, y, DETAIL_SIZE);
      }
    }
    this.region('static', 72, start, 958, y - start + 15, 'detail');
    return y + PAGE.step * 2;
  }
  draw() {
    this.regions = []; this.ctx.clearRect(0, 0, PAGE.width, PAGE.height);
    if (!this.selected) {
      // The unexpanded sheet is the original uploaded artwork, without re-typesetting.
      this.ctx.drawImage(this.original.image, 0, 0, PAGE.width, PAGE.height);
      this.region('static', 70, 12, 970, 163, 'work');
      this.region('static', 70, 198, 970, 449, 'education');
      this.region('static', 70, 656, 970, 98, 'Companies');
      this.region('item', 74, 755, 965, 72, 'infiforce');
      this.region('item', 74, 828, 965, 73, 'agentic-intelligence-lab');
      this.region('static', 70, 932, 970, 82, 'Projects');
      ['05','06','07'].forEach((n,i) => this.region('static', 70, 1015+i*55, 970, 55, `project-${n}`));
      if (this.hovered) {
        const r = this.regions.find(r => r.id === this.hovered);
        if (r) { this.ctx.save(); this.ctx.globalCompositeOperation = 'multiply'; this.ctx.fillStyle = '#eda94c66'; this.ctx.fillRect(r.x, r.y+6, r.w, r.h-12); this.ctx.restore(); }
      }
      this.contentBottom = 1166; this.onchange?.(); return;
    }
    this.ctx.drawImage(this.background, 0, 0);
    this.original.draw(this.ctx, 'work', PAGE.first);
    this.region('static', 70, 20, 950, 155, 'work');
    let y = PAGE.first + PAGE.step;
    const item = this.items.find(e => e.id === this.selected);
    if (item) y = this.detail(item, y);
    y = this.education(y, !!item);
    y = this.list('Companies', y);
    y = this.list('Projects', y);
    this.contentBottom = y - PAGE.step;
    if (this.contentBottom > PAGE.height - 18) throw new Error(`Paper content overflow: ${this.contentBottom}`);
    this.onchange?.();
  }
  hit(x, y) { return this.regions.find(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) || null; }
  select(id) {
    if (!this.items.some(e => e.id === id) || this.selected === id) return false;
    const prior = this.selected; this.selected = id; this.hovered = null;
    try { this.draw(); } catch (error) { this.selected = prior; this.draw(); throw error; }
    return true;
  }
  hover(id) { if (this.hovered !== id) { this.hovered = id; this.draw(); } }
}
