/* Lecture 04 · makemore 3: activations, gradients, BatchNorm */
(function () {
  const { h, s, fmt } = Z;
  const DATA = () => Z.charData;

  /* ---------- 4a: fixing the initial loss + saturated tanh ---------- */
  Z.demo('d-init', (fig) => {
    const body = fig.querySelector('.demo-body');
    const grid = h('div', { class: 'two-col' });
    body.appendChild(grid);
    const a = h('div'), b = h('div');
    grid.append(a, b);
    a.appendChild(h('p', { class: 'mini-title' }, '前 2000 步的 loss（每 25 步平均）'));
    const c = Z.canvas(a, 240);
    b.appendChild(h('p', { class: 'mini-title' }, '初始化时隐藏层 tanh 输出的分布（512 个样本 × 100 个神经元）'));
    const c2 = Z.canvas(b, 240);
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' }); body.appendChild(narr);
    let runs = null, busy = false;
    const acts = {};
    function initActs() {
      for (const mode of ['naive', 'fixed']) {
        const m = new Z.CharMLP({ init: mode, seed: 42 });
        const d = DATA().tr, B = Math.min(512, d.n);
        const l = m.forward(d.X, d.Y, B, 0, true);
        const hid = Array.from(m.cache.hid);
        acts[mode] = { hid, loss: l, sat: hid.filter((v) => Math.abs(v) > 0.99).length / hid.length };
      }
    }
    initActs();
    function drawHist() {
      Z.chart(c2, {
        x: [-1, 1], y: [0, 0.5], xticks: [-1, -0.5, 0, 0.5, 1], yticks: [0, 0.25, 0.5],
        series: [{ pts: Z.histLine(acts.naive.hid, -1, 1, 50), color: 'bwd', width: 2, label: `标准正态初始化：${fmt(acts.naive.sat * 100, 0)}% 在 ±0.99 之外` }, { pts: Z.histLine(acts.fixed.hid, -1, 1, 50), color: 'fwd', width: 2, label: `修正后：${fmt(acts.fixed.sat * 100, 0)}%` }],
        legend: true, xlabel: 'tanh 输出',
      });
    }
    c2.draw = drawHist;
    function drawLoss() {
      const top = Math.ceil(Math.max(acts.naive.loss, 5) / 5) * 5;
      Z.chart(c, {
        x: [0, 2000], y: [0, top], xticks: [0, 500, 1000, 1500, 2000], yticks: [0, top / 4, top / 2, (3 * top) / 4, top], yfmt: (v) => v.toFixed(0),
        series: runs ? [{ pts: runs.naive, color: 'bwd', width: 2, label: '标准正态初始化' }, { pts: runs.fixed, color: 'fwd', width: 2, label: 'W2×0.01, b2=0, W1 按 Kaiming' }] : [],
        hlines: [{ y: Math.log(27), label: '−ln(1/27) = 3.30', color: 'muted' }], legend: true, xlabel: 'step',
      });
    }
    c.draw = drawLoss;
    async function run() {
      if (busy) return; busy = true;
      runs = { naive: [], fixed: [] };
      const ms = { naive: new Z.CharMLP({ init: 'naive', seed: 42 }), fixed: new Z.CharMLP({ init: 'fixed', seed: 42 }) };
      const rs = { naive: Z.rng(5), fixed: Z.rng(5) };
      const acc = { naive: [], fixed: [] };
      for (let st = 0; st < 2000; st++) {
        for (const k of ['naive', 'fixed']) acc[k].push(ms[k].trainStep(DATA().tr, 0.1, rs[k]));
        if (st % 25 === 24) { for (const k of ['naive', 'fixed']) { runs[k].push([st + 1, Z.mean(acc[k])]); acc[k] = []; } }
        if (st % 100 === 99) { drawLoss(); await Z.frame(); }
      }
      const vn = ms.naive.evalLoss(DATA().va), vf = ms.fixed.evalLoss(DATA().va);
      narr.innerHTML = `2000 步之后 val loss：标准正态 <b class="t-bwd">${fmt(vn, 3)}</b>，修正后 <b class="t-fwd">${fmt(vf, 3)}</b>。左图橙线开头的陡降就是他说的“曲棍球棒”：前几百步只是在把过大的 logits 压下去，修正后这段白干的活没有了。`;
      busy = false;
    }
    fig.querySelector('.controls-slot').append(h('div', { class: 'controls' }, Z.button('▶ 两种初始化各训练 2000 步', run, 'primary')));
    drawLoss(); drawHist();
    narr.innerHTML = `初始化时的 loss：标准正态 <b class="t-bwd">${fmt(acts.naive.loss, 2)}</b>，修正后 <b class="t-fwd">${fmt(acts.fixed.loss, 2)}</b>，理论值 −ln(1/27) = 3.30。右图：标准正态初始化让大部分 tanh 输出贴在 ±1，那里的局部梯度 1 − t² 接近 0，反向传播的梯度被“掐断”。`;
  });

  /* ---------- 4b: deep tanh stack: activation & gradient statistics ---------- */
  Z.demo('d-stack', (fig) => {
    const body = fig.querySelector('.demo-body');
    const L = 5, W = 100, B = 256;
    const r = Z.rng(11);
    const X = Float64Array.from({ length: B * W }, () => r.randn());
    const Ws = Array.from({ length: L }, () => Float64Array.from({ length: W * W }, () => r.randn()));
    const G0 = Float64Array.from({ length: B * W }, () => r.randn());
    let gain = 5 / 3, bn = false, linear = false, pending = false;
    const grid = h('div', { class: 'two-col' });
    body.appendChild(grid);
    const a = h('div'), b = h('div');
    grid.append(a, b);
    a.appendChild(h('p', { class: 'mini-title' }, '前向：每层 tanh 输出的直方图'));
    const c1 = Z.canvas(a, 230);
    const t1 = h('div', { class: 'layer-stats' }); a.appendChild(t1);
    b.appendChild(h('p', { class: 'mini-title' }, '反向：每层输出收到的梯度的直方图'));
    const c2 = Z.canvas(b, 230);
    const t2 = h('div', { class: 'layer-stats' }); b.appendChild(t2);
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' }); body.appendChild(narr);
    const cols = ['s1', 's2', 's3', 's4', 's5'];
    function compute() {
      const sc = gain / Math.sqrt(W);
      let x = X;
      const outs = [], cache = [];
      for (let l = 0; l < L; l++) {
        const Wl = Ws[l], pre = new Float64Array(B * W);
        for (let i = 0; i < B; i++) for (let k = 0; k < W; k++) { const v = x[i * W + k] * sc; if (!v) continue; const wr = k * W; for (let j = 0; j < W; j++) pre[i * W + j] += v * Wl[wr + j]; }
        let xh = pre, sd = null;
        if (bn) {
          xh = new Float64Array(B * W); sd = new Float64Array(W);
          for (let j = 0; j < W; j++) { let m = 0; for (let i = 0; i < B; i++) m += pre[i * W + j]; m /= B; let v = 0; for (let i = 0; i < B; i++) v += (pre[i * W + j] - m) ** 2; v /= B; sd[j] = Math.sqrt(v + 1e-5); for (let i = 0; i < B; i++) xh[i * W + j] = (pre[i * W + j] - m) / sd[j]; }
        }
        const out = linear ? xh.slice() : xh.map(Math.tanh);
        cache.push({ xin: x, xh, sd, out });
        outs.push(out); x = out;
      }
      // backward
      const grads = new Array(L);
      let g = G0;
      for (let l = L - 1; l >= 0; l--) {
        grads[l] = g;
        const { xh, sd, out } = cache[l];
        let d = linear ? g.slice() : g.map((v, i) => v * (1 - out[i] * out[i]));
        if (bn) {
          const dn = new Float64Array(B * W);
          for (let j = 0; j < W; j++) { let m1 = 0, m2 = 0; for (let i = 0; i < B; i++) { m1 += d[i * W + j]; m2 += d[i * W + j] * xh[i * W + j]; } m1 /= B; m2 /= B; for (let i = 0; i < B; i++) dn[i * W + j] = (d[i * W + j] - m1 - xh[i * W + j] * m2) / sd[j]; }
          d = dn;
        }
        const Wl = Ws[l], gin = new Float64Array(B * W);
        for (let i = 0; i < B; i++) for (let k = 0; k < W; k++) { let acc = 0; const wr = k * W; for (let j = 0; j < W; j++) acc += d[i * W + j] * Wl[wr + j]; gin[i * W + k] = acc * sc; }
        g = gin;
      }
      return { outs, grads };
    }
    let res = compute();
    function stats(a2) { const arr = Array.from(a2); return { m: Z.mean(arr), sd: Z.std(arr), sat: arr.filter((v) => Math.abs(v) > 0.97).length / arr.length }; }
    function draw() {
      const { outs, grads } = res;
      const lim = linear ? Math.max(1, ...outs.map((o) => 3 * stats(o).sd)) : 1;
      Z.chart(c1, { x: [-lim, lim], y: [0, 0.3], xticks: [-lim, 0, lim], xfmt: (v) => fmt(v, 1), yticks: [0, 0.1, 0.2, 0.3], series: outs.map((o, l) => ({ pts: Z.histLine(o, -lim, lim, 50), color: cols[l], width: 1.8 })) });
      const gs = grads.map((g) => stats(g).sd), gl = 3 * Math.max(...gs);
      Z.chart(c2, { x: [-gl, gl], y: [0, 0.3], xticks: [-gl, 0, gl], xfmt: (v) => (v === 0 ? '0' : Math.abs(v) >= 0.01 && Math.abs(v) < 1000 ? fmt(v, 2) : v.toExponential(0).replace('-', '−')), yticks: [0, 0.1, 0.2, 0.3], series: grads.map((g, l) => ({ pts: Z.histLine(g, -gl, gl, 50), color: cols[l], width: 1.8 })) });
      t1.innerHTML = ''; t2.innerHTML = '';
      outs.forEach((o, l) => { const st = stats(o); t1.appendChild(h('div', { class: 'ls' }, h('i', { class: 'sw ' + cols[l] }), `第 ${l + 1} 层  std ${fmt(st.sd, 2)}` + (linear ? '' : `  饱和 ${fmt(st.sat * 100, 1)}%`))); });
      grads.forEach((g, l) => { const st = stats(g); t2.appendChild(h('div', { class: 'ls' }, h('i', { class: 'sw ' + cols[l] }), `第 ${l + 1} 层  grad std ${st.sd.toExponential(2)}`)); });
      const sat = stats(outs[L - 1]).sat, ratio = gs[0] / gs[L - 1];
      let msg;
      if (bn) msg = '加了 BatchNorm：不管 gain 设多少，每层的 pre-activation 都被强行标准化，直方图几乎不随 gain 变化。这就是它让训练“不那么脆弱”的原因。';
      else if (linear) msg = gain > 1.15 ? '纯线性网络里 gain > 1 会让激活一层比一层大，最终爆炸。' : gain < 0.85 ? '纯线性网络里 gain < 1 会让激活一层比一层小，最终消失。' : '纯线性网络里 gain = 1 刚好让每层的尺度保持不变。他用这个例子说明 gain 是为了抵消非线性的“挤压”。';
      else if (gain >= 6) msg = `不做缩放（相当于 W ~ N(0,1)）：最后一层有 ${fmt(sat * 100, 0)}% 的值饱和在 ±1，梯度在这些位置几乎为 0。`;
      else if (Math.abs(gain - 5 / 3) < 0.08) msg = 'gain = 5/3：tanh 的推荐增益。各层的激活分布和梯度分布大致一样，饱和比例保持在几个百分点。';
      else if (gain < 1.2) msg = 'gain 太小：tanh 一层层往里挤，激活越来越窄，梯度也越传越小（看第 1 层和第 5 层梯度 std 的比值 ' + fmt(ratio, 2) + '）。';
      else msg = 'gain 偏大：饱和比例上升。';
      narr.innerHTML = msg;
    }
    c1.draw = draw; c2.draw = draw;
    const recompute = () => { if (pending) return; pending = true; requestAnimationFrame(() => { res = compute(); draw(); pending = false; }); };
    const sl = Z.slider('stack-gain', 'gain', 0.25, 10, 0.01, gain, (v) => { gain = v; recompute(); }, (v) => fmt(v, 2));
    fig.querySelector('.controls-slot').append(h('div', { class: 'controls' }, sl,
      h('span', { class: 'chips' }, Z.button('1', () => sl.set(1)), Z.button('5/3', () => sl.set(5 / 3)), Z.button('3', () => sl.set(3)), Z.button('不缩放', () => sl.set(10))),
      Z.check('stack-bn', '加 BatchNorm', false, (v) => { bn = v; recompute(); }),
      Z.check('stack-lin', '去掉 tanh（全线性）', false, (v) => { linear = v; recompute(); })));
    draw();
  });

  /* ---------- 4c: what BatchNorm does to one neuron over a batch ---------- */
  Z.demo('d-bn', (fig) => {
    const body = fig.querySelector('.demo-body');
    const svg = s('svg', { viewBox: '0 0 720 170', class: 'bn', role: 'img', 'aria-label': 'BatchNorm 把一个神经元在 batch 上的值标准化' });
    body.appendChild(svg);
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' }); body.appendChild(narr);
    const r = Z.rng(21), n = 24;
    const raw = Array.from({ length: n }, () => 3 + 2.2 * r.randn());
    raw[0] = 5.1;
    const r2 = Z.rng(99); const raw2 = raw.map((v, i) => (i === 0 ? v : 2.2 + 2.6 * r2.randn()));
    const X = (v) => 360 + v * 52;
    for (let t = -6; t <= 6; t++) { svg.appendChild(s('line', { x1: X(t), x2: X(t), y1: 128, y2: 134, class: 'axis' })); svg.appendChild(s('text', { x: X(t), y: 150, 'text-anchor': 'middle', class: 'lab tiny' }, String(t))); }
    svg.appendChild(s('line', { x1: X(-6.6), x2: X(6.6), y1: 128, y2: 128, class: 'axis' }));
    const mu = s('line', { y1: 30, y2: 128, class: 'mu' }), muT = s('text', { y: 24, 'text-anchor': 'middle', class: 'lab t-bwd' });
    const sdL = s('rect', { y: 34, height: 92, class: 'sdband' });
    svg.append(sdL, mu, muT);
    const dots = raw.map((v, i) => { const c = s('circle', { cx: 0, cy: 0, r: i === 0 ? 7 : 5, class: i === 0 ? 'me' : 'dot' }); svg.appendChild(c); return c; });
    const ys = raw.map((_, i) => (i === 0 ? 70 : 48 + ((i * 37) % 70)));
    const stat = (a) => { const m = Z.mean(a); return [m, Z.std(a)]; };
    function place(vals, m, sd, showSd) {
      vals.forEach((v, i) => { dots[i].style.transform = `translate(${X(v)}px, ${ys[i]}px)`; });
      mu.setAttribute('x1', X(m)); mu.setAttribute('x2', X(m)); muT.setAttribute('x', X(m)); muT.textContent = 'μ = ' + fmt(m, 2);
      sdL.setAttribute('x', X(m - sd)); sdL.setAttribute('width', X(m + sd) - X(m - sd)); sdL.style.opacity = showSd ? 1 : 0;
    }
    const [m1, s1] = stat(raw), [m2, s2] = stat(raw2);
    const steps = [
      () => { place(raw, m1, s1, true); return `某个隐藏神经元在一个 batch（${n} 个样本）上的 pre-activation：均值 ${fmt(m1, 2)}、标准差 ${fmt(s1, 2)}，偏得太远，很多值会让 tanh 饱和。大圆点是“你的样本”。`; },
      () => { const v = raw.map((x) => x - m1); place(v, 0, s1, true); return '第 1 步：减去 batch 均值，分布挪到 0 附近。'; },
      () => { const v = raw.map((x) => (x - m1) / s1); place(v, 0, 1, true); return '第 2 步：除以 batch 标准差，变成单位高斯（阴影是 ±1σ）。这些操作都可微，所以可以直接放进网络里。'; },
      () => { const v = raw.map((x) => 1.4 * (x - m1) / s1 + 0.6); place(v, 0.6, 1.4, true); return '第 3 步：再乘可学习的 γ（bngain）、加可学习的 β（bnbias）。初始化 γ=1、β=0，训练中网络可以自己决定要多宽、往哪偏。这里演示 γ=1.4、β=0.6。'; },
      () => { const v = raw2.map((x) => 1.4 * (x - m2) / s2 + 0.6); place(v, 0.6, 1.4, true); return '副作用：换一批“同车”的样本，batch 统计量变了，你的样本（大圆点）原始值没变，输出却挪了一点。他称之为 jitter（抖动），类似数据增强，意外地起到正则化作用。'; },
      () => { place(raw.map((x) => 1.4 * (x - 3) / 2.2 + 0.6), 0.6, 1.4, true); return '推理时一次只来一个样本，没有 batch 可算统计量。做法是训练时顺手维护 running mean / running std（指数滑动平均），推理时用它们。'; },
    ];
    Z.player(fig, { n: steps.length, render: (i) => { narr.innerHTML = steps[i](); }, controlsParent: fig.querySelector('.controls-slot'), interval: 2600 });
  });

  /* ---------- 4d: update:data ratio ---------- */
  Z.demo('d-ratio', (fig) => {
    const body = fig.querySelector('.demo-body');
    const c = Z.canvas(body, 230);
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' }); body.appendChild(narr);
    let lr = 0.1, series = null, busy = false;
    const names = [['C', 's2'], ['W1', 's3'], ['W2', 's5']];
    function draw() {
      Z.chart(c, { x: [0, 1000], y: [-6, 0], xticks: [0, 250, 500, 750, 1000], yticks: [-6, -5, -4, -3, -2, -1, 0], series: series ? names.map(([k, col]) => ({ pts: series[k], color: col, width: 1.8, label: k })) : [], hlines: [{ y: -3, label: '经验值 1e-3', color: 'bwd' }], legend: true, xlabel: 'step', ylabel: 'log10( std(lr·grad) / std(data) )' });
    }
    c.draw = draw;
    async function run() {
      if (busy) return; busy = true;
      series = { C: [], W1: [], W2: [] };
      const m = new Z.CharMLP({ init: 'fixed', seed: 42 }), r = Z.rng(8), d = Z.charData.tr, B = 32;
      for (let st = 0; st < 1000; st++) {
        const Xb = new Int32Array(B * 3), Yb = new Int32Array(B);
        for (let b = 0; b < B; b++) { const k = Math.floor(r() * d.n); Yb[b] = d.Y[k]; for (let j = 0; j < 3; j++) Xb[b * 3 + j] = d.X[k * 3 + j]; }
        m.forward(Xb, Yb, B); m.backward();
        if (st % 10 === 0) for (const [k] of names) { const g = Array.from(m.G[k]).map((v) => v * lr), p = Array.from(m.P[k]); series[k].push([st, Math.log10(Z.std(g) / Z.std(p))]); }
        m.update(lr);
        if (st % 100 === 99) { draw(); await Z.frame(); }
      }
      const last = Object.fromEntries(names.map(([k]) => [k, Z.mean(series[k].slice(-20).map((p) => p[1]))]));
      narr.innerHTML = `lr = ${lr}：最后阶段 C ≈ ${fmt(last.C, 1)}、W1 ≈ ${fmt(last.W1, 1)}、W2 ≈ ${fmt(last.W2, 1)}。` + (lr <= 0.001 ? ' 远低于 −3：每步更新只动了参数的十万分之几，学得太慢。' : lr >= 1 ? ' 明显高于 −3：每一步都在大幅改写参数，训练不稳。' : ' 在 −3 附近：他用这条经验线判断学习率是否合适。');
      busy = false;
    }
    fig.querySelector('.controls-slot').append(h('div', { class: 'controls' }, Z.button('▶ 训练 1000 步并记录', run, 'primary'),
      Z.seg('ratio-lr', [['0.001', 'lr 0.001'], ['0.1', 'lr 0.1'], ['1', 'lr 1.0']], '0.1', (v) => { lr = +v; run(); })));
    draw();
    narr.innerHTML = '他每次训练都会看这张图：每一步的更新量相对参数本身有多大。点按钮跑一次，换学习率对比。';
  });
})();
