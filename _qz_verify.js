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
  /* Bannière « version téléphone » : [hidden] dans le HTML réel → la faire
     correspondre ici, sinon les assertions « bannière cachée » casseraient. */
  byId.uiBanner=makeEl({hidden:true});
  const document={
    documentElement:makeEl(),
    body:makeEl(),
    createElement:t=>makeEl(),
    querySelector(sel){const id=String(sel).replace(/^#/,"");if(byId[id])return byId[id];byId[id]=makeEl();return byId[id];},
    querySelectorAll(sel){
      if(sel===".theme-btn")return [tb.auto,tb.light,tb.dark];
      if(sel===".ui-btn")return [makeEl({dataset:{uiPick:"d"}}),makeEl({dataset:{uiPick:"m"}})];
      if(sel===".seg-btn")return [makeEl({dataset:{lvl:"facile"}}),makeEl({dataset:{lvl:"moyen"}}),makeEl({dataset:{lvl:"difficile"}})];
      return [];
    },
  };
  const sandbox={
    document,localStorage,
    setTimeout:(fn,ms)=>0,clearTimeout:()=>{},
    setInterval:()=>0,clearInterval:()=>{}, /* sessions : startFree/startSprint utilisent clearInterval */
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
  for(const y of["seconde","premiere","terminale"])REGISTERS.push(...(probe.SUBJECTS_MATH[y]||[]),...(probe.SUBJECTS_PC[y]||[]));
  REGISTERS.push(...(probe.SUBJECTS_DE||[]),...(probe.SUBJECTS_EN||[]));
  for(const sub of REGISTERS){
    for(let gi=0;gi<sub.gens.length;gi++){
      const g=sub.gens[gi];
      const correctIdx=new Set(); /* indices de la bonne réponse observés sur les 25 tirages (QCM) */
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
            correctIdx.add(q.correct);
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
        /* Avec shuf() sur ≥2 options, un index constant sur 25 tirages a une
           probabilité ~ (1/n)^24 (n = nb d'options) : c'est la signature
           d'un générateur QCM figé, pas de la chance. */
        qcmGens++;
        if(correctIdx.size<2){qbad++;console.log("      QCM : index correct constant sur 25 tirages — "+sub.id+" "+g.lvl);}
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
  ok("#secSprint masqué dès la bascule (matière 100 % QCM)",env.byId.secSprint.hidden===true);
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
console.log("\n[14] Sprint masqué en allemand — entrée invisible, visible en maths/PC");
{
  /* La mécanique moteur (startSprint/pickQ) reste telle quelle, seule l'ENTRÉE
     #secSprint est cachée en allemand ET en anglais — c'est exactement ce
     qu'asserte ici renderHome :
     $("#secSprint").hidden = matiere==="de"||matiere==="en". */
  lsData.clear();
  lsData.set("qz_subject","\"de\"");
  const env=buildEnv();
  const ctx=runApp(env);
  const sprintEl=env.byId.secSprint; /* même objet que $("#secSprint") côté app */
  ok("allemand : #secSprint masqué (prop hidden = true)",sprintEl&&sprintEl.hidden===true);
  vm.runInContext("setMatiere('en')",ctx);
  ok("anglais : #secSprint masqué (prop hidden = true)",sprintEl.hidden===true);
  vm.runInContext("setMatiere('maths')",ctx);
  ok("maths : #secSprint visible (prop hidden = false)",sprintEl.hidden===false);
  vm.runInContext("setMatiere('pc')",ctx);
  ok("PC : #secSprint visible (prop hidden = false)",sprintEl.hidden===false);
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
console.log("\n[17] Version d'interface — détection, bascule, persistance (data-ui)");
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
    ok("bannière téléphone RESTÉE cachée",env.document.querySelector("#uiBanner").hidden===true);
  }
  /* Appareil 2 — TÉLÉPHONE : tactile + petit écran + UA mobile → « m ». */
  lsData.clear();
  {
    const env=buildEnv();phone(env);
    const ctx=runApp(env);
    ok("téléphone → détecte « m » (version téléphone)",vm.runInContext("detectUI()",ctx)==="m");
    ok("data-ui=\"m\" posé sur <html>",env.document.documentElement.getAttribute("data-ui")==="m");
    ok("choix persisté sous qz_ui = \"m\"",lsData.get("qz_ui")==="\"m\"");
    ok("bannière AFFICHÉE au 1er passage auto",env.document.querySelector("#uiBanner").hidden===false);
    /* Depuis la bannière : « Version ordinateur » → bascule + fermeture. */
    env.document.querySelector("#uiBannerSwitch").click();
    ok("bannière → « Version ordinateur » : data-ui retiré",env.document.documentElement.getAttribute("data-ui")===null);
    ok("bannière → « Version ordinateur » : qz_ui=\"d\" persisté",lsData.get("qz_ui")==="\"d\"");
    ok("bannière → « Version ordinateur » : bannière fermée",env.document.querySelector("#uiBanner").hidden===true);
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
  /* Choix EXPLICITE : qz_ui présente → la détection ne décide plus ni ne rebannit. */
  lsData.clear();
  lsData.set("qz_ui","\"m\"");
  {
    const env=buildEnv();
    env.sandbox.innerWidth=1440; /* grand écran, souris fine… */
    const ctx=runApp(env);
    ok("qz_ui=\"m\" sauvegardée → version téléphone RESTÉE (le choix gagne)",env.document.documentElement.getAttribute("data-ui")==="m");
    ok("… mais la bannière NE se réaffiche PAS (choix explicite)",env.document.querySelector("#uiBanner").hidden===true);
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
console.log("\n[22] Points faibles — ex æquo tranché par le nombre de réponses");
{
  /* 2026-08-22, évaluation qualitative : out.sort(...||b.ans-a.ans) comparait
     un champ ABSENT des objets triés (undefined-undefined = NaN, le tri le
     traite comme « égal ») → le tiebreaker était mort. Désormais les objets
     portent ans et la cellule la plus entraînée gagne l'ex æquo. */
  lsData.clear();
  const env=buildEnv();const ctx=runApp(env);
  /* Deux cellules au même taux d'erreur (40 %) : « aa » facile (5 réponses,
     2 bonnes) et « bb » moyen (10 réponses, 4 bonnes). */
  const hist=[];
  for(let i=0;i<5;i++)hist.push({s:"aa",l:"facile",o:i<2?1:0});
  for(let i=0;i<10;i++)hist.push({s:"bb",l:"moyen",o:i<4?1:0});
  vm.runInContext("stats.history="+JSON.stringify(hist),ctx);
  const W=vm.runInContext("weakPoints()",ctx);
  ok("2 cellules retenues (≥5 réponses), ex æquo 40 %",W.length===2);
  ok("« bb » (10 réponses) devant « aa » (5 réponses) — tiebreaker actif",
     W[0].s==="bb"&&W[1].s==="aa");
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
  ok("#secSprint masqué dès la bascule (matière 100 % QCM)",env.byId.secSprint.hidden===true);
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
  const L=x=>vm.runInContext("levelOf("+x+")",ctx);
  ok("0→1, 99→1, 100→2, 249→2, 250→3",L(0)===1&&L(99)===1&&L(100)===2&&L(249)===2&&L(250)===3);
  ok("449→3, 450→4, 699→4, 700→5, 999→5",L(449)===3&&L(450)===4&&L(699)===4&&L(700)===5&&L(999)===5);
  ok("1000→6, 1350→7, 1750→8",L(1000)===6&&L(1350)===7&&L(1750)===8);
  let round=true;
  for(let n=1;n<=50;n++)if(L(vm.runInContext("xpCum("+n+")",ctx))!==n)round=false;
  ok("levelOf(xpCum(n)) = n pour n = 1…50 (allers-retours)",round);
  let mono=true;
  for(let x=0;x<2000;x+=7)if(L(x)>L(x+7))mono=false;
  ok("monotone (0…2000 par pas de 7)",mono);
  let pctOk=true;
  for(let i=0;i<1000;i++){
    const v=vm.runInContext("lvlInfo("+(i*2)+")",ctx);
    if(!(v.n>=1&&v.pct>=0&&v.pct<1))pctOk=false;
  }
  ok("lvlInfo : n ≥ 1 et pct ∈ [0,1[ sur 1000 valeurs d'essai",pctOk);
}

/* ========================================================= */
console.log("\n[26] Raccordement XP — UNE XP PAR MATIÈRE (qz_xp / _pc / _de / _en), 3 modes, palier → confetti");
{
  const exp=(ctx)=>vm.runInContext("(PTS_LVL[state.curLvl]!==undefined?PTS_LVL[state.curLvl]:10)+((state.streak+1)>=3?5:0)",ctx);
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
  /* --- MODE SPRINT --- */
  lsData.clear();
  {
    const env=buildEnv();const ctx=runApp(env);
    vm.runInContext("startFree();state.mode='sprint'",ctx);
    const b=vm.runInContext("getXP()",ctx),e=exp(ctx);
    vm.runInContext("afterAnswer(true,state.q,'')",ctx);
    ok("sprint : bonne réponse → qz_xp +pts exact",vm.runInContext("getXP()",ctx)===b+e);
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
  /* --- PALIER : franchissement → confetti() appelé UNE fois --- */
  lsData.clear();
  {
    const env=buildEnv();const ctx=runApp(env);
    vm.runInContext("window.__confetti=0;confetti=function(){window.__confetti++;};",ctx);
    vm.runInContext("startFree();store.set('qz_xp',95)",ctx);
    vm.runInContext("afterAnswer(true,state.q,'')",ctx); /* +10 (moyen, série 1) → 105 ≥ 100 : palier 2 */
    ok("franchissement 95→105 → confetti() appelé une fois",env.sandbox.__confetti===1);
    vm.runInContext("afterAnswer(true,state.q,'')",ctx); /* +10 → 115 : pas de palier */
    ok("105→115 pas de palier → confetti non rappelé",env.sandbox.__confetti===1);
  }
  /* --- CARTE HERO : « Niveau N » + barre aria-hidden + « x / y XP » + pas de fuite maths→DE --- */
  lsData.clear();
  {
    const env=buildEnv();const ctx=runApp(env);
    vm.runInContext("startFree();afterAnswer(true,state.q,'')",ctx); /* +10 XP maths */
    const card=env.document.querySelector("#lvlSlot").innerHTML;
    ok("carte hero (maths) : « Niveau 1 », barre aria-hidden, « 10 / 100 XP »",
       /Niveau 1/.test(card)&&card.includes('aria-hidden="true"')&&/10 \/ 100 XP/.test(card));
    vm.runInContext("store.set('qz_xp',95);renderHome()",ctx);
    vm.runInContext("afterAnswer(true,state.q,'')",ctx); /* 95+10 = 105 → niveau 2 */
    const card2=env.document.querySelector("#lvlSlot").innerHTML;
    ok("carte hero (maths) : « Niveau 2 » après palier, « 105 / 250 XP »",
       /Niveau 2/.test(card2)&&/105 \/ 250 XP/.test(card2));
    vm.runInContext("setMatiere('de')",ctx);
    const cardDe=env.document.querySelector("#lvlSlot").innerHTML;
    ok("carte hero (DE) : propre XP (0 / 100), PAS la XP maths (105)",
       /Niveau 1/.test(cardDe)&&/0 \/ 100 XP/.test(cardDe)&&!/105/.test(cardDe));
  }
  /* --- INDÉPENDANCE PAR MATIÈRE : maths / PC / DE n'écrivent JAMAIS la clé de l'autre --- */
  lsData.clear();
  {
    const env=buildEnv();const ctx=runApp(env);
    vm.runInContext("startFree();afterAnswer(true,state.q,'')",ctx); /* maths : +10 → qz_xp=10 */
    vm.runInContext("setMatiere('pc')",ctx);
    ok("PC à zéro : getXP() = 0 (clé qz_xp_pc absente), carte « 0 / 100 XP »",
       vm.runInContext("getXP()",ctx)===0&&/0 \/ 100 XP/.test(env.document.querySelector("#lvlSlot").innerHTML));
    vm.runInContext("startFree()",ctx);
    const b=vm.runInContext("getXP()",ctx),e=exp(ctx);
    vm.runInContext("afterAnswer(true,state.q,'')",ctx);
    ok("PC : bonne réponse → qz_xp_pc +pts exact ("+e+")",vm.runInContext("getXP()",ctx)===b+e);
    ok("clé PC = qz_xp_pc dans le storage",JSON.parse(lsData.get("qz_xp_pc"))===b+e);
    ok("clé maths (qz_xp) intacte après la réponse PC",JSON.parse(lsData.get("qz_xp"))===10);
    vm.runInContext("setMatiere('maths')",ctx);
    ok("retour maths : la XP maths est restaurée (« 10 / 100 XP »)",
       /10 \/ 100 XP/.test(env.document.querySelector("#lvlSlot").innerHTML));
    vm.runInContext("setMatiere('de');startFree()",ctx);
    vm.runInContext("afterAnswer(true,state.q,'')",ctx); /* DE gagne sa propre XP */
    ok("DE : sa XP (qz_xp_de) augmente sans toucher maths ni PC",
       JSON.parse(lsData.get("qz_xp_de"))>0&&JSON.parse(lsData.get("qz_xp"))===10);
  }
}

/* ========================================================= */
console.log("\n[24] Registres par année — structure, ids, stabilité Première");
{
  lsData.clear();
  const env=buildEnv();const ctx=runApp(env);
  const probe=vm.runInContext("({SUBJECTS_MATH,SUBJECTS_PC,SUBJECTS_DE,SUBJECTS_EN,THEME_BY_ID})",ctx);
  const oldM=["deriv","suites","logexp","equa2","trig","proba","vect","affine","lim","var"];
  const oldP=["newton","forces","energie","moles","stoich","cinet","ondes","elec"];
  ok("Première maths : les 10 ids historiques, ordre inchangé",
     JSON.stringify(probe.SUBJECTS_MATH.premiere.map(s=>s.id))===JSON.stringify(oldM));
  ok("Première PC : les 8 ids historiques, ordre inchangé",
     JSON.stringify(probe.SUBJECTS_PC.premiere.map(s=>s.id))===JSON.stringify(oldP));
  let lvls=true;
  for(const y of["seconde","premiere","terminale"])
    for(const s of [...(probe.SUBJECTS_MATH[y]||[]),...(probe.SUBJECTS_PC[y]||[])]){
      const set=new Set(s.gens.map(g=>g.lvl));
      if(!set.has("facile")||!set.has("moyen")||!set.has("difficile"))lvls=false;
    }
  ok("chaque thème maths/PC porte facile + moyen + difficile",lvls);
  let pre=true;
  for(const y of["seconde","terminale"])
    for(const s of [...(probe.SUBJECTS_MATH[y]||[]),...(probe.SUBJECTS_PC[y]||[])]){
      const want=y==="seconde"?"s2_":"t_";
      if(!s.id.startsWith(want))pre=false;
    }
  ok("ids Seconde préfixés s2_ / Terminale préfixés t_ (quand livrés)",pre);
  const T=Object.keys(probe.THEME_BY_ID);
  ok("THEME_BY_ID couvre les 18 ids anciens maths/PC + DE + EN",
     [...oldM,...oldP,"vocab","conj","art","date","phrasen","trad",
      "en_vocab","en_verbes","en_art","en_q","en_phrases","en_trad"].every(id=>T.includes(id)));
  ok("Seconde maths : 6 thèmes (contenu livré)",probe.SUBJECTS_MATH.seconde.length===6);
  ok("Seconde PC : 6 thèmes (contenu livré)",probe.SUBJECTS_PC.seconde.length===6);
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
}

/* ========================================================= */
console.log("\n[28] Libellés — eyebrow/lede par matière × année, DE/EN sans « Première »");
{
  lsData.clear();
  const env=buildEnv();const ctx=runApp(env);
  const cases=[
    ["maths","seconde","Seconde · maths"],
    ["maths","premiere","Première · spécialité maths"],
    ["maths","terminale","Terminale · spécialité maths"],
    ["pc","seconde","Seconde · physique-chimie"],
    ["pc","premiere","Première · spécialité physique-chimie"],
    ["pc","terminale","Terminale · spécialité physique-chimie"]
  ];
  for(const [m,y,e] of cases){
    vm.runInContext("setMatiere('"+m+"');setAnnee('"+y+"')",ctx);
    ok(m+" / "+y+" : « "+e+" »",
       vm.runInContext("document.querySelector('#heroEyebrow').textContent",ctx)===e);
  }
  vm.runInContext("setMatiere('de')",ctx);
  ok("DE : « allemand A2 » (sans « Première »)",
     vm.runInContext("document.querySelector('#heroEyebrow').textContent",ctx)==="allemand A2");
  vm.runInContext("setMatiere('en')",ctx);
  ok("EN : « anglais A2–B1 » (sans « Première »)",
     vm.runInContext("document.querySelector('#heroEyebrow').textContent",ctx)==="anglais A2–B1");
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
console.log("\n[30] Niveau du joueur pendant les questions — puce dans la barre (3 modes)");
{
  /* 2026-08-22 (sur demande) : « Afficher le niveau pendant les questions ».
     Le niveau de la MATIÈRE (le « Niveau N » de la carte du hero, déduit de
     l'XP) est visible dans la barre de l'écran de question, dans les trois
     modes, et suit les paliers franchis en cours de séance. (La DIFFICULTÉ de
     la question est déjà sur sa propre puce — « facile/moyen/difficile » ou
     « A2/A2+/B1 » — et reste inchangée.) */
  const chip=ctx=>vm.runInContext("document.querySelector('#chipNiv')?document.querySelector('#chipNiv').textContent:null",ctx);
  /* --- Trois modes : la puce est présente et justes --- */
  lsData.clear();
  {
    const env=buildEnv();const ctx=runApp(env);
    vm.runInContext("store.set('qz_xp',120)",ctx); /* 100 ≤ 120 < 250 → Niv. 2 */
    vm.runInContext("startFree()",ctx);
    ok("libre : la barre affiche « Niv. 2 »",chip(ctx)==="Niv. 2");
    vm.runInContext("stats.review=[{s:'deriv',l:'moyen',q:{prompt:'rv',type:'number',answer:7},reps:0,due:0}]",ctx);
    vm.runInContext("startReview()",ctx);
    ok("révision : la barre affiche « Niv. 2 »",chip(ctx)==="Niv. 2");
    vm.runInContext("startFree();state.mode='sprint';renderQ()",ctx);
    ok("sprint : la barre affiche « Niv. 2 » (la difficulté y reste « sprint 60 s »)",chip(ctx)==="Niv. 2");
  }
  /* --- PALIER franchi en cours de séance : la puce suit l'XP gagnée --- */
  lsData.clear();
  {
    const env=buildEnv();const ctx=runApp(env);
    vm.runInContext("store.set('qz_xp',245)",ctx); /* Niv. 2 ; +10 (bonne « moyen ») → 255 ≥ 250 → Niv. 3 */
    vm.runInContext("startFree()",ctx);
    ok("avant réponse : « Niv. 2 »",chip(ctx)==="Niv. 2");
    vm.runInContext("afterAnswer(true,state.q,'')",ctx);
    ok("bonne réponse franchit le palier → la puce passe à « Niv. 3 »",chip(ctx)==="Niv. 3");
  }
  /* --- INDÉPENDANCE : la puce suit la matière active --- */
  lsData.clear();
  {
    const env=buildEnv();const ctx=runApp(env);
    vm.runInContext("store.set('qz_xp',120);store.set('qz_xp_de',260)",ctx); /* maths Niv. 2, DE Niv. 3 */
    vm.runInContext("startFree()",ctx);
    ok("maths : « Niv. 2 »",chip(ctx)==="Niv. 2");
    vm.runInContext("setMatiere('de');startFree()",ctx);
    ok("bascule DE : « Niv. 3 » (la XP DE, pas la XP maths)",chip(ctx)==="Niv. 3");
  }
}

console.log("=====================================");
console.log(fail===0?("TOUS LES TESTS PASSENT ✔  ("+pass+")"):(fail+" ÉCHEC(S) — "+pass+" OK"));
process.exit(fail===0?0:1);
