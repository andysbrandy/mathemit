/* ============================================================
   Mathe mit AndyBrandy - Aktives JS (wird oft erweitert)
   Inhalt: Game-State, UI-Rendering, Auth, Progress-Sync.
   Nutzt window.MB aus app-base.js (statische Daten/Generatoren).
   ============================================================ */
(function(){
  "use strict";

  // Referenz auf statische Daten aus app-base.js
  var choice      = MB.choice;
  var fmtAT       = MB.fmtAT;
  var fmtEUR      = MB.fmtEUR;
  var COLORS      = MB.COLORS;
  var GEN         = MB.GEN;
  var MODES       = MB.MODES;
  var GRADES         = MB.GRADES;
  var GRADE_GROUPS   = MB.GRADE_GROUPS;
  var GRADE_TAGS     = MB.GRADE_TAGS;
  var DIFFICULTIES  = MB.DIFFICULTIES;
  var TIPP1_BY_TOPIC = MB.TIPP1_BY_TOPIC;
  var deriveTips   = MB.deriveTips;
  var spacedSanitize = MB.spacedSanitize;
  var spacedWrong = MB.spacedWrong;
  var spacedCorrect = MB.spacedCorrect;
  var spacedDueKeys = MB.spacedDueKeys;
  var spacedAmpel = MB.spacedAmpel;
  // ENCOURAGE_OK / ENCOURAGE_BAD / LEVELS / BADGES sind in dieser Datei lokal definiert.

  // ---- Render-Hilfsfunktionen (basieren auf app-base.js) ----
  var renderFigure         = MB.renderFigure;
  var updateCurriculumBadge = MB.updateCurriculumBadge;
  var openCurriculumModal  = MB.openCurriculumModal;
  var closeCurriculumModal = MB.closeCurriculumModal;

/* ============ Game state ============ */
var state = {
  mode: "alles",
  grade: "all",
  diff: 2,
  points: 0,
  streak: 0,
  bestStreak: 0,
  solved: 0,
  correct: 0,
  current: null,
  spaced: {},   /* P4.3: Leiter je Generatorkey: {key:[dueEpochSek, level]} */
  repeatQ: [], repeatIdx: 0, repeatIdxCurrent: 0, currentIsRepeat: false, repeatOnly: false, taskCount: 0, currentWasDue: false, wrongRow: 0, focusKey: null,
  answered: false,
  badges: [], owls: [1],
  weekly: { week:"", points:0, solved:0, repeats:0, done:[], bonusGiven:false }
};
var missByGen = {}, hitByGen = {}; // P2.2: Fehler-/Treffer-Serien je Übungstyp (Session)

/* P6: Endlose Stufen — Mathematik & Eulen-Engine liegen in app-base.js (MB.*) */
var punkteFuerStufe = MB.punkteFuerStufe;
var stufeVonPunkten = MB.stufeVonPunkten;
var rangTitel = MB.rangTitel;
var owlForLevel = MB.owlForLevel;
var owlSVG = MB.owlSVG;
var owlInner = MB.owlInner;
var WOCHENZIELE = MB.WOCHENZIELE;
var wochenSchluessel = MB.wochenSchluessel;
var CURRICULUM_MAP = MB.CURRICULUM_MAP;
var WALD_BEREICHE = MB.WALD_BEREICHE;
var waldStatus = MB.waldStatus;
var bereichFuerKey = MB.bereichFuerKey;
function currentLevel(){
  var s = stufeVonPunkten(state.points);
  return { stufe:s, name:rangTitel(s), min:punkteFuerStufe(s) };
}
function nextLevel(){
  var s = stufeVonPunkten(state.points)+1;
  return { stufe:s, name:rangTitel(s), min:punkteFuerStufe(s) };
}
function sanitizeOwls(list){
  var out = [];
  if(Array.isArray(list)){
    list.forEach(function(v){ v = Number(v); if(v>=1 && v<=5000 && out.indexOf(v)===-1) out.push(v); });
  }
  if(out.indexOf(1)===-1) out.push(1); /* Stufe 1 = Start-Eule */
  out.sort(function(a,b){ return a-b; });
  return out;
}
function ensureOwls(){
  var s = stufeVonPunkten(state.points);
  var neu = false;
  for(var i=1;i<=s;i++){ if(state.owls.indexOf(i)===-1){ state.owls.push(i); neu = true; } }
  if(neu) state.owls.sort(function(a,b){ return a-b; });
  return neu;
}
/* P4.2: Wöchentliche Ziele */
function sanitizeWochen(d){
  var cur = wochenSchluessel();
  if(!d || typeof d !== "object" || d.week !== cur){
    return { week:cur, points:0, solved:0, repeats:0, repeatsNew:0, done:[], bonusGiven:false };
  }
  var validIds = WOCHENZIELE.map(function(z){ return z.id; });
  return {
    week: cur,
    points: Math.max(0, Math.min(99999, Number(d.points) || 0)),
    solved: Math.max(0, Math.min(99999, Number(d.solved) || 0)),
    repeats: Math.max(0, Math.min(99999, Number(d.repeats) || 0)),
    repeatsNew: Math.max(0, Math.min(9999, Number(d.repeatsNew) || 0)),
    done: (Array.isArray(d.done) ? d.done : []).filter(function(v){ return validIds.indexOf(v) !== -1; }),
    bonusGiven: !!d.bonusGiven
  };
}
function ensureWochen(){
  var cur = wochenSchluessel();
  if(!state.weekly || state.weekly.week !== cur){
    state.weekly = sanitizeWochen(state.weekly);
  }
}
/* P4.2: Ziel-Helfer — das Wiederholungsziel wächst dynamisch (Ziel = falsche Aufgaben der Woche) */
function wzZiel(z){
  if(z.dynamisch){ return Math.max(0, Number(state.weekly.repeatsNew) || 0); }
  return z.ziel;
}
function wzWert(z){
  return Math.max(0, Number(state.weekly[z.id]) || 0);
}
function wzErreicht(z){
  return wzWert(z) >= wzZiel(z);
}
function pruefeWochenziele(){
  ensureWochen();
  var neu = [];
  WOCHENZIELE.forEach(function(z){
    var erreicht = wzErreicht(z);
    var warErreicht = state.weekly.done.indexOf(z.id) !== -1;
    if(erreicht && !warErreicht){
      state.weekly.done.push(z.id);
      /* 0/0 (noch kein Fehler diese Woche) feiert keinen Banner — nur echtes Schaffen */
      if(!z.dynamisch || wzZiel(z) > 0){ neu.push(z); }
    } else if(!erreicht && warErreicht){
      /* Ziel wieder offen (z. B. neuer Fehler beim Wiederholungsziel) */
      state.weekly.done = state.weekly.done.filter(function(id){ return id !== z.id; });
    }
  });
  var alle = WOCHENZIELE.every(wzErreicht);
  var bonus = false;
  if(alle && !state.weekly.bonusGiven){
    state.weekly.bonusGiven = true;
    state.points += 30; /* Wochen-Bonus → treibt Stufen & Eulen zusätzlich an */
    bonus = true;
  }
  return { neue: neu, bonus: bonus };
}
/* P4.2/P4.4: Kompakte Wochenziel-Balken (eine Zeile: Headline + Balken + Label) + Klick-Details */
function renderWochenziele(){
  var row = document.getElementById("weeklyRow");
  if(!row) return;
  var barsHost = row.querySelector("#weeklyBars");
  if(!barsHost) return;
  ensureWochen();
  var html = WOCHENZIELE.map(function(z){
    var wert = wzWert(z), ziel = wzZiel(z);
    var fertig = wzErreicht(z);
    var pct = ziel > 0 ? Math.max(0, Math.min(100, (wert / ziel) * 100)) : 100;
    var count = ziel > 0 ? (Math.min(wert, ziel) + "/" + ziel) : "0/0";
    if(fertig) count = count + " ✅";
    return '<div class="weekly-goal'+(fertig ? ' fertig' : '')+'" data-goal-id="'+z.id+'" title="'+z.label+'" role="button" tabindex="0">'
      + '<span class="weekly-bar"><span class="weekly-bar-fill" style="width:'+pct+'%"></span></span>'
      + '<span class="weekly-bar-label">'+z.icon+' '+count+'</span>'
      + '</div>';
  }).join("");
  barsHost.innerHTML = html;
  Array.prototype.forEach.call(barsHost.querySelectorAll(".weekly-goal"), function(goal){
    goal.addEventListener("click", function(){ toggleWeeklyDetails(goal); });
  });
}
function toggleWeeklyDetails(goal){
  var details = document.getElementById("weeklyDetails");
  if(!details) return;
  var row = document.getElementById("weeklyRow");
  if(row){
    Array.prototype.forEach.call(row.querySelectorAll(".weekly-goal"), function(g){
      g.classList.remove("active");
    });
  }
  var expanded = details.style.display === "block";
  details.style.display = expanded ? "none" : "block";
  if(expanded) return;
  goal.classList.add("active");
  var goalId = goal.dataset.goalId;
  var z = null;
  WOCHENZIELE.forEach(function(zz){ if(zz.id === goalId) z = zz; });
  if(!z) return;
  var wert = wzWert(z), ziel = wzZiel(z);
  var msg;
  if(z.id === "points"){
    msg = "🎯 Noch " + Math.max(0, ziel - wert) + " Punkte — jede richtige Aufgabe bringt dich näher!";
  } else if(z.id === "solved"){
    msg = "📚 Noch " + Math.max(0, ziel - wert) + " richtige Aufgaben — bleib dran, du schaffst das!";
  } else if(ziel > 0){
    msg = "🔁 " + wert + " von " + ziel + " Wiederholungen geschafft. Jede falsche Aufgabe landet hier — bis du sie wieder sicher löst!";
  } else {
    msg = "🎉 Keine offenen Wiederholungen — bisher keine Fehler diese Woche!";
  }
  var bonusTxt = state.weekly.bonusGiven
    ? "🎁 Wochen-Bonus diese Woche schon kassiert (+30 Punkte)."
    : "🎯 Schaffe <strong>alle 3 Ziele</strong> = <strong>+30 Bonus-Punkte</strong>!";
  details.innerHTML = '<strong>'+z.icon+' '+z.label+'</strong><br>'+msg+'<br><br>'+bonusTxt;
}
function showWochenBanner(wz){
  var fb = document.getElementById("feedback");
  if(!fb) return;
  var teile = wz.neue.map(function(z){ return z.icon+" "+z.label; });
  if(wz.bonus) teile.push("🎁 <strong>+30 Bonus-Punkte!</strong>");
  if(!teile.length) return;
  var div = document.createElement("div");
  div.className = "eh-levelup";
  div.innerHTML = "🏁 <strong>Wochenziel geschafft:</strong> " + teile.join(" · ");
  fb.appendChild(div);
}

var ENCOURAGE_OK = ["Super gemacht! 🎉","Genau richtig! 👏","Klasse, weiter so! ✨","Stark! Das sitzt. 💪","Perfekt gelöst! 🌟","Richtig! Du bist auf einem guten Weg. 🚀"];
var ENCOURAGE_BAD = ["Nicht ganz – schau dir die Erklärung an. 🧭","Fast! Lies dir die Lösung durch. 📘","Kein Problem, das übst du gleich noch mal. 🔁","Diesmal nicht, aber dranbleiben lohnt sich! 🌱"];

/* ============ P4.4: Motivations-Engine — dynamische Lobsprüche ============ */
function getMotd(isCorrect, streak, levelAfter, currentWasDue){
  /* Streak-basierte Triumphe: jede "Meilenstein"-Streak bekommt einen besonderen Spruch */
  var streakMilestones = {
    3:  ["🔥 Super Saft! Deine Serie steigt!","🎯 3 in Folge — geht perfekt!","💪 Saft gezogen — weiter so!!"],
    5:  ["🔥🔥 Fünf in Folge! Du bist unbesiegbar! 🌟","🏆 Super Saft! Deine Mathe-Bahn ist in Fahrt!",""],
    10: ["🔥🔥🔥 Zehn in Folge! Mathe-Legende in dir!","🧠 Geniesst du das Wort-Spiel? 100% Treffer!","🚀 Rakete ge start — 10 x richtig!"],
    20: ["🌟 Ewige Bestien! 20 richtig in Folge!","🦸 Superheld! Dein Wissen ist unübertroffen!"]
  };
  /* Level-basierte Anerkennung: höhere Stufen verdienen Ehrung */
  var levelSprueche = {
    3: ("🥉 Dein Wissen wächst — Stufe " + levelAfter + " erreicht!"),
    5: ("🥈 Goldrichtig! Stufe " + levelAfter + " — du bist ein echter Mathe-Profi!"),
    10:("🥇 Aschee, Miese! Stufe " + levelAfter + "! Du bist eine Legende!"),
    20:("🧠 Mathephänomen Stufe " + levelAfter + "! Die Lehrbücher zittern vor dir!")
  };
  /* Wiederholungs-spezifische Erfolgsbotschaften */
  if(currentWasDue && isCorrect){
    return choice(["🧠 Hervorragend! Du hast eine alte Schwäche korrigiert.","🔄 Wiederhole und triumphierst — Mathe-Elefant!","💎 Du hast eine Wiederholung gemeistert und befördert!"]);
  }
  /* Streak-Meilenstein */
  if(isCorrect){
    var m = streakMilestones[streak];
    if(m && m.length > 0){ return choice(m); }
    /* Level-Meilenstein */
    var l = levelSprueche[levelAfter];
    if(l){ return l; }
    /* Streak-Warnung (noch kurz vor dem nächsten Milestone) */
    var nextMilestone = 3;
    if(streak >= 10){ nextMilestone = 20; }
    else if(streak >= 5){ nextMilestone = 10; }
    else if(streak >= 3){ nextMilestone = 5; }
    if(streak > 0 && streak < nextMilestone){
      var remaining = nextMilestone - streak;
      if(remaining <= 2){
        return "🔥 Noch " + remaining + " richtig für deinen nächsten Lobspruch! ";
      }
    }
    return choice(ENCOURAGE_OK);
  }
  /* Falsch: Motivation statt Diskourage */
  if(streak > 3){
    return choice(["🔁 Dein Feuer ist nicht erloschen! Versuchs nochmal.","Stärke, die Serie ist lang — du packst das!💪","Ein harter Schnitt? Komm schon, hol dir deine Serie zurück! 🔥"]);
  }
  return choice(ENCOURAGE_BAD);
}

/* ============ Fortschritt speichern (Phase 2) ============ */
var STORAGE_KEY = "formenwerkstatt_progress_v1";
function saveProgress(){
  try{
    var data = {
      points:state.points, streak:state.streak, bestStreak:state.bestStreak,
      solved:state.solved, correct:state.correct, badges:state.badges,
      mode:state.mode, grade:state.grade, diff:state.diff,
      repeatQ:state.repeatQ, owls:state.owls, weekly:state.weekly,
    spaced:state.spaced
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }catch(e){ /* z. B. Privatmodus ohne Speicherzugriff - Fortschritt bleibt dann nur für diese Sitzung erhalten */ }
}
function loadProgress(){
  try{
    var raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return;
    var d = JSON.parse(raw);
    state.points = d.points||0;
    state.streak = d.streak||0;
    state.bestStreak = d.bestStreak||0;
    state.solved = d.solved||0;
    state.correct = d.correct||0;
    state.badges = d.badges||[];
    state.mode = MODES.some(function(m){return m.id===d.mode;}) ? d.mode : "alles";
    state.grade = GRADES.some(function(g){return g.id===d.grade;}) ? d.grade : "all";
    state.diff = (d.diff===1 || d.diff===2 || d.diff===3) ? d.diff : 2;
    state.repeatQ = sanitizeRepeatQ(d.repeatQ);
    state.spaced = spacedSanitize(d.spaced);
    state.owls = sanitizeOwls(d.owls);
    ensureOwls();
    state.weekly = sanitizeWochen(d.weekly);
  }catch(e){ /* beschädigter oder fehlender Speicher wird ignoriert, App startet mit Standardwerten */ }
}
function resetProgress(){
  state.points=0; state.streak=0; state.bestStreak=0; state.solved=0; state.correct=0; state.badges=[]; state.owls=[1]; state.spaced={}; state.repeatQ=[]; state.repeatIdx=0; state.repeatOnly=false; state.taskCount=0; state.wrongRow=0; state.focusKey=null; state.weekly = sanitizeWochen(null);
  try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}
  updateStatsUI();
}

loadProgress();

/* ============ Rendering ============ */
var chipsHost = document.getElementById("chips");
var lastGroup = null;
MODES.forEach(function(m){
  if(m.group && m.group !== lastGroup){
    if(lastGroup !== null){
      var sep = document.createElement("span");
      sep.className = "chip-divider";
      sep.textContent = "·";
      chipsHost.appendChild(sep);
    }
    lastGroup = m.group;
  }
  var btn = document.createElement("button");
  btn.className = "chip" + (m.id===state.mode?" active":"");
  var modeId = m.id;
  btn.textContent = m.label;
  btn.dataset.mode = modeId;
  btn.addEventListener("click", function(){
    state.mode = modeId;
    setFocusKey(null);
    Array.prototype.forEach.call(chipsHost.querySelectorAll(".chip"), function(c){ if(c.id !== "repeatChip"){ c.classList.remove("active"); } });
    btn.classList.add("active");
    saveProgress();
    scrollActiveChip();
    nextExercise();
  });
  chipsHost.appendChild(btn);
});
/* P4.3: Wissens-Ampel — subtiler Hintergrund-Verlauf im Ampelfarbton (kein Dot) */
function updateModeAmpel(){
  var nowSec = Math.floor(Date.now()/1000);
  MODES.forEach(function(m){
    var a = spacedAmpel(state.spaced, m.pool, nowSec);
    var host = chipsHost.querySelector('[data-mode="'+m.id+'"]');
    if(host){
      host.classList.remove("ampel-rot", "ampel-gelb", "ampel-gruen");
      host.classList.add("ampel-" + a);
    }
  });
}

/* P4.3: Wiederholungs-Chip (nur Sitzung, nicht persistiert) */
var repeatChip = document.createElement("button");
repeatChip.className = "chip";
repeatChip.id = "repeatChip";
repeatChip.style.display = "none";
repeatChip.title = "Falsch gelöste Aufgaben gezielt wiederholen";
repeatChip.addEventListener("click", function(){
  state.repeatOnly = !state.repeatOnly;
  repeatChip.classList.toggle("active", state.repeatOnly);
  nextExercise();
});
chipsHost.appendChild(repeatChip);
/* P4.1: Fokus-Chip — gezieltes Üben EINES Generators (aus dem Wissenswald) */
var focusChip = document.createElement("button");
focusChip.className = "chip";
focusChip.id = "focusChip";
focusChip.style.display = "none";
focusChip.title = "Fokus beenden — wieder alle Aufgaben des Modus üben";
focusChip.addEventListener("click", function(){
  setFocusKey(null);
  nextExercise();
});
chipsHost.appendChild(focusChip);
function updateFocusChip(){
  if(state.focusKey && GEN[state.focusKey]){
    var cm = CURRICULUM_MAP[state.focusKey];
    focusChip.textContent = "🎯 Fokus: " + (cm ? cm.kompetenz : state.focusKey) + " ✕";
    focusChip.style.display = "";
  } else {
    focusChip.style.display = "none";
  }
}
function setFocusKey(key){
  state.focusKey = (key && GEN[key]) ? key : null;
  updateFocusChip();
}
function updateRepeatChip(){
  var n = state.repeatQ.length;
  if(n > 0){
    repeatChip.style.display = "";
    repeatChip.textContent = "🔁 Wiederholungstraining (" + n + ")";
  } else {
    repeatChip.style.display = "none";
    if(state.repeatOnly){ state.repeatOnly = false; repeatChip.classList.remove("active"); }
  }
}
/* Aktiven Chip horizontal in die Mitte scrollen (block:'nearest' = keine vertikalen Sprünge) */
function scrollActiveChip(){
  var active = chipsHost.querySelector(".chip.active");
  if(active && active.scrollIntoView){
    active.scrollIntoView({behavior:"smooth", inline:"center", block:"nearest"});
  }
}
scrollActiveChip();

function sanitizeRepeatQ(list){
  var out = [];
  if(!Array.isArray(list)){ return out; }
  for(var i = 0; i < list.length && out.length < 15; i++){
    var e = list[i];
    if(e && e.k && GEN[e.k]){ out.push(e); }
  }
  return out;
}
function repeatSVG(){
  return "<svg viewBox=\"0 0 320 150\" xmlns=\"http://www.w3.org/2000/svg\"><rect x=\"22\" y=\"16\" width=\"276\" height=\"118\" rx=\"20\" fill=\"var(--paper)\" stroke=\"var(--line)\" stroke-width=\"2.5\"/><text x=\"160\" y=\"76\" text-anchor=\"middle\" font-size=\"42\">🔁</text><text class=\"dim-label\" x=\"160\" y=\"112\" text-anchor=\"middle\" font-size=\"15\">Wiederholung</text></svg>";
}
function storeRepeatInstance(ex){
  if(!ex || !state.currentKey){ return; }
  for(var i = 0; i < state.repeatQ.length; i++){ if(state.repeatQ[i].q === ex.question){ return; } }
  var inst = { k: state.currentKey, q: ex.question, h: ex.hint, a: ex.answer, it: ex.inputType, ch: ex.choices, ci: ex.correctIndex, u: ex.unit, tol: ex.tolerance, ex: ex.explanation, badge: ex.badge, bc: ex.badgeColor, topic: ex.topic, ck: ex.curriculumKey, df: state.diff, sv: ex.svg };
  if(state.repeatQ.length >= 15){ state.repeatQ.shift(); }
  state.repeatQ.push(inst);
}
function buildRepeatExercise(inst){
  return {
    category: "wiederholung", topic: inst.topic, curriculumKey: inst.ck,
    question: inst.q, hint: inst.h, answer: inst.a, explanation: inst.ex,
    inputType: inst.it, choices: inst.ch, correctIndex: inst.ci,
    unit: inst.u, tolerance: inst.tol,
    badge: "🔁 " + (inst.badge || "Wiederholung"), badgeColor: "#F2A93B",
    svg: inst.sv || repeatSVG(), diff: inst.df, key: inst.k
  };
}


var gradeChipsHost = document.getElementById("gradeChips");
GRADES.forEach(function(g){
  var btn = document.createElement("button");
  btn.className = "chip" + (g.id===state.grade?" active":"");
  btn.textContent = g.label;
  btn.dataset.grade = g.id;
  btn.addEventListener("click", function(){
    state.grade = g.id;
    Array.prototype.forEach.call(gradeChipsHost.children, function(c){ c.classList.remove("active"); });
    btn.classList.add("active");
    saveProgress();
    nextExercise();
  });
  gradeChipsHost.appendChild(btn);
});

/* Schwierigkeitsstufen (P2.1) */
var diffChipsHost = document.getElementById("diffChips");
DIFFICULTIES.forEach(function(d){
  var btn = document.createElement("button");
  btn.className = "chip" + (d.id===state.diff?" active":"");
  btn.textContent = d.label;
  btn.dataset.diff = d.id;
  btn.addEventListener("click", function(){
    state.diff = d.id;
    Array.prototype.forEach.call(diffChipsHost.children, function(c){ c.classList.remove("active"); });
    btn.classList.add("active");
    saveProgress();
    nextExercise();
  });
  diffChipsHost.appendChild(btn);
});

function updateStatsUI(){
  document.getElementById("pointsVal").textContent = state.points;
  document.getElementById("streakVal").textContent = state.streak;
  var streakPill = document.querySelector(".stat-pill.streak");
  if(streakPill) streakPill.classList.toggle("streak-on", state.streak > 0);
  /* Flamme antippbar: Pause/Weiter-Animation */
  var flameEl = document.querySelector(".flame");
  if(flameEl && !flameEl.dataset.flameBound){
    flameEl.dataset.flameBound = "1";
    flameEl.setAttribute("role","button");
    flameEl.setAttribute("tabindex","0");
    flameEl.title = "Flamme pausieren / weiterlaufen lassen";
    function toggleFlame(){
      var paused = streakPill.classList.toggle("flame-paused");
      flameEl.setAttribute("aria-pressed", paused ? "true" : "false");
    }
    flameEl.addEventListener("click", toggleFlame);
    flameEl.addEventListener("keydown", function(e){
      if(e.key === "Enter" || e.key === " "){ e.preventDefault(); toggleFlame(); }
    });
  }
  var lvl = currentLevel();
  document.getElementById("levelVal").textContent = lvl.name.split(" ")[0];
  document.getElementById("levelNameSmall").textContent = "Stufe "+lvl.stufe+" · "+lvl.name;
  var span = punkteFuerStufe(lvl.stufe+1)-lvl.min;
  var progressed = state.points - lvl.min;
  var pct = Math.max(0, Math.min(100, (progressed/span)*100));
  document.getElementById("levelFill").style.width = pct+"%";
  document.getElementById("levelNext").textContent = (span-progressed)+" Punkte bis Stufe "+(lvl.stufe+1)+" – neue Eule! 🦉";
  var owlCountEl = document.getElementById("owlCountVal");
  if(owlCountEl) owlCountEl.textContent = state.owls.length;
  document.getElementById("sessionStat").textContent = state.solved+" Aufgaben gelöst · "+state.correct+" richtig";
  renderWochenziele();
  /* P4.1: Wald-Fortschritt in der Baum-Pill */
  if(waldPctValEl){ waldPctValEl.textContent = waldStatus(state.spaced, Math.floor(Date.now()/1000)).pct + "%"; }
  renderBadges();
}

function maybeAwardBadge(id, label){
  if(state.badges.indexOf(id)===-1){
    state.badges.push(id);
    renderBadges();
  }
}
function renderBadges(){
  var host = document.getElementById("badges");
  var defs = {
    streak5: "🔥 Serie x5", streak10:"🔥🔥 Serie x10",
    solved10:"📚 10 gelöst", solved25:"📚 25 gelöst", solved50:"📚 50 gelöst"
  };
  host.innerHTML = state.badges.map(function(b){ return '<span class="badge">'+defs[b]+'</span>'; }).join("");
}

function checkBadges(){
  if(state.streak>=5) maybeAwardBadge("streak5");
  if(state.streak>=10) maybeAwardBadge("streak10");
  if(state.solved>=10) maybeAwardBadge("solved10");
  if(state.solved>=25) maybeAwardBadge("solved25");
  if(state.solved>=50) maybeAwardBadge("solved50");
}

var eyebrowMap = {
  winkel:"Winkel berechnen", umfang:"Umfang berechnen", flaeche:"Fläche berechnen",
  erkennen:"Form erkennen", eigenschaften:"Wahr oder falsch",
  volumen:"Volumen berechnen", bruch:"Mit Brüchen rechnen", prozent:"Prozent berechnen",
  textaufgabe:"Textaufgabe lösen"
};

function poolForCurrentFilters(){
  /* P4.1: Fokus aus dem Wissenswald — gezielt EINEN Generator üben */
  if(state.focusKey && GEN[state.focusKey]){ return [state.focusKey]; }
  var mode = MODES.filter(function(m){return m.id===state.mode;})[0];
  var pool = mode.pool;
  if(state.grade && state.grade!=="all"){
    var allowed = GRADE_GROUPS[state.grade];
    var filtered = pool.filter(function(k){
      var tags = GRADE_TAGS[k];
      return tags && tags.some(function(g){ return allowed.indexOf(g)!==-1; });
    });
    if(filtered.length>0) pool = filtered;
    // Falls die Kombination aus Thema und Schulstufe leer wäre, bleibt vorsichtshalber
    // der ungefilterte Themen-Pool erhalten, statt dass keine Aufgabe erscheint.
  }
  return pool;
}

function nextExercise(){
  var pool = poolForCurrentFilters();
  state.taskCount = state.taskCount + 1;
  var key;
  var ex;
  state.currentIsRepeat = false;
  state.currentWasDue = false;
  if(state.repeatOnly && state.repeatQ.length > 0){
    state.currentIsRepeat = true;
    state.repeatIdxCurrent = state.repeatIdx % state.repeatQ.length;
    ex = buildRepeatExercise(state.repeatQ[state.repeatIdxCurrent]);
    key = ex.key;
    state.repeatIdx = state.repeatIdx + 1;
  } else {
    if(state.repeatOnly){ state.repeatOnly = false; repeatChip.classList.remove('active'); }
    /* P4.3: Prioritätsrunde — fällige Leiter-Aufgaben zuerst (max. jede 2. Aufgabe) */
    var nowS = Math.floor(Date.now()/1000);
    var dueKeys = spacedDueKeys(state.spaced, nowS, pool);
    if(dueKeys.length > 0 && (state.taskCount % 2 === 0 || pool.length <= 1)){
      key = choice(dueKeys);
      state.currentWasDue = true;
    } else {
      key = choice(pool);
    }
    ex = GEN[key](state.diff);
  }
  state.currentKey = key;
  state.current = ex;
  state.answered = false;

  document.getElementById("eyebrow").textContent = eyebrowMap[ex.topic] || "Aufgabe";
  document.getElementById("questionText").textContent = ex.question;
  document.getElementById("hintText").textContent = "";
  var tips = deriveTips(ex);
  state.tipCount = tips.length;
  state.tipShown = 0;
  document.getElementById("tipBtn").style.display = tips.length ? "inline-block":"none";
  renderFigure(ex.svg, ex.badge, ex.badgeColor);
  updateCurriculumBadge(ex.curriculumKey);

  var answerArea = document.getElementById("answerArea");
  answerArea.innerHTML = "";
  if(ex.inputType==="number"){
    var row = document.createElement("div");
    row.className="answer-row";
    var input = document.createElement("input");
    input.type="text"; input.inputMode="decimal"; input.className="answer-input"; input.id="numInput";
    input.placeholder="Antwort";
    input.addEventListener("keydown", function(e){ if(e.key==="Enter"){ handleCheck(); } });
    var unit = document.createElement("span");
    unit.className="unit-label"; unit.textContent = ex.unit;
    row.appendChild(input); row.appendChild(unit);
    answerArea.appendChild(row);
    setTimeout(function(){ input.focus(); }, 50);
  } else {
    var grid = document.createElement("div");
    grid.className="choice-grid";
    ex.choices.forEach(function(c, i){
      var b = document.createElement("button");
      b.className="choice-btn"; b.textContent=c; b.dataset.index=i;
      b.addEventListener("click", function(){ handleChoice(i); });
      grid.appendChild(b);
    });
    answerArea.appendChild(grid);
  }

  updateRepeatChip();
  var fb = document.getElementById("feedback");
  fb.className="feedback"; fb.innerHTML="";
  document.getElementById("checkBtn").style.display = ex.inputType==="number" ? "inline-block":"none";
  document.getElementById("checkBtn").disabled=false;
  document.getElementById("nextBtn").style.display="none";
}

function finishRound(isCorrect, explanation){
  state.answered = true;
  var lvlBefore = stufeVonPunkten(state.points);
  if(isCorrect){ state.wrongRow = 0; } else { state.wrongRow = state.wrongRow + 1; }
  state.solved += 1;
  /* P2.2: Serien je Übungstyp tracken */
  var mk = state.currentKey;
  if(mk){
    if(isCorrect){ missByGen[mk]=0; hitByGen[mk]=(hitByGen[mk]||0)+1; }
    else { missByGen[mk]=(missByGen[mk]||0)+1; hitByGen[mk]=0; }
  }
  /* P4.3: Spaced-Repetition-Leiter pflegen (nur echte — keine Session-Repeats) */
  if(mk && !state.currentIsRepeat){
    var nowSec = Math.floor(Date.now()/1000);
    if(isCorrect){ state.spaced = spacedCorrect(state.spaced, mk, nowSec); }
    else { state.spaced = spacedWrong(state.spaced, mk, nowSec); }
  }
  ensureWochen();
  if(isCorrect){
    state.correct += 1;
    state.streak += 1;
    owlCelebrate();
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    var bonus = Math.min(10, state.streak) ;
    state.points += 10 + bonus;
    /* P4.2: Wochenziele — nur RICHTIGE Lösungen zählen */
    state.weekly.solved += 1;
    state.weekly.points += 10 + Math.min(10, state.streak);
    if(state.currentIsRepeat || state.currentWasDue) state.weekly.repeats += 1;
  } else {
    state.streak = 0;
    /* P4.2: Wiederholungs-Ziel wächst dynamisch mit jedem Fehler (analog 🔁-Chip) */
    state.weekly.repeatsNew += 1;
  }
  var wz = pruefeWochenziele();
  /* P6: Stufen-Aufstieg → neue Eule im Eulenhain */
  var lvlAfter = stufeVonPunkten(state.points);
  if(lvlAfter > lvlBefore){
    var neueStufen = [];
    for(var li=lvlBefore+1; li<=lvlAfter; li++){
      if(state.owls.indexOf(li)===-1){ state.owls.push(li); neueStufen.push(li); }
    }
    state.owls.sort(function(a,b){ return a-b; });
    if(neueStufen.length){ owlCelebrate(); spawnConfetti(); showLevelUpBanner(neueStufen[0]); }
  }
  if(wz.neue.length || wz.bonus){ spawnConfetti(); showWochenBanner(wz); }
  checkBadges();
  updateStatsUI();
  updateModeAmpel();
  /* P4.1: Wissenswald offen? Baeume sofort aktualisieren (Gold-Feier inklusive) */
  if(wwpViewEl && wwpViewEl.style.display !== "none") renderWissenswald();
  saveProgress();

  var fb = document.getElementById("feedback");
  fb.className = "feedback show " + (isCorrect?"ok":"bad");
    var msg = getMotd(isCorrect, state.streak, lvlAfter, state.currentWasDue);
  /* P2.2: Dynamische Anpassungs-Vorschläge (einmalig je Schwelle) */
  var sug = "";
  var stepTo = 0;
  if(isCorrect && state.streak === 3 && state.diff < 3){
    stepTo = state.diff + 1;
    sug = stepTo === 2 ? "⬆️ Stark! Steig auf 🎯 Training um" : "⬆️ Sehr stark! Steig auf 🚀 Anforderung um";
  } else if(!isCorrect && state.wrongRow === 2 && state.diff > 1){
    stepTo = state.diff - 1;
    sug = stepTo === 1 ? "⬇️ Kein Problem – wechsle auf 🌱 Einstieg" : "⬇️ Kein Problem – wechsle auf 🎯 Training";
  }
  /* P3.2: Gezielter Korrektur-Hinweis bei falscher Antwort */
  var extra = "";
  if(state.currentIsRepeat && isCorrect){
    state.repeatQ.splice(state.repeatIdxCurrent, 1);
    extra = (state.repeatQ.length === 0) ? extra + "<div style=\"margin-top:6px; font-size:.8rem; font-weight:600;\">🏆 Super gemacht! Alle Wiederholungen erfolgreich gelöst – wähle oben nun wieder deine nächsten Aufgaben aus.</div>" : extra + "<div style=\"margin-top:6px; font-size:.8rem; font-weight:600;\">🔁 Geschafft! Noch " + state.repeatQ.length + " Wiederholung(en) offen.</div>";
  } else if(state.currentIsRepeat && !isCorrect){
    var again = state.repeatQ.splice(state.repeatIdxCurrent, 1)[0];
    if(again){ state.repeatQ.push(again); }
    extra = extra + '<div style="margin-top:6px; font-size:.8rem; font-weight:600;">🔁 Kein Problem – die Aufgabe bleibt im Wiederholungstraining.</div>';
  } else if(mk && !isCorrect){
    storeRepeatInstance(state.current);
    extra = extra + "<div style=\"margin-top:6px; font-size:.8rem; font-weight:600;\">🔁 Diese Aufgabe ist jetzt im Wiederholungstraining.</div>";
  }
  /* P4.3: Fällige Leiter-Aufgabe gemeistert → Leiter-Feedback */
  if(state.currentWasDue && isCorrect){
    extra = extra + "<div style=\"margin-top:6px; font-size:.8rem; font-weight:600;\">🧠 Stark — diese Wiederholung sitzt wieder! Die nächste kommt später dran.</div>";
  }
  if(!isCorrect && state.current){
    var korr = TIPP1_BY_TOPIC[state.current.topic];
    if(korr) extra = '<div style="margin-top:6px; font-size:.8rem; font-weight:600;">🧭 Merke: '+korr+'</div>';
  }
  fb.innerHTML = msg + '<span class="explain">'+explanation+'</span>'+extra;
  if(stepTo){
    var sugDiv = document.createElement("div");
    sugDiv.className = "step-sug";
    var sugSpan = document.createElement("span");
    sugSpan.textContent = sug;
    var sugBtn = document.createElement("button");
    sugBtn.className = "mini";
    sugBtn.type = "button";
    sugBtn.textContent = "Jetzt wechseln";
    sugBtn.addEventListener('click', function(){
      state.diff = stepTo;
      Array.prototype.forEach.call(diffChipsHost.children, function(c){ c.classList.toggle('active', Number(c.dataset.diff) === stepTo); });
      saveProgress();
      nextExercise();
    });
    sugDiv.appendChild(sugSpan);
    sugDiv.appendChild(sugBtn);
    fb.appendChild(sugDiv);
  }
  document.getElementById("tipBtn").style.display = "none";
  document.getElementById("checkBtn").disabled = true;
  document.getElementById("nextBtn").style.display="inline-block";
}

function handleCheck(){
  if(state.answered) return;
  var ex = state.current;
  if(ex.inputType!=="number") return;
  var input = document.getElementById("numInput");
  var raw = input.value.trim().replace(",", ".");
  if(raw===""){ input.focus(); return; }
  var val = parseFloat(raw);
  if(isNaN(val)) { input.focus(); return; }
  var isCorrect = Math.abs(val - ex.answer) < (ex.tolerance || 0.05);
  input.disabled = true;
  finishRound(isCorrect, ex.explanation);
}

function handleChoice(i){
  if(state.answered) return;
  var ex = state.current;
  var buttons = document.querySelectorAll(".choice-btn");
  buttons.forEach(function(b){ b.disabled = true; });
  var isCorrect = (i === ex.correctIndex);
  buttons[i].classList.add(isCorrect?"correct":"wrong");
  if(!isCorrect){ buttons[ex.correctIndex].classList.add("correct"); }
  finishRound(isCorrect, ex.explanation);
}

document.getElementById("checkBtn").addEventListener("click", handleCheck);
document.getElementById("tipBtn").addEventListener("click", function(){
  if(!state.current || state.answered) return;
  var tips = deriveTips(state.current);
  if(state.tipShown < tips.length){
    state.tipShown++;
    var ht = document.getElementById("hintText");
    var line = "💡 " + tips[state.tipShown-1];
    ht.innerHTML = ht.innerHTML ? ht.innerHTML+"<br>"+line : line;
    if(state.tipShown >= tips.length){
      document.getElementById("tipBtn").style.display = "none";
    }
  }
});
document.getElementById("nextBtn").addEventListener("click", nextExercise);
document.getElementById("resetBtn").addEventListener("click", function(){
  if(window.confirm("Wirklich den gesamten Fortschritt (Punkte, Serie, Abzeichen) in diesem Browser löschen?")){
    resetProgress();
  }
});

/* Curriculum Badge & Modal: Event-Handler */
var curriculumBadgeEl = document.getElementById("curriculumBadge");
if(curriculumBadgeEl){
  curriculumBadgeEl.addEventListener("click", openCurriculumModal);
}
var curriculumModalCloseEl = document.getElementById("curriculumModalClose");
if(curriculumModalCloseEl){
  curriculumModalCloseEl.addEventListener("click", closeCurriculumModal);
}
// Schließen bei Klick außerhalb des Modals
var curriculumModalEl = document.getElementById("curriculumModal");
if(curriculumModalEl){
  curriculumModalEl.addEventListener("click", function(e){
    if(e.target === curriculumModalEl){
      closeCurriculumModal();
    }
  });
}
// ESC-Taste schließt das Modal
document.addEventListener("keydown", function(e){
  if(e.key === "Escape") closeCurriculumModal();
});

/* ---------- Legal-Modal (Datenschutz / Impressum / AGB) ---------- */
var legalModalEl = document.getElementById("legalModal");
var legalModalBodyEl = document.getElementById("legalModalBody");
var legalModalTitleEl = document.getElementById("legalModalTitle2");
function extractLegalBody(html){
  var m = html.match(/<div class="card">([\s\S]*)<\/div>\s*<\/body>/i)
       || html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return m ? m[1].trim() : html;
}
function openLegalModal(file, title){
  if(legalModalTitleEl) legalModalTitleEl.textContent = title || "Rechtliches";
  if(legalModalBodyEl) legalModalBodyEl.innerHTML = "<p>Lade …</p>";
  if(legalModalEl) legalModalEl.style.display = "flex";
  fetch(file, {credentials:"same-origin"}).then(function(r){
    if(!r.ok) throw new Error("HTTP "+r.status);
    return r.text();
  }).then(function(html){
    if(legalModalBodyEl){
      legalModalBodyEl.innerHTML = extractLegalBody(html);
      legalModalBodyEl.scrollTop = 0;
    }
  }).catch(function(){
    if(legalModalBodyEl) legalModalBodyEl.innerHTML = '<p>Der Inhalt konnte nicht geladen werden. <a href="'+file+'" target="_blank" rel="noopener">Direkt öffnen</a></p>';
  });
}
function closeLegalModal(){ if(legalModalEl) legalModalEl.style.display = "none"; }
var legalModalCloseEl = document.getElementById("legalModalClose");
if(legalModalCloseEl){ legalModalCloseEl.addEventListener("click", closeLegalModal); }

/* ---------- P6: Stufen-Aufstiegs-Feier + Eulenhain ---------- */
var ANIM_NAMES = {flap:"Flattern", blink:"Blinzeln", bob:"Wippen", tilt:"Kopfkippen", hop:"Hüpfer", sleep:"Schlafenszeit", spin:"Drehung", fluff:"Federsträuben"};
function spawnConfetti(){
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(reduce) return;
  var host = document.createElement("div");
  host.className = "eh-confetti";
  host.setAttribute("aria-hidden", "true");
  var parts = ["🎉","✨","⭐","🦉","💜","💚","💙","🧡"];
  for(var i=0;i<26;i++){
    var s = document.createElement("span");
    s.textContent = parts[i % parts.length];
    s.style.setProperty("--x", (Math.random()*96)+"vw");
    s.style.setProperty("--d", (1.6+Math.random()*1.6)+"s");
    s.style.setProperty("--s", (12+Math.random()*14)+"px");
    s.style.animationDelay = (Math.random()*0.5)+"s";
    host.appendChild(s);
  }
  document.body.appendChild(host);
  setTimeout(function(){ if(host.parentNode) host.parentNode.removeChild(host); }, 3800);
}
function showLevelUpBanner(stufe){
  var owl = owlForLevel(stufe);
  var fb = document.getElementById("feedback");
  if(!fb) return;
  var div = document.createElement("div");
  div.className = "eh-levelup";
  div.innerHTML = "🦉 <strong>Stufe "+stufe+" erreicht!</strong> Neue Eule im Eulenhain: <strong>"+escHtml(owl.name)+"</strong> ";
  var b = document.createElement("button");
  b.className = "mini"; b.type = "button"; b.textContent = "Eulenhain ansehen";
  b.addEventListener("click", openEulenhain);
  div.appendChild(b);
  fb.appendChild(div);
  /* Seite offen? Baum sofort aktualisieren */
  if(eulenhainViewEl && eulenhainViewEl.style.display !== "none") renderEulenhain();
}
/* ---------- P6: Eulenhain als eigene Seite mit großem, wachsendem Baum ---------- */
var eulenhainViewEl = document.getElementById("eulenhainView");
var ehpSceneEl = document.getElementById("ehpScene");
var ehpStatsEl = document.getElementById("ehpStats");
var ehHintEl = document.getElementById("ehHint");
function openEulenhain(){
  renderEulenhain();
  if(eulenhainViewEl) eulenhainViewEl.style.display = "block";
  window.scrollTo(0, 0);
}
function closeEulenhain(){ if(eulenhainViewEl) eulenhainViewEl.style.display = "none"; }
function ehpStrahlen(n, innen, aussen){
  var s = "", i, a;
  for(i = 0; i < n; i++){
    a = i * (360 / n) * Math.PI / 180;
    s += '<line x1="'+(Math.cos(a)*innen).toFixed(1)+'" y1="'+(Math.sin(a)*innen).toFixed(1)
       + '" x2="'+(Math.cos(a)*aussen).toFixed(1)+'" y2="'+(Math.sin(a)*aussen).toFixed(1)
       + '" stroke="#F2B93B" stroke-width="5" stroke-linecap="round"/>';
  }
  return s;
}
function ehpWolke(x, y, sk, cls){
  return '<g transform="translate('+x+','+y+') scale('+sk+')"><g class="ehp-cloud '+cls+'">'
    + '<ellipse cx="0" cy="0" rx="52" ry="20" fill="#FFFFFF" opacity=".92"/>'
    + '<ellipse cx="-32" cy="6" rx="30" ry="14" fill="#FFFFFF" opacity=".92"/>'
    + '<ellipse cx="32" cy="6" rx="34" ry="15" fill="#FFFFFF" opacity=".92"/>'
    + '<ellipse cx="4" cy="-15" rx="30" ry="18" fill="#FFFFFF" opacity=".95"/>'
    + '</g></g>';
}
function ehpBlumen(groundY, w){
  var s = "", i, x;
  var farben = ["#F6A5C0","#FFD75E","#C9A0F0","#F6A5C0","#FFD75E","#C9A0F0"];
  for(i = 0; i < 6; i++){
    x = w ? (80 + i * ((w - 160) / 5) + (i % 2) * ((w - 160) / 22)) : (70 + i * 128 + (i % 2) * 36);
    s += '<line x1="'+x+'" y1="'+(groundY+26)+'" x2="'+x+'" y2="'+(groundY+8)+'" stroke="#6FAF5C" stroke-width="3" stroke-linecap="round"/>'
       + '<circle cx="'+x+'" cy="'+(groundY+4)+'" r="6" fill="'+farben[i]+'"/>'
       + '<circle cx="'+x+'" cy="'+(groundY+4)+'" r="2.5" fill="#FFF3C2"/>';
  }
  return s;
}
function renderEulenhain(){
  if(!ehpSceneEl) return;
  var lvl = currentLevel();
  if(ehpStatsEl) ehpStatsEl.innerHTML = 'Stufe <strong>'+lvl.stufe+'</strong> · '+escHtml(rangTitel(lvl.stufe))+' · <strong>'+state.owls.length+'</strong> Eule(n) gesammelt';
  var nxt = owlForLevel(lvl.stufe + 1);
  var fehl = Math.max(0, punkteFuerStufe(lvl.stufe + 1) - state.points);
  if(ehHintEl) ehHintEl.innerHTML = '🔭 Noch <strong>'+fehl+'</strong> Punkte bis zur nächsten Eule: <strong>'+escHtml(nxt.name)+'</strong> (Stufe '+(lvl.stufe+1)+')';
  /* Baum-Geometrie: von der Krone nach unten wachsend — je Ast 5 Eulen, oben wartet die nächste Eule */
  var proAst = 5;
  var gesamt = state.owls.length + 1;
  var astZahl = Math.ceil(gesamt / proAst);
  var spacing = 92, W = 860;
  var f = 1 + Math.min(0.6, astZahl * 0.045);
  var crownK = 0.78, crownCy = 250;
  var crownBottom = crownCy + 95 * f;
  var topAstY = crownBottom + 66;
  var H = topAstY + astZahl * spacing + 86 + 84;   /* Astreihen sind 1-basiert (astIdx) – sonst liegt der Ast auf der Wiese */
  var groundY = H - 84;
  var trunkX = 430;
  var trunkTopY = crownCy + 95 * f * 0.5;
  var kronenFarben = ["#6FAF5C", "#7FBF6A", "#8FCF79", "#97CB84", "#A5D98E"];
  var OWL_H = 52, OWL_ABSTAND = 54, OWL_START = 68, AST_UEBERSTAND = 40, OWL_SITZ = 1;
  /* Kronenbreite folgt der längsten Astreihe: die grösste Gruppe (max. 5 Eulen) bestimmt die Ausdehnung */
  var groessteGruppe = state.owls.length > 5 ? 5 : state.owls.length;
  if(groessteGruppe < 1) groessteGruppe = 1;
  var maxAstLen = OWL_START + (groessteGruppe - 1) * OWL_ABSTAND + AST_UEBERSTAND;
  if(56 + AST_UEBERSTAND > maxAstLen) maxAstLen = 56 + AST_UEBERSTAND;
  var kronenBreite = ((maxAstLen / (crownK * f)) - 32) / 164;   /* Kronenrand liegt an der Astspitze */
  if(kronenBreite < 1) kronenBreite = 1;
  var kronenRund = 1 + (kronenBreite - 1) * 0.5;   /* Radien wachsen halb mit -> dichte Krone */
  var s = "", i, k;
  s += '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" style="display:block;">';
  s += '<defs>'
    + '<linearGradient id="ehpSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#BFE3F7"/><stop offset="1" stop-color="#EFF8EE"/></linearGradient>'
    + '<linearGradient id="ehpTrunk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7A4E26"/><stop offset=".55" stop-color="#93613A"/><stop offset="1" stop-color="#6E4423"/></linearGradient>'
    + '</defs>';
  s += '<rect x="0" y="0" width="'+W+'" height="'+H+'" fill="url(#ehpSky)"/>';
  s += '<g transform="translate('+(W-96)+',96)"><g class="ehp-rays">'+ehpStrahlen(10, 48, 74)+'</g>'
    + '<circle r="40" fill="#FFD75E" stroke="#F2B93B" stroke-width="3"/></g>';
  s += ehpWolke(140, 92, 1.1, "c1") + ehpWolke(600, 150, 0.85, "c2") + ehpWolke(300, 44, 0.7, "c3");
  s += '<path d="M0 '+(groundY+10)+' Q 210 '+(groundY-48)+' 430 '+(groundY+4)+' T '+W+' '+(groundY-4)+' L '+W+' '+H+' L 0 '+H+' Z" fill="#A9D89B"/>';
  s += '<path d="M0 '+(groundY+34)+' Q 260 '+(groundY-2)+' 520 '+(groundY+26)+' T '+W+' '+(groundY+20)+' L '+W+' '+H+' L 0 '+H+' Z" fill="#8FCB7E"/>';
  s += ehpBlumen(groundY);
  s += '<path d="M'+(trunkX-30)+' '+(groundY+8)+' C '+(trunkX-24)+' '+(groundY-60)+' '+(trunkX-26)+' '+(trunkTopY+130)+' '+(trunkX-16)+' '+trunkTopY
     + ' L '+(trunkX+16)+' '+trunkTopY
     + ' C '+(trunkX+26)+' '+(trunkTopY+130)+' '+(trunkX+24)+' '+(groundY-60)+' '+(trunkX+30)+' '+(groundY+8)+' Z" fill="url(#ehpTrunk)"/>';
  s += '<path d="M'+(trunkX-28)+' '+(groundY+6)+' q -36 4 -56 20 l 10 4 q 24 -12 48 -14 Z" fill="#6E4423"/>';
  s += '<path d="M'+(trunkX+28)+' '+(groundY+6)+' q 36 4 56 20 l -10 4 q -24 -12 -48 -14 Z" fill="#6E4423"/>';
  var kronen = [[0,0,128],[-105,26,88],[100,20,92],[-52,-58,86],[48,-64,90],[-132,-18,64],[120,-26,66],[0,-98,90],[38,54,66],[-42,60,62],[-10,34,80],[26,-8,96]];
  for(i = 0; i < kronen.length; i++){
    var c = kronen[i];
    s += '<circle cx="'+(trunkX + c[0]*crownK*f*kronenBreite).toFixed(1)+'" cy="'+(crownCy + c[1]*crownK*f).toFixed(1)+'" r="'+(c[2]*crownK*f*kronenRund).toFixed(1)+'" fill="'+kronenFarben[i % kronenFarben.length]+'"/>';
  }
  /* Äste: oben die nächste Eule (dünner Ast), darunter die gesammelten Eulen — neueste oben, älteste unten */
  var alle = [];
  for(k = state.owls.length - 1; k >= 0; k--) alle.push({ stufe: state.owls[k], mysterium: false });
  var astIdx = 0;
  /* Ast-Geometrie: Äste verjüngen sich zur Spitze, Eulen sitzen exakt auf der Astkurve */
  /* Ast als gefüllte Kontur: dick am Stamm, dünn an der Spitze (sk skaliert die Dicke) */
  function astPfad(ay, links, len, sk, farbe){
    sk = sk || 1;
    var xm = links ? trunkX - len * 0.52 : trunkX + len * 0.52;
    var xe = links ? trunkX - len : trunkX + len;
    var ob = 6.5 * sk, un = 7.5 * sk, sp = 3 * sk;
    return '<path d="M'+trunkX+' '+(ay-5-ob)
      + ' Q '+xm+' '+(ay+14-ob)+' '+xe+' '+(ay+6-sp)
      + ' L '+xe+' '+(ay+6+sp)
      + ' Q '+xm+' '+(ay+14+un)+' '+trunkX+' '+(ay-5+un)+' Z" fill="'+(farbe || "#7A4E26")+'"/>';
  }
  /* y der Ast-Mittelkurve an der Stelle x (quadratische Bézier nach t aufgelöst) */
  function astY(x, ay, links, len){
    var xm = links ? trunkX - len * 0.52 : trunkX + len * 0.52;
    var xe = links ? trunkX - len : trunkX + len;
    var a = trunkX - 2 * xm + xe, b = 2 * (xm - trunkX), c = trunkX - x, t;
    if(Math.abs(a) < 1e-6){ t = b !== 0 ? -c / b : 0; }
    else {
      var w = b * b - 4 * a * c, rt = Math.sqrt(w > 0 ? w : 0);
      var t1 = (-b + rt) / (2 * a), t2 = (-b - rt) / (2 * a);
      t = (t1 >= 0 && t1 <= 1) ? t1 : t2;   /* jene Lösung, die auf dem Ast liegt */
    }
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    var u = 1 - t;
    return u * u * (ay - 5) + 2 * u * t * (ay + 14) + t * t * (ay + 6);
  }
  /* Warteeule: dünner Zweig direkt unter der Krone, auf der rechten Seite */
  (function(){
    var y = topAstY, len = 56 + AST_UEBERSTAND;
    var o = owlForLevel(lvl.stufe + 1), x = trunkX + 56;
    var cy = astY(x, y, false, len);
    s += astPfad(y, false, len, 0.55, "#B98A4E");
    s += '<svg class="eh-owl eh-mystery" data-anim="'+o.anim+'" data-stufe="'+(lvl.stufe+1)+'" x="'+(x-32)+'" y="'+(cy-OWL_SITZ-OWL_H)+'" width="64" height="52" viewBox="-12 0 124 100" role="button" tabindex="0" aria-label="Noch unbekannte Eule (Stufe '+(lvl.stufe+1)+')">'
       + owlInner(o.hue) + '</svg>';
    s += '<text x="'+x+'" y="'+(cy+14)+'" text-anchor="middle" class="ehp-label mystery">'+(lvl.stufe+1)+'</text>';
  })();
  for(i = 0; i < alle.length; i += proAst){
    var gruppe = alle.slice(i, i + proAst);
    astIdx++;
    var y = topAstY + astIdx * spacing;
    var links = astIdx % 2 === 1;
    var len = OWL_START + (gruppe.length - 1) * OWL_ABSTAND + AST_UEBERSTAND;   /* Ast endet knapp hinter der letzten Eule */
    s += astPfad(y, links, len, 1);
    for(k = 0; k < gruppe.length; k++){
      var e = gruppe[k];
      var o = owlForLevel(e.stufe);
      var x = links ? trunkX - OWL_START - k * OWL_ABSTAND : trunkX + OWL_START + k * OWL_ABSTAND;
      var cy = astY(x, y, links, len);
      var cls = "eh-owl" + (e.stufe === lvl.stufe ? " eh-idle" : "");
      s += '<svg class="'+cls+'" data-anim="'+o.anim+'" data-stufe="'+e.stufe+'" x="'+(x-32)+'" y="'+(cy-OWL_SITZ-OWL_H)+'" width="64" height="52" viewBox="-12 0 124 100" role="button" tabindex="0" aria-label="'+o.name+', Stufe '+e.stufe+'">'
         + owlInner(o.hue)
         + '</svg>';
      s += '<text x="'+x+'" y="'+(cy+14)+'" text-anchor="middle" class="ehp-label">'+e.stufe+'</text>';
    }
  }
  s += '</svg>';
  ehpSceneEl.innerHTML = '<div class="ehp-stage">' + s
    + '<span class="ehp-butterfly" style="left:14%;top:20%;" aria-hidden="true">🦋</span>'
    + '<span class="ehp-butterfly b2" style="left:78%;top:34%;" aria-hidden="true">🦋</span>'
    + '</div>';
  var cap = document.getElementById("ehCaption");
  if(cap) cap.textContent = "💡 Tippe eine Eule an!";
  Array.prototype.forEach.call(ehpSceneEl.querySelectorAll(".eh-owl[data-stufe]"), function(el){
    function play(){
      var o2 = owlForLevel(Number(el.dataset.stufe));
      el.classList.remove("eh-play");
      void el.getBoundingClientRect(); /* laufende Animation neu starten */
      el.classList.add("eh-play");
      var c = document.getElementById("ehCaption");
      if(c) c.textContent = "🦉 " + o2.name + " · Stufe " + o2.stufe + " — mag es zu „" + ANIM_NAMES[o2.anim] + "“";
      setTimeout(function(){ el.classList.remove("eh-play"); }, 2600);
    }
    el.addEventListener("click", play);
    el.addEventListener("keydown", function(ev){ if(ev.key === "Enter" || ev.key === " "){ ev.preventDefault(); play(); } });
  });
}
var eulenhainBtnEl = document.getElementById("eulenhainBtn");
if(eulenhainBtnEl) eulenhainBtnEl.addEventListener("click", openEulenhain);
var eulenhainBackEl = document.getElementById("eulenhainBack");
if(eulenhainBackEl) eulenhainBackEl.addEventListener("click", closeEulenhain);
document.addEventListener("keydown", function(e){
  if(e.key === "Escape") closeEulenhain();
});
/* ---------- P4.1: Wissenswald — 6 Kompetenz-Bäume (eigene Seite, wie der Eulenhain) ---------- */
var wwpViewEl = document.getElementById("wissenswaldView");
var wwpSceneEl = document.getElementById("wwpScene");
var wwpStatsEl = document.getElementById("wwpStats");
var wwHintEl = document.getElementById("wwHint");
var wwCaptionEl = document.getElementById("wwCaption");
var waldBtnEl = document.getElementById("waldBtn");
var waldPctValEl = document.getElementById("waldPctVal");
var waldLetzterStatus = null;
var WWP_TIERE = ["🐿️","🦜","🐝","🦔","🦋","🐞"];
var WWP_TUFF_FARBEN = { neu:"#A8CBA0", bau:"#F0A03C", due:"#E15759", sicher:"#74C95E", meister:"#FFD54A" };
function openWissenswald(){
  renderWissenswald();
  if(wwpViewEl) wwpViewEl.style.display = "block";
  window.scrollTo(0, 0);
}
function closeWissenswald(){ if(wwpViewEl) wwpViewEl.style.display = "none"; }
/* P4.1: Baum-Formen je Wissensbereich — die Krone wächst mit der Zahl der Kompetenzen.
   f = Größenfaktor · form = Kronen-Silhouette · WWP_FORM_HW = Halbbreite (× rM) ·
   WWP_FORM_ASPECT = Höhe/Breite der Frucht-Verteilung */
var WWP_BAUM_FORM = {
  struktur:{ f:0.72, form:"kugel" }, prozente:{ f:0.80, form:"hoch"  },
  formen:  { f:0.88, form:"kegel" }, brueche: { f:0.95, form:"rund"  },
  alltag:  { f:1.05, form:"busch" }, messen:   { f:1.15, form:"flach" }
};
var WWP_FORM_HW     = { kugel:1.06, hoch:0.72, kegel:0.78, rund:1.17, busch:1.18, flach:1.17 };
var WWP_FORM_ASPECT = { kugel:0.95, hoch:1.55, kegel:1.42, rund:0.95, busch:0.92, flach:0.74 };
/* Kronen-Oberkante je Form (× rM) — für die Tier-Position oberhalb der Krone */
var WWP_FORM_TOP    = { kugel:0.90, hoch:1.13, kegel:1.04, rund:1.00, busch:0.83, flach:0.87 };
var WWP_FORM_SET = {
  kugel: [[0,-0.10,0.80],[-0.42,0.12,0.62],[0.42,0.10,0.64],[0,0.34,0.55]],
  hoch:  [[0,-0.55,0.58],[0,0,0.72],[0,0.55,0.62]],
  kegel: [[0,-0.70,0.34],[0,-0.34,0.46],[0,0.02,0.58],[0,0.38,0.70],[0,0.68,0.78]],
  rund:  [[0,0,1.0],[-0.45,0.16,0.72],[0.45,0.13,0.74]],
  busch: [[0,0.05,0.88],[-0.50,0.14,0.66],[0.50,0.12,0.68],[-0.28,-0.30,0.50],[0.30,-0.28,0.52]],
  flach: [[0,0.05,0.92],[-0.55,0.10,0.60],[0.55,0.08,0.62]]
};
/* Solide Krone (kein Transparenz-Schaum): Silhouette + Schattenband + Lichtreflex */
function wwpKrone(form, rM, cy){
  var set = WWP_FORM_SET[form] || WWP_FORM_SET.rund;
  var out = "", i, c;
  for(i = 0; i < set.length; i++){
    c = set[i];
    out += '<circle cx="' + (c[0] * rM).toFixed(1) + '" cy="' + (cy + c[1] * rM).toFixed(1)
         + '" r="' + (c[2] * rM).toFixed(1) + '" fill="#4E8F42"/>';
  }
  out += '<ellipse cx="0" cy="' + (cy + rM * 0.58).toFixed(1) + '" rx="' + (rM * 0.62).toFixed(1)
       + '" ry="' + (rM * 0.26).toFixed(1) + '" fill="#3E7534" opacity=".5"/>';
  out += '<ellipse cx="' + (-rM * 0.26).toFixed(1) + '" cy="' + (cy - rM * 0.42).toFixed(1)
       + '" rx="' + (rM * 0.36).toFixed(1) + '" ry="' + (rM * 0.22).toFixed(1) + '" fill="#69A85A" opacity=".45"/>';
  return out;
}
/* P4.1: Stamm mit Wurzelanlauf (Buttress). Der Stamm verbreitert sich in der
   unteren Hälfte gleichmäßig und läuft als breiter Fuß flach in die Wiese aus.
   Dadurch wachsen die Wurzeln sichtbar AUS dem Stamm heraus (kein aufgesetzter
   Klumpen, keine Beine). Breite & Fuß skalieren mit der Baumgröße bw. */
function wwpStamm(stammH, bw){
  var H = stammH, tw = Math.max(3.5, bw * 0.28);
  var fl = bw * 1.26, gy = bw * 0.80;          /* Fußbreite und Bodenlinie */
  var d = "M " + (-tw).toFixed(1) + " " + (-H).toFixed(0);
  /* linke Kante: Stammhals → Wurzelanlauf → flacher Fuß */
  d += " C " + (-(bw * 0.58)).toFixed(1) + " " + (-H * 0.76).toFixed(0)
     + " " + (-(bw * 0.94)).toFixed(1) + " " + (-H * 0.54).toFixed(0)
     + " " + (-bw).toFixed(1) + " " + (-H * 0.44).toFixed(0);
  d += " C " + (-(bw * 1.06)).toFixed(1) + " " + (-H * 0.30).toFixed(0)
     + " " + (-(fl * 0.78)).toFixed(1) + " " + (-gy * 0.60).toFixed(1)
     + " " + (-fl).toFixed(1) + " " + (gy * 0.55).toFixed(1);
  d += " C " + (-(fl * 1.03)).toFixed(1) + " " + (gy * 1.06).toFixed(1)
     + " " + (-(fl * 0.70)).toFixed(1) + " " + (gy * 1.18).toFixed(1)
     + " " + (-(fl * 0.30)).toFixed(1) + " " + (gy * 1.18).toFixed(1);
  d += " L " + (fl * 0.30).toFixed(1) + " " + (gy * 1.18).toFixed(1);
  /* rechte Kante: Spiegelbild */
  d += " C " + (fl * 0.70).toFixed(1) + " " + (gy * 1.18).toFixed(1)
     + " " + (fl * 1.03).toFixed(1) + " " + (gy * 1.06).toFixed(1)
     + " " + fl.toFixed(1) + " " + (gy * 0.55).toFixed(1);
  d += " C " + (fl * 0.78).toFixed(1) + " " + (-gy * 0.60).toFixed(1)
     + " " + (bw * 1.06).toFixed(1) + " " + (-H * 0.30).toFixed(0)
     + " " + bw.toFixed(1) + " " + (-H * 0.44).toFixed(0);
  d += " C " + (bw * 0.94).toFixed(1) + " " + (-H * 0.54).toFixed(0)
     + " " + (bw * 0.58).toFixed(1) + " " + (-H * 0.76).toFixed(0)
     + " " + tw.toFixed(1) + " " + (-H).toFixed(0);
  d += " Z";
  return '<path d="' + d + '" fill="url(#wwpTrunk)" stroke="#6B4224" stroke-width="1.2" stroke-linejoin="round"/>';
}
/* P4.1: Wurzeln — verjüngte Keile, die IM Stamm wurzeln (Ansatzpunkte liegen
   hinter dem Stamm) und über den Boden auslaufen. Drei Stränge je Seite in
   unterschiedlicher Länge/Höhe = organischer Wurzelfuß statt Beine. */
function wwpWurzeln(rM, bw){
  var gy = bw * 0.80, out = "", i;
  /* [Seite, Länge, Ansatzhöhe (× bw, über dem Boden), Dicke am Stamm (× bw), Farbe] */
  var roots = [
    [-1, rM * 0.96, 2.10, 0.92, "#6B4224"],
    [ 1, rM * 0.88, 1.86, 0.86, "#6B4224"],
    [-1, rM * 0.68, 1.36, 0.74, "#744724"],
    [ 1, rM * 0.60, 1.16, 0.68, "#744724"],
    [-1, rM * 0.46, 0.82, 0.58, "#7C4E28"],
    [ 1, rM * 0.40, 0.70, 0.52, "#7C4E28"]
  ];
  for(i = 0; i < roots.length; i++){
    var sd = roots[i][0], L = roots[i][1], ay = -bw * roots[i][2], th = bw * roots[i][3];
    var tipY = gy * (1.00 + (i % 2) * 0.08 + i * 0.03);
    var tx = sd * L, nx = sd * (L - 4.5);
    out += '<path d="M' + (sd * bw * 0.30).toFixed(1) + ' ' + ay.toFixed(1)
      + ' C ' + (sd * bw * 1.35).toFixed(1) + ' ' + (ay * 0.62).toFixed(1)
      + ' ' + (sd * L * 0.45).toFixed(1) + ' ' + (tipY * 0.10).toFixed(1)
      + ' ' + tx.toFixed(1) + ' ' + tipY.toFixed(1)
      /* leicht abgestumpfte Spitze statt Nadelspitze */
      + ' L ' + nx.toFixed(1) + ' ' + (tipY - 1.6).toFixed(1)
      + ' C ' + (sd * L * 0.80).toFixed(1) + ' ' + (tipY * 1.18).toFixed(1)
      + ' ' + (sd * bw * 1.22).toFixed(1) + ' ' + (ay + th).toFixed(1)
      + ' ' + (sd * bw * 0.34).toFixed(1) + ' ' + (ay + th).toFixed(1)
      + ' Z" fill="' + roots[i][4] + '" stroke="' + roots[i][4] + '" stroke-width="2.2" stroke-linejoin="round"/>';
  }
  return out;
}
/* Früchte (Kompetenzen) gleichmäßig im Kronen-Oval verteilen (Sonnenblumen-Muster) */
function wwpTuffPosis(n, R, aspect){
  var out = [], i, a, rr, ga = 2.39996323;
  for(i = 0; i < n; i++){
    a = i * ga;
    rr = R * Math.sqrt((i + 0.5) / n);
    out.push([Math.cos(a) * rr, Math.sin(a) * rr * (aspect || 0.95)]);
  }
  return out;
}
function showWaldBanner(baeume){
  var fb = document.getElementById("feedback");
  if(!fb) return;
  var div = document.createElement("div");
  div.className = "eh-levelup";
  var namen = baeume.map(function(b){ return b.icon + " " + b.name; }).join(" · ");
  div.innerHTML = "🌳 <strong>Baum golden geworden:</strong> " + escHtml(namen) + " — deine Eulen haben Grund zu feiern! 🎉";
  fb.appendChild(div);
}
function wwZeigeTuff(key){
  if(!wwCaptionEl) return;
  var cm = CURRICULUM_MAP[key];
  var nowSec = Math.floor(Date.now() / 1000);
  var s = spacedSanitize(state.spaced);
  var e = s[key];
  var lvl = e ? e[1] : 0;
  var faellig = !!(e && e[0] <= nowSec);
  var statusTxt = !e ? "🌱 Noch nicht geübt — hier wartet der erste Keim!"
    : (faellig ? "⏰ Fällig zur Wiederholung — zeig, dass es sitzt!"
    : (lvl >= 5 ? "🏆 Gemeistert! Es bleibt in der 14-Tage-Runde." : "🧠 Leiter-Stufe " + lvl + "/5 — gut im Wuchs!"));
  wwCaptionEl.innerHTML = '<strong>' + escHtml(cm ? cm.kompetenz : key) + '</strong>'
    + ' <span class="wwp-codes">(' + escHtml(cm ? cm.codes.join(" · ") : "") + ')</span><br>'
    + statusTxt
    + ' <button class="mini wwp-ueben" data-key="' + key + '" type="button">🌿 Jetzt üben</button>';
  var b = wwCaptionEl.querySelector(".wwp-ueben");
  if(b) b.addEventListener("click", function(){
    setFocusKey(key);
    closeWissenswald();
    nextExercise();
  });
}
function wwpSchild(x, top, b, idx){
  var neig = (idx % 2 === 0) ? -1.5 : 1.5;
  var sub = b.pct + "% · " + (b.status === "gold" ? "🏆 golden" : (b.status === "rot" ? "⏰ " + b.dueCount + " fällig" : (b.status === "neu" ? "🌱 unberührt" : "🌿 " + b.geuebt + "/" + b.total + " im Wuchs")));
  var s = "";
  /* Bodenschatten: verankert das Schild auf der Wiese (bleibt innerhalb der Bühne) */
  s += '<ellipse cx="' + x + '" cy="' + (top + 42) + '" rx="64" ry="5" fill="#7BAF6B" opacity=".5"/>';
  /* zwei Pfosten (liegen hinter dem Brett, reichen in die Wiese) */
  s += '<rect x="' + (x - 48) + '" y="' + (top + 8) + '" width="6" height="32" rx="2" fill="#7A4E26"/>';
  s += '<rect x="' + (x + 42) + '" y="' + (top + 8) + '" width="6" height="32" rx="2" fill="#7A4E26"/>';
  s += '<g transform="rotate(' + neig + ' ' + x + ' ' + (top + 17) + ')">';
  s += '<rect x="' + (x - 70) + '" y="' + top + '" width="140" height="34" rx="9" fill="#D2A56E" stroke="#8A5A2B" stroke-width="2.5"/>';
  s += '<circle cx="' + (x - 60) + '" cy="' + (top + 17) + '" r="2.2" fill="#8A5A2B"/>';
  s += '<circle cx="' + (x + 60) + '" cy="' + (top + 17) + '" r="2.2" fill="#8A5A2B"/>';
  s += '<text class="wwp-boardtext" x="' + x + '" y="' + (top + 15) + '" text-anchor="middle">' + b.icon + ' ' + escHtml(b.name) + '</text>';
  s += '<text class="wwp-boardsub" x="' + x + '" y="' + (top + 29) + '" text-anchor="middle">' + escHtml(sub) + '</text>';
  s += '</g>';
  return s;
}
function renderWissenswald(){
  if(!wwpSceneEl) return;
  var nowSec = Math.floor(Date.now() / 1000);
  var wald = waldStatus(state.spaced, nowSec);
  if(wwpStatsEl) wwpStatsEl.innerHTML = '<strong>' + wald.pct + '%</strong> gewachsen · <strong>' + wald.goldene + '/' + wald.total + '</strong> Bäume golden';
  if(wwHintEl) wwHintEl.innerHTML = wald.goldene === wald.total
    ? '🏆 Fantastisch! Dein ganzer Wissenswald ist golden — deine Eulen wohnen im schönsten Hain!'
    : '🌳 Tippe ein Blatt an, um genau diese Kompetenz zu üben · ⏰ rote Blätter warten auf Wiederholung';
  /* Gold-Feier: nur beim Übergang (nicht beim ersten Öffnen) */
  var neueGold = [];
  wald.baeume.forEach(function(b, i){
    if(b.status === "gold" && waldLetzterStatus && waldLetzterStatus[i] !== "gold") neueGold.push(b);
  });
  waldLetzterStatus = wald.baeume.map(function(b){ return b.status; });
  if(neueGold.length){ spawnConfetti(); showWaldBanner(neueGold); }
  /* --- Szene: Himmel, Sonne, Wolken, Wiese — 6 Bäume je auf eigenem Hügel --- */
  var W = 1000, H = 534, groundY = H - 66;
  var s = "", i, j;
  s += '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" style="display:block;">';
  s += '<defs>'
    + '<linearGradient id="wwpSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#BFE3F7"/><stop offset="1" stop-color="#EFF8EE"/></linearGradient>'
    + '<linearGradient id="wwpTrunk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7A4E26"/><stop offset=".55" stop-color="#93613A"/><stop offset="1" stop-color="#6E4423"/></linearGradient>'
    + '</defs>';
  s += '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="url(#wwpSky)"/>';
  s += '<g transform="translate(' + (W - 110) + ',84)"><g class="ehp-rays">' + ehpStrahlen(10, 46, 70) + '</g><circle r="40" fill="#FFD75E" stroke="#F2B93B" stroke-width="3"/></g>';
  s += ehpWolke(150, 60, 1.05, "c1") + ehpWolke(560, 104, 0.8, "c2") + ehpWolke(330, 150, 0.65, "c3");
  /* Ferne Hügelketten + Tannen-Silhouette: füllen das mittlere Band und geben Tiefe */
  s += '<path d="M0 ' + (groundY - 190) + ' Q 170 ' + (groundY - 260) + ' 350 ' + (groundY - 196) + ' T 700 ' + (groundY - 204) + ' T ' + W + ' ' + (groundY - 192) + ' L ' + W + ' ' + H + ' L 0 ' + H + ' Z" fill="#DBEFD2"/>';
  s += '<path d="M0 ' + (groundY - 138) + ' Q 200 ' + (groundY - 200) + ' 420 ' + (groundY - 146) + ' T 760 ' + (groundY - 154) + ' T ' + W + ' ' + (groundY - 140) + ' L ' + W + ' ' + H + ' L 0 ' + H + ' Z" fill="#C9E8BB"/>';
  (function(){
    var tx, tb = groundY - 152, th;
    for(tx = 26; tx < W - 10; tx += 46){
      th = 22 + ((tx * 7) % 17);
      s += '<path d="M' + tx + ' ' + (tb - th) + ' L ' + (tx - 10) + ' ' + tb + ' L ' + (tx + 10) + ' ' + tb + ' Z" fill="#AFD8A3"/>';
    }
  })();
  /* Wiese: zwei sanfte Bodenwellen */
  s += '<path d="M0 ' + (groundY + 8) + ' Q 250 ' + (groundY - 40) + ' 500 ' + (groundY + 2) + ' T ' + W + ' ' + (groundY - 6) + ' L ' + W + ' ' + H + ' L 0 ' + H + ' Z" fill="#A9D89B"/>';
  s += '<path d="M0 ' + (groundY + 26) + ' Q 260 ' + (groundY - 4) + ' 520 ' + (groundY + 20) + ' T ' + W + ' ' + (groundY + 14) + ' L ' + W + ' ' + H + ' L 0 ' + H + ' Z" fill="#8FCB7E"/>';
  s += ehpBlumen(groundY - 6, W);
  /* Büsche im Mittelgrund: kleine Sträucher auf der Wiese → Tiefenwirkung */
  var buschX = [[120, groundY - 52, 0.72], [285, groundY - 60, 0.6], [447, groundY - 50, 0.7], [609, groundY - 60, 0.62], [771, groundY - 52, 0.72], [933, groundY - 58, 0.6]];
  buschX.forEach(function(bu){
    s += '<g transform="translate(' + bu[0] + ',' + bu[1] + ') scale(' + bu[2] + ')" opacity=".92">'
      + '<ellipse cx="-11" cy="0" rx="14" ry="9" fill="#7FB56F"/>'
      + '<ellipse cx="9" cy="-2" rx="16" ry="10" fill="#8FC178"/>'
      + '<ellipse cx="0" cy="4" rx="18" ry="8" fill="#79A968"/></g>';
  });
  /* 6 Bäume in einer Reihe (Abstand 162 → keine Überlappung), jeder auf eigenem Hügel.
     Größe & Kronenform je Wissensbereich → jeder Baum ist sofort erkennbar. */
  var BAUM_X = [78, 240, 402, 564, 726, 888];
  var wwSignTop = groundY + 10;                     /* Schilder als Tafelreihe unterhalb der Bäume */
  wald.baeume.forEach(function(b, idx){
    var hinten = (idx % 2 === 0);
    var x = BAUM_X[idx];
    var sk = hinten ? 0.9 : 1.0;
    var hy = hinten ? groundY - 26 : groundY - 12;  /* Hügelkuppe */
    var y0 = hy - 4;
    var fo = WWP_BAUM_FORM[b.id] || { f:1, form:"rund" };
    var form = fo.form, rM = 64 * fo.f;
    /* Stammhöhe wächst MIT der Krone → ausgewogenes Verhältnis, kein Lutscher-Look */
    var stammH = rM * 1.7 + b.pct * 0.8;
    var cy = -(stammH + rM * 0.62);
    var tR = b.total <= 6 ? 15 : (b.total <= 10 ? 13.5 : (b.total <= 12 ? 12 : 11));
    var hw = (WWP_FORM_HW[form] || 1.15) * rM;
    var R = Math.max(hw - tR - 2, rM * 0.3);
    var posis = wwpTuffPosis(b.total, R, WWP_FORM_ASPECT[form] || 0.95);
    s += '<ellipse cx="' + x + '" cy="' + hy + '" rx="82" ry="17" fill="' + (hinten ? "#9BD489" : "#96CE83") + '"/>';
    s += '<g class="wwp-tree" transform="translate(' + x + ',' + y0 + ') scale(' + sk + ')">';
    var bw = rM * 0.20;                         /* Stamm-Halbbbreite (skaliert mit der Baumgröße) */
    /* Wurzeln: wachsen aus dem Wurzelhals heraus (vor dem Stamm gezeichnet) */
    s += wwpWurzeln(rM, bw);
    /* Stamm mit Wurzelhals → Wurzeln sitzen IM Stamm, kein sichtbarer Standfuß */
    s += wwpStamm(stammH, bw);
    /* Seitenäste: bleiben unterhalb der Krone sichtbar → echter Baum statt Lutscher */
    var bh = stammH * 0.46, bl = stammH * 0.20;
    s += '<path d="M-8 ' + (-bh).toFixed(0) + ' Q -24 ' + (-(bh + bl * 0.45)).toFixed(0) + ' -34 ' + (-(bh + bl)).toFixed(0) + '" stroke="#7A4E26" stroke-width="6" fill="none" stroke-linecap="round"/>';
    s += '<path d="M8 ' + (-(bh + stammH * 0.10)).toFixed(0) + ' Q 24 ' + (-(bh + stammH * 0.10 + bl * 0.45)).toFixed(0) + ' 32 ' + (-(bh + stammH * 0.10 + bl)).toFixed(0) + '" stroke="#8A5A2B" stroke-width="6" fill="none" stroke-linecap="round"/>';
    /* Krone: solide Silhouette (kein Transparenz-Schaum) */
    s += wwpKrone(form, rM, cy);
    posis.forEach(function(p, ti){
      var t = b.tuffs[ti];
      var col = WWP_TUFF_FARBEN[t.status] || WWP_TUFF_FARBEN.neu;
      var cls = "wwp-tuff" + (t.status === "meister" ? " wwp-gold" : "");
      s += '<circle class="' + cls + '" data-key="' + t.key + '" cx="' + (p[0]).toFixed(1) + '" cy="' + (cy + p[1]).toFixed(1) + '" r="' + tR + '" fill="' + col + '" stroke="#3F6B37" stroke-width="' + (t.status === "neu" ? 1.2 : 2) + '" opacity="' + (t.status === "neu" ? 0.85 : 1) + '" role="button" tabindex="0" aria-label="' + escHtml(t.name) + '"/>';
      if(t.status === "meister"){
        s += '<text class="wwp-sparkle" x="' + (p[0]).toFixed(1) + '" y="' + (cy + p[1] + 4).toFixed(1) + '" text-anchor="middle" font-size="11">✨</text>';
      }
      if(t.due){
        s += '<text class="wwp-due" x="' + (p[0]).toFixed(1) + '" y="' + (cy + p[1] + tR + 5).toFixed(1) + '" text-anchor="middle" font-size="9">⏰</text>';
      }
    });
    if(b.status === "gold"){
      s += '<text class="wwp-animal" x="0" y="' + (cy - rM * (WWP_FORM_TOP[form] || 1.0) - 6).toFixed(0) + '" text-anchor="middle" font-size="19">' + WWP_TIERE[idx % WWP_TIERE.length] + '</text>';
    }
    s += '</g>';
    s += wwpSchild(x, wwSignTop, b, idx);
  });
  s += '</svg>';
  wwpSceneEl.innerHTML = s;
  Array.prototype.forEach.call(wwpSceneEl.querySelectorAll(".wwp-tuff"), function(el){
    el.addEventListener("click", function(){ wwZeigeTuff(el.getAttribute("data-key")); });
    el.addEventListener("keydown", function(ev){
      if(ev.key === "Enter" || ev.key === " "){ ev.preventDefault(); wwZeigeTuff(el.getAttribute("data-key")); }
    });
  });
}
if(waldBtnEl) waldBtnEl.addEventListener("click", openWissenswald);
var waldBackEl = document.getElementById("waldBack");
if(waldBackEl) waldBackEl.addEventListener("click", closeWissenswald);
document.addEventListener("keydown", function(ev){
  if(ev.key === "Escape" && wwpViewEl && wwpViewEl.style.display !== "none") closeWissenswald();
});

if(legalModalEl){
  legalModalEl.addEventListener("click", function(e){
    if(e.target === legalModalEl) closeLegalModal();
  });
}
document.addEventListener("keydown", function(e){
  if(e.key === "Escape") closeLegalModal();
});
document.addEventListener("click", function(e){
  var t = e.target && e.target.closest ? e.target.closest("[data-legal]") : null;
  if(!t) return;
  e.preventDefault();
  try{
    openLegalModal(t.getAttribute("data-legal"), t.getAttribute("data-title"));
  }catch(err){
    window.location.href = t.getAttribute("data-legal");
  }
});
window.openLegalModal = openLegalModal;
window.closeLegalModal = closeLegalModal;

// ============================================================
// AUTH LAYER – Login, Register, Progress-Sync
// ============================================================

var API = 'https://mapi.andybrandy.at';

var auth = {
  token: null,
  user: null
};

// ---------- Token Management ----------
function getToken() {
  return localStorage.getItem('mathemit_token');
}
function getUser() {
  var u = localStorage.getItem('mathemit_user');
  return u ? JSON.parse(u) : null;
}
function saveAuth(token, user) {
  localStorage.setItem('mathemit_token', token);
  localStorage.setItem('mathemit_user', JSON.stringify(user));
  auth.token = token;
  auth.user = user;
}
function clearAuth() {
  localStorage.removeItem('mathemit_token');
  localStorage.removeItem('mathemit_user');
  auth.token = null;
  auth.user = null;
}

// ---------- API Helper ----------
function apiFetch(endpoint, options) {
  var headers = {
    'Content-Type': 'application/json'
  };
  var token = getToken();
  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
    /* World4You (FastCGI) streicht den Authorization-Header, bevor PHP ihn sieht.
       Der Custom-Header X-API-Token kommt an und wird von security.php akzeptiert. */
    headers['X-API-Token'] = token;
  }
  var controller = new AbortController();
  var timeout = setTimeout(function() { controller.abort(); }, 8000);
  return fetch(API + endpoint, {
    method: 'POST',
    headers: headers,
    body: options && options.body ? JSON.stringify(options.body) : null,
    signal: controller.signal
  }).then(function(res) {
    clearTimeout(timeout);
    return res.json().then(function(data) {
      data._httpStatus = res.status;
      return data;
    }).catch(function() {
      return { _httpStatus: res.status, status: 'error', message: 'Invalid response' };
    });
  }).catch(function(err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      return { _httpStatus: 0, status: 'error', message: 'Zeitüberschreitung – bitte erneut versuchen.' };
    }
    return { _httpStatus: 0, status: 'error', message: 'Netzwerkfehler' };
  });
}

// ---------- Auth UI ----------
var overlay     = document.getElementById('authOverlay');
var authMsg     = document.getElementById('authMsg');
var loginPanel  = document.getElementById('panel-login');
var regPanel    = document.getElementById('panel-register');
var loginTab    = document.getElementById('tab-login');
var regTab      = document.getElementById('tab-register');

function showMsg(text, type) {
  authMsg.textContent = text;
  authMsg.className = 'auth-msg ' + type;
}
function clearMsg() {
  authMsg.textContent = '';
  authMsg.className = 'auth-msg';
}

function switchTab(tab) {
  clearMsg();
  if (tab === 'login') {
    loginTab.classList.add('active');
    loginTab.setAttribute('aria-selected', 'true');
    regTab.classList.remove('active');
    regTab.setAttribute('aria-selected', 'false');
    loginPanel.hidden = false;
    regPanel.hidden = true;
    document.getElementById('authTitle').textContent = 'Anmelden';
  } else {
    regTab.classList.add('active');
    regTab.setAttribute('aria-selected', 'true');
    loginTab.classList.remove('active');
    loginTab.setAttribute('aria-selected', 'false');
    regPanel.hidden = false;
    loginPanel.hidden = true;
    document.getElementById('authTitle').textContent = 'Registrieren';
  }
}

document.getElementById('authClose').addEventListener('click', function(){
  clearMsg();
  hideAuthOverlay();
});
overlay.addEventListener('click', function(e){
    if (e.target === overlay) hideAuthOverlay();
});
document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && !overlay.hidden) hideAuthOverlay();
});

loginTab.addEventListener('click', function() { switchTab('login'); });
regTab.addEventListener('click', function() { switchTab('register'); });

function showAuthOverlay() { overlay.hidden = false; }
function hideAuthOverlay() { overlay.hidden = true; }

function setSubmitLoading(form, loading) {
  var btn = form.querySelector('.auth-submit');
  if (loading) {
    btn.disabled = true;
    btn.textContent = '…';
  } else {
    btn.disabled = false;
    btn.textContent = form.id === 'loginForm' ? 'Anmelden' : 'Registrieren';
  }
}

// ---------- Login ----------
document.getElementById('loginForm').addEventListener('submit', function(e) {
  e.preventDefault();
  clearMsg();

  var nickname = document.getElementById('loginNickname').value.trim();
  var pin      = document.getElementById('loginPin').value.trim();

  if (!nickname || !pin) {
    showMsg('Bitte Nickname und PIN ausfüllen.', 'error');
    return;
  }
  if (!/^[0-9]{4}$/.test(pin)) {
    showMsg('PIN muss genau 4 Ziffern haben.', 'error');
    return;
  }

  var form = e.target;
  setSubmitLoading(form, true);

  apiFetch('/login.php', { body: { nickname: nickname, pin: pin } })
    .then(function(data) {
      setSubmitLoading(form, false);
      if (data.status === 'ok') {
        console.log('[mathemit] Login OK, user:', data.user.nickname);
        showMsg('Willkommen, ' + data.user.nickname + '!', 'success');
        saveAuth(data.token, data.user);
        console.log('[mathemit] nach saveAuth, getUser():', getUser());
        renderUserInfo();
        setTimeout(function() {
          hideAuthOverlay();
          loadProgressFromAPI(data.token);
        }, 600);
      } else {
        showMsg(data.message || 'Anmeldung fehlgeschlagen.', 'error');
      }
    });
});

// ---------- Register ----------
document.getElementById('registerForm').addEventListener('submit', function(e) {
  e.preventDefault();
  clearMsg();

  var nickname    = document.getElementById('regNickname').value.trim();
  var pin         = document.getElementById('regPin').value.trim();
  var klasse_code = document.getElementById('regClassCode').value.trim().toUpperCase();

  if (!nickname || !pin) {
    showMsg('Bitte Nickname und PIN ausfüllen.', 'error');
    return;
  }
  if (!/^[a-zA-Z0-9_\-]{2,50}$/.test(nickname)) {
    showMsg('Nickname: 2–50 Zeichen, Buchstaben/Zahlen/_/-', 'error');
    return;
  }
  if (!/^[0-9]{4}$/.test(pin)) {
    showMsg('PIN muss genau 4 Ziffern haben.', 'error');
    return;
  }
  if (klasse_code && !/^[A-Z0-9]{3,12}$/.test(klasse_code)) {
    showMsg('Klassen-Code: 3–12 Zeichen, nur Buchstaben/Zahlen', 'error');
    return;
  }
  // Art. 8 DSGVO (AT): Elternzustimmung für Kinder unter 14 — Pflichtbestätigung
  var consent = document.getElementById('regConsent');
  if (!consent || !consent.checked) {
    showMsg('Bitte bestätige die Zustimmung (14+ oder Eltern-Erlaubnis).', 'error');
    return;
  }

  var form = e.target;
  setSubmitLoading(form, true);

  apiFetch('/register.php', {
    body: {
      nickname: nickname,
      pin: pin,
      klasse_code: klasse_code || undefined,
      consent: true
    }
  }).then(function(data) {
    setSubmitLoading(form, false);
    if (data.status === 'ok') {
      showMsg('Registriert! Du kannst dich jetzt anmelden.', 'success');
      setTimeout(function() { switchTab('login'); }, 1200);
    } else {
      showMsg(data.message || 'Registrierung fehlgeschlagen.', 'error');
    }
  });
});

// ---------- Progress Sync ----------
function loadProgressFromAPI(customToken) {
  var token = customToken || getToken();
  if (!token) return;
  apiFetch('/progress.php').then(function(data) {
    if (data.status === 'ok' && data.data) {
      var d = data.data;
      /* Login: Server ist Source-of-Truth und überschreibt den lokalen (Gast-)Stand */
      state.points  = d.points      || 0;
      state.streak  = d.streak      || 0;
      state.bestStreak = d.best_streak || 0;
      state.solved  = d.solved      || 0;
      state.correct = d.correct     || 0;
      state.badges  = d.badges      || state.badges || [];
      if(d.repeatQ){ state.repeatQ = sanitizeRepeatQ(d.repeatQ); }
      if(d.owls){ state.owls = sanitizeOwls(d.owls); }
      if(d.spaced){ state.spaced = spacedSanitize(d.spaced); }
      ensureOwls();
      state.weekly = sanitizeWochen(d.goals);
      state.mode    = (d.mode && MODES.some(function(m){return m.id===d.mode;})) ? d.mode : (state.mode || 'alles');
      state.grade   = (d.grade && GRADES.some(function(g){return g.id===d.grade;})) ? d.grade : (state.grade || 'all');
      console.log('[mathemit] Fortschritt vom Server geladen:', JSON.stringify({p:state.points,s:state.streak,bs:state.bestStreak}));
      updateStatsUI();
      updateModeAmpel();
      syncProgressToAPI();
    }
  }, function(err) {
    console.warn('[mathemit] Fortschritt konnte nicht vom Server geladen werden:', err);
  });
}

function syncProgressToAPI() {
  var token = getToken();
  if (!token) return;

  apiFetch('/progress.php', {
    body: {
      points:      state.points,
      streak:      state.streak,
      best_streak: state.bestStreak,
      solved:      state.solved,
      correct:     state.correct,
      badges:      state.badges,
      mode:        state.mode,
      grade:       state.grade,
      diff:        state.diff,
      repeatQ:     state.repeatQ,
      owls:        state.owls,
      spaced:      state.spaced,
      goals:       state.weekly
    }
  }).then(function(data) {
    // Sync-Fehler ignorieren - Fortschritt bleibt lokal gespeichert
  }, function(err) {
    // Netzwerkfehler ignorieren
  });
}

// Nach jeder gelösten Aufgabe synchronisieren
var _origHandleCheck = handleCheck;
handleCheck = function() {
  _origHandleCheck.apply(this, arguments);
  syncProgressToAPI();
};

// ---------- Logout Button ----------
function buildUserInfo() {
  var u = getUser();
  if (u) {
    return '<div class="user-info">' +
      '<span class="nickname">' + escHtml(u.nickname) + '</span>' +
      '<button class="logout" id="logoutBtn">Abmelden</button>' +
      '</div>';
  }
  return '<button class="btn" id="loginOpenBtn" style="padding:8px 16px; font-size:.82rem;">Anmelden</button>';
}
function renderUserInfo() {
  var stats = document.querySelector('.stats');
  if (!stats) {
    console.warn('[mathemit] .stats nicht gefunden – renderUserInfo übersprungen');
    return;
  }
  // Vorhandene Slot-Instanzen entfernen (sicherheitshalber alle, nicht nur die erste)
  var existing = stats.querySelectorAll('#userInfoSlot');
  for (var i = 0; i < existing.length; i++) existing[i].remove();
  // Zusätzlich: alte Login-Buttons (ohne userInfoSlot) aus früheren Renderings entfernen
  var stray = stats.querySelectorAll('#loginOpenBtn');
  for (var j = 0; j < stray.length; j++) stray[j].remove();

  var slot = document.createElement('span');
  slot.id = 'userInfoSlot';
  slot.innerHTML = buildUserInfo();
  var logoutBtn = slot.querySelector('#logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', function() {
    clearAuth();
    renderUserInfo();
  });
  var loginBtn = slot.querySelector('#loginOpenBtn');
  if (loginBtn) loginBtn.addEventListener('click', function() {
    clearMsg();
    showAuthOverlay();
  });
  stats.appendChild(slot);
  console.log('[mathemit] renderUserInfo done, user =', getUser());
}
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// ============ Feedback-Feature (P3) ============

function escHtml(str){ return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function openFeedbackModal(){
  var modal = document.getElementById('feedbackModal');
  if(!modal){
    var html = '<div id="feedbackModal" style="position:fixed;bottom:20px;right:20px;width:340px;background:#fff;border:2px solid #4a90d9;border-radius:12px;padding:16px;z-index:9999;box-shadow:0 4px 24px rgba(0,0,0,0.2);font-family:sans-serif;">' +
      '<h4 style="margin:0 0 8px 0;font-size:.95rem;">💬 Feedback geben</h4>' +
      '<div style="font-size:.72rem;color:#8a6d3b;background:#fdf6e3;border-radius:6px;padding:5px 8px;margin-bottom:8px;line-height:1.35;">⚠️ Feedback wird <strong>öffentlich</strong> gespeichert (GitHub). Bitte <strong>keine echten Namen oder persönlichen Daten</strong> angeben.</div>' +
      '<textarea id="feedbackText" rows="3" placeholder="Was gefällt dir? Was stört dich?" style="width:100%;box-sizing:border-box;padding:8px;border:1px solid #ccc;border-radius:6px;font-size:.85rem;resize:vertical;"></textarea>' +
      '<div style="margin-top:8px;display:flex;gap:6px;justify-content:flex-end;">' +
      '<button id="feedbackCancel" style="padding:6px 12px;font-size:.8rem;border:1px solid #ccc;border-radius:6px;background:#f5f5f5;cursor:pointer;">Abbrechen</button>' +
      '<button id="feedbackSubmit" style="padding:6px 12px;font-size:.8rem;border:none;border-radius:6px;background:#4a90d9;color:#fff;cursor:pointer;">Absenden</button>' +
      '</div><div id="feedbackMsg" style="margin-top:6px;font-size:.78rem;color:#666;"></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('feedbackCancel').onclick = closeFeedbackModal;
    document.getElementById('feedbackSubmit').onclick = submitFeedback;
    modal = document.getElementById('feedbackModal');
  }
  modal.style.display = 'block';
}
function closeFeedbackModal(){
  var m = document.getElementById('feedbackModal');
  if(m) m.style.display = 'none';
}
function submitFeedback(){
  var txt = (document.getElementById('feedbackText').value || '').trim();
  if(!txt){
    document.getElementById('feedbackMsg').textContent = 'Bitte gib mindestens einen Hinweis ein.';
    return;
  }
  var payload = { exercise: JSON.parse(JSON.stringify(state.current)), feedback: txt, timestamp: Date.now() };
  // Backend liegt auf mapi.andybrandy.at (wie login/progress) - Feedback läuft über
  // den serverseitigen Proxy backend/feedback.php, das GitHub-Token bleibt auf dem Server.
  fetch(API + '/feedback.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: 'Feedback: ' + (state.current && state.current.q ? state.current.q.slice(0,40) : 'Aufgabe'),
      labels: ['feedback'],
      body: JSON.stringify(payload, null, 2)
    })
  }).then(function(r){
    return r.text().then(function(t){
      var d = null;
      try { d = JSON.parse(t); } catch(e) { /* Server lieferte kein JSON (z. B. HTML-Fehlerseite) */ }
      if(!r.ok){
        throw new Error((d && d.error ? d.error : 'HTTP ' + r.status) + (d && d.hint ? ' – ' + d.hint : ''));
      }
      if(!d){ throw new Error('Unerwartete Server-Antwort (kein JSON)'); }
      return d;
    });
  }).then(function(){
    document.getElementById('feedbackMsg').textContent = '✅ Danke! Feedback wurde gespeichert.';
    setTimeout(closeFeedbackModal, 2000);
  }).catch(function(e){
    document.getElementById('feedbackMsg').textContent = '⚠️ Fehler: ' + e.message;
  });
}

// Button nach 10s anzeigen
setTimeout(function(){
  var btn = document.getElementById('feedbackBtn');
  if(!btn){
    var b = document.createElement('button');
    b.id = 'feedbackBtn';
    b.textContent = '💬 Feedback';
    b.style.cssText = 'position:fixed;bottom:12px;right:12px;z-index:9998;padding:6px 12px;font-size:.78rem;border:1px solid #4a90d9;border-radius:8px;background:#eef4fd;cursor:pointer;color:#333;';
    b.onclick = openFeedbackModal;
    document.body.appendChild(b);
  }
}, 10000);

// Overlay startet immer geschlossen – Login ist ein Angebot, kein Zwang.
renderUserInfo();
var token = getToken();
if (token) {
  loadProgressFromAPI();
}

  /* ============ Eulen-Logo: laden + animieren ============ */
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var owlSvg = document.querySelector(".owl-host");
  function owlCelebrate(){
    if(!owlSvg || reduceMotion){ return; }
    var svg = owlSvg.querySelector("svg");
    if(!svg){ return; }
    svg.classList.add("owl-flap");
    setTimeout(function(){ svg.classList.remove("owl-flap"); }, 700);
  }
  (function initOwlLogo(){
    if(!owlSvg){ return; }
    fetch("logo.svg", {credentials:"same-origin"}).then(function(r){
      if(!r.ok){ throw new Error("HTTP " + r.status); }
      return r.text();
    }).then(function(svgText){
      owlSvg.innerHTML = svgText;
      var svg = owlSvg.querySelector("svg");
      if(svg){ svg.classList.add("owl-logo"); }
      if(reduceMotion){ return; }
      (function scheduleBlink(){
        setTimeout(function(){
          var s = owlSvg.querySelector("svg");
          if(s){
            s.classList.add("owl-blink");
            setTimeout(function(){ s.classList.remove("owl-blink"); }, 150);
          }
          scheduleBlink();
        }, 3000 + Math.floor(Math.random() * 4000));
      })();
      var lastMove = 0;
      document.addEventListener("mousemove", function(e){
        var t2 = Date.now();
        if(t2 - lastMove < 80){ return; }
        lastMove = t2;
        var s = owlSvg.querySelector("svg");
        if(!s){ return; }
        var r = s.getBoundingClientRect();
        var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        var dx = e.clientX - cx, dy = e.clientY - cy;
        var dist = Math.sqrt(dx * dx + dy * dy) || 1;
        var k = Math.min(3.2, dist / 40);
        var ox = (dx / dist) * k, oy = (dy / dist) * k;
        var pupils = s.querySelectorAll(".owl-pupil");
        for(var i = 0; i < pupils.length; i++){
          pupils[i].setAttribute("transform", "translate(" + ox.toFixed(2) + " " + oy.toFixed(2) + ")");
        }
      });
    }).catch(function(){ /* Logo nicht kritisch */ });
  })();

updateStatsUI();
updateModeAmpel();
nextExercise();
})();
