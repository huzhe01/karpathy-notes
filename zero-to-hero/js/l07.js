/* Lecture 07 · Let's build GPT */
(function () {
  const { h, s, fmt } = Z;
  const VOCAB = "\n !$&',-.3:;?ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const enc = (t) => [...t].map((c) => VOCAB.indexOf(c));
  const show = (c) => (c === '\n' ? '⏎' : c === ' ' ? '␠' : c);

  /* ---------- 7a: one chunk hides block_size examples ---------- */
  Z.demo('d-loader', (fig) => {
    const body = fig.querySelector('.demo-body');
    const text = 'First Citizen:\nBefore we proceed any further, hear me speak.';
    const blk = 8, chunk = text.slice(0, blk + 1), ids = enc(chunk);
    const top = h('div', { class: 'tape big' });
    const idsRow = h('div', { class: 'tape ids' });
    const ex = h('div', { class: 'win-list' });
    body.append(h('p', { class: 'mini-title' }, `字符级 tokenizer：Tiny Shakespeare 里一共 ${VOCAB.length} 种字符，每个字符映射成一个整数`), top, idsRow, ex);
    function render(i) {
      top.innerHTML = ''; idsRow.innerHTML = '';
      [...chunk].forEach((c, k) => {
        const cls = k <= i ? ' ctx' : k === i + 1 ? ' tgt' : '';
        top.appendChild(h('span', { class: 'tch' + cls }, show(c)));
        idsRow.appendChild(h('span', { class: 'tch' + cls }, String(ids[k])));
      });
      ex.innerHTML = '';
      for (let t = 0; t <= i; t++) ex.appendChild(h('div', { class: 'win-row' + (t === i ? ' on' : '') }, h('span', { class: 'muted' }, '输入 '), h('code', null, `[${ids.slice(0, t + 1).join(', ')}]`), h('span', { class: 'arrow' }, '→'), h('code', { class: 't-bwd' }, String(ids[t + 1])), h('span', { class: 'muted' }, `   “${[...chunk.slice(0, t + 1)].map(show).join('')}” → “${show(chunk[t + 1])}”`)));
    }
    Z.player(fig, { n: blk, render, controlsParent: fig.querySelector('.controls-slot'), interval: 1100, start: blk - 1 });
  });

  /* ---------- 7b: the mathematical trick, four versions ---------- */
  Z.demo('d-trick', (fig) => {
    const body = fig.querySelector('.demo-body');
    const T = 8, r = Z.rng(1337);
    const x = Array.from({ length: T }, () => Math.round(r.randn() * 10) / 10);
    const hs = 16, q = Array.from({ length: T }, () => Array.from({ length: hs }, () => r.randn())), k = Array.from({ length: T }, () => Array.from({ length: hs }, () => r.randn()));
    const svg = s('svg', { viewBox: '0 0 720 300', class: 'trick', role: 'img', 'aria-label': '用下三角矩阵做加权平均' });
    const sc = h('div', { class: 'scroll-x' }); svg.style.minWidth = '600px'; sc.appendChild(svg); body.appendChild(sc);
    const code = h('pre', { class: 'code small' }); body.appendChild(code);
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' }); body.appendChild(narr);
    const cw = 50, ch = 30, ox = 30, oy = 46;
    const mcells = [];
    for (let i = 0; i < T; i++) for (let j = 0; j < T; j++) { const g = s('g'); const rc = s('rect', { x: ox + j * cw, y: oy + i * ch, width: cw - 3, height: ch - 3, rx: 3, class: 'mc' }); const tx = s('text', { x: ox + j * cw + cw / 2 - 1.5, y: oy + i * ch + 19, 'text-anchor': 'middle', class: 'mct' }); g.append(rc, tx); svg.appendChild(g); mcells.push({ rc, tx, i, j }); }
    const mt = s('text', { x: ox, y: 30, class: 'lab' }); svg.appendChild(mt);
    const col = (x0, title) => { const cells = []; svg.appendChild(s('text', { x: x0 + 24, y: 30, 'text-anchor': 'middle', class: 'lab' }, title)); for (let i = 0; i < T; i++) { const rc = s('rect', { x: x0, y: oy + i * ch, width: 48, height: ch - 3, rx: 3, class: 'vc' }); const tx = s('text', { x: x0 + 24, y: oy + i * ch + 19, 'text-anchor': 'middle', class: 'mct' }); svg.append(rc, tx); cells.push({ rc, tx }); } return cells; };
    svg.appendChild(s('text', { x: 450, y: oy + 4 * ch + 4, 'text-anchor': 'middle', class: 'op-t' }, '@'));
    const xc = col(475, 'x');
    svg.appendChild(s('text', { x: 560, y: oy + 4 * ch + 4, 'text-anchor': 'middle', class: 'op-t' }, '='));
    const oc = col(590, 'xbow');
    const tril = (i, j) => j <= i;
    const avg = Array.from({ length: T }, (_, i) => Array.from({ length: T }, (_, j) => (tril(i, j) ? 1 / (i + 1) : 0)));
    const att = Array.from({ length: T }, (_, i) => { const row = Array.from({ length: T }, (_, j) => (tril(i, j) ? q[i].reduce((a, v, d) => a + v * k[j][d], 0) / Math.sqrt(hs) : -Infinity)); return Z.softmax(row); });
    const matmul = (W) => W.map((row) => row.reduce((a, w, j) => a + w * x[j], 0));
    function setM(fn, title) { mt.textContent = title; for (const c of mcells) { const [txt, cls, op] = fn(c.i, c.j); c.tx.textContent = txt; c.rc.setAttribute('class', 'mc ' + (cls || '')); c.rc.style.fillOpacity = op == null ? '' : op; } }
    function setCol(cells, vals, cls) { cells.forEach((c, i) => { c.tx.textContent = vals ? fmt(vals[i], 2) : ''; c.rc.setAttribute('class', 'vc ' + (cls || '')); }); }
    const frac = (v) => (v === 0 ? '0' : v === 1 ? '1' : '1/' + Math.round(1 / v));
    const steps = [
      { c: 'xbow[t] = x[:t+1].mean(0)', f: () => { setM(() => ['', 'blank'], ''); setCol(xc, x); setCol(oc, null); return '玩具例子：8 个 token，每个 token 一个数（视频里是 2 维）。目标：第 t 个 token 只能和它<b>之前</b>的 token 交流，因为要预测的是未来。最弱的交流方式：对过去取平均。'; } },
      { c: 'for t in range(T):\n    xbow[t] = x[:t+1].mean(0)      # version 1: 双重 for 循环', f: () => { setM(() => ['', 'blank'], ''); setCol(xc, x); setCol(oc, matmul(avg), 'on'); return 'version 1：用 for 循环逐个算前缀平均。结果正确，但很慢。他直说这是“最弱的聚合方式”，丢掉了顺序等很多信息，先这样，后面再补。'; } },
      { c: 'wei = torch.tril(torch.ones(T, T))', f: () => { setM((i, j) => [tril(i, j) ? '1' : '0', tril(i, j) ? 'on' : 'off'], 'torch.tril(torch.ones(8, 8))'); setCol(oc, null); return '技巧的关键：下三角全 1 矩阵。矩阵乘法里每一行和 x 做点积，下三角保证第 t 行只“看到”前 t 个元素。'; } },
      { c: 'wei = wei / wei.sum(1, keepdim=True)\nxbow2 = wei @ x                    # version 2: 矩阵乘法', f: () => { setM((i, j) => [frac(avg[i][j]), tril(i, j) ? 'on' : 'off', tril(i, j) ? 0.15 + avg[i][j] * 0.85 : null], 'wei（每行归一化）'); setCol(oc, matmul(avg), 'on'); return 'version 2：每行除以行和，矩阵乘一次就得到和 for 循环完全相同的 xbow。<b>矩阵乘法 = 加权聚合</b>。'; } },
      { c: "wei = torch.zeros((T, T))\nwei = wei.masked_fill(tril == 0, float('-inf'))", f: () => { setM((i, j) => [tril(i, j) ? '0' : '−∞', tril(i, j) ? 'on' : 'off'], 'masked_fill(tril == 0, −inf)'); setCol(oc, null); return 'version 3：从全 0 出发，把未来位置填成 −∞。'; } },
      { c: 'wei = F.softmax(wei, dim=-1)\nxbow3 = wei @ x                    # version 3: softmax', f: () => { setM((i, j) => [frac(avg[i][j]), tril(i, j) ? 'on' : 'off', tril(i, j) ? 0.15 + avg[i][j] * 0.85 : null], 'softmax 之后'); setCol(oc, matmul(avg), 'on'); return 'softmax 后 −∞ 变成 0，0 变成均匀权重，结果又一样。为什么要绕这一圈？因为全 0 可以换成“token 之间互相有多感兴趣”的分数，而 −∞ 依然保证不偷看未来。'; } },
      { c: 'wei = q @ k.transpose(-2, -1) * head_size**-0.5\nwei = wei.masked_fill(tril == 0, float(\'-inf\'))\nwei = F.softmax(wei, dim=-1)       # version 4: self-attention', f: () => { setM((i, j) => [tril(i, j) ? fmt(att[i][j], 2) : '', tril(i, j) ? 'on' : 'off', tril(i, j) ? 0.12 + att[i][j] * 0.88 : null], 'softmax(q·kᵀ/√d)，随数据变化'); setCol(oc, matmul(att), 'on'); return 'version 4：权重不再是均匀的，而是由每对 token 的 query·key 决定（这里用随机的 q、k 演示）。每一行仍然只覆盖过去，加起来仍然是 1。这就是 self-attention 的骨架。'; } },
    ];
    Z.player(fig, { n: steps.length, render: (i) => { code.textContent = steps[i].c; narr.innerHTML = steps[i].f(); }, controlsParent: fig.querySelector('.controls-slot'), interval: 2800 });
  });

  /* ---------- 7c: query / key, interactive ---------- */
  Z.demo('d-attn', (fig) => {
    const body = fig.querySelector('.demo-body');
    const text = 'hear me speak';
    const toks = [...text];
    const T = toks.length;
    const kind = (c) => (c === ' ' ? 's' : 'aeiou'.includes(c) ? 'v' : 'c');
    const key = (c) => ({ v: [1, 0, 0], c: [0, 1, 0], s: [0, 0, 1] })[kind(c)];
    const qry = (c) => ({ v: [0, 3, 0], c: [3, 0, 0], s: [0, 0, 0] })[kind(c)];
    const W = toks.map((c, i) => Z.softmax(toks.map((d, j) => (j <= i ? qry(c).reduce((a, v, t) => a + v * key(d)[t], 0) : -Infinity))));
    let sel = 9;
    const svg = s('svg', { viewBox: '0 0 720 200', class: 'attn', role: 'img', 'aria-label': '点一个 token，查看它对之前每个 token 的注意力权重' });
    const sc = h('div', { class: 'scroll-x' }); svg.style.minWidth = '560px'; sc.appendChild(svg); body.appendChild(sc);
    const heatWrap = h('div', { class: 'attn-heat' });
    body.appendChild(heatWrap);
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' }); body.appendChild(narr);
    const X = (k) => 36 + k * 50;
    function draw() {
      svg.innerHTML = '';
      const w = W[sel];
      for (let j = 0; j <= sel; j++) {
        if (w[j] < 0.005) continue;
        const x1 = X(sel), x2 = X(j), mid = (x1 + x2) / 2, hgt = 30 + Math.abs(x1 - x2) * 0.25;
        svg.appendChild(s('path', { d: `M${x1},130 Q${mid},${130 - hgt * 1.4} ${x2},130`, class: 'arc', 'stroke-width': 1 + w[j] * 12, 'stroke-opacity': 0.25 + w[j] * 0.75 }));
        svg.appendChild(s('text', { x: x2, y: 182, 'text-anchor': 'middle', class: 'lab tiny t-bwd' }, fmt(w[j], 2)));
      }
      toks.forEach((c, k) => {
        const g = s('g', { class: 'atok ' + kind(c) + (k === sel ? ' sel' : '') + (k > sel ? ' fut' : ''), tabindex: 0, role: 'button', 'aria-label': '查看 ' + (c === ' ' ? '空格' : c) + ' 的注意力' });
        g.append(s('rect', { x: X(k) - 19, y: 132, width: 38, height: 32, rx: 5 }), s('text', { x: X(k), y: 154, 'text-anchor': 'middle', class: 'tok' }, show(c)));
        const pick = () => { sel = k; draw(); };
        g.addEventListener('click', pick); g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
        svg.appendChild(g);
      });
      // heatmap
      heatWrap.innerHTML = '';
      const tbl = h('div', { class: 'hm', style: { gridTemplateColumns: `repeat(${T + 1}, minmax(0, 1fr))` } });
      tbl.appendChild(h('span'));
      toks.forEach((c) => tbl.appendChild(h('span', { class: 'hm-h' }, show(c))));
      W.forEach((row, i) => { tbl.appendChild(h('span', { class: 'hm-h' + (i === sel ? ' t-bwd' : '') }, show(toks[i]))); row.forEach((v, j) => tbl.appendChild(h('span', { class: 'hm-c' + (j > i ? ' masked' : '') + (i === sel ? ' selrow' : ''), style: { '--a': j > i ? 0 : 0.08 + v * 0.92 } }))); });
      heatWrap.appendChild(tbl);
      const c = toks[sel], kd = kind(c);
      narr.innerHTML = `“${show(c)}” 是${kd === 'v' ? '元音' : kd === 'c' ? '辅音' : '空格'}。` + (kd === 'v' ? '它的 query 在找辅音，于是注意力落在前面的辅音上。' : kd === 'c' ? '它的 query 在找元音。' : '它的 query 是全 0，对所有过去 token 一视同仁，退化成 version 2 的平均。') + ' 右边是整张 T×T 权重矩阵：上三角被 mask 掉（不能看未来），每行加起来为 1。';
    }
    draw();
  });

  /* ---------- 7d: why divide by sqrt(head_size) ---------- */
  Z.demo('d-scale', (fig) => {
    const body = fig.querySelector('.demo-body');
    let d = 64, scaled = false;
    const c = Z.canvas(body, 190);
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' }); body.appendChild(narr);
    function draw() {
      const r = Z.rng(77);
      const q = Array.from({ length: d }, () => r.randn());
      const ks = Array.from({ length: 8 }, () => Array.from({ length: d }, () => r.randn()));
      const dots = ks.map((k) => k.reduce((a, v, t) => a + v * q[t], 0));
      // empirical variance
      const r2 = Z.rng(5); const samp = [];
      for (let n = 0; n < 400; n++) { let a = 0; for (let t = 0; t < d; t++) a += r2.randn() * r2.randn(); samp.push(a); }
      const v = Z.std(samp) ** 2;
      const p = Z.softmax(dots, scaled ? 1 / Math.sqrt(d) : 1);
      const { ctx, w, h: H } = c; ctx.clearRect(0, 0, w, H);
      const bw = (w - 40) / 8, base = H - 28;
      ctx.font = '11px ' + Z.MONO; ctx.textAlign = 'center';
      p.forEach((pv, k) => { ctx.fillStyle = Z.color('fwd'); ctx.fillRect(20 + k * bw + 6, base - pv * (base - 20), bw - 12, pv * (base - 20)); ctx.fillStyle = Z.color('ink'); ctx.fillText(fmt(pv, 2), 20 + k * bw + bw / 2, base - pv * (base - 20) - 5); ctx.fillStyle = Z.color('muted'); ctx.fillText('k' + (k + 1), 20 + k * bw + bw / 2, base + 16); });
      ctx.textAlign = 'left'; ctx.fillStyle = Z.color('muted'); ctx.fillText(`softmax(q·k${scaled ? ' / √' + d : ''})，8 个 key`, 20, 12);
      const maxp = Math.max(...p);
      narr.innerHTML = `head_size = ${d}：q、k 都是单位方差时，q·k 的方差约为 <b>${fmt(v, 1)}</b>（理论值 = ${d}）。` + (scaled ? `除以 √${d} 之后方差回到 1，softmax 比较平缓，最大权重 ${fmt(maxp, 2)}。` : `不缩放时数值很大，softmax 变得很尖，最大权重 ${fmt(maxp, 2)}，几乎是 one-hot：每个 token 只从一个 token 那里拿信息。`) + ' 这就是 “scaled” dot-product attention 里 scaled 的来历。';
    }
    c.draw = draw;
    const sl = Z.slider('scale-d', 'head_size', 0, 8, 1, 6, (v) => { d = 2 ** v; draw(); }, (v) => String(2 ** v));
    fig.querySelector('.controls-slot').append(h('div', { class: 'controls' }, sl, Z.check('scale-on', '除以 √head_size', false, (v) => { scaled = v; draw(); })));
    draw();
  });

  /* ---------- 7e: the transformer block: communicate, then compute; residual highway ---------- */
  Z.demo('d-block', (fig) => {
    const body = fig.querySelector('.demo-body');
    const svg = s('svg', { viewBox: '0 0 720 420', class: 'block', role: 'img', 'aria-label': 'Transformer 块：残差主干与分支' });
    const sc = h('div', { class: 'scroll-x' }); svg.style.minWidth = '520px'; sc.appendChild(svg); body.appendChild(sc);
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' }); body.appendChild(narr);
    const mx = 170;
    const items = {};
    const box = (id, x, y, w, hh, label, cls) => { const g = s('g', { class: 'bx ' + (cls || '') }); g.append(s('rect', { x, y, width: w, height: hh, rx: 6 }), s('text', { x: x + w / 2, y: y + hh / 2 + 5, 'text-anchor': 'middle' }, label)); svg.appendChild(g); items[id] = g; return g; };
    const line = (id, d, cls) => { const p = s('path', { d, class: 'edge ' + (cls || '') }); svg.insertBefore(p, svg.firstChild); items[id] = p; return p; };
    // trunk
    line('trunk', `M${mx},400 L${mx},40`, 'trunk');
    box('in', mx - 110, 360, 220, 34, 'token 嵌入 + 位置嵌入', 'io');
    const blockY = [250, 120];
    blockY.forEach((y, b) => {
      // attention branch
      line('a' + b, `M${mx},${y + 90} C${mx + 60},${y + 90} ${mx + 60},${y + 70} ${mx + 90},${y + 70} L${mx + 330},${y + 70} C${mx + 380},${y + 70} ${mx + 380},${y + 55} ${mx + 10},${y + 55}`, 'branch');
      box('ln1' + b, mx + 100, y + 56, 64, 28, 'LN');
      box('att' + b, mx + 180, y + 52, 150, 36, '多头注意力', 'comm');
      box('plus1' + b, mx - 13, y + 42, 26, 26, '+', 'plus');
      // ffn branch
      line('f' + b, `M${mx},${y + 35} C${mx + 60},${y + 35} ${mx + 60},${y + 15} ${mx + 90},${y + 15} L${mx + 330},${y + 15} C${mx + 380},${y + 15} ${mx + 380},${y} ${mx + 10},${y}`, 'branch');
      box('ln2' + b, mx + 100, y + 1, 64, 28, 'LN');
      box('ffn' + b, mx + 180, y - 3, 150, 36, '前馈 MLP', 'comp');
      box('plus2' + b, mx - 13, y - 13, 26, 26, '+', 'plus');
      svg.appendChild(s('text', { x: mx + 395, y: y + 75, class: 'lab small' }, b === 0 ? '通信：token 之间交换信息' : ''));
      svg.appendChild(s('text', { x: mx + 395, y: y + 20, class: 'lab small' }, b === 0 ? '计算：每个 token 各自处理' : ''));
    });
    svg.appendChild(s('text', { x: mx + 395, y: 160, class: 'lab small muted' }, '× N 层（他放大到 6 层）'));
    box('out', mx - 110, 14, 220, 30, 'LN → Linear → logits', 'io');
    svg.appendChild(s('text', { x: mx - 30, y: 340, 'text-anchor': 'end', class: 'lab small' }, '残差主干'));
    const all = Object.values(items);
    const on = (ids, cls) => ids.forEach((id) => items[id] && items[id].classList.add(cls));
    const steps = [
      () => { on(['in'], 'hi-f'); return '输入：token 嵌入加上位置嵌入。attention 本身只是在一组向量上做加权平均，不知道谁在前谁在后，所以位置信息要显式加进去。'; },
      () => { on(['in', 'a0', 'ln1' + 0, 'att0'], 'hi-f'); return '<b>通信</b>：多头注意力。多个独立的 head 并行（他类比分组卷积），每个 head 维度更小，结果拼接后投影回主干。loss 从单头的 2.4 降到 2.28。'; },
      () => { on(['in', 'a0', 'att0', 'plus10', 'trunk'], 'hi-f'); return '<b>残差连接</b>：分支的结果加回主干，而不是替换主干。加上残差后 loss 到 2.08。'; },
      () => { on(['f0', 'ln20', 'ffn0', 'plus20'], 'hi-f'); return '<b>计算</b>：每个 token 各自过一个 MLP（隐藏层是 4 倍宽）。他的说法：token 们先通过 attention 互相收集信息，然后各自“想一想”收到的东西。加 FFN 后 2.24。'; },
      () => { on(['a1', 'att1', 'ln11', 'plus11', 'f1', 'ffn1', 'ln21', 'plus21', 'out', 'trunk'], 'hi-f'); return '重复 N 次，最后 LayerNorm + 线性层得到 logits。LayerNorm 和 BatchNorm 是同一个公式，只是沿每个样本的特征维度归一化，不需要 batch 统计量。现代做法是 pre-norm：LN 放在分支入口。'; },
      () => { on(['trunk', 'plus10', 'plus20', 'plus11', 'plus21', 'in', 'out'], 'hi-b'); on(['a0', 'f0', 'a1', 'f1'], 'hi-b2'); return '<span class="t-bwd">反向</span>：加法把梯度原样分发（第 1 集的结论），所以梯度能沿主干从 loss 直通输入，他称之为<b>梯度高速公路</b>，同时也分叉流进每个块。块在初始化时贡献很小，像是不存在，训练过程中才逐渐“上线”。'; },
    ];
    Z.player(fig, { n: steps.length, render: (i) => { all.forEach((e) => e.classList.remove('hi-f', 'hi-b', 'hi-b2')); narr.innerHTML = steps[i](); }, controlsParent: fig.querySelector('.controls-slot'), interval: 2800 });
  });

  /* ---------- 7f: Shakespeare loss log ---------- */
  Z.demo('d-glog', (fig) => {
    const body = fig.querySelector('.demo-body');
    const rows = [['bigram 基线', 2.5], ['+ 单头 self-attention', 2.4], ['+ 多头', 2.28], ['+ 前馈层', 2.24], ['+ 残差连接', 2.08], ['+ LayerNorm', 2.06], ['放大：384 维 · 6 头 · 6 层 · 上下文 256 · dropout 0.2', 1.48]];
    const lo = 1.3, hi = 2.6;
    const list = h('div', { class: 'ladder' });
    rows.forEach(([lab, v]) => list.appendChild(h('div', { class: 'lad-row' }, h('span', { class: 'lad-lab' }, lab), h('span', { class: 'lad-bar' }, h('i', { style: { width: ((v - lo) / (hi - lo)) * 100 + '%' } })), h('b', { class: 'lad-v' }, String(v)), h('span', { class: 'lad-note' }, ''))));
    body.appendChild(list);
    body.appendChild(h('p', { class: 'hint' }, '每一行是在上一行的基础上加一个部件后他报出的 val loss（Tiny Shakespeare，字符级，65 类，均匀乱猜 = ln 65 ≈ 4.17）。最后一步他在 A100 上训练了约 15 分钟。'));
  });
})();
