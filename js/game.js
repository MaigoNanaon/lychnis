/**
 * 节奏游戏引擎（DOM 版）
 * 用 DOM 元素替代 Canvas，彻底避免移动端 Canvas 尺寸问题
 *
 * 结构：
 *   .game-track         圆角长条
 *     .track-progress   已扫过进度
 *     .track-notes      音符容器
 *       .note           音符圆点
 *     .track-scanline   荧光扫描线
 *   .game-judge-text    飘动判定文字容器
 */

class RhythmGame {
  constructor(container, segments, audioEngine, duration, callbacks = {}) {
    this.container = container;
    this.segments = segments;
    this.audio = audioEngine;
    this.duration = duration;
    this.callbacks = callbacks;

    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.perfectCount = 0;
    this.greatCount = 0;
    this.goodCount = 0;
    this.missCount = 0;
    this.totalNotes = 0;
    this.judgeCount = 0;

    this.phase = 'idle';
    this.rafId = null;

    this.segmentStates = [];
    this.noteEls = [];          // { el, note, segIndex }
    this.judgeTexts = [];

    // DOM 引用
    this.trackEl = null;
    this.progressEl = null;
    this.scanlineEl = null;
    this.notesEl = null;
    this.judgeLayer = null;
    this.labelEl = null;
  }

  // ============================================
  // 构建 DOM
  // ============================================
  _build() {
    this.container.innerHTML = '';

    // 段落标签
    this.labelEl = document.createElement('div');
    this.labelEl.className = 'game-seg-label';
    this.container.appendChild(this.labelEl);

    // 长条
    this.trackEl = document.createElement('div');
    this.trackEl.className = 'game-track';

    // 进度填充
    this.progressEl = document.createElement('div');
    this.progressEl.className = 'track-progress';
    this.trackEl.appendChild(this.progressEl);

    // 音符容器
    this.notesEl = document.createElement('div');
    this.notesEl.className = 'track-notes';
    this.trackEl.appendChild(this.notesEl);

    // 扫描线
    this.scanlineEl = document.createElement('div');
    this.scanlineEl.className = 'track-scanline';
    this.trackEl.appendChild(this.scanlineEl);

    this.container.appendChild(this.trackEl);

    // 判定文字层
    this.judgeLayer = document.createElement('div');
    this.judgeLayer.className = 'game-judge-layer';
    this.container.appendChild(this.judgeLayer);
  }

  // ============================================
  // 生命周期
  // ============================================
  init() {
    this._build();
    this._reset();
    this._loop();
  }

  start() {
    this.phase = 'playing';
    this._reset();
    this._buildNotes();
    this.audio.onTimeUpdate = (t) => this._update(t);
    this.audio.playFrom(0);
    if (this.callbacks.onPhaseChange) this.callbacks.onPhaseChange('playing');
  }

  destroy() {
    this._stopLoop();
    this.audio.stop();
    this.audio.onTimeUpdate = null;
    if (this.container) this.container.innerHTML = '';
  }

  // ============================================
  // 玩家点击
  // ============================================
  tap() {
    if (this.phase !== 'playing') return;
    const currentTime = this.audio.getCurrentTime();
    const seg = this._findSegmentAt(currentTime);
    if (!seg || seg.type !== 'play') return;

    const state = this.segmentStates[seg._index];
    let bestNote = null;
    let bestDiff = Infinity;
    for (const note of state.notes) {
      if (note.judged) continue;
      const diff = note.time - currentTime;
      if (Math.abs(diff) <= 180 && Math.abs(diff) < Math.abs(bestDiff)) {
        bestNote = note;
        bestDiff = diff;
      }
    }
    if (bestNote) this._judge(bestNote, bestDiff, seg);
  }

  _judge(note, diff, seg) {
    const absDiff = Math.abs(diff);
    let result;
    if (absDiff <= 50) { result = 'perfect'; this.score += 100 + this.combo * 2; this.perfectCount++; }
    else if (absDiff <= 100) { result = 'great'; this.score += 70 + this.combo; this.greatCount++; }
    else if (absDiff <= 150) { result = 'good'; this.score += 40; this.goodCount++; }
    else { result = 'miss'; this.missCount++; }

    if (result !== 'miss') { this.combo++; if (this.combo > this.maxCombo) this.maxCombo = this.combo; }
    else this.combo = 0;

    note.judged = true;
    note.judgeResult = result;
    note.judgeTime = performance.now();
    this.judgeCount++;

    // 更新音符视觉
    const noteData = this.noteEls.find(n => n.note === note);
    if (noteData) {
      noteData.el.classList.add('hit', result);
      setTimeout(() => noteData.el.classList.remove('hit'), 500);
    }

    // 飘动文字
    this._addJudgeText(note.time, seg, result.toUpperCase(), this._resultColor(result));

    if (this.callbacks.onJudge) {
      this.callbacks.onJudge({ result, combo: this.combo, score: this.score });
    }
  }

  // ============================================
  // 每帧更新
  // ============================================
  _update(currentTime) {
    const seg = this._findSegmentAt(currentTime);

    // 漏过标记 miss
    if (seg && seg.type === 'play') {
      const state = this.segmentStates[seg._index];
      for (const note of state.notes) {
        if (!note.judged && note.time < currentTime - 180) {
          this._judge(note, 999, seg);
        }
      }
    }

    // 教程段自动点亮
    if (seg && seg.type === 'tutorial') {
      const state = this.segmentStates[seg._index];
      for (const note of state.notes) {
        if (!note.demoHit && note.time <= currentTime && note.time > currentTime - 80) {
          note.demoHit = true;
          note.demoHitTime = performance.now();
          const noteData = this.noteEls.find(n => n.note === note);
          if (noteData) {
            noteData.el.classList.add('hit', 'perfect');
            setTimeout(() => noteData.el.classList.remove('hit'), 500);
          }
          this._addJudgeText(note.time, seg, 'TAP', '#00FFC8');
        }
      }
    }

    if (currentTime >= this.duration) this._end();
  }

  _end() {
    this.phase = 'ended';
    this._stopLoop();
    this.audio.stop();
    if (this.callbacks.onPhaseChange) this.callbacks.onPhaseChange('ended');
    if (this.callbacks.onEnd) {
      this.callbacks.onEnd({
        score: this.score, maxCombo: this.maxCombo,
        perfect: this.perfectCount, great: this.greatCount,
        good: this.goodCount, miss: this.missCount,
        total: this.totalNotes, accuracy: this._calcAccuracy()
      });
    }
  }

  _calcAccuracy() {
    if (this.totalNotes === 0) return 0;
    const weight = this.perfectCount * 1 + this.greatCount * 0.7 + this.goodCount * 0.4;
    return Math.round((weight / this.totalNotes) * 1000) / 10;
  }

  _reset() {
    this.score = 0; this.combo = 0; this.maxCombo = 0;
    this.perfectCount = 0; this.greatCount = 0; this.goodCount = 0;
    this.missCount = 0; this.judgeCount = 0;
    this.judgeTexts = [];
    this.noteEls = [];

    this.segmentStates = this.segments.map((seg, i) => {
      const notes = seg.notes.map(t => ({
        time: t, judged: false, judgeResult: null,
        demoHit: false, demoHitTime: 0, judgeTime: 0
      }));
      return { notes, _index: i };
    });

    this.totalNotes = this.segments
      .filter(s => s.type === 'play')
      .reduce((sum, s) => sum + s.notes.length, 0);
  }

  /** 为当前段落构建音符 DOM */
  _buildNotes() {
    if (!this.notesEl) return;
    this.notesEl.innerHTML = '';
    this.noteEls = [];

    const t = this.audio.getCurrentTime();
    const seg = this._findSegmentAt(t);
    if (!seg) return;

    const state = this.segmentStates[seg._index];
    for (const note of state.notes) {
      const el = document.createElement('div');
      el.className = 'note';
      const ratio = (note.time - seg.start) / (seg.end - seg.start);
      el.style.left = (ratio * 100) + '%';
      this.notesEl.appendChild(el);
      this.noteEls.push({ el, note, segIndex: seg._index });
    }
  }

  // ============================================
  // 渲染循环
  // ============================================
  _loop() {
    this._draw();
    this.rafId = requestAnimationFrame(() => this._loop());
  }

  _stopLoop() {
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
  }

  _draw() {
    const t = this.audio.getCurrentTime();
    const seg = this._findSegmentAt(t);

    if (!seg || !this.trackEl) return;

    // 段落标签
    const labels = {
      tutorial: { text: '👁 教程段 · 观察记忆节奏', cls: 'label-tutorial' },
      play: { text: '👆 打击段 · 点击屏幕模仿节奏', cls: 'label-play' },
      idle: { text: '🎵 欣赏中', cls: 'label-idle' }
    };
    const info = labels[seg.type];
    if (info) {
      this.labelEl.textContent = info.text;
      this.labelEl.className = 'game-seg-label ' + info.cls;
    }

    // 扫描线位置（段落内百分比）
    const ratio = Math.max(0, Math.min(1, (t - seg.start) / (seg.end - seg.start)));
    const pct = (ratio * 100) + '%';

    if (this.scanlineEl) this.scanlineEl.style.left = pct;
    if (this.progressEl) this.progressEl.style.width = pct;

    // 段落切换时重建音符
    if (seg._index !== this._lastSegIndex) {
      this._buildNotes();
      this._lastSegIndex = seg._index;
    }

    // 清理过期飘动文字
    this._updateJudgeTexts();
  }

  // ============================================
  // 飘动判定文字
  // ============================================
  _addJudgeText(time, seg, text, color) {
    const el = document.createElement('div');
    el.className = 'judge-text';
    el.textContent = text;
    el.style.color = color;
    const ratio = (time - seg.start) / (seg.end - seg.start);
    el.style.left = (ratio * 100) + '%';
    this.judgeLayer.appendChild(el);
    this.judgeTexts.push({ el, born: performance.now() });
  }

  _updateJudgeTexts() {
    const now = performance.now();
    this.judgeTexts = this.judgeTexts.filter(jt => {
      const age = now - jt.born;
      if (age > 800) {
        if (jt.el.parentNode) jt.el.parentNode.removeChild(jt.el);
        return false;
      }
      return true;
    });
  }

  // ============================================
  // 工具
  // ============================================
  _findSegmentAt(time) {
    for (let i = 0; i < this.segments.length; i++) {
      const s = this.segments[i];
      if (time >= s.start && time < s.end) return { ...s, _index: i };
    }
    if (this.segments.length > 0) {
      const last = this.segments[this.segments.length - 1];
      return { ...last, _index: this.segments.length - 1 };
    }
    return null;
  }

  _resultColor(result) {
    return { perfect: '#00FFC8', great: '#4ECDC4', good: '#FFD93D', miss: '#FF6B6B' }[result] || '#fff';
  }
}
