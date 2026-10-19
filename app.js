const assetVersion=new URL(import.meta.url).searchParams.get('v')||'current';
const [{normalize, localizedName, admission, selectMonsters, minimumHabitat, detectLanguage, compareRegions},{messages}]=await Promise.all([import(`./model.mjs?v=${assetVersion}`),import(`./i18n.mjs?v=${assetVersion}`)]);
const $ = id => document.getElementById(id);
const esc = text => String(text ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colors={ice:'#67c7ff',fire:'#ff8070',divine:'#f2c94c',neutral:'#f2f2f2',poison:'#c292ed',disease:'#89ce81',petrify:'#b1b8bf'};
let savedLanguage; try {savedLanguage=localStorage.getItem('compendium-language');} catch {}
let lang=detectLanguage(savedLanguage,navigator.languages || [navigator.language]);
let data, maps, catalogs, view='monsters', modalHistory=[], mapZoom=1;
const favorites={monsters:new Set(),regions:new Set()};
try{const saved=JSON.parse(localStorage.getItem('compendium-favorites'));for(const type of Object.keys(favorites)){if(Array.isArray(saved?.[type]))favorites[type]=new Set(saved[type].filter(id=>typeof id==='string'));}}catch{}
function favoriteButton(type,record){const active=favorites[type].has(record.id);return `<button type="button" class="favoriteButton${active?' selected':''}" data-favorite="${type}" data-id="${esc(record.id)}" aria-pressed="${active}" aria-label="${esc(name(record)+' · '+t(active?'removeFavorite':'addFavorite'))}" title="${t(active?'removeFavorite':'addFavorite')}"><span class="favoriteIcon" aria-hidden="true">⭐</span></button>`;}
function toggleFavorite(button){const type=button.dataset.favorite,id=button.dataset.id;const set=favorites[type];if(set.has(id))set.delete(id);else set.add(id);try{localStorage.setItem('compendium-favorites',JSON.stringify(Object.fromEntries(Object.entries(favorites).map(([key,value])=>[key,[...value]]))));}catch{}
  document.querySelectorAll('[data-favorite]').forEach(el=>{if(el.dataset.favorite===type&&el.dataset.id===id){const record=type==='monsters'?data.monsters.find(m=>m.id===id):maps.get(id);const active=set.has(id);el.classList.toggle('selected',active);el.setAttribute('aria-pressed',String(active));el.setAttribute('aria-label',name(record)+' · '+t(active?'removeFavorite':'addFavorite'));el.title=t(active?'removeFavorite':'addFavorite');}});
  if($('favoritesOnly').checked)render();
}
const sortState={monsters:'habitat',regions:'habitat'};
try {
  const savedSort=JSON.parse(localStorage.getItem('compendium-sort'));
  for(const [tab,allowed] of Object.entries({monsters:['name','habitat'],regions:['name','entry','habitat']})) {
    if(allowed.includes(savedSort?.[tab]))sortState[tab]=savedSort[tab];
  }
} catch {}
function saveSort(){try{localStorage.setItem('compendium-sort',JSON.stringify(sortState));}catch{}}
const savedFieldIds=['search','region','attack','weakness','drop','level'];
function savePreferences(){
  const fields=Object.fromEntries(savedFieldIds.map(id=>[id,$(id).value]));
  try{localStorage.setItem('compendium-filters',JSON.stringify({view,fields,favoritesOnly:$('favoritesOnly').checked,eligible:$('eligible').checked}));}catch{}
}
function restorePreferences(){
  try{
    const saved=JSON.parse(localStorage.getItem('compendium-filters'));
    if(!saved || typeof saved!=='object')return;
    if(['monsters','regions'].includes(saved.view))view=saved.view;
    for(const id of savedFieldIds){
      const value=saved.fields?.[id];
      if(typeof value!=='string')continue;
      const control=$(id);
      if(control.tagName==='SELECT' && !Array.from(control.options).some(option=>option.value===value))continue;
      control.value=value;
    }
    $('eligible').checked=saved.eligible===true && level()!==null;
    $('favoritesOnly').checked=saved.favoritesOnly===true;
    populateSort();
  }catch{}
}
function updateFilters(){render();savePreferences();}
const t=key=>messages[lang][key];
const name=record=>localizedName(record,lang);
const byName=(a,b)=>name(a).localeCompare(name(b),lang,{numeric:true});
const option=(value,label)=>`<option value="${esc(value)}">${esc(label)}</option>`;
const row=(label,body)=>`<div class="row"><span>${t(label)}</span><div>${body}</div></div>`;
function level(){const value=$('level').valueAsNumber;return Number.isSafeInteger(value)&&value>=1?value:null;}
function filters(){return {search:$('search').value,region:$('region').value,attack:$('attack').value,weakness:$('weakness').value,drop:$('drop').value,eligible:$('eligible').checked,level:level()};}
function attrs(ids){return ids.length?ids.map(id=>`<span class="attr" style="color:${colors[id]||'#e2cba2'}">${esc(name(catalogs.attributes.get(id)))}</span>`).join(''):`<span class="unknown">${t('unrecorded')}</span>`;}
function names(ids,catalog){return ids.length?ids.map(id=>esc(name(catalogs[catalog].get(id)))).join(' · '):t('unrecorded');}
function magic(m){return m.magicAttackIds.length?names(m.magicAttackIds,'magic_attacks'):m.magicAttack===false?t('unused'):m.magicAttack===true?`${t('used')} · ${t('unrecorded')}`:t('unknown');}
function range(m){return m.levelRange?.min!=null?`Lv ${m.levelRange.min}–${m.levelRange.max ?? '?'}`:t('unrecorded');}
function entry(m){return m.entry?`Lv ${m.entry.min}${m.entry.max==null?t('above'):'–'+m.entry.max}${m.entry.kind==='boarding'?' · '+t('boarding'):''}`:t('unknown');}
function status(m){const a=admission(m,level());const key={eligible:'good',blocked:'bad',unknown:'unknown',unset:'unset'}[a];return `<span class="${key==='unset'?'unknown':key}">${t(key)}</span>`;}
function pk(m){return m.isPKArea?'<span class="pill pk">PK</span>':'';}
function card(m){const min=minimumHabitat(m,maps);return `<div class="cardShell">${favoriteButton('monsters',m)}<button class="card" data-monster="${esc(m.id)}" aria-label="${esc(name(m))}"><div class="portrait"><img src="${esc(m.image)}" alt="" loading="lazy" width="116" height="126"></div><div class="cardBody"><div class="cardTitle"><h3>${esc(name(m))}</h3><span class="minLevel">${t('habitat')} ${min==null?t('unrecorded'):'Lv '+min+'~'}</span></div>${row('attack',attrs(m.attackAttributeIds))}${row('weakness',attrs(m.weaknessAttributeIds))}${row('magic',magic(m))}${row('drops',names(m.dropItemIds,'items'))}<div class="habitatLine">${m.mapIds.length?esc(name(maps.get(m.mapIds[0])))+(m.mapIds.length>1?' '+t('others')+' '+(m.mapIds.length-1)+t('places'):''):t('unrecorded')} <span aria-hidden="true">↗</span></div></div></button></div>`;}
function empty(){return `<div class="empty"><strong>${t('empty')}</strong><button class="reset" data-reset>${t('resetFilters')}</button></div>`;}
function populateSelect(id,options){const value=$(id).value;$(id).innerHTML=options;$(id).value=value;}
function populateSort(){const options=[['name',t('nameSort')],...(view==='regions'?[['entry',t('entrySort')]]:[]),['habitat',t('habitatSort')]];$('sort').innerHTML=options.map(([v,l])=>option(v,l)).join('');$('sort').value=sortState[view];}
function localize(){
  document.documentElement.lang=lang;document.title=t('title');document.querySelector('meta[name=description]').content=t('description');
  document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));
  document.querySelector('nav').setAttribute('aria-label',t('menu'));document.querySelector('.filters').setAttribute('aria-label',t('filters'));
  $('languageCode').textContent=lang==='ja'?'JP':'KR';$('languageFlag').src=lang==='ja'?'flags/jp.svg':'flags/kr.svg';$('close').setAttribute('aria-label',t('close'));$('back').textContent=t('back');$('levelError').textContent=t('invalidLevel');
  if(!data)return;
  populateSelect('region',option('',t('allRegions'))+[...data.maps].sort(byName).map(m=>option(m.id,`${name(m)} · ${t('entry')} ${entry(m)}`)).join(''));
  for(const [id,catalog] of [['attack','attributes'],['weakness','attributes'],['drop','items']])populateSelect(id,option('',t('all'))+data.catalogs[catalog].map(x=>option(x.id,name(x))).join(''));
  populateSort();render();if(modalHistory.length)renderModal();
}
function render(){
  ['monsters','regions'].forEach(v=>{$(v+'Tab').classList.toggle('active',v===view);$(v+'Tab').setAttribute('aria-pressed',String(v===view));});
  const f=filters();$('eligible').disabled=f.level===null;if(f.level===null){$('eligible').checked=false;f.eligible=false;}
  $('levelError').hidden=!($('level').value&&f.level===null);$('level').setAttribute('aria-invalid',String(!$('levelError').hidden));
  document.querySelectorAll('.monsterFilter').forEach(el=>el.hidden=view!=='monsters');
  $('search').placeholder=t(view==='monsters'?'monsterSearch':'regionSearch');
  const selected=maps.get(f.region);$('regionSummary').hidden=!(view==='monsters'&&selected);
  if(selected)$('regionSummary').innerHTML=`<button class="regionName" data-region="${esc(selected.id)}"><h2>${esc(name(selected))}${pk(selected)} ↗</h2></button><div>${t('entry')} <strong>${entry(selected)}</strong> <span class="pill">${t('habitatLevel')} ${range(selected)}</span> <span class="pill">${status(selected)}</span></div>`;
  $('results').className=view==='monsters'?'cards':'regions';
  if(view==='monsters'){
    const list=selectMonsters(data,f).filter(m=>!$('favoritesOnly').checked||favorites.monsters.has(m.id)).sort((a,b)=>(sortState.monsters==='habitat'?(minimumHabitat(a,maps)??Infinity)-(minimumHabitat(b,maps)??Infinity):0)||byName(a,b));
    $('resultTitle').innerHTML=`${selected?esc(name(selected)):t('allMonsters')} <span id="count">${list.length}${t('count')}</span>`;
    $('results').innerHTML=list.length?list.map(card).join(''):empty();
  }else{
    const list=data.maps.filter(m=>(!$('favoritesOnly').checked||favorites.regions.has(m.id))&&(m.levelRange||m.entry)&&(!f.search||normalize(Object.values(m.names).flat().join(' ')).includes(normalize(f.search)))&&(!f.eligible||admission(m,f.level)==='eligible')).sort((a,b)=>compareRegions(a,b,sortState.regions,lang));
    $('resultTitle').innerHTML=`${t('regionTitle')} <span id="count">${list.length}${t('places')}</span>`;
    $('results').innerHTML=list.length?`<table><thead><tr><th class="favoriteColumn"><span class="srOnly">${t('favorites')}</span></th><th>${t('huntingGround')}</th><th>${t('entry')}</th><th>${t('habitatLevel')}</th><th>${t('myStatus')}</th></tr></thead><tbody>${list.map(m=>`<tr><td class="favoriteColumn">${favoriteButton('regions',m)}</td><td><button class="regionName" data-region="${esc(m.id)}">${esc(name(m))}${pk(m)}<small>${t('regionMonsters')} ${data.monsters.filter(x=>x.mapIds.includes(m.id)).length}${t('count')} ↗</small></button></td><td>${entry(m)}</td><td>${range(m)}</td><td>${status(m)}</td></tr>`).join('')}</tbody></table>`:empty();
  }
}
function setView(next){view=next;['monsters','regions'].forEach(v=>{$(v+'Tab').classList.toggle('active',v===view);$(v+'Tab').setAttribute('aria-pressed',String(v===view));});$('search').value='';populateSort();updateFilters();}
function reset(){for(const id of ['search','region','attack','weakness','drop','level'])$(id).value='';$('eligible').checked=false;$('favoritesOnly').checked=false;sortState[view]='habitat';saveSort();populateSort();updateFilters();}
function monsterDetail(m){
  const aliases=m.aliases?.[lang]||[];
  return `<div class="detailHead"><div class="portrait"><img src="${esc(m.image)}" alt="${esc(name(m))}"></div><div><h2 id="detailTitle" tabindex="-1">${esc(name(m))}</h2>${aliases.length?`<p>${t('aliases')} ${esc(aliases.join(' · '))}</p>`:''}</div></div><div class="detailSection">${row('attack',attrs(m.attackAttributeIds))}${row('weakness',attrs(m.weaknessAttributeIds))}${row('magic',magic(m))}${row('drops',names(m.dropItemIds,'items'))}</div><div class="detailSection"><h3>${t('habitats')} <span class="pill">${m.mapIds.length}${t('places')}</span></h3>${m.mapIds.map(id=>{const r=maps.get(id);return `<div class="habitat"><button data-region="${esc(id)}">${esc(name(r))}${pk(r)} ↗<small>${t('habitatLevel')} ${range(r)}</small></button><div>${t('entry')} <strong>${entry(r)}</strong><br>${status(r)}</div></div>`;}).join('')||`<p>${t('unrecorded')}</p>`}</div>${m.notes?.[lang]?`<div class="detailSection"><h3>${t('notes')}</h3><p>${esc(m.notes[lang])}</p></div>`:''}`;
}
function mapPreview(r){const image=r.images?.[lang];return image?`<section class="mapSection"><button class="mapPreview" data-map="${esc(r.id)}" aria-label="${t('enlarge')}"><img src="${esc(image)}" alt="${esc(name(r))} ${t('map')}" loading="lazy"><span>${t('enlarge')} ↗</span></button></section>`:`<p class="notice">${t('noMap')}</p>`;}
function mapDetail(r){return `<h2 id="detailTitle" tabindex="-1">${esc(name(r))} · ${t('map')}</h2><div class="mapTools"><button class="reset" data-zoom="out" aria-label="${t('zoomOut')}">−</button><button class="reset" data-zoom="fit">${t('fit')}</button><button class="reset" data-zoom="in" aria-label="${t('zoomIn')}">＋</button><span id="zoomValue">100%</span></div><div class="mapCanvas"><img id="largeMap" src="${esc(r.images[lang])}" alt="${esc(name(r))} ${t('map')}"></div>`;}
function regionDetail(r){const list=data.monsters.filter(m=>m.mapIds.includes(r.id)).sort(byName);return `<h2 id="detailTitle" tabindex="-1">${esc(name(r))}${pk(r)}</h2><div class="regionStats"><span>${t('entry')} <strong>${entry(r)}</strong></span><span>${t('habitatLevel')} <strong>${range(r)}</strong></span><span>${status(r)}</span></div>${mapPreview(r)}<div class="detailSection"><h3>${t('regionMonsters')} <span class="pill">${list.length}${t('count')}</span></h3><div class="cards">${list.length?list.map(card).join(''):`<p class="empty">${t('emptyRegion')}</p>`}</div></div>`;}
function renderModal(){const current=modalHistory.at(-1);$('detail').classList.toggle('regionDialog',current.type!=='monster');$('detailBody').innerHTML=current.type==='map'?mapDetail(maps.get(current.id)):current.type==='region'?regionDetail(maps.get(current.id)):monsterDetail(data.monsters.find(m=>m.id===current.id));$('back').hidden=modalHistory.length<2;$('detail').scrollTop=0;mapZoom=1;}
function openDetail(type,id){if(!$('detail').open)modalHistory=[];modalHistory.push({type,id});renderModal();if(!$('detail').open)$('detail').showModal();$('detailTitle').focus({preventScroll:true});}
$('back').onclick=()=>{if(modalHistory.length>1){modalHistory.pop();renderModal();$('detailTitle').focus({preventScroll:true});}};
$('close').onclick=()=>$('detail').close();$('detail').addEventListener('close',()=>{modalHistory=[];});
$('detail').addEventListener('click',e=>{if(e.target===$('detail')){const r=$('detail').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('detail').close();}});
document.addEventListener('click',e=>{const choice=e.target.closest('[data-language]');if(choice){lang=choice.dataset.language;try{localStorage.setItem('compendium-language',lang);}catch{}localize();$('languageMenu').open=false;$('languageMenu').querySelector('summary').focus();}else if(!e.target.closest('#languageMenu'))$('languageMenu').open=false;});document.addEventListener('keydown',e=>{if(e.key==='Escape')$('languageMenu').open=false;});
localize();
async function init(){try{const response=await fetch('data.json',{cache:'no-cache'});if(!response.ok)throw Error('HTTP '+response.status);data=await response.json();maps=new Map(data.maps.map(m=>[m.id,m]));catalogs=Object.fromEntries(Object.entries(data.catalogs).map(([k,v])=>[k,new Map(v.map(x=>[x.id,x]))]));$('total').textContent=data.monsters.length;
  for(const id of ['search','region','attack','weakness','drop','level','eligible','favoritesOnly'])$(id).addEventListener('input',updateFilters);
  $('sort').onchange=()=>{sortState[view]=$('sort').value;saveSort();render();};
  $('monstersTab').onclick=()=>setView('monsters');$('regionsTab').onclick=()=>setView('regions');$('reset').onclick=reset;
  document.addEventListener('click',e=>{const favorite=e.target.closest('[data-favorite]');if(favorite){toggleFavorite(favorite);return;}const m=e.target.closest('[data-monster]');if(m)openDetail('monster',m.dataset.monster);const r=e.target.closest('[data-region]');if(r)openDetail('region',r.dataset.region);const map=e.target.closest('[data-map]');if(map)openDetail('map',map.dataset.map);const zoom=e.target.closest('[data-zoom]');if(zoom&&$('largeMap')){mapZoom=zoom.dataset.zoom==='fit'?1:Math.max(1,Math.min(4,mapZoom+(zoom.dataset.zoom==='in'?.5:-.5)));$('largeMap').style.width=`${mapZoom*100}%`;$('zoomValue').textContent=`${mapZoom*100}%`;}if(e.target.closest('[data-reset]'))reset();});
  localize();restorePreferences();render();
 }catch(error){$('results').innerHTML=`<div class="empty"><strong>${t('loadError')}</strong><button class="reset" id="retry">${t('retry')}</button></div>`;$('retry').onclick=()=>location.reload();console.error(error);}}
init();
