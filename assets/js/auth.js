import { storage, nowIso, toast } from './utils.js';

const KEY_SESSION = 'rkive.session';
const KEY_USERS = 'rkive.users';
const KEY_SEEDED = 'rkive.seeded.v1';

export async function seedIfNeeded(){
  const seeded = storage.get(KEY_SEEDED, null);
  if (seeded) return;

  // PONTO DE INTEGRAÇÃO FUTURA (API):
  // substituir fetch local por chamadas /api/seed ou /api/bootstrap
  const [users, contents, quizzes] = await Promise.all([
    fetch('./data/users.json').then(r => r.json()),
    fetch('./data/contents.json').then(r => r.json()),
    fetch('./data/quizzes.json').then(r => r.json()),
  ]);

  storage.set(KEY_USERS, users);
  storage.set('rkive.contents', contents);
  storage.set('rkive.quizzes', quizzes);

  // tentativas/progresso/chat inicialmente vazios
  storage.set('rkive.quizAttempts', []);
  storage.set('rkive.progress', {}); // { [userId]: { completed: { [contentId]: {completedAt} } } }
  storage.set('rkive.assistant', {}); // { [userId]: [messages] }

  storage.set(KEY_SEEDED, { seededAt: nowIso(), version: 1 });
}

export function getSession(){
  return storage.get(KEY_SESSION, null);
}

export function requireAuth(){
  const s = getSession();
  if (!s?.userId) location.href = './index.html';
}

export function getUsers(){
  return storage.get(KEY_USERS, []);
}

export function saveUsers(users){
  storage.set(KEY_USERS, users);
}

export function getCurrentUser(){
  const s = getSession();
  if (!s?.userId) return null;
  return getUsers().find(u => u.id === s.userId) || null;
}

export async function login(email, password){
  const users = getUsers();
  const u = users.find(x => x.email.toLowerCase() === email.toLowerCase() && x.active !== false);
  if (!u) throw new Error('Usuário não encontrado ou desativado.');

  // Simulação: senha salva em "passwordMock" (sem hash real)
  if ((u.passwordMock || '') !== password) throw new Error('Senha inválida.');

  // PONTO DE INTEGRAÇÃO FUTURA (API):
  // POST /api/auth/login com email/senha e receber token/sessão
  storage.set(KEY_SESSION, { userId: u.id, at: nowIso() });
  return u;
}

export function logout(){
  storage.del(KEY_SESSION);
}

export async function requestPasswordResetMock(email){
  const users = getUsers();
  const idx = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
  if (idx === -1) return;

  // Simula reset: define senha padrão
  users[idx].passwordMock = 'rkive123';
  users[idx].updatedAt = nowIso();
  saveUsers(users);

  // PONTO DE INTEGRAÇÃO FUTURA (API):
  // POST /api/auth/reset (email) / token etc.
}

export async function completeProfileIfNeeded(){
  // no login, apenas deixa pronto; wizard roda no dashboard
  return true;
}

export async function ensureProfileWizardIfNeeded(){
  const user = getCurrentUser();
  if (!user) return;

  const needs = !user.unit || !user.sector || !user.position;
  if (!needs) return;

  // wizard bloqueante simples
  const dlg = document.createElement('dialog');
  dlg.className = 'dialog';
  dlg.innerHTML = `
    <div class="dialog-head">
      <div>
        <h3>Complete seu perfil</h3>
        <p class="muted">Defina unidade, setor e cargo para personalizar sua trilha.</p>
      </div>
      <button class="icon-btn" data-close aria-label="Fechar" disabled>×</button>
    </div>
    <form class="dialog-body" method="dialog" id="profile-form">
      <div class="field">
        <label for="unit">Unidade</label>
        <select id="unit" name="unit" required>
          <option value="rKive">rKive</option>
        </select>
      </div>
      <div class="field">
        <label for="sector">Setor</label>
        <select id="sector" name="sector" required>
          <option value="" ${user.sector ? '' : 'selected'} disabled>Selecione</option>
          <option value="Cadastro" ${user.sector === 'Cadastro' ? 'selected' : ''}>Cadastro</option>
          <option value="CS" ${user.sector === 'CS' ? 'selected' : ''}>CS</option>
          <option value="Comercial" ${user.sector === 'Comercial' ? 'selected' : ''}>Comercial</option>
        </select>
      </div>
      <div class="field">
        <label for="position">Cargo</label>
        <select id="position" name="position" required>
          <option value="" ${user.position ? '' : 'selected'} disabled>Selecione</option>
          <option value="Auxiliar de Cadastro" ${user.position === 'Auxiliar de Cadastro' ? 'selected' : ''}>Auxiliar de Cadastro</option>
          <option value="Analista de CS" ${user.position === 'Analista de CS' ? 'selected' : ''}>Analista de CS</option>
        </select>
      </div>
    </form>
    <div class="dialog-foot">
      <button class="btn btn-primary" id="save-profile" type="button">Salvar</button>
    </div>
  `;
  document.body.appendChild(dlg);
  dlg.showModal();

  dlg.querySelector('#save-profile').addEventListener('click', () => {
    const unit = dlg.querySelector('#unit').value;
    const sector = dlg.querySelector('#sector').value;
    const position = dlg.querySelector('#position').value;

    if (!sector || !position) {
      toast('Preencha setor e cargo.', 'warning');
      return;
    }

    const users = getUsers();
    const idx = users.findIndex(u => u.id === user.id);
    users[idx] = { ...users[idx], unit, sector, position, updatedAt: nowIso() };
    saveUsers(users);

    dlg.close();
    dlg.remove();
    toast('Perfil atualizado.', 'success');
  });

  dlg.addEventListener('close', () => dlg.remove());
}
