// Always-on-top bar shown on this computer while someone is connected to it.
(function () {
  'use strict';
  const { h } = UIKit;
  const LABEL = { desktop: 'desktop', terminal: 'console', both: 'desktop + console', android: 'Android' };
  document.getElementById('open').onclick = () => pc.invoke('bar:open');
  document.getElementById('kickAll').onclick = () => pc.invoke('bar:kick');
  pc.on('sessions', (list) => {
    document.getElementById('headline').textContent = list.length === 1 ? `${list[0].from} is connected` : `${list.length} people are connected`;
    const box = document.getElementById('list');
    box.replaceChildren(...(list.length > 1 ? list : []).map((s) => h('div', { class: 'line' },
      h('b', {}, s.from), h('span', { class: 'grow' }, `${LABEL[s.mode]} · ${s.ip}`),
      h('button', { class: 'btn small ghost', style: { height: '20px' }, onclick: () => pc.invoke('bar:kick', s.sid) }, 'End'))));
  });
})();
