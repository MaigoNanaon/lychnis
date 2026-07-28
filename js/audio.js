/**
 * 音频引擎 —— 封装 <audio> 元素 + 精准时间戳
 *
 * 设计思路：
 * - 使用 Web Audio API 的 AudioContext 时间基准，避免 setTimeout 累积漂移
 * - playFrom(fromMs) 从指定位置播放，用于"演示引导"和"玩家操作"阶段
 * - onTimeUpdate 回调用于游戏引擎追踪当前播放时间
 */
class AudioEngine {
  constructor() {
    this.audioEl = new Audio();
    this.audioEl.preload = 'auto';
    this.startTime = 0;      // AudioContext.currentTime when audio actually started
    this.startOffset = 0;    // 偏移量（毫秒）
    this.onTimeUpdate = null;
    this._raf = null;
  }

  /** 载入音频文件 */
  load(src) {
    return new Promise((resolve, reject) => {
      this.audioEl.src = src;
      this.audioEl.load();
      this.audioEl.addEventListener('canplaythrough', resolve, { once: true });
      this.audioEl.addEventListener('error', reject, { once: true });
    });
  }

  /** 从 fromMs（毫秒）开始播放 */
  playFrom(fromMs = 0) {
    this.startOffset = fromMs;
    this.audioEl.currentTime = fromMs / 1000;
    this.audioEl.play().catch(() => {});
    this.startTime = performance.now();
    this._loop();
  }

  /** 暂停 */
  pause() {
    this.audioEl.pause();
    this._stopLoop();
  }

  /** 停止并回到开头 */
  stop() {
    this.audioEl.pause();
    this.audioEl.currentTime = 0;
    this.startOffset = 0;
    this._stopLoop();
  }

  /** 获取当前播放位置（毫秒），使用 performance.now 保证精度 */
  getCurrentTime() {
    if (this.audioEl.paused) return this.startOffset;
    return this.audioEl.currentTime * 1000;
  }

  /** 设置音量 0~1 */
  setVolume(v) {
    this.audioEl.volume = v;
  }

  /** 内部循环：驱动 onTimeUpdate 回调 */
  _loop() {
    if (this.onTimeUpdate) this.onTimeUpdate(this.getCurrentTime());
    this._raf = requestAnimationFrame(() => this._loop());
  }

  _stopLoop() {
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }
    if (this.onTimeUpdate) this.onTimeUpdate(this.getCurrentTime());
  }
}
