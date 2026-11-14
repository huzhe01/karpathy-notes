/* Hero map, Part 1 (what an LLM is), Part 2 (pretraining data), Part 3 (base model) */
(function () {
  const { h, s, fmt } = Z;
  const VIDS = { A: 'zjkBMFhNj_g', B: '7xTGNNLPyMI', C: 'EWvNQjAaOHw' };
  const NAMES = { A: 'LLM 入门', B: 'Deep Dive', C: 'How I use' };
  document.addEventListener('DOMContentLoaded', () => {
    Z.$$('a.src').forEach((a) => {
      const v = a.dataset.v, t = a.dataset.t;
      a.textContent = NAMES[v] + ' ' + t;
      a.href = 'https://www.youtube.com/watch?v=' + VIDS[v] + '&t=' + Z.tsSeconds(t) + 's';
      a.target = '_blank'; a.rel = 'noopener'; a.title = '在 YouTube 打开这一刻';
      a.classList.add('v' + v);
    });
  });

  /* ---------- hero: the whole system on one map ---------- */
  Z.demo('d-map', (fig) => {
    const body = fig.querySelector('.demo-body');
    const sc = h('div', { class: 'scroll-x' });
    const svg = s('svg', { viewBox: '0 0 1000 340', class: 'map', role: 'img', 'aria-label': '大模型从互联网数据到你手里的全景图，点节点跳到对应部分' });
    svg.style.minWidth = '720px';
    sc.appendChild(svg); body.appendChild(sc);
    const nodes = [
      ['n1', 20, '互联网文本', 'FineWeb · 44TB', '#p2', 'zip'],
      ['n2', 160, '预训练', '数千 GPU · 数月', '#p2', 'zip'],
      ['n3', 300, 'Base model', '有损压缩的互联网', '#p3', 'zip'],
      ['n4', 440, '后训练 SFT', '对话数据 · 几小时', '#p4', 'ctx'],
      ['n5', 580, '强化学习', 'RL · RLHF', '#p6', 'ctx'],
      ['n6', 720, '助手', '一个人格 + 一套工具', '#p9', 'ctx'],
      ['n7', 870, '你', '提问 · 上传 · 说话', '#p9', 'ink'],
    ];
    const Y = 165, W = 112, H = 54;
    const path = s('path', { d: `M${20 + W / 2},${Y} L${870 + W / 2},${Y}`, class: 'map-line' });
    svg.appendChild(path);
    const link = (href, el) => { const a = s('a', { href }); a.appendChild(el); svg.appendChild(a); return a; };
    for (const [id, x, t, sub, href, cls] of nodes) {
      const g = s('g', { class: 'mn ' + cls });
      g.append(s('rect', { x, y: Y - H / 2, width: W, height: H, rx: 8 }), s('text', { x: x + W / 2, y: Y - 4, 'text-anchor': 'middle', class: 'mn-t' }, t), s('text', { x: x + W / 2, y: Y + 15, 'text-anchor': 'middle', class: 'mn-s' }, sub));
      link(href, g);
    }
    // tools / OS above the assistant
    const tg = s('g', { class: 'mn tool' });
    tg.append(s('rect', { x: 700, y: 30, width: 152, height: 50, rx: 8 }), s('text', { x: 776, y: 52, 'text-anchor': 'middle', class: 'mn-t' }, '工具 · LLM OS'), s('text', { x: 776, y: 70, 'text-anchor': 'middle', class: 'mn-s' }, '搜索 · Python · 文件 · 多模态'));
    svg.appendChild(s('line', { x1: 776, y1: 80, x2: 776, y2: Y - H / 2, class: 'map-line thin' }));
    link('#p7', tg);
    // what it is
    const wg = s('g', { class: 'mn zip' });
    wg.append(s('rect', { x: 230, y: 30, width: 182, height: 50, rx: 8 }), s('text', { x: 321, y: 52, 'text-anchor': 'middle', class: 'mn-t' }, '它到底是什么'), s('text', { x: 321, y: 70, 'text-anchor': 'middle', class: 'mn-s' }, '两个文件 · 一个 zip'));
    svg.appendChild(s('line', { x1: 356, y1: 80, x2: 356, y2: Y - H / 2, class: 'map-line thin' }));
    link('#p1', wg);
    // psychology
    const pg = s('g', { class: 'tagg psy' });
    pg.append(s('rect', { x: 452, y: 30, width: 230, height: 50, rx: 25 }), s('text', { x: 567, y: 52, 'text-anchor': 'middle', class: 'mn-t' }, '模型心理学'), s('text', { x: 567, y: 70, 'text-anchor': 'middle', class: 'mn-s' }, '幻觉 · 用 token 思考 · 参差的智能'));
    svg.appendChild(s('line', { x1: 567, y1: 80, x2: 567, y2: Y - H / 2, class: 'map-line thin dash' }));
    link('#p5', pg);
    // threats
    const threats = [[76, '数据投毒'], [776, '越狱 · 提示注入']];
    threats.forEach(([x, t]) => {
      const g = s('g', { class: 'tagg risk' });
      const w = t.length * 13 + 30;
      g.append(s('rect', { x: x - w / 2, y: 262, width: w, height: 34, rx: 17 }), s('text', { x, y: 284, 'text-anchor': 'middle', class: 'mn-t small' }, t));
      svg.appendChild(s('line', { x1: x, y1: Y + H / 2, x2: x, y2: 262, class: 'map-line thin dash risk' }));
      link('#p8', g);
    });
    svg.appendChild(s('text', { x: 500, y: 326, 'text-anchor': 'middle', class: 'lab tiny' }, '点任意节点跳到对应部分'));
    const dot = s('circle', { r: 6, class: 'map-dot', cx: 76, cy: Y });
    svg.appendChild(dot);
    if (!Z.reduced) {
      let t0 = null;
      const tick = (t) => {
        if (!t0) t0 = t;
        const p = ((t - t0) / 6000) % 1;
        dot.setAttribute('cx', 76 + p * (926 - 76));
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  });

  /* ---------- 1a: two files ---------- */
  Z.demo('d-files', (fig) => {
    const body = fig.querySelector('.demo-body');
    let n = 70;
    const wrap = h('div', { class: 'files' });
    const f1 = h('div', { class: 'file big' }), f2 = h('div', { class: 'file' });
    wrap.append(f1, f2);
    body.appendChild(wrap);
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' });
    body.appendChild(narr);
    function draw() {
      const gb = n * 2;
      f1.innerHTML = '';
      f1.append(h('span', { class: 'f-ico' }, 'parameters'), h('b', null, gb + ' GB'), h('span', { class: 'muted' }, `${n}B 个参数 × 2 字节（float16）`));
      f1.style.setProperty('--w', Math.max(30, Math.sqrt(gb / 140) * 100) + '%');
      f2.innerHTML = '';
      f2.append(h('span', { class: 'f-ico' }, 'run.c'), h('b', null, '约 500 行 C'), h('span', { class: 'muted' }, '没有其他依赖'));
      narr.innerHTML = `Llama 2 ${n}B 就是这两个文件。编译 run.c，指向参数文件，断网也能在 MacBook 上和它对话。` + (n === 70 ? '他演示时其实跑的是 7B，因为 70B 大约慢 10 倍。' : '') + ' 难的不是运行，是怎么得到这些参数。';
    }
    fig.querySelector('.controls-slot').append(h('div', { class: 'controls' }, Z.seg('files-n', [['7', '7B'], ['13', '13B'], ['34', '34B'], ['70', '70B']], '70', (v) => { n = +v; draw(); })));
    draw();
  });

  /* ---------- 1b: training is lossy compression ---------- */
  Z.demo('d-compress', (fig) => {
    const body = fig.querySelector('.demo-body');
    let sota = false;
    const svg = s('svg', { viewBox: '0 0 720 200', class: 'compress', role: 'img', 'aria-label': '10TB 文本被压缩成 140GB 参数' });
    body.appendChild(svg);
    const narr = h('p', { class: 'narr' }); body.appendChild(narr);
    function draw() {
      svg.innerHTML = '';
      const k = sota ? 10 : 1;
      svg.appendChild(s('rect', { x: 20, y: 20, width: 190, height: 160, rx: 8, class: 'blob-zip' }));
      for (let i = 0; i < 14; i++) svg.appendChild(s('line', { x1: 36, x2: 36 + 60 + ((i * 53) % 100), y1: 40 + i * 10, y2: 40 + i * 10, class: 'txtline' }));
      svg.appendChild(s('text', { x: 115, y: 196, 'text-anchor': 'middle', class: 'lab' }, sota ? '10 TB × 10 以上' : '约 10 TB 互联网文本'));
      svg.appendChild(s('path', { d: 'M215,40 L470,80 L470,120 L215,160 Z', class: 'funnel' }));
      svg.appendChild(s('text', { x: 342, y: 96, 'text-anchor': 'middle', class: 'lab' }, sota ? '更大的集群 · 数千万到上亿美元' : '约 6,000 块 GPU × 12 天'));
      svg.appendChild(s('text', { x: 342, y: 114, 'text-anchor': 'middle', class: 'lab small' }, sota ? '' : '约 200 万美元'));
      svg.appendChild(s('rect', { x: 490, y: 70, width: 70, height: 60, rx: 6, class: 'zipbox' }));
      svg.appendChild(s('text', { x: 525, y: 105, 'text-anchor': 'middle', class: 'lab' }, 'ZIP'));
      svg.appendChild(s('text', { x: 525, y: 150, 'text-anchor': 'middle', class: 'lab' }, sota ? '更大的参数' : '140 GB 参数'));
      svg.appendChild(s('text', { x: 590, y: 92, class: 'lab small' }, '压缩比约 100×'));
      svg.appendChild(s('text', { x: 590, y: 110, class: 'lab small t-risk' }, '有损：只留下 Gestalt'));
      narr.innerHTML = sota ? '他说 Llama 2 70B 的这些数字按今天的标准是“新手数字”：ChatGPT、Claude 这类前沿模型要再乘 10 倍以上，单次训练花费数千万甚至上亿美元。' : '预训练可以理解成把一大块互联网压缩进参数。和 zip 不同，这是有损压缩：参数里没有原文的逐字副本，只有一个整体印象。预测和压缩在数学上关系很近：越能准确预测下一个词，就越能压缩数据。';
    }
    fig.querySelector('.controls-slot').append(h('div', { class: 'controls' }, Z.seg('cmp-mode', [['l2', 'Llama 2 70B（2023）'], ['sota', '前沿模型']], 'l2', (v) => { sota = v === 'sota'; draw(); })));
    draw();
  });

  /* ---------- 1c: the reversal curse ---------- */
  Z.demo('d-reversal', (fig) => {
    const body = fig.querySelector('.demo-body');
    const qa = [
      ['谁是 Tom Cruise 的母亲？', 'Mary Lee Pfeiffer。', true],
      ['Mary Lee Pfeiffer 的儿子是谁？', '我不知道。', false],
    ];
    const box = h('div', { class: 'rev' });
    body.appendChild(box);
    const narr = h('p', { class: 'narr' }); body.appendChild(narr);
    qa.forEach(([q, a, ok], k) => {
      const row = h('div', { class: 'rev-row' }, h('span', { class: 'bub user' }, q), h('span', { class: 'arrow' }, '→'), h('span', { class: 'bub bot ' + (ok ? 'ok' : 'bad') }, a));
      box.appendChild(row);
    });
    narr.innerHTML = '他引用的 GPT-4 例子：同一个事实，从一个方向问得到，从另一个方向问不到。他的结论是，模型内部确实有某种知识库，但它是“一维”的、很奇怪；我们知道怎么调参数让预测变好，却不知道几百亿个参数各自在做什么。所以要把 LLM 当成主要靠经验测量的产物，需要配套的评测。';
  });

  /* ---------- 2a: FineWeb processing funnel ---------- */
  Z.demo('d-fineweb', (fig) => {
    const body = fig.querySelector('.demo-body');
    const st = [
      ['Common Crawl', '从 2007 年起持续爬取互联网，到 2024 年已索引 27 亿个网页。从一些种子网页出发，顺着链接不断爬。原始数据是 HTML。', 100],
      ['URL 过滤', '用域名黑名单去掉恶意软件、垃圾、营销、种族主义、成人等网站。', 86],
      ['正文抽取', '原始 HTML 里全是标记、CSS、导航栏，用启发式规则只留下正文。', 66],
      ['语言过滤', '用语言分类器判断每页的语言。FineWeb 只留英文占比超过 65% 的网页。这是个设计选择：过滤掉西班牙语，模型就不会擅长西班牙语。', 48],
      ['去重等过滤', '再做几轮质量过滤和去重。', 36],
      ['去除个人信息', '检测地址、社会保障号等个人身份信息（PII），过滤掉这类网页。', 32],
      ['FineWeb', '约 44 TB，约 15 万亿个 token。一块硬盘几乎就装得下：互联网很大，但只要文本，又过滤得很狠。', 28],
    ];
    const fun = h('div', { class: 'funnel-list' });
    const rows = st.map(([t, d, w], k) => {
      const r = h('button', { class: 'fn-row', type: 'button' }, h('span', { class: 'fn-bar', style: { width: w + '%' } }, h('b', null, t)));
      r.addEventListener('click', () => player.go(k));
      fun.appendChild(r); return r;
    });
    body.appendChild(fun);
    body.appendChild(h('p', { class: 'hint' }, '条形宽度只表示“越筛越少”，不是真实比例。'));
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' }); body.appendChild(narr);
    const player = Z.player(fig, { n: st.length, render: (i) => { rows.forEach((r, k) => { r.classList.toggle('on', k === i); r.classList.toggle('past', k < i); }); narr.innerHTML = '<b>' + st[i][0] + '</b>：' + st[i][1]; }, controlsParent: fig.querySelector('.controls-slot'), interval: 2400 });
  });

  /* ---------- 2b: cost of GPT-2 then and now ---------- */
  Z.demo('d-cost', (fig) => {
    const body = fig.querySelector('.demo-body');
    const rows = [['2019 · OpenAI 训练 GPT-2', 40000, '估计约 4 万美元'], ['2024 · 他用 llm.c 复现', 600, '约 1 天，约 600 美元'], ['不怎么费力还能压到', 100, '约 100 美元']];
    const list = h('div', { class: 'ladder' });
    rows.forEach(([lab, v, note]) => list.appendChild(h('div', { class: 'lad-row' }, h('span', { class: 'lad-lab' }, lab), h('span', { class: 'lad-bar' }, h('i', { style: { width: (Math.log10(v) / Math.log10(40000)) * 100 + '%' } })), h('b', { class: 'lad-v' }, '$' + v.toLocaleString()), h('span', { class: 'lad-note' }, note))));
    body.appendChild(list);
    body.appendChild(h('p', { class: 'hint' }, '条形按对数刻度画。'));
    const facts = h('div', { class: 'facts' },
      h('div', null, h('b', null, '1.6B'), h('span', null, 'GPT-2 参数（今天：几千亿到上万亿）')),
      h('div', null, h('b', null, '1,024'), h('span', null, '最大上下文 token（今天：几十万到上百万）')),
      h('div', null, h('b', null, '100B'), h('span', null, '训练 token（FineWeb 有 15T）')),
      h('div', null, h('b', null, '1M'), h('span', null, '他复现时每步处理的 token，约 7 秒一步')),
      h('div', null, h('b', null, '8×H100'), h('span', null, '租的一台机器，每块 GPU 每小时约 3 美元')),
    );
    body.appendChild(facts);
    body.appendChild(h('p', { class: 'narr' }, '为什么便宜了这么多：数据集过滤得更好、质量更高；但最大的原因是硬件快了很多，软件也把硬件榨得更干。他接着讲到 GPU 的“淘金热”：所有这些机器做的事都一样，就是在一个数据集上预测下一个 token。'));
  });

  /* ---------- 3a: base-model playground (paraphrased from what he showed) ---------- */
  Z.demo('d-base', (fig) => {
    const body = fig.querySelector('.demo-body');
    const P = {
      q: { p: 'What is 2+2?', outs: ['…然后话题一转，开始谈数字的哲学意义。', '…接着又列出另外几个算术题，像一张练习题网页。', '…回答了，又跑去写一段不相干的论坛帖子。'], note: '它不是助手，只是一个昂贵的自动补全。同一个前缀每次采样都不一样，因为它在一个概率分布里抽样。' },
      z: { p: '（粘贴维基百科“斑马”词条的第一句）', outs: ['There are three living species: … 接着几乎逐字背出词条后面的内容，过一段才慢慢跑偏。'], note: '这叫 regurgitation（复述）。维基百科这类高质量来源在训练时会被多看几遍，可能有 10 遍左右，模型就能背出来。最终产品里一般不希望这样。' },
      e: { p: '（一段讲 2024 年美国大选的开头：共和党提名 Trump，他 2017 年起当过总统……）', outs: ['…竞选搭档是 Mike Pence，对手是 Hillary Clinton 和 Tim Kaine。', '…竞选搭档是 Ron DeSantis，对手是 Joe Biden 和 Kamala Harris。'], note: '训练数据截止到 2023 年底，它没见过 2024 年大选的结果，只能按参数里的知识猜，每次猜出一个不同的“平行宇宙”。这就是幻觉。' },
      f: { p: 'butterfly: 나비\napple: 사과\n…（10 对英文:韩文）\nteacher:', outs: [' 선생님'], note: '这叫 few-shot 提示。模型读上下文时“就地学会”了这个模式（in-context learning），扮演起翻译。靠巧妙的提示，基座模型也能拿来做应用。' },
      a: { p: 'Here is a conversation between an AI assistant and a human…\nHuman: … Assistant: …（几轮示范）\nHuman: Why is the sky blue?\nAssistant:', outs: [' The sky appears blue due to Rayleigh scattering … Human: …（接着自己编出了人类的下一个问题）'], note: '把提示写成一篇“人和 AI 助手的对话记录”网页，它就会接着演助手。但它不知道该停，会顺手把人类的下一句也编出来。这段提示是他让 ChatGPT 帮忙写的。' },
    };
    let key = 'q', k = 0;
    const term = h('pre', { class: 'term' });
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' });
    body.append(term, narr);
    function draw() {
      const c = P[key];
      term.innerHTML = '';
      term.append(h('span', { class: 'term-p' }, c.p), h('span', { class: 'term-o' }, c.outs[k % c.outs.length]));
      narr.innerHTML = c.note + (c.outs.length > 1 ? `　（第 ${k % c.outs.length + 1} 次采样）` : '');
    }
    fig.querySelector('.controls-slot').append(h('div', { class: 'controls' },
      Z.seg('base-p', [['q', '2+2'], ['z', '斑马词条'], ['e', '2024 大选'], ['f', '少样本翻译'], ['a', '扮演助手']], 'q', (v) => { key = v; k = 0; draw(); }),
      Z.button('↻ 重新采样', () => { k++; draw(); }, 'primary')));
    draw();
  });

  /* ---------- 3b: knowledge in the parameters vs. in the context window ---------- */
  Z.demo('d-memory', (fig) => {
    const body = fig.querySelector('.demo-body');
    let freq = 0.5, pasted = false;
    const cases = [
      [0.95, '一杯美式里有多少咖啡因', '网上到处都是，也不会变：直接问，模型凭记忆回答（约 63 毫克）就行。'],
      [0.55, '总结《傲慢与偏见》第一章', '名著，模型记得个大概。但把第一章原文贴进来，总结质量会明显更高。'],
      [0.2, 'Dominik Hašek 赢过几次斯坦利杯', '冷门细节，参数里记得模糊，容易编。最好让它搜索，或者你贴资料。'],
    ];
    const meter = h('div', { class: 'mem' });
    body.appendChild(meter);
    const list = h('div', { class: 'mem-cases' });
    cases.forEach(([f, q, a]) => { const b = h('button', { class: 'chip-btn', type: 'button' }, q); b.addEventListener('click', () => { sl.set(f); narr.innerHTML = a; }); list.appendChild(b); });
    body.appendChild(list);
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' });
    body.appendChild(narr);
    function draw() {
      const recall = pasted ? 0.97 : Math.min(0.95, 0.12 + freq * 0.85);
      meter.innerHTML = '';
      meter.append(
        h('div', { class: 'mem-col' }, h('span', { class: 'mem-lab' }, '参数里的知识（预训练时读过）'), h('div', { class: 'mem-bar zip' }, h('i', { style: { width: freq * 100 + '%', opacity: pasted ? 0.35 : 1 } })), h('span', { class: 'muted small' }, '像一个月前读过的东西：模糊、概率性的回忆')),
        h('div', { class: 'mem-col' }, h('span', { class: 'mem-lab' }, '上下文里的知识（就在眼前）'), h('div', { class: 'mem-bar ctx' }, h('i', { style: { width: pasted ? '100%' : '0%' } })), h('span', { class: 'muted small' }, '像工作记忆：直接喂进网络，不用回忆')),
        h('div', { class: 'mem-col' }, h('span', { class: 'mem-lab' }, '答对的把握（示意）'), h('div', { class: 'mem-bar out' }, h('i', { style: { width: recall * 100 + '%' } }))),
      );
    }
    const sl = Z.slider('mem-freq', '这件事在网上出现得', 0, 1, 0.01, freq, (v) => { freq = v; draw(); }, (v) => (v < 0.33 ? '很少' : v < 0.66 ? '一般' : '很多'));
    fig.querySelector('.controls-slot').append(h('div', { class: 'controls' }, sl, Z.check('mem-paste', '把原文贴进上下文', false, (v) => { pasted = v; draw(); })));
    draw();
    narr.innerHTML = '他反复强调的一条心理学要点：参数里的知识是模糊的回忆，上下文窗口里的 token 是工作记忆。网上出现得越多的事，模型记得越准；要它处理具体材料时，直接把材料贴进来。点上面的例子看看。';
  });
})();
