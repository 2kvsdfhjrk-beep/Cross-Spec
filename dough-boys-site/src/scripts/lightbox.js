/* Full-screen photo viewer. Without it (or without <dialog> support) the links still work:
   they open the gallery page or the photo itself. */
export function initLightbox(selector) {
  const lb = document.getElementById('lightbox');
  const links = Array.from(document.querySelectorAll(selector));
  if (!lb || !links.length || typeof lb.showModal !== 'function') return;
  const doc = document.documentElement;
  const fig = lb.querySelector('.lb-fig');
  const cap = lb.querySelector('#lb-cap');
  const img = document.createElement('img');
  img.decoding = 'async';
  fig.appendChild(img);
  let cur = 0;

  function show(i) {
    cur = (i + links.length) % links.length;
    const a = links[cur];
    const thumb = a.querySelector('img');
    img.src = a.getAttribute('data-full');
    img.alt = thumb ? thumb.alt : '';
    cap.textContent = a.getAttribute('data-cap') || '';
  }
  links.forEach((a, i) => {
    a.addEventListener('click', (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // new tab, new window
      e.preventDefault();
      show(i);
      lb.showModal();
      doc.classList.add('modal-open');
    });
  });
  const close = () => lb.close();
  lb.addEventListener('close', () => doc.classList.remove('modal-open'));
  lb.querySelector('#lb-prev').addEventListener('click', () => show(cur - 1));
  lb.querySelector('#lb-next').addEventListener('click', () => show(cur + 1));
  lb.querySelector('#lb-close').addEventListener('click', close);
  lb.addEventListener('click', (e) => { if (e.target === lb || e.target === fig) close(); });
  lb.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(cur - 1);
    if (e.key === 'ArrowRight') show(cur + 1);
  });
  let startX = null;
  lb.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', (e) => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 50) show(cur + (dx < 0 ? 1 : -1));
    startX = null;
  });
}
