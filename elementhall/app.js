'use strict';
const one = (selector, root = document) => root.querySelector(selector);
const all = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const params = new URLSearchParams(location.search);
const formatNames = { business: 'Деловое событие', wedding: 'Свадьба', private: 'Частный вечер' };
const format = Object.hasOwn(formatNames,params.get('format')) ? params.get('format') : '';
const requestedGuests = Number(params.get('guests'));
const guests = Number.isInteger(requestedGuests) && requestedGuests > 0 && requestedGuests <= 9999 ? requestedGuests : 0;

function rememberSelection() {
  const slug = location.pathname.split('/').at(-1).replace(/\.html$/, '');
  const roomSlugs = ['white', 'restaurant', 'lounge', 'training', 'vip', 'billiard', 'karaoke'];
  for (const link of all('a[data-keep],a[href^="request.html"]')) {
    const [path, existing = ''] = link.getAttribute('href').split('?');
    const query = new URLSearchParams(existing);
    if (path === 'request.html' && roomSlugs.includes(slug) && !query.has('hall')) query.set('hall', slug);
    if (path === 'request.html' && Object.hasOwn(formatNames, slug) && !query.has('format')) query.set('format', slug);
    if (format && !query.has('format')) query.set('format', format);
    if (guests && !query.has('guests')) query.set('guests', String(guests));
    if (query.size) link.setAttribute('href', path + '?' + query.toString());
  }
}
rememberSelection();

const menu = one('.menu-button');
const nav = one('#nav');
function closeMenu(focusButton = false) {
  nav.classList.remove('is-open');
  menu.setAttribute('aria-expanded', 'false');
  menu.setAttribute('aria-label', 'Открыть меню');
  if (focusButton) menu.focus();
}
menu.addEventListener('click', () => {
  if (nav.classList.contains('is-open')) return closeMenu();
  nav.classList.add('is-open');
  menu.setAttribute('aria-expanded', 'true');
  menu.setAttribute('aria-label', 'Закрыть меню');
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && nav.classList.contains('is-open')) closeMenu(true);
});
document.addEventListener('click', e => {
  if (nav.classList.contains('is-open') && !e.target.closest('.top')) closeMenu();
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
  filter.elements.format.value = format;
  filter.elements.guests.value = guests || '';
  filter.addEventListener('submit', event => {
    event.preventDefault();
    const next = new URL('halls.html', location.href);
    if (filter.elements.format.value) next.searchParams.set('format', filter.elements.format.value);
    if (filter.elements.guests.value) next.searchParams.set('guests', filter.elements.guests.value);
    location.assign(next.href);
  });
  const grid = one('#all-rooms');
  const cards = all('.room-card', grid);
  const hasFilters = Boolean(format || guests);
  function guestStatus(hall) {
    if (hall === 'white' && (!format || format === 'business') && guests <= 300) return 'По числу мест подходит при театральной рассадке.';
    if (hall === 'lounge' && (!format || format === 'private') && guests <= 25) return 'По числу мест подходит для дня рождения.';
    return '';
  }
  let count = 0;
  for (const card of cards) {
    const fitsFormat = !format || card.dataset.fmts.split(' ').includes(format);
    card.hidden = !fitsFormat || guests > 350;
    if (card.hidden) continue;
    count++;
    if (guests) {
      const known = guestStatus(card.dataset.room);
      const badge = document.createElement('span');
      badge.className = 'room-status' + (known ? '' : ' unverified');
      badge.textContent = known || 'Вместимость для вашей программы уточнит менеджер.';
      one('.card-text',card).append(badge);
      if (!known) grid.append(card);
    }
  }
  const result = one('#results');
  if (guests > 350) {
    result.textContent = 'Комплекс рассчитан максимум на 350 гостей одновременно. Уменьшите число гостей или обсудите программу с менеджером.';
  } else if (hasFilters) {
    result.textContent = 'Залов для рассмотрения: ' + count + '.' + (guests ? ' Точная вместимость зависит от рассадки.' : '');
  }
}

const form = one('#request-form');
if (form) {
  const fields = form.elements;
  const success = one('#form-success');
  if (format) fields.format.value = format;
  if (guests) fields.guests.value = String(guests);
  if (Array.from(fields.hall.options).some(o => o.value === params.get('hall'))) fields.hall.value = params.get('hall');
  const now = new Date();
  fields.date.min = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  function error(field, message = '') {
    const id = 'err-' + field.name;
    let el = document.getElementById(id);
    if (!message) {
      if (el) el.remove();
      field.removeAttribute('aria-invalid');
      field.removeAttribute('aria-describedby');
      return;
    }
    if (!el) {
      el = document.createElement('span');
      el.id = id;
      el.className = 'error';
      field.after(el);
    }
    el.textContent = message;
    field.setAttribute('aria-invalid','true');
    field.setAttribute('aria-describedby',id);
  }
  fields.dateFlexible.addEventListener('change', () => {
    fields.date.required = !fields.dateFlexible.checked;
    one('#date-rule').textContent = fields.dateFlexible.checked ? 'по желанию' : 'обязательно';
    fields.date.disabled = fields.dateFlexible.checked;
    error(fields.date);
  });
  form.addEventListener('input', e => {
    if (e.target.name && e.target.hasAttribute('aria-invalid')) error(e.target);
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    const checks = [
      [fields.date, fields.dateFlexible.checked || (fields.date.value && fields.date.validity.valid), 'Выберите сегодняшнюю или будущую дату либо отметьте, что дата пока не определена.'],
      [fields.guests, fields.guests.value && fields.guests.validity.valid, 'Укажите целое число гостей от 1 до 9999.'],
      [fields.person, fields.person.value.trim(), 'Укажите имя для обращения.'],
      [fields.phone, /^[+\d\s()-]+$/.test(fields.phone.value) && /^\d{10,15}$/.test(fields.phone.value.replace(/\D/g,'')), 'Укажите телефон с кодом города или страны, от 10 до 15 цифр.']
    ];
    const invalid = checks.filter(([field, valid]) => !valid).map(([field, valid, message]) => { error(field, message); return field; });
    if (invalid.length) { invalid[0].focus(); return; }
    const date = fields.dateFlexible.checked ? 'Дата пока не определена' : new Intl.DateTimeFormat('ru-RU', {day:'numeric', month:'long', year:'numeric'}).format(new Date(fields.date.value+'T12:00:00'));
    const summary = [date, 'гостей: ' + fields.guests.value];
    if (fields.format.value) summary.push(fields.format.selectedOptions[0].textContent);
    if (fields.hall.value) summary.push(fields.hall.selectedOptions[0].textContent);
    one('#form-summary').textContent = summary.join(' · ') + '.';
    form.hidden = true;
    success.hidden = false;
    success.focus();
  });
  one('#edit-request').addEventListener('click', () => {
    success.hidden = true;
    form.hidden = false;
    fields.format.focus();
  });
}
