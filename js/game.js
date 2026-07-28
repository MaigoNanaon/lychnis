/**
 * 节奏游戏引擎 —— 扫描线式
 *
 * 玩法：
 * - 屏幕中央有一条圆角矩形长条，代表整首歌的时间轴
 * - 一条荧光竖条（扫描线）从左向右匀速滑过
 * - 谱面上的 tap 时间点对应长条上的固定位置（暗色圆点）
 * - 扫描线经过圆点时：
 *     演示阶段 → 自动点亮，播放打点效果
 *     玩家阶段 → 玩家需在此时点击屏幕进行判定
 *
 * 判定窗口（毫秒）：
 *   Perfect  ±50ms
 *   Great    ±100ms
 *   Good     ±150ms
 *   Miss     > 180ms 未点击
 */

class RhythmGame {
  constructor(canvas, chart, audioEngine, duration, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.chart = chart;
    this.audio = audioEngine;
    this.duration = duration;               // 总时长（毫秒）
    this.callbacks = callbacks;

    this.notes = [];
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.perfectCount = 0;
    this.greatCount = 0;
    this.goodCount = 0;
    this.missCount = 0;
    this.totalNotes = 0;
    this.judgeCount = 0;

    this.phase = 'idle';                    // idle | demo | play | ended
    this.rafId = null;

    // 布局参数（_resize 中计算）
    this.barX = 0;
    this.barY = 0;
    this.barW = 0;
    this.barH = 56;
    this.barRadius = 28;

    // 点击闪光
    this.tapFlash = 0;

    // 判定文字飘动列表 [{x, y, text, color, born}]
    this.judgeTexts = [];
  }

  // ============================================
  // 生命周期
  // ============================================
  init() {
    this._resize();
    this._resetNotes();
    this.totalNotes = this.notes.length;
    this._draw();
  }

  startDemo() {
    this.phase = 'demo';
    this._resetNotes();
    this.audio.onTimeUpdate = (t) => this._update(t);
    this.audio.playFrom(0);
    if (this.callbacks.onPhaseChange) this.callbacks.onPhaseChange('demo');
    this._loop();
  }

  startPlay() {
    this.phase = 'play';
    this._resetNotes();
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.perfectCount = 0;
    this.greatCount = 0;
    this.goodCount = 0;
    this.missCount = 0;
    this.judgeCount = 0;
    this.audio.onTimeUpdate = (t) => this._update(t);
    this.audio.playFrom(0);
    if (this.callbacks.onPhaseChange) this.callbacks.onPhaseChange('play');
    this._loop();
  }

  destroy() {
    this._stopLoop();
    this.audio.stop();
    this.audio.onTimeUpdate = null;
  }

  // ============================================
  // 玩家点击 & 判定
  // ============================================
  tap() {
    if (this.phase !== 'play') return;
    this.tapFlash = 1;

    const currentTime = this.audio.getCurrentTime();
    let bestNote = null;
    let bestDiff = Infinity;

    for (const note of this.notes) {
      if (note.judged) continue;
      const diff = note.time - currentTime;
      if (Math.abs(diff) <= 180 && Math.abs(diff) < Math.abs(bestDiff)) {
        bestNote = note;
        bestDiff = diff;
      }
    }

    if (bestNote) {
      this._judge(bestNote, bestDiff);
    }
  }

  _judge(note, diff) {
    const absDiff = Math.abs(diff);
    let result;
    if (absDiff <= 50) {
      result = 'perfect';
      this.score += 100 + this.combo * 2;
      this.perfectCount++;
    } else if (absDiff <= 100) {
      result = 'great';
      this.score += 70 + this.combo;
      this.greatCount++;
    } else if (absDiff <= 150) {
      result = 'good';
      this.score += 40;
      this.goodCount++;
    } else {
      result = 'miss';
      this.missCount++;
    }

    if (result !== 'miss') {
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    } else {
      this.combo = 0;
    }

    note.judged = true;
    note.judgeResult = result;
    note.judgeTime = performance.now();
    this.judgeCount++;

    // 添加飘动判定文字
    const nx = this._timeToX(note.time);
    this.judgeTexts.push({
      x: nx,
      y: this.barY - 16,
      text: result.toUpperCase(),
      color: this._resultColor(result),
      born: performance.now()
    });

    if (this.callbacks.onJudge) {
      this.callbacks.onJudge({ result, combo: this.combo, score: this.score });
    }
  }

  // ============================================
  // 每帧更新（逻辑）
  // ============================================
  _update(currentTime) {
    // 漏过的音符标记 miss
    for (const note of this.notes) {
      if (!note.judged && note.time < currentTime - 180) {
        this._judge(note, 999);
      }
    }

    // 演示阶段自动点亮
    if (this.phase === 'demo') {
      for (const note of this.notes) {
        if (!note.demoHit && note.time <= currentTime && note.time > currentTime - 80) {
          note.demoHit = true;
          note.demoHitTime = performance.now();
          // 演示也加飘动文字
          const nx = this._timeToX(note.time);
          this.judgeTexts.push({
            x: nx,
            y: this.barY - 16,
            text: 'TAP',
            color: '#00FFC8',
            born: performance.now()
          });
        }
      }
    }

    // 结束检查
    if (this.phase === 'play' && this.judgeCount >= this.totalNotes && this.totalNotes > 0) {
      this._end();
    }
  }

  _end() {
    this.phase = 'ended';
    this._stopLoop();
    this.audio.stop();
    if (this.callbacks.onPhaseChange) this.callbacks.onPhaseChange('ended');
    if (this.callbacks.onEnd) {
      this.callbacks.onEnd({
        score: this.score,
        maxCombo: this.maxCombo,
        perfect: this.perfectCount,
        great: this.greatCount,
        good: this.goodCount,
        miss: this.missCount,
        total: this.totalNotes,
        accuracy: this._calcAccuracy()
      });
    }
  }

  _calcAccuracy() {
    if (this.totalNotes === 0) return 0;
    const weight = this.perfectCount * 1 + this.greatCount * 0.7 + this.goodCount * 0.4;
    return Math.round((weight / this.totalNotes) * 1000) / 10;
  }

  _resetNotes() {
    this.notes = this.chart.map(n => ({
      ...n,
      judged: false,
      judgeResult: null,
      demoHit: false,
      demoHitTime: 0
    }));
    this.totalNotes = this.notes.length;
    this.judgeCount = 0;
    this.judgeTexts = [];
  }

  // ============================================
  // 渲染
  // ============================================
  _loop() {
    this._draw();
    this.rafId = requestAnimationFrame(() => this._loop());
  }

  _stopLoop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.viewW = rect.width;
    this.viewH = rect.height;

    // 长条布局：左右各留 28px 边距，垂直居中偏下
    const pad = 28;
    this.barX = pad;
    this.barW = this.viewW - pad * 2;
    this.barH = Math.min(56, this.viewH * 0.08);
    this.barRadius = this.barH / 2;
    this.barY = this.viewH * 0.52 - this.barH / 2;
  }

  /** 毫秒时间 → 长条上的 X 坐标 */
  _timeToX(time) {
    const ratio = Math.max(0, Math.min(1, time / this.duration));
    return this.barX + ratio * this.barW;
  }

  _draw() {
    const ctx = this.ctx;
    const w = this.viewW;
    const h = this.viewH;
    const t = this.audio.getCurrentTime();

    ctx.clearRect(0, 0, w, h);

    // 背景
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#1a1a2e');
    bg.addColorStop(1, '#16213e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // 长条轨道
    this._drawBar(ctx, t);

    // 音符圆点
    this._drawNotes(ctx, t);

    // 扫描线
    this._drawScanLine(ctx, t);

    // 点击闪光
    if (this.tapFlash > 0) {
      this._drawTapFlash(ctx, t);
      this.tapFlash -= 0.06;
      if (this.tapFlash < 0) this.tapFlash = 0;
    }

    // 飘动判定文字
    this._drawJudgeTexts(ctx);

    // 阶段提示
    this._drawPhaseText(ctx, w);
  }

  _drawBar(ctx, t) {
    const { barX: x, barY: y, barW: w, barH: hh, barRadius: r } = this;

    // 底层轨道（暗色圆角矩形）
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    this._roundRect(ctx, x, y, w, hh, r);
    ctx.fill();

    // 轨道边框
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    this._roundRect(ctx, x, y, w, hh, r);
    ctx.stroke();

    // 已扫过的进度填充
    const scanX = this._timeToX(t);
    if (scanX > x) {
      const fillW = Math.min(scanX - x, w);
      const grad = ctx.createLinearGradient(x, 0, scanX, 0);
      grad.addColorStop(0, 'rgba(0,255,200,0.05)');
      grad.addColorStop(1, 'rgba(0,255,200,0.20)');
      ctx.fillStyle = grad;
      this._roundRect(ctx, x, y, fillW, hh, r);
      ctx.fill();
    }
  }

  _drawScanLine(ctx, t) {
    const x = this._timeToX(t);
    const top = this.barY - 24;
    const bot = this.barY + this.barH + 24;

    // 光晕
    const glow = ctx.createLinearGradient(x - 18, 0, x + 18, 0);
    glow.addColorStop(0, 'rgba(0,255,200,0)');
    glow.addColorStop(0.5, 'rgba(0,255,200,0.45)');
    glow.addColorStop(1, 'rgba(0,255,200,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 18, top, 36, bot - top);

    // 主线
    ctx.strokeStyle = '#00FFC8';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#00FFC8';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bot);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 顶部 & 底部小圆点
    ctx.fillStyle = '#00FFC8';
    ctx.beginPath();
    ctx.arc(x, top, 5, 0, Math.PI * 2);
    ctx.arc(x, bot, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawNotes(ctx, t) {
    for (const note of this.notes) {
      const x = this._timeToX(note.time);
      const cy = this.barY + this.barH / 2;

      // 演示阶段自动点亮
      if (this.phase === 'demo' && note.demoHit) {
        const elapsed = performance.now() - (note.demoHitTime || 0);
        this._drawLitNote(ctx, x, cy, elapsed);
        continue;
      }

      // 玩家阶段已判定
      if (note.judged) {
        const elapsed = performance.now() - (note.judgeTime || 0);
        if (note.judgeResult !== 'miss') {
          this._drawLitNote(ctx, x, cy, elapsed);
        } else {
          this._drawMissNote(ctx, x, cy);
        }
        continue;
      }

      // 未判定：暗色圆点
      this._drawDimNote(ctx, x, cy);
    }
  }

  _drawDimNote(ctx, x, y) {
    const r = 7;
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  _drawLitNote(ctx, x, y, elapsed) {
    // 点亮后有脉冲扩散效果
    const pulse = Math.min(1, elapsed / 100);
    const r = 7 + pulse * 4;

    // 扩散环
    if (elapsed < 500) {
      const ringR = r + (elapsed / 500) * 20;
      const ringAlpha = (1 - elapsed / 500) * 0.6;
      ctx.strokeStyle = `rgba(0,255,200,${ringAlpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, ringR, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 发光圆点
    ctx.shadowColor = '#00FFC8';
    ctx.shadowBlur = 16;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.4, '#00FFC8');
    grad.addColorStop(1, '#008F7A');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  _drawMissNote(ctx, x, y) {
    ctx.strokeStyle = 'rgba(255,107,107,0.5)';
    ctx.lineWidth = 2;
    const s = 6;
    ctx.beginPath();
    ctx.moveTo(x - s, y - s);
    ctx.lineTo(x + s, y + s);
    ctx.moveTo(x + s, y - s);
    ctx.lineTo(x - s, y + s);
    ctx.stroke();
  }

  _drawTapFlash(ctx, t) {
    const x = this._timeToX(t);
    const y = this.barY + this.barH / 2;
    const r = 16 + (1 - this.tapFlash) * 30;
    const alpha = this.tapFlash * 0.5;

    ctx.strokeStyle = `rgba(0,255,200,${alpha})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  _drawJudgeTexts(ctx) {
    const now = performance.now();
    this.judgeTexts = this.judgeTexts.filter(jt => now - jt.born < 800);
    for (const jt of this.judgeTexts) {
      const elapsed = now - jt.born;
      const alpha = 1 - elapsed / 800;
      const offsetY = (elapsed / 800) * 24;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = jt.color;
      ctx.font = 'bold 15px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(jt.text, jt.x, jt.y - offsetY);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  _drawPhaseText(ctx, w) {
    ctx.textAlign = 'center';
    if (this.phase === 'demo') {
      ctx.fillStyle = 'rgba(0,255,200,0.9)';
      ctx.font = 'bold 15px -apple-system, sans-serif';
      ctx.fillText('演示中 · 请观察节奏', w / 2, this.barY - 48);
    } else if (this.phase === 'play') {
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = '14px -apple-system, sans-serif';
      ctx.fillText('扫描线经过圆点时点击屏幕', w / 2, this.barY - 48);
    }
    ctx.textAlign = 'left';
  }

  // ============================================
  // 工具方法
  // ============================================
  _resultColor(result) {
    return {
      perfect: '#00FFC8',
      great: '#4ECDC4',
      good: '#FFD93D',
      miss: '#FF6B6B'
    }[result] || '#fff';
  }

  _roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
