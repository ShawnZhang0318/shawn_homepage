// Scene-independent HUD. Call update() whenever the scene state changes.
export function createStudyHUD({
  root = document.getElementById('hud'),
  onSelectNavSection = () => {},
  onResetCamera = () => {},
  onSelectCameraPreset = () => {},
  onToggleLight = () => {},
  onToggleRain = () => {},
} = {}) {
  const find = selector => root.querySelector(selector);
  const trigger = find('#view-trigger');
  const menu = find('#view-menu');
  const options = [...menu.querySelectorAll('[data-preset]')];
  const nav = [...root.querySelectorAll('[data-section]')];
  const drawer = find('#section-drawer');
  const light = find('#ceiling-light');
  const rain = find('#rain');
  let state = { ready: false, controlsEnabled: false, isLightOn: true, isRaining: true, currentCameraPreset: '', activeSection: null };
  let drawerOpener;
  const presets = new Map(options.map(option => [option.dataset.preset, option.textContent]));
  const abort = new AbortController();
  const listen = (element, type, callback) => element.addEventListener(type, callback, { signal: abort.signal });

  function closeMenu(returnFocus = false) {
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (returnFocus) trigger.focus();
  }
  function openMenu(index) {
    if (trigger.disabled) return;
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    (options[index] || options.find(option => option.getAttribute('aria-checked') === 'true') || options[0]).focus();
  }
  function closeDrawer(returnFocus = false) {
    drawer.hidden = true;
    if (returnFocus) drawerOpener?.focus();
    if (state.activeSection !== 'about') update({ activeSection: null });
  }
  function showSection(section) {
    closeMenu();
    const inScene = section === 'about' || section === 'work' || section === 'posts' || section === 'links';
    if (inScene) closeDrawer();
    onSelectNavSection(section);
    if (inScene) return;
    drawerOpener = nav.find(item => item.dataset.section === section);
    const content = {
      lab: ['Lab', 'A closer look at the robotics workbench.', 'Research & technical interests', '../research.html'],
    }[section];
    if (!content) return;
    find('#drawer-title').textContent = content[0];
    const body = find('#drawer-body');
    body.replaceChildren();
    const paragraph = document.createElement('p');
    paragraph.textContent = content[1];
    body.append(paragraph);
    if (content[3]) {
      const link = document.createElement('a');
      link.href = content[3];
      link.textContent = content[2] + ' ↗';
      body.append(link);
    }
    drawer.hidden = false;
    update({ activeSection: section });
    find('#close-drawer').focus({ preventScroll: true });
  }
  function selectPreset(preset) {
    closeMenu(true);
    closeDrawer();
    onSelectCameraPreset(preset);
  }
  function reset() {
    closeMenu();
    closeDrawer();
    onResetCamera();
  }
  listen(find('#home-view'), 'click', event => { event.preventDefault(); reset(); });
  listen(find('#reset-view'), 'click', reset);
  listen(find('#close-drawer'), 'click', () => closeDrawer(true));
  nav.forEach(button => listen(button, 'click', () => showSection(button.dataset.section)));
  listen(light, 'click', () => onToggleLight(!state.isLightOn));
  listen(rain, 'click', () => onToggleRain(!state.isRaining));
  listen(trigger, 'click', () => menu.hidden ? openMenu() : closeMenu());
  options.forEach(option => listen(option, 'click', () => selectPreset(option.dataset.preset)));
  listen(trigger, 'keydown', event => {
    if (['ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      openMenu(event.key === 'ArrowUp' ? options.length - 1 : 0);
    }
  });
  listen(menu, 'keydown', event => {
    const i = options.indexOf(document.activeElement);
    const moves = { ArrowDown: (i+1)%options.length, ArrowUp: (i+options.length-1)%options.length, Home: 0, End: options.length-1 };
    if (event.key in moves) { event.preventDefault(); options[moves[event.key]].focus(); }
    if (event.key === 'Tab') closeMenu();
  });
  listen(document, 'pointerdown', event => {
    if (!event.target.closest('.preset-picker')) closeMenu();
    if (!drawer.hidden && event.target.id === 'scene') closeDrawer();
  });
  listen(window, 'keydown', event => {
    if (event.key === 'Escape' && (!menu.hidden || !drawer.hidden)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!menu.hidden) closeMenu(true);
      else closeDrawer(true);
      return;
    }
    if (!state.controlsEnabled || event.repeat || event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;
    if (event.target.closest?.('input, textarea, select, [contenteditable="true"], [role="menu"]')) return;
    const preset = { '1': 'E05', '2': 'ROBOTICS', '3': 'BOOKCASE', '4': 'WINDOW' }[event.key];
    if (preset) { event.preventDefault(); selectPreset(preset); }
  });

  function update(next) {
    state = { ...state, ...next };
    light.setAttribute('aria-pressed', String(state.isLightOn));
    light.querySelector('span').textContent = state.isLightOn ? 'LIGHT ON' : 'LIGHT OFF';
    rain.setAttribute('aria-pressed', String(state.isRaining));
    rain.querySelector('span').textContent = 'RAIN';
    trigger.disabled = !state.controlsEnabled;
    if (!state.controlsEnabled) closeMenu();
    trigger.querySelector('span').textContent = presets.get(state.currentCameraPreset) ||
      ({ E06: 'LAPTOP', E01: 'CODE DISPLAY', E02: 'ROBOTICS DISPLAY', E03: 'CAD DISPLAY', E04: 'DATA DISPLAY', M01: 'TELEVISION', ABOUT: 'ABOUT NOTEBOOK', WORK: 'WORK NOTE', POSTS: 'POSTS DISPLAY', LINKS: 'LINKS DISPLAY' }[state.currentCameraPreset] || 'CUSTOM VIEW');
    for (const option of options) option.setAttribute('aria-checked', String(option.dataset.preset === state.currentCameraPreset));
    for (const button of nav) {
      button.disabled = !state.ready || Boolean(state.navigationLocked);
      const active = button.dataset.section === state.activeSection;
      if (active) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
      button.setAttribute('aria-expanded', String(active));
    }
  }
  update({});
  return { update, closeDrawer, destroy() { abort.abort(); } };
}
