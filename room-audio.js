/*
 * Original room ambience for the Chelsea-blue engineering office.
 * Musical sketch: 84 BPM, B minor / D major color, Bm9–Gmaj7–Dadd9–Aadd9.
 * Soft triangle/saw pads, a quiet sine sub-bass, and sparse glassy chimes.
 * No external samples, libraries, or autoplay.
 */
(function () {
  "use strict";

  if (window.RoomMusic) return;

  var context = null;
  var master = null;
  var playing = false;
  var schedulerId = 0;
  var cleanupId = 0;
  var voices = [];
  var graphNodes = [];
  var padFilter = null;
  var bassOscillator = null;
  var bassGain = null;
  var reverbInput = null;
  var chordVoices = [];
  var nextBarTime = 0;
  var barIndex = 0;
  var beatSeconds = 60 / 84;
  var barSeconds = beatSeconds * 4;
  var reducedMotion = false;

  var progression = [
    { bass: 35, chord: [59, 62, 66, 73] }, // Bm9
    { bass: 31, chord: [59, 62, 66, 69] }, // Gmaj7
    { bass: 38, chord: [57, 62, 66, 76] }, // Dadd9
    { bass: 33, chord: [57, 61, 64, 71] }  // Aadd9
  ];
  var chimeNotes = [78, 76, 73, 69, 71, 73, 76, 74];

  function midiToHz(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  function addNode(node) {
    graphNodes.push(node);
    return node;
  }

  function connect(source, target) {
    source.connect(target);
    return source;
  }

  function buildReverbBus() {
    reverbInput = addNode(context.createGain());
    var convolver = addNode(context.createConvolver());
    var seconds = 1.55;
    var length = Math.floor(context.sampleRate * seconds);
    var impulse = context.createBuffer(2, length, context.sampleRate);
    for (var channel = 0; channel < 2; channel += 1) {
      var data = impulse.getChannelData(channel);
      for (var i = 0; i < length; i += 1) {
        var falloff = 1 - i / length;
        var noise = Math.random() * 2 - 1;
        data[i] = noise * falloff * falloff * (channel === 0 ? 1 : 0.94);
      }
    }
    convolver.buffer = impulse;
    var wet = addNode(context.createGain());
    wet.gain.value = 0.2;
    connect(reverbInput, convolver);
    connect(convolver, wet);
    connect(wet, master);
  }

  function sendToReverb(source, amount) {
    var send = addNode(context.createGain());
    send.gain.value = amount;
    connect(source, send);
    connect(send, reverbInput);
  }

  function createBell(note, atTime, accent) {
    if (!context || !master) return;
    var oscillator = addNode(context.createOscillator());
    var overtone = addNode(context.createOscillator());
    var envelope = addNode(context.createGain());
    var tone = addNode(context.createBiquadFilter());
    var pan = context.createStereoPanner ? addNode(context.createStereoPanner()) : null;
    oscillator.type = "sine";
    overtone.type = "triangle";
    oscillator.frequency.setValueAtTime(midiToHz(note), atTime);
    overtone.frequency.setValueAtTime(midiToHz(note) * 2.006, atTime);
    tone.type = "lowpass";
    tone.frequency.setValueAtTime(2200, atTime);
    tone.Q.value = 0.45;
    envelope.gain.setValueAtTime(0.0001, atTime);
    envelope.gain.exponentialRampToValueAtTime(accent ? 0.034 : 0.022, atTime + 0.035);
    envelope.gain.exponentialRampToValueAtTime(0.0001, atTime + 1.65);
    if (pan) pan.pan.setValueAtTime(((barIndex % 3) - 1) * 0.13, atTime);
    connect(oscillator, tone);
    connect(overtone, tone);
    connect(tone, envelope);
    if (pan) {
      connect(envelope, pan);
      connect(pan, master);
      sendToReverb(envelope, 0.095);
    } else {
      connect(envelope, master);
      sendToReverb(envelope, 0.095);
    }
    oscillator.start(atTime);
    overtone.start(atTime);
    oscillator.stop(atTime + 1.8);
    overtone.stop(atTime + 1.8);
    voices.push(oscillator, overtone);
    oscillator.onended = function () { oscillator.disconnect(); };
    overtone.onended = function () { overtone.disconnect(); };
  }

  function scheduleBar(absoluteBar, atTime) {
    var chord = progression[absoluteBar % progression.length];
    chordVoices.forEach(function (voice, index) {
      voice.oscillator.frequency.cancelScheduledValues(atTime);
      voice.oscillator.frequency.setTargetAtTime(midiToHz(chord.chord[index]), atTime, 0.34);
      voice.overtone.frequency.cancelScheduledValues(atTime);
      voice.overtone.frequency.setTargetAtTime(midiToHz(chord.chord[index]) * 1.003, atTime, 0.38);
    });

    bassOscillator.frequency.cancelScheduledValues(atTime);
    bassOscillator.frequency.setTargetAtTime(midiToHz(chord.bass), atTime, 0.3);
    bassGain.gain.cancelScheduledValues(atTime);
    bassGain.gain.setValueAtTime(0.008, atTime);
    bassGain.gain.linearRampToValueAtTime(reducedMotion ? 0.024 : 0.035, atTime + 0.11);
    bassGain.gain.setTargetAtTime(0.011, atTime + beatSeconds * 1.7, beatSeconds * 0.8);

    // A two-note, widely spaced motif gives the room a small pulse without drums.
    if (!reducedMotion && absoluteBar % 2 === 0) {
      var note = chimeNotes[(absoluteBar / 2) % chimeNotes.length];
      createBell(note, atTime + beatSeconds * 2.15, absoluteBar % 4 === 0);
    }
  }

  function scheduleAhead() {
    if (!context || !playing) return;
    var horizon = context.currentTime + 0.55;
    while (nextBarTime < horizon) {
      scheduleBar(barIndex, nextBarTime);
      nextBarTime += barSeconds;
      barIndex += 1;
    }
  }

  function buildAudioGraph() {
    var AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;

    context = new AudioContextClass({ latencyHint: "playback" });
    master = addNode(context.createGain());
    master.gain.value = 0.0001;
    var compressor = addNode(context.createDynamicsCompressor());
    compressor.threshold.value = -24;
    compressor.knee.value = 18;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.012;
    compressor.release.value = 0.24;
    connect(master, compressor);
    connect(compressor, context.destination);
    buildReverbBus();

    padFilter = addNode(context.createBiquadFilter());
    padFilter.type = "lowpass";
    padFilter.frequency.value = reducedMotion ? 1050 : 1450;
    padFilter.Q.value = 0.38;
    var padDry = addNode(context.createGain());
    padDry.gain.value = 0.78;
    connect(padFilter, padDry);
    connect(padDry, master);
    sendToReverb(padFilter, 0.16);

    for (var i = 0; i < 4; i += 1) {
      var oscillator = addNode(context.createOscillator());
      var overtone = addNode(context.createOscillator());
      var voiceGain = addNode(context.createGain());
      oscillator.type = "triangle";
      overtone.type = "sawtooth";
      oscillator.frequency.value = midiToHz(progression[0].chord[i]);
      overtone.frequency.value = midiToHz(progression[0].chord[i]) * 1.004;
      oscillator.detune.value = -3;
      overtone.detune.value = 3;
      voiceGain.gain.value = i === 0 ? 0.031 : 0.022;
      connect(oscillator, voiceGain);
      connect(overtone, voiceGain);
      connect(voiceGain, padFilter);
      oscillator.start();
      overtone.start();
      voices.push(oscillator, overtone);
      chordVoices.push({ oscillator: oscillator, overtone: overtone });
    }

    bassOscillator = addNode(context.createOscillator());
    bassGain = addNode(context.createGain());
    var bassFilter = addNode(context.createBiquadFilter());
    bassOscillator.type = "sine";
    bassOscillator.frequency.value = midiToHz(progression[0].bass);
    bassFilter.type = "lowpass";
    bassFilter.frequency.value = 185;
    bassGain.gain.value = 0.0001;
    connect(bassOscillator, bassFilter);
    connect(bassFilter, bassGain);
    connect(bassGain, master);
    bassOscillator.start();
    voices.push(bassOscillator);
    return true;
  }

  function clearGraph() {
    voices.forEach(function (voice) {
      try { voice.onended = null; voice.stop(); } catch (error) {}
    });
    voices = [];
    graphNodes.forEach(function (node) {
      try { node.disconnect(); } catch (error) {}
    });
    graphNodes = [];
    chordVoices = [];
    padFilter = null;
    bassOscillator = null;
    bassGain = null;
    reverbInput = null;
    master = null;
  }

  function start() {
    if (playing) return Promise.resolve(true);
    if (cleanupId) {
      window.clearTimeout(cleanupId);
      cleanupId = 0;
    }
    reducedMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    try {
      if (!context && !buildAudioGraph()) return Promise.resolve(false);
    } catch (error) {
      clearGraph();
      if (context) {
        try { context.close(); } catch (closeError) {}
        context = null;
      }
      return Promise.resolve(false);
    }

    return context.resume().then(function () {
      if (!context || context.state !== "running") return false;
      playing = true;
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), context.currentTime);
      master.gain.linearRampToValueAtTime(0.42, context.currentTime + 1.25);
      nextBarTime = context.currentTime + 0.08;
      barIndex = 0;
      scheduleAhead();
      schedulerId = window.setInterval(scheduleAhead, 180);
      return true;
    }).catch(function () {
      playing = false;
      return false;
    });
  }

  function stop() {
    if (schedulerId) {
      window.clearInterval(schedulerId);
      schedulerId = 0;
    }
    if (!context || !master) {
      playing = false;
      return Promise.resolve();
    }
    playing = false;
    var closingContext = context;
    var now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(0.0001, now, 0.11);
    return new Promise(function (resolve) {
      cleanupId = window.setTimeout(function () {
        cleanupId = 0;
        clearGraph();
        context = null;
        closingContext.close().catch(function () {});
        resolve();
      }, 480);
    });
  }

  var api = { start: start, stop: stop };
  Object.defineProperty(api, "isPlaying", { enumerable: true, get: function () { return playing; } });
  window.RoomMusic = api;
})();
