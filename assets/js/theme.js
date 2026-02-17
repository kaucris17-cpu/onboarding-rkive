import { storage, h } from './utils.js';

const KEY = 'rkive.theme'; // 'light' | 'dark'

export function initTheme(){
  const saved = storage.get(KEY, 'light');
  applyTheme(saved);
}

export function applyTheme(theme){
  const html = document.documentElement;
  html.classList.toggle('theme-dark', theme === 'dark');
  storage.set(KEY, theme);
}

export function toggleTheme(){
  const cur = storage.get(KEY, 'light');
  applyTheme(cur === 'dark' ? 'light' : 'dark');
}

export function mountThemeToggle(){
  const btn = h('button', { class: 'btn btn-ghost', type: 'button', id: 'theme-toggle' }, 'Modo escuro');
  btn.addEventListener('click', () => toggleTheme());
  return btn;
}
