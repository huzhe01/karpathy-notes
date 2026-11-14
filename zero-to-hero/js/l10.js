/* Lecture 10 · Let's reproduce GPT-2 (124M) */
(function () {
  const { h, s, fmt } = Z;

  /* ---------- 10a: where the 124M parameters live ---------- */
  Z.demo('d-params', (fig) => {
    const body = fig.querySelector('.demo-body');
    const d = 768, Vv = 50257, Tt = 1024, L = 12;
    const blk = { ln: 2 * (2 * d), attn: d * 3 * d + 3 * d + d * d + d, mlp: d * 4 * d + 4 * d + 4 * d * d + d };
    const perBlock = blk.ln + blk.attn + blk.mlp;
    let tied = true;
    const bar = h('div', { class: 'pbar-stack', role: 'img', 'aria-label': 'GPT-2 124M 参数分布' });
    const legend = h('div', { class: 'plegend' });
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' });
    body.append(bar, legend, narr);
    function draw() {
      const parts = [
        ['wte 词嵌入  50257 × 768', Vv * d, 'pc1'],
        ['wpe 位置嵌入  1024 × 768', Tt * d, 'pc2'],
        ['12 × 注意力（qkv + 投影）', L * blk.attn, 'pc3'],
        ['12 × MLP（768 → 3072 → 768）', L * blk.mlp, 'pc4'],
        ['LayerNorm（25 个）', L * blk.ln + 2 * d, 'pc5'],
      ];
      if (!tied) parts.push(['lm_head  768 × 50257（不共享时）', Vv * d, 'pc6']);
      const tot = parts.reduce((a, p) => a + p[1], 0);
      bar.innerHTML = ''; legend.innerHTML = '';
      parts.forEach(([lab, n, cls]) => {
        bar.appendChild(h('span', { class: 'pseg ' + cls, style: { flexGrow: n }, title: lab + ': ' + n.toLocaleString() }));
        legend.appendChild(h('div', { class: 'pl' }, h('i', { class: 'sw ' + cls }), h('span', null, lab), h('b', null, (n / 1e6).toFixed(2) + 'M'), h('span', { class: 'muted' }, fmt((100 * n) / tot, 1) + '%')));
      });
      narr.innerHTML = `总计 <b>${tot.toLocaleString()}</b> 个参数。` + (tied
        ? '输入端的 wte 和输出端的 lm_head 是同一个矩阵（weight tying）。GPT-2 原版就这么做：语义相近的 token 在输入端应该有相近的嵌入，在输出端也应该得到相近的概率。他算了一下，这省掉了约 30% 的参数。'
        : `不共享的话多出 ${(Vv * d / 1e6).toFixed(1)}M，lm_head 单独占 ${fmt((100 * Vv * d) / tot, 0)}%。`) + ` 另外两个他在开头就算的数：初始化时的 loss 应该约等于 −ln(1/50257) = ${fmt(Math.log(50257), 2)}；每个块 ${(perBlock / 1e6).toFixed(2)}M 参数。`;
    }
    fig.querySelector('.controls-slot').append(h('div', { class: 'controls' }, Z.check('params-tie', 'wte 与 lm_head 共享权重', true, (v) => { tied = v; draw(); })));
    draw();
  });

  /* ---------- 10b: making it fast ---------- */
  Z.demo('d-speed', (fig) => {
    const body = fig.querySelector('.demo-body');
    const st = [
      ['float32 基线', 1000, 'A100，每步 B=16、T=1024 = 16,384 个 token，全部默认 float32。'],
      ['TF32 矩阵乘', 333, '<code>torch.set_float32_matmul_precision("high")</code>：矩阵乘在 Tensor Core 上用 TF32（尾数截短）。纸面上快 8 倍，实测约 3 倍，因为大部分时间在等显存搬数据，而不是在算。'],
      ['bfloat16 autocast', 300, '<code>torch.autocast(dtype=torch.bfloat16)</code>：激活用 bf16。它的指数位和 fp32 一样，所以不需要 fp16 那套 gradient scaler。只有一部分算子会被转换，收益不大。'],
      ['torch.compile', 130, '把整个模型交给编译器：去掉 Python 解释器开销，把一串逐元素运算融合成一个 kernel，数据只在芯片上走一趟，不用反复写回显存（HBM）再读出来。'],
      ['FlashAttention', 96, '编译器找不到的融合：用 online softmax 分块算注意力，T×T 的注意力矩阵从不写进显存。FLOPs 反而更多，但内存读写少得多。'],
      ['50257 → 50304', 93, '他说这是“最蠢也最聪明”的优化：把词表补到 128 的倍数。CUDA kernel 按 2 的幂分块，丑陋的数字会掉进低效的边界处理分支。多算几十个永远用不到的 token，反而更快。'],
      ['fused AdamW 等', 90, '按 GPT-3 论文设超参（AdamW β=(0.9, 0.95)、梯度裁剪 1.0、weight decay 0.1），并用 fused 版 AdamW：所有参数的更新合成一个 kernel。'],
    ];
    const list = h('div', { class: 'speed' });
    const rows = st.map(([lab, ms]) => { const r = h('div', { class: 'sp-row' }, h('span', { class: 'sp-lab' }, lab), h('span', { class: 'sp-bar' }, h('i')), h('b', { class: 'sp-ms' }, ms + ' ms'), h('span', { class: 'sp-tok' }, Math.round(16384 / (ms / 1000)).toLocaleString() + ' tok/s')); list.appendChild(r); return r; });
    body.appendChild(list);
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' }); body.appendChild(narr);
    Z.player(fig, {
      n: st.length,
      render: (i) => {
        rows.forEach((r, k) => { r.classList.toggle('on', k === i); r.classList.toggle('hide', k > i); r.querySelector('i').style.width = (k <= i ? st[k][1] / 10 : 0) + '%'; });
        narr.innerHTML = st[i][2] + (i ? `　累计提速 <b>${fmt(1000 / st[i][1], 1)}×</b>。` : '');
      },
      controlsParent: fig.querySelector('.controls-slot'), interval: 2600, start: st.length - 1,
    });
  });

  /* ---------- 10c: learning-rate schedule ---------- */
  Z.demo('d-lr', (fig) => {
    const body = fig.querySelector('.demo-body');
    const maxLR = 6e-4, minLR = maxLR * 0.1, warm = 715, maxS = 19073;
    const lr = (it) => { if (it < warm) return (maxLR * (it + 1)) / warm; if (it > maxS) return minLR; const r = (it - warm) / (maxS - warm); return minLR + 0.5 * (1 + Math.cos(Math.PI * r)) * (maxLR - minLR); };
    const c = Z.canvas(body, 220);
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' }); body.appendChild(narr);
    let cur = 400;
    const pts = []; for (let i = 0; i <= maxS; i += 40) pts.push([i, lr(i) * 1e4]);
    function draw() {
      const g = Z.chart(c, { x: [0, maxS], y: [0, 6.5], xticks: [0, 715, 5000, 10000, 15000, 19073], yticks: [0, 0.6, 2, 4, 6], yfmt: (v) => v + 'e-4', series: [{ pts, color: 'fwd', width: 2 }], vlines: [{ x: cur, color: 'bwd' }], xlabel: 'step' });
      c.ctx.fillStyle = Z.color('bwd'); c.ctx.beginPath(); c.ctx.arc(g.X(cur), g.Y(lr(cur) * 1e4), 5, 0, 7); c.ctx.fill();
      const tok = cur * 524288;
      narr.innerHTML = `step ${cur.toLocaleString()}：lr = <b>${lr(cur).toExponential(2)}</b>，已经看过 ${(tok / 1e9).toFixed(2)}B 个 token。` + (cur < warm ? ' 预热阶段：从接近 0 线性升到最大值。715 步是这样来的：GPT-3 论文说在前 3.75 亿 token 里预热，375e6 ÷ 2¹⁹ ≈ 715。' : ' 余弦衰减：平滑地降到最大值的 10%。总共 19,073 步 × 2¹⁹ token ≈ 100 亿 token，正好是 FineWeb-Edu 10B 样本的一个 epoch。');
    }
    c.draw = draw;
    const sl = Z.slider('lr-step', 'step', 0, maxS, 1, cur, (v) => { cur = v; draw(); }, (v) => String(v));
    fig.querySelector('.controls-slot').append(h('div', { class: 'controls' }, sl, Z.button('预热段', () => sl.set(300)), Z.button('中段', () => sl.set(9000)), Z.button('结束', () => sl.set(maxS))));
    draw();
  });

  /* ---------- 10d: gradient accumulation + DDP ---------- */
  Z.demo('d-accum', (fig) => {
    const body = fig.querySelector('.demo-body');
    let gpus = 8;
    const svg = s('svg', { viewBox: '0 0 720 250', class: 'accum', role: 'img', 'aria-label': '梯度累积与多卡数据并行' });
    body.appendChild(svg);
    const code = h('pre', { class: 'code small' });
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' });
    body.append(code, narr);
    let player = null;
    const slot = fig.querySelector('.controls-slot');
    const segWrap = h('div', { class: 'controls' }, Z.seg('accum-gpus', [['8', '8 张 GPU (DDP)'], ['1', '1 张 GPU']], '8', (v) => { gpus = +v; build(); }));
    slot.appendChild(segWrap);
    const pslot = h('div'); slot.appendChild(pslot);
    function build() {
      if (player) player.stop();
      const accum = 524288 / (16 * 1024 * gpus);
      code.textContent = `total_batch_size = 524288          # 2**19，约 0.5M token（GPT-3 小模型的设定）\nB, T = 16, 1024                     # 一张卡一次只放得下 16 × 1024\ngrad_accum_steps = total_batch_size // (B * T * ${gpus})   # = ${accum}\nfor micro_step in range(grad_accum_steps):\n    loss = model(x, y) / grad_accum_steps   # 别忘了除，否则相当于 sum 而不是 mean\n    loss.backward()                      # 梯度在 .grad 里累加\noptimizer.step()`;
      const lanes = gpus, show = Math.min(accum, 32);
      const n = accum + 2;
      pslot.innerHTML = '';
      const render = (i) => {
        svg.innerHTML = '';
        const laneH = Math.min(22, 190 / lanes), cell = Math.min(18, 470 / show);
        for (let g = 0; g < lanes; g++) {
          const y = 20 + g * (laneH + 2);
          svg.appendChild(s('text', { x: 10, y: y + laneH * 0.7, class: 'lab tiny' }, 'GPU ' + g));
          for (let m = 0; m < show; m++) svg.appendChild(s('rect', { x: 60 + m * cell, y, width: cell - 2, height: laneH, rx: 2, class: 'mb' + (m < i && i <= accum ? ' on' : m < accum && i > accum ? ' on' : '') }));
        }
        const filled = Math.min(i, accum) / accum;
        const bx = 580, by = 30, bh = 160;
        svg.appendChild(s('rect', { x: bx, y: by, width: 70, height: bh, rx: 6, class: 'bucket' }));
        svg.appendChild(s('rect', { x: bx + 3, y: by + bh - 3 - filled * (bh - 6), width: 64, height: filled * (bh - 6), rx: 4, class: 'bucket-fill' + (i > accum ? ' synced' : '') }));
        svg.appendChild(s('text', { x: bx + 35, y: by - 8, 'text-anchor': 'middle', class: 'lab tiny' }, '.grad'));
        svg.appendChild(s('text', { x: 60, y: 240, class: 'lab small' }, i === 0 ? '' : i <= accum ? `micro step ${i} / ${accum}：已累积 ${(Math.min(i, accum) * 16384 * gpus).toLocaleString()} 个 token` : i === accum + 1 ? (gpus > 1 ? 'all-reduce：8 张卡的梯度取平均' : '累积完成') : 'optimizer.step()：更新一次参数'));
        narr.innerHTML = i === 0
          ? `GPT-3 论文里 124M 模型的 batch 是 0.5M token，一张卡放不下。${gpus > 1 ? '8 张卡各自处理不同的数据切片，每张卡累积 ' + accum + ' 次' : '只有一张卡就累积 ' + accum + ' 次'}，凑够 524,288 个 token 再更新一次。`
          : i <= accum ? '每个 micro step 前向 + 反向，梯度在 <code>.grad</code> 里累加，先不更新参数。' : i === accum + 1 ? (gpus > 1 ? 'DDP：在最后一个 micro step 的 backward 里，各卡之间做一次 all-reduce 把梯度平均（中间几步关掉同步，省通信）。用 torchrun 启动 8 个进程，每个进程一张卡。' : '梯度已经是整批 0.5M token 的平均。') : '一次更新等价于一个 0.5M token 的大 batch。他在 8×A100 上实测每步约 330ms，跑完 19,073 步约 1.7 小时。';
      };
      player = Z.player(fig, { n, render, controlsParent: pslot, interval: accum > 8 ? 260 : 900 });
    }
    build();
  });

  /* ---------- 10e: results ---------- */
  Z.demo('d-result', (fig) => {
    const body = fig.querySelector('.demo-body');
    const svg = s('svg', { viewBox: '0 0 720 170', class: 'result', role: 'img', 'aria-label': '训练 token 数对比（对数轴）' });
    body.appendChild(svg);
    const X = (b) => 60 + ((Math.log10(b) - 0.5) / (2.7 - 0.5)) * 600;
    svg.appendChild(s('line', { x1: 60, x2: 660, y1: 120, y2: 120, class: 'axis' }));
    [3, 10, 30, 100, 300].forEach((t) => { svg.appendChild(s('line', { x1: X(t), x2: X(t), y1: 116, y2: 124, class: 'axis' })); svg.appendChild(s('text', { x: X(t), y: 140, 'text-anchor': 'middle', class: 'lab tiny' }, t + 'B')); });
    svg.appendChild(s('text', { x: 660, y: 160, 'text-anchor': 'end', class: 'lab tiny' }, '训练用的 token 数（对数轴）'));
    const mark = (b, lab, sub, cls, y) => { svg.appendChild(s('circle', { cx: X(b), cy: 120, r: 7, class: 'mk ' + cls })); svg.appendChild(s('line', { x1: X(b), x2: X(b), y1: 113, y2: y + 8, class: 'lead' })); svg.appendChild(s('text', { x: X(b), y, 'text-anchor': 'middle', class: 'lab ' + cls }, lab)); svg.appendChild(s('text', { x: X(b), y: y + 16, 'text-anchor': 'middle', class: 'lab tiny' }, sub)); };
    mark(10, '这次复现', 'FineWeb-Edu 10B，一个 epoch', 'ours', 30);
    mark(100, 'OpenAI GPT-2 124M', '他在视频里说的约 100B', 'g2', 30);
    mark(300, 'GPT-3 124M', '300B', 'g3', 70);
    body.appendChild(h('p', { class: 'narr' }, 'HellaSwag（四选一，随机 25%）上，这次训练从 25% 一路涨上去，超过了 OpenAI 发布的 GPT-2 124M，往 GPT-3 124M 靠近，用的 token 只有 GPT-2 的约十分之一。他也提醒了几个保留意见：FineWeb-Edu 只有英文、少数学和代码，原版 GPT-2 的数据更杂；HellaSwag 很老，可能已经混进训练数据；loss 曲线上有周期性波动，他怀疑是数据没打乱。'));
  });
})();
