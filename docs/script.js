"use strict";

// Textos en español para el test (temas: tecnología, deporte, programación y DAW).
const TEXTOS = [
  "En DAW aprendemos a construir aplicaciones web con HTML, CSS y JavaScript, cuidando la accesibilidad y el rendimiento.",
  "Una buena API REST define rutas claras, valida los datos de entrada y devuelve códigos de estado coherentes.",
  "El fútbol se decide en detalles: una presión alta, una buena transición y un pase preciso pueden cambiar el partido.",
  "Programar es resolver problemas: dividir en partes pequeñas, probar a menudo y mejorar el código con calma.",
  "Si optimizas una web, empieza por medir: reduce imágenes, evita renderizados innecesarios y usa caché cuando tenga sentido.",
  "En un equipo de desarrollo, comunicar bien los cambios y revisar pull requests evita errores y ahorra tiempo.",
  "La base de datos debe estar normalizada, pero también diseñada pensando en consultas reales y en índices adecuados.",
  "En el gimnasio, la constancia gana: técnica correcta, progresión gradual y descanso suficiente para recuperarse.",
  "Una interfaz minimalista prioriza la lectura: buen contraste, tipografía clara y espacios bien definidos.",
  "Cuando depuras un bug, reproduce el problema, aísla la causa y verifica el arreglo con un caso sencillo.",
];

const elementos = {
  texto: document.getElementById("textoObjetivo"),
  entrada: document.getElementById("entradaUsuario"),
  duracion: document.getElementById("duracion"),
  botonNuevo: document.getElementById("nuevoTest"),
  mensaje: document.getElementById("mensaje"),
  statTiempo: document.getElementById("statTiempo"),
  statWpm: document.getElementById("statWpm"),
  statPrecision: document.getElementById("statPrecision"),
  statErrores: document.getElementById("statErrores"),
};

let textoActual = "";
let duracionTotal = 60;
let inicioMs = null;
let intervaloId = null;
let enMarcha = false;
let finalizado = false;
let spans = [];

function elegirTextoAleatorio() {
  const indice = Math.floor(Math.random() * TEXTOS.length);
  return TEXTOS[indice];
}

function renderizarTexto(texto) {
  elementos.texto.innerHTML = "";
  spans = [];

  const fragmento = document.createDocumentFragment();
  for (const caracter of texto) {
    const span = document.createElement("span");
    span.className = "char";
    span.textContent = caracter;
    spans.push(span);
    fragmento.appendChild(span);
  }
  elementos.texto.appendChild(fragmento);
}

function calcularConteos(entrada) {
  let correctos = 0;
  let incorrectos = 0;

  for (let i = 0; i < entrada.length; i++) {
    if (i < textoActual.length && entrada[i] === textoActual[i]) {
      correctos++;
    } else {
      incorrectos++;
    }
  }

  return { total: entrada.length, correctos, incorrectos };
}

function actualizarResaltado(entrada) {
  for (let i = 0; i < spans.length; i++) {
    const span = spans[i];
    span.classList.remove("correcto", "incorrecto", "actual");

    if (i < entrada.length) {
      if (entrada[i] === textoActual[i]) {
        span.classList.add("correcto");
      } else {
        span.classList.add("incorrecto");
      }
      continue;
    }

    if (!finalizado && i === entrada.length) {
      span.classList.add("actual");
    }
  }
}

function segundosTranscurridos() {
  if (!inicioMs) return 0;
  return Math.floor((Date.now() - inicioMs) / 1000);
}

function tiempoRestante() {
  const transcurridos = segundosTranscurridos();
  return Math.max(0, duracionTotal - transcurridos);
}

function formatearEntero(valor) {
  return String(Math.max(0, Math.round(valor)));
}

function actualizarEstadisticas() {
  const entrada = elementos.entrada.value;
  const { total, correctos, incorrectos } = calcularConteos(entrada);

  const transcurridos = enMarcha ? segundosTranscurridos() : 0;
  const restante = finalizado ? 0 : Math.max(0, duracionTotal - transcurridos);

  elementos.statTiempo.textContent = `${restante} s`;

  const minutos = transcurridos / 60;
  const wpm = minutos > 0 ? (correctos / 5) / minutos : 0;
  elementos.statWpm.textContent = `${formatearEntero(wpm)} WPM`;

  const precision = total > 0 ? (correctos / total) * 100 : 0;
  elementos.statPrecision.textContent = `${formatearEntero(precision)} %`;

  elementos.statErrores.textContent = String(incorrectos);

  if (enMarcha && restante === 0) {
    finalizarTest();
  }
}

function esTeclaIgnorable(evento) {
  const ignorables = new Set([
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
  return ignorables.has(evento.key);
}

function mantenerCursorAlFinal() {
  const pos = elementos.entrada.value.length;
  elementos.entrada.setSelectionRange(pos, pos);
}

function iniciarTemporizador() {
  if (enMarcha || finalizado) return;

  enMarcha = true;
  inicioMs = Date.now();
  elementos.mensaje.textContent = "";

  intervaloId = window.setInterval(() => {
    if (finalizado) return;
    actualizarEstadisticas();
  }, 120);
}

function finalizarTest() {
  if (finalizado) return;

  finalizado = true;
  enMarcha = false;

  if (intervaloId !== null) {
    window.clearInterval(intervaloId);
    intervaloId = null;
  }

  elementos.entrada.disabled = true;

  const entrada = elementos.entrada.value;
  const { total, correctos, incorrectos } = calcularConteos(entrada);

  const minutos = duracionTotal / 60;
  const wpmFinal = minutos > 0 ? (correctos / 5) / minutos : 0;
  const precisionFinal = total > 0 ? (correctos / total) * 100 : 0;

  elementos.statTiempo.textContent = "0 s";
  elementos.statWpm.textContent = `${formatearEntero(wpmFinal)} WPM`;
  elementos.statPrecision.textContent = `${formatearEntero(precisionFinal)} %`;
  elementos.statErrores.textContent = String(incorrectos);

  actualizarResaltado(entrada);

  elementos.mensaje.textContent =
    `Tiempo finalizado. Resultado del test: ${formatearEntero(wpmFinal)} WPM, ` +
    `${formatearEntero(precisionFinal)} % de precisión, ${incorrectos} errores.`;
}

function nuevoTest() {
  if (intervaloId !== null) {
    window.clearInterval(intervaloId);
    intervaloId = null;
  }

  enMarcha = false;
  finalizado = false;
  inicioMs = null;

  const duracionElegida = Number.parseInt(elementos.duracion.value, 10);
  duracionTotal = Number.isFinite(duracionElegida) ? duracionElegida : 60;

  textoActual = elegirTextoAleatorio();
  renderizarTexto(textoActual);

  elementos.entrada.disabled = false;
  elementos.entrada.value = "";
  elementos.mensaje.textContent = "";

  actualizarResaltado("");

  elementos.statTiempo.textContent = `${duracionTotal} s`;
  elementos.statWpm.textContent = "0 WPM";
  elementos.statPrecision.textContent = "0 %";
  elementos.statErrores.textContent = "0";

  window.setTimeout(() => {
    elementos.entrada.focus({ preventScroll: true });
  }, 0);
}

function configurarEventos() {
  elementos.botonNuevo.addEventListener("click", () => {
    nuevoTest();
  });

  elementos.entrada.addEventListener("keydown", (evento) => {
    if (finalizado) return;

    if (evento.key === "Enter") {
      evento.preventDefault();
      return;
    }

    if (!enMarcha && !esTeclaIgnorable(evento)) {
      iniciarTemporizador();
    }

    const bloqueadas = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"]);
    if (bloqueadas.has(evento.key)) {
      evento.preventDefault();
      mantenerCursorAlFinal();
    }
  });

  elementos.entrada.addEventListener("input", () => {
    if (finalizado) return;
    mantenerCursorAlFinal();
    actualizarResaltado(elementos.entrada.value);
    actualizarEstadisticas();
  });

  elementos.entrada.addEventListener("click", () => {
    mantenerCursorAlFinal();
  });
}

configurarEventos();
nuevoTest();

