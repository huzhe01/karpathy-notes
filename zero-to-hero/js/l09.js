/* Lecture 09 · Let's build the GPT Tokenizer */
(function () {
  const { h, s, fmt } = Z;
  const te = new TextEncoder();
  const td = new TextDecoder('utf-8', { fatal: false });

  /* ---------- 9a: string → code points → UTF-8 bytes ---------- */
  Z.demo('d-utf8', (fig) => {
    const body = fig.querySelector('.demo-body');
    const inp = h('input', { type: 'text', id: 'utf8-text', value: '안녕하세요 👋 (hello in Korean!)', autocomplete: 'off', spellcheck: 'false', 'aria-label': '输入任意文本' });
    fig.querySelector('.controls-slot').append(h('div', { class: 'controls' }, h('label', { class: 'field wide', for: 'utf8-text' }, '文本', inp),
      Z.button('韩语例子', () => { inp.value = '안녕하세요 👋 (hello in Korean!)'; draw(); }), Z.button('中文', () => { inp.value = '你好，世界！Hello'; draw(); })));
    const grid = h('div', { class: 'cp-grid' });
    const stats = h('p', { class: 'narr' });
    body.append(grid, stats);
    inp.addEventListener('input', draw);
    function draw() {
      grid.innerHTML = '';
      const chars = Array.from(inp.value);
      let nb = 0, n16 = 0;
      chars.forEach((ch) => {
        const cp = ch.codePointAt(0), bytes = te.encode(ch);
        nb += bytes.length; n16 += cp > 0xffff ? 2 : 1;
        grid.appendChild(h('div', { class: 'cp b' + bytes.length },
          h('span', { class: 'cp-ch' }, ch === ' ' ? '␠' : ch),
          h('span', { class: 'cp-ord' }, 'ord ' + cp),
          h('span', { class: 'cp-bytes' }, Array.from(bytes).join(' '))));
      });
      stats.innerHTML = `${chars.length} 个 Unicode 码点　→　UTF-8 <b>${nb}</b> 字节（每个码点 1–4 字节，颜色越深字节越多）　·　UTF-16 ${n16 * 2} 字节　·　UTF-32 ${chars.length * 4} 字节。<br>他的推理：码点有约 15 万个而且还在变，直接当词表太大也不稳定；UTF-8 字节只有 256 种，而且对英文最省，所以选 UTF-8。但纯字节序列太长，需要压缩，于是引出 BPE。`;
    }
    draw();
  });

  /* ---------- 9b: BPE by hand: aaabdaaabac ---------- */
  Z.demo('d-bpe-toy', (fig) => {
    const body = fig.querySelector('.demo-body');
    const seqs = ['aaabdaaabac', 'ZabdZabac', 'ZYdZYac', 'XdXac'];
    const merges = [['aa', 'Z'], ['ab', 'Y'], ['ZY', 'X']];
    const tape = h('div', { class: 'tape big' });
    const counts = h('div', { class: 'pair-counts' });
    const vocab = h('p', { class: 'mini-title' });
    const narr = h('p', { class: 'narr', 'aria-live': 'polite' });
    body.append(tape, counts, vocab, narr);
    const pairCounts = (t) => { const m = new Map(); for (let i = 0; i < t.length - 1; i++) { const p = t[i] + t[i + 1]; m.set(p, (m.get(p) || 0) + 1); } return [...m.entries()].sort((a, b) => b[1] - a[1]); };
    const expand = { Z: 'aa', Y: 'ab', X: 'aaab' };
    // states: 0 count aa · 1 minted Z · 2 count ab · 3 minted Y · 4 count ZY · 5 minted X · 6 summary
    function render(i) {
      const counting = i % 2 === 0 && i < merges.length * 2;
      const k = counting ? i / 2 : Math.min(merges.length, (i + 1) >> 1);
      const t = seqs[k];
      const hiPair = counting ? merges[k][0] : null;
      tape.innerHTML = '';
      let j = 0;
      while (j < t.length) {
        if (hiPair && t[j] + t[j + 1] === hiPair) { tape.appendChild(h('span', { class: 'tch pair' }, t[j] + t[j + 1])); j += 2; continue; }
        const isNew = !counting && i < merges.length * 2 && t[j] === merges[k - 1][1];
        tape.appendChild(h('span', { class: 'tch' + ('ZYX'.includes(t[j]) ? ' minted' : '') + (isNew ? ' fresh' : ''), title: expand[t[j]] || '' }, t[j])); j++;
      }
      counts.innerHTML = '';
      if (counting) pairCounts(t).forEach(([p, c]) => counts.appendChild(h('span', { class: 'pc' + (p === hiPair ? ' on' : '') }, h('code', null, p), ' × ' + c)));
      const minted = merges.slice(0, k).map(([p, z]) => `${z} = ${p}`);
      vocab.textContent = `词表：a b c d${minted.length ? '　+　' + minted.join('　') : ''}　·　序列长度 ${t.length}`;
      if (i === merges.length * 2) narr.innerHTML = '11 个符号压缩成 5 个，词表从 4 个涨到 7 个。这就是 BPE 的全部：用更大的词表换更短的序列。真实的 GPT 分词器在 UTF-8 字节上做同样的事，GPT-2 做了 50,000 次合并。';
      else if (counting) narr.innerHTML = `数一遍所有相邻的对（重叠的也算）：<code>${hiPair}</code> 出现最多。` + (k === 1 ? ' 这里 Za 和 ab 并列，按维基百科例子选 ab。' : '');
      else narr.innerHTML = `铸造一个新 token <b>${merges[k - 1][1]}</b> 代表 <code>${merges[k - 1][0]}</code>，把所有出现的地方替换掉，序列变短了。`;
    }
    Z.player(fig, { n: merges.length * 2 + 1, render, controlsParent: fig.querySelector('.controls-slot'), interval: 1800 });
  });

  /* ---------- 9c: train a byte-level BPE on a sample text, live ---------- */
  const SAMPLE = `Tokenization is the step that turns text into the integers a language model actually sees. The model never reads letters; it reads token ids. In the simplest version, every character is its own token, so the vocabulary is tiny and the sequences are long. Byte pair encoding takes the opposite trade: it starts from the 256 possible bytes of UTF-8 and then repeatedly finds the most common adjacent pair, mints a new token for that pair, and replaces it everywhere. After enough merges, common words such as the, and, ing, tion, and token become single tokens, while rare words are split into several pieces. The tokenizer is trained separately from the transformer, on its own text, and then frozen. Every strange behaviour that comes from splitting text into pieces, from spelling to arithmetic to trailing spaces, traces back to this table of merges. 分词器把文字变成整数，模型看到的只有这些整数。中文在英文为主的训练数据里出现得少，合并也少，所以同样的意思要用更多 token。`;
  function trainBPE(text, nm) {
    let ids = Array.from(te.encode(text));
    const merges = [], vocab = new Map();
    for (let i = 0; i < 256; i++) vocab.set(i, [i]);
    const snaps = [ids];
    for (let k = 0; k < nm; k++) {
      const st = new Map();
      for (let i = 0; i < ids.length - 1; i++) { const key = ids[i] * 100000 + ids[i + 1]; st.set(key, (st.get(key) || 0) + 1); }
      let best = null, bc = 1;
      for (const [key, c] of st) if (c > bc) { bc = c; best = key; }
      if (best == null) break;
      const a = Math.floor(best / 100000), b = best % 100000, idx = 256 + k;
      const out = [];
      for (let i = 0; i < ids.length; i++) { if (i < ids.length - 1 && ids[i] === a && ids[i + 1] === b) { out.push(idx); i++; } else out.push(ids[i]); }
      ids = out; merges.push([a, b, idx, bc]); vocab.set(idx, vocab.get(a).concat(vocab.get(b))); snaps.push(ids);
    }
    return { merges, vocab, snaps };
  }
  function encode(text, merges) {
    let ids = Array.from(te.encode(text));
    const rank = new Map(merges.map(([a, b, idx], r) => [a * 100000 + b, [r, idx]]));
    while (ids.length >= 2) {
      let best = null;
      for (let i = 0; i < ids.length - 1; i++) { const m = rank.get(ids[i] * 100000 + ids[i + 1]); if (m && (!best || m[0] < best[0])) best = m; }
      if (!best) break;
      const [, idx] = best, [a, b] = merges[best[0]];
      const out = [];
      for (let i = 0; i < ids.length; i++) { if (i < ids.length - 1 && ids[i] === a && ids[i + 1] === b) { out.push(idx); i++; } else out.push(ids[i]); }
      ids = out;
    }
    return ids;
  }
  Z.demo('d-bpe', (fig) => {
    const body = fig.querySelector('.demo-body');
    const MAX = 300;
    const T = trainBPE(SAMPLE, MAX);
    let k = 60;
    const view = h('div', { class: 'tokview' });
    const stats = h('p', { class: 'narr', 'aria-live': 'polite' });
    const ml = h('ol', { class: 'merge-list', start: 1 });
    const tryInp = h('input', { type: 'text', id: 'bpe-try', value: 'The tokenizer splits unbelievable words into tokens.', autocomplete: 'off', spellcheck: 'false', 'aria-label': '用训练好的合并表编码这段文本' });
    const tryView = h('div', { class: 'tokview small' });
    body.append(h('p', { class: 'mini-title' }, '训练文本按当前合并表切分（相邻 token 交替着色）'), view, stats,
      h('div', { class: 'two-col' }, h('div', null, h('p', { class: 'mini-title' }, '最近的合并'), ml), h('div', null, h('label', { class: 'field wide', for: 'bpe-try' }, '用这张合并表编码你的文本', tryInp), tryView)));
    const sl = Z.slider('bpe-k', '合并次数', 0, T.merges.length, 1, k, (v) => { k = v; draw(); }, (v) => String(v));
    fig.querySelector('.controls-slot').append(h('div', { class: 'controls' }, sl, Z.button('▶ 从 0 播放', async () => { for (let v = 0; v <= T.merges.length; v += 3) { sl.set(v); await Z.sleep(30); } }, 'primary')));
    const piece = (id) => td.decode(new Uint8Array(T.vocab.get(id)));
    function renderTokens(el, ids) {
      el.innerHTML = '';
      ids.forEach((id, i) => { const p = piece(id); el.appendChild(h('span', { class: 'tk' + (i % 6), title: 'id ' + id }, p.replace(/ /g, '␠').replace(/\n/g, '⏎'))); });
    }
    function draw() {
      const ids = T.snaps[k];
      renderTokens(view, ids);
      const nb = T.snaps[0].length;
      stats.innerHTML = `${nb} 字节 → <b>${ids.length}</b> 个 token，压缩比 <b>${fmt(nb / ids.length, 2)}×</b>，词表大小 256 + ${k} = ${256 + k}。` + (k === 0 ? ' 0 次合并时每个字节一个 token，一个汉字占 3 个 token。' : '');
      ml.innerHTML = '';
      const from = Math.max(0, k - 10);
      ml.setAttribute('start', from + 1);
      T.merges.slice(from, k).forEach(([a, b, idx, c]) => ml.appendChild(h('li', null, h('code', null, `(${a}, ${b}) → ${idx}`), '  ', h('span', { class: 'mono' }, JSON.stringify(piece(a)) + ' + ' + JSON.stringify(piece(b))), h('span', { class: 'muted' }, `  ×${c}`))));
      if (!k) ml.appendChild(h('li', { class: 'muted' }, '还没有合并'));
      renderTokens(tryView, encode(tryInp.value, T.merges.slice(0, k)));
    }
    tryInp.addEventListener('input', draw);
    draw();
  });

  /* ---------- 9d: regex pre-splitting ---------- */
  Z.demo('d-regex', (fig) => {
    const body = fig.querySelector('.demo-body');
    const pats = {
      gpt2: { src: "'s|'t|'re|'ve|'m|'ll|'d| ?\\p{L}+| ?\\p{N}+| ?[^\\s\\p{L}\\p{N}]+|\\s+(?!\\S)|\\s+", flags: 'gu', label: 'GPT-2' },
      gpt4: { src: "'(?:[sdmt]|ll|ve|re)|[^\\r\\n\\p{L}\\p{N}]?\\p{L}+|\\p{N}{1,3}| ?[^\\s\\p{L}\\p{N}]+[\\r\\n]*|\\s*[\\r\\n]|\\s+(?!\\S)|\\s+", flags: 'giu', label: 'GPT-4 (cl100k)' },
    };
    let which = 'gpt2';
    const inp = h('textarea', { id: 'regex-text', rows: 3, spellcheck: 'false', 'aria-label': '输入要切分的文本' });
    inp.value = "Hello've world123 how's are you!!!?   \nfor i in range(10):\n    print(i)";
    const out = h('div', { class: 'chunks' });
    const pre = h('pre', { class: 'code small' });
    const narr = h('p', { class: 'narr' });
    fig.querySelector('.controls-slot').append(h('div', { class: 'controls' }, Z.seg('regex-which', [['gpt2', 'GPT-2 正则'], ['gpt4', 'GPT-4 正则']], 'gpt2', (v) => { which = v; draw(); })));
    body.append(h('label', { class: 'field wide', for: 'regex-text' }, '文本', inp), out, pre, narr);
    inp.addEventListener('input', draw);
    function draw() {
      const p = pats[which];
      const re = new RegExp(p.src, p.flags);
      const parts = inp.value.match(re) || [];
      out.innerHTML = '';
      parts.forEach((t, i) => out.appendChild(h('span', { class: 'chunk tk' + (i % 6) }, t.replace(/ /g, '␠').replace(/\n/g, '⏎'))));
      pre.textContent = p.src;
      narr.innerHTML = `切成 <b>${parts.length}</b> 块。BPE 只在块内部合并，永远不会跨块，所以 “dog.” “dog!” “dog?” 不会各自变成一个 token，字母、数字、标点、空白被强行分开。` + (which === 'gpt4' ? ' GPT-4 的变化：缩写不区分大小写；数字最多 3 位一组；换行和空白处理更细，连续的缩进空格可以合在一起，所以写 Python 更省 token。（浏览器正则不支持占有量词，这里做了等价近似。）' : ' 他在视频里用的就是 “Hello\'ve world123 how\'s are you!!!?” 这个例子。注意 GPT-2 的缩写只认小写的 \'s。');
    }
    draw();
  });
})();
