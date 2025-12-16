"use strict";

const TEXT_POOLS = {
  L1: [
    "Practicar un poco cada dia mejora la mecanografia.",
    "Escribe con calma y mantén el ritmo sin mirar el teclado.",
    "Respira, relaja los hombros y deja que los dedos fluyan.",
    "La precision importa mas que la velocidad al principio.",
    "Un buen habito es corregir errores y seguir adelante.",
    "Repite frases cortas hasta ganar confianza y control.",
    "Teclas suaves, manos quietas y mirada en la pantalla.",
    "Constancia y paciencia: el progreso llega con el tiempo.",
  ],
  L2: [
    "En DAW aprendemos a construir aplicaciones web con HTML, CSS y JavaScript, cuidando la accesibilidad y el rendimiento.",
    "Una buena API REST define rutas claras, valida los datos de entrada y devuelve codigos de estado coherentes.",
    "Programar es resolver problemas: dividir en partes pequeñas, probar a menudo y mejorar el codigo con calma.",
    "Si optimizas una web, empieza por medir: reduce imagenes, evita renderizados innecesarios y usa cache cuando tenga sentido.",
    "En un equipo de desarrollo, comunicar bien los cambios y revisar pull requests evita errores y ahorra tiempo.",
    "Cuando depuras un bug, reproduce el problema, aisla la causa y verifica el arreglo con un caso sencillo.",
    "Una interfaz minimalista prioriza la lectura: buen contraste, tipografia clara y espacios bien definidos.",
    "La base de datos debe estar normalizada, pero tambien diseñada pensando en consultas reales y en indices adecuados.",
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

const MAX_LEADERBOARD_ENTRIES = 10;
const MAX_HISTORY_ENTRIES = 10;
const VISIBLE_HISTORY_ENTRIES = 5;

const elements = {
  texto: document.getElementById("textoObjetivo"),
  entrada: document.getElementById("entradaUsuario"),
  modo: document.getElementById("modo"),
  nivel: document.getElementById("nivel"),
  duracion: document.getElementById("duracion"),
  botonNuevo: document.getElementById("nuevoTest"),
  mensaje: document.getElementById("mensaje"),
  statTiempo: document.getElementById("statTiempo"),
  statTiempoEmpleado: document.getElementById("statTiempoEmpleado"),
  statWpm: document.getElementById("statWpm"),
  statPrecision: document.getElementById("statPrecision"),
  statErrores: document.getElementById("statErrores"),
  leaderboardContexto: document.getElementById("leaderboardContexto"),
  leaderboardHead: document.getElementById("leaderboardHead"),
  leaderboardBody: document.getElementById("leaderboardBody"),
  leaderboardVacio: document.getElementById("leaderboardVacio"),
  historialLista: document.getElementById("historialLista"),
  historialVacio: document.getElementById("historialVacio"),
};

const state = {
  mode: "timed",
  level: "L1",
  durationSec: 60,
  targetText: "",
  spans: [],
  startPerfMs: null,
  startedAtEpochMs: null,
  timerId: null,
  running: false,
  finished: false,
  finalElapsedMs: 0,
};

function nowPerfMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function clampMin0(number) {
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function formatInteger(number) {
  return String(Math.round(clampMin0(number)));
}

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

function safeJsonParse(text, fallback) {
  if (typeof text !== "string" || text.trim() === "") return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function readStorageJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return safeJsonParse(raw, fallback);
  } catch {
    return fallback;
  }
}

function writeStorageJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function getLeaderboardKey(mode, durationSec, level) {
  if (mode === "race") return `race|${level}`;
  return `timed|${durationSec}|${level}`;
}

function compareTimedResults(a, b) {
  if (b.wpm !== a.wpm) return b.wpm - a.wpm;
  if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
  if (a.errors !== b.errors) return a.errors - b.errors;
  return (b.finishedAtEpochMs ?? 0) - (a.finishedAtEpochMs ?? 0);
}

function compareRaceResults(a, b) {
  if (a.timeMs !== b.timeMs) return a.timeMs - b.timeMs;
  if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
  if (a.errors !== b.errors) return a.errors - b.errors;
  return (b.finishedAtEpochMs ?? 0) - (a.finishedAtEpochMs ?? 0);
}

function persistResult(result) {
  const key = getLeaderboardKey(result.mode, result.durationSec, result.level);

  const leaderboards = readStorageJson(STORAGE_KEYS.leaderboards, {});
  const current = Array.isArray(leaderboards[key]) ? leaderboards[key] : [];
  current.push(result);
  current.sort(result.mode === "race" ? compareRaceResults : compareTimedResults);
  leaderboards[key] = current.slice(0, MAX_LEADERBOARD_ENTRIES);
  writeStorageJson(STORAGE_KEYS.leaderboards, leaderboards);

  const history = readStorageJson(STORAGE_KEYS.history, []);
  const nextHistory = Array.isArray(history) ? history : [];
  nextHistory.unshift(result);
  writeStorageJson(STORAGE_KEYS.history, nextHistory.slice(0, MAX_HISTORY_ENTRIES));
}

function formatDateTime(epochMs) {
  const date = new Date(epochMs);
  try {
    return date.toLocaleString(undefined, {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return date.toLocaleString();
  }
}

function renderLeaderboard() {
  if (!elements.leaderboardHead || !elements.leaderboardBody || !elements.leaderboardContexto) return;

  const key = getLeaderboardKey(state.mode, state.durationSec, state.level);
  const leaderboards = readStorageJson(STORAGE_KEYS.leaderboards, {});
  const entries = Array.isArray(leaderboards[key]) ? leaderboards[key] : [];

  const modeLabel = state.mode === "race" ? "Carrera" : "Contrarreloj";
  const durationLabel = state.mode === "timed" ? ` · ${state.durationSec} s` : "";
  elements.leaderboardContexto.textContent = `Top ${MAX_LEADERBOARD_ENTRIES} · ${modeLabel}${durationLabel} · ${state.level}`;

  const headers =
    state.mode === "race"
      ? ["#", "Tiempo", "WPM", "Precisión", "Errores", "Fecha"]
      : ["#", "WPM", "Precisión", "Errores", "Fecha"];

  elements.leaderboardHead.innerHTML = "";
  for (const header of headers) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = header;
    elements.leaderboardHead.appendChild(th);
  }

  elements.leaderboardBody.innerHTML = "";
  if (elements.leaderboardVacio) elements.leaderboardVacio.hidden = entries.length > 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const tr = document.createElement("tr");

    const cells =
      state.mode === "race"
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

    elements.leaderboardBody.appendChild(tr);
  }
}

function renderHistory() {
  if (!elements.historialLista) return;

  const history = readStorageJson(STORAGE_KEYS.history, []);
  const entries = Array.isArray(history) ? history.slice(0, VISIBLE_HISTORY_ENTRIES) : [];

  elements.historialLista.innerHTML = "";
  if (elements.historialVacio) elements.historialVacio.hidden = entries.length > 0;

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
    elements.historialLista.appendChild(li);
  }
}

function getRemainingMs(elapsedMs) {
  if (state.mode !== "timed") return null;
  const totalMs = clampMin0(state.durationSec) * 1000;
  return Math.max(0, totalMs - clampMin0(elapsedMs));
}

function chooseRandomText(level) {
  const pool = TEXT_POOLS[level] ?? TEXT_POOLS.L1;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}

function renderTargetText(text) {
  elements.texto.innerHTML = "";
  state.spans = [];

  const fragment = document.createDocumentFragment();
  for (const character of text) {
    const span = document.createElement("span");
    span.className = "char";
    span.textContent = character;
    state.spans.push(span);
    fragment.appendChild(span);
  }

  elements.texto.appendChild(fragment);
}

function calculateCounts(input) {
  let correct = 0;
  let errors = 0;

  for (let i = 0; i < input.length; i++) {
    if (i < state.targetText.length && input[i] === state.targetText[i]) {
      correct++;
    } else {
      errors++;
    }
  }

  return { totalTyped: input.length, correct, errors };
}

function updateHighlight(input) {
  for (let i = 0; i < state.spans.length; i++) {
    const span = state.spans[i];
    span.classList.remove("correcto", "incorrecto", "actual");

    if (i < input.length) {
      span.classList.add(input[i] === state.targetText[i] ? "correcto" : "incorrecto");
      continue;
    }

    if (!state.finished && i === input.length) {
      span.classList.add("actual");
    }
  }
}

function isIgnorableKey(event) {
  const ignorable = new Set([
    "Shift",
    "Control",
    "Alt",
    "Meta",
    "CapsLock",
    "Tab",
    "Escape",
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "Home",
    "End",
    "PageUp",
    "PageDown",
  ]);
  return ignorable.has(event.key);
}

function keepCursorAtEnd() {
  const pos = elements.entrada.value.length;
  elements.entrada.setSelectionRange(pos, pos);
}

function getElapsedMs() {
  if (state.finished) return clampMin0(state.finalElapsedMs);
  if (!state.running || state.startPerfMs === null) return 0;
  return clampMin0(nowPerfMs() - state.startPerfMs);
}

function setModeUi() {
  const isTimed = state.mode === "timed";
  elements.duracion.disabled = !isTimed;

  const remainingContainer = elements.statTiempo?.closest(".stat");
  if (remainingContainer) {
    remainingContainer.hidden = !isTimed;
  }
}

function updateStats() {
  const input = elements.entrada.value;
  const { totalTyped, correct, errors } = calculateCounts(input);

  const elapsedMs = getElapsedMs();
  const elapsedMinutes = elapsedMs / 60000;
  const wpm = elapsedMinutes > 0 ? (correct / 5) / elapsedMinutes : 0;
  const accuracy = totalTyped > 0 ? (correct / totalTyped) * 100 : 0;

  const remainingMs = getRemainingMs(elapsedMs);
  if (state.mode === "timed" && remainingMs !== null) {
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    elements.statTiempo.textContent = `${remainingSeconds} s`;
  }

  elements.statTiempoEmpleado.textContent = formatElapsedMs(elapsedMs);
  elements.statWpm.textContent = `${formatInteger(wpm)} WPM`;
  elements.statPrecision.textContent = `${formatInteger(accuracy)} %`;
  elements.statErrores.textContent = String(errors);
}

function startRun() {
  if (state.running || state.finished) return;

  state.running = true;
  state.startPerfMs = nowPerfMs();
  state.startedAtEpochMs = Date.now();
  elements.mensaje.textContent = "";

  state.timerId = window.setInterval(() => {
    if (!state.running || state.finished) return;

    if (state.mode === "timed") {
      const elapsedMs = getElapsedMs();
      const remainingMs = getRemainingMs(elapsedMs);
      if (remainingMs !== null && remainingMs <= 0) {
        finishRun("timeout");
        return;
      }
    }

    updateStats();
  }, 100);
}

function buildResult(finalElapsedMs) {
  const input = elements.entrada.value;
  const { totalTyped, correct, errors } = calculateCounts(input);

  const elapsedMinutes = finalElapsedMs / 60000;
  const wpm = elapsedMinutes > 0 ? (correct / 5) / elapsedMinutes : 0;
  const accuracy = totalTyped > 0 ? (correct / totalTyped) * 100 : 0;

  return {
    mode: state.mode,
    level: state.level,
    durationSec: state.mode === "timed" ? state.durationSec : null,
    timeMs: Math.round(finalElapsedMs),
    wpm,
    accuracy,
    errors,
    finishedAtEpochMs: Date.now(),
  };
}

function finishRun(reason) {
  if (state.finished) return;

  const elapsedMsNow = clampMin0(getElapsedMs());
  const finalElapsedMs =
    state.mode === "timed" ? clampMin0(state.durationSec) * 1000 : clampMin0(elapsedMsNow);
  state.finalElapsedMs = finalElapsedMs;

  state.finished = true;
  state.running = false;

  if (state.timerId !== null) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }

  elements.entrada.disabled = true;
  updateHighlight(elements.entrada.value);

  updateStats();

  const result = buildResult(finalElapsedMs);
  const wpmText = `${formatInteger(result.wpm)} WPM`;
  const accuracyText = `${formatInteger(result.accuracy)} %`;
  const errorsText = `${result.errors} errores`;
  const timeText = formatElapsedMs(result.timeMs);

  if (state.mode === "race") {
    elements.mensaje.textContent =
      `Carrera finalizada en ${timeText}. Resultado: ${wpmText}, ${accuracyText} de precision, ${errorsText}.`;
  } else {
    elements.mensaje.textContent =
      `Tiempo finalizado. Resultado: ${wpmText}, ${accuracyText} de precision, ${errorsText}.`;
  }

  persistResult(result);
  renderLeaderboard();
  renderHistory();
  void reason;
}

function resetRunState() {
  if (state.timerId !== null) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }

  state.running = false;
  state.finished = false;
  state.startPerfMs = null;
  state.startedAtEpochMs = null;
  state.finalElapsedMs = 0;
}

function applyConfigFromControls() {
  const selectedMode = elements.modo.value;
  state.mode = selectedMode === "race" ? "race" : "timed";

  const selectedLevel = elements.nivel.value;
  state.level = selectedLevel === "L2" || selectedLevel === "L3" ? selectedLevel : "L1";

  const durationValue = Number.parseInt(elements.duracion.value, 10);
  state.durationSec = Number.isFinite(durationValue) ? durationValue : 60;

  setModeUi();
}

function newTest() {
  resetRunState();
  applyConfigFromControls();

  state.targetText = chooseRandomText(state.level);
  renderTargetText(state.targetText);

  elements.entrada.disabled = false;
  elements.entrada.value = "";
  elements.mensaje.textContent = "";

  updateHighlight("");

  if (state.mode === "timed") {
    elements.statTiempo.textContent = `${state.durationSec} s`;
  }

  elements.statTiempoEmpleado.textContent = "0.0 s";
  elements.statWpm.textContent = "0 WPM";
  elements.statPrecision.textContent = "0 %";
  elements.statErrores.textContent = "0";

  renderLeaderboard();
  renderHistory();

  window.setTimeout(() => {
    elements.entrada.focus({ preventScroll: true });
  }, 0);
}

function configureEvents() {
  elements.botonNuevo.addEventListener("click", () => {
    newTest();
  });

  elements.modo.addEventListener("change", () => {
    newTest();
  });

  elements.nivel.addEventListener("change", () => {
    newTest();
  });

  elements.duracion.addEventListener("change", () => {
    newTest();
  });

  elements.entrada.addEventListener("keydown", (event) => {
    if (state.finished) return;

    if (event.key === "Enter") {
      event.preventDefault();
      return;
    }

    if (!state.running && !isIgnorableKey(event)) {
      startRun();
    }

    const blocked = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]);
    if (blocked.has(event.key)) {
      event.preventDefault();
      keepCursorAtEnd();
    }
  });

  elements.entrada.addEventListener("input", () => {
    if (state.finished) return;

    keepCursorAtEnd();
    updateHighlight(elements.entrada.value);

    if (!state.running && elements.entrada.value.length > 0) {
      startRun();
    }

    updateStats();

    if (state.mode === "race" && state.running) {
      if (elements.entrada.value.length >= state.targetText.length) {
        finishRun("completed");
      }
    }
  });

  elements.entrada.addEventListener("click", () => {
    keepCursorAtEnd();
  });
}

configureEvents();
newTest();
