import { h, qs, toast, uid, nowIso, toCsv, downloadTextFile } from './utils.js';
import { getUsers, saveUsers } from './auth.js';
import { ContentRepo } from './content.js';
import { QuizRepo } from './quizzes.js';

const ALL_PERMISSIONS = [
  'dashboard.view',
  'onboarding.view',
  'library.view',
  'links.view',
  'institutional.view',
  'quizzes.view',
  'quizzes.take',
  'quizzes.create',
  'quizzes.results.view',
  'admin.users.manage',
  'admin.contents.manage',
  'admin.quizzes.manage',
  'analytics.view'
];

export function mountAdminApp(root, adminUser){
  const state = { section: (location.hash || '#users').replace('#','') };

  const drawer = createDrawer();
  const backdrop = ensureBackdrop();

  function openDrawer(title, bodyEl, onSave){
    drawer.setTitle(title);
    drawer.setBody(bodyEl);
    drawer.setOnSave(onSave);
    drawer.open();
    backdrop.hidden = false;
  }

  function closeDrawer(){
    drawer.close();
    backdrop.hidden = true;
  }

  backdrop.addEventListener('click', closeDrawer);

  function setSection(id){
    state.section = id;
    location.hash = `#${id}`;
    render();
  }

  function renderTabs(){
    const tabs = [
      { id:'users', label:'Gestão de usuários' },
      { id:'contents', label:'Gestão de conteúdos' },
      { id:'quizzes', label:'Avaliações e provas' },
      { id:'analytics', label:'Acompanhamento' }
    ];
    return h('div', { class:'card' }, [
      h('div', { class:'chips' }, tabs.map(t =>
        h('button', {
          class:`chip ${state.section === t.id ? 'active' : ''}`,
          type:'button',
          onclick: () => setSection(t.id)
        }, t.label)
      ))
    ]);
  }

  async function renderUsers(){
    const users = getUsers();

    const table = h('div', { class:'card' }, [
      h('div', { class:'row-between' }, [
        h('div', {}, [
          h('h2', {}, 'Gestão de Usuários'),
          h('p', { class:'muted' }, 'Criar, editar, desativar, definir unidade/setor/cargo e permissões por usuário.')
        ]),
        h('button', { class:'btn btn-primary', type:'button', onclick: () => openUserCreate() }, 'Novo usuário')
      ]),
      h('div', { class:'table-wrap' }, [
        h('table', { class:'table' }, [
          h('thead', {}, [h('tr', {}, [
            h('th', {}, 'Nome'),
            h('th', {}, 'E-mail'),
            h('th', {}, 'Perfil'),
            h('th', {}, 'Unidade/Setor/Cargo'),
            h('th', {}, 'Ativo'),
            h('th', {}, 'Ações')
          ])]),
          h('tbody', {}, users.map(u => h('tr', {}, [
            h('td', {}, u.name),
            h('td', {}, u.email),
            h('td', {}, u.role),
            h('td', {}, `${u.unit || '-'} / ${u.sector || '-'} / ${u.position || '-'}`),
            h('td', {}, u.active === false ? 'Não' : 'Sim'),
            h('td', {}, [
              h('button', { class:'btn btn-secondary', type:'button', onclick: () => openUserEdit(u) }, 'Editar'),
              h('button', { class:'btn btn-ghost', type:'button', onclick: () => resetPassword(u) }, 'Reset senha')
            ])
          ])))
        ])
      ])
    ]);

    return table;

    function openUserCreate(){
      const body = userFormBody({
        name:'', email:'', role:'Colaborador', active:true,
        unit:'rKive', sector:'', position:'',
        permissionsOverride:{ allow:[], deny:[] },
        teamScope:{ sector:'', position:'', userIds:[] }
      });

      openDrawer('Criar usuário', body, () => {
        const data = readUserForm(body);
        if (!data.name || !data.email) { toast('Nome e e-mail são obrigatórios.', 'warning'); return false; }
        const next = getUsers();
        if (next.some(x => x.email.toLowerCase() === data.email.toLowerCase())) { toast('E-mail já existe.', 'error'); return false; }

        next.push({
          id: uid('user'),
          ...data,
          passwordMock: 'rkive123',
          createdAt: nowIso(),
          updatedAt: nowIso()
        });
        saveUsers(next);
        toast('Usuário criado (senha: rkive123).', 'success');
        closeDrawer();
        render();
        return true;
      });
    }

    function openUserEdit(u){
      const body = userFormBody(u);
      openDrawer('Editar usuário', body, () => {
        const data = readUserForm(body);
        const next = getUsers();
        const idx = next.findIndex(x => x.id === u.id);
        next[idx] = { ...next[idx], ...data, updatedAt: nowIso() };
        saveUsers(next);
        toast('Usuário atualizado.', 'success');
        closeDrawer();
        render();
        return true;
      });
    }

    function resetPassword(u){
      const ok = confirm(`Resetar senha de ${u.name}? (simulado)`);
      if (!ok) return;
      const users = getUsers();
      const idx = users.findIndex(x => x.id === u.id);
      users[idx].passwordMock = 'rkive123';
      users[idx].updatedAt = nowIso();
      saveUsers(users);
      toast('Senha redefinida para rkive123.', 'success');
      render();
    }
  }

  async function renderContents(){
    const all = await ContentRepo.list();

    const view = h('div', { class:'card' }, [
      h('div', { class:'row-between' }, [
        h('div', {}, [
          h('h2', {}, 'Gestão de Conteúdos'),
          h('p', { class:'muted' }, 'CRUD completo, organização por trilhas, atribuição por cargo/setor/unidade e pré-visualização.')
        ]),
        h('button', { class:'btn btn-primary', type:'button', onclick: () => openContentCreate() }, 'Novo conteúdo')
      ]),
      h('div', { class:'table-wrap' }, [
        h('table', { class:'table' }, [
          h('thead', {}, [h('tr', {}, [
            h('th', {}, 'Título'),
            h('th', {}, 'Tipo'),
            h('th', {}, 'Setor'),
            h('th', {}, 'Cargos'),
            h('th', {}, 'Obrigatório'),
            h('th', {}, 'Ordem'),
            h('th', {}, 'Ações')
          ])]),
          h('tbody', {}, all.map(c => h('tr', {}, [
            h('td', {}, c.title),
            h('td', {}, c.type),
            h('td', {}, c.sector || 'Todos'),
            h('td', {}, (c.positions?.length ? c.positions.join(', ') : 'Todos')),
            h('td', {}, c.required ? 'Sim' : 'Não'),
            h('td', {}, String(c.order ?? '-')),
            h('td', {}, [
              h('button', { class:'btn btn-secondary', type:'button', onclick: () => openContentEdit(c) }, 'Editar'),
              h('button', { class:'btn btn-danger', type:'button', onclick: () => removeContent(c) }, 'Excluir')
            ])
          ])))
        ])
      ])
    ]);

    return view;

    function contentFormBody(c){
      const positions = Array.isArray(c.positions) ? c.positions.join(' | ') : '';
      const tags = Array.isArray(c.tags) ? c.tags.join(', ') : '';
      const el = h('div', { class:'stack' }, [
        field('Título', 'title', c.title || ''),
        field('Descrição', 'description', c.description || '', 'textarea'),
        fieldSelect('Tipo', 'type', c.type || 'Videoaula', ['Videoaula','Documento','Link externo','Curso interno','Apresentação','Post institucional']),
        field('URL (link)', 'url', c.url || ''),
        field('Embed URL (video)', 'embedUrl', c.embedUrl || ''),
        fieldSelect('Unidade', 'unit', c.unit || 'rKive', ['rKive']),
        fieldSelect('Setor', 'sector', c.sector || 'Todos', ['Todos','Cadastro','CS','Comercial']),
        field('Cargos vinculados (separe por " | ")', 'positions', positions),
        fieldSelect('Obrigatório', 'required', String(Boolean(c.required)), ['false','true']),
        field('Ordem na trilha', 'order', String(c.order ?? ''), 'number'),
        field('Tempo estimado', 'estimatedTime', c.estimatedTime || '10 min'),
        field('Tags (separar por vírgula)', 'tags', tags),
        field('Data atualização (YYYY-MM-DD)', 'updatedAt', c.updatedAt || nowIso().slice(0,10)),
        field('Responsável', 'owner', c.owner || 'RH rKive')
      ]);
      return el;
    }

    function readContentForm(body){
      const get = (name) => body.querySelector(`[name="${name}"]`)?.value ?? '';
      const positions = get('positions').split('|').map(s => s.trim()).filter(Boolean);
      const tags = get('tags').split(',').map(s => s.trim()).filter(Boolean);
      return {
        title: get('title').trim(),
        description: get('description').trim(),
        type: get('type'),
        url: get('url').trim(),
        embedUrl: get('embedUrl').trim(),
        unit: 'rKive',
        sector: get('sector'),
        positions,
        required: get('required') === 'true',
        order: get('order') ? Number(get('order')) : null,
        estimatedTime: get('estimatedTime').trim(),
        tags,
        updatedAt: get('updatedAt').trim(),
        owner: get('owner').trim(),
      };
    }

    function openContentCreate(){
      const body = contentFormBody({ unit:'rKive', sector:'Todos', required:false, order: 999, updatedAt: nowIso().slice(0,10) });
      openDrawer('Criar conteúdo', body, async () => {
        const data = readContentForm(body);
        if (!data.title || !data.type) { toast('Título e tipo são obrigatórios.', 'warning'); return false; }
        const next = await ContentRepo.list();
        next.push({ id: uid('cnt'), ...data });
        await ContentRepo.saveAll(next);
        toast('Conteúdo criado.', 'success');
        closeDrawer(); render();
        return true;
      });
    }

    function openContentEdit(c){
      const body = contentFormBody(c);
      openDrawer('Editar conteúdo', body, async () => {
        const data = readContentForm(body);
        const next = await ContentRepo.list();
        const idx = next.findIndex(x => x.id === c.id);
        next[idx] = { ...next[idx], ...data, id: c.id };
        await ContentRepo.saveAll(next);
        toast('Conteúdo atualizado.', 'success');
        closeDrawer(); render();
        return true;
      });
    }

    async function removeContent(c){
      const ok = confirm(`Excluir "${c.title}"?`);
      if (!ok) return;
      const next = (await ContentRepo.list()).filter(x => x.id !== c.id);
      await ContentRepo.saveAll(next);
      toast('Conteúdo removido.', 'success');
      render();
    }
  }

  async function renderQuizzes(){
    const quizzes = await QuizRepo.list();

    const view = h('div', { class:'card' }, [
      h('div', { class:'row-between' }, [
        h('div', {}, [
          h('h2', {}, 'Avaliações e Provas'),
          h('p', { class:'muted' }, 'Criar questionário final por trilha e provas periódicas por cargo/setor e por usuário, com nota mínima, recorrência e prazo.')
        ]),
        h('button', { class:'btn btn-primary', type:'button', onclick: () => openQuizCreate() }, 'Nova avaliação')
      ]),
      h('div', { class:'table-wrap' }, [
        h('table', { class:'table' }, [
          h('thead', {}, [h('tr', {}, [
            h('th', {}, 'Título'),
            h('th', {}, 'Tipo'),
            h('th', {}, 'Setor'),
            h('th', {}, 'Cargos'),
            h('th', {}, 'Min'),
            h('th', {}, 'Recorrência/Prazo'),
            h('th', {}, 'Ações')
          ])]),
          h('tbody', {}, quizzes.map(q => h('tr', {}, [
            h('td', {}, q.title),
            h('td', {}, q.kind === 'final' ? 'Final' : 'Periódica'),
            h('td', {}, q.sector || 'Todos'),
            h('td', {}, q.positions?.length ? q.positions.join(', ') : 'Todos'),
            h('td', {}, `${q.minScore}/${q.questions.length}`),
            h('td', {}, q.kind === 'periodic'
              ? `${q.recurrence?.intervalDays}d / ${q.recurrence?.dueDays}d`
              : '-'
            ),
            h('td', {}, [
              h('button', { class:'btn btn-secondary', type:'button', onclick: () => openQuizEdit(q) }, 'Editar'),
              h('button', { class:'btn btn-danger', type:'button', onclick: () => removeQuiz(q) }, 'Excluir')
            ])
          ])))
        ])
      ])
    ]);

    return view;

    function quizFormBody(q){
      const positions = Array.isArray(q.positions) ? q.positions.join(' | ') : '';
      const assigned = Array.isArray(q.assignedUserIds) ? q.assignedUserIds.join(' | ') : '';
      const questions = (q.questions || []).map(qq => `${qq.prompt}||${qq.options.join(';;')}||${qq.correctIndex}`).join('\n');

      const el = h('div', { class:'stack' }, [
        field('Título', 'title', q.title || ''),
        field('Descrição', 'description', q.description || '', 'textarea'),
        fieldSelect('Tipo (kind)', 'kind', q.kind || 'final', ['final','periodic']),
        fieldSelect('Setor', 'sector', q.sector || 'Todos', ['Todos','Cadastro','CS','Comercial']),
        field('Cargos (separe por " | ")', 'positions', positions),
        field('Min score (número)', 'minScore', String(q.minScore ?? 1), 'number'),
        field('Recorrência intervalDays (periódica)', 'intervalDays', String(q.recurrence?.intervalDays ?? 15), 'number'),
        field('Prazo dueDays (periódica)', 'dueDays', String(q.recurrence?.dueDays ?? 7), 'number'),
        field('Atribuir a usuários (IDs, separe por " | ")', 'assignedUserIds', assigned),
        h('div', { class:'field' }, [
          h('label', { for:'questions' }, 'Questões (1 por linha): prompt||opt1;;opt2;;opt3||correctIndex'),
          h('textarea', { id:'questions', name:'questions', rows:'10' }, questions)
        ])
      ]);
      return el;
    }

    function readQuizForm(body){
      const get = (name) => body.querySelector(`[name="${name}"]`)?.value ?? '';
      const positions = get('positions').split('|').map(s => s.trim()).filter(Boolean);
      const assignedUserIds = get('assignedUserIds').split('|').map(s => s.trim()).filter(Boolean);

      const qLines = get('questions').split('\n').map(l => l.trim()).filter(Boolean);
      const questions = qLines.map((line, idx) => {
        const [prompt, opts, correct] = line.split('||');
        const options = (opts || '').split(';;').map(s => s.trim()).filter(Boolean);
        return { id: `q${idx+1}`, prompt: (prompt||'').trim(), options, correctIndex: Number(correct ?? 0) };
      }).filter(q => q.prompt && q.options.length >= 2);

      const kind = get('kind');
      const sector = get('sector') === 'Todos' ? null : get('sector');

      const quiz = {
        title: get('title').trim(),
        description: get('description').trim(),
        kind,
        sector,
        positions,
        minScore: Number(get('minScore') || 1),
        questions,
        createdAt: nowIso(),
      };

      if (kind === 'periodic'){
        quiz.recurrence = {
          intervalDays: Number(get('intervalDays') || 15),
          dueDays: Number(get('dueDays') || 7),
        };
        quiz.assignedUserIds = assignedUserIds;
      }

      return quiz;
    }

    function openQuizCreate(){
      const body = quizFormBody({ kind:'final', minScore: 2, questions: [] });
      openDrawer('Criar avaliação', body, async () => {
        const data = readQuizForm(body);
        if (!data.title || !data.questions.length) { toast('Título e pelo menos 1 questão são obrigatórios.', 'warning'); return false; }
        const next = await QuizRepo.list();
        next.push({ id: uid('quiz'), ...data });
        await QuizRepo.saveAll(next);
        toast('Avaliação criada.', 'success');
        closeDrawer(); render();
        return true;
      });
    }

    function openQuizEdit(q){
      const body = quizFormBody(q);
      openDrawer('Editar avaliação', body, async () => {
        const data = readQuizForm(body);
        if (!data.title || !data.questions.length) { toast('Título e questões são obrigatórios.', 'warning'); return false; }
        const next = await QuizRepo.list();
        const idx = next.findIndex(x => x.id === q.id);
        next[idx] = { ...next[idx], ...data, id: q.id };
        await QuizRepo.saveAll(next);
        toast('Avaliação atualizada.', 'success');
        closeDrawer(); render();
        return true;
      });
    }

    async function removeQuiz(q){
      const ok = confirm(`Excluir "${q.title}"?`);
      if (!ok) return;
      const next = (await QuizRepo.list()).filter(x => x.id !== q.id);
      await QuizRepo.saveAll(next);
      toast('Avaliação removida.', 'success');
      render();
    }
  }

  async function renderAnalytics(){
    const users = getUsers().filter(u => u.active !== false);
    const progressAll = JSON.parse(localStorage.getItem('rkive.progress') || '{}');
    const attempts = await QuizRepo.listAttempts();

    const rows = users.map(u => {
      const p = progressAll[u.id]?.completed || {};
      const completedCount = Object.keys(p).length;
      const userAttempts = attempts.filter(a => a.userId === u.id);
      const last = userAttempts.slice().sort((a,b) => new Date(b.finishedAt)-new Date(a.finishedAt))[0];
      const avg = userAttempts.length ? (userAttempts.reduce((s,a)=>s + (a.score/a.maxScore),0)/userAttempts.length) : 0;
      return {
        name: u.name,
        email: u.email,
        role: u.role,
        sector: u.sector || '',
        position: u.position || '',
        completedCount,
        attempts: userAttempts.length,
        avgScore: `${Math.round(avg*100)}%`,
        lastAttempt: last?.finishedAt || ''
      };
    });

    const view = h('div', { class:'card' }, [
      h('div', { class:'row-between' }, [
        h('div', {}, [
          h('h2', {}, 'Acompanhamento e evolução'),
          h('p', { class:'muted' }, 'Progresso por usuário, tentativas e histórico. Exportação simples em CSV.')
        ]),
        h('button', { class:'btn btn-secondary', type:'button', onclick: () => exportCsv() }, 'Exportar CSV')
      ]),
      h('div', { class:'table-wrap' }, [
        h('table', { class:'table' }, [
          h('thead', {}, [h('tr', {}, [
            h('th', {}, 'Usuário'),
            h('th', {}, 'Setor/Cargo'),
            h('th', {}, 'Concluídos'),
            h('th', {}, 'Tentativas'),
            h('th', {}, 'Média'),
            h('th', {}, 'Última tentativa')
          ])]),
          h('tbody', {}, rows.map(r => h('tr', {}, [
            h('td', {}, [
              h('div', { style:'font-weight:600' }, r.name),
              h('div', { class:'muted small' }, r.email)
            ]),
            h('td', {}, `${r.sector} / ${r.position}`),
            h('td', {}, String(r.completedCount)),
            h('td', {}, String(r.attempts)),
            h('td', {}, r.avgScore),
            h('td', {}, r.lastAttempt ? new Date(r.lastAttempt).toLocaleString('pt-BR') : '-')
          ])))
        ])
      ])
    ]);

    function exportCsv(){
      const headers = ['name','email','role','sector','position','completedCount','attempts','avgScore','lastAttempt'];
      const csv = toCsv(rows, headers);
      downloadTextFile(`rkive_analytics_${new Date().toISOString().slice(0,10)}.csv`, csv);
      toast('CSV gerado.', 'success');
    }

    return view;
  }

  function field(label, name, value='', type='text'){
    const id = `f_${name}`;
    if (type === 'textarea'){
      return h('div', { class:'field' }, [
        h('label', { for:id }, label),
        h('textarea', { id, name, rows:'4' }, value)
      ]);
    }
    return h('div', { class:'field' }, [
      h('label', { for:id }, label),
      h('input', { id, name, type, value })
    ]);
  }

  function fieldSelect(label, name, value, options){
    const id = `f_${name}`;
    return h('div', { class:'field' }, [
      h('label', { for:id }, label),
      h('select', { id, name }, options.map(o =>
        h('option', { value: o, selected: String(o) === String(value) ? 'true' : null }, o)
      ))
    ]);
  }

  function userFormBody(u){
    const allow = (u.permissionsOverride?.allow || []).slice();
    const deny = (u.permissionsOverride?.deny || []).slice();
    const teamUserIds = (u.teamScope?.userIds || []).join(' | ');

    const el = h('div', { class:'stack' }, [
      field('Nome', 'name', u.name || ''),
      field('E-mail', 'email', u.email || ''),
      fieldSelect('Perfil (role)', 'role', u.role || 'Colaborador', ['Admin','Supervisor','Colaborador']),
      fieldSelect('Ativo', 'active', String(u.active !== false), ['true','false']),
      fieldSelect('Unidade', 'unit', u.unit || 'rKive', ['rKive']),
      fieldSelect('Setor', 'sector', u.sector || '', ['','Cadastro','CS','Comercial']),
      fieldSelect('Cargo', 'position', u.position || '', ['','Auxiliar de Cadastro','Analista de CS']),
      h('div', { class:'callout' }, [
        h('strong', {}, 'Permissões por usuário (overrides)'),
        h('p', { class:'muted small' }, 'Marque Allow para liberar explicitamente; Deny para bloquear mesmo que o papel permita.')
      ]),
      h('div', { class:'grid grid-2' },
        ALL_PERMISSIONS.map(p => {
          const allowId = `allow_${p}`;
          const denyId = `deny_${p}`;
          return h('div', { class:'list-item' }, [
            h('div', {}, [
              h('div', { style:'font-weight:600' }, p),
              h('div', { class:'muted small' }, 'Feature-based access')
            ]),
            h('div', { style:'display:flex;gap:10px;align-items:center' }, [
              h('label', { for: allowId, class:'muted small' }, 'Allow'),
              h('input', { id: allowId, type:'checkbox', name:'allow', value: p, checked: allow.includes(p) ? 'true' : null }),
              h('label', { for: denyId, class:'muted small' }, 'Deny'),
              h('input', { id: denyId, type:'checkbox', name:'deny', value: p, checked: deny.includes(p) ? 'true' : null }),
            ])
          ]);
        })
      ),
      h('div', { class:'callout' }, [
        h('strong', {}, 'Escopo do time (Supervisor)'),
        h('p', { class:'muted small' }, 'Defina setor/cargo e/ou IDs de usuários para limitar resultados do time.')
      ]),
      fieldSelect('Team scope: setor', 'teamScopeSector', u.teamScope?.sector || '', ['','Cadastro','CS','Comercial']),
      fieldSelect('Team scope: cargo', 'teamScopePosition', u.teamScope?.position || '', ['','Auxiliar de Cadastro','Analista de CS']),
      field('Team scope: userIds (separe por " | ")', 'teamScopeUserIds', teamUserIds),
    ]);

    return el;
  }

  function readUserForm(body){
    const get = (name) => body.querySelector(`[name="${name}"]`)?.value ?? '';
    const allow = Array.from(body.querySelectorAll('input[name="allow"]:checked')).map(i => i.value);
    const deny = Array.from(body.querySelectorAll('input[name="deny"]:checked')).map(i => i.value);
    const teamScopeUserIds = get('teamScopeUserIds').split('|').map(s => s.trim()).filter(Boolean);

    return {
      name: get('name').trim(),
      email: get('email').trim(),
      role: get('role'),
      active: get('active') === 'true',
      unit: 'rKive',
      sector: get('sector') || null,
      position: get('position') || null,
      permissionsOverride: { allow, deny },
      teamScope: {
        sector: get('teamScopeSector') || null,
        position: get('teamScopePosition') || null,
        userIds: teamScopeUserIds
      }
    };
  }

  function createDrawer(){
    const el = document.createElement('div');
    el.className = 'drawer';
    el.innerHTML = `
      <div class="drawer-head">
        <div>
          <div class="badge badge-soft" id="drawer-kicker">Editor</div>
          <h3 id="drawer-title" style="margin:6px 0 0">Título</h3>
          <div class="muted small">Painel lateral (drawer)</div>
        </div>
        <button class="icon-btn" aria-label="Fechar">×</button>
      </div>
      <div class="drawer-body" id="drawer-body"></div>
      <div class="drawer-foot">
        <button class="btn btn-ghost" type="button" id="drawer-cancel">Cancelar</button>
        <button class="btn btn-primary" type="button" id="drawer-save">Salvar</button>
      </div>
    `;
    document.body.appendChild(el);

    const titleEl = el.querySelector('#drawer-title');
    const bodyEl = el.querySelector('#drawer-body');
    const closeBtn = el.querySelector('.icon-btn');
    const cancelBtn = el.querySelector('#drawer-cancel');
    const saveBtn = el.querySelector('#drawer-save');

    let onSave = null;

    closeBtn.addEventListener('click', () => closeDrawer());
    cancelBtn.addEventListener('click', () => closeDrawer());
    saveBtn.addEventListener('click', async () => {
      try{
        const ok = await onSave?.();
        if (ok === false) return;
      } catch (e) {
        toast(e?.message || 'Falha ao salvar.', 'error');
      }
    });

    return {
      open(){ el.classList.add('open'); },
      close(){ el.classList.remove('open'); },
      setTitle(t){ titleEl.textContent = t; },
      setBody(node){ bodyEl.innerHTML=''; bodyEl.appendChild(node); },
      setOnSave(fn){ onSave = fn; }
    };
  }

  function ensureBackdrop(){
    let b = document.querySelector('.backdrop');
    if (!b) {
      b = document.createElement('div');
      b.className = 'backdrop';
      b.hidden = true;
      document.body.appendChild(b);
    }
    return b;
  }

  async function render(){
    root.innerHTML = '';
    root.appendChild(renderTabs());

    const section = (location.hash || '#users').replace('#','');
    state.section = section;

    let view = null;
    if (section === 'users') view = await renderUsers();
    else if (section === 'contents') view = await renderContents();
    else if (section === 'quizzes') view = await renderQuizzes();
    else if (section === 'analytics') view = await renderAnalytics();
    else view = await renderUsers();

    root.appendChild(view);
    root.focus();
  }

  window.addEventListener('hashchange', render);
  render();
}
