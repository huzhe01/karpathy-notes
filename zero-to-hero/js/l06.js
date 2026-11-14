/* Lecture 06 · makemore 5: WaveNet */
(function () {
  const { h, s, fmt } = Z;

  /* ---------- 6a: flat vs hierarchical fusion ---------- */
  Z.demo('d-wavenet', (fig) => {
    const body = fig.querySelector('.demo-body');
    const svg = s('svg', { viewBox: '0 0 720 300', class: 'wave', role: 'img', 'aria-label': '扁平 MLP 与分层融合的对比' });
    const sc = h('div', { class: 'scroll-x' }); svg.style.minWidth = '560px'; sc.appendChild(svg); body.appendChild(sc);
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' }); body.appendChild(narr);
    const ctx = ['.', '.', 'i', 's', 'a', 'b', 'e', 'l'];
    const X = (k) => 80 + k * 76;
    const levels = [270, 200, 135, 70];
    const gE = s('g'), gN = s('g'); svg.append(gE, gN);
    const nodes = [[], [], [], []], edges = [[], [], [], []];
    ctx.forEach((ch, k) => { const g = s('g', { class: 'wn in' }); g.append(s('rect', { x: X(k) - 18, y: levels[0] - 18, width: 36, height: 30, rx: 4 }), s('text', { x: X(k), y: levels[0] + 2, 'text-anchor': 'middle', class: 'tok' }, ch)); gN.appendChild(g); nodes[0].push({ g, x: X(k) }); });
    for (let l = 1; l < 4; l++) {
      const prev = nodes[l - 1];
      for (let k = 0; k < prev.length / 2; k++) {
        const a = prev[2 * k], b = prev[2 * k + 1], x = (a.x + b.x) / 2;
        const ea = s('path', { d: `M${a.x},${levels[l - 1] - 18} C${a.x},${levels[l] + 25} ${x},${levels[l] + 30} ${x},${levels[l] + 12}`, class: 'edge' });
        const eb = s('path', { d: `M${b.x},${levels[l - 1] - 18} C${b.x},${levels[l] + 25} ${x},${levels[l] + 30} ${x},${levels[l] + 12}`, class: 'edge' });
        gE.append(ea, eb); edges[l].push(ea, eb);
        const g = s('g', { class: 'wn hid' }); g.append(s('circle', { cx: x, cy: levels[l], r: 12 })); gN.appendChild(g);
        nodes[l].push({ g, x });
      }
    }
    // flat view: all 8 straight into one node
    const flatNode = s('g', { class: 'wn hid flat' }); flatNode.append(s('circle', { cx: 346, cy: 90, r: 18 }), s('text', { x: 346, y: 95, 'text-anchor': 'middle', class: 'lab' }, 'h'));
    gN.appendChild(flatNode);
    const flatE = ctx.map((_, k) => { const e = s('path', { d: `M${X(k)},${levels[0] - 18} C${X(k)},150 346,170 346,108`, class: 'edge' }); gE.appendChild(e); return e; });
    const out = s('text', { x: 346, y: 26, 'text-anchor': 'middle', class: 'lab t-bwd' }, 'P(下一个字符 = “l”)');
    svg.appendChild(out);
    const shape = s('text', { x: 700, y: 290, 'text-anchor': 'end', class: 'shape' }); svg.appendChild(shape);
    const show = (flat, upto) => {
      flatNode.style.opacity = flat ? 1 : 0; flatE.forEach((e) => { e.style.opacity = flat ? 1 : 0; e.classList.toggle('on-f', flat); });
      for (let l = 1; l < 4; l++) { const vis = !flat && l <= upto; nodes[l].forEach((n) => { n.g.style.opacity = vis ? 1 : 0; }); edges[l].forEach((e) => { e.style.opacity = vis ? 1 : 0; e.classList.toggle('on-f', vis && l === upto); }); }
    };
    const steps = [
      () => { show(true, 0); shape.textContent = '[B, 8×10] → [B, 200]'; return '上下文从 3 加到 8 后，最简单的做法是把 8 个字符的嵌入一次性拼起来塞进一个隐藏层。val loss 从 2.10 降到 2.02。他的评价：这样“太快地挤压了太多信息”。'; },
      () => { show(false, 0); shape.textContent = 'emb: [B, 8, 10]'; return 'WaveNet（DeepMind 2016，原本用来生成音频）的思路：不要一次吃掉，逐层两两融合。'; },
      () => { show(false, 1); shape.textContent = 'FlattenConsecutive(2): [B, 4, 20] → Linear → [B, 4, 68]'; return '第 1 层：相邻两个字符融合成一个“bigram 表示”，得到 4 个节点。关键实现：PyTorch 的矩阵乘只作用于最后一维，前面的 [B, 4] 都被当成 batch。'; },
      () => { show(false, 2); shape.textContent = '[B, 2, 136] → Linear → [B, 2, 68]'; return '第 2 层：再两两融合，每个节点看到 4 个字符。'; },
      () => { show(false, 3); shape.textContent = '[B, 136] → Linear → [B, 68] → [B, 27]'; return '第 3 层：融合成 1 个节点，看到全部 8 个字符，再接输出层。他把隐藏单元设成 68，让总参数量和扁平版一样约 22,000，方便公平比较。'; },
    ];
    Z.player(fig, { n: steps.length, render: (i) => { narr.innerHTML = steps[i](); }, controlsParent: fig.querySelector('.controls-slot'), interval: 2400 });
  });

  /* ---------- 6b: the performance log ---------- */
  Z.demo('d-wlog', (fig) => {
    const body = fig.querySelector('.demo-body');
    const rows = [
      ['原始 MLP，上下文 3', 2.10, '上一集的终点'],
      ['上下文 3 → 8（扁平）', 2.02, '只改 block_size'],
      ['分层（参数量相同）', 2.029, '先打平，没有立刻变好'],
      ['修好 BatchNorm1d 的 bug', 2.022, '略有改善'],
      ['放大到约 76,000 参数', 1.993, '第一次跌破 2.0'],
    ];
    const list = h('div', { class: 'ladder' });
    const lo = 1.95, hi = 2.12;
    rows.forEach(([lab, v, note]) => list.appendChild(h('div', { class: 'lad-row' }, h('span', { class: 'lad-lab' }, lab), h('span', { class: 'lad-bar' }, h('i', { style: { width: ((v - lo) / (hi - lo)) * 100 + '%' } })), h('b', { class: 'lad-v' }, v.toFixed(3).replace(/0$/, '')), h('span', { class: 'lad-note' }, note))));
    body.appendChild(list);
    body.appendChild(h('p', { class: 'hint' }, '数字取自视频里他念出的 val loss。条形长度从 1.95 起算，只为看清差别。'));
  });

  /* ---------- 6c: the BatchNorm1d bug with 3-D input ---------- */
  Z.demo('d-bnbug', (fig) => {
    const body = fig.querySelector('.demo-body');
    const svg = s('svg', { viewBox: '0 0 720 210', class: 'bnbug', role: 'img', 'aria-label': 'BatchNorm 在三维输入上应该对哪些维度求均值' });
    body.appendChild(svg);
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' }); body.appendChild(narr);
    const cells = [];
    const ox = 60, oy = 40, cw = 22, chh = 18, dx = 14, dy = -10;
    for (let b = 5; b >= 0; b--) for (let t = 0; t < 4; t++) for (let c = 0; c < 6; c++) {
      const x = ox + c * cw + b * dx, y = oy + t * chh + b * dy + 60;
      const r = s('rect', { x, y, width: cw - 2, height: chh - 2, class: 'cube', 'data-b': b, 'data-t': t, 'data-c': c });
      svg.appendChild(r); cells.push(r);
    }
    svg.appendChild(s('text', { x: 60, y: 30, class: 'lab' }, 'x: [32, 4, 68]  =  [batch, 位置, 通道]'));
    const outT = s('text', { x: 360, y: 90, class: 'lab code-t' }), outT2 = s('text', { x: 360, y: 112, class: 'lab' }), outT3 = s('text', { x: 360, y: 134, class: 'lab' });
    svg.append(outT, outT2, outT3);
    const steps = [
      () => { cells.forEach((c) => c.setAttribute('class', 'cube' + (+c.dataset.c === 0 && +c.dataset.t === 0 ? ' sel' : ''))); outT.textContent = 'x.mean(0, keepdim=True)'; outT2.textContent = '→ [1, 4, 68]：每个(位置, 通道)各有一套统计量'; outT3.textContent = '高亮：只在 batch 方向上取了 32 个数求均值'; return '分层之后，进 BatchNorm 的张量变成了三维。他的 BatchNorm1d 写的是 <code>mean(0)</code>，结果为 4 个位置分别维护了均值和方差，每套只用 32 个样本估计。代码照样能跑，不报错。'; },
      () => { cells.forEach((c) => c.setAttribute('class', 'cube' + (+c.dataset.c === 0 ? ' sel' : ''))); outT.textContent = 'x.mean((0, 1), keepdim=True)'; outT2.textContent = '→ [1, 1, 68]：每个通道一套统计量'; outT3.textContent = '高亮：batch 和位置两个方向一起，32×4 = 128 个数'; return '改成对 (0, 1) 两个维度求均值：每个通道只有一套统计量，用 128 个数估计，更稳。running mean 的形状也从 [1,4,68] 变成 [1,1,68]，这正是他发现 bug 的线索。修完 val loss 2.029 → 2.022。'; },
    ];
    Z.player(fig, { n: steps.length, render: (i) => { narr.innerHTML = steps[i](); }, controlsParent: fig.querySelector('.controls-slot'), interval: 3000 });
  });

  /* ---------- 6d: dilated causal convolution = the tree slid along the sequence ---------- */
  Z.demo('d-conv', (fig) => {
    const body = fig.querySelector('.demo-body');
    const T = 16;
    const svg = s('svg', { viewBox: '0 0 720 230', class: 'conv', role: 'img', 'aria-label': '空洞因果卷积：同一棵树沿序列滑动，复用中间结果' });
    const sc = h('div', { class: 'scroll-x' }); svg.style.minWidth = '560px'; sc.appendChild(svg); body.appendChild(sc);
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' }); body.appendChild(narr);
    const X = (k) => 30 + k * 44, Ys = [205, 150, 95, 40];
    const node = {};
    const gE = s('g'), gN = s('g'); svg.append(gE, gN);
    for (let l = 0; l < 4; l++) for (let t = 0; t < T; t++) {
      if (l > 0 && t < (1 << l) - 1) continue;
      if (l > 0) {
        const d = 1 << (l - 1);
        for (const src of [t - d, t]) if (node[(l - 1) + ':' + src]) { const e = s('line', { x1: X(src), y1: Ys[l - 1] - 8, x2: X(t), y2: Ys[l] + 8, class: 'edge thin' }); gE.appendChild(e); node[(l - 1) + ':' + src].out = (node[(l - 1) + ':' + src].out || []).concat([[l, t, e]]); }
      }
      const c = s('circle', { cx: X(t), cy: Ys[l], r: l === 0 ? 7 : 8, class: 'cn l' + l }); gN.appendChild(c);
      node[l + ':' + t] = { c };
    }
    const tree = (t) => { const set = new Set(['3:' + t]); for (let l = 3; l > 0; l--) for (const k of [...set]) { const [ll, tt] = k.split(':').map(Number); if (ll !== l) continue; const d = 1 << (l - 1); set.add((l - 1) + ':' + (tt - d)); set.add((l - 1) + ':' + tt); } return set; };
    const first = 7;
    let computed = new Set();
    function render(i) {
      const t = first + i;
      computed = new Set(); for (let u = first; u < t; u++) for (const k of tree(u)) computed.add(k);
      const cur = tree(t);
      let reused = 0, fresh = 0;
      for (const [k, n] of Object.entries(node)) {
        const [l] = k.split(':').map(Number);
        const inCur = cur.has(k), was = computed.has(k);
        n.c.setAttribute('class', 'cn l' + l + (inCur ? (was && l > 0 ? ' reuse' : ' cur') : was ? ' done' : ''));
        if (inCur && l > 0) { if (was) reused++; else fresh++; }
      }
      Z.$$('line', gE).forEach((e) => e.classList.remove('on-f'));
      for (const k of cur) { const n = node[k]; (n.out || []).forEach(([l, tt, e]) => { if (cur.has(l + ':' + tt)) e.classList.add('on-f'); }); }
      narr.innerHTML = i === 0
        ? '要预测位置 t 的下一个字符，就用一棵 8 → 4 → 2 → 1 的树。对一个名字的每个位置都要做一次，最朴素的写法是 Python for 循环。'
        : `往右滑一格（t = ${t}）。这棵新树里有 ${reused} 个中间节点（橙色描边）在之前的位置已经算过，只需新算 ${fresh} 个。卷积把这个循环搬进 CUDA kernel，并自动复用这些节点，所以他说“dilated causal convolution”只是一个让计算更高效的实现细节，模型本身没变。`;
    }
    Z.player(fig, { n: T - first, render, controlsParent: fig.querySelector('.controls-slot'), interval: 1400 });
  });
})();
