import { storage, h, nowIso, formatDateTime, toast } from './utils.js';
import { sendMessageToAssistantMock } from './assistantProvider.js';

const KEY = 'rkive.assistant'; // { [userId]: [ {role, text, at} ] }

function getHistory(userId){
  const all = storage.get(KEY, {});
  return all[userId] || [];
}
function saveHistory(userId, history){
  const all = storage.get(KEY, {});
  all[userId] = history;
  storage.set(KEY, all);
}

export function mountAssistantPanel(user){
  const wrap = h('div', {}, []);
  const chat = h('div', { class: 'chat' }, []);
  const log = h('div', { class: 'chat-log', id: 'chat-log' }, []);
  const form = h('form', { class: 'chat-form', autocomplete: 'off' }, []);
  const input = h('input', { type: 'text', placeholder: 'Escreva sua mensagem...', 'aria-label': 'Mensagem para o assistente' });
  const send = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Enviar');
  const clear = h('button', { class: 'btn btn-ghost', type: 'button' }, 'Limpar histórico');

  form.appendChild(input);
  form.appendChild(send);
  form.appendChild(clear);

  chat.appendChild(log);
  chat.appendChild(form);
  wrap.appendChild(chat);

  function render(){
    log.innerHTML = '';
    const history = getHistory(user.id);
    if (!history.length) {
      log.appendChild(h('div', { class: 'muted' }, 'Sem mensagens ainda. Faça uma pergunta.'))
    } else {
      history.forEach(m => {
        log.appendChild(
          h('div', { class: `msg ${m.role === 'me' ? 'me' : 'bot'}` }, [
            h('div', {}, m.text),
            h('div', { class: 'meta' }, formatDateTime(m.at))
          ])
        );
      });
    }
    log.scrollTop = log.scrollHeight;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';

    const history = getHistory(user.id);
    history.push({ role: 'me', text, at: nowIso() });
    saveHistory(user.id, history);
    render();

    // indicador "digitando..."
    const typingAt = nowIso();
    history.push({ role: 'bot', text: 'Digitando...', at: typingAt, typing: true });
    saveHistory(user.id, history);
    render();

    try{
      const res = await sendMessageToAssistantMock({ user, message: text, context: {} });
      const fresh = getHistory(user.id).filter(m => !m.typing);
      fresh.push({ role:'bot', text: res.reply, at: res.at });
      saveHistory(user.id, fresh);
      render();
    } catch {
      toast('Falha ao contatar o assistente.', 'error');
      const fresh = getHistory(user.id).filter(m => !m.typing);
      saveHistory(user.id, fresh);
      render();
    }
  });

  clear.addEventListener('click', () => {
    const ok = confirm('Limpar o histórico do assistente?');
    if (!ok) return;
    saveHistory(user.id, []);
    toast('Histórico limpo.', 'success');
    render();
  });

  render();
  return wrap;
}
