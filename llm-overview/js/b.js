/* Part 4 (post-training) and Part 5 (LLM psychology) */
(function () {
  const { h, s, fmt } = Z;

  /* ---------- 4a: a conversation becomes one token sequence ---------- */
  Z.demo('d-template', (fig) => {
    const body = fig.querySelector('.demo-body');
    const conv = [['user', 'What is 2+2?'], ['assistant', '2+2 = 4'], ['user', 'What if it was * instead of +?'], ['assistant', '2*2 = 4, same as 2+2!']];
    const chat = h('div', { class: 'chat' });
    const seq = h('div', { class: 'seq' });
    body.append(chat, seq);
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' }); body.appendChild(narr);
    const pieces = (txt) => txt.match(/\s?[A-Za-z]+|\s?\d|\s?[^\sA-Za-z\d]/g);
    function bubbles(n) { chat.innerHTML = ''; conv.slice(0, n).forEach(([r, t]) => chat.appendChild(h('div', { class: 'bub ' + (r === 'user' ? 'user' : 'bot') }, t))); }
    function tokens(upto, gen) {
      seq.innerHTML = '';
      const out = [];
      conv.slice(0, upto).forEach(([r, t], k) => {
        out.push(['<|im_start|>', 'sp'], [r, 'role'], ['<|im_sep|>', 'sp']);
        if (!(gen != null && k === upto - 1)) { pieces(t).forEach((p) => out.push([p, 'tx'])); out.push(['<|im_end|>', 'sp']); }
        else pieces(t).slice(0, gen).forEach((p) => out.push([p, 'tx gen']));
      });
      out.forEach(([t, c]) => seq.appendChild(h('span', { class: 'tok ' + c }, t.replace(/ /g, '␠'))));
      return out.length;
    }
    let timer = null;
    const steps = [
      () => { bubbles(4); seq.innerHTML = ''; return '你在界面上看到的是一来一回的聊天气泡。'; },
      () => { bubbles(4); const n = tokens(4); return `在模型眼里，这只是一条一维的 token 序列（这里共 ${n} 个，切分是示意）。他在 tiktokenizer 里看 GPT-4o 的格式：同样一段两轮对话是 49 个 token。`; },
      () => { bubbles(4); tokens(4); seq.classList.add('hi-sp'); return '<b>&lt;|im_start|&gt;</b>、<b>&lt;|im_sep|&gt;</b>、<b>&lt;|im_end|&gt;</b> 是后训练阶段新加的特殊 token，预训练时从没出现过。它们标出“谁在说话、从哪开始、到哪结束”，就像网络协议规定数据包的格式。各家格式不一样，他说现在有点像蛮荒西部。'; },
      () => { seq.classList.remove('hi-sp'); bubbles(3); let g = 0; const total = pieces(conv[3][1]).length; tokens(4, 0); clearInterval(timer); timer = setInterval(() => { g++; tokens(4, g); if (g >= total) clearInterval(timer); }, Z.reduced ? 0 : 260); return '推理时：你发完最后一句，服务器在后面补上 <b>&lt;|im_start|&gt;assistant&lt;|im_sep|&gt;</b>，然后让模型一个一个采样 token，直到它输出 &lt;|im_end|&gt;。'; },
    ];
    Z.player(fig, { n: steps.length, render: (i) => { clearInterval(timer); seq.classList.remove('hi-sp'); narr.innerHTML = steps[i](); }, controlsParent: fig.querySelector('.controls-slot'), interval: 3200 });
  });

  /* ---------- 4b: who writes the answers: the human ↔ model slider ---------- */
  Z.demo('d-slider', (fig) => {
    const body = fig.querySelector('.demo-body');
    const stops = [
      ['人类从零写', '承包商按标注规范（可能有上百页）自己想问题、自己写理想回答。InstructGPT 就是这样做的，标注员来自 Upwork 和 Scale AI。'],
      ['模型起草，人来挑和改', '让模型先生成几个回答，人从中挑出好的部分拼成一个最好的回答。'],
      ['模型帮人检查、做比较', '让模型检查人写的东西，或者让模型生成比较，人只做判断。'],
      ['人只负责监督', '数据集大部分是合成的。他举的 UltraChat 有数百万条对话，主要由模型生成、人做一些编辑。'],
    ];
    const track = h('div', { class: 'hm-track' });
    const cells = stops.map(([t]) => { const c = h('div', { class: 'hm-stop' }, t); track.appendChild(c); return c; });
    const ends = h('div', { class: 'hm-ends' }, h('span', null, '人做得多'), h('span', null, '模型做得多'));
    body.append(track, ends);
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' }); body.appendChild(narr);
    const sl = Z.slider('hm-pos', '滑块', 0, 3, 1, 0, (v) => { cells.forEach((c, k) => c.classList.toggle('on', k === v)); narr.innerHTML = stops[v][1] + (v === 3 ? '　他在 2023 年就说，模型越来越强，这个滑块正在往右移。' : ''); }, (v) => stops[v][0]);
    fig.querySelector('.controls-slot').append(h('div', { class: 'controls' }, sl));
    sl.fire();
  });

  /* ---------- 5a: hallucination and the two fixes ---------- */
  Z.demo('d-halluc', (fig) => {
    const body = fig.querySelector('.demo-body');
    const stage = h('div', { class: 'stage-box' });
    body.appendChild(stage);
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' }); body.appendChild(narr);
    const qa = (q, a, cls) => h('div', { class: 'qa ' + (cls || '') }, h('span', { class: 'bub user' }, q), h('span', { class: 'bub bot' }, a));
    const steps = [
      () => [[qa('Who is Tom Cruise?', 'Tom Cruise 是美国著名演员和制片人……'), qa('Who is John Barrasso?', '美国参议员……'), qa('Who is Genghis Khan?', '成吉思汗是……')], '训练集里“X 是谁”这类问题，标注员要么本来知道，要么去查了，写下的都是语气笃定的答案。模型学到的是这种<b>风格</b>。'],
      () => [[qa('Who is Orson Kovacs?', '美国作家、科幻小说家。', 'bad'), qa('（重新采样）', '1950 年代电视剧里的虚构角色。', 'bad'), qa('（再采样）', '前小联盟棒球运动员。', 'bad')], '问一个他随手编的名字。老模型 Falcon 7B 每次都给出一个不同的、自信的答案。它内部也许“知道”自己不认识这个人，但它在模仿训练集里的答题格式，于是取统计上最像的猜测。'],
      () => [[h('div', { class: 'doc' }, h('b', null, '随机抽一篇训练文档'), '：Dominik Hašek（冰球门将）……'), qa('他效力于哪支球队？', 'Buffalo Sabres'), qa('他赢过几次斯坦利杯？', '2 次')], '<b>办法一：探测模型知道什么。</b>Meta 训练 Llama 3 时这样做：从训练文档里取一段，让一个 LLM 根据这段文字出几道事实题并给出答案。材料就在上下文里，所以出题很准。'],
      () => [[qa('他效力于哪支球队？ ×3', 'Buffalo Sabres ✓ ✓ ✓', 'ok'), qa('他赢过几次斯坦利杯？ ×3', '4 次 ✗ · 编了另一个数 ✗ · “一次没赢” ✗', 'bad')], '把每道题拿去问待训练的模型，问三五次，再用另一个 LLM 当裁判，和标准答案比对。第一题每次都对，说明它知道；第二题每次都错，说明它不知道。全程不需要人。'],
      () => [[qa('他赢过几次斯坦利杯？', '抱歉，我不记得了。', 'ok')], '对它不知道的题，往训练集里加一条对话，正确回答就是“我不知道”。只要有一些这样的例子，模型就能把内部那个“不确定”的神经元和说出“我不知道”连起来。'],
      () => [[qa('Who is Orson Kovacs?', '<SEARCH_START>Orson Kovacs<SEARCH_END>', 'tool'), h('div', { class: 'doc tool' }, h('b', null, '程序暂停采样，去 Bing 搜索'), '：搜索结果的文字被贴回上下文窗口……'), qa('', '可能是这几个人之一 [1][2]……', 'ok')], '<b>办法二：让它去查。</b>引入特殊 token，模型想查时就输出 SEARCH_START 和查询词。运行模型的程序看到 SEARCH_END 就暂停，执行搜索，把网页文字放进上下文。这就像你翻书刷新了工作记忆。怎么用这个工具，同样靠几千条示范对话教会。'],
    ];
    Z.player(fig, { n: steps.length, render: (i) => { const [els, t] = steps[i](); stage.innerHTML = ''; els.forEach((e) => stage.appendChild(e)); narr.innerHTML = t; }, controlsParent: fig.querySelector('.controls-slot'), interval: 3600 });
  });

  /* ---------- 5b: models need tokens to think ---------- */
  Z.demo('d-emily', (fig) => {
    const body = fig.querySelector('.demo-body');
    const prob = 'Emily 买了 3 个苹果和 2 个橙子。每个橙子 2 美元，总共 13 美元。每个苹果多少钱？';
    const A = ['The', ' answer', ' is', ' $3', '.', ' Because', ' 2', ' oranges', ' cost', ' $4', ',', ' 13', '−4', '=9', ',', ' 9', '/3', '=3', '.'];
    const B = ['Oranges', ' cost', ' 2×$2', ' =', ' $4', '.', ' 13', ' −', ' 4', ' =', ' $9', ' for', ' apples', '.', ' $9', ' /', ' 3', ' =', ' $3', '.', ' Answer', ':', ' $3'];
    const hard = { A: [3], B: [] };
    const work = { A: [], B: [4, 10, 18] };
    body.appendChild(h('p', { class: 'prob' }, prob));
    const grid = h('div', { class: 'two-col' });
    const colA = h('div', { class: 'ans' }, h('p', { class: 'mini-title' }, '回答 A：先说答案'));
    const colB = h('div', { class: 'ans' }, h('p', { class: 'mini-title' }, '回答 B：先算再说答案'));
    const rowA = h('div', { class: 'toks2' }), rowB = h('div', { class: 'toks2' });
    colA.appendChild(rowA); colB.appendChild(rowB); grid.append(colA, colB); body.appendChild(grid);
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' }); body.appendChild(narr);
    const mk = (row, arr, key, n) => { row.innerHTML = ''; arr.slice(0, n).forEach((t, k) => row.appendChild(h('span', { class: 'tk2' + (hard[key].includes(k) ? ' hard' : '') + (work[key].includes(k) ? ' work' : '') }, h('span', { class: 'tk2-t' }, t), h('span', { class: 'tk2-c' })))); };
    const N = Math.max(A.length, B.length);
    Z.player(fig, {
      n: N + 1,
      render: (i) => {
        mk(rowA, A, 'A', i); mk(rowB, B, 'B', i);
        if (i === 0) narr.innerHTML = '两个回答都对，答案都是 3 美元。他问：作为标注员，哪个是好的训练样本？用错了，模型的数学会变差。';
        else if (i <= 4) narr.innerHTML = '每个 token 下面的竖条代表一次前向传播：层数有限（他说现代网络大约 100 层），每个 token 分到的计算量大致固定。回答 A 在第 4 个 token 就要写出 “$3”，所有计算必须挤在这一次前向传播里。';
        else if (i < N) narr.innerHTML = '回答 B 把中间结果一个个写出来（蓝色）：4、9、3。每一步只需要一点点计算，后面的 token 可以直接“看到”前面写下的中间结果。A 后面的解释是在答案已经给出之后补的，对得出答案毫无帮助。';
        else narr.innerHTML = '所以要把推理摊到很多 token 上。实际使用时他更进一步：直接说“use code”，让模型写 Python 去算，因为心算的每一步都可能出错，数字一大就更不可靠。数数（比如数一串点有几个）也是同理。';
      },
      controlsParent: fig.querySelector('.controls-slot'), interval: 380,
    });
  });

  /* ---------- 5c: spelling: the model sees chunks, not letters ---------- */
  Z.demo('d-chars', (fig) => {
    const body = fig.querySelector('.demo-body');
    const inp = h('input', { type: 'text', id: 'chars-w', value: 'ubiquitous', maxlength: 24, autocomplete: 'off', spellcheck: 'false', 'aria-label': '输入一个英文单词' });
    let op = 'third';
    const view = h('div', { class: 'two-col' });
    const left = h('div'), right = h('div');
    view.append(left, right); body.appendChild(view);
    const narr = h('p', { class: 'narr' }); body.appendChild(narr);
    const chunk = (w) => { const out = []; let i = 0; const L = [2, 3, 4, 3]; let k = 0; while (i < w.length) { const n = L[k++ % L.length]; out.push(w.slice(i, i + n)); i += n; } return out; };
    function draw() {
      const w = inp.value.trim() || 'ubiquitous';
      left.innerHTML = ''; right.innerHTML = '';
      left.append(h('p', { class: 'mini-title' }, '模型看到的（示意：几个 token 块，看不见字母）'), h('div', { class: 'chunks2' }, chunk(w).map((c) => h('span', { class: 'ck' }, c))));
      let code, res;
      if (op === 'third') { code = `"${w}"[::3]`; res = [...w].filter((_, i) => i % 3 === 0).join(''); }
      else { const ch = w.includes('r') ? 'r' : w[0]; code = `"${w}".count("${ch}")`; res = [...w].filter((c) => c === ch).length; }
      right.append(h('p', { class: 'mini-title' }, '让它 use code（这里在你的浏览器里真算）'), h('pre', { class: 'code small' }, '>>> ' + code + '\n' + (typeof res === 'string' ? `'${res}'` : res)));
      narr.innerHTML = op === 'third' ? '他让模型输出 “ubiquitous” 从第一个字母起每隔三个取一个，模型答错了。原因一是它看到的是 token 块而不是字母，二是这又是一道心算题。说 “use code” 之后，它写一行 Python 就对了。' : '“strawberry 里有几个 r” 曾经火遍全网：很长一段时间里，最强的模型都坚持说只有两个。现在的模型能答对了。这类字符级任务都和分词有关。';
    }
    inp.addEventListener('input', draw);
    fig.querySelector('.controls-slot').append(h('div', { class: 'controls' }, h('label', { class: 'field', for: 'chars-w' }, '单词', inp),
      Z.seg('chars-op', [['third', '每隔三个取一个'], ['count', '数字母']], 'third', (v) => { op = v; if (v === 'count' && inp.value === 'ubiquitous') inp.value = 'strawberry'; if (v === 'third' && inp.value === 'strawberry') inp.value = 'ubiquitous'; draw(); })));
    draw();
  });

  /* ---------- 5d: Swiss-cheese capabilities ---------- */
  Z.demo('d-cheese', (fig) => {
    const body = fig.querySelector('.demo-body');
    const svg = s('svg', { viewBox: '0 0 720 230', class: 'cheese', role: 'img', 'aria-label': '能力像瑞士奶酪：大部分很强，但有零星的洞' });
    body.appendChild(svg);
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' }); body.appendChild(narr);
    svg.appendChild(s('path', { d: 'M20,200 L700,200 L700,60 Q560,20 360,40 Q160,58 20,110 Z', class: 'cheese-body' }));
    const ok = [[90, 150, '博士级物理、化学、生物题'], [250, 170, '复杂数学题'], [430, 150, '写代码'], [600, 120, '多学科知识']];
    ok.forEach(([x, y, t]) => svg.appendChild(s('text', { x, y, 'text-anchor': 'middle', class: 'lab small' }, t)));
    const holes = [
      [170, 100, 26, '9.11 和 9.9 哪个大？', '模型有时说 9.11 更大，还能给出一番论证，有时又改口，结果不稳定。他听一个研究团队说：查看内部激活时，一批通常和《圣经》经文有关的神经元亮了；在经文编号里 9.11 确实排在 9.9 后面，模型被这个“干扰”了。'],
      [350, 110, 22, 'strawberry 里有几个 r', '分词让它看不见字母，又要在一个 token 里数清楚。'],
      [520, 95, 20, '数一串点有几个', '一次前向传播要数完所有点，计算量不够。让它用代码数。'],
    ];
    const hs = holes.map(([x, y, r, t, d], k) => {
      const g = s('g', { class: 'hole', tabindex: 0, role: 'button', 'aria-label': t });
      g.append(s('circle', { cx: x, cy: y, r }), s('text', { x, y: y + r + 16, 'text-anchor': 'middle', class: 'lab small t-risk' }, t));
      const pick = () => { hs.forEach((e) => e.classList.remove('on')); g.classList.add('on'); narr.innerHTML = '<b>' + t + '</b>：' + d; };
      g.addEventListener('click', pick); g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
      svg.appendChild(g); return g;
    });
    narr.innerHTML = '他用“瑞士奶酪”形容 LLM 的能力：大部分领域强得惊人，却在一些随机的简单问题上出洞，他称之为 jagged intelligence（参差不齐的智能）。所以要把它当工具用，检查它的工作。点奶酪上的洞看例子。';
  });
})();
