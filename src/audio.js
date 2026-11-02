export class AudioClock {
  constructor(audioElement) {
    this.audio = audioElement;
    this.objectUrl = null;
    this.audio.addEventListener('ended', () => this.onEnded?.());
    this.onEnded = null;
  }

  load(file) {
    if (!file) throw new Error('Selecciona un archivo de audio válido.');
    const okType = file.type?.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac|opus)$/i.test(file.name || '');
    if (!okType) throw new Error('El archivo no parece ser un formato de audio compatible.');
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = URL.createObjectURL(file);
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        this.audio.removeEventListener('loadedmetadata', ok);
        this.audio.removeEventListener('error', fail);
      };
      const ok = () => { cleanup(); resolve({ name: file.name, duration: this.duration }); };
      const fail = () => { cleanup(); reject(new Error('El navegador no pudo abrir este audio.')); };
      this.audio.addEventListener('loadedmetadata', ok, { once: true });
      this.audio.addEventListener('error', fail, { once: true });
      this.audio.src = this.objectUrl;
      this.audio.load();
    });
  }

  async play() {
    if (!this.audio.src) throw new Error('Carga una canción primero.');
    await this.audio.play();
  }
  pause() { this.audio.pause(); }
  get time() { return Number.isFinite(this.audio.currentTime) ? this.audio.currentTime : 0; }
  get duration() { return Number.isFinite(this.audio.duration) ? this.audio.duration : 0; }
  get playing() { return !this.audio.paused && !this.audio.ended; }
  dispose() {
    this.pause();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
    this.audio.removeAttribute('src');
    this.audio.load();
  }
}
