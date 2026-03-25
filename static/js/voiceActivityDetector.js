'use strict';

const EventTargetPolyfill = require('./eventTargetPolyfill');

class VoiceActivityDetector extends EventTargetPolyfill {
  constructor(options = {}) {
    super();
    this._speakingThreshold = options.speakingThreshold || 10;
    this._silenceThreshold = options.silenceThreshold || 4;
    this._silenceDelay = options.silenceDelay || 1500;
    this._isSpeaking = false;
    this._silenceStartTime = null;
    this._audioContext = null;
    this._analyser = null;
    this._source = null;
    this._dataArray = null;
    this._rafId = null;
  }

  get isSpeaking() {
    return this._isSpeaking;
  }

  setStream(stream) {
    this._disconnect();
    if (!stream || stream.getAudioTracks().length === 0) return;
    if (!this._audioContext || this._audioContext.state === 'closed') {
      this._audioContext = new AudioContext();
    }
    if (this._audioContext.state === 'suspended') {
      this._audioContext.resume();
    }
    this._analyser = this._audioContext.createAnalyser();
    this._analyser.fftSize = 256;
    this._dataArray = new Uint8Array(this._analyser.fftSize);
    this._source = this._audioContext.createMediaStreamSource(stream);
    this._source.connect(this._analyser);
    this._startAnalysis();
  }

  _disconnect() {
    if (this._rafId != null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    if (this._source) {
      this._source.disconnect();
      this._source = null;
    }
    if (this._analyser) {
      this._analyser.disconnect();
      this._analyser = null;
    }
    this._dataArray = null;
  }

  _startAnalysis() {
    const analyze = () => {
      this._rafId = requestAnimationFrame(analyze);
      if (!this._analyser || !this._dataArray) return;
      this._analyser.getByteTimeDomainData(this._dataArray);
      // Compute RMS amplitude (deviation from 128 center).
      let sumSquares = 0;
      for (let i = 0; i < this._dataArray.length; i++) {
        const deviation = this._dataArray[i] - 128;
        sumSquares += deviation * deviation;
      }
      const rms = Math.sqrt(sumSquares / this._dataArray.length);
      this.dispatchEvent(Object.assign(new CustomEvent('level'), {rms}));
      this._processLevel(rms);
    };
    this._rafId = requestAnimationFrame(analyze);
  }

  _processLevel(rms) {
    if (!this._isSpeaking) {
      if (rms > this._speakingThreshold) {
        this._isSpeaking = true;
        this._silenceStartTime = null;
        this.dispatchEvent(
            Object.assign(new CustomEvent('speakingstatechanged'), {isSpeaking: true})
        );
      }
    } else if (rms < this._silenceThreshold) {
      if (this._silenceStartTime == null) {
        this._silenceStartTime = performance.now();
      } else if (performance.now() - this._silenceStartTime >= this._silenceDelay) {
        this._isSpeaking = false;
        this._silenceStartTime = null;
        this.dispatchEvent(
            Object.assign(new CustomEvent('speakingstatechanged'), {isSpeaking: false})
        );
      }
    } else {
      this._silenceStartTime = null;
    }
  }

  destroy() {
    this._disconnect();
    if (this._audioContext && this._audioContext.state !== 'closed') {
      this._audioContext.close();
    }
    this._audioContext = null;
    this._isSpeaking = false;
    this._silenceStartTime = null;
  }
}

module.exports = VoiceActivityDetector;
