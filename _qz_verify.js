"use strict";
/* Vérification Quizey — syntaxe + test fonctionnel du thème (DOM factice).
   Aucune dépendance. Lancer : node _qz_verify.js */
const fs=require("fs"),vm=require("vm"),path=require("path");
const html=fs.readFileSync(path.join(__dirname,"Quizey.html"),"utf8");
const blocks=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const earlyBlock=blocks[0];
const appBlock=blocks.find(b=>b.includes("use strict"));
let pass=0,fail=0;
function ok(name,cond){ if(cond){pass++;console.log("  ✓ "+name);} else {fail++;console.log("  ✗ "+name);} }

/* ---------- DOM factice minimaliste ---------- */
function makeEl(opts){
  const el={
    _attrs:{},_listeners:{},_classes:new Set(),
    style:(function(){const s={};s.setProperty=function(k,v){s[k]=String(v);};s.removeProperty=function(k){delete s[k];};return s;})(),
    dataset:{},children:[],hidden:false,value:"",textContent:"",_innerHTML:"",
    setAttribute(k,v){this._attrs[k]=String(v);if(k==="class")String(v).split(/\s+/).forEach(c=>c&&this._classes.add(c));},
    getAttribute(k){return this._attrs[k]===undefined?null:this._attrs[k];},
    removeAttribute(k){delete this._attrs[k];if(k==="class")this._classes.clear();},
    appendChild(c){this.children.push(c);return c;},
    remove(){},focus(){},
    click(){(this._listeners["click"]||[]).slice().forEach(f=>f.call(this,{}));},
    addEventListener(t,f){(this._listeners[t]=this._listeners[t]||[]).push(f);},
    removeEventListener(){},
    querySelector(){return null;},
    querySelectorAll(){return [];},
    closest(){return null;},
    getBoundingClientRect(){return {top:0,left:0,width:0,height:0};},
  };
  el.classList={
    add:(...cs)=>cs.forEach(c=>el._classes.add(c)),
    remove:(...cs)=>cs.forEach(c=>el._classes.delete(c)),
    toggle:(c,f)=>{const on=f===undefined?!el._classes.has(c):f;on?el._classes.add(c):el._classes.delete(c);return on;},
    contains:c=>el._classes.has(c),
  };
  Object.defineProperty(el,"innerHTML",{get(){return el._innerHTML;},set(v){el._innerHTML=String(v);}});
  if(opts)Object.assign(el,opts);
  return el;
}
/* localStorage factice, partagé entre les "sessions" pour tester la persistance */
const lsData=new Map();
const localStorage={
  getItem:k=>lsData.has(k)?lsData.get(k):null,
  setItem:(k,v)=>{lsData.set(k,String(v));},
  removeItem:k=>lsData.delete(k),
};
function buildEnv(){
  const tb={auto:makeEl({dataset:{themePick:"auto"}}),light:makeEl({dataset:{themePick:"light"}}),dark:makeEl({dataset:{themePick:"dark"}})};
  const byId={};
  const chip=makeEl();chip._classes.add("chip");
  byId.tScore=makeEl();byId.tScore.closest=()=>chip;
  const document={
    documentElement:makeEl(),
    body:makeEl(),
    createElement:t=>makeEl(),
    querySelector(sel){const id=String(sel).replace(/^#/,"");if(byId[id])return byId[id];byId[id]=makeEl();return byId[id];},
    querySelectorAll(sel){
      if(sel===".theme-btn")return [tb.auto,tb.light,tb.dark];
      if(sel===".seg-btn")return [makeEl({dataset:{lvl:"facile"}}),makeEl({dataset:{lvl:"moyen"}}),makeEl({dataset:{lvl:"difficile"}})];
      return [];
    },
  };
  const sandbox={
    document,localStorage,
    setTimeout:(fn,ms)=>0,clearTimeout:()=>{},
    setInterval:()=>0,clearInterval:()=>{}, /* stubs inoffensifs — l'app ne possède plus de timer (mode sprint retiré) */
    requestAnimationFrame:fn=>0,
    matchMedia:()=>({matches:false,media:""}),
    /* Détection d'interface (detectUI) : desktop par défaut ; les sections
       qui testent « téléphone »/« tablette » écrasent ces trois valeurs. */
    navigator:{userAgent:"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"},
    innerWidth:1440,
    performance:{now:()=>0},scrollTo:()=>{},
    addEventListener:()=>{},
  };
  sandbox.window=sandbox;
  return {sandbox,document,tb,byId};
}
function runApp(env){
  const ctx=vm.createContext(env.sandbox);
  vm.runInContext(appBlock,ctx);
  return ctx;
}
function savedTheme(){const v=lsData.get("qz_theme");return v==null?null:JSON.parse(v);}

/* ========================================================= */
console.log("\n[1] Syntaxe — compilation des deux blocs <script>");
for(let i=0;i<blocks.length;i++){
  let good=true,msg="";
  try{ new vm.Script(blocks[i]); }catch(e){good=false;msg=e.message;}
  ok("bloc #"+(i+1)+" valide ("+blocks[i].length+" car.)"+(good?"":" — "+msg),good);
}

/* ========================================================= */
console.log("\n[2] Script anti-flash (tête de fichier)");
{
  const el=makeEl();
  vm.runInContext(earlyBlock,vm.createContext({localStorage:{getItem:()=>"\"dark\"",setItem:()=>{},removeItem:()=>{}},document:{documentElement:el}}));
  ok("qz_theme=\"dark\" → data-theme=\"dark\"",el.getAttribute("data-theme")==="dark");
  const el2=makeEl();
  vm.runInContext(earlyBlock,vm.createContext({localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},document:{documentElement:el2}}));
  ok("qz_theme absent → pas d'attribut (auto)",el2.getAttribute("data-theme")===null);
  /* Fallback pré-migration : un "ancien" navigateur n'a QUE l'ancienne clé cz_theme —
     le script anti-flash (qui tourne AVANT le gros script et sa migration) doit la lire. */
  const el3=makeEl();
  vm.runInContext(earlyBlock,vm.createContext({localStorage:{getItem:k=>k==="cz_theme"?"\"dark\"":null,setItem:()=>{},removeItem:()=>{}},document:{documentElement:el3}}));
  ok("seule l'ancienne clé cz_theme présente → data-theme=\"dark\" (fallback anti-flash)",el3.getAttribute("data-theme")==="dark");
}

/* ========================================================= */
console.log("\n[3] Charge initiale — thème par défaut (aucun choix sauvegardé)");
lsData.clear();
{
  const env=buildEnv();runApp(env);
  ok("data-theme absent par défaut (auto)",env.document.documentElement.getAttribute("data-theme")===null);
  ok("bouton « Auto » marqué actif",env.tb.auto.classList.contains("on")===true);
  ok("boutons Clair/Sombre non actifs",env.tb.light.classList.contains("on")===false&&env.tb.dark.classList.contains("on")===false);
  ok("choix persisté = auto",savedTheme()==="auto");
}

/* ========================================================= */
console.log("\n[4] Clic sur les boutons — application + persistance");
{
  const env=buildEnv();runApp(env);
  const doc=env.document.documentElement;
  env.tb.dark.click();
  ok("clic Sombre → data-theme=\"dark\"",doc.getAttribute("data-theme")==="dark");
  ok("clic Sombre → sauvegardé « dark »",savedTheme()==="dark");
  ok("clic Sombre → bouton Sombre actif, autres non",env.tb.dark.classList.contains("on")&&env.tb.auto.classList.contains("on")===false&&env.tb.light.classList.contains("on")===false);

  env.tb.light.click();
  ok("clic Clair → data-theme=\"light\"",doc.getAttribute("data-theme")==="light");
  ok("clic Clair → sauvegardé « light »",savedTheme()==="light");
  ok("clic Clair → bouton Clair actif",env.tb.light.classList.contains("on")===true&&env.tb.dark.classList.contains("on")===false);

  env.tb.auto.click();
  ok("clic Auto → attribut retiré",doc.getAttribute("data-theme")===null);
  ok("clic Auto → sauvegardé « auto »",savedTheme()==="auto");
}

/* ========================================================= */
console.log("\n[5] Rechargement — le choix sauvegardé est réappliqué");
{
  lsData.clear();lsData.set("qz_theme",JSON.stringify("dark")); /* dernière préférence = sombre */
  const env=buildEnv();runApp(env);
  ok("recharge : data-theme=\"dark\" restauré",env.document.documentElement.getAttribute("data-theme")==="dark");
  ok("recharge : bouton Sombre actif",env.tb.dark.classList.contains("on")===true);
}

/* ========================================================= */
console.log("\n[6] Fumigène — confetti() ne plante pas");
{
  const env=buildEnv();runApp(env);
  let threw=false;
  try{ if(typeof env.sandbox.confetti!=="function")throw new Error("confetti() introuvable");
       env.sandbox.confetti(); }
  catch(e){threw=true;console.log("      ("+e.message+")");}
  ok("confetti() est défini et exécute sans erreur",threw===false);
  ok("les confettis sont attachés au <body>",env.document.body.children.length>=1);
}

/* ========================================================= */
console.log("\n=====================================");
/* ========================================================= */
console.log("\n[7] Générateurs — forme des questions, visuels SVG, round-trip localStorage");
{
  lsData.clear();
  const env=buildEnv();
  const ctx=runApp(env);
  /* Les registres et fonctions sont des const du scope global : on passe
     par runInContext (elles ne sont PAS des propriétés de sandbox). */
  const probe=vm.runInContext("({SUBJECTS_MATH,SUBJECTS_PC,SUBJECTS_DE,SUBJECTS_EN,checkAnswer,VIZdraw})",ctx);
  ok("SUBJECTS_MATH, SUBJECTS_PC, SUBJECTS_DE, SUBJECTS_EN, checkAnswer et VIZdraw accessibles",!!(probe.SUBJECTS_MATH&&probe.SUBJECTS_PC&&probe.SUBJECTS_DE&&probe.SUBJECTS_EN&&probe.checkAnswer&&probe.VIZdraw));
  let bad=0,vzbad=0,rtbad=0,qbad=0,checked=0,vizCount=0,qcmGens=0;
  const REGISTERS=[];
  /* 2026-08-23 : la 4ᵉ année maths « experte » passe aussi par le contrat —
     SUBJECTS_PC.experte est undefined → ||[] la saute proprement. */
  for(const y of["seconde","premiere","terminale","experte"])REGISTERS.push(...(probe.SUBJECTS_MATH[y]||[]),...(probe.SUBJECTS_PC[y]||[]));
  REGISTERS.push(...(probe.SUBJECTS_DE||[]),...(probe.SUBJECTS_EN||[]));
  for(const sub of REGISTERS){
    for(let gi=0;gi<sub.gens.length;gi++){
      const g=sub.gens[gi];
      const correctIdx=new Set(); /* indices de la bonne réponse observés (QCM) */
      let choiceDraws=0; /* nb de tirages de type `choice` au niveau (un niveau mélangé n'en produit que peu sur 25) */
      for(let i=0;i<25;i++){
        let q;
        try{q=g.make();}
        catch(e){bad++;console.log("      make() plante "+sub.id+" "+g.lvl+": "+e.message);continue;}
        checked++;
        if(typeof q.prompt!=="string"||!q.prompt||typeof q.explain!=="string"){bad++;console.log("      prompt/explain manquant : "+sub.id);continue;}
        if(q.type==="choice"){
          if(!Array.isArray(q.options)||q.options.length<2||!Number.isInteger(q.correct)||q.correct<0||q.correct>=q.options.length){
            bad++;console.log("      choix invalide : "+sub.id+" "+JSON.stringify(q.options));}
          else{
            /* Contrat QCM (2026-08-20) : options non vides et deux à deux
               distinctes (un leurre identique à la bonne réponse rendrait le
               QCM ambigu), et l'index correct non constant sur les tirages —
               options mélangées via shuf(), un index constant signale un
               générateur non converti au helper qcm(). */
            correctIdx.add(q.correct);choiceDraws++;
            if(!q.options.every(o=>typeof o==="string"&&o.trim()!=="")){qbad++;console.log("      QCM : option vide — "+sub.id+" "+g.lvl);}
            if(new Set(q.options).size!==q.options.length){qbad++;console.log("      QCM : options en double — "+sub.id+" "+g.lvl+" "+JSON.stringify(q.options));}}
        }else if(q.type==="frac"){
          if(!q.answer||!isFinite(q.answer.n)||!isFinite(q.answer.d)||q.answer.d===0){bad++;console.log("      fraction invalide : "+sub.id);continue;}
          if(probe.checkAnswer(q,q.answer.n+"/"+q.answer.d)!==true){bad++;console.log("      checkAnswer rejette sa propre réponse (frac) : "+sub.id);}
          if(probe.checkAnswer(q,String(q.answer.n/q.answer.d))!==true){bad++;console.log("      checkAnswer rejette la forme décimale : "+sub.id);}
        }else if(q.type==="number"){
          if(!isFinite(q.answer)){bad++;console.log("      number invalide : "+sub.id);continue;}
          if(probe.checkAnswer(q,String(q.answer))!==true){bad++;console.log("      checkAnswer rejette sa propre réponse (number) : "+sub.id);}
        }else{bad++;console.log("      type inconnu : "+q.type);}
        if(q.viz){
          vizCount++;
          let vq="",vc="";
          try{vq=probe.VIZdraw(q.viz,"q");vc=probe.VIZdraw(q.viz,"c");}
          catch(e){vzbad++;console.log("      VIZdraw plante : "+sub.id+" "+e.message);continue;}
          if(typeof vq!=="string"||typeof vc!=="string"){vzbad++;console.log("      VIZdraw renvoie un non-string : "+sub.id);}
          else if(q.viz.kind!=="var"&&(vq.indexOf("<svg")===-1||vc.indexOf("<svg")===-1)){
            vzbad++;console.log("      VIZdraw sans <svg> : "+sub.id+" kind="+q.viz.kind);}
          /* Round-trip localStorage : exactement ce que fait le mode révision
             après un rechargement — détecte les fonctions/undefined dans les specs. */
          try{
            const q2=JSON.parse(JSON.stringify(q));
            const vc2=probe.VIZdraw(q2.viz,"c");
            if(q.viz.kind!=="var"&&vc2.indexOf("<svg")===-1){rtbad++;console.log("      round-trip : viz cassé après JSON : "+sub.id);}
            if(q.type==="frac"&&probe.checkAnswer(q2,q2.answer.n+"/"+q2.answer.d)!==true){rtbad++;console.log("      round-trip : checkAnswer cassé : "+sub.id);}
          }catch(e){rtbad++;console.log("      round-trip plante : "+sub.id+": "+e.message);}
        }
      }
      if(correctIdx.size>0){
        /* Signature d'un générateur QCM FIGÉ (index correct constant, non converti
           au helper qcm()/shuf) : on ne conclut que sur un échantillon suffisant
           de tirages `choice` (≥ 8). Un niveau mélangé (number/frac + 1 QCM) n'a
           qu'une poignée de `choice` sur 25 tirages — un échantillon de 1 ne peut
           pas distinguer « figé » de « mélangé », d'où l'ancien faux positif.
           Sur ≥ 8 tirages QCM, un index mélangé aurait déjà varié ((1/n)^7 ≈ 0). */
        qcmGens++;
        if(choiceDraws>=8&&correctIdx.size<2){qbad++;console.log("      QCM : index correct constant sur "+choiceDraws+" tirages QCM — "+sub.id+" "+g.lvl);}
      }
    }
  }
  ok("tous les générateurs produisent des questions valides ("+checked+" générées, "+REGISTERS.length+" thèmes)",bad===0);
  ok("QCM : options non vides et distinctes, bonne réponse jamais en position fixe ("+qcmGens+" générateurs)",qbad===0);
  ok("tous les visuels se dessinent en phase question ET correction ("+vizCount+" questions visuelles)",vzbad===0);
  ok("questions + visuels survivent au round-trip localStorage (mode révision)",rtbad===0);
}

/* ========================================================= */
console.log("\n[8] Bascule de matière — les stats maths doivent rester intactes");
{
  lsData.clear();
  const mathsSeed={ans:12,good:9,bestStreak:4,bestSprint:80,bySub:{deriv:{ans:5,good:4}},skips:2,streakBySub:{deriv:3},history:[{s:"deriv",l:"facile",o:1},{s:"deriv",l:"moyen",o:0}],review:[],respTimes:[]};
  lsData.set("qz_stats",JSON.stringify(mathsSeed));
  const env=buildEnv();
  const ctx=runApp(env);
  const mathsBefore=lsData.get("qz_stats");
  const api=vm.runInContext("({setMatiere,startFree,statsNow:()=>stats,okAns:()=>afterAnswer(true,state.q,'')})",ctx);
  api.setMatiere("pc");
  ok("qz_subject persisté = pc",lsData.get("qz_subject")==='"pc"');
  api.startFree();
  api.okAns(); /* répond « juste » à la question PC courante */
  const pcRaw=lsData.get("qz_stats_pc");
  ok("qz_stats (maths) bit-à-bit inchangé après la réponse PC",lsData.get("qz_stats")===mathsBefore);
  ok("qz_stats_pc existe et a été incrémenté (1 réponse, 1 bonne)",pcRaw&&JSON.parse(pcRaw).ans===1&&JSON.parse(pcRaw).good===1);
  api.setMatiere("maths");
  ok("retour maths : stats restaurées à l'identique (deep-compare)",JSON.stringify(api.statsNow())===JSON.stringify(mathsSeed));
  ok("qz_stats (maths) toujours bit-à-bit inchangé",lsData.get("qz_stats")===mathsBefore);
}

/* ========================================================= */
console.log("\n[9] Bascule de matière — câblage (régression : <html> jamais ciblé)");
{
  /* État réel reproduit : page ouverte en PC → l'anti-flash a posé
     data-mat="pc" sur <html>. Un sélecteur [data-mat] (sans .seg-btn)
     inclurait <html> dans querySelectorAll et lui attacherait un listener
     click : tout clic « Maths » rebasculait alors sur PC par bulle d'événement.
     Le DOM factice ne simule pas la bulle — c'est pour ça que l'assertion
     porte sur le listener lui-même, pas sur le comportement en cascade. */
  lsData.clear();
  lsData.set("qz_subject","\"pc\""); /* page ouverte en PC */
  const env=buildEnv();
  const doc=env.document.documentElement;
  doc.setAttribute("data-mat","pc"); /* ce que l'anti-flash fait au chargement */
  const segM=makeEl({dataset:{mat:"maths"}});segM._classes.add("seg-btn");
  const segP=makeEl({dataset:{mat:"pc"}});segP._classes.add("seg-btn");
  const qsa0=env.document.querySelectorAll;
  env.document.querySelectorAll=function(sel){
    if(sel==="[data-mat]")return [doc,segM,segP]; /* = comportement du navigateur réel */
    if(sel===".seg-btn[data-mat]")return [segM,segP];
    return qsa0.call(this,sel);
  };
  env.sandbox.matchMedia=q=>({matches:q.indexOf("reduce")!==-1,media:q}); /* reduced-motion → swap synchrone, assertable */
  const ctx=runApp(env);
  ok("état initial = pc (page ouverte en PC)",vm.runInContext("state.matiere",ctx)==="pc");
  ok("bouton « Maths » a un listener click",Array.isArray(segM._listeners["click"])&&segM._listeners["click"].length===1);
  ok("bouton « Physique-Chimie » a un listener click",Array.isArray(segP._listeners["click"])&&segP._listeners["click"].length===1);
  ok("<html> n'a AUCUN listener click (sélecteur [data-mat] trop large)",!(doc._listeners["click"]&&doc._listeners["click"].length>0));
  /* Le timer de retrait de boot (2800 ms) ne « fire » jamais dans le DOM factice
     (setTimeout stub) : on simule manuellement le retrait post-chargement,
     sinon l'assertion ci-dessous passerait même si swap() ne ré-armed rien. */
  doc._classes.delete("boot");
  ok("pré-condition : boot retiré après le chargement (état simulé)",!doc._classes.has("boot"));
  segM.click();
  ok("clic « Maths » → state.matiere = maths",vm.runInContext("state.matiere",ctx)==="maths");
  ok("clic « Maths » → data-mat retiré de <html> (violet désactivé)",doc.getAttribute("data-mat")===null);
  ok("clic « Maths » → cascade d'arrivée réarmée (html.boot, animation de chargement rejouée)",doc._classes.has("boot"));
}

/* ========================================================= */
console.log("\n[10] Bascule EN PLEINE cascade — animation UNIQUE (seule la dernière survit)");
{
  /* Scénario réel : bascule de matière peu après le chargement, alors que la
     cascade initiale (classe boot + timer de retrait 2800 ms) est ENCORE en
     cours. Contrairement à [9], on ne simule PAS « boot retiré » avant le
     clic : l'état réel (boot active) est conservé. Avant le fix :
       (a) classList.add("boot") était un no-op (classe déjà présente)
           → la cascade ne se rejouait pas ;
       (b) le timer ANONYME du premier chargement, jamais annulé, retirait
           boot à T+2800 ms et coupait la « nouvelle » cascade.
     D'où l'animation « différente selon l'intervalle » de la bascule. */
  lsData.clear();
  lsData.set("qz_subject","\"pc\""); /* page ouverte en PC */
  const env=buildEnv();
  const doc=env.document.documentElement;
  doc.setAttribute("data-mat","pc");
  const segM=makeEl({dataset:{mat:"maths"}});segM._classes.add("seg-btn");
  const segP=makeEl({dataset:{mat:"pc"}});segP._classes.add("seg-btn");
  const qsa0=env.document.querySelectorAll;
  env.document.querySelectorAll=function(sel){
    if(sel===".seg-btn[data-mat]")return [segM,segP];
    return qsa0.call(this,sel);
  };
  env.sandbox.matchMedia=q=>({matches:q.indexOf("reduce")!==-1,media:q}); /* swap synchrone, assertable */
  /* Timers SUIVIS (annulables) : le stub de buildEnv ((fn,ms)=>0) ne permet
     ni d'annuler un timer ni de « faire avancer le temps » pour exécuter les
     callbacks. */
  const timers=new Map();let tid=0;
  env.sandbox.setTimeout=(fn,ms)=>{timers.set(++tid,{fn,ms,cancelled:false});return tid;};
  env.sandbox.clearTimeout=id=>{const t=timers.get(id);if(t)t.cancelled=true;};
  /* Journal des opérations de classe sur <html> : le retrait PUIS réajout de
     « boot » est la seule façon de redémarrer l'animation CSS. */
  const log=[];
  const cAdd=doc.classList.add,cRemove=doc.classList.remove;
  doc.classList.add=(...cs)=>{log.push(["add",...cs]);return cAdd(...cs);};
  doc.classList.remove=(...cs)=>{log.push(["remove",...cs]);return cRemove(...cs);};
  const ctx=runApp(env);
  ok("première visite : boot active + 1 timer de retrait (2800 ms) armé",
     doc._classes.has("boot")&&[...timers.values()].some(t=>t.ms===2800&&!t.cancelled));
  const armedBefore=new Set(timers.keys()); /* timers armés AVANT le clic */
  segM.click();
  ok("clic « Maths » → matière basculée",vm.runInContext("state.matiere",ctx)==="maths");
  const ri=log.findIndex(e=>e[0]==="remove"&&e[1]==="boot");
  ok("cascade REJOUÉE : boot retirée puis réajoutée (animation CSS redémarrée)",
     ri!==-1&&log.slice(ri+1).some(e=>e[0]==="add"&&e[1]==="boot"));
  ok("UN SEUL timer de retrait boot vivant (le précédent est annulé)",
     [...timers.values()].filter(t=>t.ms===2800&&!t.cancelled).length===1);
  /* Fait « avancer le temps » jusqu'au T+2800 ms du PREMIER chargement : si le
     timer anonyme n'avait pas été annulé, il retire boot ici et coupe la
     nouvelle cascade (les éléments non encore révélés apparaissent d'un coup). */
  for(const id of armedBefore){const t=timers.get(id);if(t.ms===2800&&!t.cancelled)t.fn();}
  ok("T+2800 ms du chargement : boot toujours présente (cascade non coupée)",doc._classes.has("boot"));
}

/* ========================================================= */
console.log("\n[11] Bascule — PAS de temps mort : swap IMMÉDIAT au clic");
{
  /* Avant le fix : hors prefers-reduced-motion, la bascule attendait la phase
     de sortie « home-out » (230 ms) avant de swaper — un « temps mort » entre
     le clic et le déclenchement de la cascade. Après le fix : le swap (et
     donc rearmBoot) se joue SYNCHRONEMENT au clic, reduced ou non.
     Ici matchMedia = défaut de buildEnv (matches:false → NON reduced) : sur le
     vieux code, le setTimeout(…,230) est stubbé (ne fire jamais) → le swap
     n'est jamais exécuté → data-mat reste « pc » et home-out est posé. */
  lsData.clear();
  lsData.set("qz_subject","\"pc\"");
  const env=buildEnv(); /* matchMedia par défaut : matches:false (non reduced) */
  const doc=env.document.documentElement;
  doc.setAttribute("data-mat","pc");
  const segM=makeEl({dataset:{mat:"maths"}});segM._classes.add("seg-btn");
  const segP=makeEl({dataset:{mat:"pc"}});segP._classes.add("seg-btn");
  const qsa0=env.document.querySelectorAll;
  env.document.querySelectorAll=function(sel){
    if(sel===".seg-btn[data-mat]")return [segM,segP];
    return qsa0.call(this,sel);
  };
  const ctx=runApp(env);
  ok("première visite : pas de compression (--boot-k absent, délais complets)",doc.style["--boot-k"]===undefined);
  segM.click();
  ok("clic (non reduced) → swap SYNCHRONE : matière basculée immédiatement",vm.runInContext("state.matiere",ctx)==="maths");
  ok("clic (non reduced) → data-mat retiré immédiatement (pas d'attente 230 ms)",doc.getAttribute("data-mat")===null);
  ok("clic (non reduced) → cascade réarmée immédiatement (boot active)",doc._classes.has("boot"));
  const homeEl=env.byId.home;
  ok("plus de classes home-out/home-in sur #home (chorégraphie de sortie supprimée)",
     !homeEl||(homeEl._classes.has("home-out")===false&&homeEl._classes.has("home-in")===false));
  ok("clic → délais de cascade compressés (--boot-k=.45) : le 1er mouvement part quasi immédiatement",
     doc.style["--boot-k"]===".45");
}

/* ========================================================= */
console.log("\n[12] Bascule DE — les stats maths ET PC doivent rester intactes");
{
  /* Miroir exact de [8] pour la 3e matière, avec deux renforcements :
     - les stats PC aussi doivent rester bit-à-bit (avant : seule la clé maths
       était gardée en référence) ;
     - l'allemand est 100 % QCM → on répond par le VRAI chemin moteur,
       answerChoice(), et non pas aprèsAnswer() direct : le bon choix (index
       q.correct) doit être accepté, et sur la bonne réponse btn n'est jamais
       touché (guard if(!ok)) → on peut passer null. */
  lsData.clear();
  const mathsSeed={ans:12,good:9,bestStreak:4,bestSprint:80,bySub:{deriv:{ans:5,good:4}},skips:2,streakBySub:{deriv:3},history:[{s:"deriv",l:"facile",o:1}],review:[],respTimes:[]};
  const pcSeed={ans:7,good:3,bySub:{newton:{ans:2,good:1}}};
  lsData.set("qz_stats",JSON.stringify(mathsSeed));
  lsData.set("qz_stats_pc",JSON.stringify(pcSeed));
  const env=buildEnv();
  const optBtns=[0,1,2,3].map(i=>{const b=makeEl();b.dataset.i=String(i);b._classes.add("opt");return b;});
  env.byId.qbox=makeEl({querySelectorAll:sel=>sel===".opt"?optBtns:[]});
  const ctx=runApp(env);
  const mathsBefore=lsData.get("qz_stats");
  const pcBefore=lsData.get("qz_stats_pc");
  const api=vm.runInContext("({setMatiere,startFree,statsNow:()=>stats,choiceOk:()=>answerChoice(state.q.correct,null)})",ctx);
  api.setMatiere("de");
  ok("qz_subject persisté = de",lsData.get("qz_subject")==='"de"');
  ok("le mode « Sprint » n'existe plus (plus de #secSprint dans le DOM)",!env.byId.secSprint);
  api.startFree();
  ok("la question DE est bien un QCM (type choice)",vm.runInContext("state.q.type",ctx)==="choice");
  api.choiceOk(); /* répond par le chemin moteur : l'option q.correct doit être acceptée */
  const deRaw=lsData.get("qz_stats_de");
  ok("qz_stats (maths) bit-à-bit inchangé après la réponse DE",lsData.get("qz_stats")===mathsBefore);
  ok("qz_stats_pc bit-à-bit inchangé après la réponse DE",lsData.get("qz_stats_pc")===pcBefore);
  ok("qz_stats_de existe et a été incrémenté (1 réponse, 1 bonne)",deRaw&&JSON.parse(deRaw).ans===1&&JSON.parse(deRaw).good===1);
  api.setMatiere("maths");
  ok("retour maths : stats restaurées à l'identique (deep-compare)",JSON.stringify(api.statsNow())===JSON.stringify(mathsSeed));
  ok("qz_stats (maths) toujours bit-à-bit inchangé",lsData.get("qz_stats")===mathsBefore);
}

/* ========================================================= */
console.log("\n[13] Basculeur 4 matières — câblage (4 boutons, <html> jamais ciblé)");
{
  /* Même garde-fou que [9], étendu à la 4e matière : un sélecteur [data-mat]
     sans .seg-btn inclurait <html> (qui porte data-mat en PC, en DE et en EN)
     et lui attacherait un listener click — le DOM factice ne simule pas la
     bulle, l'assertion porte donc sur le listener lui-même. */
  lsData.clear();
  lsData.set("qz_subject","\"de\""); /* page ouverte en allemand */
  const env=buildEnv();
  const doc=env.document.documentElement;
  doc.setAttribute("data-mat","de"); /* ce que l'anti-flash fait au chargement */
  const segM=makeEl({dataset:{mat:"maths"}});segM._classes.add("seg-btn");
  const segP=makeEl({dataset:{mat:"pc"}});segP._classes.add("seg-btn");
  const segD=makeEl({dataset:{mat:"de"}});segD._classes.add("seg-btn");
  const segE=makeEl({dataset:{mat:"en"}});segE._classes.add("seg-btn");
  const qsa0=env.document.querySelectorAll;
  env.document.querySelectorAll=function(sel){
    if(sel==="[data-mat]")return [doc,segM,segP,segD,segE]; /* = comportement du navigateur réel */
    if(sel===".seg-btn[data-mat]")return [segM,segP,segD,segE];
    return qsa0.call(this,sel);
  };
  const ctx=runApp(env);
  ok("état initial = de (page ouverte en allemand)",vm.runInContext("state.matiere",ctx)==="de");
  ok("bouton « Maths » a un listener click",Array.isArray(segM._listeners["click"])&&segM._listeners["click"].length===1);
  ok("bouton « Physique-Chimie » a un listener click",Array.isArray(segP._listeners["click"])&&segP._listeners["click"].length===1);
  ok("bouton « Allemand » a un listener click",Array.isArray(segD._listeners["click"])&&segD._listeners["click"].length===1);
  ok("bouton « Anglais » a un listener click",Array.isArray(segE._listeners["click"])&&segE._listeners["click"].length===1);
  ok("<html> n'a AUCUN listener click (sélecteur [data-mat] trop large)",!(doc._listeners["click"]&&doc._listeners["click"].length>0));
  /* Le timer de retrait de boot (2800 ms) ne « fire » jamais dans le DOM
     factice (setTimeout stub) : on simule le retrait post-chargement, sinon
     l'assertion ci-dessous passerait même si rearmBoot ne ré-armed rien. */
  doc._classes.delete("boot");
  ok("pré-condition : boot retiré après le chargement (état simulé)",!doc._classes.has("boot"));
  segM.click();
  ok("clic « Maths » → state.matiere = maths",vm.runInContext("state.matiere",ctx)==="maths");
  ok("clic « Maths » → data-mat retiré de <html> (accent vert désactivé)",doc.getAttribute("data-mat")===null);
  ok("clic « Maths » → cascade d'arrivée réarmée (html.boot)",doc._classes.has("boot"));
  segD.click();
  ok("clic « Allemand » → data-mat=\"de\" posé sur <html> (accent vert activé)",doc.getAttribute("data-mat")==="de");
  ok("bouton « Allemand » actif, les trois autres non",segD.classList.contains("on")&&segM.classList.contains("on")===false&&segP.classList.contains("on")===false&&segE.classList.contains("on")===false);
  segE.click();
  ok("clic « Anglais » → data-mat=\"en\" posé sur <html> (accent rouge activé)",doc.getAttribute("data-mat")==="en");
  ok("bouton « Anglais » actif, les trois autres non",segE.classList.contains("on")&&segM.classList.contains("on")===false&&segP.classList.contains("on")===false&&segD.classList.contains("on")===false);
}

/* ========================================================= */
console.log("\n[14] Mode « Sprint » retiré — absent du DOM et du code");
{
  /* 2026-08-22 (sur demande) : la fonctionnalité « Sprint 60 s » est retirée de
     l'application (HTML, JS, tests, docs). Le DOM factice auto-crée tout #id
     référencé : l'assertion porte donc sur env.byId — si le code de l'app
     référençait encore #secSprint/#btnSprint, l'entrée apparaîtrait ici. */
  lsData.clear();
  const env=buildEnv();
  const ctx=runApp(env);
  ok("plus de #secSprint dans le DOM (le code ne le référence plus)",!env.byId.secSprint);
  ok("plus de #btnSprint dans le DOM",!env.byId.btnSprint);
  ok("plus de #tTimer dans le DOM (le chrono n'existe plus)",!env.byId.tTimer);
  ok("startSprint n'existe plus dans le code de l'app",vm.runInContext("typeof startSprint",ctx)==="undefined");
  ok("endSprint n'existe plus dans le code de l'app",vm.runInContext("typeof endSprint",ctx)==="undefined");
  ok("state.timer n'existe plus dans l'état de session",vm.runInContext("'timer' in state",ctx)===false);
  for(const m of["de","en","maths","pc"]){
    vm.runInContext("setMatiere('"+m+"')",ctx);
    ok(m+" : aucune référence sprint créée par renderHome",!env.byId.secSprint&&!env.byId.btnSprint);
  }
}

console.log("\n[15] Migration des clés cz_* → qz_* (héritage « CalculZéro »)");
{
  /* Utilisateur "ancien" (CalculZéro) : ses données ne sont que sous les clés cz_*.
     À l'ouverture, l'app doit les porter sur qz_* sans rien perdre ni supprimer. */
  lsData.clear();
  lsData.set("cz_theme",JSON.stringify("dark"));
  lsData.set("cz_subject",JSON.stringify("de"));
  lsData.set("cz_stats",JSON.stringify({ans:12,good:9,skips:2}));
  lsData.set("cz_stats_pc",JSON.stringify({ans:7,good:3,skips:0}));
  lsData.set("cz_stats_de",JSON.stringify({ans:4,good:2,skips:1,history:[{s:"de",l:"facile",o:0}],review:[]}));
  const env=buildEnv();
  const ctx=runApp(env);
  ok("cz_theme → qz_theme (valeur identique)",lsData.get("qz_theme")===lsData.get("cz_theme"));
  ok("cz_subject → qz_subject (valeur identique)",lsData.get("qz_subject")===lsData.get("cz_subject"));
  ok("cz_stats → qz_stats (valeurs ans=12, good=9)",
     (()=>{try{const s=JSON.parse(lsData.get("qz_stats")||"null");return s&&s.ans===12&&s.good===9;}catch(e){return false;}})());
  ok("cz_stats_pc → qz_stats_pc (valeurs ans=7, good=3)",
     (()=>{try{const s=JSON.parse(lsData.get("qz_stats_pc")||"null");return s&&s.ans===7&&s.good===3;}catch(e){return false;}})());
  ok("cz_stats_de → qz_stats_de (valeurs ans=4, good=2)",
     (()=>{try{const s=JSON.parse(lsData.get("qz_stats_de")||"null");return s&&s.ans===4&&s.good===2;}catch(e){return false;}})());
  ok("anciennes clés conservées en secours (aucune donnée supprimée)",
     lsData.has("cz_theme")&&lsData.has("cz_subject")&&lsData.has("cz_stats")&&lsData.has("cz_stats_pc")&&lsData.has("cz_stats_de"));
  ok("thème migré réellement appliqué (data-theme=\"dark\")",
     env.document.documentElement.getAttribute("data-theme")==="dark");
  ok("matière migrée effective (state.matiere=\"de\")",vm.runInContext("state.matiere",ctx)==="de");
  ok("stats allemandes migrees chargées (stats.ans=4)",vm.runInContext("stats.ans",ctx)===4);
  /* Cas 2 : si la nouvelle clé existe déjà, elle gagne — la migration ne l'écrase pas. */
  lsData.clear();
  lsData.set("cz_theme",JSON.stringify("dark"));
  lsData.set("qz_theme",JSON.stringify("light"));
  const env2=buildEnv();
  runApp(env2);
  ok("qz_theme existante → cz_theme ne l'écrase PAS (data-theme=\"light\")",
     env2.document.documentElement.getAttribute("data-theme")==="light");
}

/* ========================================================= */
console.log("\n[16] Suppression « Grandeurs cosmiques » — orphelines purgées au chargement");
{
  /* Utilisateur existant : questions à réviser + historique rattachés au thème « cosmo »,
     retiré du registre PC. À l'ouverture, loadStats() doit les évacuer — sinon renderQ()
     plante sur r.sub.name (sub undefined) et un point faible « cosmo » lancerait un
     thème aléatoire (trainWeak → pickQ, find raté → pick(act)). */
  lsData.clear();
  lsData.set("qz_subject","\"pc\"");
  lsData.set("qz_stats_pc",JSON.stringify({ans:9,good:4,bySub:{cosmo:{ans:3,good:1},newton:{ans:6,good:3}},
    history:[{s:"cosmo",l:"facile",o:0},
             {s:"newton",l:"facile",o:1},{s:"newton",l:"facile",o:0},{s:"newton",l:"moyen",o:1},
             {s:"newton",l:"moyen",o:0},{s:"newton",l:"difficile",o:1},{s:"newton",l:"difficile",o:0},
             {s:"newton",l:"difficile",o:0}],
    review:[{s:"cosmo",l:"facile",q:{prompt:"orpheline",type:"number",answer:1}},
            {s:"newton",l:"moyen",q:{prompt:"vivante",type:"number",answer:2}}]}));
  const env=buildEnv();
  const ctx=runApp(env);
  ok("thème « cosmo » absent du registre THEME_BY_ID",vm.runInContext("THEME_BY_ID['cosmo']",ctx)===undefined);
  ok("question orpheline (cosmo) purgée de la liste à réviser, la vivante reste",
     vm.runInContext("stats.review.length",ctx)===1&&vm.runInContext("stats.review[0].s",ctx)==="newton");
  ok("entrées orphelines (cosmo) purgées de l'historique, newton intacte (7 entrées)",
     vm.runInContext("stats.history.length",ctx)===7&&vm.runInContext("stats.history.some(h=>h.s==='cosmo')",ctx)===false);
}

/* ========================================================= */
console.log("\n[17] Version d'interface — détection auto + persistance (data-ui), sans bascule manuelle");
{
  const phone=(env)=>{env.sandbox.innerWidth=390;env.sandbox.matchMedia=q=>({matches:q.indexOf("coarse")>-1,media:q});env.sandbox.navigator={userAgent:"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"};};
  /* Appareil 1 — ORDINATEUR : souris fine, grand écran, UA desktop → « d ». */
  lsData.clear();
  {
    const env=buildEnv();
    const ctx=runApp(env);
    ok("ordinateur → détecte « d » (version ordinateur)",vm.runInContext("detectUI()",ctx)==="d");
    ok("data-ui ABSENT de <html> (version ordinateur par défaut)",env.document.documentElement.getAttribute("data-ui")===null);
    ok("choix persisté sous qz_ui = \"d\"",lsData.get("qz_ui")==="\"d\"");
  }
  /* Appareil 2 — TÉLÉPHONE : tactile + petit écran + UA mobile → « m ». */
  lsData.clear();
  {
    const env=buildEnv();phone(env);
    const ctx=runApp(env);
    ok("téléphone → détecte « m » (version téléphone)",vm.runInContext("detectUI()",ctx)==="m");
    ok("data-ui=\"m\" posé sur <html>",env.document.documentElement.getAttribute("data-ui")==="m");
    ok("choix persisté sous qz_ui = \"m\"",lsData.get("qz_ui")==="\"m\"");
  }
  /* Appareil 3 — TABLETTE large : tactile MAIS ≥900 px + UA sans « Mobile » → « d ». */
  lsData.clear();
  {
    const env=buildEnv();
    env.sandbox.innerWidth=1024;
    env.sandbox.matchMedia=q=>({matches:q.indexOf("coarse")>-1,media:q});
    env.sandbox.navigator={userAgent:"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"};
    const ctx=runApp(env);
    ok("tablette large (1024 px, tactile, UA desktop) → reste « d »",vm.runInContext("detectUI()",ctx)==="d");
  }
  /* Choix EXPLICITE : qz_ui présente → la détection ne décide plus. */
  lsData.clear();
  lsData.set("qz_ui","\"m\"");
  {
    const env=buildEnv();
    env.sandbox.innerWidth=1440; /* grand écran, souris fine… */
    const ctx=runApp(env);
    ok("qz_ui=\"m\" sauvegardée → version téléphone RESTÉE (le choix gagne)",env.document.documentElement.getAttribute("data-ui")==="m");
  }
  /* STABILITÉ : basculer l'UI ne doit JAMAIS écrire dans les 4 stats. */
  lsData.clear();
  lsData.set("qz_stats",JSON.stringify({ans:10,good:8,skips:1,bestSprint:40}));
  lsData.set("qz_stats_pc",JSON.stringify({ans:5,good:2,skips:0}));
  lsData.set("qz_stats_de",JSON.stringify({ans:3,good:3,skips:0}));
  lsData.set("qz_stats_en",JSON.stringify({ans:2,good:1,skips:0}));
  {
    const env=buildEnv();phone(env);
    const ctx=runApp(env);
    const avant={};
    ["qz_stats","qz_stats_pc","qz_stats_de","qz_stats_en"].forEach(k=>avant[k]=lsData.get(k));
    vm.runInContext("setUI('m');setUI('d');setUI('m')",ctx); /* 3 bascules */
    let intact=true;
    ["qz_stats","qz_stats_pc","qz_stats_de","qz_stats_en"].forEach(k=>{if(lsData.get(k)!==avant[k])intact=false;});
    ok("bascules d'UI → les 4 stats bit-à-bit IDENTIQUES",intact);
    ok("bascules d'UI → seule la clé qz_ui a bougé (\"m\")",lsData.get("qz_ui")==="\"m\"");
  }
  /* Anti-flash : le choix doit être appliqué AVANT le premier rendu. */
  {
    const el=makeEl();
    vm.runInContext(earlyBlock,vm.createContext({localStorage:{getItem:k=>k==="qz_ui"?"\"m\"":null,setItem:()=>{},removeItem:()=>{}},document:{documentElement:el}}));
    ok("anti-flash : qz_ui=\"m\" → data-ui=\"m\" posé avant le rendu",el.getAttribute("data-ui")==="m");
    const el2=makeEl();
    vm.runInContext(earlyBlock,vm.createContext({localStorage:{getItem:()=>"\"d\"",setItem:()=>{},removeItem:()=>{}},document:{documentElement:el2}}));
    ok("anti-flash : qz_ui=\"d\" → pas de data-ui",el2.getAttribute("data-ui")===null);
  }
}

/* ========================================================= */
console.log("\n[18] Niveau « Auto » — autoLevel() selon les 8 dernières réponses du thème");
{
  lsData.clear();
  const env=buildEnv();
  const ctx=runApp(env);
  const A=id=>vm.runInContext("autoLevel('"+id+"')",ctx);
  /* moins de 3 réponses → moyen : on ne devine pas une performance qu'on n'a pas. */
  vm.runInContext("stats.history=[{s:'deriv',l:'moyen',o:1}]",ctx);
  ok("1 réponse seulement → « moyen » (perf insuffisante pour deviner)",A("deriv")==="moyen");
  /* <50 % → facile · 50–80 % → moyen · ≥80 % → difficile. */
  vm.runInContext("stats.history=[{s:'deriv',o:0},{s:'deriv',o:1},{s:'deriv',o:0},{s:'deriv',o:0}]",ctx);
  ok("4 réponses, 25 % de réussite → « facile »",A("deriv")==="facile");
  vm.runInContext("stats.history=[{s:'deriv',o:1},{s:'deriv',o:0},{s:'deriv',o:1},{s:'deriv',o:0}]",ctx);
  ok("4 réponses, 50 % de réussite → « moyen » (seuil bas inclus)",A("deriv")==="moyen");
  vm.runInContext("stats.history=[{s:'deriv',o:1},{s:'deriv',o:1},{s:'deriv',o:1},{s:'deriv',o:0}]",ctx);
  ok("4 réponses, 75 % de réussite → « moyen »",A("deriv")==="moyen");
  vm.runInContext("stats.history=[{s:'deriv',o:1},{s:'deriv',o:1},{s:'deriv',o:1},{s:'deriv',o:1}]",ctx);
  ok("4 réponses, 100 % de réussite → « difficile » (≥80 % inclus)",A("deriv")==="difficile");
  /* L'évaluation porte UNIQUEMENT sur ce thème : un autre thème performant n'influe pas. */
  vm.runInContext("stats.history=[{s:'newton',o:1},{s:'newton',o:1},{s:'newton',o:1},{s:'deriv',o:0},{s:'deriv',o:0},{s:'deriv',o:0}]",ctx);
  ok("par thème : newton 100 % n'aide pas deriv (0 %) — facile / difficile",A("deriv")==="facile"&&A("newton")==="difficile");
  /* Seules les 8 DERNIÈRES réponses comptent : 5 fautes anciennes tombent hors fenêtre. */
  vm.runInContext("stats.history=[{s:'deriv',o:0},{s:'deriv',o:0},{s:'deriv',o:0},{s:'deriv',o:0},{s:'deriv',o:0},{s:'deriv',o:1},{s:'deriv',o:1},{s:'deriv',o:1},{s:'deriv',o:1},{s:'deriv',o:1},{s:'deriv',o:1},{s:'deriv',o:1},{s:'deriv',o:1}]",ctx);
  ok("fenêtre glissante : les 5 fautes anciennes sortent du calcul (8/8 → difficile)",A("deriv")==="difficile");
}

/* ========================================================= */
console.log("\n[19] Répétition espacée — échéance, graduation, migration des anciens items");
{
  /* Migration : un utilisateur EXISTANT a des items sans due/reps → dus au 1er chargement. */
  lsData.clear();
  {
    lsData.set("qz_subject",JSON.stringify("maths"));
    lsData.set("qz_stats",JSON.stringify({ans:5,good:3,history:[],review:[{s:"deriv",l:"moyen",q:{prompt:"vieux",type:"number",answer:1}}]}));
    const env=buildEnv();const ctx=runApp(env);
    const it=vm.runInContext("stats.review[0]",ctx);
    ok("migration : ancien item (sans due/reps) → due=0 (dû au 1er chargement), reps=0",it.due===0&&it.reps===0);
  }
  /* Comportement : ajout, avancée, remise, graduation. */
  lsData.clear();
  {
    const env=buildEnv();const ctx=runApp(env);
    const R=()=>vm.runInContext("stats.review",ctx);
    const DAY=vm.runInContext("DAY",ctx);
    /* Les objets sont INLINÉS dans l'expression vm (le scope Node n'y est pas visible).
       Même littéral = même qKey (JSON.stringify) → advance/reset retrouvent l'item. */
    const QN="{prompt:'n',type:'number',answer:2}";
    vm.runInContext("reviewAdd('deriv','moyen',"+QN+")",ctx);
    let it=R()[0];
    ok("reviewAdd → l'item entre avec due=0, reps=0 (dû immédiatement)",R().length===1&&it.due===0&&it.reps===0);
    ok("reviewDueCount() = 1 (dû maintenant)",vm.runInContext("reviewDueCount()",ctx)===1);
    const now0=vm.runInContext("Date.now()",ctx);
    vm.runInContext("reviewAdvance("+QN+")",ctx);
    it=R()[0];
    ok("reviewAdvance #1 → reps=1, due ≈ +1 j (REVIEW_LADDER[1])",it.reps===1&&Math.abs((it.due-now0)-DAY)<5000);
    ok("après 1 avancée → plus « dû » (due>now) → reviewDueCount()=0",vm.runInContext("reviewDueCount()",ctx)===0);
    vm.runInContext("reviewReset("+QN+")",ctx);
    it=R()[0];const now1=vm.runInContext("Date.now()",ctx);
    ok("reviewReset → reps remis à 0, due ≈ +1 j",it.reps===0&&Math.abs((it.due-now1)-DAY)<5000);
    /* Graduation : 4 réussites = conservé, 5e = l'item ACQUIS (quitte la liste). */
    vm.runInContext("stats.review=[]",ctx);
    const QG="{prompt:'g',type:'number',answer:3}";
    vm.runInContext("reviewAdd('deriv','moyen',"+QG+")",ctx);
    ok("pré-condition graduation : 1 item dans la liste",R().length===1);
    for(let i=0;i<4;i++)vm.runInContext("reviewAdvance("+QG+")",ctx);
    ok("après 4 réussites d'affilée → encore présent (seuil = 5)",R().length===1);
    vm.runInContext("reviewAdvance("+QG+")",ctx);
    ok("5e réussite → item ACQUIS (quitte la liste)",R().length===0);
  }
}

/* ========================================================= */
console.log("\n[20] Câblage afterAnswer → répétition espacée (mode libre + révision)");
{
  const DAY=86400000;
  /* --- MODE LIBRE : mauvaise réponse → l'item entre, bonne réponse → il sort --- */
  lsData.clear();
  {
    const env=buildEnv();const ctx=runApp(env);
    vm.runInContext("startFree()",ctx);
    vm.runInContext("afterAnswer(false,state.q,state.curLvl)",ctx);
    const R=vm.runInContext("stats.review",ctx);
    ok("libre, mauvaise réponse → reviewAdd (1 item, due=0, reps=0)",R.length===1&&R[0].due===0&&R[0].reps===0);
    vm.runInContext("afterAnswer(true,state.q,state.curLvl)",ctx);
    ok("libre, bonne réponse → reviewRemove (liste redevient vide)",vm.runInContext("stats.review.length",ctx)===0);
  }
  /* --- MODE RÉVISION, mauvaise réponse → reviewReset (reps=0, due≈+1 j, CONSERVÉ) --- */
  lsData.clear();
  {
    const env=buildEnv();const ctx=runApp(env);
    vm.runInContext("stats.review=[{s:'deriv',l:'moyen',q:{prompt:'rv',type:'number',answer:7},reps:2,due:0}]",ctx);
    vm.runInContext("startReview()",ctx);
    ok("révision : la question rendue est l'item échue (due=0)",vm.runInContext("state.q.prompt",ctx)==="rv");
    /* 2026-08-22 : le compteur = questions ÉCHUES (la session ne sert que
       reviewDue()), pas la liste totale (50 max) qui inclut les replanifiées. */
    ok("révision : le compteur affiche « 1 restant(s) » = les questions échues",
       env.document.querySelector("#qCount").textContent==="1 restant(s)");
    vm.runInContext("afterAnswer(false,state.q,state.curLvl)",ctx);
    const R=vm.runInContext("stats.review",ctx),now=vm.runInContext("Date.now()",ctx);
    ok("révision, mauvaise réponse → reviewReset (reps=0, due≈+1 j, item conservé)",
       R.length===1&&R[0].reps===0&&R[0].due>now-1000&&R[0].due<=now+DAY+5000);
  }
  /* --- COMPTEUR : liste de 2 (1 échue + 1 replanifiée demain) → « 1 restant(s) ».
     Discriminant : l'ancien code affichait stats.review.length (=2), pas les échues. --- */
  lsData.clear();
  {
    const env=buildEnv();const ctx=runApp(env);
    vm.runInContext("stats.review=[{s:'deriv',l:'moyen',q:{prompt:'due',type:'number',answer:1},reps:0,due:0},{s:'deriv',l:'difficile',q:{prompt:'future',type:'number',answer:2},reps:1,due:Date.now()+86400000}]",ctx);
    vm.runInContext("startReview()",ctx);
    ok("2 items (1 échue + 1 replanifiée) → le compteur affiche « 1 restant(s) », pas 2",
       env.document.querySelector("#qCount").textContent==="1 restant(s)");
  }
  /* --- MODE RÉVISION, bonne réponse → reviewAdvance (reps s'élève, due s'éloigne) --- */
  lsData.clear();
  {
    const env=buildEnv();const ctx=runApp(env);
    vm.runInContext("stats.review=[{s:'deriv',l:'moyen',q:{prompt:'rv2',type:'number',answer:8},reps:3,due:0}]",ctx);
    vm.runInContext("startReview()",ctx);
    vm.runInContext("afterAnswer(true,state.q,state.curLvl)",ctx);
    const R=vm.runInContext("stats.review",ctx),now=vm.runInContext("Date.now()",ctx);
    ok("révision, bonne réponse → reviewAdvance (reps 3→4, due repoussée plus loin)",
       R.length===1&&R[0].reps===4&&R[0].due>now);
  }
}

/* ========================================================= */
console.log("\n[21] Dédup QCM — même question mélangée = UNE seule entrée");
{
  /* 2026-08-22, évaluation qualitative : qKey était JSON.stringify(q) — or les
     options des QCM sont mélangées à chaque tirage, donc la même question
     pédagogique produisait plusieurs entrées (et une bonne réponse ne la
     retirait presque jamais : l'ordre des options avait changé depuis l'ajout).
     La clé stable compare le CONTENU : prompt + options TRIÉES + bonne réponse. */
  lsData.clear();
  const env=buildEnv();const ctx=runApp(env);
  const A={prompt:"Choisis la phrase correcte.",type:"choice",correct:0,
           options:["Ich gebe Marie das Buch.","Ich gebe die Marie das Buch.","Ich gebe das Buch Marie geben.","Ich gebe Marie die Buch."],
           explain:"« geben » + datif ; la chose à l'accusatif"};
  const B={prompt:"Choisis la phrase correcte.",type:"choice",correct:1,
           options:["Ich gebe das Buch Marie geben.","Ich gebe Marie das Buch.","Ich gebe die Marie das Buch.","Ich gebe Marie die Buch."],
           explain:"« geben » + datif ; la chose à l'accusatif"};
  const C={prompt:"Une autre question.",type:"choice",correct:0,options:["a","b","c","d"],explain:"x"};
  vm.runInContext("reviewAdd('de','moyen',"+JSON.stringify(A)+")",ctx);
  vm.runInContext("reviewAdd('de','moyen',"+JSON.stringify(B)+")",ctx);
  vm.runInContext("reviewAdd('de','moyen',"+JSON.stringify(C)+")",ctx);
  let R=vm.runInContext("stats.review",ctx);
  ok("A + B (même question, deux ordres) + C (différente) → 2 entrées, pas 3",R.length===2);
  vm.runInContext("reviewRemove("+JSON.stringify(B)+")",ctx);
  R=vm.runInContext("stats.review",ctx);
  ok("bonne réponse sur B → retire l'entrée ajoutée via A (ordre mélangé), il reste C",
     R.length===1&&R[0].q.prompt==="Une autre question.");
  vm.runInContext("reviewRemove("+JSON.stringify(C)+")",ctx);
  vm.runInContext("reviewAdd('de','moyen',"+JSON.stringify(A)+")",ctx);
  vm.runInContext("reviewAdvance("+JSON.stringify(B)+")",ctx);
  R=vm.runInContext("stats.review",ctx);
  ok("reviewAdvance (ordre B) retrouve l'entrée ajoutée via A (reps=1)",
     R.length===1&&R[0].reps===1);
}

/* ========================================================= */
console.log("\n[22] Points faibles — fenêtre des 50 dernières + ex æquo");
{
  /* 2026-08-24, Cid : le panneau se base sur les 50 DERNIÈRES réponses
     (élargi des 10 aux 50 — le moment présent, plus de matière), minimum
     3 réponses/cellule.
     [22a] « xx » (51 réponses, ≈ 2 %) est la moins précise de TOUTES les 101 —
     mais elle est sortie de la fenêtre des 50 → elle ne doit PAS apparaître.
     « aa » (40 %) devant « bb » (48 %), toutes deux dans la fenêtre.
     [22b] (régression 2026-08-22) ex æquo : la cellule la plus entraînée
     gagne — le tiebreaker doit rester actif (pas un comparateur NaN mort). */
  lsData.clear();
  const env=buildEnv();const ctx=runApp(env);
  const hist=[];
  for(let i=0;i<51;i++)hist.push({s:"xx",l:"moyen",o:i===0?1:0}); /* ≈ 2 % — avant la fenêtre */
  for(let i=0;i<25;i++)hist.push({s:"bb",l:"moyen",o:i<12?1:0});  /* 48 % — dans la fenêtre */
  for(let i=0;i<25;i++)hist.push({s:"aa",l:"facile",o:i<10?1:0}); /* 40 % — dans la fenêtre */
  vm.runInContext("stats.history="+JSON.stringify(hist),ctx);
  let W=vm.runInContext("weakPoints()",ctx);
  ok("fenêtre 50 : « xx » (hors fenêtre) ABSENTE du panneau",W.every(x=>x.s!=="xx"));
  ok("« aa » (40 %) devant « bb » (48 %)",W.length===2&&W[0].s==="aa"&&W[1].s==="bb");
  /* [22b] ex æquo 50 % : « bb » (6 réponses) devant « aa » (4 réponses) */
  const hist2=[];
  for(let i=0;i<4;i++)hist2.push({s:"aa",l:"facile",o:i<2?1:0});
  for(let i=0;i<6;i++)hist2.push({s:"bb",l:"moyen",o:i<3?1:0});
  vm.runInContext("stats.history="+JSON.stringify(hist2),ctx);
  W=vm.runInContext("weakPoints()",ctx);
  ok("ex æquo 50 % : « bb » (6 réponses) devant « aa » (4 réponses)",
     W.length===2&&W[0].s==="bb"&&W[1].s==="aa");
}

/* ========================================================= */
console.log("\n[23] Bascule EN — stats intactes, qz_stats_en, libellés A2 / A2+ / B1");
{
  /* 4e matière (anglais) : miroir exact de [12] (stats bit-à-bit + vrai
     chemin moteur answerChoice() sur un QCM) — plus les libellés de niveau
     CECRL : pour de/en, lvlLabel() mappe les CLÉS internes
     facile/moyen/difficile sur A2/A2+/B1, maths/PC gardent
     Facile/Moyen/Difficile. Les clés internes ne changent pas — c'est ce qui
     rend les stats persistées d'avant migration toujours valides. */
  lsData.clear();
  const mathsSeed={ans:12,good:9,bestStreak:4,bestSprint:80,bySub:{deriv:{ans:5,good:4}},skips:2,streakBySub:{deriv:3},history:[{s:"deriv",l:"facile",o:1}],review:[],respTimes:[]};
  const deSeed={ans:4,good:2,bySub:{vocab:{ans:2,good:1}}};
  lsData.set("qz_stats",JSON.stringify(mathsSeed));
  lsData.set("qz_stats_de",JSON.stringify(deSeed));
  const env=buildEnv();
  const optBtns=[0,1,2,3].map(i=>{const b=makeEl();b.dataset.i=String(i);b._classes.add("opt");return b;});
  env.byId.qbox=makeEl({querySelectorAll:sel=>sel===".opt"?optBtns:[]});
  const ctx=runApp(env);
  const mathsBefore=lsData.get("qz_stats");
  const deBefore=lsData.get("qz_stats_de");
  const doc=env.document.documentElement;
  const api=vm.runInContext("({setMatiere,startFree,statsNow:()=>stats,choiceOk:()=>answerChoice(state.q.correct,null),lvlLabel,lvlNames,paint:paintLvlButtons})",ctx);
  api.setMatiere("en");
  ok("qz_subject persisté = en",lsData.get("qz_subject")==='"en"');
  ok("data-mat=\"en\" posé sur <html> (accent rouge)",doc.getAttribute("data-mat")==="en");
  ok("le mode « Sprint » n'existe plus (plus de #secSprint dans le DOM)",!env.byId.secSprint);
  api.startFree();
  ok("la question EN est bien un QCM (type choice)",vm.runInContext("state.q.type",ctx)==="choice");
  api.choiceOk(); /* répond par le chemin moteur : l'option q.correct doit être acceptée */
  ok("qz_stats (maths) bit-à-bit inchangé après la réponse EN",lsData.get("qz_stats")===mathsBefore);
  ok("qz_stats_de bit-à-bit inchangé après la réponse EN",lsData.get("qz_stats_de")===deBefore);
  const enRaw=lsData.get("qz_stats_en");
  ok("qz_stats_en existe et a été incrémenté (1 réponse, 1 bonne)",enRaw&&JSON.parse(enRaw).ans===1&&JSON.parse(enRaw).good===1);
  ok("niveau anglais : A2 / A2+ / B1",api.lvlLabel("facile")==="A2"&&api.lvlLabel("moyen")==="A2+"&&api.lvlLabel("difficile")==="B1");
  ok("niveau allemand : A2 / A2+ / B1 (idem)",api.lvlLabel("facile")==="A2"&&api.lvlLabel("difficile")==="B1");
  ok("paintLvlButtons() définie (relibellage des tuiles au rendu)",typeof api.paint==="function");
  api.setMatiere("maths");
  ok("retour maths : libellés Facile / Moyen / Difficile",api.lvlLabel("facile")==="Facile"&&api.lvlLabel("moyen")==="Moyen"&&api.lvlLabel("difficile")==="Difficile");
  ok("retour maths : stats restaurées à l'identique (deep-compare)",JSON.stringify(api.statsNow())===JSON.stringify(mathsSeed));
}

/* ========================================================= */
console.log("\n[25] Courbe de niveau — xpCum / levelOf / lvlInfo");
{
  lsData.clear();
  const env=buildEnv();const ctx=runApp(env);
  /* 2026-08-24 (Cid) : l'ancien coût 50·n par niveau ralentissait trop vite —
     nouvelle courbe : coût CONSTANT de 100 XP par palier dans chaque bloc de
     10 niveaux, +25 XP à chaque palier de 10 (xpCum(1)=0, xpCum(2)=100,
     xpCum(11)=1000, xpCum(12)=1125, xpCum(21)=2250, xpCum(22)=2400). */
  const L=x=>vm.runInContext("levelOf("+x+")",ctx);
  ok("0→1, 99→1, 100→2, 199→2, 200→3",L(0)===1&&L(99)===1&&L(100)===2&&L(199)===2&&L(200)===3);
  ok("400→5, 500→6, 899→9, 900→10, 999→10",L(400)===5&&L(500)===6&&L(899)===9&&L(900)===10&&L(999)===10);
  ok("1000→11 (bloc 2), 1124→11, 1125→12, 2249→20, 2250→21, 2399→21, 2400→22",
     L(1000)===11&&L(1124)===11&&L(1125)===12&&L(2249)===20&&L(2250)===21&&L(2399)===21&&L(2400)===22);
  let round=true;
  for(let n=1;n<=100;n++)if(L(vm.runInContext("xpCum("+n+")",ctx))!==n)round=false;
  ok("levelOf(xpCum(n)) = n pour n = 1…100 (allers-retours)",round);
  let mono=true;
  for(let x=0;x<10000;x+=13)if(L(x)>L(x+13))mono=false;
  ok("monotone (0…10000 par pas de 13)",mono);
  let pctOk=true;
  for(let i=0;i<1000;i++){
    const v=vm.runInContext("lvlInfo("+(i*2)+")",ctx);
    if(!(v.n>=1&&v.pct>=0&&v.pct<1))pctOk=false;
  }
  ok("lvlInfo : n ≥ 1 et pct ∈ [0,1[ sur 1000 valeurs d'essai",pctOk);
}

/* ========================================================= */
console.log("\n[26] Raccordement XP — UNE XP PAR MATIÈRE (qz_xp / _pc / _de / _en), 2 modes, palier → levelUp");
{
  /* (2026-08-24, Cid) gainXp() applique le coefficient matière XP_MULT
     (maths/PC ×1.5, DE/EN ×1.2) à TOUS les gains → la valeur créditée est
     Math.round(pts bruts × coefficient). Le SCORE de séance reste brut. */
  const exp=(ctx)=>vm.runInContext("Math.round(((PTS_LVL[state.curLvl]!==undefined?PTS_LVL[state.curLvl]:10)+((state.streak+1)>=3?5:0))*(XP_MULT[state.matiere]||1))",ctx);
  /* --- MODE LIBRE (maths) : ok → +pts exact ; ko → inchangé ; « Passer » → inchangé --- */
  lsData.clear();
  {
    const env=buildEnv();const ctx=runApp(env);
    vm.runInContext("startFree()",ctx);
    const b1=vm.runInContext("getXP()",ctx),e1=exp(ctx);
    vm.runInContext("afterAnswer(true,state.q,'')",ctx);
    ok("libre : bonne réponse → qz_xp (maths) augmente d'EXACTEMENT pts ("+e1+")",vm.runInContext("getXP()",ctx)===b1+e1);
    const b2=vm.runInContext("getXP()",ctx);
    vm.runInContext("afterAnswer(false,state.q,'')",ctx);
    ok("libre : mauvaise réponse → qz_xp inchangé",vm.runInContext("getXP()",ctx)===b2);
    vm.runInContext("renderQ()",ctx);
    const b3=vm.runInContext("getXP()",ctx);
    vm.runInContext("passQ()",ctx);
    ok("libre : « Passer » → qz_xp inchangé (une passe ne compte jamais)",vm.runInContext("getXP()",ctx)===b3);
  }
  /* --- MODE RÉVISION --- */
  lsData.clear();
  {
    const env=buildEnv();const ctx=runApp(env);
    vm.runInContext("stats.review=[{s:'deriv',l:'moyen',q:{prompt:'rv',type:'number',answer:7},reps:0,due:0}]",ctx);
    vm.runInContext("startReview()",ctx);
    const b=vm.runInContext("getXP()",ctx),e=exp(ctx);
    vm.runInContext("afterAnswer(true,state.q,'')",ctx);
    ok("révision : bonne réponse → qz_xp +pts exact",vm.runInContext("getXP()",ctx)===b+e);
  }
  /* --- PALIER : franchissement → levelUp() appelé UNE fois (2026-08-23 :
     l'animation de montée de niveau ; 2026-08-24, Cid : les confettis y sont
     LANCÉS AUSSI — vérifiés dans le bloc suivant, avec le levelUp réel) --- */
  lsData.clear();
  {
    const env=buildEnv();const ctx=runApp(env);
    vm.runInContext("window.__lvlup=0;levelUp=function(){window.__lvlup++;};",ctx);
    vm.runInContext("startFree();store.set('qz_xp',95)",ctx);
    vm.runInContext("afterAnswer(true,state.q,'')",ctx); /* +15 (moyen × 1.5 maths) → 110 ≥ 100 : palier 2 */
    ok("franchissement 95→110 → levelUp() appelé une fois",env.sandbox.__lvlup===1);
    vm.runInContext("afterAnswer(true,state.q,'')",ctx); /* +15 → 125 : pas de palier (niveau 3 = 200) */
    ok("110→125 pas de palier → levelUp non rappelé",env.sandbox.__lvlup===1);
  }
  /* --- CONFETTIS : à la fin de la révision (endReview — le clic « Terminer
     la révision ») — et depuis 2026-08-24 (Cid) AUSSI au palier franchi
     (levelUp) : ici +15 (15<100) puis +45 (60<100) → aucun palier, 1 confetti */
  lsData.clear();
  {
    const env=buildEnv();const ctx=runApp(env);
    vm.runInContext("window.__confetti=0;confetti=function(){window.__confetti++;};",ctx);
    vm.runInContext("stats.review=[{s:'deriv',l:'moyen',q:{prompt:'rv',type:'number',answer:7},reps:4,due:0}]",ctx);
    vm.runInContext("startReview()",ctx);
    vm.runInContext("afterAnswer(true,state.q,'')",ctx); /* réussite → item acquis (reps 5), +15 XP */
    vm.runInContext("endReview()",ctx);                   /* « Terminer la révision » : +45 (bonus), confetti */
    ok("fin de révision → confetti() appelé (conserver à endReview)",env.sandbox.__confetti===1);
  }
  /* --- CONFETTIS AU PALIER (2026-08-24, Cid) : la montée de niveau lance
     confetti() EN PLUS de la carte — levelUp réel, non stubbé, confetti compté */
  lsData.clear();
  {
    const env=buildEnv();const ctx=runApp(env);
    vm.runInContext("window.__confetti=0;confetti=function(){window.__confetti++;};",ctx);
    vm.runInContext("startFree();store.set('qz_xp',95)",ctx);
    vm.runInContext("afterAnswer(true,state.q,'')",ctx); /* +15 → 110 ≥ 100 : palier 2 → levelUp → confetti */
    ok("montée de niveau → confetti() appelé (en plus de la carte)",env.sandbox.__confetti>=1);
  }
  /* --- BONUS DE FIN DE RÉVISION (2026-08-24, Cid) : endReview crédite
     REVIEW_BONUS × coefficient matière en une seule fois — TOUJOURS crédité
     (vérifié via getXP). Carte de fin : 2026-08-26 (Cid) « simplement dire
     : Tout est à jour » — la carte se limite à cette phrase + le bouton
     (le bonus n'est plus affiché) ; le 🎯 avait été retiré le 2026-08-24. --- */
  lsData.clear();
  {
    const env=buildEnv();const ctx=runApp(env);
    vm.runInContext("stats.review=[{s:'deriv',l:'moyen',q:{prompt:'rv',type:'number',answer:7},reps:4,due:0}]",ctx);
    vm.runInContext("startReview()",ctx);
    const b=vm.runInContext("getXP()",ctx);
    vm.runInContext("afterAnswer(true,state.q,'')",ctx); /* +15 (moyen × 1.5) → 15 */
    vm.runInContext("endReview()",ctx);                   /* +45 (bonus 30 × 1.5) → 60 */
    ok("fin de révision → bonus REVIEW_BONUS × 1.5 (maths) = +45 XP",vm.runInContext("getXP()",ctx)===b+15+45);
    ok("carte de fin : « Tout est à jour » (2026-08-26, Cid)",env.document.querySelector("#qbox").innerHTML.includes("Tout est à jour"));
    ok("carte de fin : plus de 🎯 (retiré 2026-08-24)",!env.document.querySelector("#qbox").innerHTML.includes("🎯"));
  }
  /* --- CARTE HERO : « Niveau N » + barre aria-hidden + « x / y XP » + pas de fuite maths→DE --- */
  lsData.clear();
  {
    const env=buildEnv();const ctx=runApp(env);
    vm.runInContext("startFree();afterAnswer(true,state.q,'')",ctx); /* +15 XP maths (10 × 1.5) */
    const card=env.document.querySelector("#lvlSlot").innerHTML;
    ok("carte hero (maths) : « Niveau 1 », barre aria-hidden, « 15 / 100 XP »",
       /Niveau 1/.test(card)&&card.includes('aria-hidden="true"')&&/15 \/ 100 XP/.test(card));
    vm.runInContext("store.set('qz_xp',95);renderHome()",ctx);
    vm.runInContext("afterAnswer(true,state.q,'')",ctx); /* 95+15 = 110 → niveau 2 */
    const card2=env.document.querySelector("#lvlSlot").innerHTML;
    ok("carte hero (maths) : « Niveau 2 » après palier, « 110 / 200 XP » (palier 3 = 200)",
       /Niveau 2/.test(card2)&&/110 \/ 200 XP/.test(card2));
    vm.runInContext("setMatiere('de')",ctx);
    const cardDe=env.document.querySelector("#lvlSlot").innerHTML;
    ok("carte hero (DE) : propre XP (0 / 100), PAS la XP maths (110)",
       /Niveau 1/.test(cardDe)&&/0 \/ 100 XP/.test(cardDe)&&!/110/.test(cardDe));
  }
  /* --- « PAR THÈME » (2026-08-23, sur demande) : le panneau est TOUJOURS
     affiché, même zéro réponse — régression « ne s'affiche plus » : les stats
     vivent par thème et les ids changent avec l'année, le bloc disparaissait
     dès que l'année active n'avait pas encore de stats. --- */
  lsData.clear();
  {
    const env=buildEnv();const ctx=runApp(env);
    vm.runInContext("renderHome()",ctx);
    const by=env.document.querySelector("#bySubSlot").innerHTML;
    ok("zéro réponse : le panneau « Par thème » s'affiche (tous les thèmes, « 0 · — · — »)",
       /Par thème/.test(by)&&/substathead/.test(by)&&/—/.test(by));
    vm.runInContext("store.set('qz_stats',JSON.stringify({ans:0,good:0,bySub:{}}));renderHome()",ctx);
    ok("stats vides (bySub={}) : le panneau reste affiché",
       /Par thème/.test(env.document.querySelector("#bySubSlot").innerHTML));
  }
  /* --- INDÉPENDANCE PAR MATIÈRE : maths / PC / DE n'écrivent JAMAIS la clé de l'autre --- */
  lsData.clear();
  {
    const env=buildEnv();const ctx=runApp(env);
    vm.runInContext("startFree();afterAnswer(true,state.q,'')",ctx); /* maths : +15 (10 × 1.5) → qz_xp=15 */
    vm.runInContext("setMatiere('pc')",ctx);
    ok("PC à zéro : getXP() = 0 (clé qz_xp_pc absente), carte « 0 / 100 XP »",
       vm.runInContext("getXP()",ctx)===0&&/0 \/ 100 XP/.test(env.document.querySelector("#lvlSlot").innerHTML));
    vm.runInContext("startFree()",ctx);
    const b=vm.runInContext("getXP()",ctx),e=exp(ctx);
    vm.runInContext("afterAnswer(true,state.q,'')",ctx);
    ok("PC : bonne réponse → qz_xp_pc +pts exact ("+e+")",vm.runInContext("getXP()",ctx)===b+e);
    ok("clé PC = qz_xp_pc dans le storage",JSON.parse(lsData.get("qz_xp_pc"))===b+e);
    ok("clé maths (qz_xp) intacte après la réponse PC",JSON.parse(lsData.get("qz_xp"))===15);
    vm.runInContext("setMatiere('maths')",ctx);
    ok("retour maths : la XP maths est restaurée (« 15 / 100 XP »)",
       /15 \/ 100 XP/.test(env.document.querySelector("#lvlSlot").innerHTML));
    vm.runInContext("setMatiere('de');startFree()",ctx);
    vm.runInContext("afterAnswer(true,state.q,'')",ctx); /* DE gagne sa propre XP (10 × 1.2 = 12) */
    ok("DE : sa XP (qz_xp_de) augmente sans toucher maths ni PC",
       JSON.parse(lsData.get("qz_xp_de"))>0&&JSON.parse(lsData.get("qz_xp"))===15);
  }
}

/* ========================================================= */
console.log("\n[24] Registres par année — structure, ids, volume (refonte 2026-08-23)");
{
  lsData.clear();
  const env=buildEnv();const ctx=runApp(env);
  const probe=vm.runInContext("({SUBJECTS_MATH,SUBJECTS_PC,SUBJECTS_DE,SUBJECTS_EN,THEME_BY_ID})",ctx);
  /* 2026-08-23 : refonte maths ET PC sur les programmes officiels (BO) — 1 thème ≈ 1
     section officielle. Maths : Seconde 8 / Première 9 / Terminale 8 thèmes,
     + 3 expertes (complexes, arithmétique, graphes) en POOL activable par
     case à cocher en Terminale (8 → 11 thèmes, plus une 4ᵉ année).
     PC : Seconde 8 / Première 14 / Terminale 13 — la stœchiométrie est en
     PREMIÈRE (p1_stoich), pas en Seconde (Cid, 2026-08-23, ex-s2_react), et
     le son est en PREMIÈRE (p1_son), pas en Seconde (Cid, 2026-08-24,
     ex-s2_son). Ids supprimés (maths : s2_eq, s2_eq2, affine, lim… ; PC :
     s2_signaux, stoich, cinet, s2_react, t_ondes, t_energie, s2_son) purgés
     automatiquement par loadStats (orphelines review/history/bySub). */
  ok("Première maths : 9 thèmes de la refonte, ordre livré",
     JSON.stringify(probe.SUBJECTS_MATH.premiere.map(s=>s.id))===JSON.stringify(
       ["p1_log","var","suites","equa2","deriv","logexp","trig","vect","proba"]));
  ok("Première PC : 14 ids de la refonte (6 historiques conservés + 8 p1_* — dont p1_stoich et p1_son)",
     JSON.stringify(probe.SUBJECTS_PC.premiere.map(s=>s.id))===JSON.stringify(
       ["newton","forces","energie","moles","p1_oxido","p1_stoich","p1_liaison","p1_sep","p1_orga","p1_synth","ondes","p1_son","p1_lum","elec"]));
  /* Depuis la refonte AUCUN thème ne porte le niveau « experte » (il n'existe
     plus) : chaque thème maths/PC, experte comprise, porte facile+moyen+difficile. */
  let lvls=true;
  for(const reg of [probe.SUBJECTS_MATH,probe.SUBJECTS_PC])
    for(const y of Object.keys(reg))
      for(const s of reg[y]){
        const set=new Set(s.gens.map(g=>g.lvl));
        if(!set.has("facile")||!set.has("moyen")||!set.has("difficile"))lvls=false;
        if(set.has("experte"))lvls=false;
      }
  ok("chaque thème maths/PC porte facile+moyen+difficile (aucun niveau « experte » restant)",lvls);
  let pre=true;
  for(const y of["seconde","terminale"])
    for(const s of [...(probe.SUBJECTS_MATH[y]||[]),...(probe.SUBJECTS_PC[y]||[])]){
      const want=y==="seconde"?"s2_":"t_";
      if(!s.id.startsWith(want))pre=false;
    }
  ok("ids Seconde préfixés s2_ / Terminale préfixés t_ (quand livrés)",pre);
  const T=Object.keys(probe.THEME_BY_ID);
  /* THEME_BY_ID résout la fiche de CHAQUE thème de tous les registres
     (maths/PC × année + DE + EN) — plus de liste d'ids en dur. */
  let covers=true;
  for(const reg of [probe.SUBJECTS_MATH,probe.SUBJECTS_PC])
    for(const y of Object.keys(reg))
      for(const s of reg[y]) if(!T.includes(s.id))covers=false;
  for(const s of [...probe.SUBJECTS_DE,...probe.SUBJECTS_EN]) if(!T.includes(s.id))covers=false;
  ok("THEME_BY_ID couvre tous les thèmes de tous les registres (maths/PC×année + DE + EN)",covers);
  ok("Seconde maths : 8 thèmes (contenu livré — + trigonométrie & espace, BO 2020)",probe.SUBJECTS_MATH.seconde.length===8);
  ok("Seconde PC : 8 thèmes (contenu livré — le son est passé en Première)",probe.SUBJECTS_PC.seconde.length===8);
  ok("Première maths : 9 thèmes (contenu livré)",probe.SUBJECTS_MATH.premiere.length===9);
  ok("Première PC : 14 thèmes (contenu livré — dont le son, ex-Seconde)",probe.SUBJECTS_PC.premiere.length===14);
  ok("Terminale maths : 8 thèmes (contenu livré)",probe.SUBJECTS_MATH.terminale.length===8);
  ok("Terminale PC : 13 thèmes (contenu livré)",probe.SUBJECTS_PC.terminale.length===13);
  /* 2026-08-23 : les 3 thèmes « expertes » forment un POOL maths (plus une
     difficulté) — activé par case à cocher en Terminale ; PC n'a pas de pool. */
  ok("Pool expertes maths : exactement 3 thèmes (complexes, arithmétique, graphes)",
     JSON.stringify((probe.SUBJECTS_MATH.experte||[]).map(s=>s.id).sort())
       ===JSON.stringify(["t_arith","t_complexes","t_graphes"]));
  ok("PC : pas de pool « expertes »",probe.SUBJECTS_PC.experte===undefined);
  ok("« Limites » (lim) purgé de THEME_BY_ID",!T.includes("lim"));
  let purgeOk=true;
  {
    const env2=buildEnv();
    lsData.set("qz_stats",JSON.stringify({ans:2,good:1,bySub:{deriv:{ans:2,good:1}},
      review:[{s:"zzz_orpheline",l:"moyen",q:{prompt:'x',type:'number',answer:1},reps:0,due:0},
              {s:"deriv",l:"moyen",q:{prompt:'y',type:'number',answer:2},reps:0,due:0}]}));
    const ctx2=runApp(env2);
    const R=vm.runInContext("stats.review.map(r=>r.s)",ctx2);
    purgeOk=R.length===1&&R[0]==="deriv";
  }
  ok("purge orphelines loadStats : id inconnue retirée, id connue conservée",purgeOk);
}

/* ========================================================= */
console.log("\n[27] Année — état, clés, indépendance maths/PC, THEME_BY_ID");
{
  lsData.clear();
  {
    const env=buildEnv();const ctx=runApp(env);
    ok("clé absente → « premiere » (défaut)",vm.runInContext("state.annee",ctx)==="premiere");
  }
  lsData.clear();
  lsData.set("qz_year_math","bac-pro");
  lsData.set("qz_year_pc","SECONDE");
  {
    const env=buildEnv();const ctx=runApp(env);
    ok("valeurs corrompues → « premiere »",vm.runInContext("state.annee",ctx)==="premiere");
    vm.runInContext("setMatiere('pc')",ctx);
    ok("PC : corrompue → « premiere » aussi",vm.runInContext("state.annee",ctx)==="premiere");
  }
  lsData.clear();
  {
    const env=buildEnv();const ctx=runApp(env);
    vm.runInContext("setAnnee('seconde')",ctx);
    const storedM=lsData.get("qz_year_math"); /* Map du localStorage factice, lisible côté Node */
    ok("setAnnee('seconde') → état + clé qz_year_math",
       vm.runInContext("state.annee",ctx)==="seconde"&&
       (storedM==='"seconde"'||storedM==="seconde"));
    vm.runInContext("setMatiere('pc')",ctx);
    ok("bascule maths→pc : annee PC re-chargée (défaut « premiere »)",
       vm.runInContext("state.annee",ctx)==="premiere");
    vm.runInContext("setAnnee('terminale')",ctx);
    const storedP=lsData.get("qz_year_pc");
    ok("PC → terminale persistée",storedP==='"terminale"'||storedP==="terminale");
    vm.runInContext("setMatiere('maths')",ctx);
    ok("INDÉPENDANCE : maths « seconde », PC « terminale » (clés distinctes)",
       vm.runInContext("state.annee",ctx)==="seconde"&&storedP!==storedM);
    vm.runInContext("setAnnee('invalide');",ctx);
    ok("setAnnee invalide → ignoré",vm.runInContext("state.annee",ctx)==="seconde");
    vm.runInContext("setMatiere('de')",ctx);
    ok("DE → state.annee === null",vm.runInContext("state.annee",ctx)===null);
    vm.runInContext("setMatiere('en')",ctx);
    ok("EN → state.annee === null",vm.runInContext("state.annee",ctx)===null);
  }
  /* --- sélecteur d'année : registres complets → visible maths/PC, masqué DE/EN --- */
  lsData.clear();
  {
    const env=buildEnv(),ctx=runApp(env);
    const hidden=()=>env.document.querySelector("#yearRow").hidden;
    ok("maths : #yearRow visible",hidden()===false);
    vm.runInContext("setAnnee('seconde')",ctx);
    ok("maths/seconde : pas de ligne « classe » (plus de #heroEyebrow) et phrase de base",
       env.byId.heroEyebrow===undefined&&env.document.querySelector("#heroLede").innerHTML==="Pour réussir en maths, il faut pratiquer : chaque question comprise renforce la suivante.");
    vm.runInContext("setAnnee('terminale')",ctx);
    ok("maths/terminale : même phrase de base, quelle que soit l'année",
       env.byId.heroEyebrow===undefined&&env.document.querySelector("#heroLede").innerHTML==="Pour réussir en maths, il faut pratiquer : chaque question comprise renforce la suivante.");
    vm.runInContext("setAnnee('premiere')",ctx);
    ok("maths/premiere : même phrase de base, quelle que soit l'année",
       env.byId.heroEyebrow===undefined&&env.document.querySelector("#heroLede").innerHTML==="Pour réussir en maths, il faut pratiquer : chaque question comprise renforce la suivante.");
    vm.runInContext("setMatiere('pc')",ctx);
    ok("pc : #yearRow visible",hidden()===false);
    vm.runInContext("setMatiere('de')",ctx);
    ok("DE : #yearRow masqué",hidden()===true);
    vm.runInContext("setMatiere('en')",ctx);
    ok("EN : #yearRow masqué",hidden()===true);
  }
}

/* ========================================================= */
console.log("\n[28] Hero — pas de ligne classe/matière, phrase de base unique par matière");
{
  /* 2026-08-22 (sur demande) : la ligne d'indication classe/matière (eyebrow)
     est retirée de toutes les matières, et la phrase de base est unique par
     matière, IDENTIQUE quelle que soit l'année. MAT_DATA est donc plat
     (plus de sous-objets par année). */
  lsData.clear();
  const env=buildEnv();const ctx=runApp(env);
  const cases=[
    ["maths","Pour réussir en maths, il faut pratiquer : chaque question comprise renforce la suivante."],
    ["pc","Pour réussir en physique-chimie, il faut relier les formules aux situations, gagner en rigueur et pratiquer."],
    ["de","Pour réussir en allemand, il faut se familiariser avec la langue : la régularité fera la différence."],
    ["en","Pour réussir en anglais, il faut entendre la langue, la lire et la réutiliser régulièrement."]
  ];
  for(const [m,phrase] of cases){
    vm.runInContext("setMatiere('"+m+"')",ctx);
    ok(m+" : pas de ligne classe/matière (le code ne référence plus #heroEyebrow)",env.byId.heroEyebrow===undefined);
    ok(m+" : phrase de base « "+phrase+" »",env.document.querySelector("#heroLede").innerHTML===phrase);
  }
  vm.runInContext("setMatiere('maths');setAnnee('seconde')",ctx);
  ok("maths/seconde : la phrase ne change PAS avec l'année",
     env.byId.heroEyebrow===undefined&&env.document.querySelector("#heroLede").innerHTML==="Pour réussir en maths, il faut pratiquer : chaque question comprise renforce la suivante.");
  vm.runInContext("setMatiere('pc');setAnnee('terminale')",ctx);
  ok("pc/terminale : la phrase ne change PAS avec l'année",
     env.byId.heroEyebrow===undefined&&env.document.querySelector("#heroLede").innerHTML==="Pour réussir en physique-chimie, il faut relier les formules aux situations, gagner en rigueur et pratiquer.");
}

/* ========================================================= */
console.log("\n[29] Liste à réviser — doublons hérités déduplicés au chargement");
{
  /* 2026-08-22 (bug signalé par Cid) : AVANT la clé qKey stable (test [21]), la même
     question pouvait entrer la liste PLUSIEURS FOIS (les options des QCM sont mélangées
     à chaque tirage). Ces doublons vivent dans le localStorage des utilisateurs
     existants : en révision, une bonne réponse ne faisait progresser qu'UNE entrée →
     la question revenait « plusieurs fois d'affilée ». loadStats doit donc déduper,
     en gardant l'entrée la plus avancée (reps max = progression espacée préservée). */
  lsData.clear();
  {
    const dup={prompt:"2+2 ?",type:"choice",options:["3","5","4"],correct:2,explain:"compter"};
    const dup2={prompt:"2+2 ?",type:"choice",options:["4","3","5"],correct:0,explain:"compter"}; /* même question, autre ordre — forme des doublons hérités */
    lsData.set("qz_stats",JSON.stringify({ans:10,good:5,history:[],review:[
      {s:"deriv",l:"moyen",q:dup,reps:0,due:0},
      {s:"deriv",l:"moyen",q:dup2,reps:2,due:0}
    ]}));
    const env=buildEnv();const ctx=runApp(env);
    const R=vm.runInContext("stats.review",ctx);
    ok("2 doublons hérités → UNE seule entrée après chargement",R.length===1);
    ok("l'entrée conservée = la plus avancée (reps=2, progression espacée intacte)",R[0].reps===2);
    ok("le contenu pédagogique est intact (retrouvable via qKey)",
       vm.runInContext("qKey(stats.review[0].q)",ctx)===vm.runInContext("qKey("+JSON.stringify(dup)+")",ctx));
  }
  /* Reproduction du SYMPTÔME d'origine, bout-en-bout : liste doublée → révision →
     bonne réponse → la question ne doit PAS ressurgir dans la séance. */
  lsData.clear();
  {
    const dup={prompt:"3×4 ?",type:"choice",options:["7","12","9"],correct:1,explain:"tables"};
    const dup2={prompt:"3×4 ?",type:"choice",options:["12","9","7"],correct:0,explain:"tables"};
    lsData.set("qz_stats",JSON.stringify({ans:10,good:5,history:[],review:[
      {s:"deriv",l:"moyen",q:dup,reps:0,due:0},
      {s:"deriv",l:"moyen",q:dup2,reps:1,due:0}
    ]}));
    const env=buildEnv();const ctx=runApp(env);
    vm.runInContext("startReview()",ctx);
    vm.runInContext("afterAnswer(true,state.q,state.curLvl)",ctx);
    ok("bonne réponse → l'item est avancé : plus aucune question écheue dans la séance",
       vm.runInContext("reviewDueCount()",ctx)===0);
  }
}

/* ========================================================= */
console.log("\n[30] Niveau du joueur pendant les questions — puce dans la barre (2 modes)");
{
  /* 2026-08-22 (sur demande) : « Afficher le niveau pendant les questions ».
     Le niveau de la MATIÈRE (le « Niveau N » de la carte du hero, déduit de
     l'XP) est visible dans la barre de l'écran de question, en libre comme en
     révision, et suit les paliers franchis en cours de séance. (La DIFFICULTÉ de
     la question est déjà sur sa propre puce — « facile/moyen/difficile » ou
     « A2/A2+/B1 » — et reste inchangée.) */
  /* 2026-08-23 : la puce porte aussi sa BARRE de progression (span sans texte
     « .nlvlbar ») — le DOM factice stocke innerHTML en chaîne brute, on teste
     donc le préfixe « Niv. N » + la présence/largeur de la barre. */
  const chip=ctx=>vm.runInContext("document.querySelector('#chipNiv')?document.querySelector('#chipNiv').innerHTML:null",ctx);
  /* --- Deux modes : la puce est présente et juste --- */
  lsData.clear();
  {
    const env=buildEnv();const ctx=runApp(env);
    vm.runInContext("store.set('qz_xp',120)",ctx); /* 100 ≤ 120 < 200 → Niv. 2 (courbe 2026-08-24) */
    vm.runInContext("startFree()",ctx);
    ok("libre : la barre affiche « Niv. 2 »",/^Niv\. 2/.test(chip(ctx)));
    ok("libre : la BARRE de progression est présente (120 XP = 20,0 % du palier 100→200)",/nlvlbar/.test(chip(ctx))&&/width:20\.0%/.test(chip(ctx)));
    vm.runInContext("stats.review=[{s:'deriv',l:'moyen',q:{prompt:'rv',type:'number',answer:7},reps:0,due:0}]",ctx);
    vm.runInContext("startReview()",ctx);
    ok("révision : la barre affiche « Niv. 2 »",/^Niv\. 2/.test(chip(ctx)));
  }
  /* --- PALIER franchi en cours de séance : la puce suit l'XP gagnée --- */
  lsData.clear();
  {
    const env=buildEnv();const ctx=runApp(env);
    vm.runInContext("store.set('qz_xp',190)",ctx); /* Niv. 2 (100 ≤ 190 < 200) ; +15 (bonne « moyen » × 1.5 maths) → 205 ≥ 200 → Niv. 3 */
    vm.runInContext("startFree()",ctx);
    ok("avant réponse : « Niv. 2 »",/^Niv\. 2/.test(chip(ctx)));
    vm.runInContext("afterAnswer(true,state.q,'')",ctx);
    ok("bonne réponse franchit le palier → la puce passe à « Niv. 3 »",/^Niv\. 3/.test(chip(ctx)));
  }
  /* --- INDÉPENDANCE : la puce suit la matière active --- */
  lsData.clear();
  {
    const env=buildEnv();const ctx=runApp(env);
    vm.runInContext("store.set('qz_xp',120);store.set('qz_xp_de',260)",ctx); /* maths Niv. 2, DE Niv. 3 */
    vm.runInContext("startFree()",ctx);
    ok("maths : « Niv. 2 »",/^Niv\. 2/.test(chip(ctx)));
    vm.runInContext("setMatiere('de');startFree()",ctx);
    ok("bascule DE : « Niv. 3 » (la XP DE, pas la XP maths)",/^Niv\. 3/.test(chip(ctx)));
  }
}

/* ========================================================= */
console.log("\n[31] Expertes — case à cocher de Terminale maths (programme officiel expertes)");
{
  /* 2026-08-23 (sur demande) : « Expertes » n'est PLUS une 4ᵉ année de maths —
     c'est une case à cocher dans le bloc « Entraînement libre », visible
     UNIQUEMENT en maths × Terminale : coché, elle ajoute les 3 thèmes du
     programme officiel des maths expertes (complexes, arithmétique, graphes
     & Markov) au pool de Terminale (8 → 11 thèmes). Règles :
     - state.experte = booléen (persistance qz_experte_math, défaut false) ;
     - AUCUN effet hors maths × Terminale (activeSubjects inchangé) ;
     - les 12 questions expertes sont renivelées facile/moyen/difficile —
       PLUS AUCUNE question ne porte le niveau « experte » ;
     - PTS_LVL.experte (20) et LVL_NAMES.experte restent (légacy, scoring
       des lignes history héritées) mais ne servent plus à aucun contenu neuf ;
     - « experte » n'est plus une ANNÉE : readYear migre l'ancienne valeur,
       setAnnee la refuse partout. */
  /* --- A. structure statique : le pool existe, 3 thèmes, 3 niveaux réels --- */
  lsData.clear();
  {
    const env=buildEnv();const ctx=runApp(env);
    const P=vm.runInContext("({PTS_LVL,LVL_NAMES,SUBJECTS_MATH,SUBJECTS_PC})",ctx);
    ok("legacy : PTS_LVL.experte = 20 (toujours lisible, au-dessus du 15)",P.PTS_LVL.experte===20&&P.PTS_LVL.difficile===15);
    ok("legacy : LVL_NAMES.experte = « Experte » (affich. history héritée)",P.LVL_NAMES.experte==="Experte");
    const exp=(P.SUBJECTS_MATH.experte||[]);
    ok("SUBJECTS_MATH.experte : exactement 3 thèmes (complexes, arith, graphes)",
       exp.length===3&&JSON.stringify(exp.map(s=>s.id).sort())===JSON.stringify(["t_arith","t_complexes","t_graphes"]));
    ok("SUBJECTS_PC.experte est ABSENT (PC n'a pas de pool expertes)",P.SUBJECTS_PC.experte===undefined);
    const allLvls=[...new Set(exp.flatMap(s=>s.gens.map(g=>g.lvl)))].sort();
    ok("chaque question experte est facile/moyen/difficile (aucun niveau « experte »)",
       allLvls.length===3&&["facile","moyen","difficile"].every(l=>allLvls.includes(l)));
  }
  /* --- B. yearsFor : 3 ans partout, plus de « experte » --- */
  lsData.clear();
  {
    const env=buildEnv();const ctx=runApp(env);
    const yf=vm.runInContext("({m:yearsFor('maths'),p:yearsFor('pc'),d:yearsFor('de'),e:yearsFor('en')})",ctx);
    ok("maths : 3 années (plus de 4ᵉ année)",yf.m.length===3&&!yf.m.includes("experte"));
    ok("pc : 3 années, pas d'« experte »",yf.p.length===3&&!yf.p.includes("experte"));
    ok("de/en : 3 années, pas d'« experte »",yf.d.length===3&&!yf.d.includes("experte")&&yf.e.length===3&&!yf.e.includes("experte"));
  }
  /* --- C. readYear : valeur legacy « experte » → Terminale + case COCHÉE --- */
  lsData.clear();
  {
    const env=buildEnv();const ctx=runApp(env);
    ok("défaut maths → « premiere »",vm.runInContext("readYear('maths')",ctx)==="premiere");
    vm.runInContext("store.set('qz_year_math','experte')",ctx);
    const mig=vm.runInContext("({y:readYear('maths'),e:state.experte,k:store.get('qz_experte_math')})",ctx);
    ok("qz_year_math=« experte » (legacy) → « terminale » + case Expertes cochée",
       mig.y==="terminale"&&mig.e===true&&mig.k===true);
    vm.runInContext("store.set('qz_year_pc','experte')",ctx);
    ok("qz_year_pc=« experte » (valeur inconnue) → readYear('pc')=« premiere »",vm.runInContext("readYear('pc')",ctx)==="premiere");
    ok("DE → null (pas d'année)",vm.runInContext("readYear('de')",ctx)===null);
    ok("EN → null (pas d'année)",vm.runInContext("readYear('en')",ctx)===null);
    vm.runInContext("store.set('qz_year_math','nope')",ctx);
    ok("valeur corrompue → readYear('maths')=« premiere »",vm.runInContext("readYear('maths')",ctx)==="premiere");
  }
  /* --- D. yearReady : maths/PC prêts, DE/EN jamais --- */
  lsData.clear();
  {
    const env=buildEnv();const ctx=runApp(env);
    ok("yearReady('maths') = true (3 registres + pool expertes livrés)",vm.runInContext("yearReady('maths')",ctx)===true);
    ok("yearReady('pc') = true (3 registres livrés)",vm.runInContext("yearReady('pc')",ctx)===true);
    ok("yearReady('de') = false",vm.runInContext("yearReady('de')",ctx)===false);
    ok("yearReady('en') = false",vm.runInContext("yearReady('en')",ctx)===false);
  }
  /* --- E. setAnnee : « experte » refusée (n'est plus une année) --- */
  lsData.clear();
  {
    const env=buildEnv();const ctx=runApp(env);
    vm.runInContext("setAnnee('experte')",ctx);
    ok("maths : setAnnee('experte') → refusée (annee reste « premiere »)",vm.runInContext("state.annee",ctx)==="premiere");
    vm.runInContext("setMatiere('pc')",ctx);
    const ann=vm.runInContext("state.annee",ctx);
    vm.runInContext("setAnnee('experte')",ctx);
    ok("PC : setAnnee('experte') → refusée (annee inchangée)",vm.runInContext("state.annee",ctx)===ann);
  }
  /* --- F. activeSubjects : 8 thèmes sans case, 11 avec (maths × Terminale) --- */
  lsData.clear();
  {
    const env=buildEnv();const ctx=runApp(env);
    vm.runInContext("setAnnee('terminale')",ctx);
    vm.runInContext("state.experte=false",ctx);
    ok("maths/terminale sans case : 8 thèmes",vm.runInContext("activeSubjects().length",ctx)===8);
    vm.runInContext("state.experte=true",ctx);
    const ids11=vm.runInContext("activeSubjects().map(s=>s.id).sort()",ctx);
    ok("maths/terminale case cochée : 11 thèmes (8 + complexes, arithmétique, graphes)",
       ids11.length===11&&["t_arith","t_complexes","t_graphes"].every(x=>ids11.includes(x)));
    vm.runInContext("setMatiere('pc');setAnnee('terminale')",ctx);
    ok("pc/terminale : state.experte=true sans effet (13 thèmes)",vm.runInContext("activeSubjects().length",ctx)===13);
    vm.runInContext("setMatiere('maths');setAnnee('seconde')",ctx);
    ok("maths/seconde : state.experte=true sans effet (8 thèmes)",vm.runInContext("activeSubjects().length",ctx)===8);
  }
  /* --- F2. pickQ : case cochée → tirages dans les 11 thèmes, niveaux réels --- */
  lsData.clear();
  {
    const env=buildEnv();const ctx=runApp(env);
    vm.runInContext("setAnnee('terminale');state.experte=true;setNiveau('difficile');state.sel=[]",ctx);
    const ids=vm.runInContext("new Set(activeSubjects().map(s=>s.id))",ctx);
    let allOk=true;const seen=new Set();
    for(let i=0;i<99;i++){
      const r=vm.runInContext("pickQ()",ctx);
      if(!r||!ids.has(r.sub.id))allOk=false;
      if(!["facile","moyen","difficile"].includes(r.lvl))allOk=false;   /* jamais « experte » */
      seen.add(r.sub.id);
    }
    ok("99 tirages : TOUS dans les 11 thèmes, niveaux réels (jamais « experte »)",allOk);
    ok("les 3 thèmes expertes sont servis sur 99 tirages (mélange)",
       seen.has("t_complexes")&&seen.has("t_arith")&&seen.has("t_graphes"));
  }
  /* --- F3. UI : ligne « Maths expertes » — visible UNIQUEMENT maths ×
     Terminale ; en Seconde/Première elle est TOTALEMENT ABSENTE (hidden,
     plus d'espace réservé — 2026-08-24, 2ᵉ passe Cid : l'écart « niveaux →
     chapitres » est alors le même qu'ailleurs), absente en PC/DE/EN --- */
  lsData.clear();
  {
    const env=buildEnv();const ctx=runApp(env);
    const row=()=>env.document.querySelector("#xoptRow");
    ok("maths/premiere : ligne absente (hidden — plus d'espace réservé)",
       row().hidden===true);
    vm.runInContext("setAnnee('terminale')",ctx);
    ok("maths/terminale : ligne visible (pas de hidden)",
       row().hidden===false);
    vm.runInContext("setAnnee('seconde')",ctx);
    ok("maths/seconde : ligne absente (hidden)",
       row().hidden===true);
    vm.runInContext("setMatiere('pc')",ctx);
    ok("pc : ligne absente (hidden — maths uniquement)",row().hidden===true);
    vm.runInContext("setMatiere('de')",ctx);
    ok("DE : ligne absente (hidden)",row().hidden===true);
  }
  /* --- F4. cochage → état + persistance + poche ré-ouverte (bagKey change) --- */
  lsData.clear();
  {
    const env=buildEnv();const ctx=runApp(env);
    vm.runInContext("setAnnee('terminale')",ctx);
    const chk=env.document.querySelector("#xoptChk");
    const fire=()=>(chk._listeners["change"]||[]).slice().forEach(f=>f.call(chk,{}));
    chk.checked=true;fire();
    ok("case cochée → state.experte=true + persistance qz_experte_math",
       vm.runInContext("state.experte",ctx)===true&&JSON.parse(lsData.get("qz_experte_math"))===true);
    const bagWith=vm.runInContext("bagKey()",ctx);
    chk.checked=false;fire();
    ok("case décochée → state.experte=false + poche ré-ouverte (bagKey change)",
       vm.runInContext("state.experte",ctx)===false&&vm.runInContext("bagKey()",ctx)!==bagWith);
  }
  /* --- F5. persistance de la case au rechargement --- */
  lsData.clear();
  lsData.set("qz_experte_math","true");
  {
    const env=buildEnv();const ctx=runApp(env);
    ok("qz_experte_math=true au chargement → state.experte=true",vm.runInContext("state.experte",ctx)===true);
  }
  lsData.clear();
  lsData.set("qz_experte_math","corrompu");
  {
    const env=buildEnv();const ctx=runApp(env);
    ok("valeur corrompue → state.experte=false (jamais d'erreur)",vm.runInContext("state.experte",ctx)===false);
  }
  /* --- G. Auto ne propose JAMAIS « experte » --- */
  lsData.clear();
  {
    const env=buildEnv();const ctx=runApp(env);
    vm.runInContext("stats.history=[{s:'t_complexes',o:1},{s:'t_complexes',o:1},{s:'t_complexes',o:1},{s:'t_complexes',o:1}]",ctx);
    ok("100 % de réussite → « difficile » (Auto plafonne, jamais « experte »)",vm.runInContext("autoLevel('t_complexes')",ctx)==="difficile");
  }
  /* --- H. XP : bonne réponse « expertes » = points du VRAI niveau (5/10/15),
     pas le +20 legacy — × le coefficient matière (2026-08-24) --- */
  lsData.clear();
  {
    const env=buildEnv();const ctx=runApp(env);
    vm.runInContext("store.set('qz_xp',0)",ctx);
    vm.runInContext("setAnnee('terminale');state.experte=true;setNiveau('facile');state.sel=[];startFree()",ctx);
    const curLvl=vm.runInContext("state.curLvl",ctx);
    ok("la question servie est au niveau réel (pas « experte »)",["facile","moyen","difficile"].includes(curLvl)&&curLvl!=="experte");
    vm.runInContext("afterAnswer(true,state.q,'')",ctx);
    ok("bonne réponse « facile » → +8 XP (5 × 1.5 maths — pas le 20 legacy)",JSON.parse(lsData.get("qz_xp"))===8);
  }
}

/* ========================================================= */
console.log("\n[32] Anti-répétition (shuffle-bag) — chaque question disponible servie UNE fois avant remélange");
{
  lsData.clear();
  /* --- A. Mix @ niveau : N tirages → N générateurs DISTINCTS (aucune répétition avant épuisement),
        puis la poche remélange et reste valide --- */
  {
    const env=buildEnv();const ctx=runApp(env);
    const res=vm.runInContext(`(function(){
      state.sel=[];state.level='moyen';state.mode='free';
      const vis=visibleSubjects();
      let N=0;
      for(const sub of vis){let idx=0;sub.gens.forEach(g=>{if(g.lvl==='moyen')idx++;});if(!idx)idx=sub.gens.length;N+=idx;}
      const gens=[];
      for(let i=0;i<N;i++){gens.push(bagDraw().gen);}
      return {N, distinct:new Set(gens).size};
    })()`,ctx);
    ok(`mix @ moyen : ${res.N} tirages → ${res.N} générateurs DISTINCTS (aucune répétition avant épuisement)`,res.distinct===res.N&&res.N>1);
    const extra=vm.runInContext(`(function(){const d=bagDraw();return {ok:!!(d&&d.sub&&d.gen&&typeof d.gen.make==='function')};})()`,ctx);
    ok("après épuisement : la poche remélange, tirage encore valide",extra.ok);
  }
  /* --- B. Thème verrouillé : les tirages servent UNIQUEMENT ce thème (pas de fuite vers les autres) --- */
  {
    const env=buildEnv();const ctx=runApp(env);
    const res=vm.runInContext(`(function(){
      state.sel=[];state.level='moyen';state.mode='free';
      const target=visibleSubjects()[0].id;
      state.sel=[target];
      const ids=[];
      for(let i=0;i<6;i++)ids.push(bagDraw().sub.id);
      return {target, allSame:ids.every(x=>x===target)};
    })()`,ctx);
    ok(`verrouillé sur « ${res.target} » : 6 tirages → TOUS ce thème (pas de fuite)`,res.allSame===true&&res.target!==null);
  }
  /* --- C. Pas de crash + question valide (difficile, qui exerce le repli niveau absent) --- */
  {
    const env=buildEnv();const ctx=runApp(env);
    vm.runInContext("state.sel=[];state.level='difficile';state.mode='free';",ctx);
    const r=vm.runInContext("(function(){const d=bagDraw();const q=d.gen.make();return {sub:!!d.sub,prompt:typeof q.prompt==='string'&&q.prompt.length>0,type:!!q.type};})()",ctx);
    ok("difficile : tirage valide (sujet + prompt non vide + type)",r.sub&&r.prompt&&r.type);
  }
  /* --- D. Multi-sélection : 2 thèmes choisis → tirages UNIQUEMENT sur ces 2, et les deux sont servis --- */
  {
    const env=buildEnv();const ctx=runApp(env);
    const res=vm.runInContext(`(function(){
      state.sel=[];state.level='moyen';state.mode='free';
      const vis=visibleSubjects();
      const a=vis[0].id, b=vis[1].id;
      state.sel=[a,b];
      const ids=[];
      for(let i=0;i<12;i++)ids.push(bagDraw().sub.id);
      return {a,b,inScope:ids.every(x=>x===a||x===b),both:ids.includes(a)&&ids.includes(b)};
    })()`,ctx);
    ok(`multi ${res.a}+${res.b} : 12 tirages → UNIQUEMENT ces 2 thèmes, et les deux sont servis`,res.inScope===true&&res.both===true);
  }
}

/* ================= [33] PWA — installable + hors ligne (2026-08-25, spec docs/2026-08-25-pwa-design.md) ================= */
{
  const readSafe=(f)=>{try{return fs.readFileSync(path.join(__dirname,f),"utf8");}catch(e){return "";}};
  const manifestRaw=readSafe("manifest.webmanifest");
  const swRaw=readSafe("sw.js");
  const indexRaw=readSafe("index.html");

  // [PWA-1] manifeste : JSON valide, name + start_url + icons non vides
  let man=null;
  try{man=JSON.parse(manifestRaw);}catch(e){}
  ok("[PWA-1] manifeste : JSON valide (name, start_url, icons non vide)",
     !!man && typeof man.name==="string" && man.name.length>0 &&
     typeof man.start_url==="string" && man.start_url.length>0 &&
     Array.isArray(man.icons) && man.icons.length>0);

  // [PWA-2] service worker : compile (syntaxe) sans erreur
  let swOk=true;
  try{ new vm.Script(swRaw); }catch(e){ swOk=false; }
  ok("[PWA-2] service worker : syntaxe valide (compile)", swOk===true);

  // [PWA-3] Quizey.html : lien manifeste + lien icon (PNG) + theme-color
  ok("[PWA-3] Quizey.html : <link rel=manifest> + <link rel=icon> + theme-color",
     /rel=["']manifest["']/.test(html) &&
     /rel=["']icon["']\s+type=["']image\/png["']/.test(html) &&
     /name=["']theme-color["']/.test(html));

  // [PWA-4] enregistrement SW gardé : https:/localhost requis, file:// exclu
  ok("[PWA-4] Quizey.html : enregistrement SW gardé (https:/localhost, file:// exclu)",
     /["']serviceWorker["']\s+in\s+navigator/.test(html) &&
     /location\.protocol===["']https:["']/.test(html) &&
     /location\.hostname===["']localhost["']/.test(html) &&
     /serviceWorker\.register\(/.test(html));

  // [PWA-5] index.html : redirige vers Quizey.html (l'app, pas un autre fichier)
  ok("[PWA-5] index.html : redirige vers Quizey.html",
     /location\.replace\([\s\S]*Quizey\.html/.test(indexRaw) ||
     /url=["'][^"']*Quizey\.html/.test(indexRaw));
}

console.log("=====================================");
console.log(fail===0?("TOUS LES TESTS PASSENT ✔  ("+pass+")"):(fail+" ÉCHEC(S) — "+pass+" OK"));
process.exit(fail===0?0:1);
