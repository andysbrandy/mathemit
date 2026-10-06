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
var GARTEN_BEREICHE = MB.GARTEN_BEREICHE;
var gartenStatus = MB.gartenStatus;
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
    /* Neue Woche: der Bestand der Wiederholungsschlange wandert als
       repeatsStart mit — sonst zeigt der Chip offene Wiederholungen, das
       Menue aber 0/0 gruen. repeatsStart ist eine Wochenkonstante, kein
       Zaehler: sie wird genau einmal beim Wochenwechsel gesetzt. */
    var bestand = 0;
    try{
      if(typeof state !== "undefined" && state && Array.isArray(state.repeatQ)){
        bestand = Math.max(0, Math.min(15, state.repeatQ.length));
      }
    }catch(e){ /* state noch nicht da (Start) — dann 0 */ }
    return { week:cur, points:0, solved:0, repeats:0, repeatsNew:0, repeatsStart:bestand, done:[], bonusGiven:false };
  }
  var validIds = WOCHENZIELE.map(function(z){ return z.id; });
  return {
    week: cur,
    points: Math.max(0, Math.min(99999, Number(d.points) || 0)),
    solved: Math.max(0, Math.min(99999, Number(d.solved) || 0)),
    repeats: Math.max(0, Math.min(99999, Number(d.repeats) || 0)),
    repeatsNew: Math.max(0, Math.min(9999, Number(d.repeatsNew) || 0)),
    /* Alte Staende kennen repeatsStart noch nicht — dann gilt 0, wie bisher. */
    repeatsStart: Math.max(0, Math.min(15, Number(d.repeatsStart) || 0)),
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
/* P4.2: Ziel-Helfer — das Wiederholungsziel ist dynamisch.
 * Ziel = Bestand bei Wochenstart + neue Fehler dieser Woche (repeatsNew).
 * Der Wert ist "geschaffte Wiederholungen": Ziel minus offene Schlange.
 * Damit gilt immer: Rest = Ziel - Wert = repeatQ.length = Chip-Zahl.
 * Der Bestand muss NICHT extra gezaehlt werden, weil er im Ziel steckt —
 * und was diese Woche noch offen ist, steht live in der Schlange.
 * Der 15er-Deckel passt zum Chip: storeRepeatInstance kappt die Schlange
 * ebenfalls bei 15, ein hoeheres Ziel waere unerreichbar. */
function wzZiel(z){
  if(z.dynamisch){
    return Math.max(0, Math.min(15, Number(state.weekly.repeatsStart) || 0))
         + Math.max(0, Number(state.weekly.repeatsNew) || 0);
  }
  return z.ziel;
}
function wzWert(z){
  if(z.dynamisch){
    var offen = 0;
    try{ if(typeof state !== "undefined" && state && Array.isArray(state.repeatQ)){ offen = state.repeatQ.length; } }catch(e){}
    return Math.max(0, wzZiel(z) - offen);
  }
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
    msg = "🔁 " + wert + " von " + ziel + " Wiederholungen geschafft";
    var offen = 0;
    try{ if(typeof state !== "undefined" && state && Array.isArray(state.repeatQ)){ offen = state.repeatQ.length; } }catch(e){}
    if(offen > 0){ msg += " — noch " + offen + " offen, genau wie im 🔁-Chip."; }
    else { msg += " — alles geschafft, die Schlange ist leer!"; }
    msg += " Jede falsche Aufgabe landet hier — bis du sie wieder sicher löst!";
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
/* P4.1: Fokus-Chip — gezieltes Üben EINES Generators (aus dem Wissensgarten) */
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

/*
 * Bugfix: Die Aufgabenleiste war unter Windows/Edge mit der Maus nicht
 * scrollbar — es gibt dort praktisch keine Geste, die eine waagerechte
 * Leiste bewegt. Touchpad-Zwei-Finger-Schub fehlt, die Scrollbar ist per
 * CSS ausgeblendet, und ein senkrechtes Mausrad scrollt die Seite, nicht
 * die Leiste (gemessen: chips.scrollLeft blieb bei 2, window.scrollY
 * stieg auf 141).
 *
 * Dieser Handler leitet das senkrechte Rad selbst auf die Leiste um.
 * Drei Regeln, damit er nicht nervt:
 *   - Eine echte seitliche Geste (Trackpad) wird nie angefasst.
 *   - Strg+Rad bleibt Zoom, das gehoert dem Browser.
 *   - Am Anschlag wird NICHT geschluckt: ist nichts mehr zu scrollen,
 *     scrollt die Seite weiter. Sonst waere die Leiste eine Sackgasse.
 * Zusaetzlich Pfeiltasten, damit die Leiste auch ohne Maus bedienbar ist.
 */
function enableChipWheelScroll(el){
  if(!el){ return; }
  el.addEventListener("wheel", function(ev){
    /* deltaMode: 0 = Pixel, 1 = Zeilen, 2 = Seiten. Zeilen und Seiten
     * kommen von aelteren Windows-Trackpads und muessen umgerechnet
     * werden, sonst scrollt ein Tick quasi gar nichts. */
    if(ev.ctrlKey){ return; }
    if(Math.abs(ev.deltaX) >= Math.abs(ev.deltaY)){ return; }
    var max = el.scrollWidth - el.clientWidth;
    if(max <= 0){ return; }
    var faktor = ev.deltaMode === 1 ? 16 : (ev.deltaMode === 2 ? el.clientWidth : 1);
    var vorher = el.scrollLeft;
    var ziel = vorher + ev.deltaY * faktor;
    /* Am Anschlag durchlassen: das Rad gehoert dann der Seite. */
    if(ziel <= 0 && vorher <= 0){ return; }
    if(ziel >= max && vorher >= max){ return; }
    ev.preventDefault();
    el.scrollLeft = ziel;
  }, {passive:false});
  /* Pfeiltasten: ohne Maus gibt es sonst gar keinen Weg in die Leiste. */
  el.addEventListener("keydown", function(ev){
    var schritt = Math.max(120, Math.round(el.clientWidth * 0.8));
    if(ev.key === "ArrowRight"){ el.scrollBy({left:schritt, behavior:"smooth"}); }
    else if(ev.key === "ArrowLeft"){ el.scrollBy({left:-schritt, behavior:"smooth"}); }
    else { return; }
    ev.preventDefault();
  });
}
/* Alle drei Leisten: Aufgaben, Stufen und Schwierigkeit. */
[chipsHost, document.getElementById("gradeChips"), document.getElementById("diffChips")].forEach(function(el){
  /* tabindex, damit die Leiste selbst ein Sprungziel ist und der
   * Tastatur-Scroll ueberhaupt einen :focus bekommt. role="group" mit
   * aria-label, weil es sonst ein unbenannter Bereich fuer Screenreader
   * waere; die Chips darin sind ja echte Buttons. */
  if(el){
    el.setAttribute("tabindex", "0");
    el.setAttribute("role", "group");
    if(!el.getAttribute("aria-label")){ el.setAttribute("aria-label", "Aufgaben-Themen, waagerecht scrollbar"); }
    enableChipWheelScroll(el);
  }
});

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
  /* P4.1: Garten-Fortschritt in der Baum-Pill */
  if(gartenPctValEl){ gartenPctValEl.textContent = gartenStatus(state.spaced, Math.floor(Date.now()/1000)).pct + "%"; }
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
  /*
   * P5.3 — Fallback gegen "undefined".
   *
   * `defs[b]` war ungeschützt: eine unbekannte Badge-ID (z. B. aus einem
   * älteren oder künftigen Sync-Payload) wäre wörtlich als "undefined"
   * für ein Kind sichtbar. Unbekanntes wird jetzt als neutrale Medaille
   * gezeigt und nie ganz ausgeblendet — die Liste bleibt nachvollziehbar.
   */
  host.innerHTML = state.badges.map(function(b){
    return '<span class="badge">'+escHtml(defs[b] || "🏅")+'</span>';
  }).join("");
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
  /* P4.1: Fokus aus dem Wissensgarten — gezielt EINEN Generator üben */
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
    /* P4.2: Wochenziele — nur RICHTIGE Lösungen zählen.
       repeats wird NICHT mehr gezaehlt: der Wert des dynamischen Ziels kommt
       live aus Ziel minus Schlange (wzWert), ein Treffer-Zaehler wuerde nur
       daneben stehen. Das alte Feld repeats bleibt lesbar und reist weiter
       mit (Server-Historie), wird aber nicht mehr geschrieben. */
    state.weekly.solved += 1;
    state.weekly.points += 10 + Math.min(10, state.streak);
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
  /* P4.1: Wissensgarten offen? Baeume sofort aktualisieren (Gold-Feier inklusive) */
  if(wwpViewEl && wwpViewEl.style.display !== "none") renderWissensgarten();
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
/* Beide Vollbild-Ansichten (Eulenhain, Wissensgarten) sind position:fixed
   und scrollen selbst. Sie nehmen den Body aber NICHT aus dem Fluss — die
   Hauptseite (.wrap, 761 px Desktop / 1218 px Handy) bleibt darunter
   scrollbar. Folge war ein zweiter Scrollbalken: einer fuer das Dokument,
   einer fuer das Overlay. Auf dem Handy kam es nur bei vielen Eulen dazu,
   weil die Szene erst dann das Fenster ueberragt.

   Gemessen (scrollHeight - clientHeight):
     Desktop  Dokument +129 px, Overlay +534..1235 px  -> zwei Balken
     Handy    Dokument +558 px, Overlay 0..+117 px     -> zwei ab 50 Eulen

   Der Body wird waehrend des Offenseins stillgelegt und danach auf seinen
   Ausgangswert zurueckgesetzt — nicht blind auf '', weil die Regel aus
   style-active.css (.chips) das overflow-verhalten beeinflusst.
   Die Scrollposition wird gesichert und zurueckgesetzt: sonst stuende die
   Seite nach dem Schliessen an anderer Stelle. */
var BODY_SCROLL_Y = 0, BODY_OVERFLOW_VORHER = "", HTML_OVERFLOW_VORHER = "";
var BODY_SCROLL_GESICHERT = false;
function overlayScrollSperren(gesicherteY){
  var b = document.body, h = document.documentElement;
  if(!b || BODY_SCROLL_GESICHERT) return;
  /* Wert uebergeben? Dann zaehlt dieser (die Aufrufer sichern VOR dem
     Rendern). Sonst der aktuelle Wert — der ist aber auf dem Handy bereits
     0, sobald das Rendern die Seite nach oben geschoben hat. */
  BODY_SCROLL_Y = (typeof gesicherteY === "number") ? gesicherteY : window.scrollY;
  BODY_OVERFLOW_VORHER = b.style.overflowY;
  HTML_OVERFLOW_VORHER = h.style.overflowY;
  /* Wichtig ist die html-Regel, nicht die body-Regel: gemessen wird immer
     ueber documentElement, und "overflow:hidden" am Body allein laesst das
     Dokument scrollbar. Der Body wird mitgesperrt, weil manche Browser das
     Wheel sonst ueber den Body leiten.

     WICHTIG — die Sperre selbst kostet die Position: sobald overflow:hidden
     am html steht, meldet das Handy sofort scrollY 0, noch bevor wir
     freigeben. Deshalb wird direkt danach wiederhergestellt (Desktop zeigt
     die richtige Position ohnehin, das Handy braucht es). Ohne das landet
     die Seite nach dem Schliessen oben statt bei der Aufgabe. */
  h.style.overflowY = "hidden";
  b.style.overflowY = "hidden";
  BODY_SCROLL_GESICHERT = true;
  window.scrollTo(0, BODY_SCROLL_Y);
}
function overlayScrollFreigeben(){
  var b = document.body, h = document.documentElement;
  if(!b || !BODY_SCROLL_GESICHERT) return;
  h.style.overflowY = HTML_OVERFLOW_VORHER;
  b.style.overflowY = BODY_OVERFLOW_VORHER;
  BODY_SCROLL_GESICHERT = false;
  /* requestAnimationFrame: das Neuaufbauen der Ansicht setzt die Position
     sonst danach noch einmal auf 0. */
  requestAnimationFrame(function(){
    window.scrollTo(0, BODY_SCROLL_Y);
  });
}
/* Beim Schliessen ueber Escape gilt: der Body muss wieder frei, sonst
   bleibt die Seite stumm. Siehe die Taste-Abfrage weiter unten. */
function overlayOffen(){ return !!(eulenhainViewEl && eulenhainViewEl.style.display !== "none")
                            || !!(wwpViewEl && wwpViewEl.style.display !== "none"); }
var eulenhainViewEl = document.getElementById("eulenhainView");
var ehpSceneEl = document.getElementById("ehpScene");
var ehpStatsEl = document.getElementById("ehpStats");
var ehHintEl = document.getElementById("ehHint");
function openEulenhain(){
  /* Die Position VOR dem Rendern sichern, nicht danach: das Neuaufbauen
     dauert auf dem Handy mehrere hundert Millisekunden, und bis dahin ist
     die Seite bereits an den Anfang gesprungen (gemessen: scrollY war beim
     Sichern schon 0 statt 300). */
  var y = window.scrollY;
  renderEulenhain();
  if(eulenhainViewEl) eulenhainViewEl.style.display = "block";
  overlayScrollSperren(y);
}
function closeEulenhain(){
  if(eulenhainViewEl) eulenhainViewEl.style.display = "none";
  if(!overlayOffen()) overlayScrollFreigeben();
}
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
  /* Baum-Geometrie: von der Krone nach unten wachsend — je Ast 5 Eulen, oben wartet die nächste Eule.
   *
   * P5.4 — Krone, Stamm, Wurzeln und Äste kommen jetzt aus DENSELBEN Helfern
   * wie die sechs Bäume im Wissensgarten (wwpKrone / wwpStamm / wwpAst).
   * Vorher hatte der Eulenhain eine eigene Krone aus fünf Grüntönen und zwei
   * aufgesetzte Wurzelkeile — deshalb sah er aus wie eine andere Baumart als
   * die Bäume daneben. "Passt zu den Gartenbäumen" ist so per Konstruktion
   * erfüllt und nicht nur per Augenmaß.
   *
   * Alle Höhen werden von der Wiese nach oben gerechnet; die Zeichenfunktionen
   * arbeiten in lokalen Koordinaten (0 = Stammfuß, nach oben negativ) und
   * werden über <g transform> auf die Szene gesetzt.
   */
  var spacing = 92, W = 860, trunkX = 430;
  var form = "busch";                                /* breit und ausladend wie ein Hofbaum */
  var s = "", i, k;
  var OWL_ABSTAND = 54, OWL_START = 68, AST_UEBERSTAND = 40;
  /* P5.5 — Belegung der Äste von unten nach oben: 3, 4, 5, 5, 5, …
   *
   * Vorher wurden alle Äste gleich behandelt (bis zu 5 Eulen). Das ergab unten
   * einen winzigen und oben einen sehr langen Ast — die Krone wirkte dadurch wie
   * ein Kugelkopf auf einem Besenstiel: die untersten Eulen klebten dicht am
   * Stamm, die obersten standen weit draussen im Leeren.
   *
   * Die Rampe 3 → 4 → 5 löst das, weil die Astlänge an der Eulenanzahl hängt:
   * der unterste Ast bleibt kurz und kräftig, nach oben werden die Zweige länger.
   * Zusammen mit der Krone, die oben aufsetzt, ergibt das eine Silhouette, die
   * nach oben breiter wird, statt in die Breite zu kippen. Ab dem vierten Ast
   * bleiben es 5, damit oben Ruhe eintritt und das Bild nicht ausfranst.
   */
  function astPlan(n){
    var p = [], frei = n, kap = 3;
    while(frei > 0){
      var nimm = Math.min(kap, frei);
      p.push(nimm);
      frei -= nimm;
      if(kap < 5) kap++;
    }
    return p;
  }
  /* Astlaenge bei UNVERAENDERTER Eulengrösse — der Ausgangswert, auf den der
     Wachstumsfaktor angewendet wird. */
  function maxAstLenBase(n){
    return OWL_START + (n - 1) * OWL_ABSTAND + AST_UEBERSTAND;
  }
  /* Wo liegt die Fusssohle im 64x52-Kasten?
     Die Eule ist <svg width=64 height=52 viewBox="-12 0 124 100">. Kasten- und
     Bildverhaeltnis stimmen nicht ueberein (1,231 gegen 1,240), deshalb skaliert
     SVG den Inhalt einheitlich ("meet") und zentriert die Resthoehe oben wie
     unten — der Kasten ist also NICHT das Eulenbild. Die Fusssohle liegt bei
     viewBox-y 99 und damit 51,29 statt 52 Einheiten unter der Kastenoberkante.
     Wer sie auf den Ast legen will, muss das mitrechnen. Die Eulen wachsen
     allerdings mit dem Baum (eulenSk), deshalb wird der Weg unten aus der
     tatsaechlichen Kastenhoehe berechnet statt hier fest verdrahtet. */
  /* Kronengrösse aus einem FESTEN Höhenverhältnis ableiten, nicht durch Raten.
     Zwei unabhängige Zuschläge (Astlänge, Astzahl) schwankten je nach
     Eulenstand zwischen 58 % und 29 % Kronenanteil — mal Laubballon, mal
     Lutscher. Hier ist der Anteil konstant, der Baum sieht bei jedem Stand
     nach Baum aus.

     Die Krone muss aber mindestens so breit sein, dass der längste Ast aus ihr
     hervorkommt; dafür steht der zweite Summand.
       crownBotH = hFirst + 16 + 0.12·rM      (Abstand Krone–oberster Zweig)
       crownH    = (TOP+BOT)·rM
       crownH / (crownBotH + crownH) = 0.42   (Zielanteil)
     ⇒ rM = 0.42·(hFirst+16) / (S − 0.42·(0.12+S))   mit S = TOP+BOT */
  var KRONEN_ANTEIL = 0.42, LUECKE = 16, KRONE_UEBER_AST = 0.12;
  var S = (WWP_FORM_TOP[form] || 1.0) + (WWP_FORM_BOT[form] || 0.9);
  var plan = astPlan(state.owls.length);
  var astZahl = plan.length;
  /* Der längste Ast muss aus der Krone hervorkommen. Bei der Rampe ist das der
     Ast mit 5 Eulen — aber nur, wenn so viele Eulen überhaupt da sind. */
  var groessteGruppe = 1;
  for(i = 0; i < plan.length; i++) if(plan[i] > groessteGruppe) groessteGruppe = plan[i];
  var hDeep = 150;                                   /* unterste Astreihe über der Wiese */
  /* P5.5 — Kronenhöhe darf nicht linear mit der Astzahl wachsen.
   *
   * Bei fest 92 px Abstand braucht der 25-Eulen-Baum 6 Reihen = 552 px allein
   * für die Äste; die daraus folgende Kronenhöhe (547 px) frisst dann zwei
   * Drittel der Gesamthöhe und die Äste quetschen sich unten zusammen.
   *
   * Deshalb wird der Reihenabstand nach oben hin gestaucht: ab der vierten
   * Reihe wird jede weitere Reihe um 6 px enger, nie unter 58 px (dort wären
   * die Eulen zu dicht). Der Baum wächst dadurch in die Breite statt in die
   * Höhe — was ohnehin zur buschigen Kronenform passt.
   */
  var reiheAb = [];
  for(i = 0; i < astZahl; i++){
    var ab = spacing - Math.max(0, i - 2) * 6;
    reiheAb.push(Math.max(58, ab));
  }
  var astHoehe = 0;
  for(i = 0; i < astZahl; i++) astHoehe += reiheAb[i];
  /* Summe der ersten n Reihenabstaende — der Ast in Reihe n sitzt so hoch. */
  function reiheSumme(n){
    var s = 0;
    for(var j = 0; j < n && j < reiheAb.length; j++) s += reiheAb[j];
    return s;
  }
  var hFirst = hDeep + astHoehe;                    /* Zweig der Warteeule */
  /* Abstand Kronenunterkante bis oberster Zweig ist LUECKE + KRONE_UEBER_AST·rM; die
     Deckelgrenze 330 ist die harte Grenze der Szenenbreite (2·1.18·330 = 779 px
     bei 860 px Breite). Ab dort muss die Krone schrumpfen, sonst würde sie
     breiter als das Bild — deshalb sinkt der Anteil bei sehr hohen Stufen
     bewusst und der Baum wird schlank statt breit. */
  var rM = Math.min(330, Math.max(
        KRONEN_ANTEIL * (hFirst + LUECKE) / (S - KRONEN_ANTEIL * (KRONE_UEBER_AST + S)),
        1));
  /* P5.5 — Kronenhoehe bleibt an die Astzone gekoppelt.
   *
   * Geprueft und VERWORFEN: eine Deckelung der Krone gegen die Astzone. Sie
   * greift nie, denn das Verhaeltnis Kronenhoehe zu Astzone liegt konstant bei
   * 0,78 bis 0,81 — von 1 bis 50 Eulen. Die Form ist also gesund, nichts kippt.
   *
   * Der Eindruck eines "Kugelkopfs" bei 25 Eulen entsteht woanders: nicht die
   * Krone ist zu gross, sondern die Eulen sind relativ zu ihr zu klein. Sie
   * sind fest 52 px hoch, waehrend die Krone auf 311 px Radius waechst. Bei
   * 25 Eulen sind es 25 kleine Figuren unter einer grossen Kugel.
   *
   * Die Eulen skalieren deshalb mit der Krone mit (bis 1,6x) und werden
   * zusaetzlich am engsten Reihenabstand gekappt, damit sie sich nie stapeln.
   */
  /* Deckel gegen die engste Zeile: die Eulen duerfen nie hoeher werden als der
     Reihenabstand, sonst stapeln sie sich bei 25+ Eulen (81 px Eule bei 74 px
     Abstand). Deshalb wird der Faktor noch einmal mit dem kleinsten
     Reihenabstand gekappt — mit 10 % Luft nach oben. */
  var engsteZeile = astZahl > 0 ? reiheAb[astZahl - 1] : spacing;
  var eulenSk = Math.min(1.6, Math.max(1, rM / 190));
  eulenSk = Math.min(eulenSk, (engsteZeile * 0.9) / 52);
  /* P5.5 — Ast und Krone muessen MITWACHSEN.
   *
   * Der Eulenabstand war fest 54 px, die Eulen waren fest 52 px gross, die Krone
   * wuchs dagegen mit der Astzahl von 268 auf 779 px Breite. Bei 25 Eulen musste
   * der längste Ast 546 px lang sein, war aber 324 px — die Äste verschwanden
   * als dünne Striche unter einem Kugelkopf. Genau das Gegenteil von "eine
   * schöne Gesamtkrone".
   *
   * Deshalb wird nicht der Ast gestreckt, sondern der EULENABSTAND so gewählt,
   * dass der längste Ast bei jedem Stand derselbe Anteil der Kronenhalbbreite
   * einnimmt (Ziel: der Ast ragt zu 62 % aus der Krone). Der Faktor ist der
   * Quotient aus Zielbreite und Basisbreite — er liegt zwischen 0,38 (3 Eulen,
   * Ast bereits zu lang) und 1 (Krone passt zum Basisast). Kleinere Abstände
   * machen die Eulen dichter, nicht kleiner: sie sollen schliesslich lesbar
   * bleiben.
   */
  /* Untergrenze 0,62: bei kleinerem Abstand (Faktor 0,38 bei 3 Eulen) würden
     die Eulen ineinanderschieben. Die 62 % gelten dann nur als Obergrenze der
     Kronenbreite — der Ast ragt nie weiter als 62 % hinaus, kann aber kürzer
     sein. Das ist die richtige Richtung: lieber ein etwas zu kurzer Ast als
     überlappende Eulen. */
  /* P5.5 — Die Aeste muessen mit der Krone EINE Silhouette bilden.
   *
   * Zwei Befunde aus Messungen:
   *
   * 1) Reihenfolge war umgekehrt. state.owls laeuft aufsteigend; vorher wurde
   *    die Liste umgedreht, wodurch Stufe 1 oben und Stufe 12 unten sass —
   *    spiegelverkehrt zur Rampe 3-4-5, die UNTEN beginnt.
   *
   * 2) Ast und Krone wuchsen nicht zusammen. Der Eulenabstand war fest 54 px
   *    und die Krone wuchs von 268 auf 779 px Breite. Bei 25 Eulen musste der
   *    längste Ast 546 px lang sein, war aber 324 px: das Ast/Kronen-Verhältnis
   *    kippte von 1,64 auf 0,83 und die Äste verschwanden als Striche unter dem
   *    Kugelkopf.
   *
   * Deshalb wird der Eulenabstand so gewählt, dass der längste Ast bei jedem
   * Stand derselbe Anteil der Kronenhalbbreite einnimmt. Untergrenze 0,62, damit
   * die Eulen nicht ineinanderschieben.
   *
   * Und: die Kronenhöhe folgt nicht mehr linear der Astzahl. Sonst frisst die
   * Krone bei 25 Eulen 547 von 755 px und die Äste drängen sich unten zusammen.
   * Der Zuschlag je Astreihe wird deshalb gedeckelt (AST_HOCH_PRO_REIHE), damit
   * die Baumkrone die Obergrenze behält und die Äste Platz finden.
   */
  var kronenHalb = rM * WWP_FORM_HW[form];
  var astFaktor = Math.max(0.62, Math.min(1, (kronenHalb * 0.62) / maxAstLenBase(groessteGruppe)));
  var owlAbstand = OWL_ABSTAND * astFaktor;
  var owlStart = OWL_START * astFaktor;
  var owlUeber = AST_UEBERSTAND * astFaktor;
  var maxAstLen = owlStart + (groessteGruppe - 1) * owlAbstand + owlUeber;
  /* Die Eulen selbst skalieren nur leicht mit — als Tipp-Fläche sollen sie
     nicht schrumpfen, aber auch nicht die Krone überwachsen. */
  var eulenBw = Math.round(64 * eulenSk), eulenBh = Math.round(52 * eulenSk);
  var eulenSohle = (eulenBh - 100 * Math.min(eulenBw / 124, eulenBh / 100)) / 2
                 + 99 * Math.min(eulenBw / 124, eulenBh / 100);
  /* P5.5 — Die Warteeule braucht oben Platz, den der Reihenabstand allein nicht
     garantiert.
     *
     * Sie sitzt auf einem eigenen duennen Zweig unmittelbar über der obersten
     * Astreihe. Beide Zweige sind geneigt, und zwar unterschiedlich stark: der
     * lange Ast mit 5 Eulen steigt an seiner Spitze um 0,14 mal Länge an, der
     * kurze Wartezweig um weit weniger. Dadurch landete die Warteeule dichter
     * an der obersten Reihe, als der Reihenabstand vorsah — bei 25 Eulen 63 px
     * statt 74 px, bei 67 px Eulenhöhe also 4 px Überlappung. Die Kapplung
     * eulenSk am engsten Reihenabstand griff hier nicht, denn sie kann die
     * Neigung des Zweigs nicht kennen.
     *
     * Statt zu raten, werden die Rückenpunkte beider Eulen auf ihren
     * tatsächlichen Zweigkurven berechnet und die Warteeule um die Differenz
     * so weit nach oben geschoben, dass zwischen den Rücken die volle
     * Eulenhöhe plus 5 % Luft bleibt. Der Kronenansatz wandert um denselben
     * Betrag mit, sonst verschwände sie im Laub. */
  function warteVersatz(){
    var letzte = astZahl - 1;
    if(letzte < 0) return 0;
    var yOben = -(hDeep + reiheSumme(letzte));
    var anzahl = plan[letzte];
    var lenOben = owlStart + (anzahl - 1) * owlAbstand + owlUeber;
    var obLinks = (letzte + 1) % 2 === 1;
    /* Die äusserste Eule der obersten Reihe — der Ast fällt zu ihr hin ab,
       deshalb steht sie am höchsten und begrenzt den Abstand. */
    var aussen = obLinks ? -1 : 1;
    var cyOben = wwpAstY(aussen * (owlStart + (anzahl - 1) * owlAbstand), 0, yOben,
                         aussen * lenOben, yOben - lenOben * 0.14, 1);
    var lenW = 56 + owlUeber;
    var cyW = wwpAstY(56 * astFaktor, 0, -hFirst, lenW, -hFirst - lenW * 0.14, 0.55);
    /* wwpAstY liefert die Zweigkante, also genau den Stand der Fusssohle.
       Höhere Lagen sind (negativ gesehen) weiter oben: der Abstand der
       Warteeule über der obersten Reihe ist darum cyOben minus cyW. */
    return Math.max(0, eulenBh * 1.02 - (cyOben - cyW));
  }
  var versatz = warteVersatz();
  var GM = 96, TOPM = 34;                            /* Wiese unter dem Fuß · Himmel über der Krone */
  var crownBotH = hFirst + versatz + LUECKE + rM * KRONE_UEBER_AST;
  var crownCyH = crownBotH + (WWP_FORM_BOT[form] || 0.9) * rM;
  var crownTopH = crownCyH + (WWP_FORM_TOP[form] || 1.0) * rM;
  var stammH = crownCyH - rM * 0.62;                 /* Stamm reicht bis in die Krone */
  var bw = rM * 0.20;
  var groundY = crownTopH + TOPM, H = groundY + GM;
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
  /* Baum in lokalen Koordinaten: der Stamm wächst aus (0,0) nach oben, die Krone
     darüber. Dieselbe Aufteilung wie im Wissensgarten. */
  s += '<g class="ehp-baum" transform="translate('+trunkX+','+groundY+')">';
  /* Stamm + Wurzeln als EINE Silhouette — die Wurzeln fliessen aus dem Fuss
     heraus statt als aufgesetzte Keile danebenzuliegen. */
  s += wwpStamm(stammH, bw, "url(#ehpTrunk)");
  /* Krone: identische Silhouette zu den Gartenbäumen, inkl. Schattenband und
     Lichtreflex. Zuerst gezeichnet, damit die Äste danach aus dem Laub treten. */
  s += wwpKrone(form, rM, -crownCyH);
  /* Äste: die gesammelten Eulen von unten nach oben, älteste unten, neueste oben.
     P5.5 — vorher stand hier eine Umkehrung (neueste zuerst). Die Rampe 3-4-5
     beginnt aber UNTEN, deshalb saß Stufe 1 oben und Stufe 12 unten: die Eulen
     standen spiegelverkehrt zur Astreihenfolge. state.owls ist bereits
     aufsteigend sortiert, also genügt die Schleife in dieser Reihenfolge. */
  var alle = [];
  for(k = 0; k < state.owls.length; k++) alle.push({ stufe: state.owls[k], mysterium: false });
  var astIdx = 0, zeiger = 0;                         /* astIdx zählt die Aeste, zeiger liest alle[] */
  /* Ast als verjüngte Silhouette mit Laub an der Spitze — wwpAst() ist derselbe
     Helfer wie im Wissensgarten. Die Astspitze steigt leicht an, damit der Zweig
     nach oben greift statt durchzuhängen; wwpAstY() liefert für dieselbe Kurve
     die Höhe, auf der die Eule sitzt. */
  function astPfad(ay, links, len, sk, farbe){
    var tip = ay - len * 0.14;
    /* Laub wächst mit der Astlänge: am langen Ast sollen es Blätter sein und
       nicht drei Pixel Farbe. */
    return wwpAst(0, ay, links ? -len : len, tip, sk, farbe, Math.max(0.9, len / 140));
  }
  /* Stufenzahl auf heller Plakette. Der Kreis ist nicht Dekoration: ohne ihn
     steht die Ziffer direkt auf dem braunen Zweig und ist dort nicht lesbar. */
  function euleZahl(x, cy, txt, mystery){
    var r = 10.5 * eulenSk;
    return '<circle class="ehp-label-bg' + (mystery ? " mystery" : "") + '" cx="'+x.toFixed(1)+'" cy="'+cy.toFixed(1)+'" r="'+r.toFixed(1)+'"/>'
         + '<text x="'+x.toFixed(1)+'" y="'+(cy + 4.5 * eulenSk).toFixed(1)+'" text-anchor="middle" class="ehp-label' + (mystery ? " mystery" : "") + '" style="font-size:'+(13 * eulenSk).toFixed(1)+'px">'+txt+'</text>';
  }
  /* Warteeule: dünner Zweig direkt unter der Krone, auf der rechten Seite */
  (function(){
    var y = -(hFirst + versatz), len = 56 + owlUeber;
    var o = owlForLevel(lvl.stufe + 1), x = 56 * astFaktor;
    var cy = wwpAstY(x, 0, y, len, y - len * 0.14, 0.55);
    s += wwpAst(0, y, len, y - len * 0.14, 0.55, "#B98A4E", 1.05);
    s += '<svg class="eh-owl eh-mystery" data-anim="'+o.anim+'" data-stufe="'+(lvl.stufe+1)+'" x="'+(x-eulenBw/2).toFixed(1)+'" y="'+(cy-eulenSohle).toFixed(1)+'" width="'+eulenBw+'" height="'+eulenBh+'" viewBox="-12 0 124 100" role="button" tabindex="0" aria-label="Noch unbekannte Eule (Stufe '+(lvl.stufe+1)+')">'
       + owlInner(o.hue) + '</svg>';
    s += euleZahl(x, cy + 17 * eulenSk, (lvl.stufe + 1), true);
  })();
  for(i = 0; i < plan.length; i++){
    var gruppe = alle.slice(zeiger, zeiger + plan[i]);
    zeiger += plan[i];
    astIdx++;
    var y = -(hDeep + reiheSumme(astIdx - 1));
    /* Seitenwechsel pro Ast: links, rechts, links, rechts … Der unterste Ast
       zeigt nach links, damit die Eulen nicht direkt über dem Fallbild der
       Wurzeln sitzen. */
    var links = astIdx % 2 === 1;
    var len = owlStart + (gruppe.length - 1) * owlAbstand + owlUeber;   /* Ast endet knapp hinter der letzten Eule */
    s += astPfad(y, links, len, 1);
    for(k = 0; k < gruppe.length; k++){
      var e = gruppe[k];
      var o = owlForLevel(e.stufe);
      var x = links ? -(owlStart + k * owlAbstand) : (owlStart + k * owlAbstand);
      var cy = wwpAstY(x, 0, y, links ? -len : len, y - len * 0.14, 1);
      var cls = "eh-owl" + (e.stufe === lvl.stufe ? " eh-idle" : "");
      s += '<svg class="'+cls+'" data-anim="'+o.anim+'" data-stufe="'+e.stufe+'" x="'+(x-eulenBw/2).toFixed(1)+'" y="'+(cy-eulenSohle).toFixed(1)+'" width="'+eulenBw+'" height="'+eulenBh+'" viewBox="-12 0 124 100" role="button" tabindex="0" aria-label="'+o.name+', Stufe '+e.stufe+'">'
         + owlInner(o.hue)
         + '</svg>';
      s += euleZahl(x, cy + 17 * eulenSk, e.stufe, false);
    }
  }
  s += '</g>';   /* /ehp-baum */
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
/* ---------- P4.1: Wissensgarten — 6 Kompetenz-Bäume (eigene Seite, wie der Eulenhain) ---------- */
var wwpViewEl = document.getElementById("wissensgartenView");
var wwpSceneEl = document.getElementById("wwpScene");
var wwpStatsEl = document.getElementById("wwpStats");
var wwHintEl = document.getElementById("wwHint");
var wwCaptionEl = document.getElementById("wwCaption");
var gartenBtnEl = document.getElementById("gartenBtn");
var gartenPctValEl = document.getElementById("gartenPctVal");
var gartenLetzterStatus = null;
var WWP_TIERE = ["🐿️","🦜","🐝","🦔","🦋","🐞"];
/*
 * P4.1 (Wissensgarten) — Farbe heißt Reife, wie bei einer Frucht am Baum.
 *
 * Bewusst eine durchgehende Rampe von hellgrün nach rot: je sicherer die
 * Kompetenz sitzt, desto reifer die Frucht. Vorher war die Reihenfolge
 * genau verkehrt herum (ungeübt grün, gemeistert gelb), und Rot war
 * doppelt belegt — es stand sowohl für "gemeistert" als auch für "fällig".
 *
 *   neu      #CFEA86  hellgrün   unreife Frucht, noch nie geübt
 *   bau      #F0C24B  gelb       im Wuchs, Stufe 1–2
 *   sicher   #EE8A3C  orange     sicher, Stufe 3–4
 *   meister  #D33A2C  rot        reif und geerntet, Stufe 5
 *
 * "due" hat bewusst KEINE eigene Farbe mehr: Rot gehört der Reife. Der
 * Wiederholungs-Hinweis ist ein pulsierender Hellgrün-Glow (wwpDueGlow),
 * der die reife Farbe unberührt lässt — die Frucht sieht aus wie die
 * Frucht, die sie ist, sie blinkt nur, bis sie gepflückt ist.
 *
 * P5.3 — "neu" war #A9CE8B und las sich in Screenshots wie eine Seifenblase:
 * blass, zusätzlich mit opacity .85 noch entschärft. Der Ton ist jetzt
 * #CFEA86. Gemessen am Kontrast gegen das Kronengrün #4C8C3F:
 *   alt #A9CE8B -> 2.32   |   neu #CFEA86 -> 3.07   (+32 %)
 * Bewusst KEIN satteres Gruen: #8CC63F oder #7FB733 saehen koerneriger aus,
 * liegen aber nur bei 2.00 bzw. 1.70 Kontrast zum Kranz und verschwimmen
 * dort wieder. Helliger + kräftiger ist hier der richtige Weg, nicht grüner.
 * Die Kontur #3F6B37 und die volle Deckkraft halten die Silhouette dann auch
 * auf dem Handy, wo der Apfel real nur ~10 px breit ist.
 */
var WWP_FRUCHT_FARBEN = { neu:"#CFEA86", bau:"#F0C24B", sicher:"#EE8A3C", meister:"#D33A2C" };
/*
 * P5.3 — Radius der unsichtbaren Trefferflaeche um jede Frucht, in
 * SVG-Einheiten der 1000er-Buehne. Auf dem Handy sind das rund
 * 0.358 px je Einheit, 22 also ~7.9 px Radius bzw. ~16 px Durchmesser.
 * Siehe die ausfuehrliche Begruendung bei wwpFrucht().
 */
var WWP_TREFFER_RADIUS = 22;
function openWissensgarten(){
  var y = window.scrollY;             /* vor dem Rendern, siehe openEulenhain */
  renderWissensgarten();
  if(wwpViewEl) wwpViewEl.style.display = "block";
  overlayScrollSperren(y);
}
function closeWissensgarten(){
  if(wwpViewEl) wwpViewEl.style.display = "none";
  if(!overlayOffen()) overlayScrollFreigeben();
}
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
/* Kronen-Unterkante je Form (× rM) — für den Abstand zwischen Krone und dem
 * ersten Ast. Das Gegenstück zu WWP_FORM_TOP: der Eulenhain setzt die Krone so
 * tief, dass zwischen Blattdach und oberstem Ast ein sichtbarer Himmel bleibt.
 * Werte = max(c[1] + c[2]) aus WWP_FORM_SET. */
var WWP_FORM_BOT   = { kugel:0.89, hoch:1.17, kegel:1.46, rund:1.00, busch:0.93, flach:0.97 };
var WWP_FORM_SET = {
  kugel: [[0,-0.10,0.80],[-0.42,0.12,0.62],[0.42,0.10,0.64],[0,0.34,0.55]],
  hoch:  [[0,-0.55,0.58],[0,0,0.72],[0,0.55,0.62]],
  kegel: [[0,-0.70,0.34],[0,-0.34,0.46],[0,0.02,0.58],[0,0.38,0.70],[0,0.68,0.78]],
  rund:  [[0,0,1.0],[-0.45,0.16,0.72],[0.45,0.13,0.74]],
  busch: [[0,0.05,0.88],[-0.50,0.14,0.66],[0.50,0.12,0.68],[-0.28,-0.30,0.50],[0.30,-0.28,0.52]],
  flach: [[0,0.05,0.92],[-0.55,0.10,0.60],[0.55,0.08,0.62]]
};
/*
 * P4.1 (Wissensgarten) — Jede Kompetenz ist ein Apfel am Baum, kein Punkt.
 * Einheitlich Äpfel: eine gemischte Obstkiste (Apfel und Birne) war auf
 * Abstand nicht als Obst erkennbar, sondern nur als bunte Kreise. Der
 * Aufbau bleibt eine reine Funktion: übergeben werden Position, Radius,
 * Farbe und Status; zurück kommt fertiges SVG-Markup.
 *
 * Bewusste Entscheidungen:
 * - Der Fruchtkörper bleibt ein Kreis. Er ist die anklickbare Fläche und
 *   muss auch als Symbol erkennbar bleiben — ein Path wäre bei 47 kleinen
 *   Kompetenzen schlechter lesbar.
 * - Die Farbe bleibt die Bedeutung (ungeübt/…/gemeistert/fällig). Das Obst
 *   macht die Seite freundlicher, ohne die Information zu verschluckern.
 * - Stiel und Blatt werden nur bei ausreichendem Radius gezeichnet: bei
 *   11 px wäre ein 3-px-Stiel nur Pixelrauschen.
 * - Die Frucht hängt am Stiel, der leicht seitlich versetzt ist — das gibt
 *   ihr die typisch hängende Silhouette statt einer Kugel auf einem Strich.
 */
function wwpFrucht(x, y, r, col, status, attrs, due){
  /*
   * P5.3 — `status` wird im Koerper nicht mehr ausgewertet. Vorher steuerte
   * er Deckkraft (.85) und Konturstaerke fuer "neu"; beides ist jetzt
   * einheitlich (siehe Anmerkung am Apfelkoerper). Der Parameter bleibt in
   * der Signatur, weil der Aufruber ihn weiterhin uebergibt und eine
   * Umstellung hier nichts aendern wuerde — er ist aber bewusst nicht mehr
   * entscheidend fuer die Darstellung.
   */
  var klein = r < 12;
  var hang = klein ? 0 : r * 0.22;             /* seitlicher Versatz des Stiels */
  var s = "";
  /*
   * P4.1 — "fällig" als weicher Lichtschein statt als Ring.
   *
   * Vorher war es ein Kreis mit sichtbarer Kontur, der per
   * transform:scale() pulsierte. Zwei Fehler kamen dadurch zusammen:
   * - Die Kontur blieb sichtbar — ein Ring, kein Licht.
   * - Für transform fehlte transform-box:fill-box. SVG skaliert dann um den
   *   Ursprung der Bühne (0,0) statt um die Frucht. Je höher der Apfel im
   *   Baum saß, desto weiter wanderte der Schein nach oben und passte
   *   nicht mehr zur Größe des Apfels.
   *
   * Jetzt: eine gefüllte Fläche mit radialem Verlauf und Weichzeichnung.
   * Sie wird NICHT skaliert — nur ihre Deckkraft pulsiert. Damit kann sie
   * sich gar nicht von der Frucht lösen, und der Schein wächst mit dem
   * Radius des Apfels statt eine feste Größe zu haben.
   */
  if(due){
    /*
     * Zwei Ebenen statt einem Kreis: ein weicher, grosser Halo plus ein
     * kompakter heller Kern direkt hinter dem Apfel. Ohne den Kern verschwindet
     * der Schein auf der dunklen Krone — der Verlauf allein ist dort zu fein.
     */
    s += '<circle class="wwp-due-glow" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1)
       + '" r="' + (r * 1.9).toFixed(1) + '" fill="url(#wwpGlow)" pointer-events="none"/>';
    s += '<circle class="wwp-due-kern" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1)
       + '" r="' + (r * 1.12).toFixed(1) + '" fill="url(#wwpGlowKern)" pointer-events="none"/>';
  }
  /* Stiel: leicht gebogen, damit der Baum nicht wie ein Nagelbrett wirkt */
  s += '<path d="M' + x.toFixed(1) + ' ' + (y - r + 0.6).toFixed(1)
     + ' q ' + hang.toFixed(1) + ' ' + (-r * 0.42).toFixed(1) + ' ' + (hang * 1.35).toFixed(1) + ' ' + (-r * 0.72).toFixed(1)
     + '" fill="none" stroke="#6B4224" stroke-width="' + (klein ? 1.4 : 2.2).toFixed(1) + '" stroke-linecap="round"/>';
/*
   * P5.3 — Deutlichere Silhouette und groessere Trefferflaeche.
   *
   * Deckkraft: "neu" stand auf .85 und wurde dadurch blass. Jetzt 1.0 fuer
   * alle Staende — die Unterscheidung traegt die Farbe, nicht die Transparenz.
   *
   * Kontur: bei 1.2 px (neu) bzw. 2 px verschwindet die Linie auf dem Handy
   * unter der Pixelflaeche, der Apfel zerlaeuft zu einem Farbfleck. Deshalb
   * einheitlich 1.8 px und die dunklere Kontur #35602E.
   *
   * Trefferflaeche: der sichtbare Radius ist auf dem Handy nur ~4.8 px
   * (Durchmesser 9.7 px) — fuer einen Kinderfinger unbrauchbar. Gemessen sind
   * 0.358 px je SVG-Einheit; ein 44-px-Ziel (Radius 22 px) braeuchte 61
   * Einheiten. Der kleinste Nachbarabstand IM Kranz liegt aber nur bei 7.3 px
   * bzw. 20 Einheiten: darueber ueberlappen sich die Trefferkreise und ein Tipp
   * wuerde den Nachbarapfel treffen statt den eigenen. Gewaehlt sind 22
   * Einheiten (~16 px Durchmesser), rund 1.6x des sichtbaren Apfels, ohne die
   * Nachbarn zu verschlucken. 44 px sind bei 47 Aepfeln in dieser Anordnung
   * physikalisch nicht erreichbar — das waere die 1.10-fache Szenenflaeche.
   * Eine echte Loesung waere ein anderes Handy-Layout (Paket C).
   * Groesser gewuenscht: WWP_TREFFER_RADIUS.
   */
  s += '<circle class="wwp-treffer" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1)
     + '" r="' + WWP_TREFFER_RADIUS + '" fill="transparent"/>';
  /* Körper */
  s += '<circle class="wwp-frucht"' + attrs + ' cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1)
     + '" r="' + r.toFixed(1) + '" fill="' + col + '" stroke="#35602E" stroke-width="1.8"'
     + ' opacity="1"/>';
  if(!klein){
    /* Blatt links oben am Stiel */
    s += '<ellipse cx="' + (x + hang * 0.72).toFixed(1) + '" cy="' + (y - r * 0.48).toFixed(1)
       + '" rx="' + (r * 0.42).toFixed(1) + '" ry="' + (r * 0.24).toFixed(1)
       + '" fill="#5FA653" transform="rotate(-24 ' + (x + hang * 0.72).toFixed(1) + ' ' + (y - r * 0.48).toFixed(1) + ')"/>';
    /* Glanzlicht: gibt der Frucht Volumen, sonst wirkt die Fläche flach */
    s += '<circle cx="' + (x - r * 0.32).toFixed(1) + '" cy="' + (y - r * 0.34).toFixed(1)
       + '" r="' + (r * 0.22).toFixed(1) + '" fill="#fff" opacity=".45"/>';
  }
  return s;
}
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
/* P4.1: Stamm + Wurzeln als EINE durchgehende Silhouette — der Stamm fließt
   unten direkt in zwei geschwungene Wurzeln aus (S-Bogen nach außen,
   abgestumpfte Spitzen, flacher Bogen unter dem Stammfuß). Keine aufgesetzten
   Keile, keine Streifen. Leichte Asymmetrie = organischer Look. */
function wwpStamm(stammH, bw, fill){
  var H = stammH, tw = Math.max(3.5, bw * 0.34);
  var gy = bw * 0.80;                            /* Bodenlinie unter dem Stamm */
  var fL = bw * 2.60, fR = bw * 2.46;            /* Wurzelreichweite (asymmetrisch) */
  var d = "M " + (-tw).toFixed(1) + " " + (-H).toFixed(0);
  /* linke Stammkante: schmaler Hals → sanfter Anlauf nach unten */
  d += " C " + (-(bw * 0.52)).toFixed(1) + " " + (-H * 0.66).toFixed(0)
     + " " + (-(bw * 0.84)).toFixed(1) + " " + (-H * 0.40).toFixed(0)
     + " " + (-(bw * 1.00)).toFixed(1) + " " + (-H * 0.18).toFixed(0);
  /* linke Wurzel: eleganter S-Bogen nach außen bis zur Spitze */
  d += " C " + (-(bw * 1.38)).toFixed(1) + " " + (-H * 0.02).toFixed(1)
     + " " + (-(fL * 0.76)).toFixed(1) + " " + (gy * 0.42).toFixed(1)
     + " " + (-fL).toFixed(1) + " " + (gy * 1.00).toFixed(1);
  /* abgestumpfte Spitze statt Nadelspitze */
  d += " Q " + (-(fL + 2.4)).toFixed(1) + " " + (gy * 1.13).toFixed(1)
     + " " + (-(fL - 3.2)).toFixed(1) + " " + (gy * 1.17).toFixed(1);
  /* Unterseite der linken Wurzel zurück zum Bogen unter dem Stamm */
  d += " C " + (-(bw * 1.90)).toFixed(1) + " " + (gy * 1.27).toFixed(1)
     + " " + (-(bw * 1.05)).toFixed(1) + " " + (gy * 1.05).toFixed(1)
     + " " + (-(bw * 0.52)).toFixed(1) + " " + (gy * 0.74).toFixed(1);
  /* flacher Bogen unter dem Stammfuß (Wurzelteilung) */
  d += " C " + (-(bw * 0.24)).toFixed(1) + " " + (gy * 0.58).toFixed(1)
     + " " + (bw * 0.22).toFixed(1) + " " + (gy * 0.56).toFixed(1)
     + " " + (bw * 0.50).toFixed(1) + " " + (gy * 0.72).toFixed(1);
  /* Unterseite der rechten Wurzel hinaus zur Spitze */
  d += " C " + (bw * 1.05).toFixed(1) + " " + (gy * 1.05).toFixed(1)
     + " " + (bw * 1.86).toFixed(1) + " " + (gy * 1.26).toFixed(1)
     + " " + (fR - 3.2).toFixed(1) + " " + (gy * 1.17).toFixed(1);
  d += " Q " + (fR + 2.4).toFixed(1) + " " + (gy * 1.13).toFixed(1)
     + " " + fR.toFixed(1) + " " + (gy * 1.00).toFixed(1);
  /* rechte Wurzel-Oberseite → Stammkante hinauf (Spiegelbild, leicht anders) */
  d += " C " + (fR * 0.76).toFixed(1) + " " + (gy * 0.42).toFixed(1)
     + " " + (bw * 1.38).toFixed(1) + " " + (-H * 0.02).toFixed(0)
     + " " + (bw * 1.00).toFixed(1) + " " + (-H * 0.18).toFixed(0);
  d += " C " + (bw * 0.84).toFixed(1) + " " + (-H * 0.40).toFixed(0)
     + " " + (bw * 0.52).toFixed(1) + " " + (-H * 0.66).toFixed(0)
     + " " + tw.toFixed(1) + " " + (-H).toFixed(0);
  d += " Z";
  return '<path d="' + d + '" fill="' + (fill || "url(#wwpTrunk)") + '" stroke="#6B4224" stroke-width="1.2" stroke-linejoin="round"/>';
}
/*
 * P5.4 — EIN Ast-Helfer für beide Ansichten (Eulenhain und Wissensgarten).
 *
 * Bewusst geteilt: der Eulenhain-Baum soll zu den sechs Bäumen im
 * Wissensgarten passen. Zwei kopierte Ast-Zeichner laufen beim nächsten
 * Gestaltungs-Schritt sofort auseinander — dann sieht der große Baum aus wie
 * eine andere Baumart als die sechs daneben.
 *
 * Drei Entscheidungen:
 * - Der Ast ist eine verjüngte Silhouette entlang einer quadratischen Kurve,
 *   keine Linie mit konstanter Dicke. Eine konstante Dicke wirkt wie Draht,
 *   besonders an der dünnen Spitze.
 * - Die Kurve senkt sich leicht und hebt sich dann zur Spitze: der Ast greift
 *   nach oben. Die Zweige hingen vorher durch wie Seile.
 * - An der Spitze sitzt ein Laubbüschel. Vorher endeten sie als nackte
 *   Spitzen, die wie abgeschnitten aussahen — gerade die dünnen Zweige der
 *   Warteeule wirkten dadurch wie ein kahl geschabter Ast.
 *
 * sk skaliert die Dicke (dünne Warteeulen-Zweige), farbe ist optional.
 * laubSk skaliert das Laub getrennt davon: am langen Eulenzweig sollen es
 * Blätter sein und am kurzen Seitenast des Wissensgartens bleibt es zart.
 */
/* Gemeinsame Ast-Geometrie — EINMAL berechnet, damit Zeichenfunktion und
   Höhenberechnung nie auseinanderlaufen können. Vorher rechnete astY() mit
   anderen Kontrollpunkten als astPfad() zeichnete; die Eulen landeten dadurch
   um bis zu 2 px neben dem Zweig. */
function wwpAstGeo(x0, y0, x1, y1, sk){
  sk = sk || 1;
  var ob = 7 * sk, sp = 2.4 * sk, un = 8 * sk;   /* oben am Stamm · Spitze · unten am Stamm */
  var cx = x0 + (x1 - x0) * 0.5;
  var cy = y0 + (y1 - y0) * 0.62 + 16 * sk;     /* Kontrollpunkt: leichtes Durchhängen */
  return {
    ob:ob, sp:sp, un:un, cx:cx, cy:cy,
    /* die drei Punkte der OBERkante — genau die, die wwpAst() zeichnet */
    ty0:y0 - ob, tyc:cy - ob * 0.5, ty1:y1 - sp
  };
}
function wwpAst(x0, y0, x1, y1, sk, farbe, laubSk){
  sk = sk || 1;
  laubSk = laubSk || sk;
  var g = wwpAstGeo(x0, y0, x1, y1, sk);
  var d = "M " + x0.toFixed(1) + " " + g.ty0.toFixed(1)
        + " Q " + g.cx.toFixed(1) + " " + g.tyc.toFixed(1)
        + " " + x1.toFixed(1) + " " + g.ty1.toFixed(1)
        + " L " + x1.toFixed(1) + " " + (y1 + g.sp).toFixed(1)
        + " Q " + g.cx.toFixed(1) + " " + (g.cy + g.un * 0.8).toFixed(1)
        + " " + x0.toFixed(1) + " " + (y0 + g.un).toFixed(1) + " Z";
  return '<path d="' + d + '" fill="' + (farbe || "#7A4E26") + '"/>' + wwpLaub(x1, y1, laubSk);
}
/* Höhe der Ast-Oberkante an der Stelle x. Dieselbe quadratische Kurve wie oben,
   daher sitzt die Eule exakt auf dem Zweig und nicht daneben. */
function wwpAstY(x, x0, y0, x1, y1, sk){
  var g = wwpAstGeo(x0, y0, x1, y1, sk);
  var a = x1 - 2 * g.cx + x0, b = 2 * (g.cx - x0), c = x0 - x, t;
  if(Math.abs(a) < 1e-6){ t = (b !== 0) ? -c / b : 0; }
  else {
    var w = b * b - 4 * a * c, rt = Math.sqrt(w > 0 ? w : 0);
    var t1 = (-b + rt) / (2 * a), t2 = (-b - rt) / (2 * a);
    t = (t1 >= 0 && t1 <= 1) ? t1 : t2;   /* jene Lösung, die auf dem Ast liegt */
  }
  t = t < 0 ? 0 : (t > 1 ? 1 : t);
  var u = 1 - t;
  return u * u * g.ty0 + 2 * u * t * g.tyc + t * t * g.ty1;
}
/* Laubbüschel an einer Astspitze: drei Blätter in den Tönen der Krone, fächerförmig
   um die Spitze. Bewusst keine geschlossene Kugel — die würde im Wissensgarten
   wieder nur ein Farbfleck neben den Äpfeln sein. */
function wwpLaub(x, y, sk){
  sk = sk || 1;
  var r = 7 * sk, s = "", i;
  var versatz = [-0.9, 0.1, 1.0], winkel = [-26, 6, 32], farben = ["#69A85A", "#4E8F42", "#5FA653"];
  for(i = 0; i < 3; i++){
    var cx = x + versatz[i] * r, cy = y - r * 0.4;
    s += '<ellipse cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '"'
       + ' rx="' + (r * 0.95).toFixed(1) + '" ry="' + (r * 0.5).toFixed(1) + '"'
       + ' fill="' + farben[i] + '" transform="rotate(' + winkel[i] + ' ' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ')"/>';
  }
  return s;
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
function showGartenBanner(baeume){
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
    closeWissensgarten();
    nextExercise();
  });
}
function wwpSchild(x, top, b, idx){
  var neig = (idx % 2 === 0) ? -1.5 : 1.5;
  /*
   * Statuszeile: bewusst OHNE "im Wuchs" und ohne Sprössling-Emoji.
   *
   * Gemessen bei 16px: "47% 9/14 im Wuchs" = 154.3px — das lief sichtbar
   * aus dem Brett. "47% 9/14" dagegen nur 73.7px. "im Wuchs" kostete also
   * 80px, obwohl die Zeile darüber (das Thema) und der Prozentsatz den
   * Zustand längst verraten. "0% · 🌱 unberührt" war mit 141.3px der
   * zweitte Brocken; "0% unberührt" sind es 107.9px.
   */
  var status = (b.status === "gold") ? "🏆 golden" : (b.status === "rot" ? b.dueCount + " fällig"
    : (b.status === "neu" ? "unberührt" : b.geuebt + "/" + b.total));
  var sub = b.pct + "% " + status;
  var s = "";
  /*
   * Drei Zeilen je Brett: Name / Thema / Status.
   *
   * Das Brett ist dafür 72 hoch (vorher 34) und 140 breit (vorher 158).
   * Der Grund für die Breite ist die Enge: bei Slotabstand 162 blieben
   * zwischen zwei Brettern nur 4px Luft — sie wirkten aneinandergereiht.
   * Mit 140 sind es 22px, das Brett steht sichtbar frei.
   *
   * Die Breite ist gemessen, nicht geraten. Auf dem Handy skaliert die
   * 1000er-Bühne auf 0.387, eine 12px-Zeile wird real 4.6px — unlesbar.
   * Deshalb 17/15/16px, und dafür müssen die Zeilen kurz bleiben:
   *   Name   "📏 Flächen-Baum"     137px (mit Icon, Worst Case)
   *   Thema  "Sachaufgaben"        104.9px
   *   Status "0% unberührt"       107.9px  (Worst Case, ohne Symbol)
   * 137px + 12px Rand = 149 → bei 140 wäre die Namenszeile 9px zu breit.
   * Das Brett ist deshalb bewusst 150 breit (hw=75) statt 140: das kostet
   * 12px Luft zwischen den Brettern, lässt aber alle drei Zeilen mit
   * Reserve stehen, statt Text abzuschneiden. 150 + 12 Luft bleibt immer
   * noch 5x mehr Abstand als die 4px von vorher.
   */
  var hw = 75, hh = 72;
  /* Bodenschatten: verankert das Schild auf der Wiese */
  s += '<ellipse cx="' + x + '" cy="' + (top + hh + 8) + '" rx="66" ry="5" fill="#7BAF6B" opacity=".5"/>';
  /* zwei Pfosten (liegen hinter dem Brett, reichen in die Wiese) */
  s += '<rect x="' + (x - 50) + '" y="' + (top + 10) + '" width="6" height="' + (hh + 8) + '" rx="2" fill="#7A4E26"/>';
  s += '<rect x="' + (x + 44) + '" y="' + (top + 10) + '" width="6" height="' + (hh + 8) + '" rx="2" fill="#7A4E26"/>';
  s += '<g transform="rotate(' + neig + ' ' + x + ' ' + (top + hh / 2) + ')">';
  s += '<rect x="' + (x - hw) + '" y="' + top + '" width="' + (hw * 2) + '" height="' + hh + '" rx="9" fill="#D2A56E" stroke="#8A5A2B" stroke-width="2.5"/>';
  /* Nieten oben und unten — bei der Hoehe sonst kein Bezugspunkt mehr */
  s += '<circle cx="' + (x - hw + 9) + '" cy="' + (top + 11) + '" r="2.2" fill="#8A5A2B"/>';
  s += '<circle cx="' + (x + hw - 9) + '" cy="' + (top + 11) + '" r="2.2" fill="#8A5A2B"/>';
  s += '<circle cx="' + (x - hw + 9) + '" cy="' + (top + hh - 11) + '" r="2.2" fill="#8A5A2B"/>';
  s += '<circle cx="' + (x + hw - 9) + '" cy="' + (top + hh - 11) + '" r="2.2" fill="#8A5A2B"/>';
  /*
   * Das Icon liegt MITTEN auf dem Brett, in der Zeile des Namens — nicht
   * links daneben: links ragte es beim ersten Baum 17px aus der Bühne
   * (x = -17.3), weil Slot 1 bei x=78 sitzt und 70px Halbbreite + Icon
   * die Szenenkante über schreiten.
   */
  s += '<text class="wwp-boardtext" x="' + x + '" y="' + (top + 21) + '" text-anchor="middle">' + b.icon + ' ' + escHtml(b.name) + '</text>';
  s += '<text class="wwp-boardthema" x="' + x + '" y="' + (top + 42) + '" text-anchor="middle">' + escHtml(b.thema) + '</text>';
  s += '<text class="wwp-boardsub" x="' + x + '" y="' + (top + 61) + '" text-anchor="middle">' + escHtml(sub) + '</text>';
  s += '</g>';
  return s;
}
function renderWissensgarten(){
  if(!wwpSceneEl) return;
  var nowSec = Math.floor(Date.now() / 1000);
  var garten = gartenStatus(state.spaced, nowSec);
  if(wwpStatsEl) wwpStatsEl.innerHTML = '<strong>' + garten.pct + '%</strong> gewachsen · <strong>' + garten.goldene + '/' + garten.total + '</strong> Bäume golden';
  if(wwHintEl) wwHintEl.innerHTML = garten.goldene === garten.total
    ? '🏆 Fantastisch! Dein ganzer Wissensgarten ist golden — deine Eulen wohnen im schönsten Hain!'
    : '🌳 Tippe eine Frucht an, um genau diese Kompetenz zu üben · pulsierende Früchte warten auf Wiederholung';
  /* Gold-Feier: nur beim Übergang (nicht beim ersten Öffnen) */
  var neueGold = [];
  garten.baeume.forEach(function(b, i){
    if(b.status === "gold" && gartenLetzterStatus && gartenLetzterStatus[i] !== "gold") neueGold.push(b);
  });
  gartenLetzterStatus = garten.baeume.map(function(b){ return b.status; });
  if(neueGold.length){ spawnConfetti(); showGartenBanner(neueGold); }
  /* --- Szene: Himmel, Sonne, Wolken, Wiese — 6 Bäume je auf eigenem Hügel --- */
  /*
   * Bühne 1000x566 (vorher 534).
   *
   * Das Brett braucht 72px Höhe und liegt bei wwSignTop = groundY + 10, dazu
   * kommen Pfostenfüße und Bodenschatten. Mit groundY = H - 66 ging bei 534
   * der Platz unten aus: das Brett samt Füßen lief aus der Bühne.
   * Rechnung: 10 (Abstand zum Boden) + 72 (Brett) + 16 (Füße+Schatten) = 98
   *            → groundY = H - 98, also H = 534 + 32 = 566.
   * Das Seitenverhältnis wird damit 1,74 statt 1,87 — auf dem Handy etwas
   * weniger breit, dafür stehen die Bretter vollständig im Bild.
   */
  var W = 1000, H = 566, groundY = H - 98;
  var s = "", i, j;
  s += '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" style="display:block;">';
  s += '<defs>'
    + '<linearGradient id="wwpSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#BFE3F7"/><stop offset="1" stop-color="#EFF8EE"/></linearGradient>'
    + '<linearGradient id="wwpTrunk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7A4E26"/><stop offset=".55" stop-color="#93613A"/><stop offset="1" stop-color="#6E4423"/></linearGradient>'
    /* P4.1 — Radialer Verlauf fuer den "faellig"-Schein.
       Die Mitte liegt UNTER dem Apfel und ist nie sichtbar, deshalb liegt
       das Hellste am Apfelrand. Fast Weiss in der Mitte des Hofes, weil
       nur ein sehr heller Ton sich vom Kronengruen (#4C8C3F) sichtbar
       abhebt — ein Gruenton wie #7ED957 verschwand dort vollstaendig. */
    + '<radialGradient id="wwpGlow">'
    + '<stop offset="0" stop-color="#F4FFE0" stop-opacity="1"/>'
    + '<stop offset=".38" stop-color="#EAFFC4" stop-opacity="1"/>'
    + '<stop offset=".58" stop-color="#C8F58E" stop-opacity=".95"/>'
    + '<stop offset=".8" stop-color="#9BE86A" stop-opacity=".55"/>'
    + '<stop offset="1" stop-color="#7ED957" stop-opacity="0"/>'
    + '</radialGradient>'
    /* Kompakter Kern: heller Saum direkt am Apfelrand, damit der Schein
       sich vom dunklen Kronengruen abhebt, ohne die Reife-Farbe zu
       ueberstrahlen. Auch hier liegt die Mitte unter dem Apfel. */
    + '<radialGradient id="wwpGlowKern">'
    + '<stop offset="0" stop-color="#C8F58C" stop-opacity=".25"/>'
    + '<stop offset=".55" stop-color="#DCFFA8" stop-opacity=".45"/>'
    + '<stop offset=".85" stop-color="#FFFFFF" stop-opacity=".95"/>'
    + '<stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>'
    + '</radialGradient>'
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
  garten.baeume.forEach(function(b, idx){
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
    /* Stamm + zwei Wurzeln als EINE durchgehende Silhouette */
    s += wwpStamm(stammH, bw);
    /* Seitenäste: bleiben unterhalb der Krone sichtbar → echter Baum statt Lutscher.
       Derselbe Helfer wie im Eulenhain, damit beide Bäume gleich aussehen. */
    var bh = stammH * 0.46, bl = stammH * 0.20;
    s += wwpAst(-8, -bh, -34, -(bh + bl), 0.8);
    s += wwpAst(8, -(bh + stammH * 0.10), 32, -(bh + stammH * 0.10 + bl), 0.8, "#8A5A2B");
    /* Krone: solide Silhouette (kein Transparenz-Schaum) */
    s += wwpKrone(form, rM, cy);
    posis.forEach(function(p, ti){
      var t = b.tuffs[ti];
      /*
       * "due" ist eine eigene Anzeige, keine eigene Farbe mehr: der Status
       * wird zuerst auf seine Reife-Stufe zurückgeführt, damit eine fällige
       * Frucht weiterhin so aussieht wie ihr Wissensstand (hellgrün bis rot)
       * und der Glow nur zusätzlich darauf zeigt.
       */
      var reife = (t.status === "due") ? (t.level >= 5 ? "meister" : (t.level >= 3 ? "sicher" : "bau")) : t.status;
      var col = WWP_FRUCHT_FARBEN[reife] || WWP_FRUCHT_FARBEN.neu;
      var cls = "wwp-frucht" + (t.status === "meister" ? " wwp-gold" : "");
      /* P4.1 — Nur noch Äpfel: alle 47 Kompetenzen sind Äpfel. */
      var attrs = ' class="' + cls + '" data-key="' + t.key + '" role="button" tabindex="0"'
        + ' aria-label="' + escHtml(t.name) + '"';
      s += wwpFrucht(p[0], cy + p[1], tR, col, "apfel", attrs, t.due);
      if(t.status === "meister"){
        s += '<text class="wwp-sparkle" x="' + (p[0]).toFixed(1) + '" y="' + (cy + p[1] + 4).toFixed(1) + '" text-anchor="middle" font-size="11">✨</text>';
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
  /*
   * P5.3 — Der Klick haengt an der Trefferflaeche, nicht am Apfel selbst.
   *
   * Der sichtbare Apfel misst auf dem Handy nur ~9.7 px. Die groessere,
   * unsichtbare `.wwp-treffer`-Flaeche liegt direkt davor und traegt die
   * Bedienung; sie holt sich den Schluessel von ihrem Nachbarn, dem Apfel.
   * Tastatur und Screenreader bleiben am Apfel (role/tabindex/aria-label),
   * sonst waeren je Baum bis zu 14 zusaetzliche Tabstopps im Weg.
   */
  Array.prototype.forEach.call(wwpSceneEl.querySelectorAll(".wwp-treffer"), function(el){
    var apfel = el.nextElementSibling;
    if(!apfel || !apfel.classList.contains("wwp-frucht")) return;
    var key = apfel.getAttribute("data-key");
    el.addEventListener("click", function(){ wwZeigeTuff(key); });
  });
  Array.prototype.forEach.call(wwpSceneEl.querySelectorAll(".wwp-frucht"), function(el){
    el.addEventListener("click", function(){ wwZeigeTuff(el.getAttribute("data-key")); });
    el.addEventListener("keydown", function(ev){
      if(ev.key === "Enter" || ev.key === " "){ ev.preventDefault(); wwZeigeTuff(el.getAttribute("data-key")); }
    });
  });
}
if(gartenBtnEl) gartenBtnEl.addEventListener("click", openWissensgarten);
var gartenBackEl = document.getElementById("gartenBack");
if(gartenBackEl) gartenBackEl.addEventListener("click", closeWissensgarten);
document.addEventListener("keydown", function(ev){
  if(ev.key === "Escape" && wwpViewEl && wwpViewEl.style.display !== "none") closeWissensgarten();
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

/* ==================================================================
 * PWA (5.2) — Installation, Offline-Hinweis, Update-Toast
 * ==================================================================
 *
 * Drei Aufgaben, ein Block:
 *   1. Service Worker registrieren (mit Versions-Query, sonst erkennt
 *      der Browser ein neues Deploy nicht)
 *   2. anzeigen, wenn ein Update bereitliegt
 *   3. anzeigen, wenn offline gearbeitet wird
 *
 * Zu 3 wichtig: es wird NICHT behauptet, alles sei gespeichert. Der
 * Fortschritt liegt offline nur in localStorage; die DB-Synchronisation
 * ist ausdruecklich noch nicht gebaut (5.2 Punkt 3). Wer offline
 * trainiert, sieht das hier und weiss Bescheid.
 */

function appVersion() {
  var meta = document.querySelector('meta[name="app-version"]');
  var m = meta && /v(\d+)/.exec(meta.getAttribute("content") || "");
  return m ? m[1] : "dev";
}

function chipSetzen(id, sichtbar, text) {
  var el = document.getElementById(id);
  if (!el) return;
  if (text) {
    /*
     * WICHTIG: den Text in die innere Span schreiben, nicht in den Chip.
     *
     * Ein "el.textContent = text" loescht alle Kindelemente — und damit
     * genau die Span, in die pendingAnzeigen() spaeter schreibt. Die Folge
     * war still und fies: der Offline-Text zuerst gesetzt, danach findet
     * die Warteschlangen-Anzeige ihre Span nicht mehr und zeigt NIE eine
     * Anzahl. Der Nutzer haette nie erfahren, dass Aenderungen warten.
     * Auf der Live-Seite (v151) reproduziert und behoben.
     */
    var span = document.getElementById(id + "Text");
    if (span) span.textContent = text;
    else el.textContent = text;
  }
  el.hidden = !sichtbar;
}

function offlineZeigen() {
  chipSetzen("offlineChip", true, "Offline — wird lokal gespeichert");
}
function onlineZeigen() {
  chipSetzen("offlineChip", false);
}

/* --- Update-Toast ---------------------------------------------------
 * Ein neuer Worker wartet im Hintergrund. Ohne Hinweis bliebe der
 * Nutzer auf dem alten, gecachten Stand — bei einer Lern-App heisst das,
 * er trainiert Aufgaben, die es nicht mehr gibt. Der Toast loest den
 * Wechsel aber NICHT selbst aus: waehrend einer Aufgabe mitten im
 * Rechnen soll nichts neu geladen werden. */
function updateToastZeigen(reg) {
  var toast = document.getElementById("updateToast");
  if (!toast) return;
  var btn = document.getElementById("updateToastBtn");
  if (!btn) return;
  toast.hidden = false;
  btn.onclick = function () {
    if (reg && reg.waiting) {
      reg.waiting.postMessage("SKIP_WAITING");
    } else if (reg) {
      /* Neu laden und hoffen, dass der neue Worker sich meldet. */
      reg.update();
    }
    location.reload();
  };
}

function swRegistrieren() {
  if (!("serviceWorker" in navigator)) return;   /* alter Browser: alles gut */
  /* Ueber file:// gibt es keinen Service Worker. Das betrifft nur das
   * lokale Doppelklicken, nicht die Auslieferung. */
  if (location.protocol === "file:") return;
  var version = appVersion();
  try {
    navigator.serviceWorker.register("sw.js?v=" + version, { scope: "./" }).then(function (reg) {
      /* Ein Worker wartet bereits: Update anbieten. */
      if (reg.waiting && navigator.serviceWorker.controller) {
        updateToastZeigen(reg);
      }
      /* Beim Start pruefen, ob seit dem letzten Besuch etwas Neues kam. */
      reg.addEventListener("updatefound", function () {
        var neu = reg.installing;
        if (!neu) return;
        neu.addEventListener("statechange", function () {
          if (neu.state === "installed" && navigator.serviceWorker.controller) {
            updateToastZeigen(reg);
          }
        });
      });
      /* Sicherheitshalber taeglich nach einem Update schauen. Sonst
       * bemerkt ein Nutzer, der die App nur einmal pro Woche oeffnet,
       * ein neues Deploy unter Umstaenden erst nach Wochen. */
      setInterval(function () { reg.update(); }, 60 * 60 * 1000);
    }).catch(function (f) {
      console.warn("Service Worker nicht registriert:", f && f.message);
    });
  } catch (error) {
    console.warn("Service Worker:", error && error.message);
  }
}

function offlineUeberwachen() {
  offlineZeigen();
  if (navigator.onLine) onlineZeigen();
  window.addEventListener("online", function () {
    onlineZeigen();
    /* Netz ist da: liegt etwas an, wird es JETZT gesendet. Ohne diesen
     * Aufruf bliebe die Warteschlange bis zum naechsten Aufgaben-Check
     * liegen — oder bis zum naechsten Seitenaufruf, wo der Nutzer es
     * nicht erwartet. */
    if (pendingLesen()) queueFlushen();
    else pendingAnzeigen();
  });
  window.addEventListener("offline", function () { offlineZeigen(); });
  /* Beim Start: abgelaufene Schlangen aussortieren und melden. Der
   * Hinweis ist einmalig — sonst stuende die Meldung bei jedem Aufruf der
   * Seite da, und nach einem Tag ist sie nicht mehr gelesen. */
  if (pendingAufraeumen()) return;
  pendingAnzeigen();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function () { swRegistrieren(); offlineUeberwachen(); });
} else {
  swRegistrieren();
  offlineUeberwachen();
}

/* ---------- Auth UI ---------- */
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

// ---------- Offline-Write-Queue (5.2 Punkt 3) ----------
//
// BISHER: syncProgressToAPI() rief nach jeder Aufgabe die DB. Bei
// Netzfehler wurde der Fehler IGNORIERT — "Fortschritt bleibt lokal
// gespeichert". Das war ein Versprechen ohne Nachreichen: der Fortschritt
// stand dann nur in diesem Geraet und war nach einem Kontowechsel weg.
//
// Warum das leicht loesbar ist und kein Merge noetig ist:
// Der Sync ist ein VOLLER SNAPSHOT des Zustands, kein Delta, und der
// Server ueberschreibt blind. Damit gibt es nichts zusammenzufuehren —
// es gibt nur die Frage "ist der Server aktuell?". Solange das nicht
// sicher beantwortet ist, senden wir den Snapshot spaeter erneut. Das ist
// idempotent: zweimal denselben Snapshot zu schicken aendert nichts.
//
// Der gefaehrliche Moment ist der LOGIN. loadProgressFromAPI() hat den
// Server als Wahrheit behandelt und den lokalen Stand ueberschrieben —
// damit waere offline Gearbeitetes beim Anmelden still verloren
// gegangen. Deshalb gilt: liegt eine wartende Aenderung vor, ist der
// lokale Stand nachweislich neuer als der Server. Dann wird erst
// hochgeladen und nur danach geladen.

var PENDING_KEY = "formenwerkstatt_pending_v1";

function pendingLesen() {
  try {
    var raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    var d = JSON.parse(raw);
    return (d && typeof d === "object" && d.anzahl > 0) ? d : null;
  } catch (e) { return null; }
}

function pendingSchreiben(d) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(d)); } catch (e) { /* Privatmodus */ }
  pendingAnzeigen();
}

function pendingLoeschen() {
  try { localStorage.removeItem(PENDING_KEY); } catch (e) { /* Privatmodus */ }
  pendingAnzeigen();
}

/* Die Warteschlange gehoert einem Konto. Ohne diese Kennung wuerde
 * Abmelden und Anmelden eines anderen Kontos den fremden Fortschritt auf
 * dieses Konto hochladen — Punkte eines Kindes waeren dann woanders. */
function nutzerKennung() {
  try {
    var u = getUser();
    if (!u) return null;
    return String(u.id || u.nickname || "");
  } catch (e) { return null; }
}

function pendingMarkieren() {
  var p = pendingLesen() || { anzahl: 0, zeit: 0, nutzer: null };
  p.anzahl += 1;
  p.zeit = Date.now();
  p.nutzer = nutzerKennung();
  pendingSchreiben(p);
}

/* Sichtbar machen, dass etwas wartet. Sonst traeut der Nutzer dem
 * "gespeichert"-Text, den die App auch offline zeigt. */
function pendingAnzeigen() {
  var chip = document.getElementById("offlineChip");
  var text = document.getElementById("offlineChipText");
  if (!chip || !text) return;
  /* Eine sichtbare Verwerfungs-Meldung darf nicht von einem der folgenden
   * Aufrufe wieder ueberschrieben werden. */
  if (_pendingHinweisSichtbar) return;
  var p = pendingLesen();
  if (!p) {
    /*
     * Nichts wartet. Der Chip darf trotzdem nicht verschwinden, wenn wir
     * offline sind — sonst verliert man die Auskunft "du bist offline"
     * genau dann, wenn man sie braucht.
     *
     * Das war ein echter Fehler: pendingAnzeigen() lief beim Start immer
     * und hat den Offline-Hinweis sofort wieder ausgeblendet. Gefangen
     * vom PWA-Test, der den Chip nach dem Offline-Neuladen gesucht hat.
     */
    if (navigator.onLine) chip.hidden = true;
    return;
  }
  var n = p.anzahl;
  text.textContent = (n === 1 ? "1 Änderung wartet" : n + " Änderungen warten")
    + " — wird gesendet, sobald das Netz da ist";
  chip.hidden = false;
}

/* Nach jedem Fehlschlag laenger warten, statt im Sekundentakt zu
 * versuchen. Drei Stufen, dann alle 5 Minuten. */
var _queueVersuche = 0;
var _queueTimer = null;
function queueSpueren() {
  if (_queueTimer) clearTimeout(_queueTimer);
  var stufen = [5000, 20000, 60000, 300000];
  var wartezeit = stufen[Math.min(_queueVersuche, stufen.length - 1)];
  _queueVersuche += 1;
  _queueTimer = setTimeout(queueFlushen, wartezeit);
}

/*
 * Fremdhinweis: die Warteschlange gehoert zu einem anderen Konto. Wir
 * senden nicht — und sagen es laut. Die Punkte bleiben fuer das Konto
 * erhalten, dem sie gehoeren, statt auf ein fremdes zu wandern.
 */
function pendingAnzeigenFremd() {
  var chip = document.getElementById("offlineChip");
  var text = document.getElementById("offlineChipText");
  if (!chip || !text) return;
  text.textContent = "Es warten noch Änderungen von einem anderen Konto — melde dich dort an, um sie zu speichern.";
  chip.hidden = false;
}

/*
 * ABLAUF nach 30 Tagen (5.2 Punkt 3).
 *
 * Eine Warteschlange, die monatelang nicht gesendet werden kann, ist kein
 * Rettungsnetz mehr, sondern ein Zustand: typischerweise ist das Konto
 * geloescht oder das Token ungueltig. Sie blockiert dann dauerhaft den
 * Chip und sendet alle fuenf Minuten ins Leere.
 *
 * Nach 30 Tagen wird sie deshalb verworfen — aber NICHT still. Der Nutzer
 * bekommt eine einmalige, wegklickbare Meldung. Punkte verschwinden
 * leise, das ist genau die Sorte Datenverlust, die niemand mitkriegt.
 */
var PENDING_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
var PENDING_HINWEIS_KEY = "formenwerkstatt_pending_hinweis_v1";
/* Solange das true ist, darf der Chip nicht von allein verschwinden. */
var _pendingHinweisSichtbar = false;

/* >= und nicht >: "nach 30 Tagen verworfen" heisst, dass der 30. Tag schon
 * zur Ablaufzeit gehoert. Mit > waere die Grenze von der Reihenfolge zweier
 * Datumsauswertungen abhaengig — mal faellig, mal nicht, ohne erkennbaren
 * Grund. Genau solche Zufaelle sind in der Warteschlangenlogik teuer. */
function pendingVerfallen(p) {
  return !!(p && p.zeit && (Date.now() - p.zeit) >= PENDING_MAX_AGE);
}

/* Einmalig melden, nicht bei jedem Seitenaufruf. */
function hinweisGesehen() {
  try { return localStorage.getItem(PENDING_HINWEIS_KEY) === "1"; } catch (e) { return false; }
}

function pendingVerwerfen() {
  try { localStorage.removeItem(PENDING_KEY); localStorage.setItem(PENDING_HINWEIS_KEY, "1"); }
  catch (e) { /* Privatmodus */ }
  _pendingHinweisSichtbar = true;
  var chip = document.getElementById("offlineChip");
  var text = document.getElementById("offlineChipText");
  if (!chip || !text) return;
  text.textContent = "Änderungen von vor über 30 Tagen konnten nicht gespeichert werden. "
    + "Bitte einmal anmelden — hier klicken zum Schließen.";
  chip.hidden = false;
  chip.style.cursor = "pointer";
  chip.title = "Zum Schließen klicken";
  chip.onclick = function () {
    _pendingHinweisSichtbar = false;
    chip.hidden = true;
    chip.style.cursor = "";
    chip.onclick = null;
  };
}

/* Beim Start und vor jedem Senden: abgelaufene Schlangen aussortieren. */
function pendingAufraeumen() {
  var p = pendingLesen();
  if (!pendingVerfallen(p)) return false;
  pendingVerwerfen();
  return true;
}

/*
 * Reihenfolge: GENAU EINE Anfrage gleichzeitig. Zwei parallele Posts
 * koennten in falscher Reihenfolge ankommen und damit Punkte
 * zurueckdrehen (Serverstand 100 Punkte, dann 90 Punkte). Das waere ein
 * stiller Fortschrittsverlust.
 */
var _queueLaeuft = false;
function queueFlushen(fertig) {
  var cb = typeof fertig === "function" ? fertig : function () {};
  if (_queueLaeuft) { cb(false); return; }
  if (!navigator.onLine) { cb(false); return; }
  var token = getToken();
  if (!token) { cb(false); return; }

  /* Abgelaufen? Dann wird nichts mehr gesendet — sonst sendet die App
   * bis zum Ende aller Tage alle fuenf Minuten einen Zustand, den niemand
   * mehr will. */
  if (pendingAufraeumen()) { cb(false); return; }

  var p = pendingLesen();
  if (!p) { cb(true); return; }

  var jetzt = nutzerKennung();
  /* Fremdes Konto: nicht senden. Ein Kind, das sich abmeldet und ein
     anderes anmeldet, darf keine Punkte uebertragen. */
  if (p.nutzer && jetzt && p.nutzer !== jetzt) {
    console.warn('[mathemit] Warteschlange gehoert zu einem anderen Konto — nicht gesendet.');
    pendingAnzeigenFremd();
    cb(false);
    return;
  }

  _queueLaeuft = true;
  syncProgressToAPI().then(function (ok) {
    _queueLaeuft = false;
    _queueVersuche = 0;
    if (ok) { pendingLoeschen(); cb(true); return; }
    queueSpueren();
    cb(false);
  });
}
function loadProgressFromAPI(customToken) {
  var token = customToken || getToken();
  if (!token) return;

  /*
   * SICHERHEITSREGEL gegen stillen Datenverlust.
   *
   * Bisher hat der Server als Wahrheit gegolten und den lokalen Stand
   * ueberschrieben. Das ist bei einem Gast-Stand richtig (neues Geraet,
   * Anmeldung, Server kennt mehr). Bei OFFLINE Gearbeitetem ist es genau
   * verkehrt: lokal liegt nachweislich etwas, das der Server noch nicht
   * hat. Ein Ueberschreiben wuerde die Punkte beim Anmelden wegsortieren.
   *
   * Deshalb: liegt eine Warteschlange vor, wird sie ZUERST gesendet und
   * der Serverstand erst danach geladen.
   */
  var p = pendingLesen();
  if (p && p.nutzer !== null && nutzerKennung() !== p.nutzer) {
    /* Fremdes Konto: gar nicht erst laden. Sonst wuerde der Serverstand
     * des neuen Kontos den lokalen Stand ueberschreiben und der Nutzer
     * glaubt, seine Punkte seien weg. */
    pendingAnzeigenFremd();
    return;
  }
  if (p) {
    queueFlushen(function (ok) {
      if (ok) { fortschrittLaden(token); return; }
      /* Konnte nicht gesendet werden: wir laden trotzdem NICHT, sonst
       * waere die Offline-Arbeit jetzt wirklich verloren. */
      pendingAnzeigen();
    });
    return;
  }
  fortschrittLaden(token);
}

function fortschrittLaden(token) {
  apiFetch('/progress.php').then(function(data) {
    if (data.status === 'ok' && data.data) {
      var d = data.data;
      /* Server ist Source-of-Truth und überschreibt den lokalen Stand */
      state.points  = d.points      || 0;
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
      /* 5.2 Punkt 3 — repeatQ und diff werden erst seit der Warteschlangen-
       * Arbeit tatsaechlich gespeichert. Vorher hat der Server sie verworfen,
       * das Wiederholungstraining war nach einem Geraetewechsel weg, obwohl
       * die Oberflaeche "geräteübergreifend synchronisiert" versprach. */
      if (d.repeatQ !== undefined && d.repeatQ !== null) {
        state.repeatQ = sanitizeRepeatQ(d.repeatQ);
      }
      if (d.diff === 1 || d.diff === 2 || d.diff === 3) state.diff = d.diff;
      console.log('[mathemit] Fortschritt vom Server geladen:', JSON.stringify({p:state.points,s:state.streak,bs:state.bestStreak}));
      updateStatsUI();
      /* Chip ans Menue angleichen: repeatQ kommt vom Server, das Menue wird
         in updateStatsUI() neu gerendert — ohne diesen Aufruf stuende der
         Chip noch auf dem alten Stand, bis die naechste Aufgabe kommt. */
      if(typeof updateRepeatChip === "function") updateRepeatChip();
      updateModeAmpel();
      syncProgressToAPI();
    }
  }, function(err) {
    console.warn('[mathemit] Fortschritt konnte nicht vom Server geladen werden:', err);
  });
}

function syncProgressToAPI() {
  var token = getToken();
  if (!token) return Promise.resolve(false);
  /* Ohne Netz gar nicht erst versuchen: das erzeugt nur Fehlermeldungen
   * im Log und laesst die Uebertragung unnoetig lang dauern. */
  if (navigator.onLine === false) { pendingMarkieren(); return Promise.resolve(false); }

  return apiFetch('/progress.php', {
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
    var ok = !!(data && data.status === 'ok');
    /* 401/403 heisst: Token ungueltig. Da ist Warten sinnlos — der Login
     * muss neu stattfinden, sonst wartet die Schlange vergeblich. */
    var code = data && data._httpStatus;
    if (!ok && (code === 401 || code === 403)) {
      console.warn('[mathemit] Token abgelehnt — die Warteschlange bleibt erhalten, bis du dich neu anmeldest.');
    }
    return ok;
  }).catch(function(err) {
    console.warn('[mathemit] Sync fehlgeschlagen, kommt in die Warteschlange:', err);
    return false;
  });
}

/*
 * Nach jeder gelösten Aufgabe synchronisieren. Bei Fehlschlag wandert der
 * Stand in die Warteschlange statt verloren zu gehen.
 */
var _origHandleCheck = handleCheck;
handleCheck = function() {
  _origHandleCheck.apply(this, arguments);
  syncProgressToAPI().then(function(ok) {
    if (ok) { pendingLoeschen(); return; }
    pendingMarkieren();
    queueSpueren();
  });
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
