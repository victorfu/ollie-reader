// PCM capture runs off the main thread. The media source is connected directly
// to AudioContext.destination separately; this processor never alters playback.
class PodcastCaptionCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(4096);
    this.offset = 0;
  }

  process(inputs) {
    const channels = inputs[0];
    if (!channels || !channels.length) return true;
    const left = channels[0];
    const right = channels[1];
    for (let i = 0; i < left.length; i++) {
      this.buffer[this.offset++] = right ? (left[i] + right[i]) * 0.5 : left[i];
      if (this.offset === this.buffer.length) {
        this.port.postMessage({ samples: this.buffer }, [this.buffer.buffer]);
        this.buffer = new Float32Array(4096);
        this.offset = 0;
      }
    }
    return true;
  }
}

registerProcessor("podcast-caption-capture", PodcastCaptionCapture);
