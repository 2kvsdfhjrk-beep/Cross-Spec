/* Video posters below the fold are only fetched as they come near the screen. */
export function setPoster(v) {
  const src = v && v.getAttribute('data-poster');
  if (src && v.getAttribute('poster') !== src) v.setAttribute('poster', src);
}
export function lazyPosters(root = document) {
  const vids = Array.from(root.querySelectorAll('video[data-poster]'));
  if (!('IntersectionObserver' in window)) { vids.forEach(setPoster); return; }
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { setPoster(e.target); io.unobserve(e.target); }
  }), { rootMargin: '600px 0px' });
  vids.forEach((v) => io.observe(v));
}
