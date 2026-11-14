/* Lecture 08 · State of GPT (Microsoft Build 2023) */
(function () {
  const { h, s, fmt } = Z;

  /* ---------- 8a: the four-stage recipe ---------- */
  Z.demo('d-pipe', (fig) => {
    const body = fig.querySelector('.demo-body');
    const stages = [
      { k: '预训练', en: 'Pretraining', data: '互联网规模的原始文本（CommonCrawl、C4，加上 GitHub、Wikipedia、书、ArXiv、StackExchange 等较高质量来源），按比例混合采样', algo: '语言建模：预测下一个 token', model: 'Base model（基座模型）', cost: '占全部训练算力的约 99%：数千块 GPU，可能训练数月', note: '基座模型不是助手，它只想补全文档。但可以用 few-shot 把任务排成一篇“假文档”来骗它完成。', w: 99 },
      { k: '监督微调', en: 'SFT', data: '承包商写的 “提示 → 理想回答”，量小但质量高，通常几万条', algo: '仍然是语言建模，只是换了数据', model: 'SFT 模型（可以部署，如 Vicuna-13B）', cost: '少量 GPU，几小时到几天', note: '算法一点没变，只是把训练数据从互联网文档换成了问答示范。', w: 0.4 },
      { k: '奖励建模', en: 'Reward Modeling', data: '对同一个提示的多个回答做比较排序', algo: '对所有回答两两比较，类似二分类；在回答末尾的特殊 token 上读出一个分数', model: '奖励模型 RM（只用于训练，不部署）', cost: '少量 GPU，几小时到几天', note: '为什么要比较而不是直接写？因为评判比生成容易：让承包商写一首关于回形针的俳句很难，但从几首里挑出好的很容易。', w: 0.3 },
      { k: '强化学习', en: 'RL (PPO)', data: '提示', algo: '用 SFT 模型生成回答，用 RM 打分，按分数加权强化（PPO）', model: 'RLHF 模型（ChatGPT、Claude 等）', cost: '少量 GPU，几小时到几天', note: 'InstructGPT 的实验里人类更偏好 RLHF 模型的输出。代价：熵变低、回答更“尖”、多样性变少。要生成很多花样时（比如编宝可梦名字），他反而用基座模型。', w: 0.3 },
    ];
    const row = h('div', { class: 'pipe' });
    const cards = stages.map((st, i) => {
      const b = h('button', { class: 'pipe-step', type: 'button', 'aria-pressed': 'false' }, h('span', { class: 'pipe-k' }, st.k), h('span', { class: 'pipe-en' }, st.en), h('span', { class: 'pipe-bar' }, h('i', { style: { width: Math.max(3, st.w) + '%' } })));
      b.addEventListener('click', () => player.go(i));
      row.appendChild(b);
      if (i < stages.length - 1) row.appendChild(h('span', { class: 'pipe-arrow', 'aria-hidden': 'true' }, '→'));
      return b;
    });
    body.appendChild(row);
    body.appendChild(h('p', { class: 'hint' }, '每个卡片下方的条 = 这一阶段占训练算力的大致比例（预训练约 99%）。点卡片查看细节。'));
    const detail = h('dl', { class: 'pipe-detail' });
    body.appendChild(detail);
    const player = Z.player(fig, {
      n: stages.length,
      render: (i) => {
        cards.forEach((c, k) => { c.classList.toggle('on', k === i); c.classList.toggle('past', k < i); c.setAttribute('aria-pressed', k === i ? 'true' : 'false'); });
        const st = stages[i];
        detail.innerHTML = '';
        [['数据', st.data], ['算法', st.algo], ['产出', st.model], ['成本', st.cost], ['他的点评', st.note]].forEach(([a, b]) => detail.append(h('dt', null, a), h('dd', null, b)));
      },
      controlsParent: fig.querySelector('.controls-slot'), interval: 3200,
    });
  });

  /* ---------- 8b: your inner monologue vs. a token simulator ---------- */
  Z.demo('d-think', (fig) => {
    const body = fig.querySelector('.demo-body');
    const grid = h('div', { class: 'two-col' });
    body.appendChild(grid);
    const human = [
      ['想', '我要比较两个州的人口，得先知道两个数'],
      ['自知', '这两个数我记不住'],
      ['用工具', '查维基百科：加州 3920 万，阿拉斯加 74 万'],
      ['自知', '39.2 ÷ 0.74 我心算不了'],
      ['用工具', '用计算器：约 53'],
      ['反思', '这个比例很大，不过加州是人口最多的州，说得通'],
      ['写', '开始写句子……'],
      ['检查', '回读，觉得措辞别扭，删掉重写'],
    ];
    const L = h('div'), R = h('div');
    grid.append(L, R);
    L.appendChild(h('p', { class: 'mini-title' }, '你写下 “California’s population is 53 times that of Alaska.” 之前，脑子里发生了什么'));
    const hl = h('ol', { class: 'mono-list' }); L.appendChild(hl);
    const humanEls = human.map(([k, t]) => { const li = h('li', null, h('span', { class: 'pill' }, k), t); hl.appendChild(li); return li; });
    R.appendChild(h('p', { class: 'mini-title' }, 'GPT 看到的只是这串 token，每个 token 分到同样多的计算'));
    const sentence = ['Cal', 'ifornia', "'s", ' population', ' is', ' 53', ' times', ' that', ' of', ' Alaska', '.'];
    const tokRow = h('div', { class: 'toks' }); R.appendChild(tokRow);
    const tokEls = sentence.map((t) => { const e = h('span', { class: 'tk' }, h('span', { class: 'tk-t' }, t.replace(/^ /, '␠')), h('span', { class: 'tk-c' })); tokRow.appendChild(e); return e; });
    R.appendChild(h('p', { class: 'hint' }, '每列的竖条 = 一次前向传播（约 80 层）。它不会停下来查资料，也不会回头改，只能一个接一个地“咔、咔、咔”往外吐。'));
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' }); body.appendChild(narr);
    const n = Math.max(human.length, sentence.length);
    Z.player(fig, {
      n,
      render: (i) => {
        humanEls.forEach((e, k) => e.classList.toggle('on', k <= i));
        tokEls.forEach((e, k) => e.classList.toggle('on', k <= i));
        narr.innerHTML = i < n - 1 ? '左边是你写一句话时的内心独白：查资料、用工具、检查、修改。这些在最终的文本里全被删掉了，训练数据里只剩右边那一行。' : '所以他说 prompt 工程很大程度上是在弥补这两种“大脑”之间的认知差异。Transformer 也有优势：记了海量事实，上下文窗口是完美的工作记忆。';
      },
      controlsParent: fig.querySelector('.controls-slot'), interval: 1100,
    });
  });

  /* ---------- 8c: tokens to think ---------- */
  Z.demo('d-tokens', (fig) => {
    const body = fig.querySelector('.demo-body');
    let mode = 'one';
    const svg = s('svg', { viewBox: '0 0 720 170', class: 'think', role: 'img', 'aria-label': '每个 token 的计算量固定，推理需要分散到更多 token 上' });
    body.appendChild(svg);
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' }); body.appendChild(narr);
    function draw() {
      svg.innerHTML = '';
      const toks = mode === 'one' ? ['Q: 23×47+18 = ?', '1099'] : ['Q: 23×47+18 = ?', "Let's", ' think', ' step', ' by', ' step', '.', ' 23×47', ' =', ' 1081', '.', ' 1081', '+18', ' =', ' 1099'];
      const tw = mode === 'one' ? 130 : 44;
      let x = 10;
      toks.forEach((t, k) => {
        const w = k === 0 ? 150 : tw;
        const isQ = k === 0;
        svg.appendChild(s('rect', { x, y: 110, width: w - 4, height: 28, rx: 4, class: isQ ? 'tq' : 'ta' }));
        svg.appendChild(s('text', { x: x + (w - 4) / 2, y: 129, 'text-anchor': 'middle', class: 'lab tiny' }, t));
        if (!isQ) for (let l = 0; l < 8; l++) svg.appendChild(s('rect', { x: x + (w - 4) / 2 - 6, y: 98 - l * 11, width: 12, height: 9, rx: 2, class: 'layer', style: { animationDelay: (k * 0.08 + l * 0.03) + 's' } }));
        x += w;
      });
      svg.appendChild(s('text', { x: 10, y: 160, class: 'lab small' }, `用于得出答案的总计算 ≈ ${toks.length - 1} 次前向传播`));
      narr.innerHTML = mode === 'one'
        ? '要求它一步给出答案：答案 token 只有一次前向传播的计算量。他的原话：“Transformer 需要 token 来思考”（they need tokens to think）。'
        : '加上 “Let’s think step by step” 或 few-shot 示范，把推理摊到很多 token 上，每个 token 只需做一点点工作，更容易做对。他还提到 self-consistency（多采样几次挑最好的）、让模型自查、Tree of Thought，都是在给 LLM 补上 “System 2”。';
    }
    fig.querySelector('.controls-slot').append(h('div', { class: 'controls' }, Z.seg('think-mode', [['one', '直接给答案'], ['cot', '一步步想']], 'one', (v) => { mode = v; draw(); })));
    draw();
  });
})();
