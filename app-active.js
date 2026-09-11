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
  answered: false,
  badges: []
};
var missByGen = {}, hitByGen = {}; // P2.2: Fehler-/Treffer-Serien je Übungstyp (Session)

var LEVELS = [
  {name:"Geometrie-Lehrling", min:0},
  {name:"Formen-Geselle", min:100},
  {name:"Vierecks-Profi", min:250},
  {name:"Dreiecks-Meister", min:450},
  {name:"Geometrie-Meister/in", min:700}
];
function currentLevel(){
  var lvl = LEVELS[0];
  for(var i=0;i<LEVELS.length;i++){ if(state.points>=LEVELS[i].min) lvl=LEVELS[i]; }
  return lvl;
}
function nextLevel(){
  var cur = currentLevel();
  var idx = LEVELS.indexOf(cur);
  return LEVELS[idx+1] || null;
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
      mode:state.mode, grade:state.grade, diff:state.diff
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
  }catch(e){ /* beschädigter oder fehlender Speicher wird ignoriert, App startet mit Standardwerten */ }
}
function resetProgress(){
  state.points=0; state.streak=0; state.bestStreak=0; state.solved=0; state.correct=0; state.badges=[];
  try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}
  updateStatsUI();
}

loadProgress();

/* ============ Rendering ============ */
var chipsHost = document.getElementById("chips");
MODES.forEach(function(m){
  var btn = document.createElement("button");
  btn.className = "chip" + (m.id===state.mode?" active":"");
  btn.textContent = m.label;
  btn.dataset.mode = m.id;
  btn.addEventListener("click", function(){
    state.mode = m.id;
    Array.prototype.forEach.call(chipsHost.children, function(c){ c.classList.remove("active"); });
    btn.classList.add("active");
    saveProgress();
    nextExercise();
  });
  chipsHost.appendChild(btn);
});

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
  var lvl = currentLevel();
  document.getElementById("levelVal").textContent = lvl.name.split(" ")[0];
  document.getElementById("levelNameSmall").textContent = lvl.name;
  var nxt = nextLevel();
  var fill = document.getElementById("levelFill");
  var nextEl = document.getElementById("levelNext");
  if(nxt){
    var span = nxt.min - lvl.min;
    var progressed = state.points - lvl.min;
    var pct = Math.max(0, Math.min(100, (progressed/span)*100));
    fill.style.width = pct+"%";
    nextEl.textContent = (nxt.min-state.points)+" Punkte bis „"+nxt.name+"“";
  } else {
    fill.style.width = "100%";
    nextEl.textContent = "Höchster Rang erreicht! 👑";
  }
  document.getElementById("sessionStat").textContent = state.solved+" Aufgaben gelöst · "+state.correct+" richtig";
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
  var key = choice(pool);
  state.currentKey = key;
  var ex = GEN[key](state.diff);
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

  var fb = document.getElementById("feedback");
  fb.className="feedback"; fb.innerHTML="";
  document.getElementById("checkBtn").style.display = ex.inputType==="number" ? "inline-block":"none";
  document.getElementById("checkBtn").disabled=false;
  document.getElementById("nextBtn").style.display="none";
}

function finishRound(isCorrect, explanation){
  state.answered = true;
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
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    var bonus = Math.min(10, state.streak) ;
    state.points += 10 + bonus;
  } else {
    state.streak = 0;
  }
  checkBadges();
  updateStatsUI();
  saveProgress();

  var fb = document.getElementById("feedback");
  fb.className = "feedback show " + (isCorrect?"ok":"bad");
  var msg = isCorrect ? choice(ENCOURAGE_OK) : choice(ENCOURAGE_BAD);
  /* P2.2: Dynamische Anpassungs-Vorschläge (einmalig je Schwelle) */
  var sug = "";
  if(mk){
    if(!isCorrect && missByGen[mk]===2 && state.diff>1){
      sug = '<div style="margin-top:6px; font-size:.8rem; font-weight:600;">💡 Tipp: Wechsle auf 🌱 Einstieg – genau daran üben wir gerade.</div>';
    } else if(isCorrect && hitByGen[mk]===3 && state.diff<3){
      sug = '<div style="margin-top:6px; font-size:.8rem; font-weight:600;">🚀 Stark! Probiere die Stufe 🚀 Anforderung.</div>';
    }
  }
  /* P3.2: Gezielter Korrektur-Hinweis bei falscher Antwort */
  var extra = "";
  if(!isCorrect && state.current){
    var korr = TIPP1_BY_TOPIC[state.current.topic];
    if(korr) extra = '<div style="margin-top:6px; font-size:.8rem; font-weight:600;">🧭 Merke: '+korr+'</div>';
  }
  fb.innerHTML = msg + '<span class="explain">'+explanation+'</span>'+sug+extra;
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
      best_streak: state.best_streak,
      solved:      state.solved,
      correct:     state.correct,
      badges:      state.badges,
      mode:        state.mode,
      grade:       state.grade
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

updateStatsUI();
nextExercise();
})();
