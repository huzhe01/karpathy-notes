/* Page chrome: course map, loss ledger, nav highlighting */
(function () {
  const { h } = Z;
  Z.demo('ledger', (el) => {
    const a = el.querySelector('.lg-names'), b = el.querySelector('.lg-shake');
    const names = [['02 bigram', 2.45], ['03 MLP', 2.2], ['04 初始化+BN', 2.1], ['06 上下文 8', 2.02], ['06 WaveNet', 1.993]];
    const shake = [['bigram', 2.5], ['单头', 2.4], ['多头', 2.28], ['+FFN', 2.24], ['+残差', 2.08], ['+LN', 2.06], ['放大', 1.48]];
    const mk = (box, data, y0, y1, ticks, color) => {
      const c = Z.canvas(box, 170);
      c.draw = () => {
        const g = Z.chart(c, { x: [-0.4, data.length - 0.6], y: [y0, y1], yticks: ticks, yfmt: (v) => v.toFixed(1), series: [{ pts: data.map((d, i) => [i, d[1]]), color, width: 2, dots: 3.5 }], pad: { b: 40, l: 36 } });
        const ctx = c.ctx; ctx.font = '11px ' + Z.MONO; ctx.textAlign = 'center';
        data.forEach((d, i) => {
          ctx.fillStyle = Z.color('ink'); ctx.fillText(String(d[1]), g.X(i), g.Y(d[1]) - 9);
          ctx.fillStyle = Z.color('muted'); ctx.save(); ctx.translate(g.X(i), c.h - 26); ctx.fillText(d[0], 0, 0); ctx.restore();
        });
      };
      c.draw();
    };
    mk(a, names, 1.8, 2.6, [1.8, 2.2, 2.6], 'fwd');
    mk(b, shake, 1.3, 2.7, [1.4, 2.0, 2.6], 'bwd');
  });

  document.addEventListener('DOMContentLoaded', () => {
    const chips = Z.$$('.rail a');
    const secs = chips.map((a) => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
    const io = new IntersectionObserver((ents) => {
      for (const e of ents) if (e.isIntersecting) chips.forEach((c) => c.classList.toggle('on', c.getAttribute('href') === '#' + e.target.id));
    }, { rootMargin: '-40% 0px -55% 0px' });
    secs.forEach((s) => io.observe(s));
  });
})();
