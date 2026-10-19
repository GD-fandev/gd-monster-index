export const normalize = text => String(text ?? '').toLocaleLowerCase().replace(/\s+/g, '');
export const localizedName = (record, lang='ko') => {
  const value=record.names[lang] || record.names.ko;
  return (Array.isArray(value)?value[0]:value) || record.id;
};
export const mapName = localizedName;
export function detectLanguage(saved, browserLanguages=[]) {
  if (['ko','ja'].includes(saved)) return saved;
  for (const tag of browserLanguages) {
    const lang=tag.toLowerCase().split('-')[0];
    if (['ko','ja'].includes(lang)) return lang;
  }
  return 'ko';
}
export function admission(map, level) {
  if (!map?.entry) return 'unknown';
  if (!Number.isSafeInteger(level) || level < 1) return 'unset';
  return level >= map.entry.min && (map.entry.max == null || level <= map.entry.max) ? 'eligible' : 'blocked';
}
export function selectMonsters(data, filters) {
  const maps = new Map(data.maps.map(m => [m.id, m]));
  return data.monsters.filter(m => {
    const text = [...Object.values(m.names), ...Object.values(m.aliases || {}).flat()].join(' ');
    return (!filters.search || normalize(text).includes(normalize(filters.search))) &&
      (!filters.region || m.mapIds.includes(filters.region)) &&
      (!filters.attack || m.attackAttributeIds.includes(filters.attack)) &&
      (!filters.weakness || m.weaknessAttributeIds.includes(filters.weakness)) &&
      (!filters.drop || m.dropItemIds.includes(filters.drop)) &&
      (!filters.eligible || (filters.region ? admission(maps.get(filters.region), filters.level) === 'eligible' : m.mapIds.some(id => admission(maps.get(id), filters.level) === 'eligible')));
  });
}
export const minimumHabitat = (monster, maps) => {
  const values = monster.mapIds.map(id => maps.get(id)?.levelRange?.min).filter(Number.isFinite);
  return values.length ? Math.min(...values) : null;
};
export function compareRegions(a,b,sort,lang='ko') {
  const value = m => sort==='entry' ? m.entry?.min : m.levelRange?.min;
  return (sort==='name'?0:(value(a)??Infinity)-(value(b)??Infinity)) ||
    mapName(a,lang).localeCompare(mapName(b,lang),lang,{numeric:true});
}
