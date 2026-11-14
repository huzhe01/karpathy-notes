/* Lecture 02 · makemore 1: bigram */
(function () {
  const { h, s, fmt } = Z;
  const C = window.CHARS, NAMES = window.NAMES, V = 27;
  const ix = (ch) => C.indexOf(ch);

  // shared bigram data
  const pairs = [];
  for (const w of NAMES) { const t = '.' + w + '.'; for (let i = 0; i < t.length - 1; i++) pairs.push([ix(t[i]), ix(t[i + 1])]); }
  const N = Array.from({ length: V }, () => new Array(V).fill(0));
  for (const [a, b] of pairs) N[a][b]++;
  const probs = (smooth) => N.map((row) => { const s2 = row.reduce((p, c) => p + c + smooth, 0); return row.map((c) => (c + smooth) / s2); });
  const datasetNLL = (smooth) => { const P = probs(smooth); let t = 0; for (const [a, b] of pairs) t -= Math.log(P[a][b]); return t / pairs.length; };
  Z.bigram = { pairs, N, probs, datasetNLL };

  /* heatmap helper on canvas */
  function heat(c, M, opt = {}) {
    const { ctx, w } = c;
    ctx.clearRect(0, 0, c.w, c.h);
    const lab = 14, cell = Math.floor((w - lab - 2) / V);
    const ink = Z.color('ink'), muted = Z.color('muted'), fwd = Z.color('fwd'), panel = Z.color('panel'), bwd = Z.color('bwd');
    let mx = 1; for (const r of M) for (const v of r) mx = Math.max(mx, v);
    ctx.font = Math.max(8, Math.min(11, cell - 2)) + 'px ' + Z.MONO; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < V; i++) {
      ctx.fillStyle = muted;
      ctx.fillText(C[i], lab + i * cell + cell / 2, lab / 2);
      ctx.fillText(C[i], lab / 2, lab + i * cell + cell / 2);
      for (let j = 0; j < V; j++) {
        const v = M[i][j];
        const a = v === 0 ? 0 : 0.12 + 0.88 * Math.log(1 + v) / Math.log(1 + mx);
        ctx.fillStyle = panel; ctx.fillRect(lab + j * cell, lab + i * cell, cell - 1, cell - 1);
        if (a > 0) { ctx.globalAlpha = a; ctx.fillStyle = fwd; ctx.fillRect(lab + j * cell, lab + i * cell, cell - 1, cell - 1); ctx.globalAlpha = 1; }
      }
    }
    if (opt.hi) { const [i, j] = opt.hi; ctx.strokeStyle = bwd; ctx.lineWidth = 2; ctx.strokeRect(lab + j * cell - 1, lab + i * cell - 1, cell + 1, cell + 1); }
    if (opt.row != null) { ctx.strokeStyle = bwd; ctx.lineWidth = 2; ctx.strokeRect(lab - 1, lab + opt.row * cell - 1, V * cell + 1, cell + 1); }
    ctx.strokeStyle = Z.color('rule'); ctx.lineWidth = 1; ctx.strokeRect(lab - 0.5, lab - 0.5, V * cell, V * cell);
    return { lab, cell };
  }
  Z.heat = heat;

  /* ---------- 2a: counting is training ---------- */
  Z.demo('d-count', (fig) => {
    const body = fig.querySelector('.demo-body');
    const wrap = h('div', { class: 'count-grid' });
    body.appendChild(wrap);
    const left = h('div', { class: 'count-left' }), right = h('div', { class: 'count-right' });
    wrap.append(left, right);
    const tape = h('div', { class: 'tape', 'aria-live': 'polite' });
    const stat = h('p', { class: 'mini-title' });
    const recent = h('ol', { class: 'recent' });
    left.append(h('p', { class: 'mini-title' }, '当前名字（首尾补 “.”）'), tape, stat, recent);
    const c = Z.canvas(right, (w) => Math.min(w, 440));
    const tip = h('p', { class: 'hint' }, '在格子上移动鼠标查看计数，行 = 当前字符，列 = 下一个字符。');
    right.appendChild(tip);
    const M = Array.from({ length: V }, () => new Array(V).fill(0));
    let p = 0, timer = null, speed = 1, hi = null;
    const draw = () => heat(c, M, { hi });
    c.draw = draw;
    function showTape() {
      if (p >= pairs.length) { tape.innerHTML = '<span class="muted">全部 ' + pairs.length + ' 个 bigram 数完了。</span>'; return; }
      let k = 0, wi = 0;
      for (; wi < NAMES.length; wi++) { const L = NAMES[wi].length + 1; if (k + L > p) break; k += L; }
      const t = '.' + NAMES[wi] + '.', off = p - k;
      tape.innerHTML = '';
      [...t].forEach((ch, i) => tape.appendChild(h('span', { class: 'tch' + (i === off || i === off + 1 ? ' on' : '') }, ch)));
    }
    function tick(n) {
      for (let k = 0; k < n && p < pairs.length; k++, p++) {
        const [a, b] = pairs[p]; M[a][b]++; hi = [a, b];
        if (n < 5) { recent.prepend(h('li', null, h('code', null, C[a] + C[b]), ' → N[' + a + ', ' + b + '] = ' + M[a][b])); while (recent.children.length > 5) recent.lastChild.remove(); }
      }
      stat.textContent = `已计数 ${p} / ${pairs.length} 个 bigram（来自 ${NAMES.length} 个名字）`;
      showTape(); draw();
      if (p >= pairs.length) stop();
    }
    function stop() { clearInterval(timer); timer = null; bPlay.textContent = '▶ 开始数'; }
    const bPlay = Z.button('▶ 开始数', () => {
      if (timer) return stop();
      if (p >= pairs.length) reset();
      bPlay.textContent = '⏸ 暂停';
      timer = setInterval(() => tick(speed), speed === 1 ? 380 : 40);
    }, 'primary');
    function reset() { stop(); p = 0; hi = null; for (const r of M) r.fill(0); recent.innerHTML = ''; tick(0); }
    const seg = Z.seg('count-speed', [['1', '一个一个'], ['20', '快进'], ['all', '一次数完']], '1', (v) => {
      if (v === 'all') { stop(); tick(pairs.length); return; }
      speed = +v; if (timer) { stop(); bPlay.click(); }
    });
    fig.querySelector('.controls-slot').append(h('div', { class: 'controls' }, bPlay, seg, Z.button('清零', reset)));
    c.cv.addEventListener('mousemove', (e) => {
      const r = c.cv.getBoundingClientRect(); const lab = 14, cell = Math.floor((c.w - lab - 2) / V);
      const j = Math.floor((e.clientX - r.left - lab) / cell), i = Math.floor((e.clientY - r.top - lab) / cell);
      if (i >= 0 && i < V && j >= 0 && j < V) tip.innerHTML = `<code>${C[i]}${C[j]}</code>：出现 <b>${M[i][j]}</b> 次` + (p >= pairs.length ? `，P(${C[j]} | ${C[i]}) = ${fmt(N[i][j] / N[i].reduce((a, b2) => a + b2, 0), 3)}` : '');
    });
    // start fully counted so the first frame shows the finished table
    tick(pairs.length); hi = null; draw();
    stat.textContent = `这是数完之后的表：${pairs.length} 个 bigram，来自 ${NAMES.length} 个名字。点“清零”再看一遍计数过程。`;
  });

  /* ---------- 2b: sampling ---------- */
  Z.demo('d-sample', (fig) => {
    const body = fig.querySelector('.demo-body');
    const c = Z.canvas(body, 190);
    const line = h('div', { class: 'gen-line', 'aria-live': 'polite' });
    const list = h('ol', { class: 'gen-list' });
    body.append(line, h('p', { class: 'mini-title' }, '已生成'), list);
    let mode = 'bigram', cur = 0, out = '', u = null, busy = false;
    const rng = Z.rng(2147483647);
    const P = probs(1);
    const rowP = () => (mode === 'uniform' ? new Array(V).fill(1 / V) : P[cur]);
    function draw() {
      const { ctx, w, h: H } = c; ctx.clearRect(0, 0, w, H);
      const p = rowP(), bw = (w - 20) / V, top = 14, base = H - 26, mx = Math.max(...p);
      ctx.font = '11px ' + Z.MONO; ctx.textAlign = 'center';
      let acc = 0;
      for (let j = 0; j < V; j++) {
        const x = 10 + j * bw, bh = (p[j] / mx) * (base - top - 6);
        const hit = u != null && u >= acc && u < acc + p[j];
        ctx.fillStyle = Z.color(hit ? 'bwd' : 'fwd'); ctx.globalAlpha = hit ? 1 : 0.75;
        ctx.fillRect(x + 1, base - bh, bw - 2, bh); ctx.globalAlpha = 1;
        ctx.fillStyle = Z.color(hit ? 'bwd' : 'muted'); ctx.fillText(C[j], x + bw / 2, base + 14);
        acc += p[j];
      }
      ctx.textAlign = 'left'; ctx.fillStyle = Z.color('muted');
      ctx.fillText(`P(下一个字符 | “${C[cur]}”)` + (mode === 'uniform' ? '：均匀分布' : ''), 10, 10);
    }
    c.draw = draw;
    function showLine() { line.innerHTML = ''; line.append(h('span', { class: 'muted' }, '.'), h('span', null, out), h('span', { class: 'caret' }, '▌')); }
    async function sampleOne(fast) {
      cur = 0; out = ''; showLine();
      for (let guard = 0; guard < 30; guard++) {
        const p = rowP(); u = rng(); let acc = 0, nxt = V - 1;
        for (let j = 0; j < V; j++) { acc += p[j]; if (u < acc) { nxt = j; break; } }
        draw(); if (!fast) await Z.sleep(420);
        if (nxt === 0) break;
        out += C[nxt]; cur = nxt; u = null; showLine(); draw(); if (!fast) await Z.sleep(160);
      }
      u = null; cur = 0; draw();
      list.prepend(h('li', null, h('code', null, out || '（空）'), h('span', { class: 'muted' }, mode === 'uniform' ? ' 均匀' : ' bigram')));
      while (list.children.length > 12) list.lastChild.remove();
    }
    const run = async (k) => { if (busy) return; busy = true; for (let i = 0; i < k; i++) await sampleOne(k > 1); busy = false; };
    fig.querySelector('.controls-slot').append(h('div', { class: 'controls' },
      Z.button('▶ 采样一个名字', () => run(1), 'primary'), Z.button('连采 8 个', () => run(8)),
      Z.seg('sample-mode', [['bigram', 'bigram 模型'], ['uniform', '均匀乱猜']], 'bigram', (v) => { mode = v; draw(); })));
    draw(); showLine();
    (async () => { busy = true; for (let i = 0; i < 5; i++) await sampleOne(true); busy = false; })();
  });

  /* ---------- 2c: negative log likelihood ---------- */
  Z.demo('d-nll', (fig) => {
    const body = fig.querySelector('.demo-body');
    const inp = h('input', { type: 'text', id: 'nll-word', value: 'andrej', maxlength: 16, autocomplete: 'off', spellcheck: 'false', 'aria-label': '输入一个名字' });
    let smooth = 1;
    const table = h('div', { class: 'nll-table' });
    const sum = h('p', { class: 'narr' });
    const ctr = fig.querySelector('.controls-slot');
    const sl = Z.slider('nll-smooth', '假计数（平滑）', 0, 5, 1, smooth, (v) => { smooth = v; draw(); }, (v) => '+' + v);
    ctr.append(h('div', { class: 'controls' }, h('label', { class: 'field', for: 'nll-word' }, '名字', inp),
      Z.button('andrej', () => { inp.value = 'andrej'; draw(); }), Z.button('andrejq', () => { inp.value = 'andrejq'; draw(); }), Z.button('emma', () => { inp.value = 'emma'; draw(); }), sl));
    body.append(table, sum);
    inp.addEventListener('input', draw);
    function draw() {
      const w = inp.value.toLowerCase().replace(/[^a-z]/g, '');
      const P = probs(smooth), t = '.' + w + '.';
      table.innerHTML = '';
      table.appendChild(h('div', { class: 'nll-row head' }, h('span', null, 'bigram'), h('span', null, 'P'), h('span', null, 'log P'), h('span', null, '−log P（越长越“意外”）')));
      let tot = 0, n = 0;
      for (let i = 0; i < t.length - 1; i++) {
        const p = P[ix(t[i])][ix(t[i + 1])], lp = Math.log(p);
        tot += -lp; n++;
        const width = Number.isFinite(lp) ? Math.min(100, (-lp / 8) * 100) : 100;
        table.appendChild(h('div', { class: 'nll-row' + (p === 0 ? ' zero' : '') },
          h('code', null, t[i] + t[i + 1]), h('span', null, fmt(p, 4)), h('span', null, fmt(lp, 3)),
          h('span', { class: 'barcell' }, h('i', { style: { width: width + '%' } }), h('b', null, fmt(-lp, 2)))));
      }
      const avg = tot / n;
      sum.innerHTML = `平均负对数似然 = <b class="t-bwd">${fmt(avg, 3)}</b>　·　整个数据集 = <b>${fmt(datasetNLL(smooth), 3)}</b>　·　均匀乱猜 = −ln(1/27) = <b>3.296</b>` +
        (avg === Infinity ? '<br>出现了一个计数为 0 的 bigram，概率 0 → log 是 −∞ → loss 无穷大。他的修法：每个计数先加 1（model smoothing）。' : '');
    }
    draw();
  });

  /* ---------- 2d: the same model as a neural net ---------- */
  Z.demo('d-onehot', (fig) => {
    const body = fig.querySelector('.demo-body');
    const r = Z.rng(2147483647);
    const W0 = Array.from({ length: V }, () => Array.from({ length: V }, () => r.randn()));
    const inCh = 'e', outCh = 'm', xi = ix(inCh), yi = ix(outCh);
    const sc = h('div', { class: 'scroll-x' });
    const svg = s('svg', { viewBox: '0 0 760 300', class: 'onehot', role: 'img', 'aria-label': 'one-hot 乘以权重矩阵 W 等于取出 W 的一行' });
    svg.style.minWidth = '620px';
    sc.appendChild(svg); body.appendChild(sc);
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' });
    body.appendChild(narr);
    const cell = 7.4, ox = 70, oy = 40;
    const gx = s('g'), gW = s('g'), gRow = s('g'), gOut = s('g');
    svg.append(gx, gW, gRow, gOut);
    // one-hot column
    for (let i = 0; i < V; i++) gx.appendChild(s('rect', { x: 20, y: oy + i * cell, width: cell * 2, height: cell - 1, class: i === xi ? 'oh on' : 'oh' }));
    gx.appendChild(s('text', { x: 27, y: oy - 10, 'text-anchor': 'middle', class: 'lab' }, `“${inCh}”`));
    gx.appendChild(s('text', { x: 47, y: oy + xi * cell + 6, class: 'lab small' }, '1'));
    gx.appendChild(s('text', { x: 52, y: oy + V * cell / 2, class: 'lab', 'text-anchor': 'middle' }, '@'));
    // W heat
    let mx = 0; for (const rr of W0) for (const v of rr) mx = Math.max(mx, Math.abs(v));
    for (let i = 0; i < V; i++) for (let j = 0; j < V; j++) gW.appendChild(s('rect', { x: ox + j * cell, y: oy + i * cell, width: cell - 1, height: cell - 1, class: 'wcell', 'fill-opacity': 0.1 + 0.8 * Math.abs(W0[i][j]) / mx }));
    gW.appendChild(s('text', { x: ox + V * cell / 2, y: oy - 10, 'text-anchor': 'middle', class: 'lab' }, 'W  (27 × 27)'));
    const rowBox = s('rect', { x: ox - 2, y: oy + xi * cell - 1.5, width: V * cell + 3, height: cell + 2, class: 'rowbox' });
    gRow.appendChild(rowBox);
    // output panels
    const px = 300, pw = 440, bw = pw / V;
    const panels = [['logits = x @ W', 'logits'], ['counts = logits.exp()', 'counts'], ['probs = counts / counts.sum()', 'probs']];
    const bars = {};
    panels.forEach(([title, key], k) => {
      const y = 20 + k * 92;
      const g = s('g', { class: 'panel p-' + key });
      g.appendChild(s('text', { x: px, y: y + 8, class: 'lab' }, title));
      g.appendChild(s('line', { x1: px, x2: px + pw, y1: y + 70, y2: y + 70, class: 'axis' }));
      bars[key] = [];
      for (let j = 0; j < V; j++) { const b = s('rect', { x: px + j * bw + 1, width: bw - 2, y: y + 70, height: 0, class: 'obar' + (j === yi ? ' tgt' : '') }); g.appendChild(b); bars[key].push(b); }
      for (let j = 0; j < V; j += 1) g.appendChild(s('text', { x: px + j * bw + bw / 2, y: y + 82, 'text-anchor': 'middle', class: 'lab tiny' + (j === yi ? ' t-bwd' : '') }, C[j]));
      gOut.appendChild(g);
    });
    const logits = W0[xi], counts = logits.map(Math.exp), ssum = counts.reduce((a, b) => a + b, 0), pr = counts.map((c2) => c2 / ssum);
    function setBars(key, vals, on) {
      const k = panels.findIndex((p) => p[1] === key), y = 20 + k * 92, base = y + 70;
      const m = Math.max(...vals.map(Math.abs)) || 1;
      vals.forEach((v, j) => { const hh = on ? (Math.abs(v) / m) * 50 : 0; const b = bars[key][j]; b.setAttribute('y', v >= 0 ? base - hh : base); b.setAttribute('height', hh); b.classList.toggle('neg', v < 0); });
    }
    const steps = [
      () => { setBars('logits', logits, false); setBars('counts', counts, false); setBars('probs', pr, false); rowBox.style.opacity = 0; return `神经网络不能直接吃字符。输入字符 “${inCh}” 编码成 27 维的 <b>one-hot</b> 向量：第 ${xi} 位是 1，其余是 0。W 是随机初始化的 27×27 权重。`; },
      () => { rowBox.style.opacity = 1; setBars('logits', logits, true); return 'one-hot 乘 W，结果就是把 W 的第 ' + xi + ' 行原样取出来。这一行叫 <b>logits</b>，他把它解释成“对数计数”(log counts)：有正有负。'; },
      () => { setBars('counts', counts, true); return '<code>exp()</code> 把它们都变成正数，可以当成“计数”看待。在计数法里这一行就是 N 的第 ' + xi + ' 行。'; },
      () => { setBars('probs', pr, true); return '每个数除以总和，得到一行加起来为 1 的概率。exp + 归一化这两步合起来就是 <b>softmax</b>。'; },
      () => `数据里 “${inCh}” 后面跟的是 “${outCh}”。看高亮那一列：P = ${fmt(pr[yi], 4)}，loss = −log P = <b class="t-bwd">${fmt(-Math.log(pr[yi]), 3)}</b>。对所有 bigram 取平均就得到和计数法完全相同的损失函数，接下来用梯度下降去调 W。`,
    ];
    Z.player(fig, { n: steps.length, render: (i) => { for (let k = 0; k <= i; k++) narr.innerHTML = steps[k](); }, controlsParent: fig.querySelector('.controls-slot'), interval: 2600, start: steps.length - 1 });
  });

  /* ---------- 2e: gradient descent on W reaches the counting answer ---------- */
  Z.demo('d-bigram-gd', (fig) => {
    const body = fig.querySelector('.demo-body');
    const c = Z.canvas(body, 220);
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' });
    body.appendChild(narr);
    let W, curve, reg = 0, busy = false, it = 0;
    const target = datasetNLL(0);
    function init() { const r = Z.rng(2147483647); W = Array.from({ length: V }, () => Float64Array.from({ length: V }, () => r.randn())); curve = []; it = 0; curve.push([0, lossAndGrad(null)]); draw(); narr.innerHTML = `W 随机初始化时 loss = <b>${fmt(curve[0][1], 3)}</b>。虚线是同一份数据上计数法的平均 NLL = <b>${fmt(target, 3)}</b>。`; }
    const G = Array.from({ length: V }, () => new Float64Array(V));
    function lossAndGrad(grad) {
      // group by input char for speed
      let L = 0; if (grad) for (const g of grad) g.fill(0);
      const n = pairs.length;
      for (let a = 0; a < V; a++) {
        const row = W[a]; let m = -Infinity; for (const v of row) m = Math.max(m, v);
        let z = 0; const e = new Float64Array(V); for (let j = 0; j < V; j++) { e[j] = Math.exp(row[j] - m); z += e[j]; }
        const cnt = N[a]; let tot = 0; for (const c2 of cnt) tot += c2;
        if (!tot) continue;
        for (let j = 0; j < V; j++) { if (cnt[j]) L -= cnt[j] * Math.log(e[j] / z); if (grad) grad[a][j] += (tot * e[j] / z - cnt[j]) / n; }
      }
      L /= n;
      let R = 0; for (let a = 0; a < V; a++) for (let j = 0; j < V; j++) { R += W[a][j] * W[a][j]; if (grad) grad[a][j] += reg * 2 * W[a][j] / (V * V); }
      return L + reg * R / (V * V);
    }
    function draw() {
      const n = Math.max(100, it);
      Z.chart(c, { x: [0, n], y: [2, Math.max(4, Math.ceil(curve[0][1]))], xticks: [0, n / 2, n], yticks: [2, 3, 4, Math.max(4, Math.ceil(curve[0][1]))].filter((v, i, a) => a.indexOf(v) === i), series: [{ pts: curve, color: 'bwd', width: 2 }], hlines: [{ y: target, label: '计数法 ' + fmt(target, 3), color: 'fwd' }, { y: Math.log(27), label: '均匀 3.296', color: 'muted' }], xlabel: '梯度下降步数', ylabel: 'loss' });
    }
    c.draw = draw;
    async function train(k) {
      if (busy) return; busy = true;
      for (let t = 0; t < k; t++) {
        lossAndGrad(G);
        for (let a = 0; a < V; a++) for (let j = 0; j < V; j++) W[a][j] -= 50 * G[a][j];
        it++;
        const L = lossAndGrad(null); curve.push([it, L]);
        if (t % 4 === 3 || t === k - 1) { draw(); narr.innerHTML = `step ${it}：loss = <b class="t-bwd">${fmt(L, 4)}</b>　（计数法 ${fmt(target, 4)}）` + (reg > 0 ? `　正则化强度 ${reg}：把 W 往 0 拉，相当于往每个计数里加假计数，loss 会停在更高处。` : '。学习率 50，这么大的步长在这种凸问题上没问题。'); await Z.frame(); }
      }
      busy = false;
    }
    fig.querySelector('.controls-slot').append(h('div', { class: 'controls' },
      Z.button('▶ 训练 100 步', () => train(100), 'primary'), Z.button('重新初始化', init),
      Z.seg('bgd-reg', [['0', '不加正则'], ['0.01', 'λ = 0.01'], ['0.5', 'λ = 0.5']], '0', (v) => { reg = +v; init(); })));
    init();
  });
})();
