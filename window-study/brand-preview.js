const link = document.getElementById('home-view');
const crops = {
  angular2: {
    x: 390, y: 105, width: 1410, height: 185,
    source: './assets/yitong-brand-options-v2.png',
    clip: 'inset(20.03% 20.35% 66.16% 21.64%)',
  },
  angular: { x: 420, y: 120, width: 1335, height: 180 },
  signature: { x: 500, y: 360, width: 1160, height: 277 },
};

function showBrand() {
  const crop = crops[new URLSearchParams(location.search).get('brand')];
  if (!crop) {
    link.classList.remove('has-brand-art');
    link.textContent = 'Yitong Zhang';
    return;
  }
  const viewport = document.createElement('span');
  viewport.className = 'brand-art';
  viewport.style.aspectRatio = String(crop.width / crop.height);
  const image = new Image();
  image.src = new URL(crop.source || './assets/yitong-brand-options.png', import.meta.url).href;
  image.alt = 'Yitong Zhang';
  image.style.width = (2172 / crop.width * 100) + '%';
  image.style.left = (-crop.x / crop.width * 100) + '%';
  image.style.top = (-crop.y / crop.height * 100) + '%';
  if (crop.clip) image.style.clipPath = crop.clip;
  viewport.append(image);
  link.classList.add('has-brand-art');
  link.replaceChildren(viewport);
}
showBrand();
window.addEventListener('popstate', showBrand);
