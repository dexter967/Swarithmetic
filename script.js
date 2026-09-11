/* =====================================
   SWARITHMETIC — GAME LOGIC
   (mic listening, YIN pitch detection, level flow)
===================================== */

const opButton = document.getElementById("opButton");
const num1 = document.getElementById("num1");
const num2 = document.getElementById("num2");
const calculateButton = document.getElementById("calculateButton");
const errorMessage = document.getElementById("errorMessage");
const game = document.getElementById("game");
const level = document.getElementById("level");
const swaraButton = document.getElementById("swaraButton");
const stepLabel = document.getElementById("stepLabel");
const meterFill = document.getElementById("meterFill");
const targetLine = document.getElementById("targetLine");
const equation = document.getElementById("equation");
const answer = document.getElementById("answer");
const resetButton = document.getElementById("resetButton");

const sideMeterFill = document.getElementById("sideMeterFill");
const sideMeterTarget = document.getElementById("sideMeterTarget");
const pitchReadout = document.getElementById("pitchReadout");
const targetReadout = document.getElementById("targetReadout");
const holdReadout = document.getElementById("holdReadout");
const flightScene = document.getElementById("flightScene");
const barrierField = document.getElementById("barrierField");
const luttapi = document.getElementById("luttapi");
const flightStatus = document.getElementById("flightStatus");
const flightTrack = document.getElementById("flightTrack");
const resultDrop = document.getElementById("resultDrop");

/* =====================================
   TUNABLES & DETECTOR SETTINGS (CALIBRATED FOR MOBILE/LAPTOP MIC)
===================================== */

const MIN_RMS = 0.01; // Lowered to reliably pick up normal human voice levels
const YIN_THRESHOLD = 0.25; // Adjusted to allow standard singing voices without rejecting them

/* =====================================
   SWARA FREQUENCY POOL & DIFFICULTY PROFILES
===================================== */

const SWARA_POOL = [
  { name: "SA", targetFreq: 261.63 }, // Middle C (C4)
  { name: "RI", targetFreq: 293.66 }, // D4
  { name: "GA", targetFreq: 329.63 }, // E4
  { name: "MA", targetFreq: 349.23 }, // F4
  { name: "PA", targetFreq: 392.0 },  // G4
  { name: "DHA", targetFreq: 440.0 }, // A4
  { name: "NI", targetFreq: 493.88 }, // B4
  { name: "SA'", targetFreq: 523.25 }, // High C (C5)
];

// Dynamic Progression Configuration
const LEVEL_CONFIGS = [
  {
    stage: "Operand 1",
    toleranceCents: 110,
    holdTimeMs: 240,
    swaraPoolIndex: [0] // Level 1 is fixed to SA (Base Root Pitch)
  },
  {
    stage: "Operator",
    toleranceCents: 115,
    holdTimeMs: 300,
    swaraPoolIndex: [1, 2, 3, 4] // Mid-register Swaras (RI to PA)
  },
  {
    stage: "Operand 2",
    toleranceCents: 105,
    holdTimeMs: 360,
    swaraPoolIndex: [3, 4, 5, 6, 7] // Advanced Swaras including high SA'
  }
];

let activeSwarasSequence = [];
let currentLevel = 0;
let flightY = 88;
let flightActive = false;

const BARRIER_COUNT = 3;
const FLIGHT_TARGETS = [78, 50, 24];
let courseShift = 0;

/* =====================================
   MICROPHONE & AUDIO ANALYSIS STATE
===================================== */

let audioContext = null;
let analyser = null;
let microphone = null;
let audioData = null;
let microphoneStream = null;
let listenLoopId = null;
let matchStartTime = null;
let visualPitchHz = 0;

const PITCH_METER_MAX_HZ = 1000;

/* =====================================
   OPERATORS & THEMES
===================================== */

const operators = [
  { symbol: "+", theme: "plus", buttonColor: "#6b3fd4" },       // violet
  { symbol: "\u2212", theme: "minus", buttonColor: "#12b3a8" }, // teal
  { symbol: "\u00D7", theme: "times", buttonColor: "#d63a86" }, // magenta
  { symbol: "\u00F7", theme: "divide", buttonColor: "#c8a46a" },// gold
];

let operatorIndex = 0;

/* =====================================
   THEME SWITCHING
   Only the accent color changes with the operator — the rest of the
   calculator shares the landing page's ink/white palette so the two
   pages read as one site instead of two clashing color schemes.
===================================== */

function applyTheme(operator) {
  document.body.dataset.theme = operator.theme;
  document.body.style.setProperty("--button-color", operator.buttonColor);
}

applyTheme(operators[operatorIndex]);

if (opButton) {
  opButton.addEventListener("click", function () {
    operatorIndex = (operatorIndex + 1) % operators.length;
    const currentOperator = operators[operatorIndex];
    opButton.textContent = currentOperator.symbol;
    applyTheme(currentOperator);
  });
}

/* =====================================
   MICROPHONE SETUP
===================================== */

async function startMicrophone() {
  if (audioContext) return true;

  try {
    microphoneStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioCtx();
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    microphone = audioContext.createMediaStreamSource(microphoneStream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    audioData = new Float32Array(analyser.fftSize);
    microphone.connect(analyser);

    return true;
  } catch (err) {
    console.error("Microphone access failed:", err);
    showError(
      "Could not connect to microphone. Check permissions and try again.",
    );
    return false;
  }
}

/* =====================================
   PITCH DETECTION (YIN Algorithm)
===================================== */

function detectPitchYin(buffer, sampleRate) {
  const SIZE = buffer.length;
  const HALF_SIZE = Math.floor(SIZE / 2);

  // 1. RMS Loudness Check
  let sumOfSquares = 0;
  for (let i = 0; i < SIZE; i++) {
    sumOfSquares += buffer[i] * buffer[i];
  }
  const rms = Math.sqrt(sumOfSquares / SIZE);

  if (rms < MIN_RMS) {
    return { freq: -1, probability: 0 };
  }

  // 2. Difference Function
  const yinBuffer = new Float32Array(HALF_SIZE);
  for (let t = 0; t < HALF_SIZE; t++) {
    for (let i = 0; i < HALF_SIZE; i++) {
      const delta = buffer[i] - buffer[i + t];
      yinBuffer[t] += delta * delta;
    }
  }

  // 3. Cumulative Mean Normalized Difference
  yinBuffer[0] = 1;
  let runningSum = 0;
  for (let t = 1; t < HALF_SIZE; t++) {
    runningSum += yinBuffer[t];
    yinBuffer[t] *= t / runningSum;
  }

  // 4. Absolute Threshold Check
  let tau = -1;
  for (let t = 2; t < HALF_SIZE; t++) {
    if (yinBuffer[t] < YIN_THRESHOLD) {
      while (t + 1 < HALF_SIZE && yinBuffer[t + 1] < yinBuffer[t]) {
        t++;
      }
      tau = t;
      break;
    }
  }

  if (tau === -1 || yinBuffer[tau] >= YIN_THRESHOLD) {
    return { freq: -1, probability: 0 };
  }

  // 5. Parabolic Interpolation
  let betterTau;
  const x0 = tau < 1 ? tau : tau - 1;
  const x2 = tau + 1 < HALF_SIZE ? tau + 1 : tau;

  if (x0 === tau) {
    betterTau = yinBuffer[tau] <= yinBuffer[x2] ? tau : x2;
  } else if (x2 === tau) {
    betterTau = yinBuffer[tau] <= yinBuffer[x0] ? tau : x0;
  } else {
    const s0 = yinBuffer[x0];
    const s1 = yinBuffer[tau];
    const s2 = yinBuffer[x2];
    betterTau = tau + (s2 - s0) / (2 * (2 * s1 - s2 - s0));
  }

  const pitchHz = sampleRate / betterTau;
  const probability = 1 - yinBuffer[tau];

  return { freq: pitchHz, probability: probability };
}

/* =====================================
   OCTAVE-NEUTRAL PITCH DISTANCE (Cents)
===================================== */

function centsBetween(freqA, freqB) {
  if (freqA <= 0 || freqB <= 0) return Infinity;
  return 1200 * Math.log2(freqA / freqB);
}

/* =====================================
   LISTEN LOOP & MATCHING PROCESS
===================================== */

function startListening(targetSwara, onSolved) {
  matchStartTime = null;
  visualPitchHz = 0;

  const tolerance = targetSwara.toleranceCents;
  const holdTime = targetSwara.holdTimeMs;
  const targetFreq = targetSwara.targetFreq;

  function frame() {
    if (!analyser || !audioContext) return;

    analyser.getFloatTimeDomainData(audioData);
    const result = detectPitchYin(audioData, audioContext.sampleRate);

    if (result.freq > 0) {
      visualPitchHz += (result.freq - visualPitchHz) * 0.12;
    } else {
      visualPitchHz *= 0.9;
    }
    updateSideMeter(visualPitchHz, targetFreq, tolerance);

    if (result.freq > 0 && visualPitchHz > 0) {
      const cents = centsBetween(visualPitchHz, targetFreq);
      const absCents = Math.abs(cents);
      const isCorrectSwara = absCents <= tolerance;
      if (flightActive && activeSwarasSequence[currentLevel]) {
        const targetY = activeSwarasSequence[currentLevel].targetY;
        const pitchOffset = Math.max(-20, Math.min(20, cents / 5));
        const pitchY = targetY - pitchOffset;
        updateCurrentGap(pitchY);
        updateLuttapi(pitchY);
      }

      // Update closeness progress bar smoothly across range
      const closeness = Math.max(0, 1 - absCents / (tolerance * 2.0));
      if (meterFill) meterFill.style.width = Math.round(closeness * 100) + "%";

      if (isCorrectSwara) {
        if (matchStartTime === null) matchStartTime = performance.now();
        const held = performance.now() - matchStartTime;

        if (holdReadout) {
          holdReadout.textContent =
            "holding " +
            Math.min(holdTime, Math.round(held)) +
            " / " +
            holdTime +
            " ms";
        }

        if (held >= holdTime) {
          stopListening();
          onSolved();
          return;
        }
      } else {
        matchStartTime = null;
        if (holdReadout) holdReadout.textContent = "Adjust pitch";
      }
    } else {
      matchStartTime = null;
      if (meterFill) meterFill.style.width = "0%";
      if (holdReadout) holdReadout.textContent = "";
    }

    listenLoopId = requestAnimationFrame(frame);
  }

  listenLoopId = requestAnimationFrame(frame);
}

function stopListening() {
  if (listenLoopId) cancelAnimationFrame(listenLoopId);
  listenLoopId = null;
  matchStartTime = null;
  if (holdReadout) holdReadout.textContent = "";
}

function updateSideMeter(freq, targetFreq, tolerance) {
  if (!sideMeterFill || !sideMeterTarget) return;

  // Keep every level on the same predictable 0-1000 Hz scale.
  const targetPct = clampPct((targetFreq / PITCH_METER_MAX_HZ) * 100);
  sideMeterTarget.style.top = (100 - targetPct) + "%";

  if (targetReadout) {
    targetReadout.textContent = "target ~" + Math.round(targetFreq) + " Hz";
  }

  if (freq > 0) {
    const cents = centsBetween(freq, targetFreq);
    const pct = clampPct((freq / PITCH_METER_MAX_HZ) * 100);
    sideMeterFill.style.transform = "scaleY(" + pct / 100 + ")";

    if (pitchReadout) pitchReadout.textContent = Math.round(freq) + " Hz";

    const inTarget = Math.abs(cents) <= tolerance;
    sideMeterTarget.classList.toggle("matched", inTarget);
    sideMeterFill.style.background = inTarget ? "#97C459" : "var(--button-color)";
  } else {
    sideMeterFill.style.transform = "scaleY(0)";
    sideMeterFill.style.background = "var(--button-color)";
    sideMeterTarget.classList.remove("matched");
    if (pitchReadout) pitchReadout.textContent = "-- Hz";
  }
}

function clampPct(v) {
  return Math.max(0, Math.min(100, v));
}

/* =====================================
   PROGRESSIVE SEQUENCE GENERATOR
===================================== */

function generateProgressiveSequence() {
  const sequence = [];

  for (let i = 0; i < BARRIER_COUNT; i++) {
    const config = LEVEL_CONFIGS[Math.min(i, LEVEL_CONFIGS.length - 1)];
    const allowedIndices = config.swaraPoolIndex;

    const selectedIndex =
      allowedIndices[Math.floor(Math.random() * allowedIndices.length)];
    const swaraItem = SWARA_POOL[selectedIndex];

    sequence.push({
      stage: config.stage,
      name: swaraItem.name,
      targetFreq: swaraItem.targetFreq,
      toleranceCents: config.toleranceCents,
      holdTimeMs: config.holdTimeMs,
      targetY: FLIGHT_TARGETS[i],
    });
  }

  return sequence;
}

function renderBarriers() {
  if (!barrierField) return;
  barrierField.textContent = "";
  activeSwarasSequence.forEach(function (swara, index) {
    const barrier = document.createElement("div");
    barrier.className = "barrier";
    barrier.style.setProperty("--barrier-index", index);
    barrier.style.setProperty("--gap-y", swara.targetY + "%");
    barrier.innerHTML =
      '<div class="barrier-top"><span>' + swara.name + "</span></div>" +
      '<div class="barrier-bottom"></div>' +
      '<div class="barrier-number">' + (index + 1) + "</div>";
    barrierField.appendChild(barrier);
  });
}

function scrollCourse() {
  courseShift += 1;
  if (barrierField) {
    barrierField.style.transform = "translate3d(-" + courseShift * 32 + "%, 0, 0)";
  }
}

function updateLuttapi(y) {
  flightY = Math.max(12, Math.min(88, y));
  if (luttapi) luttapi.style.top = flightY + "%";
}

function updateCurrentGap(y) {
  const currentBarrier = barrierField && barrierField.children[currentLevel];
  if (currentBarrier) currentBarrier.style.setProperty("--gap-y", Math.max(14, Math.min(86, y)) + "%");
}

function moveLuttapiToNextBarrier(targetY, done) {
  const start = flightY;
  const finish = targetY;
  const started = performance.now();
  const duration = 700;

  function animate(now) {
    const progress = Math.min(1, (now - started) / duration);
    updateLuttapi(start + (finish - start) * (1 - Math.pow(1 - progress, 3)));
    if (progress < 1) requestAnimationFrame(animate);
    else done();
  }
  requestAnimationFrame(animate);
}

/* =====================================
   GAME FLOW
===================================== */

if (calculateButton) {
  calculateButton.addEventListener("click", startGame);
}

async function startGame() {
  clearError();

  const a = Number(num1.value);
  const b = Number(num2.value);

  if (num1.value === "" || num2.value === "") {
    showError("Enter both numbers first.");
    return;
  }
  if (a < 0 || a > 999 || b < 0 || b > 999) {
    showError("Numbers must be between 0 and 999.");
    return;
  }
  if (operatorIndex === 3 && b === 0) {
    showError("Cannot divide by zero.");
    return;
  }

  const micReady = await startMicrophone();
  if (!micReady) return;

  activeSwarasSequence = generateProgressiveSequence();

  if (game) game.hidden = false;
  const gameWrapper = document.getElementById("game-wrapper");
  if (gameWrapper) gameWrapper.classList.add("game-started");
  currentLevel = 0;
  courseShift = 0;
  flightActive = true;
  if (barrierField) barrierField.style.transform = "translateX(0)";
  if (luttapi) luttapi.style.left = "20%";
  updateLuttapi(88);
  renderBarriers();
  prepareLevel();

  setTimeout(function () {
    if (game) game.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 100);
}

function prepareLevel() {
  const currentSwara = activeSwarasSequence[currentLevel];

  if (level) {
    level.textContent =
      "WALL " +
      (currentLevel + 1) +
      " / " +
      BARRIER_COUNT +
      ": " +
      currentSwara.stage.toUpperCase();
  }
  if (swaraButton) {
    swaraButton.textContent = currentSwara.name;
    swaraButton.classList.remove("solved", "listening");
    swaraButton.disabled = false;
  }

  if (stepLabel) {
    stepLabel.textContent =
      "Sing " +
      currentSwara.name +
      " (~" +
      Math.round(currentSwara.targetFreq) +
      " Hz)";
    stepLabel.classList.remove("solved");
  }
  if (flightStatus) {
    flightStatus.textContent =
      "Match the pitch to wall " + (currentLevel + 1) + " to fly through its gap.";
  }
  if (flightScene) flightScene.dataset.level = String(currentLevel);
  updateCurrentGap(currentSwara.targetY);

  if (meterFill) meterFill.style.width = "0%";
  if (targetLine) targetLine.style.left = "50%";

  if (equation) equation.textContent = "";
  if (answer) answer.textContent = "";
  if (resetButton) resetButton.hidden = true;

  updateSideMeter(-1, currentSwara.targetFreq, currentSwara.toleranceCents);
}

if (swaraButton) {
  swaraButton.addEventListener("click", function () {
    if (swaraButton.classList.contains("solved")) return;
    swaraButton.disabled = true;
    swaraButton.classList.add("listening");

    const currentSwara = activeSwarasSequence[currentLevel];
    startListening(currentSwara, function () {
      solveSwara();
    });
  });
}

function solveSwara() {
  const solvedTarget = activeSwarasSequence[currentLevel].targetY;
  if (swaraButton) {
    swaraButton.classList.remove("listening");
    swaraButton.classList.add("solved");
    swaraButton.textContent = "\u2713";
  }

  if (stepLabel) {
    stepLabel.classList.add("solved");
    stepLabel.textContent =
      activeSwarasSequence[currentLevel].name + " HARMONIZED!";
  }
  if (meterFill) meterFill.style.width = "100%";
  if (flightStatus) flightStatus.textContent = "Pitch matched! Luttapi is crossing the wall...";

  setTimeout(function () {
    currentLevel++;
    if (currentLevel < activeSwarasSequence.length) {
      scrollCourse();
      moveLuttapiToNextBarrier(activeSwarasSequence[currentLevel].targetY, prepareLevel);
    } else {
      showResult();
    }
  }, 900);
}

function showResult() {
  const a = Number(num1.value);
  const b = Number(num2.value);
  const symbol = operators[operatorIndex].symbol;

  let result;
  switch (operatorIndex) {
    case 0:
      result = a + b;
      break;
    case 1:
      result = a - b;
      break;
    case 2:
      result = a * b;
      break;
    case 3:
      result = a / b;
      break;
  }

  if (equation) equation.textContent = a + " " + symbol + " " + b;
  if (answer) answer.textContent = "= " + formatResult(result);
  if (level) level.textContent = "HARMONY COMPLETE!";
  if (stepLabel) {
    stepLabel.textContent = "CALCULATED WITH MUSIC!";
    stepLabel.classList.add("solved");
  }
  flightActive = false;
  if (luttapi) luttapi.style.left = "86%";
  updateLuttapi(24);
  if (flightStatus) flightStatus.textContent = "All barriers crossed — Luttapi reached the finish!";
  if (flightScene) flightScene.classList.add("finished");
  if (resetButton) resetButton.hidden = false;
  setTimeout(function () {
    if (!resultDrop) return;
    resultDrop.hidden = false;
    resultDrop.textContent = "= " + formatResult(result);
    resultDrop.classList.remove("drop-result");
    void resultDrop.offsetWidth;
    resultDrop.classList.add("drop-result");
  }, 850);
}

function formatResult(value) {
  return Number.isInteger(value) ? value : value.toFixed(2);
}

if (resetButton) {
  resetButton.addEventListener("click", function () {
    stopListening();
    flightActive = false;
    if (game) game.hidden = true;
    const gameWrapper = document.getElementById("game-wrapper");
    if (gameWrapper) gameWrapper.classList.remove("game-started");
    currentLevel = 0;
    if (meterFill) meterFill.style.width = "0%";
    if (equation) equation.textContent = "";
    if (answer) answer.textContent = "";
    if (flightScene) flightScene.classList.remove("finished");
    if (resultDrop) {
      resultDrop.hidden = true;
      resultDrop.classList.remove("drop-result");
    }
    if (barrierField) barrierField.style.transform = "translateX(0)";
    clearError();
    if (game) game.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function showError(message) {
  if (errorMessage) errorMessage.textContent = message;
}

function clearError() {
  if (errorMessage) errorMessage.textContent = "";
}

/* =====================================
   PLAYFUL LANDING-PAGE ORCHESTRA
===================================== */

const landingSymbols = [
  "♩", "♪", "♫", "♬", "𝄞", "𝄢", "♭", "♯", "𝄐", "∑", "÷", "×", "+", "−", "=",
  "🎵", "🎶", "🎤", "🎧", "🎷", "🎺", "🎸", "🥁", "🎹", "🪕", "✦", "✧"
];
const landingFloaters = document.getElementById("floaters");

if (landingFloaters && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < 54; i++) {
    const symbol = document.createElement("span");
    symbol.className = "float-sym";
    symbol.textContent = landingSymbols[Math.floor(Math.random() * landingSymbols.length)];
    symbol.style.left = Math.random() * 96 + "%";
    symbol.style.top = 8 + Math.random() * 88 + "%";
    symbol.style.fontSize = 16 + Math.random() * 30 + "px";
    symbol.style.setProperty("--dur", 11 + Math.random() * 15 + "s");
    symbol.style.setProperty("--delay", -Math.random() * 18 + "s");
    symbol.style.setProperty("--rot", (Math.random() - 0.5) * 40 + "deg");
    symbol.style.setProperty("--drift", (Math.random() - 0.5) * 90 + "px");
    symbol.style.setProperty("--op", (0.12 + Math.random() * 0.16).toFixed(2));
    fragment.appendChild(symbol);
  }
  landingFloaters.replaceChildren(fragment);
}
