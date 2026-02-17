import { getCurrentUser } from './auth.js';
import { toast } from './utils.js';

const ROLE_PERMS = {
  Admin: [
    'dashboard.view','onboarding.view','library.view','links.view','institutional.view',
    'quizzes.view','quizzes.take','quizzes.create','quizzes.results.view',
    'admin.users.manage','admin.contents.manage','admin.quizzes.manage','analytics.view'
  ],
  Supervisor: [
    'dashboard.view','onboarding.view','library.view','links.view','institutional.view',
    'quizzes.view','quizzes.take','quizzes.results.view'
    // quizzes.create e analytics.view são opcionais via override (allow)
  ],
  Colaborador: [
    'dashboard.view','onboarding.view','library.view','links.view','institutional.view',
    'quizzes.view','quizzes.take'
  ],
};

export function getEffectivePermissions(user){
  const base = new Set(ROLE_PERMS[user.role] || []);
  const allow = user.permissionsOverride?.allow || [];
  const deny = user.permissionsOverride?.deny || [];
  allow.forEach(p => base.add(p));
  deny.forEach(p => base.delete(p));
  return base;
}

export function can(permission){
  const user = getCurrentUser();
  if (!user) return false;
  return getEffectivePermissions(user).has(permission);
}

export function guardOrRedirect(permission, target){
  if (can(permission)) return true;
  toast('Acesso negado.', 'error');
  if (target) location.href = target;
  else location.hash = '#home';
  return false;
}

export function enforce(permission){
  if (!can(permission)) {
    toast('Acesso negado.', 'error');
    throw new Error('Acesso negado');
  }
}

export function getNavForUser(items){
  return items.filter(i => can(i.permission));
}
