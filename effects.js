// ── VISUAL EFFECTS ────────────────────────────────────────────────────────────
// Film grain, scroll reveal via IntersectionObserver.

export function initEffects() {
  initScrollReveal();
}

function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  // Observe existing elements; re-run on mutations
  function observeNew() {
    document.querySelectorAll('.card:not(.revealed):not(.scroll-hidden-skip), .choice-card:not(.revealed)')
      .forEach(el => {
        if (!el.classList.contains('scroll-hidden')) {
          el.classList.add('scroll-hidden');
        }
        observer.observe(el);
      });
  }

  observeNew();

  // Re-observe after DOM changes (chapter renders)
  const mo = new MutationObserver(observeNew);
  const chapterArea = document.getElementById('chapter-area');
  if (chapterArea) mo.observe(chapterArea, { childList: true, subtree: true });
}
