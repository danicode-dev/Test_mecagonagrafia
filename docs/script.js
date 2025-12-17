"use strict";

/**
 * Typing test app (static, no dependencies).
 * - Modes: timed (ends on timeout) and race (ends on completion)
 * - Persists leaderboard + history to localStorage
 */

const TEXT_POOLS = {
  L1: [
    "Practicar un poco cada día mejora la mecanografía.",
    "Escribe con calma y mantén el ritmo sin mirar el teclado.",
    "Respira, relaja los hombros y deja que los dedos fluyan.",
    "La precisión importa más que la velocidad al principio.",
    "Un buen hábito es corregir errores y seguir adelante.",
    "Repite frases cortas hasta ganar confianza y control.",
    "Teclas suaves, manos quietas y mirada en la pantalla.",
    "Constancia y paciencia: el progreso llega con el tiempo.",
  ],
  L2: [
    "En DAW aprendemos a construir aplicaciones web con HTML, CSS y JavaScript, cuidando la accesibilidad y el rendimiento.",
    "Una buena API REST define rutas claras, valida los datos de entrada y devuelve códigos de estado coherentes.",
    "Programar es resolver problemas: dividir en partes pequeñas, probar a menudo y mejorar el código con calma.",
    "Si optimizas una web, empieza por medir: reduce imágenes, evita renderizados innecesarios y usa caché cuando tenga sentido.",
    "En un equipo de desarrollo, comunicar bien los cambios y revisar pull requests evita errores y ahorra tiempo.",
    "Cuando depuras un bug, reproduce el problema, aísla la causa y verifica el arreglo con un caso sencillo.",
    "Una interfaz minimalista prioriza la lectura: buen contraste, tipografía clara y espacios bien definidos.",
    "La base de datos debe estar normalizada, pero también diseñada pensando en consultas reales y en índices adecuados.",
  ],
  L3: [
    "¿Te has fijado en las tildes? á, é, í, ó, ú; y también en la ñ y la ü. Practicarlas en frases largas ayuda a escribir español con naturalidad, sin sacrificar velocidad ni precisión aunque el texto sea extenso.",
    "A medida que avanzas, concéntrate en la precisión: una tecla mal pulsada rompe el ritmo, pero una corrección rápida te devuelve el control; respira, mantén la postura y continúa hasta completar el párrafo.",
    "Mientras llueve en la ciudad, el café humea y el teclado suena suave: escribe con calma, revisa tus errores más comunes y aprende a mantener un ritmo constante, incluso cuando el texto se alarga.",
    "La aplicación se diseñó pensando en la usabilidad: contraste alto, lectura cómoda y respuestas rápidas; si te equivocas, no te detengas, vuelve al punto correcto y sigue escribiendo con paciencia y atención.",
    "En el informe final añadiremos estadísticas y conclusiones: tiempo empleado, velocidad, precisión y errores; con esos datos podrás comparar partidas, detectar patrones y ajustar tu estrategia de aprendizaje.",
    "Cuando el texto es largo, el reto real no es la dificultad, sino la constancia: mantener el ritmo durante minutos exige concentración, mirada al frente y dedos sueltos, sin tensión en muñecas ni hombros.",
    "En clase repasamos conceptos de desarrollo: planificación, pruebas y revisión; del mismo modo, la mecanografía mejora con práctica diaria, pequeñas metas y una actitud tranquila ante cada corrección.",
    "Si hoy estás cansado, baja el ritmo y prioriza la precisión: escribe despacio, con claridad, y verás que la velocidad aparece después. La práctica constante, día a día, es la clave del progreso.",
  ],
};

const STORAGE_KEYS = {
  leaderboards: "typingTest:leaderboards:v1",
  history: "typingTest:history:v1",
};

const EXPORT_VERSION = 1;

const LIMITS = {
  leaderboardEntries: 10,
  historyEntries: 10,
  visibleHistoryEntries: 5,
};

const TIMING = {
  statsThrottleMs: 110,
};

const TIMED_TEXT = {
  maxWpmAssumption: 240,
  targetBufferMultiplier: 1.2,
  minTargetChars: 320,
  minBufferChars: 80,
  appendChars: 320,
};

const CHAR_SETS = {
  lowercase: "abcdefghijklmnopqrstuvwxyzáéíóúüñ",
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ",
  digits: "0123456789",
  punctuation: ".,;:!?¡¿\"'()[]{}-–—…",
  whitespace: " ",
};

const STATES = {
  idle: "idle",
  running: "running",
  paused: "paused",
  finished: "finished",
};

const IGNORABLE_KEYS = new Set([
  "Shift",
  "Control",
  "Alt",
  "Meta",
  "CapsLock",
  "Tab",
  "Escape",
  "Backspace",
  "Delete",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

const CURSOR_BLOCKED_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]);

const BLOCKED_INPUT_TYPES = new Set(["insertFromPaste", "insertFromDrop"]);
const PASTE_BLOCK_MESSAGE = "Pegar está desactivado durante el test.";
const DROP_BLOCK_MESSAGE = "Arrastrar y soltar texto está desactivado durante el test.";

const dateTimeFormatter = (() => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
})();

function nowPerfMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

/** @param {unknown} number */
function clampMin0(number) {
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

/** @param {unknown} number */
function formatInteger(number) {
  return String(Math.round(clampMin0(number)));
}

/** @param {unknown} milliseconds */
function formatElapsedMs(milliseconds) {
  const safeMs = clampMin0(milliseconds);
  const totalSeconds = safeMs / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;

  if (minutes <= 0) {
    return `${seconds.toFixed(1)} s`;
  }

  const paddedSeconds = seconds.toFixed(1).padStart(4, "0");
  return `${minutes}:${paddedSeconds}`;
}

/** @template T @param {string | null} text @param {T} fallback */
function safeJsonParse(text, fallback) {
  if (typeof text !== "string" || text.trim() === "") return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

/** @param {unknown} value */
function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** @param {number} epochMs */
function formatDateTime(epochMs) {
  const date = new Date(epochMs);
  if (dateTimeFormatter) return dateTimeFormatter.format(date);
  try {
    return date.toLocaleString();
  } catch {
    return String(date);
  }
}

/**
 * Finds the first index where two strings differ.
 * Returns `-1` if they are identical.
 * @param {string} prev
 * @param {string} next
 */
function firstDiffIndex(prev, next) {
  if (prev === next) return -1;

  const minLen = Math.min(prev.length, next.length);
  for (let i = 0; i < minLen; i++) {
    if (prev.charCodeAt(i) !== next.charCodeAt(i)) return i;
  }

  return minLen;
}

/** @param {string} filename @param {unknown} data */
function downloadJson(filename, data) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = window.URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.URL.revokeObjectURL(url);
}

class TypingTestApp {
  /** @param {Document} doc */
  constructor(doc) {
    this.doc = doc;
    this.elements = this.cacheElements(doc);

    this.state = {
      status: STATES.idle,
      mode: "timed",
      level: "L1",
      durationSec: 60,
      targetText: "",
      spans: [],
      prevInput: "",
      totalKeystrokes: 0,
      mistakes: 0,
      runStartPerfMs: null,
      elapsedMs: 0,
      rafId: null,
      lastStatsUpdatePerfMs: null,
      messageTimeoutId: null,
      storageErrorShown: false,
      raceEndHintShown: false,
      pendingScroll: false,
    };

    this.onAnimationFrame = this.onAnimationFrame.bind(this);
  }

  /** @param {Document} doc */
  cacheElements(doc) {
    return {
      card: doc.querySelector(".tarjeta"),
      texto: doc.getElementById("textoObjetivo"),
      entrada: doc.getElementById("entradaUsuario"),
      modo: doc.getElementById("modo"),
      nivel: doc.getElementById("nivel"),
      duracion: doc.getElementById("duracion"),
      botonNuevo: doc.getElementById("nuevoTest"),
      botonPausa: doc.getElementById("togglePausa"),
      botonExportar: doc.getElementById("exportar"),
      botonImportar: doc.getElementById("importar"),
      botonLimpiar: doc.getElementById("limpiarDatos"),
      importFile: doc.getElementById("importFile"),
      mensaje: doc.getElementById("mensaje"),
      statTiempo: doc.getElementById("statTiempo"),
      statTiempoEmpleado: doc.getElementById("statTiempoEmpleado"),
      statWpm: doc.getElementById("statWpm"),
      statPrecision: doc.getElementById("statPrecision"),
      statErrores: doc.getElementById("statErrores"),
      leaderboardContexto: doc.getElementById("leaderboardContexto"),
      leaderboardHead: doc.getElementById("leaderboardHead"),
      leaderboardBody: doc.getElementById("leaderboardBody"),
      leaderboardVacio: doc.getElementById("leaderboardVacio"),
      historialLista: doc.getElementById("historialLista"),
      historialVacio: doc.getElementById("historialVacio"),
      raceProgress: doc.getElementById("raceProgress"),
      raceProgressBar: doc.getElementById("raceProgressBar"),
      raceProgressFill: doc.getElementById("raceProgressFill"),
      raceProgressValue: doc.getElementById("raceProgressValue"),
    };
  }

  init() {
    this.bindEvents();
    this.newTest();
  }

  bindEvents() {
    this.elements.botonNuevo?.addEventListener("click", () => {
      this.newTest();
    });

    this.elements.modo?.addEventListener("change", () => {
      this.newTest();
    });

    this.elements.nivel?.addEventListener("change", () => {
      this.newTest();
    });

    this.elements.duracion?.addEventListener("change", () => {
      this.newTest();
    });

    this.elements.botonPausa?.addEventListener("click", () => {
      this.togglePause();
    });

    this.elements.botonExportar?.addEventListener("click", () => {
      this.exportResults();
    });

    this.elements.botonImportar?.addEventListener("click", () => {
      this.openImportDialog();
    });

    this.elements.importFile?.addEventListener("change", () => {
      void this.handleImportFile();
    });

    this.elements.botonLimpiar?.addEventListener("click", () => {
      this.clearData();
    });

    this.elements.entrada?.addEventListener("keydown", (event) => {
      this.onInputKeyDown(event);
    });

    this.elements.entrada?.addEventListener("input", () => {
      this.onInput();
    });

    this.elements.entrada?.addEventListener("click", () => {
      this.keepCursorAtEnd();
    });

    this.elements.entrada?.addEventListener("paste", (event) => {
      event.preventDefault();
      if (this.state.status !== STATES.finished) this.setStatus(PASTE_BLOCK_MESSAGE, { timeoutMs: 2200 });
    });

    this.elements.entrada?.addEventListener("drop", (event) => {
      event.preventDefault();
      if (this.state.status !== STATES.finished) this.setStatus(DROP_BLOCK_MESSAGE, { timeoutMs: 2200 });
    });

    this.elements.entrada?.addEventListener("dragover", (event) => {
      event.preventDefault();
    });

    this.elements.entrada?.addEventListener("beforeinput", (event) => {
      if (this.state.status === STATES.finished) return;
      if (BLOCKED_INPUT_TYPES.has(event.inputType)) {
        event.preventDefault();
        this.setStatus(event.inputType === "insertFromPaste" ? PASTE_BLOCK_MESSAGE : DROP_BLOCK_MESSAGE, {
          timeoutMs: 2200,
        });
      }
    });

    this.doc.addEventListener("keydown", (event) => {
      this.onGlobalKeyDown(event);
    });

    this.doc.addEventListener("visibilitychange", () => {
      if (this.doc.visibilityState === "hidden" && this.state.status === STATES.running) {
        this.pause({ reason: "hidden" });
      }
    });
  }

  onGlobalKeyDown(event) {
    const key = event.key;
    const hasModifier = event.ctrlKey || event.metaKey || event.altKey;

    if ((event.ctrlKey || event.metaKey) && (key === "n" || key === "N")) {
      event.preventDefault();
      this.newTest();
      return;
    }

    if (!hasModifier && key === "Escape") {
      event.preventDefault();
      this.newTest();
    }
  }

  onInputKeyDown(event) {
    if (!this.elements.entrada) return;
    if (this.state.status === STATES.finished) return;

    if (event.key === "Enter") {
      event.preventDefault();
      return;
    }

    if (event.key === CHAR_SETS.whitespace || event.code === "Space") {
      if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        if (this.state.status === STATES.paused) {
          event.preventDefault();
          this.togglePause();
          return;
        }

        const nextExpected = this.state.targetText[this.elements.entrada.value.length] ?? "";
        if (nextExpected !== CHAR_SETS.whitespace) {
          event.preventDefault();
          this.togglePause();
          return;
        }
      }
    }

    if (this.state.status === STATES.idle && !IGNORABLE_KEYS.has(event.key)) {
      this.startRun();
    }

    if (CURSOR_BLOCKED_KEYS.has(event.key)) {
      event.preventDefault();
      this.keepCursorAtEnd();
    }
  }

  onInput() {
    if (!this.elements.entrada) return;
    if (this.state.status === STATES.finished) return;
    if (this.state.status === STATES.paused) return;

    if (this.state.mode === "race") {
      if (this.elements.entrada.value.length > this.state.targetText.length) {
        this.elements.entrada.value = this.elements.entrada.value.slice(0, this.state.targetText.length);
      }
    } else {
      this.ensureTimedTargetHasBuffer(this.elements.entrada.value.length);
    }

    const nextInput = this.elements.entrada.value;
    this.trackKeystrokes(this.state.prevInput, nextInput);

    this.keepCursorAtEnd();
    this.updateHighlightIncremental(nextInput);
    this.updateRaceProgress();
    this.requestScrollCurrentCharIntoView();

    if (this.state.status === STATES.idle && this.elements.entrada.value.length > 0) {
      this.startRun();
    }

    const nowMs = nowPerfMs();
    this.updateStatsIfDue(nowMs);

    if (this.state.mode === "race" && this.state.status === STATES.running) {
      if (this.elements.entrada.value === this.state.targetText) {
        this.finishRun("completed");
        return;
      }

      if (
        !this.state.raceEndHintShown &&
        this.elements.entrada.value.length === this.state.targetText.length &&
        this.elements.entrada.value !== this.state.targetText
      ) {
        this.state.raceEndHintShown = true;
        this.setStatus("Corrige los errores para terminar la carrera.", { timeoutMs: 2400 });
      }
    }
  }

  applyConfigFromControls() {
    const selectedMode = this.elements.modo?.value;
    this.state.mode = selectedMode === "race" ? "race" : "timed";

    const selectedLevel = this.elements.nivel?.value;
    this.state.level = selectedLevel === "L2" || selectedLevel === "L3" ? selectedLevel : "L1";

    const durationValue = Number.parseInt(this.elements.duracion?.value ?? "60", 10);
    this.state.durationSec = Number.isFinite(durationValue) ? durationValue : 60;

    this.setModeUi();
  }

  setModeUi() {
    const isTimed = this.state.mode === "timed";
    if (this.elements.duracion) this.elements.duracion.disabled = !isTimed;

    const remainingContainer = this.elements.statTiempo?.closest(".stat");
    if (remainingContainer) remainingContainer.hidden = !isTimed;

    if (this.elements.raceProgress) this.elements.raceProgress.hidden = isTimed;
  }

  updateControlsUi() {
    const button = this.elements.botonPausa;
    if (!button) return;

    if (this.state.status === STATES.running) {
      button.disabled = false;
      button.textContent = "Pausar";
      button.setAttribute("aria-pressed", "false");
      return;
    }

    if (this.state.status === STATES.paused) {
      button.disabled = false;
      button.textContent = "Reanudar";
      button.setAttribute("aria-pressed", "true");
      return;
    }

    button.disabled = true;
    button.textContent = "Pausar";
    button.setAttribute("aria-pressed", "false");
  }

  resetRunState() {
    if (this.state.rafId !== null) {
      window.cancelAnimationFrame(this.state.rafId);
      this.state.rafId = null;
    }

    if (this.state.messageTimeoutId !== null) {
      window.clearTimeout(this.state.messageTimeoutId);
      this.state.messageTimeoutId = null;
    }

    this.state.status = STATES.idle;
    this.state.runStartPerfMs = null;
    this.state.elapsedMs = 0;
    this.state.lastStatsUpdatePerfMs = null;
    this.state.prevInput = "";
    this.state.totalKeystrokes = 0;
    this.state.mistakes = 0;
    this.state.raceEndHintShown = false;
    this.state.pendingScroll = false;

    if (this.elements.card) this.elements.card.classList.remove("is-paused");
  }

  newTest() {
    this.resetRunState();
    this.applyConfigFromControls();

    this.state.targetText =
      this.state.mode === "timed"
        ? this.buildTimedTargetText(this.state.level, this.getTimedTargetCharGoal(this.state.durationSec))
        : this.chooseRandomText(this.state.level);

    this.renderTargetText(this.state.targetText);
    this.updateRaceProgress();

    if (this.elements.entrada) {
      this.elements.entrada.disabled = false;
      this.elements.entrada.readOnly = false;
      this.elements.entrada.removeAttribute("aria-disabled");
      this.elements.entrada.value = "";
    }

    if (this.elements.mensaje) this.elements.mensaje.textContent = "";
    this.state.prevInput = "";
    this.updateHighlightIncremental("");

    if (this.state.mode === "timed" && this.elements.statTiempo) {
      this.elements.statTiempo.textContent = `${this.state.durationSec} s`;
    }

    if (this.elements.statTiempoEmpleado) this.elements.statTiempoEmpleado.textContent = "0.0 s";
    if (this.elements.statWpm) this.elements.statWpm.textContent = "0 WPM";
    if (this.elements.statPrecision) this.elements.statPrecision.textContent = "0 %";
    if (this.elements.statErrores) this.elements.statErrores.textContent = "0";

    this.renderLeaderboard();
    this.renderHistory();
    this.updateControlsUi();

    window.setTimeout(() => {
      this.elements.entrada?.focus({ preventScroll: true });
      this.keepCursorAtEnd();
    }, 0);
  }

  startRun() {
    if (this.state.status !== STATES.idle) return;

    this.state.status = STATES.running;
    this.state.runStartPerfMs = nowPerfMs();
    this.state.lastStatsUpdatePerfMs = null;

    if (this.elements.mensaje) this.elements.mensaje.textContent = "";
    this.updateControlsUi();
    this.scheduleAnimationFrame();
  }

  togglePause() {
    if (this.state.status === STATES.running) {
      this.pause({ reason: "user" });
      return;
    }

    if (this.state.status === STATES.paused) {
      this.resume();
    }
  }

  pause({ reason }) {
    if (this.state.status !== STATES.running) return;

    const nowMs = nowPerfMs();
    this.state.elapsedMs = this.getElapsedMs(nowMs);
    this.state.runStartPerfMs = null;
    this.state.status = STATES.paused;

    if (this.state.rafId !== null) {
      window.cancelAnimationFrame(this.state.rafId);
      this.state.rafId = null;
    }

    if (this.elements.card) this.elements.card.classList.add("is-paused");

    if (this.elements.entrada) {
      this.elements.entrada.readOnly = true;
      this.elements.entrada.setAttribute("aria-disabled", "true");
      this.keepCursorAtEnd();
      this.elements.entrada.focus({ preventScroll: true });
    }

    this.updateControlsUi();

    if (reason === "hidden") {
      this.setStatus("Pausado automáticamente (pestaña en segundo plano).");
      return;
    }

    this.setStatus("Pausado.");
  }

  resume() {
    if (this.state.status !== STATES.paused) return;

    this.state.status = STATES.running;
    this.state.runStartPerfMs = nowPerfMs();
    this.state.lastStatsUpdatePerfMs = null;

    if (this.elements.card) this.elements.card.classList.remove("is-paused");

    if (this.elements.entrada) {
      this.elements.entrada.readOnly = false;
      this.elements.entrada.removeAttribute("aria-disabled");
      this.elements.entrada.focus({ preventScroll: true });
      this.keepCursorAtEnd();
    }

    if (this.elements.mensaje?.textContent?.startsWith("Pausado")) {
      this.elements.mensaje.textContent = "";
    }

    this.updateControlsUi();
    this.scheduleAnimationFrame();
  }

  scheduleAnimationFrame() {
    if (this.state.rafId !== null) return;
    this.state.rafId = window.requestAnimationFrame(this.onAnimationFrame);
  }

  onAnimationFrame() {
    if (this.state.status !== STATES.running) {
      this.state.rafId = null;
      return;
    }

    const nowMs = nowPerfMs();
    const elapsedMs = this.getElapsedMs(nowMs);

    if (this.state.mode === "timed") {
      const totalMs = clampMin0(this.state.durationSec) * 1000;
      if (elapsedMs >= totalMs) {
        this.finishRun("timeout");
        return;
      }
    }

    this.updateStatsIfDue(nowMs);

    this.state.rafId = window.requestAnimationFrame(this.onAnimationFrame);
  }

  /** @param {number} nowMs */
  getElapsedMs(nowMs) {
    if (this.state.status === STATES.running && this.state.runStartPerfMs !== null) {
      return clampMin0(this.state.elapsedMs + (nowMs - this.state.runStartPerfMs));
    }
    return clampMin0(this.state.elapsedMs);
  }

  /** @param {number} nowMs */
  updateStatsIfDue(nowMs) {
    if (this.state.status === STATES.finished) return;
    if (this.state.status === STATES.paused) return;

    const last = this.state.lastStatsUpdatePerfMs ?? null;
    if (last !== null && nowMs - last < TIMING.statsThrottleMs) return;
    this.state.lastStatsUpdatePerfMs = nowMs;
    this.updateStats(nowMs);
  }

  /** @param {number} nowMs */
  updateStats(nowMs) {
    const input = this.elements.entrada?.value ?? "";
    const elapsedMs = this.getElapsedMs(nowMs);
    const { correct } = this.calculateCounts(input);

    const elapsedMinutes = elapsedMs / 60000;
    const wpm = elapsedMinutes > 0 ? (correct / 5) / elapsedMinutes : 0;
    const totalKeystrokes = clampMin0(this.state.totalKeystrokes);
    const mistakes = clampMin0(this.state.mistakes);
    const accuracy =
      totalKeystrokes > 0 ? (clampMin0(totalKeystrokes - mistakes) / totalKeystrokes) * 100 : 0;

    if (this.state.mode === "timed") {
      const totalMs = clampMin0(this.state.durationSec) * 1000;
      const remainingMs = Math.max(0, totalMs - elapsedMs);
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      if (this.elements.statTiempo) this.elements.statTiempo.textContent = `${remainingSeconds} s`;
    }

    if (this.elements.statTiempoEmpleado) this.elements.statTiempoEmpleado.textContent = formatElapsedMs(elapsedMs);
    if (this.elements.statWpm) this.elements.statWpm.textContent = `${formatInteger(wpm)} WPM`;
    if (this.elements.statPrecision) this.elements.statPrecision.textContent = `${formatInteger(accuracy)} %`;
    if (this.elements.statErrores) this.elements.statErrores.textContent = String(mistakes);
  }

  /** @param {string} input */
  calculateCounts(input) {
    let correct = 0;
    let errors = 0;

    for (let i = 0; i < input.length; i++) {
      if (i < this.state.targetText.length && input[i] === this.state.targetText[i]) {
        correct++;
      } else {
        errors++;
      }
    }

    return { totalTyped: input.length, correct, errors };
  }

  finishRun(reason) {
    if (this.state.status === STATES.finished) return;

    const nowMs = nowPerfMs();
    const elapsedMsNow = this.getElapsedMs(nowMs);
    const finalElapsedMs =
      this.state.mode === "timed" ? clampMin0(this.state.durationSec) * 1000 : clampMin0(elapsedMsNow);

    this.state.status = STATES.finished;
    this.state.elapsedMs = finalElapsedMs;
    this.state.runStartPerfMs = null;

    if (this.state.rafId !== null) {
      window.cancelAnimationFrame(this.state.rafId);
      this.state.rafId = null;
    }

    if (this.state.messageTimeoutId !== null) {
      window.clearTimeout(this.state.messageTimeoutId);
      this.state.messageTimeoutId = null;
    }

    if (this.elements.entrada) {
      this.elements.entrada.disabled = true;
      this.elements.entrada.readOnly = false;
      this.elements.entrada.removeAttribute("aria-disabled");
    }

    this.updateHighlightIncremental(this.elements.entrada?.value ?? "");
    this.updateStats(nowPerfMs());

    const result = this.buildResult(finalElapsedMs);
    const wpmText = `${formatInteger(result.wpm)} WPM`;
    const accuracyText = `${formatInteger(result.accuracy)} %`;
    const errorsText = `${result.errors} errores`;
    const timeText = formatElapsedMs(result.timeMs);

    if (this.state.mode === "race") {
      this.setStatus(
        `Carrera finalizada en ${timeText}. Resultado: ${wpmText}, ${accuracyText} de precisión, ${errorsText}.`
      );
    } else {
      this.setStatus(`Tiempo finalizado. Resultado: ${wpmText}, ${accuracyText} de precisión, ${errorsText}.`);
    }

    this.persistResult(result);
    this.renderLeaderboard();
    this.renderHistory();
    this.updateControlsUi();
    void reason;
  }

  /** @param {number} finalElapsedMs */
  buildResult(finalElapsedMs) {
    const input = this.elements.entrada?.value ?? "";
    const { correct } = this.calculateCounts(input);

    const elapsedMinutes = finalElapsedMs / 60000;
    const wpm = elapsedMinutes > 0 ? (correct / 5) / elapsedMinutes : 0;
    const totalKeystrokes = clampMin0(this.state.totalKeystrokes);
    const mistakes = clampMin0(this.state.mistakes);
    const accuracy =
      totalKeystrokes > 0 ? (clampMin0(totalKeystrokes - mistakes) / totalKeystrokes) * 100 : 0;

    return {
      mode: this.state.mode,
      level: this.state.level,
      durationSec: this.state.mode === "timed" ? this.state.durationSec : null,
      timeMs: Math.round(finalElapsedMs),
      wpm,
      accuracy,
      errors: mistakes,
      finishedAtEpochMs: Date.now(),
    };
  }

  getLeaderboardKey(mode, durationSec, level) {
    if (mode === "race") return `race|${level}`;
    return `timed|${durationSec}|${level}`;
  }

  compareTimedResults(a, b) {
    if (b.wpm !== a.wpm) return b.wpm - a.wpm;
    if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
    if (a.errors !== b.errors) return a.errors - b.errors;
    return (b.finishedAtEpochMs ?? 0) - (a.finishedAtEpochMs ?? 0);
  }

  compareRaceResults(a, b) {
    if (a.timeMs !== b.timeMs) return a.timeMs - b.timeMs;
    if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
    if (a.errors !== b.errors) return a.errors - b.errors;
    return (b.finishedAtEpochMs ?? 0) - (a.finishedAtEpochMs ?? 0);
  }

  readStorageJson(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      return safeJsonParse(raw, fallback);
    } catch {
      this.reportStorageErrorOnce();
      return fallback;
    }
  }

  writeStorageJson(key, value, { actionLabel }) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      this.setStatus(`No se pudo ${actionLabel ?? "guardar"} (localStorage no disponible).`, { timeoutMs: 4200 });
      this.reportStorageErrorOnce();
      return false;
    }
  }

  removeStorageKey(key, { actionLabel }) {
    try {
      window.localStorage.removeItem(key);
      return true;
    } catch {
      this.setStatus(`No se pudo ${actionLabel ?? "borrar"} (localStorage no disponible).`, { timeoutMs: 4200 });
      this.reportStorageErrorOnce();
      return false;
    }
  }

  reportStorageErrorOnce() {
    if (this.state.storageErrorShown) return;
    this.state.storageErrorShown = true;
    this.setStatus("Atención: localStorage no está disponible; algunos resultados no se guardarán.", {
      timeoutMs: 5200,
    });
  }

  persistResult(result) {
    const key = this.getLeaderboardKey(result.mode, result.durationSec, result.level);

    const leaderboards = this.readStorageJson(STORAGE_KEYS.leaderboards, {});
    const current = Array.isArray(leaderboards[key]) ? leaderboards[key] : [];
    current.push(result);
    current.sort(
      result.mode === "race" ? (a, b) => this.compareRaceResults(a, b) : (a, b) => this.compareTimedResults(a, b)
    );
    leaderboards[key] = current.slice(0, LIMITS.leaderboardEntries);
    this.writeStorageJson(STORAGE_KEYS.leaderboards, leaderboards, { actionLabel: "guardar el ranking" });

    const history = this.readStorageJson(STORAGE_KEYS.history, []);
    const nextHistory = Array.isArray(history) ? history : [];
    nextHistory.unshift(result);
    this.writeStorageJson(STORAGE_KEYS.history, nextHistory.slice(0, LIMITS.historyEntries), {
      actionLabel: "guardar el historial",
    });
  }

  renderLeaderboard() {
    if (!this.elements.leaderboardHead || !this.elements.leaderboardBody || !this.elements.leaderboardContexto) return;

    const key = this.getLeaderboardKey(this.state.mode, this.state.durationSec, this.state.level);
    const leaderboards = this.readStorageJson(STORAGE_KEYS.leaderboards, {});
    const entries = Array.isArray(leaderboards[key]) ? leaderboards[key] : [];

    const modeLabel = this.state.mode === "race" ? "Carrera" : "Contrarreloj";
    const durationLabel = this.state.mode === "timed" ? ` · ${this.state.durationSec} s` : "";
    this.elements.leaderboardContexto.textContent = `Top ${LIMITS.leaderboardEntries} · ${modeLabel}${durationLabel} · ${this.state.level}`;

    const headers =
      this.state.mode === "race"
        ? ["#", "Tiempo", "WPM", "Precisión", "Errores", "Fecha"]
        : ["#", "WPM", "Precisión", "Errores", "Fecha"];

    this.elements.leaderboardHead.innerHTML = "";
    for (const header of headers) {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = header;
      this.elements.leaderboardHead.appendChild(th);
    }

    this.elements.leaderboardBody.innerHTML = "";
    if (this.elements.leaderboardVacio) this.elements.leaderboardVacio.hidden = entries.length > 0;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const tr = document.createElement("tr");

      const cells =
        this.state.mode === "race"
          ? [
              String(i + 1),
              formatElapsedMs(entry.timeMs),
              `${formatInteger(entry.wpm)}`,
              `${formatInteger(entry.accuracy)} %`,
              String(entry.errors),
              formatDateTime(entry.finishedAtEpochMs),
            ]
          : [
              String(i + 1),
              `${formatInteger(entry.wpm)}`,
              `${formatInteger(entry.accuracy)} %`,
              String(entry.errors),
              formatDateTime(entry.finishedAtEpochMs),
            ];

      for (const value of cells) {
        const td = document.createElement("td");
        td.textContent = value;
        tr.appendChild(td);
      }

      this.elements.leaderboardBody.appendChild(tr);
    }
  }

  renderHistory() {
    if (!this.elements.historialLista) return;

    const history = this.readStorageJson(STORAGE_KEYS.history, []);
    const entries = Array.isArray(history) ? history.slice(0, LIMITS.visibleHistoryEntries) : [];

    this.elements.historialLista.innerHTML = "";
    if (this.elements.historialVacio) this.elements.historialVacio.hidden = entries.length > 0;

    for (const entry of entries) {
      const li = document.createElement("li");
      li.className = "historial-item";

      const modeLabel = entry.mode === "race" ? "Carrera" : `Contrarreloj ${entry.durationSec} s`;
      const metric =
        entry.mode === "race"
          ? `${formatElapsedMs(entry.timeMs)} · ${formatInteger(entry.wpm)} WPM`
          : `${formatInteger(entry.wpm)} WPM`;

      const primary = document.createElement("div");
      primary.className = "historial-principal";
      primary.textContent = `${modeLabel} · ${entry.level} · ${metric}`;

      const secondary = document.createElement("div");
      secondary.className = "historial-secundario";
      secondary.textContent = `${formatInteger(entry.accuracy)} % · ${entry.errors} errores · ${formatDateTime(entry.finishedAtEpochMs)}`;

      li.appendChild(primary);
      li.appendChild(secondary);
      this.elements.historialLista.appendChild(li);
    }
  }

  chooseRandomText(level) {
    const pool = TEXT_POOLS[level] ?? TEXT_POOLS.L1;
    const index = Math.floor(Math.random() * pool.length);
    return pool[index];
  }

  getTimedTargetCharGoal(durationSec) {
    const safeDurationSec = clampMin0(durationSec);
    const minutes = safeDurationSec / 60;
    const estimatedChars = TIMED_TEXT.maxWpmAssumption * 5 * minutes;
    const targetChars = Math.ceil(estimatedChars * TIMED_TEXT.targetBufferMultiplier);
    return Math.max(TIMED_TEXT.minTargetChars, targetChars);
  }

  buildTimedTargetText(level, minLength) {
    const parts = [];
    let totalLength = 0;

    const target = clampMin0(minLength);
    while (totalLength < target) {
      const sentence = this.chooseRandomText(level);
      parts.push(sentence);
      totalLength += sentence.length;
      if (totalLength < target) totalLength += 1;
    }

    return parts.join(" ");
  }

  ensureTimedTargetHasBuffer(typedLength) {
    if (this.state.mode !== "timed") return;

    const safeTypedLength = clampMin0(typedLength);
    while (this.state.targetText.length - safeTypedLength < TIMED_TEXT.minBufferChars) {
      this.appendTargetText(this.buildTimedTargetText(this.state.level, TIMED_TEXT.appendChars));
    }
  }

  appendTargetText(text) {
    if (typeof text !== "string" || text.length === 0) return;
    if (!this.elements.texto) return;

    let appendedText = text;
    if (this.state.targetText.length > 0) {
      const needsSpace = !this.state.targetText.endsWith(" ") && !appendedText.startsWith(" ");
      appendedText = needsSpace ? ` ${appendedText}` : appendedText;
    }

    this.state.targetText += appendedText;

    const fragment = document.createDocumentFragment();
    for (const character of appendedText) {
      const span = document.createElement("span");
      span.className = "char";
      span.textContent = character;
      this.state.spans.push(span);
      fragment.appendChild(span);
    }

    this.elements.texto.appendChild(fragment);
  }

  renderTargetText(text) {
    if (!this.elements.texto) return;

    this.elements.texto.innerHTML = "";
    this.elements.texto.scrollTop = 0;
    this.state.spans = [];

    const fragment = document.createDocumentFragment();
    for (const character of text) {
      const span = document.createElement("span");
      span.className = "char";
      span.textContent = character;
      this.state.spans.push(span);
      fragment.appendChild(span);
    }

    this.elements.texto.appendChild(fragment);
  }

  /**
   * Tracks cumulative mistakes even if the user later deletes/corrects them.
   * Counts inserted characters only (deletions do not reduce mistakes).
   * @param {string} prevInput
   * @param {string} nextInput
   */
  trackKeystrokes(prevInput, nextInput) {
    const start = firstDiffIndex(prevInput, nextInput);
    if (start === -1) return;

    let prevEnd = prevInput.length - 1;
    let nextEnd = nextInput.length - 1;
    while (prevEnd >= start && nextEnd >= start && prevInput.charCodeAt(prevEnd) === nextInput.charCodeAt(nextEnd)) {
      prevEnd--;
      nextEnd--;
    }

    const insertedCount = nextEnd - start + 1;
    if (insertedCount <= 0) return;

    this.state.totalKeystrokes += insertedCount;

    for (let offset = 0; offset < insertedCount; offset++) {
      const index = start + offset;
      const typedChar = nextInput[index];
      const expectedChar = this.state.targetText[index];
      if (expectedChar === undefined || typedChar !== expectedChar) {
        this.state.mistakes += 1;
      }
    }
  }

  updateHighlightIncremental(nextInput) {
    const prevInput = this.state.prevInput;
    const spansLen = this.state.spans.length;

    const oldCursor = prevInput.length;
    if (oldCursor < spansLen) this.state.spans[oldCursor].classList.remove("actual");

    const start = firstDiffIndex(prevInput, nextInput);
    if (start !== -1) {
      const end = Math.min(Math.max(prevInput.length, nextInput.length), spansLen) - 1;
      for (let i = start; i <= end; i++) {
        const span = this.state.spans[i];
        span.classList.remove("correcto", "incorrecto", "actual");

        if (i < nextInput.length) {
          span.classList.add(nextInput[i] === this.state.targetText[i] ? "correcto" : "incorrecto");
        }
      }
    }

    const newCursor = nextInput.length;
    if (this.state.status !== STATES.finished && newCursor < spansLen) {
      const span = this.state.spans[newCursor];
      span.classList.remove("correcto", "incorrecto");
      span.classList.add("actual");
    }

    this.state.prevInput = nextInput;
  }

  requestScrollCurrentCharIntoView() {
    if (this.state.pendingScroll) return;
    this.state.pendingScroll = true;

    window.requestAnimationFrame(() => {
      this.state.pendingScroll = false;
      this.scrollCurrentCharIntoView();
    });
  }

  scrollCurrentCharIntoView() {
    if (!this.elements.texto || !this.elements.entrada) return;

    const index = this.elements.entrada.value.length;
    const span = this.state.spans[index];
    if (!span) return;

    try {
      span.scrollIntoView({ block: "nearest", inline: "nearest" });
    } catch {
      span.scrollIntoView();
    }
  }

  keepCursorAtEnd() {
    if (!this.elements.entrada) return;
    const pos = this.elements.entrada.value.length;
    try {
      this.elements.entrada.setSelectionRange(pos, pos);
    } catch {
      void pos;
    }
  }

  updateRaceProgress() {
    if (!this.elements.raceProgress || !this.elements.raceProgressBar) return;
    if (!this.elements.raceProgressFill || !this.elements.raceProgressValue) return;

    if (this.state.mode !== "race") {
      this.elements.raceProgress.hidden = true;
      return;
    }

    this.elements.raceProgress.hidden = false;
    const typed = this.elements.entrada?.value.length ?? 0;
    const total = this.state.targetText.length || 1;
    const percent = Math.min(100, (typed / total) * 100);

    this.elements.raceProgressFill.style.width = `${percent.toFixed(2)}%`;
    this.elements.raceProgressValue.textContent = `${formatInteger(percent)} %`;
    this.elements.raceProgressBar.setAttribute("aria-valuenow", formatInteger(percent));
  }

  setStatus(text, { timeoutMs = 0 } = {}) {
    if (!this.elements.mensaje) return;

    this.elements.mensaje.textContent = text;

    if (this.state.messageTimeoutId !== null) {
      window.clearTimeout(this.state.messageTimeoutId);
      this.state.messageTimeoutId = null;
    }

    const safeTimeout = clampMin0(timeoutMs);
    if (safeTimeout <= 0) return;

    this.state.messageTimeoutId = window.setTimeout(() => {
      this.state.messageTimeoutId = null;
      if (this.state.status === STATES.finished) return;
      if (this.elements.mensaje?.textContent === text) this.elements.mensaje.textContent = "";
    }, safeTimeout);
  }

  exportResults() {
    const leaderboards = this.readStorageJson(STORAGE_KEYS.leaderboards, {});
    const history = this.readStorageJson(STORAGE_KEYS.history, []);

    const payload = {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      leaderboard: leaderboards,
      history,
    };

    const safeStamp = payload.exportedAt.replace(/[:.]/g, "-");
    downloadJson(`typing-test-results-${safeStamp}.json`, payload);
    this.setStatus("Resultados exportados.", { timeoutMs: 2200 });
  }

  openImportDialog() {
    if (!this.elements.importFile) return;
    this.elements.importFile.value = "";
    this.elements.importFile.click();
  }

  sanitizeResultEntry(value) {
    if (!isPlainObject(value)) return null;

    const mode = value.mode === "race" ? "race" : value.mode === "timed" ? "timed" : null;
    if (!mode) return null;

    const level = value.level === "L2" || value.level === "L3" ? value.level : value.level === "L1" ? "L1" : null;
    if (!level) return null;

    const durationRaw = Number(value.durationSec);
    const durationSec = mode === "timed" && Number.isFinite(durationRaw) ? Math.max(0, Math.round(durationRaw)) : null;

    const timeMsRaw = Number(value.timeMs);
    const timeMs = Number.isFinite(timeMsRaw) ? Math.max(0, Math.round(timeMsRaw)) : null;

    const wpmRaw = Number(value.wpm);
    const wpm = Number.isFinite(wpmRaw) ? Math.max(0, wpmRaw) : null;

    const accuracyRaw = Number(value.accuracy);
    const accuracy = Number.isFinite(accuracyRaw) ? Math.max(0, Math.min(100, accuracyRaw)) : null;

    const errorsRaw = Number(value.errors);
    const errors = Number.isFinite(errorsRaw) ? Math.max(0, Math.round(errorsRaw)) : null;

    const finishedRaw = Number(value.finishedAtEpochMs);
    const finishedAtEpochMs = Number.isFinite(finishedRaw) ? Math.max(0, Math.round(finishedRaw)) : null;

    if (timeMs === null || wpm === null || accuracy === null || errors === null || finishedAtEpochMs === null) return null;

    return {
      mode,
      level,
      durationSec,
      timeMs,
      wpm,
      accuracy,
      errors,
      finishedAtEpochMs,
    };
  }

  sanitizeLeaderboards(value) {
    const out = {};
    if (!isPlainObject(value)) return out;

    for (const [key, rawEntries] of Object.entries(value)) {
      if (!Array.isArray(rawEntries)) continue;

      const cleaned = [];
      for (const rawEntry of rawEntries) {
        const entry = this.sanitizeResultEntry(rawEntry);
        if (entry) cleaned.push(entry);
      }

      if (cleaned.length === 0) continue;

      const mode = key.startsWith("race|") ? "race" : key.startsWith("timed|") ? "timed" : null;
      cleaned.sort(
        mode === "race" ? (a, b) => this.compareRaceResults(a, b) : (a, b) => this.compareTimedResults(a, b)
      );
      out[key] = cleaned.slice(0, LIMITS.leaderboardEntries);
    }

    return out;
  }

  sanitizeHistory(value) {
    if (!Array.isArray(value)) return [];
    const cleaned = [];
    for (const rawEntry of value) {
      const entry = this.sanitizeResultEntry(rawEntry);
      if (entry) cleaned.push(entry);
    }
    return cleaned.slice(0, LIMITS.historyEntries);
  }

  async handleImportFile() {
    const fileInput = this.elements.importFile;
    if (!fileInput) return;

    const file = fileInput.files?.[0];
    if (!file) return;

    let text = "";
    try {
      text = await file.text();
    } catch {
      this.setStatus("No se pudo leer el archivo.", { timeoutMs: 3200 });
      return;
    }

    const parsed = safeJsonParse(text, null);
    if (!isPlainObject(parsed)) {
      this.setStatus("Archivo inválido: JSON mal formado.", { timeoutMs: 3600 });
      return;
    }

    const versionNumber = Number(parsed.version);
    if (!Number.isFinite(versionNumber) || versionNumber !== EXPORT_VERSION) {
      this.setStatus("Archivo inválido: versión no compatible.", { timeoutMs: 3600 });
      return;
    }

    if (!isPlainObject(parsed.leaderboard) || !Array.isArray(parsed.history)) {
      this.setStatus("Archivo inválido: estructura incorrecta.", { timeoutMs: 3600 });
      return;
    }

    const leaderboards = this.sanitizeLeaderboards(parsed.leaderboard);
    const history = this.sanitizeHistory(parsed.history);

    const ok1 = this.writeStorageJson(STORAGE_KEYS.leaderboards, leaderboards, { actionLabel: "importar el ranking" });
    const ok2 = this.writeStorageJson(STORAGE_KEYS.history, history, { actionLabel: "importar el historial" });

    if (!ok1 || !ok2) return;

    this.setStatus("Resultados importados.", { timeoutMs: 2400 });
    this.renderLeaderboard();
    this.renderHistory();
  }

  clearData() {
    const ok = window.confirm("¿Seguro que quieres borrar el historial y el ranking guardados en este navegador?");
    if (!ok) return;

    const ok1 = this.removeStorageKey(STORAGE_KEYS.leaderboards, { actionLabel: "borrar el ranking" });
    const ok2 = this.removeStorageKey(STORAGE_KEYS.history, { actionLabel: "borrar el historial" });

    if (!ok1 || !ok2) return;

    this.setStatus("Datos borrados.", { timeoutMs: 2200 });
    this.renderLeaderboard();
    this.renderHistory();
  }
}

new TypingTestApp(document).init();
