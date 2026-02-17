import { storage, nowIso, h, toast } from './utils.js';
import { getTrailForUser } from './content.js';
import { getUserProgress, percentRequired } from './progress.js';
import { getUsers } from './auth.js';
import { can } from './permissions.js';

const KEY_QUIZZES = 'rkive.quizzes';
const KEY_ATTEMPTS = 'rkive.quizAttempts';

export const QuizRepo = {
  async list(){
    return storage.get(KEY_QUIZZES, []);
  },
  async saveAll(quizzes){
    // PONTO DE INTEGRAÇÃO FUTURA (API):
    // PUT /api/quizzes
    storage.set(KEY_QUIZZES, quizzes);
  },
  async listAttempts(){
    return storage.get(KEY_ATTEMPTS, []);
  },
  async saveAttempts(attempts){
    // PONTO DE INTEGRAÇÃO FUTURA (API):
    // POST /api/attempts
    storage.set(KEY_ATTEMPTS, attempts);
  },
  async getById(id){
    const all = await this.list();
    return all.find(q => q.id === id) || null;
  },

  async createRunner({ user, quizId, runId }){
    const quiz = await this.getById(quizId);
    if (!quiz) throw new Error('Avaliação não encontrada.');
    if (!can('quizzes.take')) throw new Error('Sem permissão.');

    const startAt = nowIso();
    let idx = 0;
    const answers = {};
    const maxScore = quiz.questions.length;

    const el = h('div', { class: 'quiz-runner' }, []);
    const header = h('div', { class: 'dialog-head' }, [
      h('div', {}, [
        h('div', { class: 'badge badge-soft' }, quiz.kind === 'final' ? 'Questionário final' : 'Prova periódica'),
        h('h3', {}, quiz.title),
        h('p', { class: 'muted' }, quiz.description || 'Responda às questões e finalize para registrar a tentativa.')
      ]),
      h('button', { class: 'icon-btn', 'aria-label': 'Fechar', type: 'button' }, '×')
    ]);

    const body = h('div', { class: 'dialog-body' }, []);
    const foot = h('div', { class: 'dialog-foot' }, []);

    const closeBtn = header.querySelector('button');
    closeBtn.addEventListener('click', () => runner.onClose?.());

    function renderQuestion(){
      body.innerHTML = '';
      const q = quiz.questions[idx];

      body.appendChild(
        h('div', { class: 'stack' }, [
          h('div', { class: 'row-between' }, [
            h('strong', {}, `Questão ${idx+1} de ${quiz.questions.length}`),
            h('span', { class: 'muted small' }, `Tempo: ${Math.round((Date.now() - new Date(startAt).getTime())/1000)}s`)
          ]),
          h('div', {}, [
            h('h4', {}, q.prompt),
            h('div', { class: 'stack' },
              q.options.map((opt, i) => {
                const id = `q_${idx}_${i}`;
                const checked = answers[q.id] === i;
                return h('div', { class: 'list-item' }, [
                  h('label', { for: id, style: 'display:flex;align-items:center;gap:10px;cursor:pointer;width:100%' }, [
                    h('input', { id, type: 'radio', name: `q_${q.id}`, value: String(i), checked: checked ? 'true' : null }),
                    h('span', {}, opt)
                  ])
                ]);
              })
            )
          ])
        ])
      );

      // capturar clique nos radios
      body.querySelectorAll('input[type="radio"]').forEach(r => {
        r.addEventListener('change', () => {
          answers[q.id] = Number(r.value);
        });
      });

      foot.innerHTML = '';
      foot.appendChild(h('button', {
        class: 'btn btn-ghost',
        type: 'button',
        disabled: idx === 0 ? 'true' : null,
        onclick: () => { idx = Math.max(0, idx-1); renderQuestion(); }
      }, 'Voltar'));

      if (idx < quiz.questions.length - 1) {
        foot.appendChild(h('button', {
          class: 'btn btn-primary',
          type: 'button',
          onclick: () => { idx = Math.min(quiz.questions.length - 1, idx+1); renderQuestion(); }
        }, 'Avançar'));
      } else {
        foot.appendChild(h('button', {
          class: 'btn btn-primary',
          type: 'button',
          onclick: () => finalize()
        }, 'Finalizar'));
      }
    }

    async function finalize(){
      // calcular pontuação
      let score = 0;
      for (const q of quiz.questions) {
        if (answers[q.id] === q.correctIndex) score += 1;
      }
      const finishedAt = nowIso();
      const durationSec = (new Date(finishedAt).getTime() - new Date(startAt).getTime()) / 1000;
      const status = score >= (quiz.minScore ?? maxScore) ? 'Apto' : 'Não apto';

      const attempt = {
        id: `${user.id}_${quiz.id}_${Date.now()}`,
        userId: user.id,
        quizId: quiz.id,
        quizTitle: quiz.title,
        kind: quiz.kind,
        runId: runId || null,
        startedAt: startAt,
        finishedAt,
        durationSec,
        score,
        maxScore,
        minScore: quiz.minScore ?? maxScore,
        status,
        answers,
      };

      const all = await QuizRepo.listAttempts();
      all.push(attempt);
      await QuizRepo.saveAttempts(all);

      // registrar atividade recente no progresso
      const progAll = storage.get('rkive.progress', {});
      const p = progAll[user.id] || { completed: {}, recentActivity: [] };
      p.recentActivity ||= [];
      p.recentActivity.unshift({ kind: 'Avaliação', title: `${quiz.title} (${status})`, at: finishedAt });
      p.recentActivity = p.recentActivity.slice(0, 30);
      progAll[user.id] = p;
      storage.set('rkive.progress', progAll);

      toast(`Tentativa registrada: ${score}/${maxScore} (${status}).`, status === 'Apto' ? 'success' : 'warning');
      runner.onDone?.();
    }

    const runner = { el, onClose: null, onDone: null };
    el.appendChild(header);
    el.appendChild(body);
    el.appendChild(foot);
    renderQuestion();
    return runner;
  },

  async buildTeamResultsView(viewer){
    // Admin vê tudo. Supervisor vê apenas escopo definido.
    const attempts = await this.listAttempts();
    const users = getUsers();

    let allowedUserIds = null;

    if (viewer.role === 'Admin') {
      allowedUserIds = new Set(users.filter(u => u.active !== false).map(u => u.id));
    } else {
      // Supervisor
      const scope = viewer.teamScope || {};
      const set = new Set();

      if (Array.isArray(scope.userIds) && scope.userIds.length) scope.userIds.forEach(id => set.add(id));

      // se houver filtro por setor/cargo
      users.forEach(u => {
        if (u.active === false) return;
        const okSector = !scope.sector || u.sector === scope.sector;
        const okPos = !scope.position || u.position === scope.position;
        if (okSector && okPos) set.add(u.id);
      });

      allowedUserIds = set;
    }

    const rows = attempts
      .filter(a => allowedUserIds.has(a.userId))
      .slice()
      .sort((a,b) => new Date(b.finishedAt) - new Date(a.finishedAt))
      .slice(0, 200)
      .map(a => {
        const u = users.find(x => x.id === a.userId);
        return {
          userName: u?.name || a.userId,
          quizTitle: a.quizTitle,
          finishedAt: a.finishedAt,
          score: a.score,
          maxScore: a.maxScore,
          status: a.status
        };
      });

    return {
      title: viewer.role === 'Admin' ? 'Resultados (todos)' : 'Resultados (escopo do time)',
      rows
    };
  }
};

/* Regras de liberação */
export async function canTakeFinalQuiz(user){
  const trail = await getTrailForUser(user);
  const progress = getUserProgress(user.id);
  return percentRequired(trail, progress) >= 100;
}

/* Pendências: final liberado por 100% + periódicos por atribuição/recorrência */
export async function getPendingQuizzesForUser(user){
  const quizzes = await QuizRepo.list();
  const attempts = await QuizRepo.listAttempts();
  const now = new Date();

  // gerar instâncias periódicas (runs) automaticamente
  const runsKey = 'rkive.quizRuns'; // { [userId]: { [quizId]: [{runId, dueAt, createdAt, status}] } }
  const runsAll = storage.get(runsKey, {});
  runsAll[user.id] ||= {};
  const userRuns = runsAll[user.id];

  function ensurePeriodicRuns(quiz){
    if (quiz.kind !== 'periodic') return;
    const intervalDays = quiz.recurrence?.intervalDays ?? 15;
    const dueDays = quiz.recurrence?.dueDays ?? 7;

    userRuns[quiz.id] ||= [];

    // último run criado
    const list = userRuns[quiz.id];
    const last = list[list.length - 1];

    const baseTime = last ? new Date(last.createdAt) : new Date(quiz.createdAt || nowIso());
    const nextTime = new Date(baseTime.getTime() + intervalDays * 24*3600*1000);

    // se já passou do próximo período e não existe run, cria
    if (!last || now >= nextTime) {
      // evitar criar múltiplos de uma vez
      if (!last || (now.getTime() - new Date(last.createdAt).getTime()) >= intervalDays * 24*3600*1000) {
        const createdAt = nowIso();
        const dueAt = new Date(new Date(createdAt).getTime() + dueDays * 24*3600*1000).toISOString();
        list.push({ runId: `${quiz.id}_${Date.now()}`, createdAt, dueAt, status: 'open' });
      }
    }
  }

  // check atribuição
  function isAssigned(quiz){
    if (quiz.kind === 'final') {
      // final por cargo/setor
      const okSector = !quiz.sector || quiz.sector === user.sector;
      const okPos = !quiz.positions?.length || quiz.positions.includes(user.position);
      return okSector && okPos;
    }
    if (quiz.kind === 'periodic') {
      const bySector = !quiz.sector || quiz.sector === user.sector;
      const byPos = !quiz.positions?.length || quiz.positions.includes(user.position);
      const byUser = Array.isArray(quiz.assignedUserIds) && quiz.assignedUserIds.includes(user.id);
      return (bySector && byPos) || byUser;
    }
    return false;
  }

  const pendings = [];

  for (const quiz of quizzes) {
    if (!isAssigned(quiz)) continue;

    if (quiz.kind === 'final') {
      const eligible = await canTakeFinalQuiz(user);
      if (!eligible) continue;

      // pendente se nunca tentou OU (opcional) permitir retentativa
      const tried = attempts.some(a => a.userId === user.id && a.quizId === quiz.id);
      if (!tried) pendings.push({ quizId: quiz.id, runId: null, title: quiz.title, meta: `Mínimo: ${quiz.minScore}/${quiz.questions.length}` });
    }

    if (quiz.kind === 'periodic') {
      ensurePeriodicRuns(quiz);
      const runs = userRuns[quiz.id] || [];

      // pendente se existe run open não entregue e dentro do prazo
      for (const run of runs) {
        if (run.status !== 'open') continue;
        const due = new Date(run.dueAt);
        const expired = now > due;

        // se tentou para este run, fecha
        const attempted = attempts.some(a => a.userId === user.id && a.quizId === quiz.id && a.runId === run.runId);
        if (attempted) {
          run.status = 'done';
          continue;
        }
        if (expired) {
          run.status = 'expired';
          continue;
        }
        pendings.push({ quizId: quiz.id, runId: run.runId, title: quiz.title, meta: `Prazo: ${due.toLocaleDateString('pt-BR')} • Recorrência: ${quiz.recurrence?.intervalDays}d` });
      }
    }
  }

  // persist runs
  runsAll[user.id] = userRuns;
  storage.set(runsKey, runsAll);

  return pendings;
}
