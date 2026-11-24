const panel = document.getElementById('loading');
const hud = document.getElementById('hud');
const stage = document.getElementById('loading-stage');
const fill = document.getElementById('loading-fill');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let progress = 0;
const fractions = [0, 0, 0, 0, 0];
const weights = [.34, .09, .01, .02, .04];

function updateProgress(value) {
  progress = Math.max(progress, Math.min(1, value));
  const percent = Math.round(progress * 100);
  fill.style.transform = 'scaleX(' + progress + ')';
  document.getElementById('loading-percent').textContent = percent + '%';
  document.getElementById('loading-progress').setAttribute('aria-valuenow', String(percent));
}

export function assetProgress(index, event) {
  if (!event.lengthComputable || event.total <= 0) return;
  fractions[index] = Math.min(1, event.loaded / event.total);
  updateProgress(.06 + fractions.reduce((sum, fraction, i) => sum + fraction * weights[i], 0));
}

// Yield after each stage change so the loading screen can paint before
// model assembly and the first shadow pass occupy the main thread.
export async function loadingPhase(label, value) {
  stage.textContent = label;
  updateProgress(value);
  await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
}

export function loadedAsset(index) {
  fractions[index] = 1;
  updateProgress(.06 + fractions.reduce((sum, fraction, i) => sum + fraction * weights[i], 0));
}

export async function revealStudy() {
  await loadingPhase('READY', 1);
  panel.classList.add('is-entering');
  await new Promise(resolve => {
    const finish = () => {
      panel.removeEventListener('transitionend', ended);
      clearTimeout(timeout);
      resolve();
    };
    const ended = event => {
      if (event.target === panel && event.propertyName === 'opacity') finish();
    };
    const timeout = setTimeout(finish, reduced.matches ? 0 : 700);
    panel.addEventListener('transitionend', ended);
  });
  panel.hidden = true;
  hud.inert = false;
}

export function loadingFailed() {
  panel.hidden = false;
  panel.classList.remove('is-entering');
  panel.classList.add('has-error');
  document.getElementById('loading-title').textContent = 'The study couldn’t open';
  stage.textContent = 'Please try again.';
  document.getElementById('loading-progress').hidden = true;
  const retry = document.getElementById('loading-retry');
  retry.hidden = false;
  retry.onclick = () => location.reload();
}
