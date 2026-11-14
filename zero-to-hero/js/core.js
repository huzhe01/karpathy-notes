/* Shared helpers: DOM/SVG builders, seeded RNG, theme-aware canvas, charts, step player */
(function () {
  const Z = (window.Z = {});
  const SVGNS = 'http://www.w3.org/2000/svg';

  function setA(e, a) {
    if (!a) return;
    for (const k in a) {
      const v = a[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.setAttribute('class', v);
      else if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') { for (const p in v) { if (p.startsWith('--')) e.style.setProperty(p, v[p]); else e.style[p] = v[p]; } }
      else e.setAttribute(k, v);
    }
  }
  function add(e, kids) {
    for (const k of kids.flat(3)) {
      if (k == null || k === false) continue;
      e.appendChild(typeof k === 'string' || typeof k === 'number' ? document.createTextNode(String(k)) : k);
    }
  }
  Z.$ = (s, r = document) => r.querySelector(s);
  Z.$$ = (s, r = document) => [...r.querySelectorAll(s)];
  Z.h = (tag, attrs, ...kids) => { const e = document.createElement(tag); setA(e, attrs); add(e, kids); return e; };
  Z.s = (tag, attrs, ...kids) => { const e = document.createElementNS(SVGNS, tag); setA(e, attrs); add(e, kids); return e; };
  Z.tok = (n) => getComputedStyle(document.documentElement).getPropertyValue('--' + n).trim();
  Z.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  Z.sleep = (ms) => new Promise((r) => setTimeout(r, Z.reduced ? 0 : ms));
  Z.frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  Z.clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  Z.rng = function (seed) {
    let a = seed >>> 0;
    const f = function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.randn = function () { let u = 0; while (u === 0) u = f(); const v = f(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    f.int = (n) => Math.floor(f() * n);
    return f;
  };
  Z.softmax = function (a, scale = 1) {
    let m = -Infinity; for (const x of a) if (x * scale > m) m = x * scale;
    const e = a.map((x) => (x * scale === -Infinity ? 0 : Math.exp(x * scale - m)));
    const s = e.reduce((p, c) => p + c, 0);
    return e.map((x) => x / s);
  };
  Z.fmt = (x, d = 2) => {
    if (x === Infinity) return '∞';
    if (x === -Infinity) return '−∞';
    if (Number.isNaN(x)) return 'NaN';
    return Number(x).toFixed(d).replace(/^-/, '−');
  };
  Z.mean = (a) => a.reduce((p, c) => p + c, 0) / a.length;
  Z.std = (a) => { const m = Z.mean(a); return Math.sqrt(a.reduce((p, c) => p + (c - m) * (c - m), 0) / a.length); };

  /* theme + resize hooks */
  const themeCbs = [];
  Z.onTheme = (fn) => themeCbs.push(fn);
  const fireTheme = () => themeCbs.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', fireTheme);
  new MutationObserver(fireTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const resizeCbs = [];
  Z.onResize = (fn) => resizeCbs.push(fn);
  let rt; let lastW = innerWidth;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (Math.abs(innerWidth - lastW) < 2) return; lastW = innerWidth; resizeCbs.forEach((f) => f()); }, 150); });

  /* HiDPI canvas that fills its parent's width */
  Z.canvas = function (parent, height) {
    const box = Z.h('div', { class: 'cv-box' });
    parent.appendChild(box);
    const cv = Z.h('canvas', { class: 'cv' });
    box.appendChild(cv);
    const o = { cv, box, ctx: cv.getContext('2d'), w: 0, h: 0, draw: null };
    o.fit = function () {
      const w = Math.max(220, box.clientWidth || parent.clientWidth || 320);
      const hh = typeof height === 'function' ? height(w) : height;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(w * dpr); cv.height = Math.round(hh * dpr);
      cv.style.width = w + 'px'; cv.style.height = hh + 'px';
      o.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      o.w = w; o.h = hh;
    };
    o.fit();
    Z.onResize(() => { o.fit(); o.draw && o.draw(); });
    Z.onTheme(() => o.draw && o.draw());
    return o;
  };

  const MONO = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';
  Z.MONO = MONO;
  Z.color = (name) => Z.tok(name) || name;

  /* line chart. cfg: {series:[{pts:[[x,y]], color, width, dash, label, dots}], x:[a,b], y:[a,b], xticks, yticks, xfmt, yfmt, xlabel, ylabel, hlines:[{y,label,color}], vlines:[{x,color,label}], pad} */
  Z.chart = function (c, cfg) {
    const { ctx, w, h } = c;
    ctx.clearRect(0, 0, w, h);
    const pad = Object.assign({ l: 46, r: 14, t: 12, b: 32 }, cfg.pad || {});
    const [x0, x1] = cfg.x, [y0, y1] = cfg.y;
    const X = (x) => pad.l + ((x - x0) / (x1 - x0 || 1)) * (w - pad.l - pad.r);
    const Y = (y) => pad.t + (1 - (y - y0) / (y1 - y0 || 1)) * (h - pad.t - pad.b);
    const ink = Z.color('ink'), muted = Z.color('muted'), rule = Z.color('rule');
    ctx.font = '11px ' + MONO; ctx.lineWidth = 1;
    const xt = cfg.xticks || [], yt = cfg.yticks || [];
    ctx.strokeStyle = rule; ctx.fillStyle = muted;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (const t of yt) { const y = Y(t); ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke(); ctx.fillText((cfg.yfmt || String)(t), pad.l - 6, y); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (const t of xt) { const x = X(t); ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, h - pad.b); ctx.stroke(); ctx.fillText((cfg.xfmt || String)(t), x, h - pad.b + 6); }
    ctx.strokeStyle = muted; ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, h - pad.b); ctx.lineTo(w - pad.r, h - pad.b); ctx.stroke();
    if (cfg.xlabel) { ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillStyle = muted; ctx.fillText(cfg.xlabel, w - pad.r, h - pad.b - 4); }
    if (cfg.ylabel) { ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = muted; ctx.fillText(cfg.ylabel, pad.l + 6, pad.t + 2); }
    ctx.save(); ctx.beginPath(); ctx.rect(pad.l, pad.t - 2, w - pad.l - pad.r, h - pad.t - pad.b + 4); ctx.clip();
    for (const hl of cfg.hlines || []) {
      const y = Y(hl.y); ctx.strokeStyle = Z.color(hl.color || 'muted'); ctx.setLineDash([4, 4]); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke(); ctx.setLineDash([]);
      if (hl.label) { ctx.fillStyle = Z.color(hl.color || 'muted'); ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(hl.label, w - pad.r - 4, y - 3); }
    }
    for (const vl of cfg.vlines || []) {
      const x = X(vl.x); ctx.strokeStyle = Z.color(vl.color || 'muted'); ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, h - pad.b); ctx.stroke(); ctx.setLineDash([]);
      if (vl.label) { ctx.fillStyle = Z.color(vl.color || 'muted'); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(vl.label, x + 4, pad.t + 2); }
    }
    for (const s of cfg.series || []) {
      if (!s.pts.length) continue;
      ctx.strokeStyle = Z.color(s.color || 'ink'); ctx.lineWidth = s.width || 1.6; ctx.setLineDash(s.dash || []);
      ctx.globalAlpha = s.alpha == null ? 1 : s.alpha;
      ctx.beginPath();
      let started = false;
      for (const [x, y] of s.pts) {
        if (!Number.isFinite(y)) { started = false; continue; }
        const px = X(x), py = Y(Z.clamp(y, y0 - (y1 - y0), y1 + (y1 - y0)));
        if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
      }
      ctx.stroke(); ctx.setLineDash([]);
      if (s.dots) { ctx.fillStyle = Z.color(s.color || 'ink'); for (const [x, y] of s.pts) { ctx.beginPath(); ctx.arc(X(x), Y(y), s.dots, 0, 7); ctx.fill(); } }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    if (cfg.legend) {
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; let lx = pad.l + 10, ly = pad.t + 10;
      for (const s of cfg.series) {
        if (!s.label) continue;
        ctx.strokeStyle = Z.color(s.color || 'ink'); ctx.lineWidth = 2; ctx.setLineDash(s.dash || []);
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 16, ly); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = ink; ctx.fillText(s.label, lx + 22, ly); ly += 16;
      }
    }
    return { X, Y, pad };
  };

  /* step player: spec {n, render(i), labels?, interval, autoplay} -> adds controls + narration */
  Z.player = function (fig, spec) {
    const controls = Z.h('div', { class: 'controls' });
    const counter = Z.h('span', { class: 'counter' });
    let i = 0, timer = null;
    const bReset = Z.h('button', { class: 'btn', type: 'button', title: '回到第一步', 'aria-label': '回到第一步' }, '⟲');
    const bPrev = Z.h('button', { class: 'btn', type: 'button', 'aria-label': '上一步' }, '◀ 上一步');
    const bPlay = Z.h('button', { class: 'btn primary', type: 'button' }, '▶ 播放');
    const bNext = Z.h('button', { class: 'btn', type: 'button', 'aria-label': '下一步' }, '下一步 ▶');
    controls.append(bReset, bPrev, bPlay, bNext, counter);
    const go = (k) => { i = Z.clamp(k, 0, spec.n - 1); counter.textContent = (i + 1) + ' / ' + spec.n; bPrev.disabled = i === 0; bNext.disabled = i === spec.n - 1; spec.render(i); };
    const stop = () => { clearInterval(timer); timer = null; bPlay.textContent = '▶ 播放'; };
    const play = () => {
      if (timer) return stop();
      if (i >= spec.n - 1) go(0);
      bPlay.textContent = '⏸ 暂停';
      timer = setInterval(() => { if (i >= spec.n - 1) return stop(); go(i + 1); }, Z.reduced ? 1200 : spec.interval || 1700);
    };
    bReset.onclick = () => { stop(); go(0); };
    bPrev.onclick = () => { stop(); go(i - 1); };
    bNext.onclick = () => { stop(); go(i + 1); };
    bPlay.onclick = play;
    (spec.controlsParent || fig).appendChild(controls);
    go(spec.start || 0);
    return { go, stop, get i() { return i; } };
  };

  Z.button = (label, onclick, cls) => Z.h('button', { class: 'btn' + (cls ? ' ' + cls : ''), type: 'button', onclick }, label);
  Z.slider = function (id, label, min, max, step, value, oninput, fmt) {
    const out = Z.h('output', { for: id, class: 'sl-val' });
    const inp = Z.h('input', { type: 'range', id, min, max, step, value });
    const wrap = Z.h('label', { class: 'slider', for: id }, Z.h('span', { class: 'sl-lab' }, label), inp, out);
    const upd = () => { const v = parseFloat(inp.value); out.textContent = fmt ? fmt(v) : v; oninput && oninput(v); };
    inp.addEventListener('input', upd);
    wrap.set = (v) => { inp.value = v; upd(); };
    wrap.value = () => parseFloat(inp.value);
    upd.silent = () => { out.textContent = fmt ? fmt(parseFloat(inp.value)) : inp.value; };
    upd.silent();
    wrap.fire = upd;
    return wrap;
  };
  Z.check = function (id, label, checked, onchange) {
    const inp = Z.h('input', { type: 'checkbox', id });
    inp.checked = !!checked;
    inp.addEventListener('change', () => onchange && onchange(inp.checked));
    const l = Z.h('label', { class: 'check', for: id }, inp, Z.h('span', null, label));
    l.input = inp;
    return l;
  };
  Z.seg = function (name, options, value, onchange) {
    const wrap = Z.h('div', { class: 'seg', role: 'radiogroup' });
    options.forEach(([v, lab], k) => {
      const id = name + '-' + k;
      const inp = Z.h('input', { type: 'radio', name, id, value: v });
      if (v === value) inp.checked = true;
      inp.addEventListener('change', () => inp.checked && onchange(v));
      wrap.append(inp, Z.h('label', { for: id }, lab));
    });
    return wrap;
  };

  /* draw a histogram as a line (like the lecture plots) */
  Z.histLine = function (vals, lo, hi, bins) {
    const c = new Array(bins).fill(0);
    for (const v of vals) { const k = Math.floor(((v - lo) / (hi - lo)) * bins); if (k >= 0 && k < bins) c[k]++; else if (k === bins) c[bins - 1]++; }
    return c.map((n, k) => [lo + ((k + 0.5) / bins) * (hi - lo), n / vals.length]);
  };

  /* run work in chunks so the UI keeps painting */
  Z.chunked = async function (total, per, fn, onChunk) {
    for (let k = 0; k < total; k += per) {
      for (let j = k; j < Math.min(total, k + per); j++) fn(j);
      onChunk && onChunk(Math.min(total, k + per));
      await Z.frame();
    }
  };

  /* timestamp links */
  Z.tsSeconds = (t) => t.split(':').map(Number).reduce((a, b) => a * 60 + b, 0);
  document.addEventListener('DOMContentLoaded', () => {
    Z.$$('a.ts').forEach((a) => {
      const sec = Z.$('section[data-video]', document) && a.closest('[data-video]');
      const vid = sec ? sec.getAttribute('data-video') : null;
      if (vid) { a.href = 'https://www.youtube.com/watch?v=' + vid + '&t=' + Z.tsSeconds(a.textContent.trim()) + 's'; a.target = '_blank'; a.rel = 'noopener'; a.title = '在 YouTube 打开这一刻'; }
    });
  });

  /* init registry: demos register, run on DOMContentLoaded */
  const inits = [];
  Z.demo = (id, fn) => inits.push([id, fn]);
  document.addEventListener('DOMContentLoaded', () => {
    for (const [id, fn] of inits) {
      const el = document.getElementById(id);
      if (!el) { console.warn('missing demo', id); continue; }
      try { fn(el); } catch (e) { console.error('demo failed', id, e); el.appendChild(Z.h('p', { class: 'err' }, '这个演示加载失败：' + e.message)); }
    }
  });
})();
