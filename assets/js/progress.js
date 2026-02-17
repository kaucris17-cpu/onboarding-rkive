import { storage, nowIso } from './utils.js';
import { ContentRepo } from './content.js';

const KEY = 'rkive.progress';

export function getUserProgress(userId){
  const all = storage.get(KEY, {});
  const data = all[userId] || { completed: {}, recentActivity: [] };

  // normalizar
  data.completed ||= {};
  data.recentActivity ||= [];
  return data;
}

function saveUserProgress(userId, progress){
  const all = storage.get(KEY, {});
  all[userId] = progress;
  storage.set(KEY, all);
}

export async function markCompleted(userId, contentId){
  const p = getUserProgress(userId);
  if (!p.completed[contentId]) {
    p.completed[contentId] = { completedAt: nowIso() };

    const content = await ContentRepo.getById(contentId);
    p.recentActivity.unshift({
      kind: 'Conteúdo concluído',
      title: content?.title || contentId,
      at: p.completed[contentId].completedAt
    });
    p.recentActivity = p.recentActivity.slice(0, 30);

    saveUserProgress(userId, p);
  }
}

export function percentRequired(trail, progress){
  const req = trail.requiredItems || [];
  if (!req.length) return 100;
  const done = req.filter(c => progress.completed[c.id]).length;
  const pct = Math.round((done / req.length) * 100);
  return Math.max(0, Math.min(100, pct));
}

export function nextRequiredItems(trail, progress, limit=3){
  const req = trail.requiredItems || [];
  return req.filter(c => !progress.completed[c.id]).slice(0, limit);
}
