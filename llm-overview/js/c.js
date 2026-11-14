/* Part 6: reinforcement learning, thinking models, AlphaGo, RLHF */
(function () {
  const { h, s, fmt } = Z;

  /* ---------- 6a: the textbook analogy ---------- */
  Z.demo('d-book', (fig) => {
    const body = fig.querySelector('.demo-body');
    const book = h('div', { class: 'book' });
    const parts = [
      ['讲解正文', '大段的背景知识和概念讲解', '预训练', '读互联网文档，积累知识，得到 base model。', 'zip'],
      ['例题与详解', '专家给出问题，并完整写出解法', '监督微调 SFT', '模仿专家（人类标注员）写的理想回答，得到助手。', 'ctx'],
      ['课后练习', '只给题目，答案在书后', '强化学习 RL', '自己反复尝试，只知道最终答案对不对，从中摸索出管用的解法。', 'tool'],
    ];
    const blocks = parts.map(([t, d, st, sd, c]) => { const b = h('div', { class: 'bk ' + c }, h('div', { class: 'bk-page' }, h('b', null, t), h('span', null, d)), h('div', { class: 'bk-map' }, h('b', null, '→ ' + st), h('span', null, sd))); book.appendChild(b); return b; });
    body.appendChild(book);
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' }); body.appendChild(narr);
    const say = [
      '他用上学来类比。课本里有三类内容，第一类是占大部分篇幅的讲解。',
      '第二类是例题：专家把题目和完整解法都写出来，你读解法，学着模仿。',
      '第三类是课后练习：只有题目和书后的答案。你得自己动手，在试错里发现怎么解。他说这对学习至关重要，而 LLM 的强化学习就是在做课后练习。',
    ];
    Z.player(fig, { n: 3, render: (i) => { blocks.forEach((b, k) => { b.classList.toggle('on', k === i); b.classList.toggle('dim', k > i); }); narr.innerHTML = say[i]; }, controlsParent: fig.querySelector('.controls-slot'), interval: 2800 });
  });

  /* ---------- 6b: toy RL on the Emily problem ---------- */
  Z.demo('d-rl', (fig) => {
    const body = fig.querySelector('.demo-body');
    const S = [
      { name: '直接报答案', len: 2, p: 0.3, c: 's1' },
      { name: '简短推理', len: 12, p: 0.65, c: 's2' },
      { name: '逐步推理', len: 28, p: 0.85, c: 's3' },
      { name: '推理并回头检查', len: 46, p: 0.96, c: 's5' },
    ];
    const N = 16;
    let th, it, hist, rng, last = [];
    const grid = h('div', { class: 'rl-grid' });
    const rolls = h('div', { class: 'rolls' });
    const right = h('div', { class: 'rl-right' });
    grid.append(h('div', null, h('p', { class: 'mini-title' }, `本轮对同一道题采样 ${N} 个解法`), rolls), right);
    body.appendChild(grid);
    const pol = h('div', { class: 'pol' });
    right.append(h('p', { class: 'mini-title' }, '策略：采到每种解法的概率'), pol, h('p', { class: 'mini-title' }, '准确率（橙）与平均回答长度（蓝）'));
    const c = Z.canvas(right, 150);
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' }); body.appendChild(narr);
    const pi = () => Z.softmax(th);
    function reset() { th = [1.4, 0.9, 0, -1.2]; it = 0; rng = Z.rng(7); hist = [stat()]; last = []; draw(); narr.innerHTML = '刚做完 SFT 的模型：大多模仿人写的简短解法。下面是玩具模拟：4 种解法和它们的成功率是我设定的，用来演示机制。'; }
    function stat() { const p = pi(); return [it, S.reduce((a, st, k) => a + p[k] * st.p, 0), S.reduce((a, st, k) => a + p[k] * st.len, 0)]; }
    function step() {
      const p = pi(); last = [];
      for (let n = 0; n < N; n++) { let u = rng(), k = 0, acc = 0; for (; k < S.length; k++) { acc += p[k]; if (u < acc) break; } k = Math.min(k, S.length - 1); last.push([k, rng() < S[k].p ? 1 : 0]); }
      const b = Z.mean(last.map((x) => x[1]));
      const g = new Array(S.length).fill(0);
      for (const [k, r] of last) for (let j = 0; j < S.length; j++) g[j] += (r - b) * ((j === k ? 1 : 0) - p[j]) / N;
      th = th.map((v, j) => v + 3 * g[j]);
      it++; hist.push(stat());
    }
    function draw() {
      rolls.innerHTML = '';
      (last.length ? last : []).forEach(([k, r]) => rolls.appendChild(h('div', { class: 'roll' }, h('span', { class: 'rbar ' + S[k].c, style: { width: (S[k].len / 46) * 100 + '%' } }), h('b', { class: r ? 'ok' : 'bad' }, r ? '✓' : '✗'))));
      if (!last.length) rolls.appendChild(h('p', { class: 'hint' }, '点“跑 1 轮”开始。'));
      const p = pi();
      pol.innerHTML = '';
      S.forEach((st, k) => pol.appendChild(h('div', { class: 'pol-row' }, h('span', { class: 'pol-lab' }, st.name), h('span', { class: 'pol-bar' }, h('i', { class: st.c, style: { width: p[k] * 100 + '%' } })), h('b', null, fmt(p[k] * 100, 0) + '%'))));
      drawChart();
    }
    function drawChart() {
      const n = Math.max(30, it);
      Z.chart(c, { x: [0, n], y: [0, 1], xticks: [0, n], yticks: [0, 0.5, 1], yfmt: (v) => (v * 100) + '%', series: [{ pts: hist.map(([i, a]) => [i, a]), color: 'risk', width: 2 }, { pts: hist.map(([i, , l]) => [i, l / 46]), color: 'ctx', width: 2 }], xlabel: '轮次', pad: { l: 40 } });
    }
    c.draw = drawChart;
    let busy = false;
    async function run(k) {
      if (busy) return; busy = true;
      for (let t = 0; t < k; t++) { step(); draw(); if (k > 1) await Z.sleep(70); }
      const [, acc, len] = hist.at(-1);
      narr.innerHTML = `第 ${it} 轮：期望准确率 <b class="t-risk">${fmt(acc * 100, 0)}%</b>，平均回答长度 <b class="t-ctx">${fmt(len, 0)}</b> 个 token。每轮对答对的解法加分、答错的减分。没人告诉它“写长一点”，只给了正确答案，长而仔细的解法因为更常答对，自己被强化起来。`;
      busy = false;
    }
    fig.querySelector('.controls-slot').append(h('div', { class: 'controls' }, Z.button('▶ 跑 1 轮', () => run(1), 'primary'), Z.button('跑 30 轮', () => run(30)), Z.button('重置', reset)));
    reset();
  });

  /* ---------- 6c: AlphaGo: imitation tops out, RL keeps going ---------- */
  Z.demo('d-go', (fig) => {
    const body = fig.querySelector('.demo-body');
    const svg = s('svg', { viewBox: '0 0 720 230', class: 'go', role: 'img', 'aria-label': '模仿学习止步于人类水平，强化学习超过人类' });
    body.appendChild(svg);
    const X = (t) => 60 + t * 620, Y = (v) => 200 - v * 170;
    svg.appendChild(s('line', { x1: 60, x2: 690, y1: 200, y2: 200, class: 'axis' }));
    svg.appendChild(s('line', { x1: 60, x2: 60, y1: 20, y2: 200, class: 'axis' }));
    svg.appendChild(s('text', { x: 690, y: 218, 'text-anchor': 'end', class: 'lab tiny' }, '训练时间'));
    svg.appendChild(s('text', { x: 66, y: 28, class: 'lab tiny' }, '棋力（Elo）'));
    svg.appendChild(s('line', { x1: 60, x2: 690, y1: Y(0.72), y2: Y(0.72), class: 'human-line' }));
    svg.appendChild(s('text', { x: 686, y: Y(0.72) - 6, 'text-anchor': 'end', class: 'lab small' }, '李世石'));
    const sup = [], rl = [];
    for (let t = 0; t <= 1.0001; t += 0.02) { sup.push([X(t), Y(0.62 * (1 - Math.exp(-t * 6)))]); rl.push([X(t), Y(Math.min(0.98, 0.95 * (1 - Math.exp(-t * 3.2)) + 0.05 * t))]); }
    const pl = (pts, cls) => svg.appendChild(s('path', { d: 'M' + pts.map((p) => p.join(',')).join(' L'), class: 'curve ' + cls }));
    pl(sup, 'sup'); pl(rl, 'rl');
    svg.appendChild(s('text', { x: X(0.78), y: Y(0.62) + 18, class: 'lab small t-zip' }, '模仿人类棋谱（监督学习）'));
    svg.appendChild(s('text', { x: X(0.5), y: Y(0.86) - 6, class: 'lab small t-tool' }, '强化学习（自我对弈）'));
    body.appendChild(h('p', { class: 'hint' }, '曲线形状示意，照他展示的 AlphaGo 论文图的走势画，不是原始数据。'));
    body.appendChild(h('p', { class: 'narr' }, '模仿人类，最多学到最强的人类那么好；强化学习只看输赢，没有理由停在人类水平。著名的第 37 手：人类棋手走出这一步的概率估计约万分之一，事后看却是妙手。他认为 LLM 也会出现类似的东西：RL 发现的推理方式可能连人类都没想到，甚至可能不再用英语思考。'));
  });

  /* ---------- 6d: RLHF: a simulator of human preference, and how it gets gamed ---------- */
  Z.demo('d-rlhf', (fig) => {
    const body = fig.querySelector('.demo-body');
    const stage = h('div', { class: 'stage-box' });
    body.appendChild(stage);
    const c = Z.canvas(body, 200);
    c.box.hidden = true;
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' }); body.appendChild(narr);
    let stepN = 300;
    const jokes = ['鹈鹕的嘴是天然购物袋……', '为什么鹈鹕不付账？……', '鹈鹕走进一家酒吧……', '鹈鹕的冷知识……', '鹈鹕。'];
    const rmBefore = [0.4, 0.7, 0.2, 0.6, 0.5], rmAfter = [0.9, 0.75, 0.55, 0.35, 0.1];
    const jokeRows = (scores, show) => h('div', { class: 'jokes' }, jokes.map((j, k) => h('div', { class: 'joke' }, h('span', { class: 'rank' }, show ? '人类排第 ' + (k + 1) : ''), h('span', { class: 'jt' }, j), h('span', { class: 'jbar' }, h('i', { style: { width: scores[k] * 100 + '%' } })), h('b', null, fmt(scores[k], 2)))));
    const curve = () => {
      const rm = [], tq = [];
      for (let t = 0; t <= 1000; t += 10) { rm.push([t, Math.min(1, 0.3 + 0.7 * (1 - Math.exp(-t / 300)) + (t > 600 ? (t - 600) / 2000 : 0))]); tq.push([t, 0.3 + 0.35 * (1 - Math.exp(-t / 120)) - Math.max(0, (t - 300) / 700) ** 2 * 0.9]); }
      Z.chart(c, { x: [0, 1000], y: [0, 1.05], xticks: [0, 250, 500, 750, 1000], yticks: [0, 0.5, 1], series: [{ pts: rm, color: 'zip', width: 2, label: '奖励模型打分' }, { pts: tq, color: 'tool', width: 2, label: '真实的人会怎么评价（示意）' }], vlines: [{ x: stepN, color: 'risk', label: '第 ' + stepN + ' 步' }], legend: true, xlabel: 'RL 更新步数' });
    };
    c.draw = curve;
    const steps = [
      () => { c.box.hidden = true; stage.innerHTML = ''; stage.append(h('div', { class: 'big-num' }, h('b', null, '1,000 × 1,000 × 1,000'), h('span', null, '1,000 次更新 · 每次 1,000 个提示 · 每个提示 1,000 个回答')), h('p', { class: 'center' }, '= 让人看 10 亿个关于鹈鹕的笑话')); return '“写一个关于鹈鹕的笑话”没有标准答案，这叫不可验证的领域。最直接的 RL 做法需要人给每个回答打分，按他的卡通数字算，要人看 10 亿次笑话。'; },
      () => { c.box.hidden = true; stage.innerHTML = ''; stage.append(jokeRows(rmBefore, true)); return '诀窍是绕一道：只让人给少量回答排序（排序比打分容易），再训练一个单独的神经网络，即奖励模型，去模仿人的偏好。这是训练前，它的打分和人的排序还对不上。'; },
      () => { c.box.hidden = true; stage.innerHTML = ''; stage.append(jokeRows(rmAfter, true)); return '训练后，奖励模型的打分和人类排序一致了。现在它是一个“人类偏好模拟器”，可以随便查询多少次，RL 就可以对着它跑。好处是能用在任何领域，而且利用了“评判比生成容易”。'; },
      () => { c.box.hidden = false; c.fit(); curve(); stage.innerHTML = ''; return '坏处：奖励模型只是对人的有损模拟，而 RL 极其擅长找漏洞。拖动下面的滑块：前几百步一切变好，再往后，模型开始利用奖励模型的盲区。'; },
    ];
    const sl = Z.slider('rlhf-step', '更新步数', 0, 1000, 10, stepN, (v) => {
      stepN = v; curve();
      if (v > 700) { stage.innerHTML = ''; stage.append(h('div', { class: 'qa bad' }, h('span', { class: 'bub bot' }, 'the the the the the the the'), h('span', { class: 'muted' }, '奖励模型给它打 1.0 分：“最好的笑话”'))); narr.innerHTML = '这就是对抗样本：在巨大的输入空间里，总能找到奖励模型给出离谱高分的输入。所以 RLHF 只能跑几百步就停下来发布。他的说法：RLHF 不是 RL，至少不是那种可以无限跑下去、越跑越强的“魔法”RL。有标准答案的题目就没法这样作弊。'; }
      else { stage.innerHTML = ''; narr.innerHTML = v <= 350 ? '这一段两条线一起涨：模型确实在变好。' : '奖励模型的分数还在涨，真实质量已经开始下滑。'; }
    }, (v) => String(v));
    sl.hidden = true;
    Z.player(fig, { n: steps.length, render: (i) => { narr.innerHTML = steps[i](); sl.hidden = i !== 3; }, controlsParent: fig.querySelector('.controls-slot'), interval: 3600 });
    fig.querySelector('.controls-slot').append(sl);
  });
})();
