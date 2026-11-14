/* Lecture 05 · Becoming a Backprop Ninja */
(function () {
  const { h, s, fmt } = Z;

  /* ---------- 5a: walk the forward pass backwards, line by line ---------- */
  Z.demo('d-ninja', (fig) => {
    const body = fig.querySelector('.demo-body');
    const F = [
      ['emb = C[Xb]', 'dC[Xb[k,j]] += demb[k,j]   # 查表的反向：把梯度加回被查到的行'],
      ['embcat = emb.view(emb.shape[0], -1)', 'demb = dembcat.view(emb.shape)'],
      ['hprebn = embcat @ W1 + b1', 'dembcat = dhprebn @ W1.T;  dW1 = embcat.T @ dhprebn;  db1 = dhprebn.sum(0)'],
      ['bnmeani = 1/n*hprebn.sum(0, keepdim=True)', 'dhprebn += 1.0/n * torch.ones_like(hprebn) * dbnmeani'],
      ['bndiff = hprebn - bnmeani', 'dhprebn = dbndiff.clone();  dbnmeani = (-dbndiff).sum(0)'],
      ['bndiff2 = bndiff**2', 'dbndiff += 2*bndiff * dbndiff2'],
      ['bnvar = 1/(n-1)*bndiff2.sum(0, keepdim=True)', 'dbndiff2 = 1.0/(n-1) * torch.ones_like(bndiff2) * dbnvar'],
      ['bnvar_inv = (bnvar + 1e-5)**-0.5', 'dbnvar = -0.5*(bnvar + 1e-5)**-1.5 * dbnvar_inv'],
      ['bnraw = bndiff * bnvar_inv', 'dbndiff = bnvar_inv * dbnraw;  dbnvar_inv = (bndiff * dbnraw).sum(0, keepdim=True)'],
      ['hpreact = bngain * bnraw + bnbias', 'dbngain = (bnraw * dhpreact).sum(0, keepdim=True);  dbnraw = bngain * dhpreact;  dbnbias = dhpreact.sum(0, keepdim=True)'],
      ['h = torch.tanh(hpreact)', 'dhpreact = (1.0 - h**2) * dh'],
      ['logits = h @ W2 + b2', 'dh = dlogits @ W2.T;  dW2 = h.T @ dlogits;  db2 = dlogits.sum(0)'],
      ['logit_maxes = logits.max(1, keepdim=True).values', 'dlogits += F.one_hot(logits.max(1).indices, 27) * dlogit_maxes'],
      ['norm_logits = logits - logit_maxes', 'dlogits = dnorm_logits.clone();  dlogit_maxes = (-dnorm_logits).sum(1, keepdim=True)'],
      ['counts = norm_logits.exp()', 'dnorm_logits = counts * dcounts'],
      ['counts_sum = counts.sum(1, keepdims=True)', 'dcounts += torch.ones_like(counts) * dcounts_sum'],
      ['counts_sum_inv = counts_sum**-1', 'dcounts_sum = -counts_sum**-2 * dcounts_sum_inv'],
      ['probs = counts * counts_sum_inv', 'dcounts = counts_sum_inv * dprobs;  dcounts_sum_inv = (counts * dprobs).sum(1, keepdim=True)'],
      ['logprobs = probs.log()', 'dprobs = (1.0 / probs) * dlogprobs'],
      ['loss = -logprobs[range(n), Yb].mean()', 'dlogprobs = zeros_like(logprobs);  dlogprobs[range(n), Yb] = -1.0/n'],
    ];
    const notes = {
      19: '起点：loss 只依赖每行里正确字符那一格，所以只有这 n 格有梯度，值是 −1/n（mean 的导数）。',
      18: 'log 的导数是 1/x。如果正确字符的概率已经接近 1，这里的梯度就很小。',
      17: '一行代码里有两个变量：probs = counts × counts_sum_inv。后者形状 [32,1]，前向被 broadcast 到 27 列，所以反向要 <b>沿第 1 维求和</b>。',
      15: '前向 <b>求和</b> ↔ 反向 <b>broadcast</b>（复制）。counts 有两条路通到 loss，梯度要累加（+=），和 micrograd 里同一个节点被用两次是一回事。',
      13: 'logit_maxes 只为数值稳定而减去，不改变 probs，所以理论上它的梯度应为 0。他打印出来确认确实约等于 0。',
      11: '矩阵乘法的反向：不用背公式，看形状就能拼出来。dh 要和 h 同形状 [32,64]，只有 dlogits @ W2.T 能凑出这个形状。',
      9: 'bngain 前向被 broadcast 到整个 batch，反向就沿 batch 维求和。',
      6: '插曲：方差用 n−1（Bessel 校正）。他指出原论文训练时用有偏估计、推理时用无偏估计，这种不一致他不喜欢，所以这里统一用 n−1。',
      3: '均值的反向：每个元素都分到 1/n 的梯度。',
      0: '查表的反向：Xb 里出现几次某个字符，就把对应位置的梯度加回 C 的那一行几次。走到这里，所有参数的梯度都手算完了，他用 cmp() 和 PyTorch 的结果逐个比对，全部 exact。',
    };
    const wrap = h('div', { class: 'ninja' });
    const rows = F.map(([f, b2], k) => {
      const row = h('div', { class: 'nj-row' }, h('code', { class: 'nj-f' }, f), h('code', { class: 'nj-b' }, b2));
      wrap.appendChild(row); return row;
    });
    const sc = h('div', { class: 'scroll-x' }); sc.appendChild(wrap);
    body.append(h('div', { class: 'nj-head' }, h('span', { class: 't-fwd' }, '前向（从上往下写）'), h('span', { class: 't-bwd' }, '反向（他从最后一行往上逐行推）')), sc);
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' }); body.appendChild(narr);
    const order = F.map((_, k) => F.length - 1 - k);
    Z.player(fig, {
      n: order.length + 1,
      render: (i) => {
        rows.forEach((r, k) => { r.classList.remove('cur', 'done'); });
        if (i === 0) { narr.innerHTML = '练习 1：把前向拆成最原子的一行行，然后从 loss 开始往回，一行一行写出每个中间变量的梯度。每写一个都和 PyTorch 自动求导的结果对一下。'; return; }
        for (let t = 0; t < i; t++) rows[order[t]].classList.add('done');
        const k = order[i - 1]; rows[k].classList.add('cur'); rows[k].classList.remove('done');
        const top = rows[k].offsetTop;
        if (top < wrap.scrollTop || top > wrap.scrollTop + wrap.clientHeight - 40) wrap.scrollTop = top - wrap.clientHeight / 2;
        narr.innerHTML = notes[k] || '继续往上走：每一行只用到“上游梯度 × 本行的局部导数”。';
      },
      controlsParent: fig.querySelector('.controls-slot'), interval: 1800,
    });
  });

  /* ---------- 5b: sum ↔ broadcast duality ---------- */
  Z.demo('d-dual', (fig) => {
    const body = fig.querySelector('.demo-body');
    const svg = s('svg', { viewBox: '0 0 720 210', class: 'dual', role: 'img', 'aria-label': '前向求和对应反向广播，前向广播对应反向求和' });
    const sc = h('div', { class: 'scroll-x' }); svg.style.minWidth = '600px'; sc.appendChild(svg); body.appendChild(sc);
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' }); body.appendChild(narr);
    const R = 3, Cc = 4, cw = 34, ch = 28;
    const grid = (g, x0, y0, rr, cc, cls) => { const cells = []; for (let i = 0; i < rr; i++) for (let j = 0; j < cc; j++) { const c = s('rect', { x: x0 + j * cw, y: y0 + i * ch, width: cw - 3, height: ch - 3, rx: 3, class: 'cell ' + cls }); g.appendChild(c); cells.push(c); } return cells; };
    // left panel: counts.sum(1)
    const gl = s('g'), gr = s('g'); svg.append(gl, gr);
    gl.appendChild(s('text', { x: 10, y: 18, class: 'lab' }, 'counts_sum = counts.sum(1, keepdim=True)'));
    const A = grid(gl, 10, 40, R, Cc, 'a');
    const As = grid(gl, 200, 40, R, 1, 'b');
    gl.appendChild(s('text', { x: 75, y: 140, 'text-anchor': 'middle', class: 'shape' }, '[32, 27]'));
    gl.appendChild(s('text', { x: 216, y: 140, 'text-anchor': 'middle', class: 'shape' }, '[32, 1]'));
    const arL = s('text', { x: 165, y: 86, 'text-anchor': 'middle', class: 'big-arrow' }, '→');
    gl.appendChild(arL);
    const codeL = s('text', { x: 10, y: 180, class: 'lab code-t' }); gl.appendChild(codeL);
    // right panel: h @ W + b (b broadcast)
    gr.appendChild(s('text', { x: 380, y: 18, class: 'lab' }, 'hpreact = h @ W1 + b1'));
    const Bv = grid(gr, 380, 40, 1, Cc, 'b');
    const Bm = grid(gr, 380, 90, R, Cc, 'a');
    gr.appendChild(s('text', { x: 590, y: 58, class: 'shape' }, 'b1 [1, 64]'));
    gr.appendChild(s('text', { x: 530, y: 140, class: 'shape' }, '[32, 64]'));
    const arR = s('text', { x: 445, y: 86, 'text-anchor': 'middle', class: 'big-arrow' }, '↓'); gr.appendChild(arR);
    const codeR = s('text', { x: 380, y: 180, class: 'lab code-t' }); gr.appendChild(codeR);
    const set = (cells, cls) => cells.forEach((c) => c.setAttribute('class', 'cell ' + cls));
    const steps = [
      () => { set(A, 'f'); set(As, 'idle'); set(Bv, 'f'); set(Bm, 'idle'); arL.textContent = '→'; arR.textContent = '↓'; arL.setAttribute('class', 'big-arrow t-fwd'); arR.setAttribute('class', 'big-arrow t-fwd'); codeL.textContent = '前向：每行 27 个数加起来 → 1 个数'; codeR.textContent = '前向：同一个 b1 复制到 batch 的每一行'; return '<span class="t-fwd">前向</span>：左边是一次<b>求和</b>（多个数汇成一个），右边是一次<b>广播</b>（一个数被很多地方复用）。'; },
      () => { set(A, 'f'); set(As, 'f'); set(Bv, 'f'); set(Bm, 'f'); return '<span class="t-fwd">前向</span>完成。'; },
      () => { set(As, 'g'); set(A, 'idle'); set(Bm, 'g'); set(Bv, 'idle'); arL.textContent = '←'; arR.textContent = '↑'; arL.setAttribute('class', 'big-arrow t-bwd'); arR.setAttribute('class', 'big-arrow t-bwd'); codeL.textContent = 'dcounts += torch.ones_like(counts) * dcounts_sum'; codeR.textContent = 'db1 = dhpreact.sum(0)'; return '<span class="t-bwd">反向</span>：梯度从右往左流。'; },
      () => { set(A, 'g'); set(Bv, 'g'); return '<span class="t-bwd">反向</span>：前向的求和在反向变成广播（每个被加的数都拿到同一个梯度）；前向的广播在反向变成求和（被复用的变量把各处的梯度加起来）。他说要留意这种<b>对偶</b>，形状对了，公式基本就对了。'; },
    ];
    Z.player(fig, { n: steps.length, render: (i) => { narr.innerHTML = steps[i](); }, controlsParent: fig.querySelector('.controls-slot'), interval: 2400, start: steps.length - 1 });
  });

  /* ---------- 5c: cross-entropy gradient = p − y, as forces ---------- */
  Z.demo('d-ce', (fig) => {
    const body = fig.querySelector('.demo-body');
    const labels = ['.', 'a', 'e', 'i', 'l', 'm', 'n', 'r', 's'];
    const K = labels.length;
    let logits, tgt = 1, steps = 0;
    const reset = () => { const r = Z.rng(4); logits = Array.from({ length: K }, () => r.randn() * 1.2); steps = 0; draw(); };
    const svg = s('svg', { viewBox: '0 0 720 260', class: 'ce', role: 'img', 'aria-label': '交叉熵的梯度：错误字符被往下拉，正确字符被往上拉' });
    body.appendChild(svg);
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' }); body.appendChild(narr);
    const base = 190, bw = 720 / K;
    function draw() {
      svg.innerHTML = '';
      const p = Z.softmax(logits), g = p.map((v, k) => v - (k === tgt ? 1 : 0));
      svg.appendChild(s('line', { x1: 0, x2: 720, y1: base, y2: base, class: 'axis' }));
      p.forEach((v, k) => {
        const x = k * bw + bw / 2;
        const grp = s('g', { class: 'cebar' + (k === tgt ? ' tgt' : ''), tabindex: 0, role: 'button', 'aria-label': '设为正确字符 ' + labels[k] });
        grp.appendChild(s('rect', { x: x - 22, y: base - v * 150, width: 44, height: v * 150, class: 'pb' }));
        grp.appendChild(s('text', { x, y: base + 18, 'text-anchor': 'middle', class: 'tok' }, labels[k]));
        grp.appendChild(s('text', { x, y: base - v * 150 - 6, 'text-anchor': 'middle', class: 'lab tiny' }, fmt(v, 2)));
        const len = Math.max(4, Math.abs(g[k]) * 120), up = g[k] < 0;
        const y0 = base - v * 150 - 22;
        const ay = up ? y0 - len : y0;
        grp.appendChild(s('line', { x1: x, x2: x, y1: up ? y0 : y0 - len, y2: up ? y0 - len : y0, class: 'force' }));
        grp.appendChild(s('path', { d: up ? `M${x - 6},${ay + 8} L${x},${ay} L${x + 6},${ay + 8}` : `M${x - 6},${y0 - 8} L${x},${y0} L${x + 6},${y0 - 8}`, class: 'force-head' }));
        grp.appendChild(s('text', { x, y: base + 34, 'text-anchor': 'middle', class: 'lab tiny t-bwd' }, (g[k] > 0 ? '+' : '') + fmt(g[k], 2)));
        const pick = () => { tgt = k; draw(); };
        grp.addEventListener('click', pick);
        grp.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
        svg.appendChild(grp);
      });
      const sum = g.reduce((a, b) => a + b, 0);
      narr.innerHTML = `正确字符是 <b>“${labels[tgt]}”</b>（点柱子可以换），loss = −log P = <b>${fmt(-Math.log(p[tgt]), 3)}</b>。dlogits = softmax(logits) − one_hot：错误字符的梯度等于它的概率（箭头向下拉），正确字符是 P − 1（向上推）。一行加起来 = ${fmt(Math.abs(sum) < 1e-9 ? 0 : sum, 3)}，推力和拉力正好平衡。${steps ? `已沿负梯度走了 ${steps} 步。` : ''}`;
    }
    const step = async (k) => { for (let t = 0; t < k; t++) { const p = Z.softmax(logits); logits = logits.map((v, j) => v - 1.5 * (p[j] - (j === tgt ? 1 : 0))); steps++; draw(); await Z.sleep(140); } };
    fig.querySelector('.controls-slot').append(h('div', { class: 'controls' }, Z.button('▶ 沿负梯度走 1 步', () => step(1), 'primary'), Z.button('走 10 步', () => step(10)), Z.button('重置', reset)));
    reset();
  });
})();
