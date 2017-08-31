(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var SonicSocket = require('../lib/sonic-socket.js');
var SonicServer = require('../lib/sonic-server.js');
var SonicCoder = require('../lib/sonic-coder.js');

var ALPHABET = '0123456789abcdefg';
// Create an ultranet server.
var sonicServer = new SonicServer({alphabet: ALPHABET, debug: true, freqMin: 18440, freqMax: 22440});
// Create an ultranet socket.
var sonicSocket = new SonicSocket({alphabet: ALPHABET, freqMin: 18440, freqMax: 22440});


var history = document.querySelector('#history');
var wrap = document.querySelector('#history-wrap');
var form = document.querySelector('form');
var input = document.querySelector('input');

function init() {
  sonicServer.start();
  sonicServer.on('message', onIncomingChat);
  form.addEventListener('submit', onSubmitForm);
}

function padding(input, size){
	var s = input+'';
	while(s.length < size){
		s = '0' + s;
	}
	return s;
}

function onSubmitForm(e) {
  // Get contents of input element.
  var message = input.value;
  // Send via oscillator.
  var hexCode = ToHexCode(message);
  var biCode = [];
  for (var i = 0; i <hexCode.length; i++){
	  var TenCode = (parseInt(hexCode[i], 16));
	  biCode.push(padding(TenCode.toString(2), 16));
  }   
  biCode = biCode.join('');
  console.log('hex:' + hexCode);
  console.log(biCode);
  sonicSocket.send(biCode);
  // Clear the input element.
  input.value = '';
  // Don't actually submit the form.
  e.preventDefault();
}

function onIncomingChat(message) {
  var HexArray = [];
  console.log('buffer: ' + this.buffer);
  console.log('chat inbound.');
  message = message.match(/.{1,16}/g);
  for (var i = 0; i <message.length; i++){
	  var TenCode = (parseInt(message[i], 2));
	  HexArray.push(TenCode.toString(16));
  }
  message = UnHexCode(HexArray);
  history.innerHTML += time() + ': ' + message + '<br/>';
  // Scroll history to the bottom.
  wrap.scrollTop = history.scrollHeight;
}

function ToHexCode(str){
	var hex = [];
	for(var i = 0; i < str.length; i++){
		hex.push(str.charCodeAt(i).toString(16));
	}
	return hex;
}

function UnHexCode(Hex){
	var str = '';
	for(var i = 0; i < Hex.length; i++){
		str = str + String.fromCharCode(parseInt(Hex[i], 16));
	}
	return str;
}

function time() {
  var now = new Date();
  var hours = now.getHours();
  hours = (hours > 9 ? hours: ' ' + hours);
  var mins = now.getMinutes();
  mins = (mins > 9 ? mins : '0' + mins);
  var secs = now.getSeconds();
  secs = (secs > 9 ? secs : '0' + secs);
  return '[' + hours + ':' + mins + ':' + secs + ']';
}

window.addEventListener('load', init);

},{"../lib/sonic-coder.js":3,"../lib/sonic-server.js":4,"../lib/sonic-socket.js":5}],2:[function(require,module,exports){
function RingBuffer(maxLength) {
  this.array = [];
  this.maxLength = maxLength;
}

RingBuffer.prototype.get = function(index) {
  if (index >= this.array.length) {
    return null;
  }
  return this.array[index];
};

RingBuffer.prototype.last = function() {
  if (this.array.length == 0) {
    return null;
  }
  return this.array[this.array.length - 1];
}

RingBuffer.prototype.add = function(value) {
  // Append to the end, remove from the front.
  this.array.push(value);
  if (this.array.length >= this.maxLength) {
    this.array.splice(0, 1);
  }
};

RingBuffer.prototype.length = function() {
  // Return the actual size of the array.
  return this.array.length;
};

RingBuffer.prototype.clear = function() {
  this.array = [];
};

RingBuffer.prototype.copy = function() {
  // Returns a copy of the ring buffer.
  var out = new RingBuffer(this.maxLength);
  out.array = this.array.slice(0);
  return out;
};

RingBuffer.prototype.remove = function(index, length) {
  //console.log('Removing', index, 'through', index+length);
  this.array.splice(index, length);
};

module.exports = RingBuffer;

},{}],3:[function(require,module,exports){
/**
 * A simple sonic encoder/decoder for [a-z0-9] => frequency (and back).
 * A way of representing characters with frequency.
 */
var ALPHABET = '\n abcdefghijklmnopqrstuvwxyz0123456789,.!?@*';

function SonicCoder(params) {
  params = params || {};
  this.freqMin = params.freqMin || 18500;
  this.freqMax = params.freqMax || 19500;
  this.freqError = params.freqError || 50;
  this.alphabetString = params.alphabet || ALPHABET;
  this.startChar = params.startChar || '^';
  this.endChar = params.endChar || '$';
  // Make sure that the alphabet has the start and end chars.
  this.alphabet = this.startChar + this.alphabetString + this.endChar;
}

/**
 * Given a character, convert to the corresponding frequency.
 */
SonicCoder.prototype.MapToFreq = function(index) {
  // Get the index of the character.
  if (parseInt(index, 2) > 65535*2) {
    // If this character isn't in the alphabet, error out.
    console.error(char, 'is an invalid character.');
    index = -1;
  }
  // Convert from index to frequency.
  var freqRange = this.freqMax - this.freqMin;
  // var percent = index / this.alphabet.length;
  var percent = index / 20;
  var freqOffset = Math.round(freqRange * percent);
  return this.freqMin + freqOffset;
};

/**
 * Given a frequency, convert to the corresponding character.
 */
SonicCoder.prototype.freqToChar = function(freq) {
  // If the frequency is out of the range.
  if (!(this.freqMin < freq && freq < this.freqMax)) {
    // If it's close enough to the min, clamp it (and same for max).
    if (this.freqMin - freq < this.freqError) {
      freq = this.freqMin;
    } else if (freq - this.freqMax < this.freqError) {
      freq = this.freqMax;
    } else {
      // Otherwise, report error.
      console.error(freq, 'is out of range.');
      return null;
    }
  }
  // Convert frequency to index to char.
  var freqRange = this.freqMax - this.freqMin;
  var percent = (freq - this.freqMin) / freqRange;
  // var index = Math.round(this.alphabet.length * percent);
  var index = Math.round(20 * percent);
  return this.alphabet[index];
};

module.exports = SonicCoder;

},{}],4:[function(require,module,exports){
var RingBuffer = require('./ring-buffer.js');
var SonicCoder = require('./sonic-coder.js');

var audioContext = new window.AudioContext || new webkitAudioContext();
/**
 * Extracts meaning from audio streams.
 *
 * (assumes audioContext is an AudioContext global variable.)
 *
 * 1. Listen to the microphone.
 * 2. Do an FFT on the input.
 * 3. Extract frequency peaks in the ultrasonic range.
 * 4. Keep track of frequency peak history in a ring buffer.
 * 5. Call back when a peak comes up often enough.
 */
function SonicServer(params) {
  params = params || {};
  this.peakThreshold = params.peakThreshold || -65;
  this.minRunLength = params.minRunLength || -1;
  this.coder = params.coder || new SonicCoder(params);
  // How long (in ms) to wait for the next character.
  this.timeout = params.timeout || 500;
  this.debug = !!params.debug;

  this.peakHistory = new RingBuffer(16);
  this.peakTimes = new RingBuffer(16);

  this.callbacks = {};
  this.bitlength = params.bitlength || 16;
  this.buffer = '';
  this.state = State.IDLE;
  this.isRunning = false;
  this.iteration = 0;
  this.pickChar = true;
  this.pickState = true;
  this.index = new Array();
  this.recorder = true;
}

var State = {
  IDLE: 1,
  RECV: 2
};

/**
 * Start processing the audio stream.
 */
SonicServer.prototype.start = function() {
  // Start listening for microphone. Continue init in onStream.
  var constraints = {
    audio: { optional: [{ echoCancellation: false }] }
  };
  navigator.webkitGetUserMedia(constraints,
      this.onStream_.bind(this), this.onStreamError_.bind(this));
};

/**
 * Stop processing the audio stream.
 */
SonicServer.prototype.stop = function() {
  this.isRunning = false;
  this.track.stop();
};

SonicServer.prototype.on = function(event, callback) {
  if (event == 'message') {
    this.callbacks.message = callback;
  }
  if (event == 'character') {
    this.callbacks.character = callback;
  }
};

SonicServer.prototype.setDebug = function(value) {
  this.debug = value;

  var canvas = document.querySelector('canvas');
  if (canvas) {
    // Remove it.
    canvas.parentElement.removeChild(canvas);
  }
};

SonicServer.prototype.fire_ = function(callback, arg) {
  if (typeof(callback) === 'function') {
    callback(arg);
  }
};

SonicServer.prototype.onStream_ = function(stream) {
  // Store MediaStreamTrack for stopping later. MediaStream.stop() is deprecated
  // See https://developers.google.com/web/updates/2015/07/mediastream-deprecations?hl=en
  this.track = stream.getTracks()[0];

  // Setup audio graph.
  var input = audioContext.createMediaStreamSource(stream);
  var analyser = audioContext.createAnalyser();
  input.connect(analyser);
  // Create the frequency array.
  this.freqs = new Float32Array(analyser.frequencyBinCount);
  // Save the analyser for later.
  this.analyser = analyser;
  this.isRunning = true;
  // Do an FFT and check for inaudible peaks.
  this.raf_(this.loop.bind(this));
};

SonicServer.prototype.onStreamError_ = function(e) {
  console.error('Audio input error:', e);
};

/**
 * Given an FFT frequency analysis, return the peak frequency in a frequency
 * range.
 */
SonicServer.prototype.getPeakFrequency = function() {
  // Find where to start.
  var start = this.freqToIndex(this.coder.freqMin);
  // TODO: use first derivative to find the peaks, and then find the largest peak.
  // Just do a max over the set.
  var max = -Infinity;
  var sortfreq = [{index: -1, freqIntensity: -70}];
  var peakfreqIndex = [];
  
  for(var i = start; i < this.freqs.length; i++){
	if(i>0 && i < this.freqs.length-1){
		if(this.freqs[i] > this.freqs[i-1] && this.freqs[i] > this.freqs[i+1] && this.freqs[i] > this.peakThreshold){
			sortfreq.push({index: i, freqIntensity: this.freqs[i]});
		}
	}
  }
  sortfreq.sort(function(a,b){return b.freqIntensity - a.freqIntensity});
  for (var ind = 0; ind < sortfreq.length; ind ++){
	peakfreqIndex[ind] = sortfreq[ind].index;
  }
  peakfreqIndex.pop();
  max = sortfreq[0].freqIntensity;
  // Only care about sufficiently tall peaks.
  if (max > this.peakThreshold) {
	if (peakfreqIndex.length > this.bitlength){
		peakfreqIndex.length = this.bitlength;
	}
    return this.indexToFreq(peakfreqIndex);
  }
  
  return null;
};

SonicServer.prototype.loop = function() {
  this.analyser.getFloatFrequencyData(this.freqs);
  // Sanity check the peaks every 5 seconds.
  if ((this.iteration + 1) % (60 * 5) == 0) {
    this.restartServerIfSanityCheckFails();
  }
  // Calculate peaks, and add them to history.
  var freq = this.getPeakFrequency();
  if (freq) {
	console.log(freq);
	for (var i = 0; i < freq.length; i++){
		var char = this.coder.freqToChar(freq[i]);
		// DEBUG ONLY: Output the transcribed char.
		if (this.debug) {
//		console.log('Transcribed char: ' + char);
		}
		if(char){
			if(char != '^' && char != '$' && char != 'g'){
				char = parseInt(char, 16);
			}
			this.peakHistory.add(char);
			this.peakTimes.add(new Date());
		}	
	}
	
  } else {
    // If no character was detected, see if we've timed out.
    var lastPeakTime = this.peakTimes.last();
    if (lastPeakTime && new Date() - lastPeakTime > this.timeout) {
      // Last detection was over 300ms ago.
      this.state = State.IDLE;
      if (this.debug) {
        console.log('Token', this.buffer, 'timed out');
      }
      this.peakTimes.clear();
    }
  }
  // Analyse the peak history.
  this.analysePeaks();
  // DEBUG ONLY: Draw the frequency response graph.
  if (this.debug) {
    this.debugDraw_();
  }
  if (this.isRunning) {
    this.raf_(this.loop.bind(this));
  }
  this.iteration += 1;
};

SonicServer.prototype.indexToFreq = function(index) {
  var f = new Array();
  var nyquist = audioContext.sampleRate/2;
  for (var i = 0; i < index.length; i++){
	  f.push(nyquist/this.freqs.length * index[i]);
  }
  return f;
};

SonicServer.prototype.freqToIndex = function(frequency) {
  var nyquist = audioContext.sampleRate/2;
  return Math.round(frequency/nyquist * this.freqs.length);
};

/**
 * Analyses the peak history to find true peaks (repeated over several frames).
 */
SonicServer.prototype.analysePeaks = function() {
  // Look for runs of repeated characters.
  var char = this.peakHistory.last();
  var endChar = this.storageIndex();
  if (!char) {
    return;
  }
  if (this.state == State.IDLE) {
    // If idle, look for start character to go into recv mode.
    if (char == this.coder.startChar) {
	  console.log('start');
      this.buffer = '';
      this.state = State.RECV;
    }
  } else if (this.state == State.RECV) {
    // If receiving, look for character changes.
    if (endChar && !this.recorder) {
	  console.log(this.index);
	  var message = '0000000000000000';
	  message = message.split('');
	  for(var j = 0; j < this.index.length; j++){
		 message[this.index[j]] = 1; 
	  }
	  // console.log(message);
	  message = message.join('');
      this.buffer += message;
      this.index = [];
	  this.fire_(this.callbacks.character, char);
    }
	if (endChar && this.recorder){
		this.index = [];
	}
    // Also look for the end character to go into idle mode.
    if (char == this.coder.endChar) {
      this.state = State.IDLE;
	  console.log('buffer: ' + this.buffer);
      this.fire_(this.callbacks.message, this.buffer);
      this.buffer = '';
	  this.peakHistory.clear();
	  this.index = [];
    }
  }
  this.recorder = endChar;
};

SonicServer.prototype.storageIndex = function(){
	var IndexArray = this.peakHistory.array;
	console.log(IndexArray);
	for (var i = 0; i < IndexArray.length; i++){
		if(IndexArray[i] == 'g'){
			this.peakHistory.clear();
			// console.log(this.index);
			return true;
		}
		
		if(IndexArray[i] != this.coder.startChar && IndexArray[i] != this.coder.endChar){
			if(!this.index){
				this.index.push(IndexArray[i]);
			}
			else{
				if(!this.index.includes(IndexArray[i])){
					this.index.push(IndexArray[i]);
				}
			}
		}
	}
	// console.log(this.index);
	return false;
}

SonicServer.prototype.getLastRun = function() {
  var lastChar = this.peakHistory.last();
  var runLength = 0;
  console.log(this.peakHistory.array);
  // Look at the peakHistory array for patterns like ajdlfhlkjxxxxxx$.
  for (var i = this.peakHistory.length() - 2; i >= 0; i--) {
    var char = this.peakHistory.get(i);
    if (char == lastChar) {
      runLength += 1;
    } else {
      break;
    }
  }
  if (runLength > this.minRunLength) {
    // Remove it from the buffer.
    this.peakHistory.remove(i + 1, runLength + 1);
    return lastChar;
  }
  return null;
};

/**
 * DEBUG ONLY.
 */
SonicServer.prototype.debugDraw_ = function() {
  var canvas = document.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
  }
  canvas.width = document.body.offsetWidth;
  canvas.height = 480;
  drawContext = canvas.getContext('2d');
  // Plot the frequency data.
  for (var i = 0; i < this.freqs.length; i++) {
    var value = this.freqs[i];
    // Transform this value (in db?) into something that can be plotted.
    var height = value + 400;
    var offset = canvas.height - height - 1;
    var barWidth = canvas.width/this.freqs.length;
    drawContext.fillStyle = 'black';
    drawContext.fillRect(i * barWidth, offset, 1, 1);
  }
};

/**
 * A request animation frame shortcut. This one is intended to work even in
 * background pages of an extension.
 */
SonicServer.prototype.raf_ = function(callback) {
  var isCrx = !!(window.chrome && chrome.extension);
  if (isCrx) {
    setTimeout(callback, 1000/60);
  } else {
    requestAnimationFrame(callback);
  }
};

SonicServer.prototype.restartServerIfSanityCheckFails = function() {
  // Strange state 1: peaks gradually get quieter and quieter until they
  // stabilize around -800.
  if (this.freqs[0] < -300) {
    console.error('freqs[0] < -300. Restarting.');
    this.restart();
    return;
  }
  // Strange state 2: all of the peaks are -100. Check just the first few.
  var isValid = true;
  for (var i = 0; i < 10; i++) {
    if (this.freqs[i] == -100) {
      isValid = false;
    }
  }
  if (!isValid) {
    console.error('freqs[0:10] == -100. Restarting.');
    this.restart();
  }
}

SonicServer.prototype.restart = function() {
  //this.stop();
  //this.start();
  window.location.reload();
};


module.exports = SonicServer;

},{"./ring-buffer.js":2,"./sonic-coder.js":3}],5:[function(require,module,exports){
var SonicCoder = require('./sonic-coder.js');

var audioContext = new window.AudioContext || new webkitAudioContext();

/**
 * Encodes text as audio streams.
 *
 * 1. Receives a string of text.
 * 2. Creates an oscillator.
 * 3. Converts characters into frequencies.
 * 4. Transmits frequencies, waiting in between appropriately.
 */
function SonicSocket(params) {
  params = params || {};
  this.coder = params.coder || new SonicCoder();
  this.charDuration = params.charDuration || 0.2;
  this.breakDuration = params.breakDuration || 0.1;
  this.silence = params.silenceDuration || 0.05;
  this.coder = params.coder || new SonicCoder(params);
  this.rampDuration = params.rampDuration || 0.001;
  this.bitlength = params.bitlength || 16;
}


SonicSocket.prototype.send = function(input, opt_callback) {
  // Surround the word with start and end characters.
  // Use WAAPI to schedule the frequencies.
  // Send start char.
  var freq = new Array();
  freq = [this.coder.MapToFreq(0)];
  var time = audioContext.currentTime;
  this.scheduleToneAt(freq, time, this.charDuration);
  
  // Send message.
  var count = 0;
  freq = [];
  for (var i = 0; i < input.length; i++) {
	if(input[i] == 1){
		freq.push(this.coder.MapToFreq(i%this.bitlength + 1));
	}
	if(i%this.bitlength == this.bitlength-1){
		time = audioContext.currentTime + this.charDuration + this.silence + (this.charDuration + this.breakDuration + 2*this.silence)*count;
		this.scheduleToneAt(freq, time, this.charDuration);
		
		time = audioContext.currentTime + (this.charDuration + this.silence)*2 + (this.charDuration + this.breakDuration + 2*this.silence)*count;
		freq = [this.coder.MapToFreq(17)];
		this.scheduleToneAt(freq, time, this.breakDuration);
		freq = [];
		count = count + 1;
	}
	
  }
  
  // Send End char.
  freq = [this.coder.MapToFreq(18)];
  time = audioContext.currentTime + this.charDuration + this.silence + (this.charDuration + this.breakDuration + 2*this.silence)*count;
  this.scheduleToneAt(freq, time, this.charDuration);
  // If specified, callback after roughly the amount of time it would have
  // taken to transmit the token.
  if (opt_callback) {
    var totalTime = this.charDuration * input.length;
    setTimeout(opt_callback, totalTime * 1000);
  }
};

function resetAudioContext() {
  if(audioCtx.state === 'running') {
    audioCtx.suspend().then(function() {
      susresBtn.textContent = 'Resume context';
    });
  } else if(audioCtx.state === 'suspended') {
    audioCtx.resume().then(function() {
      susresBtn.textContent = 'Suspend context';
    });  
  }
}

SonicSocket.prototype.scheduleToneAt = function(freq, startTime, duration) {
  var gainNode = audioContext.createGain();
  // Gain => Merger
  gainNode.gain.value = 0;

  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(1, startTime + this.rampDuration);
  gainNode.gain.setValueAtTime(1, startTime + duration - this.rampDuration);
  gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
  gainNode.connect(audioContext.destination);
  console.log(freq);
  var osc0 = audioContext.createOscillator();
  osc0.frequency.value = freq[0] || null;
  osc0.connect(gainNode);
  
  var osc1 = audioContext.createOscillator();
  osc1.frequency.value = freq[1]|| null;
  osc1.connect(gainNode);
  
  var osc2 = audioContext.createOscillator();
  osc2.frequency.value = freq[2]|| null;
  osc2.connect(gainNode);
  
  var osc3 = audioContext.createOscillator();
  osc3.frequency.value = freq[3]|| null;
  osc3.connect(gainNode);
  
  var osc4 = audioContext.createOscillator();
  osc4.frequency.value = freq[4]|| null;
  osc4.connect(gainNode);
  
  var osc5 = audioContext.createOscillator();
  osc5.frequency.value = freq[5]|| null;
  osc5.connect(gainNode);
  
  var osc6 = audioContext.createOscillator();
  osc6.frequency.value = freq[6]|| null;
  osc6.connect(gainNode);
  
  var osc7 = audioContext.createOscillator();
  osc7.frequency.value = freq[7]|| null;
  osc7.connect(gainNode);

  var osc8 = audioContext.createOscillator();
  osc8.frequency.value = freq[8] || null;
  osc8.connect(gainNode);
  
  var osc9 = audioContext.createOscillator();
  osc9.frequency.value = freq[9]|| null;
  osc9.connect(gainNode);
  
  var osc10 = audioContext.createOscillator();
  osc10.frequency.value = freq[10]|| null;
  osc10.connect(gainNode);
  
  var osc11 = audioContext.createOscillator();
  osc11.frequency.value = freq[11]|| null;
  osc11.connect(gainNode);
  
  var osc12 = audioContext.createOscillator();
  osc12.frequency.value = freq[12]|| null;
  osc12.connect(gainNode);
  
  var osc13 = audioContext.createOscillator();
  osc13.frequency.value = freq[13]|| null;
  osc13.connect(gainNode);
  
  var osc14 = audioContext.createOscillator();
  osc14.frequency.value = freq[14]|| null;
  osc14.connect(gainNode);
  
  var osc15 = audioContext.createOscillator();
  osc15.frequency.value = freq[15]|| null;
  osc15.connect(gainNode);
  
  var osc = audioContext.createOscillator();
  osc.frequency.value = freq[16]|| null;
  osc.connect(gainNode);
  
  osc.start(startTime);
  osc0.start(startTime);
  osc1.start(startTime);
  osc2.start(startTime);
  osc3.start(startTime);
  osc4.start(startTime);
  osc5.start(startTime);
  osc6.start(startTime);
  osc7.start(startTime);
  osc8.start(startTime);
  osc9.start(startTime);
  osc10.start(startTime);
  osc11.start(startTime);
  osc12.start(startTime);
  osc13.start(startTime);
  osc14.start(startTime);
  osc15.start(startTime);
  
  osc.onended = function(){osc.disconnet();};
  osc0.onended = function(){osc0.disconnet();};
  osc1.onended = function(){osc1.disconnet();;};
  osc2.onended = function(){osc2.disconnet();;};
  osc3.onended = function(){osc3.disconnet();;};
  osc4.onended = function(){osc4.disconnet();;};
  osc5.onended = function(){osc5.disconnet();;};
  osc6.onended = function(){osc6.disconnet();;};
  osc7.onended = function(){osc7.disconnet();;};
  osc8.onended = function(){osc8.disconnet();;};
  osc9.onended = function(){osc9.disconnet();;};
  osc10.onended = function(){osc10.disconnet();;};
  osc11.onended = function(){osc11.disconnet();;};
  osc12.onended = function(){osc12.disconnet();;};
  osc13.onended = function(){osc13.disconnet();;};
  osc14.onended = function(){osc14.disconnet();;};
  osc15.onended = function(){osc15.disconnet();;};
  
  
};

module.exports = SonicSocket;

},{"./sonic-coder.js":3}]},{},[1]);
