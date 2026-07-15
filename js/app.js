pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ── STORAGE (localStorage) ──
const Store={
  get(k,fb=null){try{const v=JSON.parse(localStorage.getItem(k)??'null');return v===null?fb:v}catch{return fb}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}
};

// ── IndexedDB (persistir handle da pasta entre sessões) ──
const IDB={
  db:null,
  open(){return new Promise(res=>{
    const rq=indexedDB.open('pdf_renamer',1);
    rq.onupgradeneeded=()=>rq.result.createObjectStore('kv');
    rq.onsuccess=()=>{IDB.db=rq.result;res(true)};
    rq.onerror=()=>res(false);
  })},
  get(k){return new Promise(res=>{
    if(!IDB.db)return res(null);
    const tx=IDB.db.transaction('kv','readonly').objectStore('kv').get(k);
    tx.onsuccess=()=>res(tx.result??null);tx.onerror=()=>res(null);
  })},
  set(k,v){return new Promise(res=>{
    if(!IDB.db)return res(false);
    const tx=IDB.db.transaction('kv','readwrite').objectStore('kv').put(v,k);
    tx.onsuccess=()=>res(true);tx.onerror=()=>res(false);
  })},
  del(k){return new Promise(res=>{
    if(!IDB.db)return res(false);
    const tx=IDB.db.transaction('kv','readwrite').objectStore('kv').delete(k);
    tx.onsuccess=()=>res(true);tx.onerror=()=>res(false);
  })}
};

// ── TIPOS DE DOCUMENTO (chips) ──
// Cada tipo: n=nome, year=inclui ano por padrão
const PRESET_TYPES=[
  {n:'FORMULARIO DE MATRICULA',year:true},
  {n:'DECLARACAO DE ESCOLARIDADE',year:false},
  {n:'FICHA MEDICA ESCOLAR',year:true},
  {n:'CAPA FINANCEIRO',year:true},
  {n:'CONTRATO EDUCACIONAL',year:true},
  {n:'DOCUMENTOS',year:false},
];

// migração: v1 guardava array de strings em 'pdf_chips'
let customChips=(()=>{
  const v2=Store.get('pdf_chips_v2');
  if(v2)return v2;
  const v1=Store.get('pdf_chips',[]);
  const mig=Array.isArray(v1)?v1.map(n=>typeof n==='string'?{n,year:false}:n):[];
  Store.set('pdf_chips_v2',mig);
  return mig;
})();

function allTypes(){return [...PRESET_TYPES.map(t=>({...t,custom:false})),...customChips.map(t=>({...t,custom:true}))]}

// ── CLASSIFICADOR AUTOMÁTICO ──
// Palavras-chave pesadas por tipo. Texto é normalizado (sem acento, maiúsculo).
const CLASSIFY_RULES=[
  {type:'FORMULARIO DE MATRICULA',kw:[
    ['FORMULARIO DE MATRICULA',10],['FICHA DE MATRICULA',9],['REQUERIMENTO DE MATRICULA',9],
    ['SOLICITACAO DE MATRICULA',8],['RENOVACAO DE MATRICULA',8],['SERIE PRETENDIDA',5],
    ['ANO LETIVO',3],['MATRICULA',3],['TURNO',1]
  ]},
  {type:'DECLARACAO DE ESCOLARIDADE',kw:[
    ['DECLARACAO DE ESCOLARIDADE',12],['DECLARACAO DE TRANSFERENCIA',8],
    ['DECLARAMOS PARA OS DEVIDOS FINS',7],['ESTA REGULARMENTE MATRICULADO',6],
    ['ESTA MATRICULADO',5],['DECLARACAO',4],['DECLARAMOS',3]
  ]},
  {type:'FICHA MEDICA ESCOLAR',kw:[
    ['FICHA MEDICA',11],['FICHA DE SAUDE',10],['TIPO SANGUINEO',6],['PLANO DE SAUDE',5],
    ['ALERGIA',4],['ALERGICO',4],['MEDICAMENTO',3],['VACINACAO',3],['CONVENIO MEDICO',4],['PEDIATRA',3]
  ]},
  {type:'CAPA FINANCEIRO',kw:[
    ['CAPA FINANCEIRO',12],['RESPONSAVEL FINANCEIRO',7],['ANUIDADE',5],
    ['MENSALIDADE',4],['PARCELA',2],['VENCIMENTO',2],['BOLETO',3]
  ]},
  {type:'CONTRATO EDUCACIONAL',kw:[
    ['CONTRATO DE PRESTACAO DE SERVICOS EDUCACIONAIS',14],['CONTRATO EDUCACIONAL',11],
    ['INSTRUMENTO PARTICULAR DE CONTRATO',8],['CONTRATANTE',4],['CONTRATADA',4],
    ['CLAUSULA',3],['FORO',2],['RESCISAO',2]
  ]},
  {type:'DOCUMENTOS',kw:[
    ['CERTIDAO DE NASCIMENTO',9],['CARTEIRA DE IDENTIDADE',8],['REGISTRO GERAL',6],
    ['CADASTRO DE PESSOAS FISICAS',7],['COMPROVANTE DE RESIDENCIA',8],
    ['REGISTRO CIVIL',5],['CARTORIO',3],['CPF',3],['RG',2]
  ]},
];
const CLASSIFY_THRESHOLD=6;

function normalizeText(s){
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ');
}
function scoreKeyword(text,kw){
  // termos curtos exigem palavra inteira (evita "RG" casar dentro de outra palavra)
  if(kw.length<=3){
    const re=new RegExp('\\b'+kw+'\\b');
    return re.test(text);
  }
  return text.includes(kw);
}
function classify(text){
  if(!text||text.length<8)return null;
  const t=normalizeText(text);
  let best=null,bestScore=0;
  // regras internas
  for(const rule of CLASSIFY_RULES){
    let score=0;
    for(const [kw,w] of rule.kw)if(scoreKeyword(t,kw))score+=w;
    if(score>bestScore){bestScore=score;best=rule.type}
  }
  // chips personalizados: o próprio nome do chip vale como palavra-chave forte
  for(const c of customChips){
    const kn=normalizeText(c.n);
    if(kn.length>=4&&t.includes(kn)&&9>bestScore){bestScore=9;best=c.n}
  }
  if(bestScore>=CLASSIFY_THRESHOLD)return {type:best,score:bestScore};
  return null;
}

async function extractText(pdfDoc){
  let out='';
  const max=Math.min(2,pdfDoc.numPages);
  for(let p=1;p<=max;p++){
    try{
      const page=await pdfDoc.getPage(p);
      const tc=await page.getTextContent();
      out+=' '+tc.items.map(i=>i.str).join(' ');
      page.cleanup();
    }catch{}
  }
  return out.trim();
}

// ── SANITIZAÇÃO DE NOME (Windows-safe) ──
function sanitizeName(name){
  return name
    .replace(/\.pdf$/i,'')
    .replace(/[\\/:*?"<>|]/g,'')
    .replace(/\s+/g,' ')
    .trim()
    .replace(/[. ]+$/,'')
    .slice(0,150);
}

// ── ESTADO ──
const files=[];           // {name, buffer, pages, saved, savedAs, suggestion, hasText, rot, pdfDoc?}
const sessionLog=[];      // {orig, saved, folder, time}
let activeIdx=-1,curPage=1,totPages=1;
let zoomLevel=2;
const ZOOM_LEVELS=[.6,.8,1,1.25,1.5,2];
const RENDER_OVERSAMPLE=1.4;
let dirHandle=null;
let selChip=null;
let yearOn=false;
let yearVal=Store.get('pdf_year',new Date().getFullYear());
const FS_SUPPORTED=('showDirectoryPicker' in window);

// ── DOM ──
const dropZone=document.getElementById('drop-zone');
const fileInput=document.getElementById('file-input');
const fileListEl=document.getElementById('file-list');
const emptyState=document.getElementById('empty-state');
const viewerWrap=document.getElementById('viewer-wrap');
const doneState=document.getElementById('done-state');
const canvas=document.getElementById('pdf-canvas');
const ctx=canvas.getContext('2d');
const loadingWrap=document.getElementById('loading-wrap');
const nameInput=document.getElementById('new-name');
const savedPill=document.getElementById('saved-pill');
const autoPill=document.getElementById('auto-pill');
const noTextTag=document.getElementById('notext-tag');
const pgInfo=document.getElementById('pg-info');
const btnPrev=document.getElementById('btn-prev');
const btnNext=document.getElementById('btn-next');
const btnNxt=document.getElementById('btn-nxt');
const fileTitle=document.getElementById('file-title');
const crumbFolder=document.getElementById('crumb-folder');
const searchInput=document.getElementById('search-input');
const progressBar=document.getElementById('progress-bar');
const chipsRow=document.getElementById('chips-row');
const btnNewChip=document.getElementById('btn-new-chip');
const chipForm=document.getElementById('chip-form');
const chipFi=document.getElementById('chip-fi');
const yearTgl=document.getElementById('year-tgl');
const yearValEl=document.getElementById('year-val');
const folderBox=document.getElementById('folder-box');
const fbName=document.getElementById('fb-name');
const fbHint=document.getElementById('fb-hint');
const fbSwap=document.getElementById('fb-swap');
const folderReconnect=document.getElementById('folder-reconnect');

// ── PASTA DE DESTINO (File System Access API) ──
async function pickFolder(){
  if(!FS_SUPPORTED){
    showToast('Navegador sem suporte a pastas — os arquivos irão para Downloads',true);
    return;
  }
  try{
    // abre o seletor já na pasta atual (ou na última usada), não numa pasta padrão
    const startIn=dirHandle||await IDB.get('dirHandle')||'documents';
    const h=await window.showDirectoryPicker({mode:'readwrite',startIn});
    dirHandle=h;
    await IDB.set('dirHandle',h);
    updateFolderUI();
    showToast('Pasta definida: '+h.name,false,true);
  }catch(err){
    if(err&&err.name!=='AbortError')showToast('Não foi possível abrir a pasta',true);
  }
}
async function reconnectFolder(){
  const h=await IDB.get('dirHandle');
  if(!h){folderReconnect.style.display='none';return}
  try{
    let perm=await h.queryPermission({mode:'readwrite'});
    if(perm!=='granted')perm=await h.requestPermission({mode:'readwrite'});
    if(perm==='granted'){
      dirHandle=h;updateFolderUI();
      showToast('Pasta reconectada: '+h.name,false,true);
    }else{
      showToast('Permissão negada para a pasta',true);
    }
  }catch{
    await IDB.del('dirHandle');
    folderReconnect.style.display='none';
    showToast('A pasta anterior não está mais acessível',true);
  }
}
function updateFolderUI(){
  folderReconnect.style.display='none';
  if(dirHandle){
    folderBox.classList.add('set');
    fbName.textContent=dirHandle.name;
    fbHint.textContent='os arquivos serão gravados aqui';
    fbSwap.style.display='';
    crumbFolder.textContent='~/'+dirHandle.name+'/';
  }else{
    folderBox.classList.remove('set');
    fbName.textContent=FS_SUPPORTED?'Escolher pasta…':'Sem suporte a pastas';
    fbHint.textContent=FS_SUPPORTED?'salva direto na pasta do aluno':'os arquivos irão para Downloads';
    fbSwap.style.display='none';
    crumbFolder.textContent='~/';
  }
}
(async()=>{
  await IDB.open();
  if(FS_SUPPORTED){
    const h=await IDB.get('dirHandle');
    if(h){
      folderReconnect.style.display='';
      folderReconnect.textContent='↻ Reconectar pasta anterior: "'+h.name+'"';
    }
  }
  updateFolderUI();
})();

// ── CHIPS ──
function renderChips(){
  Array.from(chipsRow.querySelectorAll('.chip')).forEach(c=>c.remove());
  allTypes().forEach(t=>{
    const btn=document.createElement('button');
    btn.className='chip'+(t.custom?' custom':'');
    btn.dataset.type=t.n;
    const lbl=document.createElement('span');lbl.textContent=t.n;btn.appendChild(lbl);
    if(t.custom){
      const x=document.createElement('button');x.className='chip-x';x.textContent='✕';
      x.onclick=e=>{
        e.stopPropagation();
        customChips=customChips.filter(c=>c.n!==t.n);Store.set('pdf_chips_v2',customChips);
        if(selChip===btn){selChip=null;nameInput.value='';setAutoPill(false)}
        renderChips();
      };btn.appendChild(x);
    }
    btn.onclick=e=>{
      if(e.target.classList.contains('chip-x'))return;
      selectChip(btn,t,true);
    };
    chipsRow.insertBefore(btn,btnNewChip);
  });
}
function selectChip(btn,t,manual){
  if(selChip&&selChip!==btn)selChip.classList.remove('sel');
  if(manual&&selChip===btn){
    btn.classList.remove('sel');selChip=null;nameInput.value='';
    setAutoPill(false);composeName();nameInput.focus();return;
  }
  btn.classList.add('sel');selChip=btn;
  setYear(t.year);
  if(manual)setAutoPill(false);
  composeName();
  if(manual)nameInput.focus();
}
function chipBtnByType(type){
  return chipsRow.querySelector('.chip[data-type="'+CSS.escape(type)+'"]');
}
function showChipForm(){btnNewChip.style.display='none';chipForm.classList.add('open');chipFi.value='';chipFi.focus()}
function hideChipForm(){chipForm.classList.remove('open');btnNewChip.style.display='';chipFi.value=''}
function confirmChip(){
  const v=sanitizeName(chipFi.value).toUpperCase();
  if(!v){chipFi.focus();return}
  if(!allTypes().some(t=>t.n===v)){
    customChips.push({n:v,year:false});
    Store.set('pdf_chips_v2',customChips);
    renderChips();
  }
  hideChipForm();
}
chipFi.addEventListener('keydown',e=>{if(e.key==='Enter')confirmChip();if(e.key==='Escape')hideChipForm()});

// ── ANO ──
function setYear(on){yearOn=on;yearTgl.classList.toggle('on',on)}
function toggleYear(){setYear(!yearOn);setAutoPill(false);composeName();nameInput.focus()}
function stepYear(d){
  yearVal=Math.max(2000,Math.min(2100,yearVal+d));
  Store.set('pdf_year',yearVal);
  yearValEl.textContent=yearVal;
  if(yearOn){setAutoPill(false);composeName()}
}
yearValEl.textContent=yearVal;

// ── COMPOSIÇÃO DO NOME (Tipo + Ano) ──
function composeName(){
  if(!selChip)return;
  const base=selChip.dataset.type;
  nameInput.value=base+(yearOn?' '+yearVal:'');
}
function setAutoPill(on){autoPill.classList.toggle('show',on)}

// ── CARREGAR ARQUIVOS ──
fileInput.addEventListener('change',e=>{addFiles(Array.from(e.target.files));fileInput.value=''});
dropZone.addEventListener('dragover',e=>{e.preventDefault();dropZone.classList.add('drag-over')});
dropZone.addEventListener('dragleave',()=>dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop',e=>{
  e.preventDefault();dropZone.classList.remove('drag-over');
  // aceita por MIME OU extensão (scanners às vezes entregam MIME vazio)
  const pdfs=Array.from(e.dataTransfer.files).filter(f=>f.type==='application/pdf'||/\.pdf$/i.test(f.name));
  if(pdfs.length)addFiles(pdfs);
  else showToast('Nenhum PDF entre os arquivos soltos',true);
});

async function addFiles(newFiles){
  doneState.classList.remove('show');
  let loaded=0;
  for(const f of newFiles){
    try{
      const master=await f.arrayBuffer();
      // abre temporariamente só para contar páginas + extrair texto + classificar
      const tmpDoc=await pdfjsLib.getDocument({data:master.slice(0)}).promise;
      const text=await extractText(tmpDoc);
      const suggestion=classify(text);
      const item={
        name:f.name,buffer:master,pages:tmpDoc.numPages,
        saved:false,savedAs:'',suggestion,hasText:text.length>=8,rot:0,pdfDoc:null
      };
      await tmpDoc.destroy();
      files.push(item);
      loaded++;
      renderList();updateStats();
    }catch(err){
      showToast('Erro ao carregar: '+f.name,true);
    }
  }
  if(loaded>0){
    const nSugg=files.filter(f=>!f.saved&&f.suggestion).length;
    showToast(loaded+' arquivo'+(loaded>1?'s':'')+' carregado'+(loaded>1?'s':'')+(nSugg?' · '+nSugg+' classificado'+(nSugg>1?'s':'')+' ✦':''),false,nSugg>0);
  }
  renderList();updateStats();
  if(activeIdx===-1&&files.length>0)selectFile(0);
}

// ── LISTA ──
function renderList(){
  const q=searchInput.value.trim().toLowerCase();
  fileListEl.innerHTML='';
  const filtered=files.map((item,i)=>({item,i})).filter(({item})=>
    !q||item.name.toLowerCase().includes(q)||
    (item.savedAs&&item.savedAs.toLowerCase().includes(q))||
    (item.suggestion&&item.suggestion.type.toLowerCase().includes(q))
  );
  if(!files.length){
    fileListEl.innerHTML='<div class="file-empty">// nenhum arquivo<br>// carregado ainda</div>';
    document.getElementById('h-badge').textContent='0 arquivos';
    emptyState.style.display='flex';viewerWrap.classList.remove('visible');return;
  }
  if(!filtered.length){
    const d=document.createElement('div');d.className='file-empty';
    d.textContent='// nenhum resultado para "'+q+'"';
    fileListEl.appendChild(d);
  }
  filtered.forEach(({item,i})=>{
    const el=document.createElement('div');
    el.className='file-item'+(i===activeIdx?' active':'')+(item.saved?' fi-saved':'');
    el.onclick=()=>selectFile(i);
    const dot=document.createElement('div');
    dot.className='fi-dot'+(item.saved?' done':(i===activeIdx?' cur':(item.suggestion?' auto':'')));
    const info=document.createElement('div');info.className='fi-info';
    const orig=document.createElement('div');orig.className='fi-orig';orig.textContent=item.name;
    const nn=document.createElement('div');
    if(item.saved){nn.className='fi-new';nn.textContent=item.savedAs+'.pdf'}
    else if(item.suggestion){nn.className='fi-new sugg';nn.textContent=item.suggestion.type}
    else{nn.className='fi-new empty';nn.textContent=item.hasText?'// sem nome ainda':'// digitalizado · manual'}
    info.appendChild(orig);info.appendChild(nn);
    const x=document.createElement('button');
    x.className='fi-x';x.textContent='✕';x.title='Remover da fila';
    x.onclick=e=>{e.stopPropagation();removeFile(i)};
    el.appendChild(dot);el.appendChild(info);el.appendChild(x);
    fileListEl.appendChild(el);
  });
  document.getElementById('h-badge').textContent=files.length+(files.length===1?' arquivo':' arquivos');
  emptyState.style.display='none';
}
searchInput.addEventListener('input',renderList);

function removeFile(i){
  const item=files[i];
  if(item.pdfDoc){item.pdfDoc.destroy();item.pdfDoc=null}
  files.splice(i,1);
  if(files.length===0){activeIdx=-1;renderList();updateStats();return}
  if(i===activeIdx){
    activeIdx=-1;
    selectFile(Math.min(i,files.length-1));
  }else{
    if(i<activeIdx)activeIdx--;
    renderList();updateStats();
  }
}

// ── SELECIONAR ARQUIVO (abre o PDF sob demanda, libera o anterior) ──
async function selectFile(i){
  if(i<0||i>=files.length)return;
  // libera memória do documento anterior
  if(activeIdx>=0&&activeIdx<files.length&&activeIdx!==i){
    const prev=files[activeIdx];
    if(prev.pdfDoc){prev.pdfDoc.destroy();prev.pdfDoc=null}
  }
  activeIdx=i;
  const item=files[i];
  curPage=1;totPages=item.pages;
  viewerWrap.classList.add('visible');
  emptyState.style.display='none';
  fileTitle.textContent=item.name;
  savedPill.classList.remove('show');
  noTextTag.classList.toggle('show',!item.hasText);

  // aplica sugestão automática (ou nome já salvo)
  if(selChip){selChip.classList.remove('sel');selChip=null}
  setAutoPill(false);
  nameInput.value='';
  if(item.saved){
    nameInput.value=item.savedAs;
  }else if(item.suggestion){
    const btn=chipBtnByType(item.suggestion.type);
    if(btn){
      const t=allTypes().find(t=>t.n===item.suggestion.type);
      selectChip(btn,t||{n:item.suggestion.type,year:false},false);
      setAutoPill(true);
    }else{
      nameInput.value=item.suggestion.type;
      setAutoPill(true);
    }
  }

  btnNxt.style.display=i<files.length-1?'':'none';
  renderList();
  await renderPage(curPage);
  nameInput.focus();nameInput.select();
  updateStats();
}

// ── RENDERIZAR PÁGINA ──
async function renderPage(num){
  loadingWrap.style.display='flex';canvas.style.display='none';
  const item=files[activeIdx];
  if(!item)return;
  try{
    if(!item.pdfDoc){
      item.pdfDoc=await pdfjsLib.getDocument({data:item.buffer.slice(0)}).promise;
    }
    const page=await item.pdfDoc.getPage(num);
    const scale=ZOOM_LEVELS[zoomLevel]*RENDER_OVERSAMPLE;
    const vp=page.getViewport({scale,rotation:(page.rotate+item.rot)%360});
    canvas.width=vp.width;canvas.height=vp.height;
    await page.render({canvasContext:ctx,viewport:vp}).promise;
    loadingWrap.style.display='none';canvas.style.display='block';
    pgInfo.textContent=num+' / '+totPages;
    btnPrev.disabled=num<=1;btnNext.disabled=num>=totPages;
    document.getElementById('zoom-val').textContent=Math.round(ZOOM_LEVELS[zoomLevel]*100)+'%';
  }catch(err){
    loadingWrap.style.display='none';
    showToast('Erro ao renderizar página',true);
  }
}
function changePage(d){const n=curPage+d;if(n<1||n>totPages)return;curPage=n;renderPage(n)}
function changeZoom(d){
  zoomLevel=Math.max(0,Math.min(ZOOM_LEVELS.length-1,zoomLevel+d));
  if(activeIdx>=0)renderPage(curPage);
}
function rotatePage(){
  if(activeIdx<0)return;
  files[activeIdx].rot=(files[activeIdx].rot+90)%360;
  renderPage(curPage);
}

// ── SALVAR ──
let dupResolver=null;
function askDuplicate(name){
  return new Promise(res=>{
    dupResolver=res;
    document.getElementById('dup-msg').innerHTML='Já existe <b>'+name+'.pdf</b> nesta pasta.<br>O que deseja fazer?';
    document.getElementById('dup-overlay').classList.add('show');
  });
}
function resolveDup(choice){
  document.getElementById('dup-overlay').classList.remove('show');
  if(dupResolver){dupResolver(choice);dupResolver=null}
}
async function existsInFolder(name){
  try{await dirHandle.getFileHandle(name+'.pdf');return true}
  catch{return false}
}
async function freeIncrementName(base){
  for(let n=2;n<100;n++){
    const candidate=base+' ('+n+')';
    if(!await existsInFolder(candidate))return candidate;
  }
  return base+' ('+Date.now()+')';
}

async function saveFile(){
  if(activeIdx<0)return;
  let name=sanitizeName(nameInput.value);
  if(!name){nameInput.focus();showToast('Digite ou escolha um tipo antes de salvar',true);return}
  const item=files[activeIdx];

  if(dirHandle){
    // grava direto na pasta escolhida
    try{
      if(await existsInFolder(name)){
        const choice=await askDuplicate(name);
        if(choice==='cancel'){nameInput.focus();return}
        if(choice==='increment')name=await freeIncrementName(name);
      }
      const fh=await dirHandle.getFileHandle(name+'.pdf',{create:true});
      const w=await fh.createWritable();
      await w.write(item.buffer);
      await w.close();
      showToast('Gravado em '+dirHandle.name+'/'+name+'.pdf',false,true);
    }catch(err){
      if(err&&err.name==='NotAllowedError'){
        showToast('Permissão da pasta expirou — escolha a pasta novamente',true);
        dirHandle=null;updateFolderUI();return;
      }
      showToast('Erro ao gravar na pasta — verifique o acesso',true);
      return;
    }
  }else{
    // fallback: download tradicional
    const blob=new Blob([item.buffer],{type:'application/pdf'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=name+'.pdf';
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url),3000);
  }

  item.savedAs=name;item.saved=true;
  sessionLog.push({
    orig:item.name,saved:name+'.pdf',
    folder:dirHandle?dirHandle.name:'Downloads',
    time:new Date().toLocaleTimeString('pt-BR')
  });
  savedPill.classList.add('show');
  if(selChip){selChip.classList.remove('sel');selChip=null}
  setAutoPill(false);
  renderList();updateStats();

  const allDone=files.every(f=>f.saved);
  if(allDone){setTimeout(showDone,600);return}
  setTimeout(()=>{
    const nx=files.findIndex((f,i)=>i>activeIdx&&!f.saved);
    const anyPending=nx!==-1?nx:files.findIndex(f=>!f.saved);
    if(anyPending!==-1)selectFile(anyPending);
  },600);
}

function goNext(){if(activeIdx+1<files.length)selectFile(activeIdx+1)}
function stepFile(d){
  if(!files.length)return;
  const n=activeIdx+d;
  if(n>=0&&n<files.length)selectFile(n);
}

// ── STATS ──
function updateStats(){
  const done=files.filter(f=>f.saved).length;
  document.getElementById('s-total').textContent=files.length;
  document.getElementById('s-done').textContent=done;
  document.getElementById('s-pend').textContent=files.length-done;
  const pct=files.length>0?(done/files.length)*100:0;
  progressBar.style.width=pct+'%';
}

// ── CONCLUÍDO ──
function showDone(){
  const total=files.length;
  viewerWrap.classList.remove('visible');
  document.getElementById('done-sub').textContent='// '+total+' arquivo'+(total>1?'s':'')+' renomeado'+(total>1?'s':'')+(dirHandle?' em "'+dirHandle.name+'"':'');
  const log=document.getElementById('done-log');
  log.innerHTML='';
  sessionLog.forEach(e=>{
    const row=document.createElement('div');row.className='dl-row';
    const o=document.createElement('span');o.className='dl-orig';o.textContent=e.orig;
    const n=document.createElement('span');n.className='dl-new';n.textContent='→ '+e.saved;
    row.appendChild(o);row.appendChild(n);log.appendChild(row);
  });
  doneState.classList.add('show');
}

function exportLog(){
  if(!sessionLog.length){showToast('Nada para exportar',true);return}
  let csv='\uFEFForiginal;novo nome;pasta;hora\n';
  sessionLog.forEach(e=>{
    csv+='"'+e.orig.replace(/"/g,'""')+'";"'+e.saved+'";"'+e.folder+'";"'+e.time+'"\n';
  });
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;
  a.download='log_renomeacao_'+new Date().toISOString().slice(0,10)+'.csv';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),3000);
}

function resetForNew(){
  doneState.classList.remove('show');
  files.forEach(f=>{if(f.pdfDoc){f.pdfDoc.destroy();f.pdfDoc=null}});
  files.length=0;sessionLog.length=0;
  activeIdx=-1;curPage=1;totPages=1;
  nameInput.value='';canvas.style.display='none';loadingWrap.style.display='none';
  if(selChip){selChip.classList.remove('sel');selChip=null}
  setAutoPill(false);
  savedPill.classList.remove('show');
  searchInput.value='';
  renderList();updateStats();
}

// ── LIMPAR ──
function confirmClear(){if(files.length)document.getElementById('overlay').classList.add('show')}
function closeClear(){document.getElementById('overlay').classList.remove('show')}
function clearAll(){
  resetForNew();
  closeClear();
}

// ── ATALHOS ──
function toggleKb(){document.getElementById('kb-overlay').classList.toggle('show')}

let toastTimer=null;
function showToast(msg,err=false,ok=false){
  const t=document.getElementById('toast');
  t.textContent=msg;
  t.className='toast show'+(err?' err':(ok?' ok':''));
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove('show'),3000);
}

nameInput.addEventListener('keydown',e=>{
  if(e.key==='Enter'){saveFile()}
  if(e.key==='Tab'){e.preventDefault();goNext()}
});
nameInput.addEventListener('input',()=>{
  if(selChip){selChip.classList.remove('sel');selChip=null}
  setAutoPill(false);
});

document.addEventListener('keydown',e=>{
  const tag=document.activeElement.tagName.toLowerCase();
  const typing=['input','textarea'].includes(tag);
  if(e.key==='Escape'){
    closeClear();resolveDupIfOpen();
    document.getElementById('kb-overlay').classList.remove('show');
    hideChipForm();
  }
  if(e.ctrlKey&&e.key==='ArrowUp'){e.preventDefault();stepFile(-1);return}
  if(e.ctrlKey&&e.key==='ArrowDown'){e.preventDefault();stepFile(1);return}
  if(typing)return;
  if(e.key==='ArrowLeft')changePage(-1);
  if(e.key==='ArrowRight')changePage(1);
  if(e.key==='+'||e.key==='=')changeZoom(1);
  if(e.key==='-')changeZoom(-1);
  if(e.key==='r'||e.key==='R')rotatePage();
  if(e.key==='?')toggleKb();
});
function resolveDupIfOpen(){
  if(document.getElementById('dup-overlay').classList.contains('show'))resolveDup('cancel');
}

renderChips();
