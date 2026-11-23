'use strict';
document.documentElement.classList.add('has-js');
const one = (selector, root = document) => root.querySelector(selector);
const all = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const params = new URLSearchParams(location.search);
const formatNames = { business: 'Деловое событие', wedding: 'Свадьба', private: 'Частный вечер' };
const roomSlugs = ['white', 'restaurant', 'lounge', 'training', 'vip', 'billiard', 'karaoke'];
const slug = location.pathname.split('/').pop().replace(/\.html$/, '');
const formatParam = params.get('format');
const format = Object.hasOwn(formatNames, slug) ? slug : (Object.hasOwn(formatNames, formatParam) ? formatParam : '');
const guestParam = params.get('guests');
const guests = /^[1-9]\d{0,3}$/.test(guestParam || '') ? Number(guestParam) : 0;

function rememberSelection() {
  for (const link of all('a[href]')) {
    const raw = link.getAttribute('href');
    if (link.hasAttribute('data-reset') || !/^[a-z-]+\.html(?:[?#]|$)/.test(raw)) continue;
    const target = new URL(raw, location.href);
    const nextSlug = target.pathname.split('/').pop().replace(/\.html$/, '');
    const targetFormat = Object.hasOwn(formatNames, nextSlug) ? nextSlug : format;
    if (targetFormat && !target.searchParams.has('format')) target.searchParams.set('format', targetFormat);
    if (guests && !target.searchParams.has('guests')) target.searchParams.set('guests', String(guests));
    if (nextSlug === 'request' && !target.searchParams.has('hall')) {
      const selectedHall = slug === 'request' ? params.get('hall') : slug;
      if (roomSlugs.includes(selectedHall)) target.searchParams.set('hall', selectedHall);
    }
    link.setAttribute('href', nextSlug + '.html' + target.search + target.hash);
  }
}
rememberSelection();

const menu = one('.menu-button');
const nav = one('#nav');
function closeMenu(returnFocus = false) {
  nav.classList.remove('is-open');
  menu.setAttribute('aria-expanded', 'false');
  menu.setAttribute('aria-label', 'Открыть меню');
  if (returnFocus) menu.focus();
}
menu.addEventListener('click', () => {
  if (nav.classList.contains('is-open')) return closeMenu(true);
  nav.classList.add('is-open');
  menu.setAttribute('aria-expanded', 'true');
  menu.setAttribute('aria-label', 'Закрыть меню');
  one('a[href]', nav).focus();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && nav.classList.contains('is-open')) closeMenu(true);
});
document.addEventListener('focusin', event => {
  if (!nav.contains(event.target) && event.target !== menu && nav.classList.contains('is-open')) closeMenu();
});
document.addEventListener('click', event => {
  if (nav.classList.contains('is-open') && !event.target.closest('.top')) closeMenu();
});
window.matchMedia('(min-width: 701px)').addEventListener('change', event => {
  if (event.matches) closeMenu();
});

const sceneButtons = all('[data-scene]');
const scenes = all('.scene-image');
sceneButtons.forEach((button, index) => {
  button.addEventListener('click', () => {
    scenes.forEach((photo, i) => { photo.hidden = i !== index; });
    sceneButtons.forEach((item, i) => item.setAttribute('aria-pressed', String(i === index)));
    one('#scene-caption').textContent = scenes[index].alt;
  });
});

const filter = one('#filter');
if (filter) {
  const grid = one('#all-rooms');
  const unknownGrid = one('#unknown-rooms');
  const result = one('#results');
  const knownHeading = one('#known-heading');
  const unknownHeading = one('#unknown-heading');
  const cards = all('.room-card', grid);
  filter.elements.format.value = format;
  filter.elements.guests.value = guests || '';
  filter.addEventListener('submit', event => {
    event.preventDefault();
    const next = new URL('halls.html', location.href);
    if (filter.elements.format.value) next.searchParams.set('format', filter.elements.format.value);
    if (filter.elements.guests.value) next.searchParams.set('guests', filter.elements.guests.value);
    next.hash = 'results';
    location.assign(next.href);
  });
  filter.hidden = false;

  function publishedLayout(hall) {
    if (hall === 'white' && (!format || format === 'business') && guests <= 300) return 'До 300 гостей при посадке рядами.';
    if (hall === 'lounge' && (!format || format === 'private') && guests <= 25) return 'До 25 гостей на дне рождения.';
    return '';
  }
  function availableInformation(hall) {
    if (hall === 'white' && guests > 300) return 'До 300 мест рядами. Другую расстановку обсудите с менеджером.';
    if (hall === 'lounge' && guests > 25) return 'Для дня рождения указано до 25 гостей. Условия других форматов уточняются.';
    return 'Для вашей программы число мест уточнит менеджер.';
  }
  let matchingCount = 0;
  let layoutCount = 0;
  for (const card of cards) {
    card.hidden = guests > 350 || (Boolean(format) && !card.dataset.fmts.split(' ').includes(format));
    if (card.hidden) continue;
    matchingCount++;
    if (!guests) continue;
    const known = publishedLayout(card.dataset.room);
    const badge = document.createElement('span');
    badge.className = known ? 'room-status' : 'room-status unverified';
    badge.textContent = known || availableInformation(card.dataset.room);
    one('.card-text',card).append(badge);
    if (known) layoutCount++;
    else unknownGrid.append(card);
  }

  const unknownCount = matchingCount - layoutCount;
  knownHeading.hidden = !guests || !layoutCount;
  unknownHeading.hidden = unknownGrid.hidden = !guests || !unknownCount;
  grid.hidden = guests ? !layoutCount : !matchingCount;
  if (guests > 350) {
    result.textContent = 'Комплекс указывает до 350 гостей одновременно. Для большей группы обсудите с менеджером проведение события в несколько этапов.';
    const link = document.createElement('a');
    link.href = one('.call a').getAttribute('href');
    link.textContent = 'Обсудить программу';
    result.append(' ', link);
  } else if (guests) {
    const selected = (format ? formatNames[format] + ' · ' : '') + guests + ' чел.';
    const roomCount = n => n + ' ' + (n === 1 ? 'зал' : n < 5 && n > 0 ? 'зала' : 'залов');
    knownHeading.textContent = 'Есть данные по рассадке · ' + roomCount(layoutCount);
    unknownHeading.textContent = 'Вместимость нужно уточнить · ' + roomCount(unknownCount);
    if (!layoutCount) {
      result.textContent = selected + ' Для этого количества гостей у площадки нет опубликованной подходящей рассадки. Уточните вместимость у менеджера.';
    } else {
      result.textContent = selected + ' Под ваш размер группы подходит ' + roomCount(layoutCount) + ' с указанной ниже рассадкой. ' +
        (unknownCount ? 'Остальные варианты требуют уточнения.' : '');
    }
  } else if (format) {
    result.textContent = formatNames[format] + '. Залов для этого формата: ' + matchingCount + '.';
  }
  function openAnchor() {
    if (location.hash === '#comparison') one('#comparison details').open = true;
    if (location.hash === '#results') result.focus();
  }
  openAnchor();
  window.addEventListener('hashchange', openAnchor);
}

const form = one('#request-form');
if (form) {
  const fields = form.elements;
  const success = one('#form-success');
  const capacityNotice = one('#group-limit');
  const summary = one('#form-summary');
  fields.format.value = format;
  fields.guests.value = guests || '';
  if (roomSlugs.includes(params.get('hall'))) fields.hall.value = params.get('hall');
  const now = new Date();
  fields.date.min = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');

  function setError(field, message = '') {
    const id = 'err-' + field.name;
    let error = document.getElementById(id);
    if (!message) {
      if (error) error.remove();
      field.removeAttribute('aria-invalid');
      field.removeAttribute('aria-describedby');
      return;
    }
    if (!error) {
      error = document.createElement('span');
      error.id = id;
      error.className = 'error';
      field.after(error);
    }
    error.textContent = message;
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', id);
  }
  function updateGuestNotice() { capacityNotice.hidden = !(fields.guests.valueAsNumber > 350); }
  function updateDate() {
    const flexible = fields.dateFlexible.checked;
    fields.date.required = !flexible;
    fields.date.disabled = flexible;
    one('#date-rule').textContent = flexible ? 'не выбрана' : 'обязательно';
    setError(fields.date);
  }
  fields.dateFlexible.addEventListener('change', updateDate);
  fields.guests.addEventListener('input', updateGuestNotice);
  form.addEventListener('input', event => {
    if (event.target.hasAttribute('aria-invalid')) setError(event.target);
  });

  function addSummaryRow(label, value) {
    const row = document.createElement('div');
    const key = document.createElement('dt');
    const text = document.createElement('dd');
    key.textContent = label;
    text.textContent = value;
    row.append(key, text);
    summary.append(row);
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    const invalid = [];
    if (!fields.dateFlexible.checked && !fields.date.validity.valid) {
      setError(fields.date, 'Выберите сегодняшнюю или будущую дату либо отметьте «Дата пока не определена».');
      invalid.push(fields.date);
    }
    if (!fields.guests.validity.valid) {
      setError(fields.guests, 'Укажите целое число гостей от 1 до 9999.');
      invalid.push(fields.guests);
    }
    if (invalid.length) { invalid[0].focus(); return; }
    const date = fields.dateFlexible.checked ? 'Дата пока не определена' : new Intl.DateTimeFormat('ru-RU', {day:'numeric', month:'long', year:'numeric'}).format(new Date(fields.date.value + 'T12:00:00'));
    summary.replaceChildren();
    addSummaryRow('Формат', fields.format.selectedOptions[0].textContent);
    addSummaryRow('Зал', fields.hall.selectedOptions[0].textContent);
    addSummaryRow('Дата', date);
    addSummaryRow('Гостей', fields.guests.value);
    one('#call-advice').textContent = fields.guests.valueAsNumber > 350 ? capacityNotice.textContent : 'Назовите эти параметры менеджеру. Уточните свободные даты, расстановку столов или кресел и условия аренды.';
    form.hidden = true;
    success.hidden = false;
    one('#summary-heading').focus();
  });
  one('#edit-request').addEventListener('click', () => {
    success.hidden = true;
    form.hidden = false;
    fields.format.focus();
  });
  updateDate();
  updateGuestNotice();
  form.hidden = false;
  one('#call-fallback').hidden = true;
}
