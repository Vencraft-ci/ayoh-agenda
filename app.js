'use strict';
const C=window.AGENDA_CONFIG,$=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DEF={name:C.businessName,open:'08:00',close:'18:00',slot:60,closedDays:[0],blocks:[]};
const U={normal:{l:'Pas urgent',c:'#2e9e5b'},moyen:{l:'Pas trop urgent',c:'#e8890c'},urgent:{l:'Urgent',c:'#d62828'}};
const PER=[['Matin',0,720],['Après-midi',720,1020],['Soirée',1020,1440]];
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const pd=s=>{const[a,b,c]=s.split('-');return new Date(+a,b-1,+c)};
const add=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const fd=(s,o)=>pd(s).toLocaleDateString('fr-FR',o||{weekday:'long',day:'numeric',month:'long'});
const today=()=>iso(new Date());
const m2t=m=>String(m/60|0).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
const t2m=t=>{const[h,m]=t.split(':');return +h*60+ +m};
/* minuit : stocké "24:00", affiché et saisi "00:00" */
const tv=t=>t==='24:00'?'00:00':t;
const tz=v=>v==='00:00'?'24:00':v;
const dur=m=>{const h=m/60|0,r=m%60;return h?(r?h+' h '+String(r).padStart(2,'0'):h+' h'):r+' min'};
const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('on'),2800)};
const closeModal=()=>{};
/* numéro -> format international (pour appel et WhatsApp) */
function intl(raw){const s=String(raw||'').trim(),d=s.replace(/\D/g,'');if(!d)return'';const cc=String(C.countryCode||'225');
  if(s.startsWith('+'))return d;if(d.startsWith('00'))return d.slice(2);if(d.startsWith(cc)&&d.length>=cc.length+8)return d;return cc+d}

let DB,user=null,deferred=null,S={rdv:[],cfg:{},ready:false},lastTab=null;
const blank=()=>({old:null,name:'',phone:'',same:true,wa:'',date:null,time:null,urg:'normal',note:'',done:false,created:null});
const bk0=()=>({from:today(),to:today(),all:true,start:'12:00',end:'14:00',reason:''});
let F=blank(),P={tab:'agenda',day:0,seg:'todo',month:new Date(),sel:null,bk:bk0()};
const cfg=()=>({...DEF,...S.cfg});

/* ---------- disponibilités ---------- */
function slots(){const c=cfg(),o=[],sl=Math.max(5,+c.slot||60);for(let m=t2m(c.open);m+sl<=t2m(c.close);m+=sl)o.push(m2t(m));return o}
/* un créneau est bloqué s'il chevauche une période bloquée */
const isBlocked=(d,t)=>{const c=cfg(),tm=t2m(t),sl=Math.max(5,+c.slot||60);
  return c.closedDays.includes(pd(d).getDay())||c.blocks.some(b=>d>=b.from&&d<=b.to&&(b.all||(tm<t2m(b.end)&&tm+sl>t2m(b.start))))};
const takenBy=(d,t)=>S.rdv.find(r=>r.sid===d+'_'+t&&r.sid!==F.old);
const freeCount=d=>slots().filter(t=>!isBlocked(d,t)&&!S.rdv.some(r=>r.sid===d+'_'+t)).length;
const dayClosed=d=>slots().every(t=>isBlocked(d,t));

/* ---------- données : démo locale ou Firebase ---------- */
const LS='agenda_pro_v1';
const Local={mode:'demo',
  load(){try{return JSON.parse(localStorage[LS])||{}}catch{return{}}},
  save(d){localStorage[LS]=JSON.stringify(d);this.push()},
  push(){const d=this.load();S.rdv=d.rdv||[];S.cfg=d.cfg||{};S.ready=true;this.cb()},
  init(cb){this.cb=cb;user={demo:true};this.push();addEventListener('storage',e=>e.key===LS&&this.push())},
  async add(r){const d=this.load();d.rdv=d.rdv||[];if(d.rdv.some(x=>x.sid===r.sid))throw'taken';d.rdv.push(r);this.save(d)},
  async update(o,r){const d=this.load();d.rdv=d.rdv||[];if(o!==r.sid&&d.rdv.some(x=>x.sid===r.sid))throw'taken';d.rdv=d.rdv.filter(x=>x.sid!==o);d.rdv.push(r);this.save(d)},
  async patch(s,f){const d=this.load();d.rdv=(d.rdv||[]).map(x=>x.sid===s?{...x,...f}:x);this.save(d)},
  async remove(s){const d=this.load();d.rdv=(d.rdv||[]).filter(x=>x.sid!==s);this.save(d)},
  async setCfg(c){const d=this.load();d.cfg=c;this.save(d)},
  async logout(){}};
const FB={mode:'firebase',
  ref(s){return this.db.collection('rdv').doc(s)},
  init(cb){this.cb=cb;firebase.initializeApp(C.firebase);this.db=firebase.firestore();this.un=[];
    firebase.auth().onAuthStateChanged(u=>{user=u;this.un.forEach(f=>f());this.un=[];
      if(u)this.un=[this.db.collection('rdv').onSnapshot(s=>{S.rdv=s.docs.map(d=>d.data());S.ready=true;cb()},()=>toast('Accès refusé : vérifiez les règles Firebase')),
        this.db.doc('meta/config').onSnapshot(s=>{S.cfg=s.exists?s.data():{};cb()})];
      else{S.rdv=[];S.ready=false}cb()})},
  add(r){return this.db.runTransaction(async t=>{if((await t.get(this.ref(r.sid))).exists)throw'taken';t.set(this.ref(r.sid),r)})},
  update(o,r){return this.db.runTransaction(async t=>{if(o!==r.sid){if((await t.get(this.ref(r.sid))).exists)throw'taken';t.delete(this.ref(o))}t.set(this.ref(r.sid),r)})},
  patch(s,f){return this.ref(s).update(f)},remove(s){return this.ref(s).delete()},
  setCfg(c){return this.db.doc('meta/config').set(c)},
  login(e,p){return firebase.auth().signInWithEmailAndPassword(e,p)},
  logout(){return firebase.auth().signOut()}};
const loadJs=u=>new Promise((ok,ko)=>{const s=document.createElement('script');s.src=u;s.onload=ok;s.onerror=ko;document.head.appendChild(s)});

/* ---------- installation ---------- */
const standalone=()=>(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone;
const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent);
addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;refresh()});
addEventListener('appinstalled',()=>{deferred=null;refresh()});
function instHtml(){
  if(localStorage.noinst==='1'||standalone())return'';
  if(deferred)return`<div class=inst><span>Installez l'agenda sur l'écran d'accueil.</span><button class="btn gold sm" data-a=install>Installer</button><button class=x data-a=noinst aria-label=Fermer>✕</button></div>`;
  if(isIOS())return`<div class=inst><span>iPhone : touchez <b>Partager</b> puis « Sur l'écran d'accueil ».</span><button class=x data-a=noinst aria-label=Fermer>✕</button></div>`;
  return''}
function instCard(){
  if(standalone())return'';
  return`<section class=card><h2>Installer sur le téléphone</h2>`+(deferred?`<button class="btn gold big" data-a=install>Installer l'application</button>`:
    isIOS()?`<ol class=steps><li>Ouvrez ce lien dans <b>Safari</b>.</li><li>Touchez le bouton <b>Partager</b> (carré avec une flèche).</li><li>Choisissez <b>Sur l'écran d'accueil</b>, puis <b>Ajouter</b>.</li></ol>`
    :`<ol class=steps><li>Ouvrez ce lien dans <b>Chrome</b>.</li><li>Touchez le menu <b>⋮</b> en haut à droite.</li><li>Choisissez <b>Installer l'application</b> (ou <b>Ajouter à l'écran d'accueil</b>).</li></ol>`)+`</section>`}

/* ---------- icônes ---------- */
const IC={agenda:'<path d="M4 6h16M4 12h16M4 18h10"/>',month:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',add:'<path d="M12 5v14M5 12h14"/>',block:'<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',set:'<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  phone:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  chat:'<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',undo:'<path d="M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3"/>',
  edit:'<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',trash:'<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6"/>'};
const ico=k=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[k]}</svg>`;

/* ---------- vues ---------- */
function card(r){const u=U[r.urg]||U.normal,tel=intl(r.phone),wa=intl(r.wa||r.phone),d=+(r.dur||cfg().slot),
  msg=encodeURIComponent(`Bonjour ${r.name}, ici ${cfg().name}. Nous vous confirmons votre rendez-vous le ${fd(r.date)} à ${r.time}.`);
  return`<article class="rc${r.done?' done':''}" style="--c:${u.c}"><div class=rt><b>${r.time}</b><small>${dur(d)}</small></div><div class=rb>
  <div class=rn><h4>${esc(r.name)}</h4><span class=tag><i></i>${u.l}</span></div><div class=ph>${esc(r.phone)}</div>
  ${r.note?`<div class=note>${esc(r.note)}</div>`:''}
  <div class=acts><a class="act call${tel?'':' off'}" href="tel:+${tel}">${ico('phone')}Appeler</a><a class="act wa${wa?'':' off'}" href="https://wa.me/${wa}?text=${msg}" target=_blank rel=noopener>${ico('chat')}WhatsApp</a></div>
  <div class=mini>${r.done?`<button data-a=done data-s="${r.sid}">${ico('undo')}À recevoir</button>`:`<button class=ok2 data-a=done data-s="${r.sid}">${ico('check')}Terminé</button>`}<button data-a=edit data-s="${r.sid}">${ico('edit')}Modifier</button><button class=dl data-a=del data-s="${r.sid}">${ico('trash')}Supprimer</button></div></div></article>`}

function dayBlock(d){const L=S.rdv.filter(r=>r.date===d).sort((a,b)=>a.time.localeCompare(b.time)),todo=L.filter(r=>!r.done),dn=L.filter(r=>r.done),isT=P.seg==='todo',cl=dayClosed(d);
  let h=`<div class=dh><h3 class=cap>${esc(fd(d))}</h3><span class=hint>${cl?'Jour bloqué':freeCount(d)+' créneau'+(freeCount(d)>1?'x':'')+' libre'+(freeCount(d)>1?'s':'')}</span></div>
  <div class=seg><button class="${isT?'sel':''}" data-a=seg data-s=todo>À recevoir<em>${todo.length}</em></button><button class="${isT?'':'sel'}" data-a=seg data-s=done>Terminés<em>${dn.length}</em></button></div>`;
  const list=isT?todo:dn;
  if(!list.length)return h+`<div class=empty>${isT?'Aucun client à recevoir ce jour.':'Aucun client terminé ce jour.'}</div>`+(isT&&!cl?`<button class="btn gold big" data-a=addfor data-d="${d}">Ajouter un rendez-vous</button>`:'');
  if(!isT)return h+list.map(card).join('');
  PER.forEach(([n,a,b])=>{const g=list.filter(r=>t2m(r.time)>=a&&t2m(r.time)<b);if(g.length)h+=`<div class=gl>${n}</div>`+g.map(card).join('')});return h}
function agendaView(){const ds=[0,1,2].map(i=>iso(add(new Date(),i))),lb=['Aujourd\'hui','Demain','Après-demain'];
  return`<div class=tiles>${ds.map((d,i)=>`<button class="tile${P.day===i?' sel':''}" data-a=day data-i=${i}><b>${S.rdv.filter(r=>r.date===d&&!r.done).length}</b><span>${lb[i]}</span><small>${esc(fd(d,{weekday:'short',day:'numeric'}))}</small></button>`).join('')}</div>`+dayBlock(ds[P.day])}
function monthView(){const m=P.month,y=m.getFullYear(),mo=m.getMonth(),n=new Date(y,mo+1,0).getDate(),off=(new Date(y,mo,1).getDay()+6)%7,by={};
  S.rdv.forEach(r=>(by[r.date]=by[r.date]||[]).push(r));
  let g=['L','M','M','J','V','S','D'].map(x=>`<div class=gh>${x}</div>`).join('')+'<div></div>'.repeat(off);
  for(let i=1;i<=n;i++){const d=iso(new Date(y,mo,i)),L=(by[d]||[]),T=L.filter(r=>!r.done),mx=T.some(r=>r.urg==='urgent')?'urgent':T.some(r=>r.urg==='moyen')?'moyen':'normal',col=T.length?U[mx].c:L.length?'#9aa5a0':'transparent';
    g+=`<button class="cell${dayClosed(d)?' blk':''}${d===today()?' td':''}${d===(P.sel||today())?' sel':''}" data-a=sel data-d="${d}">${i}<i style="background:${col}"></i></button>`}
  return`<div class=mh><button class="btn ghost sm" data-a=mon data-n=-1 aria-label="Mois précédent">‹</button><h3 class=cap>${m.toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}</h3><button class="btn ghost sm" data-a=mon data-n=1 aria-label="Mois suivant">›</button></div><div class=grid>${g}</div>`+dayBlock(P.sel||today())}

function addView(){if(!F.date)F.date=today();const all=slots();
  return`<section class=card><h2>${F.old?'Modifier le rendez-vous':'Nouveau rendez-vous'}</h2>
  <label class=lbl>Nom du client<input data-f=name value="${esc(F.name)}" placeholder="Ex : Awa Koné" autocomplete=off></label>
  <label class=lbl>Téléphone<input data-f=phone type=tel inputmode=tel value="${esc(F.phone)}" placeholder="07 00 00 00 00"></label>
  <label class=chk><input type=checkbox data-f=same ${F.same?'checked':''}> Ce numéro est aussi sur WhatsApp</label>
  ${F.same?'':`<label class=lbl>Numéro WhatsApp<input data-f=wa type=tel inputmode=tel value="${esc(F.wa)}" placeholder="Numéro WhatsApp du client"></label>`}</section>
  <section class=card><h2>Date</h2><div class=chips>${Array.from({length:14},(_,i)=>{const d=iso(add(new Date(),i)),x=pd(d),f=freeCount(d);
    return`<button class="chip${d===F.date?' sel':''}${f?'':' off'}" data-a=pickd data-d="${d}"><small>${i?x.toLocaleDateString('fr-FR',{weekday:'short'}):'Auj.'}</small><b>${x.getDate()}</b><small>${x.toLocaleDateString('fr-FR',{month:'short'})}</small><em>${dayClosed(d)?'Bloqué':f?f+' libre'+(f>1?'s':''):'Complet'}</em></button>`}).join('')}</div>
  <label class=lbl>Autre date<input type=date data-f=date value="${F.date}" min="${today()}"></label></section>
  <section class=card><h2>Heure</h2>${dayClosed(F.date)?'<div class=empty>Ce jour est bloqué. Choisissez une autre date.</div>':PER.map(([n,a,b])=>{const g=all.filter(t=>t2m(t)>=a&&t2m(t)<b);
    return g.length?`<div class=gl>${n}</div><div class=slots>`+g.map(t=>{const bl=isBlocked(F.date,t),o=takenBy(F.date,t);
      return`<button class="slot${o?' taken':''}${F.time===t?' sel':''}" ${bl||o?'disabled':`data-a=pickt data-t="${t}"`}>${t}${o?`<small>${esc(o.name.split(' ')[0])}</small>`:bl?'<small>Bloqué</small>':''}</button>`}).join('')+'</div>':''}).join('')}</section>
  <section class=card><h2>Urgence et remarque</h2><div class=urg>${Object.entries(U).reverse().map(([k,u])=>`<button class="u${F.urg===k?' sel':''}" style="--c:${u.c}" data-a=urg data-u="${k}"><i></i>${u.l}</button>`).join('')}</div>
  <textarea data-f=note placeholder="Motif ou remarque (facultatif)">${esc(F.note)}</textarea></section>
  <button class="btn gold big" data-a=save>Enregistrer le rendez-vous</button>${F.old?'<button class="btn ghost big" data-a=cancelEdit>Annuler la modification</button>':''}`}

function blockView(){const c=cfg(),B=P.bk,bl=[...c.blocks].sort((a,b)=>a.from.localeCompare(b.from)),DN=[['Lun',1],['Mar',2],['Mer',3],['Jeu',4],['Ven',5],['Sam',6],['Dim',0]],
  ok=!B.all&&t2m(B.end)>t2m(B.start);
  return`<section class=card><h2>Bloquer une période</h2>
  <div class=row><label class=lbl>Du<input type=date data-b=from value="${B.from}" min="${today()}"></label><label class=lbl>Au<input type=date data-b=to value="${B.to}" min="${B.from}"></label></div>
  <div class=seg><button class="${B.all?'sel':''}" data-a=ball data-v=1>Toute la journée</button><button class="${B.all?'':'sel'}" data-a=ball data-v=0>Certaines heures</button></div>
  ${B.all?'':`<div class=row><label class=lbl>De<input type=time data-b=start value="${B.start}"></label><label class=lbl>À<input type=time data-b=end value="${tv(B.end)}"></label></div>
  <div class=lbl>Durée rapide à partir de l'heure de début</div><div class=qd>${[1,2,3,4,6].map(h=>`<button class=pill data-a=bdur data-h=${h}>${h} h</button>`).join('')}</div>
  <p class=hint>${ok?`Bloqué de ${tv(B.start)} à ${tv(B.end)} (${dur(t2m(B.end)-t2m(B.start))}), chaque jour de la période. `:''}Pour fermer le soir, mettez par exemple de 18:00 à 00:00 (minuit).</p>`}
  <input data-b=reason value="${esc(B.reason)}" placeholder="Raison (congé, fête, déplacement…)"><button class="btn gold big" data-a=addblock>Bloquer cette période</button></section>
  <section class=card><h2>Jours fermés chaque semaine</h2><div class=wd>${DN.map(([n,i])=>`<button class="pill${c.closedDays.includes(i)?' sel':''}" data-a=wd data-d="${i}">${n}</button>`).join('')}</div><div class=hint>Les jours en vert sont fermés.</div></section>
  <section class=card><h2>Périodes bloquées</h2>${bl.length?bl.map(b=>`<div class=bl><div><b>${b.from===b.to?esc(fd(b.from,{weekday:'short',day:'numeric',month:'short'})):esc(fd(b.from,{day:'numeric',month:'short'}))+' au '+esc(fd(b.to,{day:'numeric',month:'short'}))}</b><br><span class=hint>${b.all?'Toute la journée':tv(b.start)+' à '+tv(b.end)+' ('+dur(t2m(b.end)-t2m(b.start))+')'}${b.reason?', '+esc(b.reason):''}</span></div><button class="btn ghost sm" data-a=unblock data-id="${b.id}">Débloquer</button></div>`).join(''):'<div class=hint>Aucun blocage en cours.</div>'}</section>`}

function setView(){const c=cfg(),sl=+c.slot;
  return`<section class=card><h2>Réglages</h2><label class=lbl>Nom de l'entreprise<input id=sn value="${esc(c.name)}"></label>
  <div class=row><label class=lbl>Ouverture<input type=time id=so value="${tv(c.open)}"></label><label class=lbl>Fermeture<input type=time id=sc value="${tv(c.close)}"></label></div>
  <p class=hint style="margin:0 0 12px">Pour fermer à minuit, mettez 00:00. Vous pouvez ouvrir dès 00:00 et fermer à 00:00 pour couvrir 24 h.</p>
  <label class=lbl>Durée d'un rendez-vous (en minutes)<input type=number id=sl inputmode=numeric min=5 max=1440 step=1 value="${sl}"></label>
  <div class=qd>${[15,30,45,60,90,120,180].map(x=>`<button class="pill qs${sl===x?' sel':''}" data-a=setslot data-m=${x}>${x}</button>`).join('')}</div>
  <p class=hint id=pv></p>
  <button class="btn gold big" data-a=savecfg>Enregistrer</button></section>
  ${instCard()}
  ${DB.mode==='firebase'?`<section class=card><h2>Compte</h2><p class=hint>Connecté : ${esc(user.email||'')}</p><button class="btn ghost sm" data-a=logout>Se déconnecter</button></section>`:''}`}
function pvUpdate(){const o=$('#so'),c=$('#sc'),s=$('#sl'),p=$('#pv');if(!o||!c||!s||!p)return;
  const sl=+s.value,om=t2m(o.value||'08:00'),cm=t2m(tz(c.value||'18:00'));
  document.querySelectorAll('.qs').forEach(b=>b.classList.toggle('sel',+b.dataset.m===sl));
  if(!(sl>=5)||cm<=om){p.textContent='Vérifiez les horaires et la durée (5 minutes minimum).';return}
  const n=Math.floor((cm-om)/sl);
  p.textContent=n?`${n} créneau${n>1?'x':''} par jour : le premier à ${m2t(om)}, le dernier à ${m2t(om+(n-1)*sl)}.`:'La durée est plus longue que la journée d\'ouverture.'}
function loginView(){document.title='Agenda';lastTab=null;
  $('#app').innerHTML=`<main class=wrap id=sc><div class=login><img src="icons/icon-192.png" alt=""><h1>${esc(cfg().name)}</h1><p class=sub>Agenda de l'équipe</p><section class=card><h2>Connexion</h2>
  <input id=em type=email placeholder="Adresse e-mail de l'équipe" autocomplete=username><input id=pw type=password placeholder="Mot de passe" autocomplete=current-password>
  <button class="btn gold big" data-a=login>Se connecter</button><p class=hint>Une seule fois : le téléphone reste connecté ensuite.</p></section></div></main>`}

function render(){if(!DB)return;if(!user)return loginView();const c=cfg();document.title=c.name+' – Agenda';
  const old=$('#sc'),y=old&&lastTab===P.tab?old.scrollTop:0;lastTab=P.tab;
  const tabs=[['agenda','Agenda'],['month','Calendrier'],['add','Ajouter'],['block','Bloquer'],['set','Réglages']];
  const v={agenda:agendaView,month:monthView,add:addView,block:blockView,set:setView}[P.tab]();
  $('#app').innerHTML=`<header class=top><img src="icons/icon-192.png" alt=""><div><div class=brand>${esc(c.name)}</div><div class=sub>Agenda des rendez-vous</div></div></header>
  <main class=wrap id=sc>${P.tab==='set'?'':`<div id=inst>${instHtml()}</div>`}${v}</main>
  <nav class=bnav>${tabs.map(([k,l])=>`<button class="${k==='add'?'plus ':''}${P.tab===k?'sel':''}" data-a=tab data-t=${k} aria-label="${l}">${ico(k)}<span>${l}</span></button>`).join('')}</nav>`;
  $('#sc').scrollTop=y;if(P.tab==='set')pvUpdate()}
function refresh(){const a=document.activeElement;if(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName)&&$('#app').contains(a)&&user)return;render()}

/* ---------- actions ---------- */
const A={
  tab(d){P.tab=d.t;if(d.t==='add'&&!F.old&&!F.date)F.date=today();render()},
  day:d=>{P.day=+d.i;render()},seg:d=>{P.seg=d.s;render()},
  mon:d=>{P.month=new Date(P.month.getFullYear(),P.month.getMonth()+ +d.n,1);render()},
  sel:d=>{P.sel=d.d;render()},
  pickd:d=>{F.date=d.d;F.time=null;render()},pickt:d=>{F.time=d.t;render()},urg:d=>{F.urg=d.u;render()},
  addfor:d=>{F=blank();F.date=d.d;P.tab='add';render()},
  edit(d){const r=S.rdv.find(x=>x.sid===d.s);if(!r)return;F={old:r.sid,name:r.name,phone:r.phone,same:!r.wa||r.wa===r.phone,wa:r.wa||'',date:r.date,time:r.time,urg:r.urg,note:r.note||'',done:!!r.done,created:r.created};P.tab='add';render()},
  cancelEdit(){F=blank();P.tab='agenda';render()},
  async save(){const name=F.name.trim(),ph=F.phone.trim(),wa=F.same?ph:F.wa.trim();
    if(name.length<2)return toast('Entrez le nom du client');
    if(ph.replace(/\D/g,'').length<6)return toast('Entrez un numéro de téléphone valide');
    if(!F.same&&wa.replace(/\D/g,'').length<6)return toast('Entrez le numéro WhatsApp');
    if(!F.time)return toast('Choisissez une heure');
    if(isBlocked(F.date,F.time))return toast('Ce créneau est bloqué');
    const r={sid:F.date+'_'+F.time,name,phone:ph,wa,date:F.date,time:F.time,dur:+cfg().slot,urg:F.urg,note:F.note.trim(),done:F.done,created:F.created||Date.now()};
    try{F.old?await DB.update(F.old,r):await DB.add(r)}catch(e){return toast(e==='taken'?'Ce créneau est déjà pris. Choisissez-en un autre.':'Erreur de connexion, réessayez')}
    F=blank();const i=Math.round((pd(r.date)-pd(today()))/864e5);P.seg='todo';
    if(i>=0&&i<=2){P.tab='agenda';P.day=i}else{P.tab='month';P.sel=r.date;P.month=new Date(pd(r.date).getFullYear(),pd(r.date).getMonth(),1)}
    render();toast('Rendez-vous enregistré')},
  async done(d){const r=S.rdv.find(x=>x.sid===d.s);if(!r)return;try{await DB.patch(d.s,{done:!r.done});toast(r.done?'Remis à recevoir':'Client terminé')}catch{toast('Erreur de connexion')}},
  async del(d){if(!confirm('Supprimer ce rendez-vous ? Le créneau sera de nouveau libre.'))return;try{await DB.remove(d.s);toast('Rendez-vous supprimé')}catch{toast('Erreur de connexion')}},
  ball(d){P.bk.all=d.v==='1';render()},
  bdur(d){const B=P.bk;B.end=m2t(Math.min(1440,t2m(B.start)+ +d.h*60));render()},
  async addblock(){const B=P.bk,f=B.from,t=B.to,all=B.all,s=B.start,e=B.end;
    if(!f||!t||t<f)return toast('Vérifiez les dates');if(!all&&(!s||!e||t2m(e)<=t2m(s)))return toast("L'heure de fin doit être après l'heure de début");
    const c=cfg();c.blocks=[...c.blocks,{id:String(Date.now()),from:f,to:t,all,start:s,end:e,reason:B.reason.trim()}];
    const hit=S.rdv.filter(r=>!r.done&&r.date>=f&&r.date<=t&&(all||(t2m(r.time)<t2m(e)&&t2m(r.time)+ +c.slot>t2m(s)))).length;
    try{await DB.setCfg(c);P.bk=bk0();toast(hit?`Bloqué. Attention : ${hit} rendez-vous déjà prévus sur cette période`:'Période bloquée');render()}catch{toast('Erreur de connexion')}},
  async unblock(d){const c=cfg();c.blocks=c.blocks.filter(b=>b.id!==d.id);try{await DB.setCfg(c);toast('Débloqué');render()}catch{toast('Erreur de connexion')}},
  async wd(d){const c=cfg(),i=+d.d;c.closedDays=c.closedDays.includes(i)?c.closedDays.filter(x=>x!==i):[...c.closedDays,i];try{await DB.setCfg(c);render()}catch{toast('Erreur de connexion')}},
  setslot(d){$('#sl').value=d.m;pvUpdate()},
  async savecfg(){const c=cfg(),o=$('#so').value,cl=tz($('#sc').value),sl=Math.round(+$('#sl').value);
    if(!o||!cl||t2m(cl)<=t2m(o))return toast("Vérifiez les horaires (la fermeture doit être après l'ouverture)");
    if(!(sl>=5&&sl<=1440))return toast('Entrez une durée en minutes (5 minimum)');
    Object.assign(c,{name:$('#sn').value.trim()||c.name,open:o,close:cl,slot:sl});
    try{await DB.setCfg(c);toast('Réglages enregistrés');render()}catch{toast('Erreur de connexion')}},
  async login(){try{await DB.login($('#em').value.trim(),$('#pw').value)}catch{toast('E-mail ou mot de passe incorrect')}},
  async logout(){await DB.logout()},
  async install(){if(!deferred)return;deferred.prompt();await deferred.userChoice;deferred=null;refresh()},
  noinst(){localStorage.noinst='1';refresh()},close:closeModal};
document.addEventListener('click',e=>{const b=e.target.closest('[data-a]');if(b&&A[b.dataset.a])A[b.dataset.a](b.dataset,b)});
document.addEventListener('input',e=>{const t=e.target,f=t.dataset&&t.dataset.f,b=t.dataset&&t.dataset.b;
  if(f)F[f]=t.type==='checkbox'?t.checked:t.value;
  if(b)P.bk[b]=b==='end'?tz(t.value):t.value;
  if(t.id==='so'||t.id==='sc'||t.id==='sl')pvUpdate()});
document.addEventListener('change',e=>{const t=e.target,f=t.dataset&&t.dataset.f,b=t.dataset&&t.dataset.b;
  if(f==='same')render();if(f==='date'&&t.value){F.date=t.value;F.time=null;render()}
  if(b==='from'){if(P.bk.to<P.bk.from)P.bk.to=P.bk.from;render()}
  if(b==='start'||b==='end'||b==='to')render()});

(async function boot(){
  DB=Local;
  if(C.firebase){try{const b='https://www.gstatic.com/firebasejs/10.12.2/firebase-';await loadJs(b+'app-compat.js');await loadJs(b+'firestore-compat.js');await loadJs(b+'auth-compat.js');DB=FB}catch{toast('Connexion impossible : mode local')}}
  if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
  DB.init(refresh);setInterval(refresh,60000)})();
