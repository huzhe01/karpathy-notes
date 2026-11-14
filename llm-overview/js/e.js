/* Part 9 (how to use them) and the closing recap */
(function () {
  const { h, s, fmt } = Z;

  /* ---------- 9a: the context window is a precious resource ---------- */
  Z.demo('d-ctx', (fig) => {
    const body = fig.querySelector('.demo-body');
    const msgs = [['我想比较一下美式和抹茶的咖啡因', 'user'], ['一份美式浓缩约 63 毫克……', 'bot'], ['那抹茶呢？', 'user'], ['……', 'bot'], ['换个话题：帮我改一下这封邮件', 'user'], ['（贴了一大段邮件）', 'user'], ['……', 'bot'], ['再换：Python 里怎么读 CSV', 'user'], ['……', 'bot']];
    let n = 0;
    const bar = h('div', { class: 'ctxbar' });
    const meters = h('div', { class: 'facts' });
    body.append(bar, meters);
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' }); body.appendChild(narr);
    const lens = [14, 22, 6, 30, 14, 120, 60, 12, 40];
    function draw() {
      bar.innerHTML = '';
      let tot = 0;
      for (let i = 0; i < n; i++) { tot += lens[i]; bar.appendChild(h('span', { class: 'ctx-seg ' + msgs[i][1] + (i < n - 3 && n > 4 ? ' stale' : ''), style: { flexGrow: lens[i] }, title: msgs[i][0] })); }
      bar.appendChild(h('span', { class: 'ctx-free', style: { flexGrow: Math.max(1, 400 - tot) } }));
      meters.innerHTML = '';
      meters.append(h('div', null, h('b', null, String(tot)), h('span', null, 'token 在窗口里（示意）')), h('div', null, h('b', null, n > 4 ? '变高' : '低'), h('span', null, '被无关旧内容干扰的风险')), h('div', null, h('b', null, tot > 150 ? '略慢略贵' : '正常'), h('span', null, '生成下一个 token 的成本')));
      narr.innerHTML = n === 0 ? '新对话从空的 token 窗口开始。点“发一条”往里加内容。' : n < 5 ? '你的每一句、它的每一句，都追加在同一条一维 token 序列后面。' : '话题已经换了两次。他的建议：<b>一换话题就开新对话</b>。原因有两个：窗口里无关的 token 会分散模型的注意力、降低准确率；token 越多，生成下一个 token 越慢、越贵（只是一点点）。把上下文当作宝贵的工作记忆，越短越好。';
    }
    fig.querySelector('.controls-slot').append(h('div', { class: 'controls' }, Z.button('发一条', () => { if (n < msgs.length) { n++; draw(); } }, 'primary'), Z.button('New chat', () => { n = 0; draw(); })));
    draw();
  });

  /* ---------- 9b: which feature for which job ---------- */
  Z.demo('d-pick', (fig) => {
    const body = fig.querySelector('.demo-body');
    const P = [
      ['常见、不会变的知识', '直接问，不用工具', '一杯美式里有多少咖啡因。网上到处都是、也不会变，模型记得住。', '不是高风险的事可以直接信，重要的事要核对。', 'C', '13:16'],
      ['难的数学、代码、逻辑', '思考模型', 'OpenAI 名字以 o 开头的模型、DeepSeek-R1 等。他的梯度检查一直失败，GPT-4o 没找到原因；换成思考模型，想了几分钟后找到了。', '先用普通模型，解决不了再换。问旅行建议没必要等它想一分钟。', 'C', '22:54'],
      ['最新的、冷门的、会变的信息', '联网搜索', '《白莲花度假村》第三季第二集什么时候播；Palantir 股票为什么涨；《文明 7》具体哪天发售。', '看引用链接，自己点进去核对。', 'C', '31:04'],
      ['要综合很多资料写报告', 'Deep Research', '一款长寿保健品里的 Ca-AKG 是什么；Brave 和 Arc 浏览器哪个更注重隐私。搜索 + 思考，跑几十分钟。录视频时要每月 200 美元的 Pro。', '当作初稿，不是定论，引用要查。', 'C', '42:06'],
      ['读论文、读书', '上传文件', '把论文 PDF 或一本书的章节放进上下文，边读边问。他的口号：别一个人读书。', '贴进来的内容是工作记忆，比让它凭记忆回忆可靠得多。', 'C', '50:59'],
      ['精确计算', 'Python 解释器', '大数乘法让它写代码算。', '生态很乱：有的 app 有解释器，有的没有，没有的可能直接编一个看着合理的结果。', 'C', '59:00'],
      ['画图、分析数据', 'ChatGPT 高级数据分析', '查 OpenAI 历年估值并画对数图、外推趋势。', '像个有点马虎的初级分析师：它偷偷把 2015 年估值假设成 1 亿美元；嘴上说 2030 年约 1.7 万亿，代码里的变量其实约 20 万亿。要能读懂代码。', 'C', '1:04:42'],
      ['做个小工具、闪卡、示意图', 'Claude Artifacts', '把亚当·斯密的维基百科简介变成 20 张闪卡，再做成一个能练习的小 app；画概念图。', '适合原型，不适合正式项目。', 'C', '1:09:01'],
      ['正经写代码', 'Cursor 等编辑器', '在整个代码库上工作，Composer 能跨文件修改、执行命令。他把放手交给它的方式命名为 vibe coding。', '出问题还能退回到自己读代码。', 'C', '1:14:02'],
      ['不想打字', '语音输入', '他大约一半时间是说的。Mac 上用 SuperWhisper，按一个键就开始听写。', '这是系统级的，不限于某个 app。', 'C', '1:22:30'],
      ['想听、想对话', 'Advanced Voice · NotebookLM', '真语音模式在模型内部处理音频 token，可以模仿声音、调语速；NotebookLM 能把你上传的资料生成一期播客。', '注意区分“假语音”（语音转文字再转回语音）和真语音。', 'C', '1:27:40'],
      ['看图问问题', '图片输入', '保健品营养成分表、20 页的血检报告截图、高露洁牙膏的成分表、看不懂的梗图。', '他的习惯：先让它把图里的文字转录出来，确认它看对了，再提问。', 'C', '1:40:27'],
      ['反复做的同一件事', '自定义 GPT · 记忆 · 自定义指令', '韩语词汇提取器：给一句话，按“韩语; 英语”输出词汇，直接导入 Anki。本质只是一段保存好的 few-shot 提示。', '记忆功能会把对话里的偏好存进以后的上下文。', 'C', '1:58:40'],
    ];
    const grid = h('div', { class: 'pick' });
    const list = h('div', { class: 'pick-list', role: 'listbox', 'aria-label': '你要做的事' });
    const card = h('div', { class: 'pick-card' });
    grid.append(list, card); body.appendChild(grid);
    const btns = P.map(([need], k) => { const b = h('button', { class: 'pick-b', type: 'button', role: 'option' }, need); b.addEventListener('click', () => show(k)); list.appendChild(b); return b; });
    function show(k) {
      btns.forEach((b, j) => { b.classList.toggle('on', j === k); b.setAttribute('aria-selected', j === k ? 'true' : 'false'); });
      const [need, tool, ex, tip, v, t] = P[k];
      card.innerHTML = '';
      const src = h('a', { class: 'src', 'data-v': v, 'data-t': t });
      const VIDS = { C: 'EWvNQjAaOHw' };
      src.textContent = 'How I use ' + t; src.href = 'https://www.youtube.com/watch?v=' + VIDS[v] + '&t=' + Z.tsSeconds(t) + 's'; src.target = '_blank'; src.rel = 'noopener'; src.classList.add('vC');
      card.append(h('p', { class: 'mini-title' }, need), h('h4', null, tool), h('p', null, h('b', null, '他的例子：'), ex), h('p', { class: 'muted' }, h('b', null, '注意：'), tip), src);
    }
    show(0);
  });

  /* ---------- 9c: fake audio vs true audio ---------- */
  Z.demo('d-voice', (fig) => {
    const body = fig.querySelector('.demo-body');
    let mode = 'fake';
    const svg = s('svg', { viewBox: '0 0 720 150', class: 'voice', role: 'img', 'aria-label': '假语音和真语音的流程对比' });
    body.appendChild(svg);
    const narr = h('p', { class: 'narr' }); body.appendChild(narr);
    const box = (x, w, t, sub, cls) => { const g = s('g', { class: 'osn ' + cls }); g.append(s('rect', { x, y: 45, width: w, height: 60, rx: 8 }), s('text', { x: x + w / 2, y: 70, 'text-anchor': 'middle', class: 'mn-t' }, t), s('text', { x: x + w / 2, y: 90, 'text-anchor': 'middle', class: 'mn-s' }, sub)); svg.appendChild(g); };
    const ar = (x1, x2) => svg.appendChild(s('line', { x1, y1: 75, x2, y2: 75, class: 'inj-a' }));
    function draw() {
      svg.innerHTML = '';
      if (mode === 'fake') { box(10, 90, '你说话', '声音', 'ink'); box(140, 120, '语音转文字', '另一个模型', 'tool'); box(300, 120, 'LLM', '只处理文字 token', 'ctx'); box(460, 120, '文字转语音', '另一个模型', 'tool'); box(620, 90, '它说话', '声音', 'ink'); ar(100, 140); ar(260, 300); ar(420, 460); ar(580, 620); }
      else { box(10, 120, '你说话', '声音', 'ink'); box(170, 120, '切成音频 token', '频谱图 · 量化', 'zip'); box(330, 160, 'LLM', '直接读写音频 token', 'ctx'); box(530, 180, '它说话', '音色、语速、语气都能变', 'ink'); ar(130, 170); ar(290, 330); ar(490, 530); }
      narr.innerHTML = mode === 'fake' ? '“假语音”：本质还是用文字和模型交流，只是前后各接了一个语音模型。手机上的麦克风听写、朗读按钮都属于这种。' : '“真语音”（ChatGPT 的 Advanced Voice Mode）：音频直接变成 token 进入模型，模型直接生成音频 token。所以它能模仿声音、用不同语气说话。他也提到它有时过于拘谨，这时可以换 Grok 的语音模式。';
    }
    fig.querySelector('.controls-slot').append(h('div', { class: 'controls' }, Z.seg('voice-m', [['fake', '假语音'], ['true', '真语音']], 'fake', (v) => { mode = v; draw(); })));
    draw();
  });

  /* ---------- recap: what happens when you hit Enter ---------- */
  Z.demo('d-enter', (fig) => {
    const body = fig.querySelector('.demo-body');
    const sc = h('div', { class: 'scroll-x' });
    const svg = s('svg', { viewBox: '0 0 720 190', class: 'enter', role: 'img', 'aria-label': '按下回车之后发生的事' });
    svg.style.minWidth = '600px';
    sc.appendChild(svg); body.appendChild(sc);
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' }); body.appendChild(narr);
    const B = [
      [10, '你的问题', '按下回车', 'ink'],
      [130, 'token', '切成文字块', 'ctx'],
      [250, '对话模板', 'im_start · user', 'ctx'],
      [370, '模型', 'zip + 笑脸', 'zip'],
      [490, '逐个采样', '可能调用工具', 'tool'],
      [610, '回答', '检查它的工作', 'ink'],
    ];
    const els = B.map(([x, t, sub, cls], k) => {
      if (k) svg.appendChild(s('line', { x1: x - 20, y1: 80, x2: x, y2: 80, class: 'inj-a' }));
      const g = s('g', { class: 'osn ' + cls });
      g.append(s('rect', { x, y: 50, width: 100, height: 60, rx: 8 }), s('text', { x: x + 50, y: 76, 'text-anchor': 'middle', class: 'mn-t' }, t), s('text', { x: x + 50, y: 96, 'text-anchor': 'middle', class: 'mn-s' }, sub));
      svg.appendChild(g); return g;
    });
    const say = [
      '回到最开始的问题：在 ChatGPT 里输入一句话、按下回车，到底发生了什么？',
      '你的问题被分词器切成 token（第一页第 9 集讲过 BPE）。',
      'token 被放进对话协议的格式里：轮到谁、从哪开始、到哪结束，最后服务器补上“该助手说了”。',
      '这些 token 送进模型。模型 = 预训练得到的有损压缩的互联网（知识有截止日期、记得模糊），加上后训练贴上去的“笑脸”：它在模仿按标注规范作答的人类标注员。如果是思考模型，还有强化学习里自己摸索出来的思考方式。',
      '模型一个 token 一个 token 地往外吐。每个 token 的计算量有限，所以难题要让它多写过程；需要时它会输出特殊 token 去搜索、跑代码，结果写回上下文窗口。',
      '你拿到回答。它在很多方面强得惊人，但能力像瑞士奶酪，会产生幻觉，也可能被注入攻击。他最后的建议：把它当工具，用来获得灵感和初稿，检查它的工作，对结果负责。',
    ];
    Z.player(fig, { n: say.length, render: (i) => { els.forEach((e, k) => { e.classList.toggle('on', k === i); e.classList.toggle('dim', k > i); }); narr.innerHTML = say[i]; }, controlsParent: fig.querySelector('.controls-slot'), interval: 3200 });
  });
})();
