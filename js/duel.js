/**
 * 影子对决核心逻辑。
 * JudgeEngine 同时服务单人游戏与对决双方，保证判定规则一致。
 */

class JudgeEngine {
  constructor(totalNotes = 0) {
    this.reset(totalNotes);
  }

  reset(totalNotes = this.totalNotes || 0) {
    this.totalNotes = totalNotes;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.perfectCount = 0;
    this.greatCount = 0;
    this.goodCount = 0;
    this.missCount = 0;
    this.judgeCount = 0;
  }

  judge(diff) {
    const absoluteDiff = Math.abs(diff);
    let result = 'miss';

    if (absoluteDiff <= 50) {
      result = 'perfect';
      this.score += 100 + this.combo * 2;
      this.perfectCount += 1;
    } else if (absoluteDiff <= 100) {
      result = 'great';
      this.score += 70 + this.combo;
      this.greatCount += 1;
    } else if (absoluteDiff <= 150) {
      result = 'good';
      this.score += 40;
      this.goodCount += 1;
    } else {
      this.missCount += 1;
    }

    if (result === 'miss') {
      this.combo = 0;
    } else {
      this.combo += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
    }
    this.judgeCount += 1;

    return { result, ...this.getLiveState() };
  }

  wrongTap() {
    this.score = Math.max(0, this.score - 20);
    this.combo = 0;
    return { result: 'what', ...this.getLiveState() };
  }

  getAccuracy() {
    if (this.totalNotes === 0) return 0;
    const weighted = this.perfectCount + this.greatCount * 0.7 + this.goodCount * 0.4;
    return Math.round((weighted / this.totalNotes) * 1000) / 10;
  }

  getLiveState() {
    return {
      score: this.score,
      combo: this.combo,
      maxCombo: this.maxCombo
    };
  }

  getResult() {
    return {
      score: this.score,
      maxCombo: this.maxCombo,
      perfect: this.perfectCount,
      great: this.greatCount,
      good: this.goodCount,
      miss: this.missCount,
      total: this.totalNotes,
      accuracy: this.getAccuracy()
    };
  }
}

function compareDuelResults(playerResult, shadowResult) {
  const comparisons = [
    ['score', playerResult.score, shadowResult.score],
    ['accuracy', playerResult.accuracy, shadowResult.accuracy],
    ['maxCombo', playerResult.maxCombo, shadowResult.maxCombo]
  ];

  for (const [decidedBy, playerValue, shadowValue] of comparisons) {
    if (playerValue === shadowValue) continue;
    return {
      outcome: playerValue > shadowValue ? 'win' : 'lose',
      decidedBy,
      scoreDiff: playerResult.score - shadowResult.score
    };
  }

  return { outcome: 'draw', decidedBy: 'draw', scoreDiff: 0 };
}

function createDuelResult(playerResult, shadowResult, aborted = false) {
  return {
    player: playerResult,
    shadow: shadowResult,
    aborted,
    winner: aborted
      ? { outcome: 'aborted', decidedBy: 'aborted', scoreDiff: playerResult.score - shadowResult.score }
      : compareDuelResults(playerResult, shadowResult)
  };
}

class DuelParticipantState {
  constructor(targetNotes) {
    this.targetNotes = targetNotes;
    this.judgeEngine = new JudgeEngine(targetNotes.length);
    this.notes = [];
    this.reset();
  }

  reset() {
    this.notes = this.targetNotes.map(time => ({ time, judged: false, result: null }));
    this.judgeEngine.reset(this.targetNotes.length);
  }

  tapAt(eventTime) {
    let bestNote = null;
    let bestDiff = Infinity;

    this.notes.forEach(note => {
      if (note.judged) return;
      const diff = note.time - eventTime;
      if (Math.abs(diff) <= 180 && Math.abs(diff) < Math.abs(bestDiff)) {
        bestNote = note;
        bestDiff = diff;
      }
    });

    if (!bestNote) {
      return { ...this.judgeEngine.wrongTap(), eventTime, noteTime: null };
    }

    const judgeInfo = this.judgeEngine.judge(bestDiff);
    bestNote.judged = true;
    bestNote.result = judgeInfo.result;
    return { ...judgeInfo, eventTime, noteTime: bestNote.time };
  }

  advanceTo(currentTime) {
    const misses = [];
    this.notes.forEach(note => {
      if (note.judged || note.time >= currentTime - 180) return;
      const judgeInfo = this.judgeEngine.judge(999);
      note.judged = true;
      note.result = judgeInfo.result;
      misses.push({ ...judgeInfo, eventTime: currentTime, noteTime: note.time });
    });
    return misses;
  }

  getResult() {
    return this.judgeEngine.getResult();
  }
}

class DuelGame {
  constructor(song, shadow, audioEngine, callbacks = {}) {
    this.song = song;
    this.shadow = shadow;
    this.audio = audioEngine;
    this.callbacks = callbacks;
    this.duration = song.duration * 1000;
    this.audioOffset = -70;
    this.phase = 'idle';
    this.shadowEventIndex = 0;
    this.targetNotes = getDuelTargetNotes(song);
    this.playerState = new DuelParticipantState(this.targetNotes);
    this.shadowState = new DuelParticipantState(this.targetNotes);
    this.aborted = false;
  }

  init() {
    this.reset();
  }

  reset() {
    this.playerState.reset();
    this.shadowState.reset();
    this.shadowEventIndex = 0;
    this.aborted = false;
    this.phase = 'idle';
  }

  start() {
    if (this.phase === 'playing') return;
    this.reset();
    this.phase = 'playing';
    this.audio.onTimeUpdate = rawTime => this._update(rawTime);
    this.audio.playFrom(0);
    if (this.callbacks.onPhaseChange) this.callbacks.onPhaseChange('playing');
  }

  tap() {
    if (this.phase !== 'playing') return null;
    const eventTime = this._getTime(this.audio.getCurrentTime());
    const judgeInfo = this.playerState.tapAt(eventTime);
    if (this.callbacks.onPlayerJudge) this.callbacks.onPlayerJudge(judgeInfo);
    return judgeInfo;
  }

  abort() {
    if (this.phase !== 'playing' && this.phase !== 'paused') return;
    this._end(true);
  }

  pause() {
    if (this.phase !== 'playing') return;
    this.audio.pause();
    this.phase = 'paused';
    if (this.callbacks.onPhaseChange) this.callbacks.onPhaseChange('paused');
  }

  resume() {
    if (this.phase !== 'paused') return;
    const resumeTime = this.audio.getCurrentTime();
    this.phase = 'playing';
    this.audio.onTimeUpdate = rawTime => this._update(rawTime);
    this.audio.playFrom(resumeTime);
    if (this.callbacks.onPhaseChange) this.callbacks.onPhaseChange('playing');
  }

  destroy() {
    if (this.phase === 'playing' || this.phase === 'paused') this.audio.stop();
    this.audio.onTimeUpdate = null;
    this.phase = 'destroyed';
  }

  _getTime(rawTime) {
    return rawTime - this.audioOffset;
  }

  _update(rawTime) {
    if (this.phase !== 'playing') return;
    const currentTime = this._getTime(rawTime);
    this._consumeShadowEvents(currentTime);

    this.playerState.advanceTo(currentTime).forEach(judgeInfo => {
      if (this.callbacks.onPlayerJudge) this.callbacks.onPlayerJudge(judgeInfo);
    });
    this.shadowState.advanceTo(currentTime).forEach(judgeInfo => {
      if (this.callbacks.onShadowJudge) this.callbacks.onShadowJudge(judgeInfo);
    });

    if (this.callbacks.onTimeUpdate) {
      this.callbacks.onTimeUpdate({
        currentTime,
        duration: this.duration,
        player: this.playerState.judgeEngine.getLiveState(),
        shadow: this.shadowState.judgeEngine.getLiveState()
      });
    }

    if (currentTime >= this.duration) this._end(false);
  }

  _consumeShadowEvents(currentTime) {
    const offset = this.shadow.recordingOffsetMs || 0;
    while (this.shadowEventIndex < this.shadow.events.length) {
      const event = this.shadow.events[this.shadowEventIndex];
      const eventTime = event.time + offset;
      if (eventTime > currentTime) break;
      this.shadowEventIndex += 1;
      if (event.type !== 'tap') continue;
      const judgeInfo = this.shadowState.tapAt(eventTime);
      if (this.callbacks.onShadowJudge) this.callbacks.onShadowJudge(judgeInfo);
    }
  }

  _end(aborted) {
    if (this.phase === 'ended' || this.phase === 'aborted') return;
    if (!aborted) {
      this._consumeShadowEvents(this.duration + 1000);
      this.playerState.advanceTo(this.duration + 1000).forEach(judgeInfo => {
        if (this.callbacks.onPlayerJudge) this.callbacks.onPlayerJudge(judgeInfo);
      });
      this.shadowState.advanceTo(this.duration + 1000).forEach(judgeInfo => {
        if (this.callbacks.onShadowJudge) this.callbacks.onShadowJudge(judgeInfo);
      });
    }

    this.aborted = aborted;
    this.phase = aborted ? 'aborted' : 'ended';
    this.audio.stop();
    this.audio.onTimeUpdate = null;
    const result = createDuelResult(
      this.playerState.getResult(),
      this.shadowState.getResult(),
      aborted
    );
    if (this.callbacks.onPhaseChange) this.callbacks.onPhaseChange(this.phase);
    if (this.callbacks.onEnd) this.callbacks.onEnd(result);
  }
}

class DuelLaneRenderer {
  constructor(container, segments, role) {
    this.container = container;
    this.segments = segments;
    this.role = role;
    this.activeSegmentIndex = -1;
    this.track = null;
    this.notesLayer = null;
    this.scanline = null;
  }

  init() {
    this.container.innerHTML = '';
    this.track = document.createElement('div');
    this.track.className = `game-track duel-track duel-track-${this.role}`;
    this.notesLayer = document.createElement('div');
    this.notesLayer.className = 'track-notes';
    this.scanline = document.createElement('div');
    this.scanline.className = 'track-scanline';
    this.track.appendChild(this.notesLayer);
    this.track.appendChild(this.scanline);
    this.container.appendChild(this.track);
  }

  update(currentTime) {
    const segment = this._findSegmentAt(currentTime);
    if (!segment) {
      this.scanline.style.display = 'none';
      return;
    }

    if (segment._index !== this.activeSegmentIndex) {
      this.activeSegmentIndex = segment._index;
      this.notesLayer.innerHTML = '';
    }

    const duration = segment.end - segment.start;
    const ratio = duration > 0 ? (currentTime - segment.start) / duration : 0;
    this.scanline.style.display = 'block';
    this.scanline.style.left = `${Math.max(0, Math.min(100, ratio * 100))}%`;
    this.track.classList.toggle('is-scoring', segment.type === 'play');
    this.track.classList.toggle('is-resting', segment.type !== 'play');
  }

  renderJudge(judgeInfo) {
    const renderTime = judgeInfo.noteTime == null ? judgeInfo.eventTime : judgeInfo.noteTime;
    const segment = this._findSegmentAt(renderTime);
    if (!segment || segment.type !== 'play') return;
    const ratio = (renderTime - segment.start) / (segment.end - segment.start);
    const dot = document.createElement('div');
    dot.className = `dot player-dot duel-dot duel-dot-${judgeInfo.result}`;
    dot.style.left = `${Math.max(0, Math.min(100, ratio * 100))}%`;
    this.notesLayer.appendChild(dot);

    const text = document.createElement('div');
    text.className = `duel-judge duel-judge-${judgeInfo.result}`;
    text.textContent = this._getJudgeText(judgeInfo.result);
    text.style.left = `${Math.max(0, Math.min(100, ratio * 100))}%`;
    this.container.appendChild(text);
    setTimeout(() => text.remove(), 760);
  }

  destroy() {
    this.container.innerHTML = '';
    this.activeSegmentIndex = -1;
  }

  _findSegmentAt(time) {
    for (let index = 0; index < this.segments.length; index++) {
      const segment = this.segments[index];
      if (time >= segment.start && time < segment.end) return { ...segment, _index: index };
    }
    return null;
  }

  _getJudgeText(result) {
    return { perfect: 'Q!', great: '好', good: '嗯', miss: '呀!', what: '诶?' }[result] || result;
  }
}
