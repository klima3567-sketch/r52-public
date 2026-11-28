// Native links, including direct arrivals at anchors on asynchronously rendered pages.
document.addEventListener('DOMContentLoaded', () => {
  const page = document.querySelector('meta[name="atelier-page"]').content;
  const brand = 'Ателье 12|21';
  const hash = location.hash.slice(1);
  let awaitingTitle = ['Direction', 'Case', 'Article'].includes(page);
  let awaitingAnchor = Boolean(hash);
  function settle() {
    if (awaitingTitle) {
      const heading = document.querySelector('[data-screen-label] h1');
      if (heading && heading.textContent.trim()) {
        document.title = heading.textContent.trim() + ' — ' + brand;
        awaitingTitle = false;
      }
    }
    if (awaitingAnchor) {
      const target = document.getElementById(hash);
      if (target && document.querySelector('.atelier-header')) {
        awaitingAnchor = false;
        requestAnimationFrame(() => {
          target.scrollIntoView({block:'start'});
          if (document.fonts) document.fonts.ready.then(() => {
            if (location.hash.slice(1) === hash && Math.abs(target.getBoundingClientRect().top - 82) < 70) {
              target.scrollIntoView({block:'start'});
            }
          });
        });
      }
    }
    if (!awaitingAnchor && !awaitingTitle) observer.disconnect();
  }
  const observer = new MutationObserver(settle);
  observer.observe(document.body, {childList:true,subtree:true,characterData:true});
  settle();
  window.setTimeout(() => observer.disconnect(), 10000);
});
