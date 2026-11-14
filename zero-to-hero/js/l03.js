/* Lecture 03 · makemore 2: MLP (Bengio 2003). A real char-level MLP trained in the browser. */
(function () {
  const { h, s, fmt } = Z;
  const C = window.CHARS, V = 27, ix = (ch) => C.indexOf(ch);

  /* dataset: block_size 3, split 80/10/10 by name */
  function buildData(block) {
    const r = Z.rng(42);
    const names = window.NAMES.slice();
    for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
    const n1 = Math.floor(0.8 * names.length), n2 = Math.floor(0.9 * names.length);
    const mk = (ws) => {
      const X = [], Y = [];
      for (const w of ws) { let ctx = new Array(block).fill(0); for (const ch of w + '.') { const k = ix(ch); X.push(...ctx); Y.push(k); ctx = ctx.slice(1).concat(k); } }
      return { X: Int32Array.from(X), Y: Int32Array.from(Y), n: Y.length };
    };
    return { tr: mk(names.slice(0, n1)), va: mk(names.slice(n1, n2)), te: mk(names.slice(n2)), block };
  }
  const DATA = buildData(3);
  Z.charData = DATA;

  class CharMLP {
    constructor(o = {}) {
      Object.assign(this, { D: 2, H: 100, blk: 3, init: 'naive', seed: 42 }, o);
      const { D, H, blk } = this, E = blk * D;
      this.E = E;
      const r = Z.rng(this.seed);
      const rn = (n, sc = 1) => Float64Array.from({ length: n }, () => r.randn() * sc);
      const fixed = this.init === 'fixed';
      this.P = {
        C: rn(V * D),
        W1: rn(E * H, fixed ? (5 / 3) / Math.sqrt(E) : 1),
        b1: rn(H, fixed ? 0.01 : 1),
        W2: rn(H * V, fixed ? 0.01 : 1),
        b2: fixed ? new Float64Array(V) : rn(V),
      };
      this.G = Object.fromEntries(Object.entries(this.P).map(([k, v]) => [k, new Float64Array(v.length)]));
      this.nparams = Object.values(this.P).reduce((a, v) => a + v.length, 0);
    }
    forward(X, Y, B, off = 0, keep = true) {
      const { D, H, blk, E, P } = this;
      const emb = new Float64Array(B * E), hid = new Float64Array(B * H), probs = new Float64Array(B * V);
      for (let b = 0; b < B; b++) for (let j = 0; j < blk; j++) { const c = X[(off + b) * blk + j]; for (let k = 0; k < D; k++) emb[b * E + j * D + k] = P.C[c * D + k]; }
      for (let b = 0; b < B; b++) {
        const hrow = b * H;
        for (let q = 0; q < H; q++) hid[hrow + q] = P.b1[q];
        for (let i = 0; i < E; i++) { const e = emb[b * E + i], wr = i * H; for (let q = 0; q < H; q++) hid[hrow + q] += e * P.W1[wr + q]; }
      }
      const pre = keep ? hid.slice() : null;
      for (let t = 0; t < B * H; t++) hid[t] = Math.tanh(hid[t]);
      let loss = 0;
      for (let b = 0; b < B; b++) {
        const pr = b * V;
        for (let v = 0; v < V; v++) probs[pr + v] = P.b2[v];
        for (let q = 0; q < H; q++) { const hv = hid[b * H + q], wr = q * V; if (hv === 0) continue; for (let v = 0; v < V; v++) probs[pr + v] += hv * P.W2[wr + v]; }
        let m = -Infinity; for (let v = 0; v < V; v++) m = Math.max(m, probs[pr + v]);
        let z = 0; for (let v = 0; v < V; v++) { probs[pr + v] = Math.exp(probs[pr + v] - m); z += probs[pr + v]; }
        for (let v = 0; v < V; v++) probs[pr + v] /= z;
        if (Y) loss -= Math.log(probs[pr + Y[off + b]]);
      }
      loss /= B;
      if (keep) this.cache = { X, Y, B, off, emb, hid, pre, probs };
      return loss;
    }
    backward() {
      const { D, H, blk, E, P, G } = this, { X, Y, B, off, emb, hid, probs } = this.cache;
      for (const g of Object.values(G)) g.fill(0);
      const dl = probs.slice();
      for (let b = 0; b < B; b++) dl[b * V + Y[off + b]] -= 1;
      for (let t = 0; t < dl.length; t++) dl[t] /= B;
      const dpre = new Float64Array(B * H);
      for (let b = 0; b < B; b++) {
        for (let v = 0; v < V; v++) G.b2[v] += dl[b * V + v];
        for (let q = 0; q < H; q++) {
          const hv = hid[b * H + q], wr = q * V; let dh = 0;
          for (let v = 0; v < V; v++) { const d = dl[b * V + v]; G.W2[wr + v] += hv * d; dh += d * P.W2[wr + v]; }
          dpre[b * H + q] = dh * (1 - hv * hv);
        }
      }
      for (let b = 0; b < B; b++) {
        for (let q = 0; q < H; q++) G.b1[q] += dpre[b * H + q];
        for (let i = 0; i < E; i++) {
          const e = emb[b * E + i], wr = i * H; let de = 0;
          for (let q = 0; q < H; q++) { const d = dpre[b * H + q]; G.W1[wr + q] += e * d; de += d * P.W1[wr + q]; }
          const j = Math.floor(i / D), k = i % D, c = X[(off + b) * blk + j];
          G.C[c * D + k] += de;
        }
      }
    }
    update(lr) { for (const k in this.P) { const p = this.P[k], g = this.G[k]; for (let i = 0; i < p.length; i++) p[i] -= lr * g[i]; } }
    trainStep(data, lr, r, B = 32) {
      const Xb = new Int32Array(B * this.blk), Yb = new Int32Array(B);
      for (let b = 0; b < B; b++) { const k = Math.floor(r() * data.n); Yb[b] = data.Y[k]; for (let j = 0; j < this.blk; j++) Xb[b * this.blk + j] = data.X[k * this.blk + j]; }
      const loss = this.forward(Xb, Yb, B);
      this.backward(); this.update(lr);
      return loss;
    }
    evalLoss(data) { let tot = 0; for (let o = 0; o < data.n; o += 512) { const B = Math.min(512, data.n - o); tot += this.forward(data.X, data.Y, B, o, false) * B; } return tot / data.n; }
    sample(r) {
      let ctx = new Int32Array(this.blk), out = '';
      for (let t = 0; t < 20; t++) {
        this.forward(ctx, null, 1, 0, true);
        const p = this.cache.probs; let u = r(), acc = 0, k = 0;
        for (; k < V; k++) { acc += p[k]; if (u < acc) break; }
        if (k >= V) k = 0;
        if (k === 0) break;
        out += C[k]; ctx = Int32Array.from([...ctx.slice(1), k]);
      }
      return out;
    }
  }
  Z.CharMLP = CharMLP;

  /* ---------- 3a: building the dataset with a sliding window ---------- */
  Z.demo('d-window', (fig) => {
    const body = fig.querySelector('.demo-body');
    const word = 'emma', blk = 3;
    const rows = [];
    let ctx = '...';
    for (const ch of word + '.') { rows.push([ctx, ch]); ctx = ctx.slice(1) + ch; }
    const tape = h('div', { class: 'tape big' });
    const list = h('div', { class: 'win-list' });
    body.append(tape, list, h('p', { class: 'hint' }, `block_size = ${blk}：上下文窗口里放 3 个字符，开头不足的用 “.” 补齐。一个名字展开成 ${rows.length} 个训练样本。`));
    const full = '...' + word + '.';
    function render(i) {
      tape.innerHTML = '';
      [...full].forEach((ch, k) => tape.appendChild(h('span', { class: 'tch' + (k >= i && k < i + blk ? ' ctx' : '') + (k === i + blk ? ' tgt' : '') }, ch)));
      list.innerHTML = '';
      rows.forEach(([a, b], k) => list.appendChild(h('div', { class: 'win-row' + (k === i ? ' on' : '') + (k > i ? ' later' : '') },
        h('code', null, a), h('span', { class: 'arrow' }, '→'), h('code', { class: 't-bwd' }, b),
        h('span', { class: 'muted' }, `  X = [${[...a].map(ix).join(', ')}]   Y = ${ix(b)}`))));
    }
    Z.player(fig, { n: rows.length, render, controlsParent: fig.querySelector('.controls-slot'), interval: 1300, start: rows.length - 1 });
  });

  /* ---------- 3b: architecture walk (Bengio et al. 2003, char version) ---------- */
  Z.demo('d-arch', (fig) => {
    const body = fig.querySelector('.demo-body');
    const sc = h('div', { class: 'scroll-x' });
    const svg = s('svg', { viewBox: '0 0 820 300', class: 'arch', role: 'img', 'aria-label': 'MLP 语言模型结构：查表、拼接、隐藏层、输出层、softmax' });
    svg.style.minWidth = '680px';
    sc.appendChild(svg); body.appendChild(sc);
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' }); body.appendChild(narr);
    const g = (cls) => { const e = s('g', { class: 'stage ' + cls }); svg.appendChild(e); return e; };
    const ctx = ['e', 'm', 'm'];
    // inputs
    const gin = g('st0');
    ctx.forEach((ch, k) => { gin.appendChild(s('rect', { x: 14, y: 70 + k * 56, width: 34, height: 34, rx: 4, class: 'tokbox' })); gin.appendChild(s('text', { x: 31, y: 92 + k * 56, 'text-anchor': 'middle', class: 'tok' }, ch)); gin.appendChild(s('text', { x: 31, y: 120 + k * 56, 'text-anchor': 'middle', class: 'lab tiny' }, 'ix ' + ix(ch))); });
    gin.appendChild(s('text', { x: 31, y: 52, 'text-anchor': 'middle', class: 'lab' }, 'X'));
    gin.appendChild(s('text', { x: 31, y: 255, 'text-anchor': 'middle', class: 'shape' }, '[32, 3]'));
    // C table
    const gC = g('st1');
    for (let i = 0; i < V; i++) { const on = ctx.map(ix).includes(i); gC.appendChild(s('rect', { x: 100, y: 30 + i * 8, width: 40, height: 7, class: 'crow' + (on ? ' on' : '') })); }
    gC.appendChild(s('text', { x: 120, y: 22, 'text-anchor': 'middle', class: 'lab' }, 'C  [27, 2]'));
    ctx.forEach((ch, k) => gC.appendChild(s('path', { d: `M48,${87 + k * 56} C75,${87 + k * 56} 75,${33 + ix(ch) * 8} 100,${33 + ix(ch) * 8}`, class: 'edge thin' })));
    gC.appendChild(s('text', { x: 120, y: 268, 'text-anchor': 'middle', class: 'shape' }, 'C[X] → [32, 3, 2]'));
    // concat
    const gcat = g('st2');
    for (let k = 0; k < 6; k++) gcat.appendChild(s('rect', { x: 200, y: 75 + k * 22, width: 26, height: 18, class: 'vec v' + Math.floor(k / 2) }));
    gcat.appendChild(s('text', { x: 213, y: 62, 'text-anchor': 'middle', class: 'lab' }, '拼接'));
    gcat.appendChild(s('text', { x: 213, y: 230, 'text-anchor': 'middle', class: 'shape' }, '.view(-1, 6)'));
    gcat.appendChild(s('text', { x: 213, y: 246, 'text-anchor': 'middle', class: 'shape' }, '[32, 6]'));
    // hidden
    const ghid = g('st3');
    for (let k = 0; k < 12; k++) ghid.appendChild(s('circle', { cx: 330, cy: 40 + k * 17, r: 6.5, class: 'hn' }));
    ghid.appendChild(s('text', { x: 330, y: 255, 'text-anchor': 'middle', class: 'lab tiny' }, '… 共 100 个'));
    ghid.appendChild(s('text', { x: 330, y: 24, 'text-anchor': 'middle', class: 'lab' }, 'tanh(emb @ W1 + b1)'));
    ghid.appendChild(s('text', { x: 330, y: 272, 'text-anchor': 'middle', class: 'shape' }, '[32, 100]'));
    for (let k = 0; k < 6; k++) for (let q = 0; q < 12; q += 3) ghid.appendChild(s('line', { x1: 226, y1: 84 + k * 22, x2: 323, y2: 40 + q * 17, class: 'edge thin' }));
    // logits
    const glog = g('st4');
    const rr = Z.rng(7), lg = Array.from({ length: V }, () => rr.randn());
    lg[1] += 2.6; // 'a' is the next char of "emma"
    const mx = Math.max(...lg.map(Math.abs));
    for (let i = 0; i < V; i++) glog.appendChild(s('rect', { x: 470, y: 30 + i * 8, width: 6 + (Math.abs(lg[i]) / mx) * 50, height: 6.5, class: 'lbar' + (lg[i] < 0 ? ' neg' : '') }));
    glog.appendChild(s('text', { x: 490, y: 22, 'text-anchor': 'middle', class: 'lab' }, 'logits = h @ W2 + b2'));
    glog.appendChild(s('text', { x: 500, y: 268, 'text-anchor': 'middle', class: 'shape' }, '[32, 27]'));
    for (let q = 0; q < 12; q += 2) glog.appendChild(s('line', { x1: 337, y1: 40 + q * 17, x2: 468, y2: 40 + q * 19, class: 'edge thin' }));
    // softmax
    const gsm = g('st5');
    const pr = Z.softmax(lg);
    const pm = Math.max(...pr);
    for (let i = 0; i < V; i++) {
      gsm.appendChild(s('rect', { x: 640, y: 30 + i * 8, width: 2 + (pr[i] / pm) * 90, height: 6.5, class: 'pbar2' + (i === 1 ? ' tgt' : '') }));
      if (i === 1) gsm.appendChild(s('text', { x: 740, y: 37 + i * 8, class: 'lab t-bwd' }, `P(“a”) = ${fmt(pr[i], 2)}`));
    }
    gsm.appendChild(s('text', { x: 690, y: 22, 'text-anchor': 'middle', class: 'lab' }, 'softmax'));
    gsm.appendChild(s('text', { x: 690, y: 268, 'text-anchor': 'middle', class: 'shape' }, 'F.cross_entropy(logits, Y)'));
    const says = [
      '输入是 3 个字符的索引。整个 batch 有 32 个样本，所以 X 的形状是 [32, 3]。',
      '查表：C 是 27×2 的嵌入矩阵，每个字符对应一行 2 维向量。<code>C[X]</code> 一次性查出所有样本的嵌入，形状 [32, 3, 2]。他指出这和 one-hot 乘 C 是同一件事，只是更快。',
      '把三个 2 维向量拼成一个 6 维向量。他比较了 <code>torch.cat</code> 和 <code>view</code>：view 只改张量的 stride 等元数据，不复制内存，所以更高效。',
      '隐藏层：6 → 100，过 tanh。100 是一个可以随便调的超参数。',
      '输出层：100 → 27，得到每个候选字符的 logits。',
      '最后用 <code>F.cross_entropy</code>。他给了三个理由：前向和反向都更高效（融合计算）、反向公式更简单、数值稳定（内部先减去最大 logit，防止 exp 溢出）。',
    ];
    const stages = Z.$$('.stage', svg);
    Z.player(fig, { n: says.length, render: (i) => { stages.forEach((e, k) => { e.classList.toggle('dim', k > i); e.classList.toggle('cur', k === i); }); narr.innerHTML = says[i]; }, controlsParent: fig.querySelector('.controls-slot'), interval: 2600, start: says.length - 1 });
  });

  /* ---------- 3c: live trainer ---------- */
  Z.demo('d-train', (fig) => {
    const body = fig.querySelector('.demo-body');
    const grid = h('div', { class: 'train-grid' });
    body.appendChild(grid);
    const pL = h('div'), pR = h('div');
    grid.append(pL, pR);
    pL.appendChild(h('p', { class: 'mini-title' }, 'loss：minibatch（每 100 步平均）与 train / val 整体评估'));
    const c = Z.canvas(pL, 230);
    pL.appendChild(h('p', { class: 'mini-title' }, '学习率扫描：lr 从 10⁻³ 指数增长到 10⁰'));
    const c2 = Z.canvas(pL, 170);
    pR.appendChild(h('p', { class: 'mini-title' }, '字符嵌入 C（2 维），训练中实时更新'));
    const c3 = Z.canvas(pR, (w) => Math.min(300, w));
    const samples = h('ol', { class: 'gen-list cols' });
    pR.append(h('p', { class: 'mini-title' }, '从模型采样'), samples);
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' });
    body.appendChild(narr);
    let m, r, step, mb, evals, busy = false, lrCurve = [];
    const TOTAL = 4000, DECAY = 3000;
    const bigramVal = (() => { const P = Z.bigram.probs(1); let t = 0; const d = DATA.va; for (let k = 0; k < d.n; k++) t -= Math.log(P[d.X[k * 3 + 2]][d.Y[k]]); return t / d.n; })();
    function reset() {
      m = new CharMLP({ init: 'naive', seed: 42 }); r = Z.rng(1); step = 0; mb = []; evals = { tr: [], va: [] };
      const l0 = m.evalLoss(DATA.tr);
      evals.tr.push([0, l0]); evals.va.push([0, m.evalLoss(DATA.va)]);
      samples.innerHTML = '';
      draw(); drawEmb();
      narr.innerHTML = `${m.nparams.toLocaleString()} 个参数，按 03 集的写法全部用标准正态初始化。训练集 ${DATA.tr.n.toLocaleString()} 个样本（页面内置约 ${window.NAMES.length} 个名字，不是原课的 32,000 个）。初始 loss = <b>${fmt(l0, 2)}</b>，远高于均匀乱猜的 3.30，原因下一集会讲。`;
    }
    function draw() {
      const n = Math.max(TOTAL, step);
      Z.chart(c, {
        x: [0, n], y: [1.8, 4.2], xticks: [0, 1000, 2000, 3000, 4000].filter((v) => v <= n), yticks: [2, 2.5, 3, 3.5, 4], yfmt: (v) => v.toFixed(1),
        series: [{ pts: mb, color: 'muted', width: 1.2, label: 'minibatch' }, { pts: evals.tr, color: 'fwd', width: 2, dots: 2.5, label: 'train' }, { pts: evals.va, color: 'bwd', width: 2, dots: 2.5, label: 'val' }],
        hlines: [{ y: Math.log(27), label: '均匀 3.30', color: 'muted' }, { y: bigramVal, label: 'bigram ' + fmt(bigramVal, 2), color: 'muted' }],
        vlines: [{ x: DECAY, label: 'lr 0.1 → 0.01', color: 'muted' }], legend: true, xlabel: 'step',
      });
    }
    c.draw = draw;
    function drawLR() {
      const { ctx, w, h: H } = c2;
      if (!lrCurve.length) { ctx.clearRect(0, 0, w, H); ctx.fillStyle = Z.color('muted'); ctx.font = '12px ' + Z.MONO; ctx.fillText('点 “扫描学习率” 运行一次（从头新建一个模型）', 12, H / 2); return; }
      const sm = lrCurve.map((p, k) => { const a = lrCurve.slice(Math.max(0, k - 25), k + 1); return [p[0], Z.mean(a.map((q) => q[1]))]; });
      let best = sm[0]; for (const p of sm) if (p[1] < best[1]) best = p;
      Z.chart(c2, { x: [-3, 0], y: [1.8, 6], xticks: [-3, -2, -1, 0], yticks: [2, 3, 4, 5, 6], xfmt: (v) => '1e' + v, series: [{ pts: lrCurve, color: 'muted', width: 1, alpha: 0.6 }, { pts: sm, color: 'bwd', width: 2 }], vlines: [{ x: best[0], label: 'loss 最低处 lr ≈ ' + fmt(10 ** best[0], 2), color: 'fwd' }], xlabel: 'lr（对数轴）' });
    }
    c2.draw = drawLR;
    function drawEmb() {
      const { ctx, w, h: H } = c3; ctx.clearRect(0, 0, w, H);
      const P = m.P.C; let lx = Infinity, hx = -Infinity, ly = Infinity, hy = -Infinity;
      for (let i = 0; i < V; i++) { lx = Math.min(lx, P[2 * i]); hx = Math.max(hx, P[2 * i]); ly = Math.min(ly, P[2 * i + 1]); hy = Math.max(hy, P[2 * i + 1]); }
      const pad = 18, sc = (v) => pad + ((v - lx) / (hx - lx || 1)) * (w - 2 * pad), scy = (v) => H - pad - ((v - ly) / (hy - ly || 1)) * (H - 2 * pad);
      ctx.strokeStyle = Z.color('rule'); ctx.strokeRect(0.5, 0.5, w - 1, H - 1);
      ctx.font = '600 13px ' + Z.MONO; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let i = 0; i < V; i++) {
        const x = sc(P[i * 2]), y = scy(P[i * 2 + 1]);
        const vowel = 'aeiou'.includes(C[i]);
        ctx.fillStyle = Z.color(i === 0 ? 'bwd' : vowel ? 'fwd' : 'panel');
        ctx.strokeStyle = Z.color(i === 0 ? 'bwd' : vowel ? 'fwd' : 'muted');
        ctx.beginPath(); ctx.arc(x, y, 10, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = Z.color(i === 0 || vowel ? 'panel' : 'ink'); ctx.fillText(C[i], x, y + 0.5);
      }
    }
    c3.draw = drawEmb;
    async function train() {
      if (busy) return; busy = true;
      if (step >= TOTAL) reset();
      let acc = [];
      while (step < TOTAL) {
        for (let k = 0; k < 100; k++, step++) acc.push(m.trainStep(DATA.tr, step < DECAY ? 0.1 : 0.01, r));
        mb.push([step, Z.mean(acc)]); acc = [];
        if (step % 500 === 0) { evals.tr.push([step, m.evalLoss(DATA.tr)]); evals.va.push([step, m.evalLoss(DATA.va)]); }
        draw(); drawEmb();
        narr.innerHTML = `step ${step} / ${TOTAL}　train ${fmt(evals.tr.at(-1)[1], 3)}　val <b class="t-bwd">${fmt(evals.va.at(-1)[1], 3)}</b>`;
        await Z.frame();
      }
      const sr = Z.rng(2147483647 + step); samples.innerHTML = '';
      for (let k = 0; k < 12; k++) { let w = ''; for (let t = 0; t < 5 && !w; t++) w = m.sample(sr); samples.appendChild(h('li', null, h('code', null, w))); }
      const tr = evals.tr.at(-1)[1], va = evals.va.at(-1)[1];
      narr.innerHTML = `训练完：train <b>${fmt(tr, 3)}</b>，val <b class="t-bwd">${fmt(va, 3)}</b>，同一份 val 上 bigram 是 ${fmt(bigramVal, 3)}。` + (va - tr > 0.08 ? ' train 明显低于 val：数据太少，模型开始背训练集了。这正是他要切出 dev/test 集的原因。' : '') + ' 看右边：元音（蓝色）在嵌入空间里往往挤在一起，他在视频里也看到了同样的现象。';
      busy = false;
    }
    async function lrFind() {
      if (busy) return; busy = true; lrCurve = [];
      const mm = new CharMLP({ init: 'naive', seed: 42 }), rr = Z.rng(3);
      for (let k = 0; k < 1000; k++) {
        const lre = -3 + (3 * k) / 999;
        lrCurve.push([lre, Math.min(6, mm.trainStep(DATA.tr, 10 ** lre, rr))]);
        if (k % 50 === 49) { drawLR(); await Z.frame(); }
      }
      drawLR();
      narr.innerHTML = '学习率扫描：每一步换一个更大的学习率，记录 loss。太小几乎不动，太大开始乱跳。他在视频里得到的谷底大约是 lr = 0.1（10⁻¹），这里的曲线形状一致，具体位置受数据和随机种子影响。';
      busy = false;
    }
    fig.querySelector('.controls-slot').append(h('div', { class: 'controls' }, Z.button('▶ 训练 4000 步', train, 'primary'), Z.button('扫描学习率', lrFind), Z.button('重置', reset)));
    reset(); drawLR();
  });
})();
