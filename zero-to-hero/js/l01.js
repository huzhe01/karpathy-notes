/* Lecture 01 · micrograd */
(function () {
  const { h, s, fmt } = Z;

  /* ---------- 1a: derivative by nudging ---------- */
  Z.demo('d-deriv', (fig) => {
    const body = fig.querySelector('.demo-body');
    const f = (x) => 3 * x * x - 4 * x + 5;
    let x0 = 3, lh = 0, anim = null;
    const c = Z.canvas(body, 270);
    const read = h('div', { class: 'readout' });
    body.appendChild(read);
    const ctr = fig.querySelector('.controls-slot');
    const sx = Z.slider('deriv-x', 'x', -4, 4, 0.1, x0, (v) => { x0 = v; draw(); }, (v) => fmt(v, 1));
    const sh = Z.slider('deriv-h', 'h', -4, 0.3, 0.05, lh, (v) => { lh = v; draw(); }, (v) => (10 ** v < 0.01 ? (10 ** v).toExponential(0) : fmt(10 ** v, 3)));
    const bShrink = Z.button('h → 0', async () => {
      if (anim) return;
      anim = true;
      for (let v = 0.3; v >= -4; v -= 0.08) { sh.set(v); await Z.sleep(28); }
      anim = null;
    }, 'primary');
    const presets = h('span', { class: 'chips' },
      Z.button('x = 3', () => sx.set(3)), Z.button('x = −3', () => sx.set(-3)), Z.button('x = 2/3', () => { x0 = 2 / 3; sx.querySelector('input').value = 0.7; sx.fire(); x0 = 2 / 3; draw(); }));
    ctr.append(h('div', { class: 'controls' }, sx, sh, bShrink, presets));
    function draw() {
      const hh = 10 ** lh;
      const fx = f(x0), fxh = f(x0 + hh), slope = (fxh - fx) / hh, exact = 6 * x0 - 4;
      const pts = [];
      for (let x = -4.5; x <= 4.51; x += 0.05) pts.push([x, f(x)]);
      const sec = [[-4.5, fx + slope * (-4.5 - x0)], [4.5, fx + slope * (4.5 - x0)]];
      const tan = [[-4.5, fx + exact * (-4.5 - x0)], [4.5, fx + exact * (4.5 - x0)]];
      const g = Z.chart(c, {
        x: [-4.5, 4.5], y: [-5, 90], xticks: [-4, -2, 0, 2, 4], yticks: [0, 20, 40, 60, 80],
        series: [
          { pts: tan, color: 'muted', dash: [5, 5], width: 1.2 },
          { pts: sec, color: 'bwd', width: 2 },
          { pts, color: 'ink', width: 2 },
        ],
        xlabel: 'x', ylabel: 'f(x) = 3x² − 4x + 5',
      });
      const ctx = c.ctx;
      ctx.fillStyle = Z.color('fwd');
      ctx.beginPath(); ctx.arc(g.X(x0), g.Y(fx), 5, 0, 7); ctx.fill();
      ctx.fillStyle = Z.color('bwd');
      if (x0 + hh <= 4.5) { ctx.beginPath(); ctx.arc(g.X(x0 + hh), g.Y(fxh), 4, 0, 7); ctx.fill(); }
      read.innerHTML = '';
      read.append(
        h('span', null, 'f(x) = ', h('b', null, fmt(fx, 3))),
        h('span', null, '(f(x+h) − f(x)) / h = ', h('b', { class: 't-bwd' }, fmt(slope, 4))),
        h('span', null, '解析导数 6x − 4 = ', h('b', null, fmt(exact, 4))),
      );
    }
    c.draw = draw; draw();
  });

  /* ---------- generic Value-graph renderer (graphviz-like records) ---------- */
  const NW = 106, NH = 58;
  function graphDemo(fig, spec) {
    const body = fig.querySelector('.demo-body');
    const sc = h('div', { class: 'scroll-x' });
    const svg = s('svg', { viewBox: `0 0 ${spec.w} ${spec.h}`, class: 'graph', role: 'img', 'aria-label': spec.aria });
    svg.style.minWidth = spec.minWidth + 'px';
    sc.appendChild(svg); body.appendChild(sc);
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' });
    body.appendChild(narr);
    const gE = s('g'), gN = s('g');
    svg.append(gE, gN);
    const edges = {}, nodes = {};
    const nodePos = (id) => spec.nodes[id];
    const path = (x1, y1, x2, y2) => { const mx = (x1 + x2) / 2; return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`; };
    for (const [oid, op] of Object.entries(spec.ops)) {
      const r = op.r || 15;
      for (const inp of op.ins) {
        const n = nodePos(inp);
        const e = s('path', { d: path(n.x + NW, n.y, op.x - r, op.y), class: 'edge' });
        gE.appendChild(e); edges[inp + '>' + oid] = e;
      }
      const o = nodePos(op.out);
      const e2 = s('path', { d: path(op.x + r, op.y, o.x, o.y), class: 'edge' });
      gE.appendChild(e2); edges[oid + '>' + op.out] = e2;
      const g = s('g', { class: 'op' });
      g.append(s('circle', { cx: op.x, cy: op.y, r }), s('text', { x: op.x, y: op.y + 4, 'text-anchor': 'middle' }, op.op));
      gN.appendChild(g);
    }
    for (const [id, n] of Object.entries(spec.nodes)) {
      const g = s('g', { class: 'rec', transform: `translate(${n.x},${n.y - NH / 2})` });
      const lab = s('text', { x: NW / 2, y: 13, 'text-anchor': 'middle', class: 'rec-lab' }, n.label || id);
      const dt = s('text', { x: 8, y: 33, class: 'rec-data' });
      const gr = s('text', { x: 8, y: 50, class: 'rec-grad' });
      g.append(s('rect', { x: 0, y: 0, width: NW, height: NH, rx: 3 }), s('line', { x1: 0, x2: NW, y1: 19, y2: 19 }), s('line', { x1: 0, x2: NW, y1: 38, y2: 38 }), lab, dt, gr);
      gN.appendChild(g);
      nodes[id] = { g, dt, gr };
    }
    function render(st) {
      for (const [id, n] of Object.entries(nodes)) {
        const d = st.data[id], gg = st.grad[id];
        n.dt.textContent = 'data ' + (d == null ? '   ?' : fmt(d, 4));
        n.gr.textContent = 'grad ' + (gg == null ? '   ·' : fmt(gg, 4));
        n.g.classList.toggle('hi-f', (st.hiF || []).includes(id));
        n.g.classList.toggle('hi-b', (st.hiB || []).includes(id));
      }
      for (const [k, e] of Object.entries(edges)) {
        e.classList.toggle('on-f', (st.eF || []).includes(k));
        e.classList.toggle('on-b', (st.eB || []).includes(k));
      }
      narr.innerHTML = st.say;
    }
    return { render };
  }

  /* ---------- 1b: L = (a*b + c) * f ---------- */
  Z.demo('d-graph', (fig) => {
    const spec = {
      w: 715, h: 290, minWidth: 620, aria: '表达式 L = (a·b + c)·f 的计算图',
      nodes: { a: { x: 10, y: 49 }, b: { x: 10, y: 139 }, e: { x: 205, y: 95 }, c: { x: 205, y: 209 }, d: { x: 400, y: 150 }, f: { x: 400, y: 244 }, L: { x: 595, y: 197 } },
      ops: { m1: { x: 170, y: 95, op: '×', ins: ['a', 'b'], out: 'e' }, p1: { x: 365, y: 150, op: '+', ins: ['e', 'c'], out: 'd' }, m2: { x: 560, y: 197, op: '×', ins: ['d', 'f'], out: 'L' } },
    };
    const G = graphDemo(fig, spec);
    const leaf = { a: 2, b: -3, c: 10, f: -2 };
    const full = { ...leaf, e: -6, d: 4, L: -8 };
    const grads = { L: 1, d: -2, f: 4, e: -2, c: -2, a: 6, b: -4 };
    const pick = (keys) => Object.fromEntries(keys.map((k) => [k, grads[k]]));
    const nudged = { a: 2.06, b: -3.04, c: 9.98, f: -1.96, e: -6.2624, d: 3.7176, L: -7.286496 };
    const steps = [
      { data: leaf, grad: {}, say: '四个叶子节点 <b>a, b, c, f</b> 是 Value 对象，只存了 <code>data</code>。他用 graphviz 把每个 Value 画成这样的格子，<code>grad</code> 先是 0。' },
      { data: { ...leaf, e: -6 }, grad: {}, eF: ['a>m1', 'b>m1', 'm1>e'], hiF: ['e'], say: '<span class="t-fwd">前向</span>：<code>e = a * b = −6</code>。每个运算都会生成新的 Value，并记住自己的“孩子”（<code>_prev</code>）和运算符（<code>_op</code>）。' },
      { data: { ...leaf, e: -6, d: 4 }, grad: {}, eF: ['e>p1', 'c>p1', 'p1>d'], hiF: ['d'], say: '<span class="t-fwd">前向</span>：<code>d = e + c = 4</code>。' },
      { data: full, grad: {}, eF: ['d>m2', 'f>m2', 'm2>L'], hiF: ['L'], say: '<span class="t-fwd">前向</span>完成：<code>L = d * f = −8</code>。在神经网络里，L 就是 loss，我们想知道每个输入对它有多大影响。' },
      { data: full, grad: pick(['L']), hiB: ['L'], say: '<span class="t-bwd">反向</span>从最后开始：<code>dL/dL = 1</code>。' },
      { data: full, grad: pick(['L', 'd', 'f']), eB: ['d>m2', 'f>m2', 'm2>L'], hiB: ['d', 'f'], say: '× 节点：<code>L = d·f</code>，所以 <code>dL/dd = f = −2</code>，<code>dL/df = d = 4</code>。一边的梯度 = 上游梯度 × 另一边的值。他每算一个都把输入加一个 h 重跑前向，用数值导数核对。' },
      { data: full, grad: pick(['L', 'd', 'f', 'e', 'c']), eB: ['e>p1', 'c>p1', 'p1>d'], hiB: ['e', 'c'], say: '+ 节点的局部导数是 1，它把上游梯度<b>原样分发</b>给所有输入：<code>e.grad = c.grad = −2</code>。他说加号就像一个路由器。' },
      { data: full, grad: grads, eB: ['a>m1', 'b>m1', 'm1>e'], hiB: ['a', 'b'], say: '链式法则：<code>dL/da = dL/de · de/da = −2 · b = 6</code>，<code>dL/db = −2 · a = −4</code>。他引用的比喻：汽车比自行车快 2 倍，自行车比人快 4 倍，那汽车比人快 2×4 = 8 倍。变化率沿链条<b>相乘</b>。' },
      { data: nudged, grad: grads, hiF: ['L'], eF: ['a>m1', 'b>m1', 'm1>e', 'e>p1', 'c>p1', 'p1>d', 'd>m2', 'f>m2', 'm2>L'], say: '一步优化的预览：每个叶子沿梯度方向推 0.01（<code>a.data += 0.01 * a.grad</code>），再跑一遍前向，L 从 −8 变成 <b>−7.29</b>。沿梯度反方向走，L 就会变小，这就是梯度下降。' },
    ];
    Z.player(fig, { n: steps.length, render: (i) => G.render(steps[i]), controlsParent: fig.querySelector('.controls-slot'), interval: 2600 });
  });

  /* ---------- 1c: a neuron ---------- */
  Z.demo('d-neuron', (fig) => {
    const spec = {
      w: 890, h: 310, minWidth: 700, aria: '一个 tanh 神经元的计算图',
      nodes: { x1: { x: 10, y: 40, label: 'x1' }, w1: { x: 10, y: 110, label: 'w1' }, x2: { x: 10, y: 200, label: 'x2' }, w2: { x: 10, y: 270, label: 'w2' },
        x1w1: { x: 200, y: 75, label: 'x1·w1' }, x2w2: { x: 200, y: 235, label: 'x2·w2' }, s: { x: 390, y: 155, label: 'x1w1+x2w2' }, b: { x: 390, y: 265, label: 'b' }, n: { x: 580, y: 210, label: 'n' }, o: { x: 770, y: 210, label: 'o' } },
      ops: { m1: { x: 165, y: 75, op: '×', ins: ['x1', 'w1'], out: 'x1w1' }, m2: { x: 165, y: 235, op: '×', ins: ['x2', 'w2'], out: 'x2w2' }, p1: { x: 355, y: 155, op: '+', ins: ['x1w1', 'x2w2'], out: 's' }, p2: { x: 545, y: 210, op: '+', ins: ['s', 'b'], out: 'n' }, t: { x: 735, y: 210, op: 'tanh', r: 20, ins: ['n'], out: 'o' } },
    };
    const G = graphDemo(fig, spec);
    const B = 6.8813735870195432;
    const leaf = { x1: 2, w1: -3, x2: 0, w2: 1, b: B };
    const d1 = { ...leaf, x1w1: -6, x2w2: 0 };
    const d2 = { ...d1, s: -6, n: -6 + B };
    const d3 = { ...d2, o: Math.tanh(-6 + B) };
    const gAll = { o: 1, n: 0.5, s: 0.5, b: 0.5, x1w1: 0.5, x2w2: 0.5, x1: -1.5, w1: 1, x2: 0.5, w2: 0 };
    const pick = (ks) => Object.fromEntries(ks.map((k) => [k, gAll[k]]));
    const steps = [
      { data: leaf, grad: {}, say: '一个神经元：输入 x1、x2，权重 w1、w2，偏置 b。他特意把 b 设成 6.8813735870195432，让后面的数字好算。' },
      { data: d1, grad: {}, eF: ['x1>m1', 'w1>m1', 'm1>x1w1', 'x2>m2', 'w2>m2', 'm2>x2w2'], hiF: ['x1w1', 'x2w2'], say: '<span class="t-fwd">前向</span>：先算每个输入乘权重。' },
      { data: d2, grad: {}, eF: ['x1w1>p1', 'x2w2>p1', 'p1>s', 's>p2', 'b>p2', 'p2>n'], hiF: ['n'], say: '<span class="t-fwd">前向</span>：求和再加偏置，得到 <code>n = Σ wᵢxᵢ + b = 0.8814</code>。' },
      { data: d3, grad: {}, eF: ['n>t', 't>o'], hiF: ['o'], say: '<span class="t-fwd">前向</span>：过激活函数 tanh，把输出压到 (−1, 1)：<code>o = 0.7071</code>。' },
      { data: d3, grad: pick(['o']), hiB: ['o'], say: '<span class="t-bwd">反向</span>：<code>o.grad = 1</code>。' },
      { data: d3, grad: pick(['o', 'n']), eB: ['n>t', 't>o'], hiB: ['n'], say: 'tanh 的局部导数是 <code>1 − o²</code>，所以 <code>n.grad = 1 − 0.7071² = 0.5</code>。他在白板上推的是这个公式，不靠框架。' },
      { data: d3, grad: pick(['o', 'n', 's', 'b', 'x1w1', 'x2w2']), eB: ['s>p2', 'b>p2', 'p2>n', 'x1w1>p1', 'x2w2>p1', 'p1>s'], hiB: ['s', 'b', 'x1w1', 'x2w2'], say: '两个 + 节点把 0.5 原样分下去。' },
      { data: d3, grad: gAll, eB: ['x1>m1', 'w1>m1', 'm1>x1w1', 'x2>m2', 'w2>m2', 'm2>x2w2'], hiB: ['x1', 'w1', 'x2', 'w2'], say: '× 节点交换对方的值：<code>w1.grad = x1·0.5 = 1</code>，<code>x1.grad = w1·0.5 = −1.5</code>。注意 <code>w2.grad = 0</code>：因为 x2 = 0，w2 怎么变都影响不到输出。' },
    ];
    Z.player(fig, { n: steps.length, render: (i) => G.render(steps[i]), controlsParent: fig.querySelector('.controls-slot'), interval: 2400 });
  });

  /* ---------- 1d: micrograd in JS, train MLP(3,[4,4,1]) ---------- */
  class V {
    constructor(data, prev = [], op = '') { this.data = data; this.grad = 0; this._prev = prev; this._op = op; this._back = null; }
    add(o) { o = o instanceof V ? o : new V(o); const out = new V(this.data + o.data, [this, o], '+'); out._back = () => { this.grad += out.grad; o.grad += out.grad; }; return out; }
    mul(o) { o = o instanceof V ? o : new V(o); const out = new V(this.data * o.data, [this, o], '*'); out._back = () => { this.grad += o.data * out.grad; o.grad += this.data * out.grad; }; return out; }
    tanh() { const t = Math.tanh(this.data); const out = new V(t, [this], 'tanh'); out._back = () => { this.grad += (1 - t * t) * out.grad; }; return out; }
    sub(o) { return this.add(o instanceof V ? o.mul(-1) : -o); }
    sq() { const out = new V(this.data * this.data, [this], '**2'); out._back = () => { this.grad += 2 * this.data * out.grad; }; return out; }
    backward() {
      const topo = [], seen = new Set();
      const build = (v) => { if (seen.has(v)) return; seen.add(v); for (const c of v._prev) build(c); topo.push(v); };
      build(this); this.grad = 1;
      for (let i = topo.length - 1; i >= 0; i--) topo[i]._back && topo[i]._back();
    }
  }
  Z.V = V;
  function makeMLP(seed) {
    const r = Z.rng(seed);
    const u = () => new V(r() * 2 - 1);
    const sizes = [3, 4, 4, 1];
    const layers = [];
    for (let l = 0; l < 3; l++) {
      const neurons = [];
      for (let j = 0; j < sizes[l + 1]; j++) neurons.push({ w: Array.from({ length: sizes[l] }, u), b: u() });
      layers.push(neurons);
    }
    const params = () => layers.flatMap((L) => L.flatMap((n) => [...n.w, n.b]));
    const call = (x) => { let a = x; for (const L of layers) a = L.map((n) => n.w.reduce((acc, w, i) => acc.add(w.mul(a[i])), n.b).tanh()); return a[0]; };
    return { layers, params, call, sizes };
  }
  Z.demo('d-mlp', (fig) => {
    const body = fig.querySelector('.demo-body');
    const xs = [[2, 3, -1], [3, -1, 0.5], [0.5, 1, 1], [1, 1, -1]];
    const ys = [1, -1, -1, 1];
    let net, losses, preds, step, busy = false, lr = 0.05, forget = false;
    const grid = h('div', { class: 'mlp-grid' });
    body.appendChild(grid);
    const left = h('div', { class: 'mlp-net' }), right = h('div', { class: 'mlp-side' });
    grid.append(left, right);
    const svg = s('svg', { viewBox: '0 0 470 250', class: 'net', role: 'img', 'aria-label': 'MLP(3, [4, 4, 1]) 网络结构，线宽表示权重大小' });
    left.appendChild(svg);
    const code = h('pre', { class: 'code small' });
    left.appendChild(code);
    const lines = [
      ['fwd', 'ypred = [n(x) for x in xs]'],
      ['fwd', 'loss = sum((yout - ygt)**2 for ygt, yout in zip(ys, ypred))'],
      ['zero', 'for p in n.parameters(): p.grad = 0.0'],
      ['bwd', 'loss.backward()'],
      ['upd', 'for p in n.parameters(): p.data += -lr * p.grad'],
    ];
    const lineEls = lines.map(([k, t]) => { const e = h('span', { class: 'ln ln-' + k }, t); code.append(e, '\n'); return e; });
    const lc = h('div'); right.appendChild(h('p', { class: 'mini-title' }, 'loss（4 个样本的平方误差之和）'));
    right.appendChild(lc);
    const c = Z.canvas(lc, 150);
    right.appendChild(h('p', { class: 'mini-title' }, '4 个样本：蓝柱 = 预测，橙线 = 目标（+1 / −1）'));
    const psvg = s('svg', { viewBox: '0 0 300 130', class: 'preds', role: 'img', 'aria-label': '四个样本的预测值与目标值' });
    right.appendChild(psvg);
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' });
    body.appendChild(narr);
    const ctr = fig.querySelector('.controls-slot');
    const sl = Z.slider('mlp-lr', '学习率', 0.01, 0.3, 0.01, lr, (v) => { lr = v; }, (v) => fmt(v, 2));
    const ck = Z.check('mlp-forget', '忘记 zero_grad（他视频里真犯的 bug）', false, (v) => { forget = v; lineEls[2].classList.toggle('strike', v); });
    ctr.append(h('div', { class: 'controls' },
      Z.button('训练 1 步', () => run(1), 'primary'), Z.button('训练 30 步', () => run(30)), Z.button('重置', reset), sl, ck));

    const pos = [];
    function layout() {
      const xsPos = [40, 170, 300, 430];
      const sizes = [3, 4, 4, 1];
      pos.length = 0;
      sizes.forEach((n, l) => { const col = []; for (let j = 0; j < n; j++) col.push([xsPos[l], 125 + (j - (n - 1) / 2) * 52]); pos.push(col); });
    }
    layout();
    const gE = s('g'), gN = s('g');
    svg.append(gE, gN);
    function drawNet() {
      gE.innerHTML = ''; gN.innerHTML = '';
      net.layers.forEach((L, l) => L.forEach((n, j) => n.w.forEach((w, i) => {
        const [x1, y1] = pos[l][i], [x2, y2] = pos[l + 1][j];
        gE.appendChild(s('line', { x1, y1, x2, y2, class: 'w ' + (w.data >= 0 ? 'pos' : 'neg'), 'stroke-width': 0.6 + Math.min(4, Math.abs(w.data) * 2.2) }));
      })));
      pos.forEach((col, l) => col.forEach(([x, y]) => gN.appendChild(s('circle', { cx: x, cy: y, r: l === 0 ? 9 : 12, class: l === 0 ? 'nin' : 'nn' }))));
      gN.appendChild(s('text', { x: 40, y: 22, 'text-anchor': 'middle', class: 'lab' }, '输入 3'));
      gN.appendChild(s('text', { x: 235, y: 22, 'text-anchor': 'middle', class: 'lab' }, '两个隐藏层 × 4 个 tanh 神经元'));
      gN.appendChild(s('text', { x: 430, y: 22, 'text-anchor': 'middle', class: 'lab' }, '输出 1'));
    }
    function drawPreds() {
      psvg.innerHTML = '';
      const y0 = 62, sc = 50;
      psvg.appendChild(s('line', { x1: 10, x2: 290, y1: y0, y2: y0, class: 'axis' }));
      ys.forEach((t, k) => {
        const x = 40 + k * 70, p = preds[k];
        psvg.appendChild(s('rect', { x: x - 14, y: Math.min(y0, y0 - p * sc), width: 28, height: Math.abs(p * sc), class: 'pbar' }));
        psvg.appendChild(s('line', { x1: x - 22, x2: x + 22, y1: y0 - t * sc, y2: y0 - t * sc, class: 'target' }));
        psvg.appendChild(s('text', { x, y: 126, 'text-anchor': 'middle', class: 'lab' }, fmt(p, 2)));
      });
    }
    function drawLoss() {
      const n = losses.length, mx = Math.max(1, ...losses.map((p) => p[1]));
      Z.chart(c, { x: [0, Math.max(10, n)], y: [0, Math.ceil(mx)], xticks: [0, Math.max(10, n)], yticks: [0, Math.ceil(mx / 2), Math.ceil(mx)], series: [{ pts: losses, color: 'bwd', width: 2, dots: n < 40 ? 2.5 : 0 }], xlabel: 'step' });
    }
    c.draw = drawLoss;
    function forward() { const yp = xs.map((x) => net.call(x)); const loss = yp.reduce((acc, y, k) => acc.add(y.sub(ys[k]).sq()), new V(0)); return { yp, loss }; }
    function reset() {
      net = makeMLP(1337); step = 0;
      const { yp, loss } = forward();
      preds = yp.map((v) => v.data); losses = [[0, loss.data]];
      drawNet(); drawPreds(); drawLoss();
      narr.innerHTML = `随机初始化的 <code>MLP(3, [4, 4, 1])</code>，共 <b>${net.params().length}</b> 个参数。4 个样本的目标是 [1, −1, −1, 1]，初始 loss = <b>${fmt(loss.data, 3)}</b>。`;
    }
    async function flash(k) { lineEls.forEach((e) => e.classList.remove('on')); if (k >= 0) lineEls[k].classList.add('on'); }
    async function run(nsteps) {
      if (busy) return; busy = true;
      for (let t = 0; t < nsteps; t++) {
        const slow = nsteps === 1;
        await flash(0); svg.classList.add('pulse-f'); if (slow) await Z.sleep(350);
        const { yp, loss } = forward();
        await flash(1); if (slow) await Z.sleep(250);
        if (!forget) { await flash(2); for (const p of net.params()) p.grad = 0; if (slow) await Z.sleep(250); }
        svg.classList.remove('pulse-f');
        await flash(3); svg.classList.add('pulse-b'); loss.backward(); if (slow) await Z.sleep(400);
        svg.classList.remove('pulse-b');
        await flash(4); for (const p of net.params()) p.data += -lr * p.grad;
        step++;
        const after = forward();
        preds = after.yp.map((v) => v.data); losses.push([step, after.loss.data]);
        drawNet(); drawPreds(); drawLoss();
        narr.innerHTML = `step ${step}：loss = <b>${fmt(after.loss.data, 4)}</b>` + (forget ? '。梯度没清零，会一直累加，步子越走越大。这个简单问题上反而收敛更快，但换个问题就可能发散。' : '。每一步：前向 → 清零梯度 → 反向 → 沿负梯度更新。');
        if (!slow) await Z.sleep(60);
      }
      await flash(-1);
      busy = false;
    }
    reset();
  });
})();
