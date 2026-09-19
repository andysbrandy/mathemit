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
  repeatQ: [], repeatIdx: 0, repeatIdxCurrent: 0, currentIsRepeat: false, repeatOnly: false, taskCount: 0, currentWasDue: false, wrongRow: 0,
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
var WOCHENZIELE = MB.WOCHENZIELE;
var wochenSchluessel = MB.wochenSchluessel;
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
    return { week:cur, points:0, solved:0, repeats:0, done:[], bonusGiven:false };
  }
  var validIds = WOCHENZIELE.map(function(z){ return z.id; });
  return {
    week: cur,
    points: Math.max(0, Math.min(99999, Number(d.points) || 0)),
    solved: Math.max(0, Math.min(99999, Number(d.solved) || 0)),
    repeats: Math.max(0, Math.min(99999, Number(d.repeats) || 0)),
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
function pruefeWochenziele(){
  ensureWochen();
  var neu = [];
  WOCHENZIELE.forEach(function(z){
    if((state.weekly[z.id] || 0) >= z.ziel && state.weekly.done.indexOf(z.id) === -1){
      state.weekly.done.push(z.id);
      neu.push(z);
    }
  });
  var alle = WOCHENZIELE.every(function(z){ return (state.weekly[z.id] || 0) >= z.ziel; });
  var bonus = false;
  if(alle && !state.weekly.bonusGiven){
    state.weekly.bonusGiven = true;
    state.points += 30; /* Wochen-Bonus → treibt Stufen & Eulen zusätzlich an */
    bonus = true;
  }
  return { neue: neu, bonus: bonus };
}
function renderWochenziele(){
  var host = document.getElementById("wochenziele");
  if(!host) return;
  ensureWochen();
  var html = WOCHENZIELE.map(function(z){
    var wert = state.weekly[z.id] || 0;
    var fertig = wert >= z.ziel;
    var pct = Math.max(0, Math.min(100, (wert / z.ziel) * 100));
    return '<div class="wz-goal'+(fertig ? ' fertig' : '')+'">'
      + '<div class="wz-head"><span>'+z.icon+' '+z.label+'</span><span>'+(fertig ? '✅' : Math.min(wert, z.ziel)+'/'+z.ziel)+'</span></div>'
      + '<div class="wz-track"><div class="wz-fill" style="width:'+pct+'%"></div></div>'
      + '</div>';
  }).join("");
  var alle = WOCHENZIELE.every(function(z){ return (state.weekly[z.id] || 0) >= z.ziel; });
  html += '<div class="wz-bonus'+(state.weekly.bonusGiven ? ' fertig' : '')+'">'
    + (state.weekly.bonusGiven ? '🎁 Wochen-Bonus kassiert: +30 Punkte!' : '🎁 Belohnung: alle 3 Ziele = +30 Bonus-Punkte')
    + '</div>';
  host.innerHTML = html;
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

/* ============ Fortschritt speichern (Phase 2) ============ */
var STORAGE_KEY = "formenwerkstatt_progress_v1";
function saveProgress(){
  try{
    var data = {
      points:state.points, streak:state.streak, bestStreak:state.bestStreak,
      solved:state.solved, correct:state.correct, badges:state.badges,
      mode:state.mode, grade:state.grade, diff:state.diff,
      repeatQ:state.repeatQ, owls:state.owls, weekly:state.weekly
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
    state.owls = sanitizeOwls(d.owls);
    ensureOwls();
    state.weekly = sanitizeWochen(d.weekly);
  }catch(e){ /* beschädigter oder fehlender Speicher wird ignoriert, App startet mit Standardwerten */ }
}
function resetProgress(){
  state.points=0; state.streak=0; state.bestStreak=0; state.solved=0; state.correct=0; state.badges=[]; state.owls=[1]; state.repeatQ=[]; state.repeatIdx=0; state.repeatOnly=false; state.taskCount=0; state.wrongRow=0; state.weekly = sanitizeWochen(null);
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
  btn.textContent = m.label;
  btn.dataset.mode = m.id;
  btn.addEventListener("click", function(){
    state.mode = m.id;
    Array.prototype.forEach.call(chipsHost.querySelectorAll(".chip"), function(c){ if(c.id !== "repeatChip"){ c.classList.remove("active"); } });
    btn.classList.add("active");
    saveProgress();
    scrollActiveChip();
    nextExercise();
  });
  chipsHost.appendChild(btn);
});

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
  if(state.repeatOnly && state.repeatQ.length > 0){
    state.currentIsRepeat = true;
    state.repeatIdxCurrent = state.repeatIdx % state.repeatQ.length;
    ex = buildRepeatExercise(state.repeatQ[state.repeatIdxCurrent]);
    key = ex.key;
    state.repeatIdx = state.repeatIdx + 1;
  } else {
    if(state.repeatOnly){ state.repeatOnly = false; repeatChip.classList.remove('active'); }
    key = choice(pool);
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
  if(isCorrect){
    state.correct += 1;
    state.streak += 1;
    owlCelebrate();
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    var bonus = Math.min(10, state.streak) ;
    state.points += 10 + bonus;
  } else {
    state.streak = 0;
  }
  /* P4.2: Wöchentliche Ziele tracken (vor der Stufen-Prüfung, damit der Bonus mitzählt) */
  ensureWochen();
  state.weekly.solved += 1;
  if(isCorrect) state.weekly.points += 10 + Math.min(10, state.streak);
  if(state.currentIsRepeat && isCorrect) state.weekly.repeats += 1;
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
  saveProgress();

  var fb = document.getElementById("feedback");
  fb.className = "feedback show " + (isCorrect?"ok":"bad");
  var msg = isCorrect ? choice(ENCOURAGE_OK) : choice(ENCOURAGE_BAD);
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
  b.addEventListener("click", openEulenhainModal);
  div.appendChild(b);
  fb.appendChild(div);
}
var eulenhainModalEl = document.getElementById("eulenhainModal");
var eulenhainBodyEl = document.getElementById("eulenhainBody");
function openEulenhainModal(){
  renderEulenhain();
  if(eulenhainModalEl) eulenhainModalEl.style.display = "flex";
}
function closeEulenhainModal(){ if(eulenhainModalEl) eulenhainModalEl.style.display = "none"; }
function renderEulenhain(){
  if(!eulenhainBodyEl) return;
  var lvl = currentLevel();
  var rows = [], i;
  for(i=0;i<state.owls.length;i+=5){ rows.push(state.owls.slice(i,i+5)); }
  var html = '<p class="eh-intro">Jede Stufe schaltet eine neue Eule frei – dein Baum wächst mit! Tippe eine Eule an, um ihre kleine Show zu sehen.</p>';
  html += '<div class="eh-stats">Stufe <strong>'+lvl.stufe+'</strong> · '+escHtml(rangTitel(lvl.stufe))+' · <strong>'+state.owls.length+'</strong> Eule(n) gesammelt</div>';
  html += '<div class="eh-scene"><div class="eh-canopy" aria-hidden="true"></div><div class="eh-crown" aria-hidden="true"></div>';
  rows.forEach(function(row){
    html += '<div class="eh-branch"><div class="eh-row">';
    row.forEach(function(st){
      var o = owlForLevel(st);
      html += '<div class="eh-owl'+(st===lvl.stufe?' eh-idle':'')+'" data-anim="'+o.anim+'" data-stufe="'+st+'" role="button" tabindex="0" aria-label="'+escHtml(o.name)+', Stufe '+st+'">'
            + owlSVG({hue:o.hue, size:52, label:o.name})
            + '<span class="eh-name">'+st+'</span></div>';
    });
    html += '</div></div>';
  });
  var nxt = owlForLevel(lvl.stufe+1);
  var fehl = Math.max(0, punkteFuerStufe(lvl.stufe+1) - state.points);
  html += '<div class="eh-branch eh-next"><div class="eh-row">'
        + '<div class="eh-owl eh-mystery"><div class="eh-silhouette">'+owlSVG({hue:nxt.hue, size:52, label:"Neue Eule"})+'</div><span class="eh-name">'+(lvl.stufe+1)+'</span></div>'
        + '</div></div>';
  html += '</div>';
  html += '<div class="eh-caption" id="ehCaption">💡 Tippe eine Eule an!</div>';
  html += '<div class="eh-hint">🔭 Noch <strong>'+fehl+'</strong> Punkte bis zur nächsten Eule: <strong>'+escHtml(nxt.name)+'</strong> (Stufe '+(lvl.stufe+1)+')</div>';
  eulenhainBodyEl.innerHTML = html;
  Array.prototype.forEach.call(eulenhainBodyEl.querySelectorAll(".eh-owl[data-stufe]"), function(el){
    function play(){
      var o = owlForLevel(Number(el.dataset.stufe));
      el.classList.remove("eh-play");
      void el.offsetWidth; /* laufende Animation neu starten */
      el.classList.add("eh-play");
      var cap = document.getElementById("ehCaption");
      if(cap) cap.textContent = "🦉 "+o.name+" · Stufe "+o.stufe+" — mag es zu „"+ANIM_NAMES[o.anim]+"“";
      setTimeout(function(){ el.classList.remove("eh-play"); }, 2600);
    }
    el.addEventListener("click", play);
    el.addEventListener("keydown", function(e){ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); play(); } });
  });
}
var eulenhainBtnEl = document.getElementById("eulenhainBtn");
if(eulenhainBtnEl) eulenhainBtnEl.addEventListener("click", openEulenhainModal);
var eulenhainCloseEl = document.getElementById("eulenhainClose");
if(eulenhainCloseEl) eulenhainCloseEl.addEventListener("click", closeEulenhainModal);
if(eulenhainModalEl){
  eulenhainModalEl.addEventListener("click", function(e){
    if(e.target === eulenhainModalEl) closeEulenhainModal();
  });
}
document.addEventListener("keydown", function(e){
  if(e.key === "Escape") closeEulenhainModal();
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
      ensureOwls();
      state.weekly = sanitizeWochen(d.goals);
      state.mode    = (d.mode && MODES.some(function(m){return m.id===d.mode;})) ? d.mode : (state.mode || 'alles');
      state.grade   = (d.grade && GRADES.some(function(g){return g.id===d.grade;})) ? d.grade : (state.grade || 'all');
      console.log('[mathemit] Fortschritt vom Server geladen:', JSON.stringify({p:state.points,s:state.streak,bs:state.bestStreak}));
      updateStatsUI();
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
nextExercise();
})();
