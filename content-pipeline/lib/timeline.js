#!/usr/bin/env node
"use strict";

/*
 * P7.4 — Deterministische Zeitachse für die 9:16-Bühne.
 * Reine Mathematik ohne Browser: dieselbe Eingabe ergibt immer denselben Frame-Zustand.
 *
 * P7.4.1 macht aus der festen Segmentfolge eine Auswahl an Hook-Vorlagen.
 * Reihenfolge und Grundgerüst bleiben erhalten — Frage, Reveal, Denkpause,
 * Auflösung, Endcard. Was sich ändert, ist Text, Dauer und Zusatz-Element
 * der Denkpause. Die Standardvorlage ist exakt der bisherige Ablauf, damit
 * bestehende Läufe und Clips bytegleich bleiben.
 */

const STAGE_WIDTH = 1080;
const STAGE_HEIGHT = 1920;
const DEFAULT_FPS = 30;
const SOLUTION_FADE_SECONDS = 0.4;
const ENDCARD_FADE_SECONDS = 0.5;
const BRAND_NAME = "Mathemit";
const BRAND_URL = "https://mathemit.andybrandy.at/";
const BRAND_CLAIM = "Jeden Tag eine echte Aufgabe mit Musterlösung.";

/*
 * P7.4.1 — Hook-Vorlagen.
 *
 * Jede Vorlage ist eine Benennung desselben Ablaufs. Die Segmentreihenfolge
 * ist bewusst überall gleich: "pause" gefolgt von "solution" ist der
 * Retention-Kern und wird in verify-clip.js geprüft. Variiert wird nur, was
 * den ersten Eindruck prägt — Überschrift, Dauer, Denkpausen-Element.
 *
 * countdown braucht eine längere Denkpause, weil der Timer sichtbar abläuft;
 * die Vorhaltzeit darf 15–25 s nicht verlassen. Gesamtlaengen:
 *   frage 3 s -> 3+4+3+4+3 = 17 s (Countdown, Pause 3 s)
 *   ueblich 3 s -> 3+4+2+4+3 = 16 s (alle uebrigen)
 */

/* Segmente der Standardvorlage — zugleich die Quelle aller Varianten. */
function baseSegments() {
  return [
    { id: "hook", label: "Frage", seconds: 3 },
    { id: "reveal", label: "Blueprint-Reveal", seconds: 4 },
    { id: "pause", label: "Denkpause", seconds: 2 },
    { id: "solution", label: "Aufloesung", seconds: 4 },
    { id: "endcard", label: "Endcard", seconds: 3 }
  ];
}

const HOOKS = {
  /*
   * Standardablauf aus 7.3.5 — ohne Zusatz, damit der bestehende Lauf
   * bytegleich bleibt. Referenz fuer alle anderen Vorlagen.
   */
  frage: {
    id: "frage",
    label: "Frage",
    eyebrow: "Aufgabe",
    hookLine: null,
    pauseSeconds: 2,
    pauseMode: "hint",
    pauseText: "2 Sekunden zum Nachdenken",
    segments: baseSegments()
  },
  /*
   * Countdown: sichtbarer Timer ueber der Denkpause. Der Timer laeuft nur
   * waehrend des Segments "pause" und wird in frameState() berechnet, damit er
   * exakt zum Reveal gehoert und nicht aus dem Frame abgeleitet wird.
   *
   * Die Zahl in Hook und Text ist dieselbe wie die Laenge des Countdowns.
   * Das ist Absicht: ein Hook, der "10 Sekunden" verspricht, waehrend sichtbar
   * 3 heruntergezaehlt wird, ist der meistgelesene Fehler in solchen Clips.
   * Deshalb 5 s Pause (3+4+5+4+3 = 19 s) statt 10 s — 10 s stille Pause
   * waeren zwar im Zeitfenster, aber ein echter Retention-Killer.
   */
  countdown: {
    id: "countdown",
    label: "Countdown",
    eyebrow: "5 Sekunden Challenge",
    hookLine: "Kannst du das in 5 Sekunden lösen?",
    pauseSeconds: 5,
    pauseMode: "countdown",
    pauseText: null,
    segments: baseSegments().map(function (segment) {
      return segment.id === "pause" ? Object.assign({}, segment, { seconds: 5 }) : segment;
    })
  },
  /*
   * Erwachsenen-Challenge: spricht die Erwachsenen an, die sich ueberschaetzt
   * haben. Der Doppeleffekt ist beabsichtigt, sichtbar wird er nur ueber den
   * Hook-Text — die Buehne bleibt dieselbe.
   */
  erwachsenen: {
    id: "erwachsenen",
    label: "Erwachsenen-Challenge",
    eyebrow: "Mittelschul-Niveau",
    hookLine: "Können Erwachsene das?",
    pauseSeconds: 2,
    pauseMode: "hint",
    pauseText: "2 Sekunden zum Nachdenken",
    segments: baseSegments()
  },
  /*
   * Streak-Flex: der Einstieg ist ein Konkurrenzmoment, nicht eine Frage.
   *
   * streakDays ist ein SYNTHETISCHER Beispielwert (7.4.3: keine echten
   * Nutzerdaten, keine Konten). Er wird sichtbar als Leiste von Tagen
   * angezeigt, damit der Flex-Charakter im Bild da ist und nicht nur im
   * Text behauptet wird.
   *
   * Frueher stand hier im Kommentar "wird aus der Aufgabenschwierigkeit
   * abgeleitet" — das war falsch, es gab ueberhaupt kein Zahlenfeld und
   * damit auch keine Anzeige. Jetzt ist es eine feste, dokumentierte
   * Vorlagenzahl; eine echte App-Ableitung gehoert nicht in die Pipeline,
   * weil sie hier ohne Nutzerdaten gar nicht stattfinden kann.
   */
  streak: {
    id: "streak",
    label: "Streak-Flex",
    eyebrow: "Streak",
    hookLine: "Schaffst du 7 Tage in Folge?",
    streakDays: 7,
    pauseSeconds: 2,
    pauseMode: "hint",
    pauseText: "2 Sekunden zum Nachdenken",
    segments: baseSegments()
  },
  /*
   * Vorher/Nachher: die Aufgaebe wird zweimal gezeigt — erst die uebliche
   * Loesung, dann der Blueprint-Weg. Das ist die einzige Vorlage mit einem
   * zusaetzlichen Segment, "nachher" liegt zwischen Reveal und Denkpause.
   */
  "vorher-nachher": {
    id: "vorher-nachher",
    label: "Vorher/Nachher",
    eyebrow: "Zwei Wege",
    hookLine: "So macht es die App",
    pauseSeconds: 2,
    pauseMode: "hint",
    pauseText: "2 Sekunden zum Nachdenken",
    /* P7.4.3 — Die zwei Ueberschriften des Vergleichs. "vorher" ist der
     * Schulweg (Worte, Tabelle, fertige Loesungsformel), "nachher" der
     * Blueprint-Weg der App. Ohne diese Beschriftung sahen beide Seiten
     * gleich aus — der Vergleich war dann keiner. */
    vorherLabel: "So erklärt's die Schule",
    nachherLabel: "So macht's die App",
    segments: [
      { id: "hook", label: "Frage", seconds: 3 },
      { id: "vorher", label: "Schulweg", seconds: 2 },
      { id: "reveal", label: "Blueprint-Reveal", seconds: 4 },
      { id: "pause", label: "Denkpause", seconds: 2 },
      { id: "solution", label: "Aufloesung", seconds: 4 },
      { id: "endcard", label: "Endcard", seconds: 3 }
    ]
  }
};

const DEFAULT_HOOK = "frage";
const HOOK_IDS = Object.keys(HOOKS);

/* Bekannte Vorlage holen; ein unbekannter Name ist ein Fehler, kein Fallback. */
function hookById(id) {
  const key = id === undefined || id === null || id === "" ? DEFAULT_HOOK : id;
  if (!Object.prototype.hasOwnProperty.call(HOOKS, key)) {
    fail("Unbekannte Hook-Vorlage \"" + key + "\". Erlaubt sind: " + HOOK_IDS.join(", ") + ".");
  }
  return HOOKS[key];
}

function fail(message) {
  const error = new Error(message);
  error.code = "P7_TIMELINE";
  throw error;
}

function clamp01(value) {
  if (!(value > 0)) return 0;
  return value > 1 ? 1 : value;
}

/* Feste Rundung: Frames müssen über Läufe und Plattformen gleich bleiben. */
function round6(value) {
  return Math.round(value * 1e6) / 1e6;
}

function easeOutCubic(value) {
  const t = clamp01(value);
  return round6(1 - Math.pow(1 - t, 3));
}

/*
 * P7.4.1 — buildTimeline(fps, hookId) baut die Zeitachse einer Vorlage.
 * Die Signatur bleibt abwaertskompatibel: buildTimeline(30) liefert exakt
 * die bisherige Standardachse.
 */
function buildTimeline(fps, hookId) {
  const step = fps === undefined ? DEFAULT_FPS : fps;
  if (!Number.isInteger(step) || step < 1 || step > 60) {
    fail("Bildrate muss eine ganze Zahl zwischen 1 und 60 fps sein.");
  }
  const hook = hookById(hookId);

  let cursorFrame = 0;
  let cursorMs = 0;
  const segments = hook.segments.map(function (segment) {
    const frames = Math.round(segment.seconds * step);
    const durationMs = Math.round(segment.seconds * 1000);
    const entry = {
      id: segment.id,
      label: segment.label,
      seconds: segment.seconds,
      frameCount: frames,
      fromFrame: cursorFrame,
      toFrame: cursorFrame + frames - 1,
      fromTimeMs: cursorMs,
      toTimeMs: cursorMs + durationMs
    };
    cursorFrame += frames;
    cursorMs += durationMs;
    return entry;
  });

  return {
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    fps: step,
    hook: hook.id,
    hookLabel: hook.label,
    eyebrow: hook.eyebrow,
    hookLine: hook.hookLine,
    pauseMode: hook.pauseMode,
    pauseText: hook.pauseText,
    pauseSeconds: hook.pauseSeconds,
    countdownSeconds: hook.pauseMode === "countdown" ? Math.round(hook.pauseSeconds) : 0,
    /* P7.4.3 — Nur die Vorher/Nachher-Vorlage hat diese beiden Felder.
     * Fehlen sie (alle uebrigen Vorlagen), rendert die Buehne den
     * Schulweg nicht. Der Standardlauf bleibt damit unberuehrt. */
    vorherLabel: hook.vorherLabel || null,
    nachherLabel: hook.nachherLabel || null,
    streakDays: hook.streakDays || 0,
    segments: segments,
    solutionFadeSeconds: SOLUTION_FADE_SECONDS,
    endcardFadeSeconds: ENDCARD_FADE_SECONDS,
    brandName: BRAND_NAME,
    brandUrl: BRAND_URL,
    brandClaim: BRAND_CLAIM,
    totalSeconds: segments[segments.length - 1].toTimeMs / 1000,
    totalMs: segments[segments.length - 1].toTimeMs,
    totalFrames: cursorFrame
  };
}

function segmentAt(timeline, frame) {
  return timeline.segments.find(function (segment) {
    return frame >= segment.fromFrame && frame <= segment.toFrame;
  }) || null;
}

/* Lookup nach Segment-ID, damit Aufrufer nicht versehentlich einen Frame suchen. */
function segmentById(timeline, id) {
  if (!timeline || !Array.isArray(timeline.segments)) fail("Zeitachse hat kein unterstütztes Format.");
  const segment = timeline.segments.find(function (entry) { return entry.id === id; });
  if (!segment) {
    fail("Unbekanntes Segment \"" + id + "\". Erlaubt sind: " +
      timeline.segments.map(function (entry) { return entry.id; }).join(", ") + ".");
  }
  return segment;
}

function frameState(timeline, frame) {
  if (!timeline || !Array.isArray(timeline.segments)) fail("Zeitachse hat kein unterstütztes Format.");
  if (!Number.isInteger(frame) || frame < 0 || frame >= timeline.totalFrames) {
    fail("Frame " + frame + " liegt außerhalb der Zeitachse (0–" + (timeline.totalFrames - 1) + ").");
  }
  const segment = segmentAt(timeline, frame);
  if (!segment) fail("Frame " + frame + " gehört zu keinem Segment.");
  const timeMs = Math.round(frame * 1000 / timeline.fps);
  const segmentTimeMs = timeMs - segment.fromTimeMs;

  const revealSpan = segment.toTimeMs + 1 - segment.fromTimeMs;
  /*
   * P7.4.3 — "vorher" (Schulweg) zeichnet die Figur bewusst NICHT.
   *
   * Vorher stand fuer jedes unbekannte Segment eine 1, also war die
   * Zeichnung im Schulweg bereits fertig: der Betrachter sah die fertige
   * Loesung 2 Sekunden VOR der Denkpause und der eigentliche Reveal
   * danach war nur noch Wiederholung. Genau das war im gerenderten Clip
   * zu sehen — vorher, Denkpause und Aufloesung waren pixelgleich.
   */
  const nochNichtGezeichnet = segment.id === "hook" || segment.id === "vorher";
  const revealProgress = nochNichtGezeichnet ? 0 : (segment.id === "reveal" ? easeOutCubic((segmentTimeMs + 1) / revealSpan) : 1);

  const fadeFrames = Math.max(1, Math.round(SOLUTION_FADE_SECONDS * timeline.fps));
  const solutionIndex = timeline.segments.findIndex(function (entry) { return entry.id === "solution"; });
  const solutionStart = timeline.segments[solutionIndex].fromFrame;
  const solutionProgress = frame < solutionStart ? 0 : easeOutCubic((frame - solutionStart + 1) / fadeFrames);

  /* Die Endcard kommt nach der Auflösung und blendet weich ein. */
  const endcardSegment = timeline.segments.find(function (entry) { return entry.id === "endcard"; });
  const endcardFadeFrames = Math.max(1, Math.round(ENDCARD_FADE_SECONDS * timeline.fps));
  const endcardProgress = !endcardSegment || frame < endcardSegment.fromFrame
    ? 0
    : easeOutCubic((frame - endcardSegment.fromFrame + 1) / endcardFadeFrames);

  /*
   * P7.4.2 — Countdown.
   *
   * Der Timer wird aus der Frame-Position innerhalb der Denkpause berechnet,
   * nicht aus der Uhr. Damit ist er exakt reproduzierbar und kann nicht
   * gegenueber dem Reveal driften.
   *
   * Gezeigt wird immer eine ganze Zahl, aufwaerts gerundet: bei 2,8 s Rest
   * steht dort "3", nicht "2,8". Ein Countdown darf nicht bei 0 enden, sonst
   * wirkt die Aufloesung abrupt — der letzte Wert ist 1 und loest rechtzeitig
   * aus. Genau 0 wird nie gezeigt.
   */
  const pauseSegment = timeline.segments.find(function (entry) { return entry.id === "pause"; });
  let countdownVisible = false;
  let countdownValue = 0;
  let countdownProgress = 0;

  if (timeline.pauseMode === "countdown" && pauseSegment) {
    if (frame >= pauseSegment.fromFrame && frame <= pauseSegment.toFrame) {
      const elapsed = (frame - pauseSegment.fromFrame + 1) / timeline.fps;
      const remaining = timeline.pauseSeconds - elapsed;
      countdownValue = Math.max(1, Math.ceil(remaining - 0.0001));
      countdownVisible = countdownValue > 0;
      /* Fortschritt 0 -> 1 ueber die ganze Pause, fuer den Balken. */
      const span = pauseSegment.frameCount;
      countdownProgress = round6(clamp01((frame - pauseSegment.fromFrame + 1) / span));
    }
  }

  return {
    frame: frame,
    timeMs: timeMs,
    segment: segment.id,
    segmentLabel: segment.label,
    segmentFrame: frame - segment.fromFrame,
    segmentTimeMs: segmentTimeMs,
    revealProgress: round6(revealProgress),
    solutionProgress: solutionProgress,
    solutionVisible: solutionProgress > 0,
    pauseActive: segment.id === "pause",
    /* P7.4.3 — Nur im Segment "vorher" sichtbar. Die Buehne schaltet
     * damit die Schulweg-Karte ein und die Blueprint-Figur aus. */
    vorherVisible: segment.id === "vorher",
    /*
     * Sichtbar, sobald gezeichnet wird — fuer die "Nachher"-Beschriftung.
     *
     * WICHTIG: an das Vorhandensein von nachherLabel gekoppelt. Ohne diese
     * Bedingung war nachherVisible auch im Standardlauf wahr, wodurch ab dem
     * ersten Reveal-Frame eine leere goldene Karte im Bild stand. Das fiel
     * nur im Pixelvergleich auf, nicht in den Zustandstests: 253 von 480
     * Frames des Standardlaufs hatten sich unbemerkt geaendert.
     */
    nachherVisible: Boolean(timeline.nachherLabel) && segment.id !== "hook"
      && segment.id !== "vorher" && segment.id !== "pause",
    /* P7.4.2 — Countdown-Element der Denkpause. */
    countdownVisible: countdownVisible,
    countdownValue: countdownValue,
    countdownProgress: countdownProgress,
    endcardProgress: endcardProgress,
    endcardVisible: endcardProgress > 0
  };
}

function allFrameStates(timeline) {
  const states = [];
  for (let frame = 0; frame < timeline.totalFrames; frame += 1) {
    states.push(frameState(timeline, frame));
  }
  return states;
}

module.exports = {
  STAGE_WIDTH: STAGE_WIDTH,
  STAGE_HEIGHT: STAGE_HEIGHT,
  DEFAULT_FPS: DEFAULT_FPS,
  /* P7.4.1 — SEGMENTS bleibt als Standardachse erhalten, damit bestehende
     Aufrufer (render-frames.js --segment, verify-clip.js) unveraendert laufen. */
  SEGMENTS: HOOKS[DEFAULT_HOOK].segments,
  HOOKS: HOOKS,
  HOOK_IDS: HOOK_IDS,
  DEFAULT_HOOK: DEFAULT_HOOK,
  hookById: hookById,
  ENDCARD_FADE_SECONDS: ENDCARD_FADE_SECONDS,
  BRAND_NAME: BRAND_NAME,
  BRAND_URL: BRAND_URL,
  BRAND_CLAIM: BRAND_CLAIM,
  fail: fail,
  easeOutCubic: easeOutCubic,
  buildTimeline: buildTimeline,
  segmentAt: segmentAt,
  segmentById: segmentById,
  frameState: frameState,
  allFrameStates: allFrameStates
};
