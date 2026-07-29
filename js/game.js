/**
 * 节奏游戏引擎（DOM 版 · 单轨道）  
 *
 * 单条轨道：
 *   tutorial 段 → 扫描线经过音符时打下一个较大的亮白点，一直保留
 *   play 段     → 玩家点击时在对应位置打一个较小的亮点，覆盖在白点上面
 *   对比大小点的重合程度即可直观看出准确度
 */

class RhythmGame {
  constructor(container, segments, audioEngine, duration, callbacks = {}) {
    this.container = container;
    this.segments = segments;
    this.audio = audioEngine;
    this.duration = duration;
    this.callbacks = callbacks;
    this.audioOffset = -80;

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
    this.tutorialDots = [];    // 教程段大白点 {el, note, segIndex}
    this.playerDots = [];      // 玩家小亮点 {el, time, segIndex}
    this.judgeTexts = [];

    // DOM
    this.track = null;
    this.notesLayer = null;    // 存放大白点 + 小亮点
    this.scanlines = [];       // 扫描线池（2 条）
    this.judgeLayer = null;
    this.labelEl = null;
    this.praiseEl = null;
    this.progressEl = null;
    this._lastSegIndex = -1;
    this._firstPlayIndex = -1;
    this._firstPlayEnded = false;
    this._firstTutorialIndex = -1;
    this._turnShown = false;
  }

  // ============================================
  // 构建 DOM
  // ============================================
  _build() {
    this.container.innerHTML = '';

    this.labelEl = document.createElement('div');
    this.labelEl.className = 'game-seg-label';
    this.container.appendChild(this.labelEl);

    this.track = document.createElement('div');
    this.track.className = 'game-track single-track';

    this.notesLayer = document.createElement('div');
    this.notesLayer.className = 'track-notes';
    this.track.appendChild(this.notesLayer);

    this.scanlines = [this._makeScanline(), this._makeScanline()];
    this.scanlines.forEach(sl => this.track.appendChild(sl));
    this.container.appendChild(this.track);

    this.judgeLayer = document.createElement('div');
    this.judgeLayer.className = 'game-judge-layer';
    this.container.appendChild(this.judgeLayer);

    // 弹出提示（到你！/ 好！）
    this.praiseEl = document.createElement('div');
    this.praiseEl.className = 'game-praise';
    this.container.appendChild(this.praiseEl);

    // 结束庆祝文字：整首歌完成后升起的彩色大「Qute！」
    this.finishEl = document.createElement('div');
    this.finishEl.className = 'game-finish-qute';
    this.finishEl.textContent = 'Qute！';
    this.finishEl.style.display = 'none';
    this.container.appendChild(this.finishEl);

    // 内联小号「Qute！」（出现在最后一次 Q 的上方）
    this.quteInlineEl = document.createElement('div');
    this.quteInlineEl.className = 'game-qute-inline';
    this.quteInlineEl.textContent = 'Qute！';
    this.quteInlineEl.style.display = 'none';
    this.container.appendChild(this.quteInlineEl);

    // 歌曲进度条
    this.progressEl = document.createElement('div');
    this.progressEl.className = 'game-progress-bar';
    const progressWrap = document.createElement('div');
    progressWrap.className = 'game-progress';
    progressWrap.appendChild(this.progressEl);
    this.container.appendChild(progressWrap);
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

  /** 窗口/方向变化时调用（竖屏⇄横屏）。
   *  游戏完全使用百分比定位，无需重算布局，只做容错占位，
   *  避免外部 resize 监听调用到不存在的方法而报错。 */
  _resize() {
    // 百分比布局自动适配，无需手动重绘
  }

  /** 中止游戏：中途停止但仍走正常结算逻辑（弹分享页/成绩） */
  abort() {
    if (this.phase === 'ended' || this.phase === 'aborted') return;
    this._end();
  }

  // ============================================
  // 时间补偿
  // ============================================
  _getTime() {
    return this.audio.getCurrentTime() - this.audioOffset;
  }

  // ============================================
  // 玩家点击
  // ============================================
  tap() {
    if (this.phase !== 'playing') return;
    const currentTime = this._getTime();

    // 从所有可见扫描线段落中，找最新的一个已开始的 play 段
    const visibleSegs = this._findVisibleScanSegs(currentTime);
    let seg = null;
    for (const vs of visibleSegs) {
      if (vs.type === 'play' && currentTime >= vs.start) seg = vs;
    }
    if (!seg) return;

    // 判定
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

    if (bestNote) {
      const result = this._judge(bestNote, bestDiff, seg);
      this._addPlayerDot(currentTime, seg, result);
    } else {
      this._wrongTap(currentTime, seg);
      this._addPlayerDot(currentTime, seg, 'miss');
    }
  }

  _wrongTap(time, seg) {
    this.score = Math.max(0, this.score - 20);
    this.combo = 0;
    const wrongTexts = ['诶?', '不!'];
    const text = wrongTexts[Math.floor(Math.random() * wrongTexts.length)];
    this._addJudgeText(time, seg, text, '#FB7185');
    if (this.callbacks.onJudge) {
      this.callbacks.onJudge({ result: 'what', combo: 0, score: this.score });
    }
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

    this._addJudgeText(note.time, seg, this._judgeText(result), this._resultColor(result), this._judgeSize(result));

    // 若该 note 是此 play 段的最后一个，且整段全部打成了 Perfect：
    // 在最后一次 Q 的正上方升起小号彩色「Qute！」，并在下方放烟花
    const st = this.segmentStates[seg._index];
    const lastNote = st && st.notes[st.notes.length - 1];
    if (result === 'perfect' && note === lastNote && this._isAllPerfect(seg._index)) {
      this._rewardAllPerfectInline(note, seg);
    }

    if (this.callbacks.onJudge) {
      this.callbacks.onJudge({ result, combo: this.combo, score: this.score });
    }
    return result;
  }

  // ============================================
  // 每帧逻辑
  // ============================================
  _update(rawTime) {
    const currentTime = rawTime - this.audioOffset;
    const seg = this._findSegmentAt(currentTime);

    if (seg && seg.type === 'play') {
      const state = this.segmentStates[seg._index];
      for (const note of state.notes) {
        if (!note.judged && note.time < currentTime - 180) {
          this._judge(note, 999, seg);
        }
      }
    }

    if (seg && seg.type === 'tutorial') {
      const state = this.segmentStates[seg._index];
      for (const note of state.notes) {
        if (!note.demoHit && note.time <= currentTime && note.time > currentTime - 80) {
          note.demoHit = true;
          this._addTutorialDot(note, seg);
          this._addJudgeText(note.time, seg, '打!', '#5EEAD4');
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
    this.tutorialDots = [];
    this.playerDots = [];
    this._lastSegIndex = -1;

    this.segmentStates = this.segments.map((seg, i) => {
      const notes = seg.notes.map(t => ({
        time: t, judged: false, judgeResult: null, demoHit: false
      }));
      return { notes, _index: i };
    });

    this.totalNotes = this.segments
      .filter(s => s.type === 'play')
      .reduce((sum, s) => sum + s.notes.length, 0);

    this._firstPlayIndex = this.segments.findIndex(s => s.type === 'play');
    this._firstPlayEnded = false;
    this._firstTutorialIndex = this.segments.findIndex(s => s.type === 'tutorial');
    this._turnShown = false;
  }

  // ============================================
  // 点位 DOM
  // ============================================

  /** 教程段：添加大白点（持久保留） */
  _addTutorialDot(note, seg) {
    const el = document.createElement('div');
    el.className = 'dot tutorial-dot';
    const ratio = (note.time - seg.start) / (seg.end - seg.start);
    el.style.left = (ratio * 100) + '%';
    this.notesLayer.appendChild(el);
    this.tutorialDots.push({ el, note, segIndex: seg._index });
    // 脉冲发光特效
    this._spawnRipple(ratio, seg, 'ripple-tutorial');
  }

  /** 打击段：添加小亮点（覆盖在大白点上） */
  _addPlayerDot(time, seg, result) {
    const el = document.createElement('div');
    el.className = 'dot player-dot';
    const ratio = (time - seg.start) / (seg.end - seg.start);
    el.style.left = (ratio * 100) + '%';
    this.notesLayer.appendChild(el);
    this.playerDots.push({ el, time, segIndex: seg._index });
    // 发光涟漪特效
    const rippleClass = result ? 'ripple-' + result : 'ripple-hit';
    this._spawnRipple(ratio, seg, rippleClass);
  }

  /** 生成涟漪特效 */
  _spawnRipple(ratio, seg, className) {
    const el = document.createElement('div');
    el.className = 'tap-ripple ' + className;
    el.style.left = (ratio * 100) + '%';
    this.notesLayer.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 700);
  }

  // 烟花特效：从指定位置向四周迸发一圈彩色粒子
  _spawnFireworks(ratio) {
    const colors = ['#5EEAD4', '#38BDF8', '#A78BFA', '#F472B6', '#FBBF77', '#FB7185'];
    const cx = (ratio * 100);
    const count = 14;
    for (let k = 0; k < count; k++) {
      const p = document.createElement('div');
      p.className = 'fw-particle';
      const color = colors[k % colors.length];
      p.style.background = color;
      p.style.boxShadow = '0 0 8px ' + color;
      p.style.left = cx + '%';
      p.style.top = '50%';
      // 随机角度 + 距离
      const ang = (Math.PI * 2 * k) / count + (Math.random() - 0.5) * 0.4;
      const dist = 60 + Math.random() * 70;
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist;
      p.style.setProperty('--dx', dx.toFixed(1) + 'px');
      p.style.setProperty('--dy', dy.toFixed(1) + 'px');
      p.style.animationDelay = (Math.random() * 120).toFixed(0) + 'ms';
      this.container.appendChild(p);
      setTimeout(() => { if (p.parentNode) p.parentNode.removeChild(p); }, 1100);
    }
  }

  // 检测某一段是否所有音符都是 Perfect（全 Q）
  _isAllPerfect(index) {
    const st = this.segmentStates[index];
    if (!st || !st.notes || st.notes.length === 0) return false;
    return st.notes.every(n => n.judged && n.judgeResult === 'perfect');
  }

  // 全 Q 奖励（整句结束时的整段大号版本，保留以备后用）
  _rewardAllPerfect() {
    this.finishEl.style.display = 'block';
    this.finishEl.classList.remove('show');
    void this.finishEl.offsetWidth;
    this.finishEl.classList.add('show');
    this._spawnFireworks(0.5);
    clearTimeout(this._quteTimer);
    this._quteTimer = setTimeout(() => {
      this.finishEl.classList.remove('show');
      this.finishEl.style.display = 'none';
    }, 2000);
  }

  // 全 Q 奖励（内联小号版）：与最后一次 Q 同时，出现在它上方，下方放烟花
  _rewardAllPerfectInline(note, seg) {
    // 定位到该 note 在轨道上的横向位置、轨道上方
    const ratio = (note.time - seg.start) / (seg.end - seg.start);
    const el = this.quteInlineEl;
    el.style.left = (ratio * 100) + '%';
    el.style.top = 'calc(50% - 92px)';
    el.style.display = 'block';
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    // 烟花从轨道中心（稍偏该 note 位置）向下方迸发
    this._spawnFireworks(ratio);
    clearTimeout(this._quteInlineTimer);
    this._quteInlineTimer = setTimeout(() => {
      el.classList.remove('show');
      el.style.display = 'none';
    }, 1600);
  }

  /** 段落切换：清空当前轨道上的所有点 */
  _clearDots() {
    if (this.notesLayer) this.notesLayer.innerHTML = '';
    this.tutorialDots = [];
    this.playerDots = [];
  }

  // ============================================
  // 渲染循环
  // ============================================
  _makeScanline() {
    const el = document.createElement('div');
    el.className = 'track-scanline';
    el.style.display = 'none';
    return el;
  }

  _findVisibleScanSegs(t) {
    const result = [];
    for (let i = 0; i < this.segments.length; i++) {
      const s = this.segments[i];
      const segDur = s.end - s.start;
      if (segDur <= 0) continue;
      const ratio = (t - s.start) / segDur;
      const pos = ratio * 100;
      if (pos >= -10 && pos <= 110) {
        result.push({ ...s, _index: i, _ratio: ratio, _pos: pos });
      }
    }
    return result;
  }

  _positionScanlines(visibleSegs) {
    for (let i = 0; i < this.scanlines.length; i++) {
      const sl = this.scanlines[i];
      if (i < visibleSegs.length) {
        const vs = visibleSegs[i];
        sl.style.left = vs._pos + '%';
        sl.style.display = 'block';
        const playMode = vs.playMode || 1;
        let opacity = 1;
        if (vs.type === 'play' && vs._ratio >= 0 && vs._ratio <= 1) {
          if (playMode === 2) opacity = Math.max(0, 1 - vs._ratio * 2.5);
          else if (playMode === 3) opacity = 0;
        }
        sl.style.opacity = opacity;
      } else {
        sl.style.display = 'none';
      }
    }
  }

  _loop() {
    this._draw();
    this.rafId = requestAnimationFrame(() => this._loop());
  }

  _stopLoop() {
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
  }

  _draw() {
    const t = this._getTime();
    const seg = this._findSegmentAt(t);
    if (!seg || !this.track) return;

    // 第一个段落之前的空白：显示「准备...」
    const firstSeg = this.segments[0];
    if (firstSeg && t < firstSeg.start) {
      this.labelEl.textContent = '准备...';
      this.labelEl.className = 'game-seg-label label-idle';
      this._updateProgressBar(t);
      this._updateJudgeTexts();
      return;
    }

    // 最后一个段落结束后的尾部：显示「辛苦了～好棒呀」
    const lastSeg = this.segments[this.segments.length - 1];
    if (lastSeg && t >= lastSeg.end) {
      this.labelEl.textContent = '辛苦了～好棒呀';
      this.labelEl.className = 'game-seg-label label-idle';
      this.track.style.background = 'rgba(255,255,255,0.03)';
      this.track.style.borderColor = 'rgba(255,255,255,0.05)';
      // 隐藏扫描线
      this.scanlines.forEach(sl => sl.style.display = 'none');
      this._updateProgressBar(t);
      this._updateJudgeTexts();
      return;
    }

    // 段落标签
    const labels = {
      tutorial: { text: '记住节奏！', cls: 'label-tutorial' },
      play: { text: '轮到你打！', cls: 'label-play' },
      idle: { text: '休息一下～', cls: 'label-idle' }
    };
    const info = labels[seg.type];
    if (info) {
      this.labelEl.textContent = info.text;
      this.labelEl.className = 'game-seg-label ' + info.cls;
    }

    // 底板颜色渐变
    const segDur = seg.end - seg.start;
    const ratio = Math.max(0, Math.min(1, (t - seg.start) / segDur));
    const segColors = {
      tutorial: [94, 234, 212, 0.15],
      play:     [255, 255, 255, 0.88],
      idle:     [255, 255, 255, 0.03]
    };
    const base = [255, 255, 255, 0.05];
    const tgt = segColors[seg.type] || segColors.idle;
    let cr, cg, cb, ca;
    if (seg.type === 'play') {
      // play 段（轮到你打！）：内部透明不填色，只保留外层辉光激亮
      cr = 255; cg = 255; cb = 255; ca = 0;
    } else {
      cr = Math.round(base[0] + (tgt[0] - base[0]) * ratio);
      cg = Math.round(base[1] + (tgt[1] - base[1]) * ratio);
      cb = Math.round(base[2] + (tgt[2] - base[2]) * ratio);
      ca = (base[3] + (tgt[3] - base[3]) * ratio).toFixed(3);
    }
    const bgColor = `rgba(${cr},${cg},${cb},${ca})`;
    const bdA = (0.25 * ratio).toFixed(3);
    const bdColor = `rgba(${tgt[0]},${tgt[1]},${tgt[2]},${bdA})`;
    this.track.style.background = bgColor;
    this.track.style.borderColor = bdColor;
    // play 段（轮到你打！）：整条 bar 激亮发光、底色变白
    if (seg.type === 'play') {
      this.track.style.boxShadow = '0 0 28px rgba(255,255,255,0.9), 0 0 60px rgba(255,255,255,0.55)';
      this.track.style.borderColor = 'rgba(255,255,255,0.95)';
    } else {
      this.track.style.boxShadow = 'none';
    }

    // 扫描线
    const visibleSegs = this._findVisibleScanSegs(t);
    this._positionScanlines(visibleSegs);

    // 第一个 tutorial 段结束前 0.6 秒弹出「到你！」
    if (seg._index === this._firstTutorialIndex && !this._turnShown && t >= seg.end - 600) {
      this._turnShown = true;
      this._showPraise('到你！', 1600);
    }

    // 段落切换
    if (seg._index !== this._lastSegIndex) {
      // 进入任何新段时先清空上一段的中央提示（praise 复用，统一管理）
      this._hidePraise();
      // 进入 tutorial 段：清空轨道点
      if (seg.type === 'tutorial') {
        this._clearDots();
      }
      // 进入 idle 段：清空轨道点 + 在正中显示自定义 message
      if (seg.type === 'idle') {
        this._clearDots();
        this._showPraise(seg.message || '休息一下～', 0);
      }
      // 从第一个 play 段切走时显示「好！」
      if (this._lastSegIndex === this._firstPlayIndex && !this._firstPlayEnded) {
        this._firstPlayEnded = true;
        this._showPraise('Qute🫰！');
      }
      this._lastSegIndex = seg._index;
    }

    this._updateJudgeTexts();
    this._updateProgressBar(t);
  }

  _updateProgressBar(t) {
    if (!this.progressEl) return;
    const pct = Math.min(100, Math.max(0, (t / this.duration) * 100));
    this.progressEl.style.width = pct + '%';
  }

  // ============================================
  // 飘动判定文字
  // ============================================
  _addJudgeText(time, seg, text, color, fontSize) {
    const el = document.createElement('div');
    el.className = 'judge-text';
    el.textContent = text;
    el.style.color = color;
    if (fontSize) el.style.fontSize = fontSize + 'px';
    const ratio = (time - seg.start) / (seg.end - seg.start);
    el.style.left = (ratio * 100) + '%';
    this.judgeLayer.appendChild(el);
    this.judgeTexts.push({ el, born: performance.now() });
  }

  _showPraise(text, duration) {
    this.praiseEl.textContent = text;
    this.praiseEl.classList.remove('show', 'persist');
    void this.praiseEl.offsetWidth; // 触发重绘以重新播放动画
    if (duration) {
      // 限时弹窗（到你！/好！）：走 praisePop 动画后淡出
      this.praiseEl.style.animationDuration = duration + 'ms';
      this.praiseEl.classList.add('show');
    } else {
      // 常驻显示（idle message 等）：不闪退，停在可见态
      this.praiseEl.style.animationDuration = '';
      this.praiseEl.classList.add('show', 'persist');
    }
  }

  /** 隐藏中央提示（praise 复用） */
  _hidePraise() {
    this.praiseEl.classList.remove('show', 'persist');
    this.praiseEl.textContent = '';
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
    return { perfect: '#C4B5FD', great: '#38BDF8', good: '#94A3B8', miss: '#FB7185' }[result] || '#fff';
  }
  _judgeText(result) {
    return { perfect: 'Q!', great: '好', good: '嗯', miss: '呀!' }[result] || result;
  }
  _judgeSize(result) {
    return result === 'perfect' ? 20 : 0;
  }
}
