// ===================================================================
// SHARED UI COMPONENTS
// ===================================================================

// Utility
function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// Icons
const ICONS = {
  chevronRight: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9,6 15,12 9,18"/></svg>`,
  arrowRight: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12,5 19,12 12,19"/></svg>`,
  placeholder: `<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.8" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
  search: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg>`,
  chair: `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.9"><path d="M7 18v3M17 18v3M5 10V6a2 2 0 012-2h10a2 2 0 012 2v4M5 10h14a2 2 0 012 2v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4a2 2 0 012-2z"/></svg>`,
  desk: `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.9"><rect x="2" y="7" width="20" height="3" rx="1"/><line x1="4" y1="10" x2="4" y2="20"/><line x1="20" y1="10" x2="20" y2="20"/><rect x="6" y="12" width="6" height="5" rx="0.5"/></svg>`,
  lamp: `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.9"><path d="M9 21h6M12 21v-6M8 3l-4 12h16L16 3z"/></svg>`,
  shelf: `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.9"><rect x="3" y="3" width="18" height="18" rx="1"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="12" y1="3" x2="12" y2="21"/></svg>`,
  cabinet: `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.9"><rect x="4" y="2" width="16" height="20" rx="1"/><line x1="4" y1="12" x2="20" y2="12"/><circle cx="14" cy="7" r="1"/><circle cx="14" cy="17" r="1"/></svg>`,
  korpus: `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.9"><rect x="5" y="4" width="14" height="16" rx="1"/><line x1="5" y1="9" x2="19" y2="9"/><line x1="5" y1="14" x2="19" y2="14"/><circle cx="15" cy="6.5" r="0.8"/><circle cx="15" cy="11.5" r="0.8"/><circle cx="15" cy="16.5" r="0.8"/></svg>`,
  garderobe: `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.9"><line x1="12" y1="2" x2="12" y2="22"/><line x1="6" y1="6" x2="12" y2="4"/><line x1="18" y1="6" x2="12" y2="4"/><circle cx="12" cy="22" r="2"/></svg>`,
  sofa: `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.9"><path d="M4 12V8a4 4 0 014-4h8a4 4 0 014 4v4"/><rect x="2" y="12" width="20" height="6" rx="2"/><line x1="4" y1="18" x2="4" y2="21"/><line x1="20" y1="18" x2="20" y2="21"/></svg>`,
  misc: `<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.9"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="12" y1="8" x2="12" y2="16"/></svg>`
};

function getProductImage(product) {
  const photoId = product.photo;
  if (photoId) {
    return `<img src="https://images.unsplash.com/${photoId}?w=600&h=400&fit=crop&auto=format&q=80" srcset="https://images.unsplash.com/${photoId}?w=400&h=267&fit=crop&auto=format&q=80 400w, https://images.unsplash.com/${photoId}?w=600&h=400&fit=crop&auto=format&q=80 600w, https://images.unsplash.com/${photoId}?w=800&h=533&fit=crop&auto=format&q=80 800w" sizes="(max-width: 480px) 100vw, (max-width: 768px) 50vw, 280px" alt="${product.name}" loading="lazy">`;
  }
  return getProductIcon(product);
}

function getProductIcon(product) {
  const cat = product.category;
  if (cat === 'stuehle') return ICONS.chair;
  if (cat === 'tische') return ICONS.desk;
  if (cat === 'lampen') return ICONS.lamp;
  if (cat === 'regale') return ICONS.shelf;
  if (cat === 'usm') return ICONS.shelf;
  if (cat === 'schraenke' || cat === 'sicherheitsschraenke') return ICONS.cabinet;
  if (cat === 'korpus') return ICONS.korpus;
  if (cat === 'garderobe') return ICONS.garderobe;
  if (cat === 'clubsessel-sofa') return ICONS.sofa;
  return ICONS.misc;
}

// ---- SHARED DETAIL COMPONENTS ----
function getItemPhotos(item) {
  const photos = item.photos || (item.photo ? [item.photo] : []);
  return photos;
}

function renderShareBar() {
  return `
    <div class="share-bar">
      <button class="btn btn--bare share-bar__btn" aria-label="Drucken" onclick="window.print()">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6,9 6,2 18,2 18,9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
      </button>
      <button class="btn btn--bare share-bar__btn share-bar__share-button" aria-label="Teilen" onclick="handleShareClick()">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
      </button>
    </div>
  `;
}

function renderDetailToolbar() {
  return `
    <div class="detail-toolbar">
      <button class="btn btn--outline btn--sm detail-toolbar__back" onclick="history.back()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12,19 5,12 12,5"/></svg>
        Zur\u00fcck
      </button>
      ${renderShareBar()}
    </div>
  `;
}

function renderCarousel(photos, altText, badgeHtml) {
  if (!photos || photos.length === 0) {
    return `
      <div class="carousel">
        <div class="carousel__slide carousel__slide--active">
          <div class="carousel__placeholder">${ICONS.placeholder}</div>
        </div>
        ${badgeHtml || ''}
      </div>
    `;
  }
  if (photos.length === 1) {
    return `
      <div class="carousel">
        <div class="carousel__viewport">
          <div class="carousel__track">
            <div class="carousel__slide carousel__slide--active">
              <img src="https://images.unsplash.com/${photos[0]}?w=600&h=450&fit=crop&auto=format&q=80" alt="${escapeHtml(altText)}" loading="lazy">
            </div>
          </div>
        </div>
        ${badgeHtml || ''}
      </div>
    `;
  }
  const slides = photos.map((photo, i) => `
    <div class="carousel__slide${i === 0 ? ' carousel__slide--active' : ''}" data-index="${i}">
      <img src="https://images.unsplash.com/${photo}?w=600&h=450&fit=crop&auto=format&q=80" alt="${escapeHtml(altText)} \u2013 Bild ${i + 1}" loading="lazy">
    </div>
  `).join('');
  const bullets = photos.map((_, i) => `
    <button class="carousel__bullet${i === 0 ? ' carousel__bullet--active' : ''}" data-index="${i}" aria-label="Bild ${i + 1}"></button>
  `).join('');
  return `
    <div class="carousel" data-carousel>
      <div class="carousel__viewport">
        <div class="carousel__track" style="transform:translateX(0%)">
          ${slides}
        </div>
      </div>
      ${badgeHtml || ''}
      <div class="carousel__fonctions">
        <button class="carousel__prev" aria-label="Vorheriges Bild">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15,18 9,12 15,6"/></svg>
        </button>
        <div class="carousel__pagination">
          ${bullets}
        </div>
        <button class="carousel__next" aria-label="N\u00e4chstes Bild">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9,18 15,12 9,6"/></svg>
        </button>
      </div>
    </div>
  `;
}

function handleShareClick() {
  const url = window.location.href;
  if (navigator.share) {
    navigator.share({ title: document.title, url: url });
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => {
      showToast('Link in die Zwischenablage kopiert');
    });
  }
}

function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('toast--visible');
  setTimeout(() => toast.classList.remove('toast--visible'), 2500);
}

function attachCarouselEvents() {
  document.querySelectorAll('[data-carousel]').forEach(carousel => {
    const track = carousel.querySelector('.carousel__track');
    const slides = carousel.querySelectorAll('.carousel__slide');
    const bullets = carousel.querySelectorAll('.carousel__bullet');
    const prevBtn = carousel.querySelector('.carousel__prev');
    const nextBtn = carousel.querySelector('.carousel__next');
    if (!track || slides.length < 2) return;
    let current = 0;
    const total = slides.length;
    function goTo(index) {
      current = ((index % total) + total) % total;
      track.style.transform = `translateX(-${current * 100}%)`;
      slides.forEach((s, i) => s.classList.toggle('carousel__slide--active', i === current));
      bullets.forEach((b, i) => b.classList.toggle('carousel__bullet--active', i === current));
    }
    prevBtn.addEventListener('click', () => goTo(current - 1));
    nextBtn.addEventListener('click', () => goTo(current + 1));
    bullets.forEach(b => b.addEventListener('click', () => goTo(Number(b.dataset.index))));
  });
}
