const APP_NS = 'rkive';

export function setDocumentTitle(title){ document.title = title; }

export function qs(sel, root=document){ return root.querySelector(sel); }

export function h(tag, attrs={}, children=[]) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined) continue;
    if (k === 'class') el.className = v;
    else if (k === 'onclick') el.addEventListener('click', v);
    else if (k.startsWith('aria-') || k === 'role' || k === 'tabindex') el.setAttribute(k, String(v));
    else if (k === 'hidden') el.hidden = true;
    else el.setAttribute(k, String(v));
  }
  const flat = Array.isArray(children) ? children : [children];
  for (const c of flat) {
    if (c === null || c === undefined) continue;
    if (typeof c === 'string' || typeof c === 'number') el.appendChild(document.createTextNode(String(c)));
    else el.appendChild(c);
  }
  return el;
}

export function nowIso(){ return new Date().toISOString(); }

export function formatDateTime(iso){
  try{
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { dateStyle:'short', timeStyle:'short' });
  } catch { return String(iso || ''); }
}

export function uid(prefix='id'){
  const r = Math.random().toString(16).slice(2);
  return `${prefix}_${Date.now().toString(16)}_${r}`;
}

export const storage = {
  get(key, fallback=null){
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
  },
  set(key, value){
    localStorage.setItem(key, JSON.stringify(value));
  },
  del(key){ localStorage.removeItem(key); }
};

export function toast(message, variant='info'){
  const root = qs('#toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast ${variant}`;
  el.innerHTML = `<div class="dot" aria-hidden="true"></div><div><div style="font-weight:600">rKive</div><div>${escapeHtml(message)}</div></div>`;
  root.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(6px)'; }, 2400);
  setTimeout(() => el.remove(), 3000);
}

export function escapeHtml(s){
  return String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

/* CSV sem libs */
export function toCsv(rows, headers){
  const esc = (v) => `"${String(v ?? '').replaceAll('"','""')}"`;
  const head = headers.map(esc).join(',');
  const lines = rows.map(r => headers.map(h => esc(r[h])).join(','));
  return [head, ...lines].join('\n');
}

export function downloadTextFile(filename, text){
  const blob = new Blob([text], { type:'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* Command palette (Ctrl+K) */
export function mountCommandPalette({ items, hint=''}){
  const root = document.createElement('div');
  root.className = 'cmdk';
  root.innerHTML = `
    <div class="cmdk-backdrop" data-close></div>
    <div class="cmdk-panel" role="dialog" aria-modal="true" aria-label="Menu rápido">
      <div class="cmdk-head">
        <input id="cmdk-input" type="text" placeholder="Buscar..." aria-label="Buscar no menu rápido" />
        <div class="muted small">${escapeHtml(hint)} • Enter para abrir • Esc para fechar</div>
      </div>
      <div class="cmdk-list" id="cmdk-list"></div>
    </div>
  `;
  document.body.appendChild(root);

  const input = root.querySelector('#cmdk-input');
  const list = root.querySelector('#cmdk-list');

  let filtered = items.slice();
  let activeIndex = 0;

  function renderList(){
    list.innerHTML = '';
    if (!filtered.length){
      const p = document.createElement('div');
      p.className = 'muted';
      p.style.padding = '10px';
      p.textContent = 'Nenhum resultado.';
      list.appendChild(p);
      return;
    }
    filtered.forEach((it, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `cmdk-item ${idx === activeIndex ? 'active' : ''}`;
      btn.innerHTML = `<span>${escapeHtml(it.label)}</span><span class="muted small">Enter</span>`;
      btn.addEventListener('click', () => { it.action(); close(); });
      list.appendChild(btn);
    });
  }

  function open(){
    root.classList.add('open');
    activeIndex = 0;
    filtered = items.slice();
    input.value = '';
    renderList();
    setTimeout(() => input.focus(), 0);
  }
  function close(){
    root.classList.remove('open');
  }

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    filtered = items.filter(i => i.label.toLowerCase().includes(q));
    activeIndex = 0;
    renderList();
  });

  root.addEventListener('click', (e) => {
    if (e.target?.dataset?.close !== undefined) close();
  });

  document.addEventListener('keydown', (e) => {
    const isMac = navigator.platform.toUpperCase().includes('MAC');
    const mod = isMac ? e.metaKey : e.ctrlKey;

    if (mod && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      root.classList.contains('open') ? close() : open();
    }

    if (!root.classList.contains('open')) return;

    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, filtered.length - 1); renderList(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); renderList(); }
    if (e.key === 'Enter') {
      e.preventDefault();
      const it = filtered[activeIndex];
      if (it) { it.action(); close(); }
    }
  });

  window.__rkiveCmdkOpen = open;
  return root;
}
