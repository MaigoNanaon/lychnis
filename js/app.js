/**
 * Lychnis 主应用逻辑
 * 负责页面跳转、UI 交互、游戏流程串联
 */

(function () {
  'use strict';

  // ============================================
  // 状态管理
  // ============================================
  const state = {
    currentSong: null,       // 当前选中的歌曲对象
    audio: new AudioEngine(),
    game: null,              // RhythmGame 实例
    gameResult: null,        // 游戏结果
  };

  // ============================================
  // DOM 引用
  // ============================================
  const $ = (sel) => document.querySelector(sel);
  const pages = {
    library: $('#page-library'),
    player: $('#page-player'),
    game: $('#page-game'),
    share: $('#page-share'),
  };

  // ============================================
  // 页面切换
  // ============================================
  function showPage(name) {
    Object.values(pages).forEach(p => p.classList.remove('active'));
    pages[name].classList.add('active');
  }

  // ============================================
  // Toast
  // ============================================
  let toastTimer = null;
  function showToast(msg, duration = 2000) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), duration);
  }

  // ============================================
  // 辅助函数
  // ============================================
  function formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function getDifficultyClass(diff) {
    const map = { '简单': 'diff-easy', '中等': 'diff-medium', '困难': 'diff-hard', '专家': 'diff-expert' };
    return map[diff] || '';
  }

  function setCoverBackground(el, song) {
    if (song.cover) {
      el.innerHTML = `<img src="${song.cover}" alt="cover">`;
    } else {
      const [c1, c2] = song.color;
      el.style.background = `linear-gradient(135deg, ${c1}, ${c2})`;
      el.innerHTML = `<span style="font-size:28px">🎵</span>`;
    }
  }

  // ============================================
  // 页面1: 曲库
  // ============================================
  function initLibrary() {
    const list = $('#song-list');
    list.innerHTML = '';
    SONGS.forEach(song => {
      const card = document.createElement('div');
      card.className = 'song-card';
      card.innerHTML = `
        <div class="song-cover"></div>
        <div class="song-info">
          <div class="song-title">${song.title}</div>
          <div class="song-artist">${song.artist}</div>
          <div class="song-meta">
            <span class="song-badge">BPM ${song.bpm}</span>
            <span class="song-badge ${getDifficultyClass(song.difficulty)}">${song.difficulty}</span>
            <span class="song-badge">${song.duration}s</span>
          </div>
        </div>
      `;
      const coverEl = card.querySelector('.song-cover');
      setCoverBackground(coverEl, song);
      card.addEventListener('click', () => openPlayer(song));
      list.appendChild(card);
    });
  }

  // ============================================
  // 页面2: 播放页
  // ============================================
  let playerProgressTimer = null;

  function openPlayer(song) {
    state.currentSong = song;
    showPage('player');

    $('#player-song-title').textContent = song.title;
    setCoverBackground($('#cover-disc-inner'), song);
    $('#cover-disc').classList.remove('spinning');
    $('#time-total').textContent = formatTime(song.duration * 1000);
    $('#time-current').textContent = '0:00';
    $('#progress-filled').style.width = '0%';

    // 载入音频
    state.audio.load(song.audio).catch(() => {
      showToast('音频文件缺失，请先添加歌曲文件');
    });
  }

  function startPlayerTimer() {
    stopPlayerTimer();
    playerProgressTimer = setInterval(() => {
      const cur = state.audio.getCurrentTime();
      const total = state.currentSong.duration * 1000;
      const pct = Math.min(100, (cur / total) * 100);
      $('#progress-filled').style.width = pct + '%';
      $('#time-current').textContent = formatTime(cur);
      if (cur >= total) {
        stopPlayer();
      }
    }, 100);
  }

  function stopPlayerTimer() {
    if (playerProgressTimer) {
      clearInterval(playerProgressTimer);
      playerProgressTimer = null;
    }
  }

  function playPlayer() {
    if (!state.currentSong) return;
    state.audio.playFrom(state.audio.getCurrentTime());
    $('#cover-disc').classList.add('spinning');
    startPlayerTimer();
  }

  function pausePlayer() {
    state.audio.pause();
    $('#cover-disc').classList.remove('spinning');
    stopPlayerTimer();
  }

  function stopPlayer() {
    state.audio.stop();
    $('#cover-disc').classList.remove('spinning');
    stopPlayerTimer();
    $('#progress-filled').style.width = '0%';
    $('#time-current').textContent = '0:00';
  }

  // ============================================
  // 页面3: 游戏页
  // ============================================
  function openGame() {
    if (!state.currentSong) return;

    // 先停掉播放页的音频
    stopPlayer();

    showPage('game');
    $('#game-score').textContent = '0';
    $('#game-combo').textContent = '0';
    $('#game-accuracy').textContent = '100%';

    // 等待页面动画完成后初始化画布
    setTimeout(() => {
      const canvas = $('#game-canvas');
      const game = new RhythmGame(canvas, state.currentSong.chart, state.audio, state.currentSong.duration * 1000, {
        onJudge: (info) => {
          $('#game-score').textContent = info.score;
          $('#game-combo').textContent = info.combo;
          // 实时准确率
          if (game.totalNotes > 0) {
            const acc = game._calcAccuracy();
            $('#game-accuracy').textContent = acc.toFixed(1) + '%';
          }
        },
        onPhaseChange: (phase) => {
          if (phase === 'demo-done') {
            // 演示结束，自动切到玩家阶段
            showPhaseOverlay('play');
          } else if (phase === 'ended') {
            // 游戏结束，跳转分享页
            setTimeout(() => openShare(game), 600);
          }
        },
        onEnd: (result) => {
          state.gameResult = result;
        }
      });

      game.init();
      state.game = game;

      // 显示演示引导遮罩
      showPhaseOverlay('demo');
    }, 300);
  }

  function showPhaseOverlay(type) {
    const overlay = $('#phase-overlay');
    const title = $('#phase-overlay-title');
    const subtitle = $('#phase-overlay-subtitle');
    const btn = $('#phase-overlay-btn');

    if (type === 'demo') {
      title.textContent = '演示引导';
      subtitle.textContent = '先看一遍节奏，准备好后开始';
      btn.textContent = '开始演示';
      btn.onclick = () => {
        overlay.classList.remove('show');
        state.game.startDemo();
      };
    } else if (type === 'play') {
      title.textContent = '准备开始！';
      subtitle.textContent = '音符到达判定线时点击屏幕';
      btn.textContent = '开始挑战';
      btn.onclick = () => {
        overlay.classList.remove('show');
        state.game.startPlay();
      };
    }
    overlay.classList.add('show');
  }

  // 演示结束后自动切到玩家阶段（保留函数以备扩展）
  function onDemoEnd() {
    showPhaseOverlay('play');
  }

  function exitGame() {
    if (state.game) {
      state.game.destroy();
      state.game = null;
    }
    state.audio.stop();
    showPage('player');
  }

  // ============================================
  // 页面4: 分享页
  // ============================================
  function calcGrade(accuracy) {
    if (accuracy >= 95) return 'SS';
    if (accuracy >= 90) return 'S';
    if (accuracy >= 80) return 'A';
    if (accuracy >= 70) return 'B';
    if (accuracy >= 60) return 'C';
    return 'D';
  }

  function openShare(game) {
    const r = {
      score: game.score,
      maxCombo: game.maxCombo,
      perfect: game.perfectCount,
      great: game.greatCount,
      good: game.goodCount,
      miss: game.missCount,
      total: game.totalNotes,
      accuracy: game._calcAccuracy()
    };
    state.gameResult = r;

    showPage('share');
    $('#share-grade').textContent = calcGrade(r.accuracy);
    $('#share-score-value').textContent = r.score.toLocaleString();
    $('#share-score-accuracy').textContent = `准确率 ${r.accuracy.toFixed(1)}%  ·  最高连击 ${r.maxCombo}`;
    $('#share-perfect').textContent = r.perfect;
    $('#share-great').textContent = r.great;
    $('#share-good').textContent = r.good;
    $('#share-miss').textContent = r.miss;
  }

  // 生成分享图（Canvas 绘制）
  function generateShareImage() {
    const r = state.gameResult;
    if (!r) return;

    const canvas = document.createElement('canvas');
    const W = 750;
    const H = 1334; // iPhone 8 尺寸，适合社交分享
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // 背景
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#1a1a2e');
    bgGrad.addColorStop(0.5, '#16213e');
    bgGrad.addColorStop(1, '#0f0f1e');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // 装饰光晕
    const glowGrad = ctx.createRadialGradient(W / 2, 300, 0, W / 2, 300, 400);
    glowGrad.addColorStop(0, 'rgba(0,255,200,0.15)');
    glowGrad.addColorStop(1, 'rgba(0,255,200,0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, W, 600);

    // 顶部标题
    ctx.fillStyle = '#00FFC8';
    ctx.font = 'bold 36px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Lychnis 节奏挑战', W / 2, 100);

    // 歌曲信息
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '24px -apple-system, sans-serif';
    ctx.fillText(state.currentSong.title + ' - ' + state.currentSong.artist, W / 2, 140);

    // 等级（大字）
    const grade = calcGrade(r.accuracy);
    ctx.font = 'bold 180px -apple-system, sans-serif';
    const gradeGrad = ctx.createLinearGradient(0, 180, 0, 420);
    gradeGrad.addColorStop(0, '#00FFC8');
    gradeGrad.addColorStop(1, '#4ECDC4');
    ctx.fillStyle = gradeGrad;
    ctx.fillText(grade, W / 2, 380);

    // 分数
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 64px -apple-system, sans-serif';
    ctx.fillText(r.score.toLocaleString(), W / 2, 500);

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '24px -apple-system, sans-serif';
    ctx.fillText(`准确率 ${r.accuracy.toFixed(1)}%  ·  最高连击 ${r.maxCombo}`, W / 2, 560);

    // 分割线
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(80, 640);
    ctx.lineTo(W - 80, 640);
    ctx.stroke();

    // 统计项
    const stats = [
      { label: 'Perfect', value: r.perfect, color: '#00FFC8' },
      { label: 'Great', value: r.great, color: '#4ECDC4' },
      { label: 'Good', value: r.good, color: '#FFD93D' },
      { label: 'Miss', value: r.miss, color: '#FF6B6B' },
    ];
    const statY = 720;
    const statW = (W - 160) / 4;
    stats.forEach((s, i) => {
      const x = 80 + statW * i + statW / 2;
      ctx.fillStyle = s.color;
      ctx.font = 'bold 48px -apple-system, sans-serif';
      ctx.fillText(s.value, x, statY);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '22px -apple-system, sans-serif';
      ctx.fillText(s.label, x, statY + 40);
    });

    // 底部 logo & 口号
    ctx.fillStyle = 'rgba(0,255,200,0.6)';
    ctx.font = 'bold 28px -apple-system, sans-serif';
    ctx.fillText('🎵 Lychnis', W / 2, H - 120);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '20px -apple-system, sans-serif';
    ctx.fillText('用你喜欢的歌，玩节奏游戏', W / 2, H - 80);

    // 显示预览
    const dataUrl = canvas.toDataURL('image/png');
    $('#share-image-img').src = dataUrl;
    $('#share-image-preview').classList.add('show');
  }

  function downloadShareImage() {
    const img = $('#share-image-img');
    if (!img.src) return;
    const a = document.createElement('a');
    a.href = img.src;
    a.download = `lychnis-score-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('图片已保存，或长按图片保存到相册');
  }

  // ============================================
  // 事件绑定
  // ============================================
  function bindEvents() {
    // 播放页
    $('#player-back-btn').addEventListener('click', () => {
      stopPlayer();
      showPage('library');
    });
    $('#btn-play').addEventListener('click', playPlayer);
    $('#btn-pause').addEventListener('click', pausePlayer);
    $('#btn-stop').addEventListener('click', stopPlayer);
    $('#game-entry-btn').addEventListener('click', openGame);

    // 播放页进度条点击
    $('#progress-bar').addEventListener('click', (e) => {
      if (!state.currentSong) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      const seekMs = pct * state.currentSong.duration * 1000;
      state.audio.playFrom(seekMs);
      if (state.audio.audioEl.paused) {
        state.audio.pause();
      }
    });

    // 游戏页
    $('#game-back-btn').addEventListener('click', exitGame);
    $('#game-help-btn').addEventListener('click', () => {
      $('#help-modal').classList.add('show');
    });
    $('#help-modal-bg').addEventListener('click', () => {
      $('#help-modal').classList.remove('show');
    });
    $('#help-modal-close').addEventListener('click', () => {
      $('#help-modal').classList.remove('show');
    });

    // 游戏点击
    const tapArea = $('#game-tap-area');
    tapArea.addEventListener('pointerdown', (e) => {
      if (state.game && state.game.phase === 'play') {
        state.game.tap();
      }
    });

    // 分享页
    $('#btn-generate-image').addEventListener('click', generateShareImage);
    $('#btn-retry').addEventListener('click', () => {
      openGame();
    });
    $('#btn-back-library').addEventListener('click', () => {
      showPage('library');
    });
    $('#btn-close-preview').addEventListener('click', () => {
      $('#share-image-preview').classList.remove('show');
    });
    $('#btn-download-image').addEventListener('click', downloadShareImage);

    // 窗口尺寸变化
    window.addEventListener('resize', () => {
      if (state.game) {
        state.game._resize();
      }
    });
  }

  // ============================================
  // 演示阶段监听
  // ============================================
  // 修补 game.js 中的 startDemo，在演示结束后自动弹出"开始挑战"遮罩
  const _origStartDemo = RhythmGame.prototype.startDemo;
  RhythmGame.prototype.startDemo = function () {
    _origStartDemo.call(this);
    const self = this;
    const checkEnd = () => {
      if (self.phase === 'demo') {
        const t = self.audio.getCurrentTime();
        const dur = self.audio.audioEl.duration;
        if (isNaN(dur) || t >= dur * 1000 - 200) {
          self.phase = 'demo-done';
          self._stopLoop();
          self.audio.stop();
          if (self.callbacks.onPhaseChange) self.callbacks.onPhaseChange('demo-done');
          return;
        }
        requestAnimationFrame(checkEnd);
      }
    };
    requestAnimationFrame(checkEnd);
  };

  // ============================================
  // 初始化
  // ============================================
  function init() {
    initLibrary();
    bindEvents();
  }

  // DOM 就绪后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
