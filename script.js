(function () {
  "use strict";

  // ---------- swara frequencies (one octave, C4-based) ----------
  var SWARA_BASE_FREQ = {
    Sa: 261.63,
    Ri: 293.66,
    Ga: 329.63,
    Ma: 349.23,
    Pa: 392.0,
    Dha: 440.0,
    Ni: 493.88,
  };
  var SWARA_NAMES = Object.keys(SWARA_BASE_FREQ);

  // ---------- operator themes ----------
  var THEMES = [
    { key: "plus", symbol: "+" },
    { key: "minus", symbol: "\u2212" },
    { key: "times", symbol: "\u00D7" },
    { key: "divide", symbol: "\u00F7" },
  ];

  // ---------- tunables ----------
  var MATCH_TOLERANCE_CENTS = 45; // how close (in cents) counts as "in tune"
  var HOLD_TIME_MS = 550; // how long you must hold the correct pitch
  var VOLUME_THRESHOLD = 0.02; // RMS gate so silence doesn't register
  var LEVEL_STEP_SEMITONES = 4; // how much the target rises each level

  // ---------- DOM ----------
  var consoleEl = document.getElementById("console");
  var opButton = document.getElementById("opButton");
  var num1El = document.getElementById("num1");
  var num2El = document.getElementById("num2");
  var calculateButton = document.getElementById("calculateButton");
  var errorEl = document.getElementById("consoleError");

  var gameEl = document.getElementById("game");
  var levelBadge = document.getElementById("levelBadge");
  var meterFill = document.getElementById("meterFill");
  var targetLine = document.getElementById("targetLine");
  var stageEl = document.getElementById("stage");
  var equationLine = document.getElementById("equationLine");
  var answerLine = document.getElementById("answerLine");
  var resetButton = document.getElementById("resetButton");

  // ---------- operator state ----------
  var themeIndex = 0;

  function paintTheme() {
    consoleEl.setAttribute("data-theme", THEMES[themeIndex].key);
    opButton.textContent = THEMES[themeIndex].symbol;
  }
  paintTheme();

  opButton.addEventListener("click", function () {
    themeIndex = (themeIndex + 1) % THEMES.length;
    paintTheme();
  });

  // ---------- calculate ----------
  function computeResult(a, b, symbol) {
    switch (symbol) {
      case "+":
        return a + b;
      case "\u2212":
        return a - b;
      case "\u00D7":
        return a * b;
      case "\u00F7":
        return b === 0 ? a : Math.round((a / b) * 100) / 100;
      default:
        return NaN;
    }
  }

  calculateButton.addEventListener("click", function () {
    var a = parseFloat(num1El.value);
    var b = parseFloat(num2El.value);
    errorEl.hidden = true;

    if (isNaN(a) || isNaN(b)) {
      errorEl.textContent = "Enter both operands first";
      errorEl.hidden = false;
      return;
    }

    startRound(a, b, THEMES[themeIndex].symbol);
  });

  // ---------- microphone / pitch detection ----------
  var audioContext = null;
  var analyser = null;
  var micStream = null;
  var timeDomainData = null;

  function ensureMic() {
    if (audioContext) return Promise.resolve();

    return navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(function (stream) {
        micStream = stream;
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        timeDomainData = new Float32Array(analyser.fftSize);

        var source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
      });
  }

  // Autocorrelation-based pitch detector.
  // Returns detected frequency in Hz, or -1 if no clear pitch found.
  function detectPitch(buffer, sampleRate) {
    var SIZE = buffer.length;
    var rms = 0;
    for (var i = 0; i < SIZE; i++) {
      var val = buffer[i];
      rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);
    if (rms < VOLUME_THRESHOLD) return { freq: -1, rms: rms };

    // Trim silence from the edges to focus the autocorrelation window.
    var r1 = 0,
      r2 = SIZE - 1,
      threshold = 0.2;
    for (var a = 0; a < SIZE / 2; a++) {
      if (Math.abs(buffer[a]) > threshold) {
        r1 = a;
        break;
      }
    }
    for (var b2 = SIZE - 1; b2 > SIZE / 2; b2--) {
      if (Math.abs(buffer[b2]) > threshold) {
        r2 = b2;
        break;
      }
    }
    var trimmed = buffer.slice(r1, r2);
    var trimmedSize = trimmed.length;
    if (trimmedSize < 2) return { freq: -1, rms: rms };

    var c = new Array(trimmedSize).fill(0);
    for (var lag = 0; lag < trimmedSize; lag++) {
      for (var j = 0; j < trimmedSize - lag; j++) {
        c[lag] += trimmed[j] * trimmed[j + lag];
      }
    }

    var d = 0;
    while (d < c.length - 1 && c[d] > c[d + 1]) d++;

    var maxVal = -1,
      maxPos = -1;
    for (var k = d; k < c.length; k++) {
      if (c[k] > maxVal) {
        maxVal = c[k];
        maxPos = k;
      }
    }
    if (maxPos <= 0) return { freq: -1, rms: rms };

    var t0 = maxPos;
    var x1 = c[t0 - 1] || 0,
      x2 = c[t0] || 0,
      x3 = c[t0 + 1] || 0;
    var a2 = (x1 + x3 - 2 * x2) / 2;
    var b3 = (x3 - x1) / 2;
    if (a2 !== 0) t0 = t0 - b3 / (2 * a2);

    var freq = sampleRate / t0;
    return { freq: freq, rms: rms };
  }

  function centsBetween(freqA, freqB) {
    return 1200 * Math.log2(freqA / freqB);
  }

  // ---------- sing round ----------
  function startRound(a, b, opSymbol) {
    var steps = [
      { label: "operand 1", swara: randomSwara(), reveal: a, level: 0 },
      { label: "operator", swara: randomSwara(), reveal: opSymbol, level: 1 },
      { label: "operand 2", swara: randomSwara(), reveal: b, level: 2 },
    ];

    equationLine.textContent = "";
    answerLine.textContent = "";
    resetButton.hidden = true;
    gameEl.hidden = false;
    gameEl.scrollIntoView({ behavior: "smooth", block: "center" });

    var current = 0;
    var rafId = null;
    var matchStart = null;

    function targetFreqFor(step) {
      var base = SWARA_BASE_FREQ[step.swara];
      return base * Math.pow(2, (step.level * LEVEL_STEP_SEMITONES) / 12);
    }

    function stopListening() {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
      matchStart = null;
    }

    function renderStep() {
      stopListening();
      levelBadge.textContent = "LEVEL " + (current + 1) + " / 3";

      var step = steps[current];
      var targetFreq = targetFreqFor(step);

      // Visualise the target position on a fixed 200-650 Hz display range.
      var pct = ((targetFreq - 200) / (650 - 200)) * 100;
      targetLine.style.left = Math.max(4, Math.min(96, pct)) + "%";
      meterFill.style.width = "0%";

      stageEl.innerHTML = "";
      var wrap = document.createElement("div");
      wrap.className = "step-fade-in";
      wrap.style.display = "flex";
      wrap.style.flexDirection = "column";
      wrap.style.alignItems = "center";
      wrap.style.gap = "8px";

      var circle = document.createElement("button");
      circle.type = "button";
      circle.className = "swara-circle";
      circle.textContent = step.swara;

      var subLabel = document.createElement("span");
      subLabel.className = "step-label";
      subLabel.textContent = "tap, then sing for " + step.label;

      circle.addEventListener("click", function () {
        if (circle.classList.contains("solved")) return;
        circle.disabled = true;
        circle.classList.add("listening");
        subLabel.textContent = "listening\u2026";

        ensureMic()
          .then(function () {
            listenForMatch(targetFreq, circle, subLabel, step, function () {
              onStepSolved(step, circle, subLabel);
            });
          })
          .catch(function () {
            subLabel.textContent = "microphone access is needed to sing";
            circle.disabled = false;
            circle.classList.remove("listening");
          });
      });

      wrap.appendChild(circle);
      wrap.appendChild(subLabel);
      stageEl.appendChild(wrap);
    }

    function listenForMatch(targetFreq, circle, subLabel, step, onSolved) {
      matchStart = null;

      function frame() {
        analyser.getFloatTimeDomainData(timeDomainData);
        var result = detectPitch(timeDomainData, audioContext.sampleRate);

        if (result.freq > 0) {
          var cents = centsBetween(result.freq, targetFreq);
          var closeness = Math.max(0, 1 - Math.abs(cents) / (MATCH_TOLERANCE_CENTS * 3));
          meterFill.style.width = Math.round(closeness * 100) + "%";

          if (Math.abs(cents) <= MATCH_TOLERANCE_CENTS) {
            if (matchStart === null) matchStart = performance.now();
            if (performance.now() - matchStart >= HOLD_TIME_MS) {
              stopListening();
              onSolved();
              return;
            }
          } else {
            matchStart = null;
          }
        } else {
          matchStart = null;
          meterFill.style.width = "0%";
        }

        rafId = requestAnimationFrame(frame);
      }
      rafId = requestAnimationFrame(frame);
    }

    function onStepSolved(step, circle, subLabel) {
      circle.classList.remove("listening");
      circle.classList.add("solved");
      subLabel.textContent = step.label + " = " + step.reveal;
      subLabel.classList.add("solved");
      meterFill.style.width = "100%";

      setTimeout(function () {
        current++;
        if (current < steps.length) {
          renderStep();
        } else {
          equationLine.textContent = a + " " + opSymbol + " " + b;
          answerLine.textContent = "= " + computeResult(a, b, opSymbol);
          stageEl.innerHTML = "";
          resetButton.hidden = false;
        }
      }, 700);
    }

    renderStep();

    resetButton.onclick = function () {
      startRound(a, b, opSymbol);
    };
  }

  function randomSwara() {
    return SWARA_NAMES[Math.floor(Math.random() * SWARA_NAMES.length)];
  }
})();