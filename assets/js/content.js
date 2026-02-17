import { storage } from './utils.js';

const KEY = 'rkive.contents';

export const ContentRepo = {
  async list(){
    return storage.get(KEY, []);
  },
  async getById(id){
    const all = await this.list();
    return all.find(c => c.id === id) || null;
  },
  async saveAll(contents){
    // PONTO DE INTEGRAÇÃO FUTURA (API):
    // PUT /api/contents
    storage.set(KEY, contents);
  },
  isVisibleToUser(content, user){
    if (!content) return false;
    if (content.unit && content.unit !== 'rKive') return false;

    const sectorOk = !content.sector || content.sector === 'Todos' || content.sector === user.sector;
    const roleOk = !Array.isArray(content.positions) || content.positions.length === 0 || content.positions.includes(user.position);
    return sectorOk && roleOk;
  }
};

export async function getTrailForUser(user){
  const all = await ContentRepo.list();
  const items = all
    .filter(c => ContentRepo.isVisibleToUser(c, user))
    .sort((a,b) => (a.order ?? 9999) - (b.order ?? 9999));

  const requiredItems = items.filter(i => i.required);

  return {
    items,
    requiredItems,
    requiredCount: requiredItems.length
  };
}
