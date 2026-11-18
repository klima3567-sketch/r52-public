(() => {
  'use strict';
  const $ = (q, root = document) => root.querySelector(q);
  const $$ = (q, root = document) => [...root.querySelectorAll(q)];
  const video = $('#slavik-video');
  const caption = $('#scene-caption');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let heroVisible = true;
  const syncPlayback = () => {
    const shouldPlay = heroVisible && !document.hidden && !reduced.matches;
    video.autoplay = shouldPlay;
    if (shouldPlay) video.play().catch(() => {});
    else video.pause();
  };
  video.addEventListener('timeupdate', () => { const t = video.currentTime; caption.innerHTML = t < 3 ? 'Модель наушников он помнит.<br>Когда купил щётку - не очень.' : t < 7 ? 'Есть вещи, к которым<br>стоит присмотреться.' : 'С телефоном разобрался.<br>Теперь можно заняться собой.'; });
  video.addEventListener('loadeddata', syncPlayback, { once: true });
  document.addEventListener('visibilitychange', syncPlayback);
  reduced.addEventListener('change', syncPlayback);
  syncPlayback();
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => { entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in-view'); observer.unobserve(e.target); } }); }, { threshold: .15 });
    $$('.infinity-panel').forEach(el => observer.observe(el));
    const heroObserver = new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; $('.mobile-cta').classList.toggle('visible', !heroVisible); syncPlayback(); }, { threshold: 0 });
    heroObserver.observe($('.hero'));
  } else { $('.infinity-panel').classList.add('in-view'); $('.mobile-cta').classList.add('visible'); }
  const tabs = $$('[role="tab"]');
  const chooseTab = (tab, focus = false) => { tabs.forEach(t => { const selected = t === tab; t.setAttribute('aria-selected', String(selected)); t.tabIndex = selected ? 0 : -1; $('#' + t.getAttribute('aria-controls')).hidden = !selected; }); if (focus) tab.focus(); };
  tabs.forEach((tab, i) => { tab.addEventListener('click', () => chooseTab(tab)); tab.addEventListener('keydown', e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) { e.preventDefault(); const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length; chooseTab(tabs[next], true); } }); });
  const menu = $('.menu-toggle');
  const closeMenu = () => { menu.setAttribute('aria-expanded', 'false'); $('#mobile-menu').hidden = true; };
  menu.addEventListener('click', () => { const open = menu.getAttribute('aria-expanded') !== 'true'; menu.setAttribute('aria-expanded', String(open)); $('#mobile-menu').hidden = !open; });
  $$('#mobile-menu a').forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  const dialog = $('#booking-dialog');
  let branch = 'Казанская набережная, 5';
  let intent = 'Гигиена и программа';
  let opener = null;
  const updateMessage = () => { $('#booking-message').textContent = `Здравствуйте! Хочу записаться на профессиональную гигиену в Имплант52 (${branch}) и узнать о программе «Щётка бесконечности». Мой вопрос: ${intent}. Подскажите, пожалуйста, стоимость и свободные даты.`; $('#copy-status').textContent = ''; $('.booking-call').href = branch.startsWith('Страж') ? 'tel:+78312601220' : 'tel:+78312601200'; $('.booking-call').textContent = branch.startsWith('Страж') ? 'Позвонить: +7 (831) 260-12-20' : 'Позвонить: +7 (831) 260-12-00'; };
  $$('[data-book]').forEach(b => b.addEventListener('click', () => { intent = b.dataset.book; opener = b; updateMessage(); closeMenu(); if (typeof dialog.showModal === 'function') { dialog.showModal(); document.body.classList.add('modal-open'); } else { location.href = $('.booking-call').href; } }));
  const closeDialog = () => dialog.close();
  $('.dialog-close').addEventListener('click', closeDialog);
  dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeDialog(); } });
  dialog.addEventListener('close', () => { document.body.classList.remove('modal-open'); opener?.focus(); });
  $$('.branch-option').forEach(b => b.addEventListener('click', () => { branch = b.dataset.branch; $$('.branch-option').forEach(o => { const active = o === b; o.classList.toggle('active', active); o.setAttribute('aria-pressed', String(active)); }); updateMessage(); }));
  $('#copy-message').addEventListener('click', async () => { const txt = $('#booking-message').textContent; try { if (!navigator.clipboard) throw Error('unavailable'); await navigator.clipboard.writeText(txt); $('#copy-status').textContent = 'Скопировано. Можно вставить в чат клиники.'; } catch { const range = document.createRange(); range.selectNodeContents($('#booking-message')); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); $('#copy-status').textContent = 'Текст выделен. Скопируйте его через меню устройства.'; } });
  updateMessage();
})();
