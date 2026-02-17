// Mock de integração externa (assíncrono)
// PONTO DE INTEGRAÇÃO FUTURA (API):
// substituir por fetch('/api/assistant/chat', {method:'POST', body:...})

export async function sendMessageToAssistantMock({ user, message, context }){
  // simula latência
  await new Promise(r => setTimeout(r, 650));

  const base = [
    'Entendi. Posso ajudar com o seu onboarding e dúvidas sobre processos internos.',
    'Se você quiser, posso resumir o próximo conteúdo obrigatório e sugerir uma ordem de estudo.',
    'Posso ajudar a localizar conteúdos na Biblioteca e indicar links úteis.'
  ];

  const hint =
    message.toLowerCase().includes('prova') ? 'Dica: revise os conteúdos obrigatórios antes de iniciar a avaliação.' :
    message.toLowerCase().includes('onboarding') ? 'Posso sugerir quais itens concluir primeiro com base no seu cargo.' :
    'Me diga o que você precisa, em uma frase.';

  return {
    reply: `${base[Math.floor(Math.random()*base.length)]} ${hint}`,
    provider: 'mock',
    at: new Date().toISOString()
  };
}
