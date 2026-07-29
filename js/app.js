/**
 * Lychnis 主应用逻辑（段落式游戏）
 */

(function () {
  'use strict';

  const state = {
    currentSong: null,
    audio: new AudioEngine(),
    game: null,
    gameResult: null,
  };

  const $ = (sel) => document.querySelector(sel);
  const pages = {
    library: $('#page-library'),
    player: $('#page-player'),
    game: $('#page-game'),
    share: $('#page-share'),
  };

  function showPage(name) {
    Object.values(pages).forEach(p => p.classList.remove('active'));
    pages[name].classList.add('active');
  }

  let toastTimer = null;
  function showToast(msg, duration = 2000) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), duration);
  }

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
      el.innerHTML = `<span style="font-size:28px"></span>`;
    }
  }

  /** 从封面图提取加权平均色（亮度加权），返回 {r,g,b} */
  function extractCoverColor(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const size = 32;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, size, size);
          const data = ctx.getImageData(0, 0, size, size).data;
          let r = 0, g = 0, b = 0, totalWeight = 0;
          for (let i = 0; i < data.length; i += 4) {
            const cr = data[i], cg = data[i + 1], cb = data[i + 2];
            const ca = data[i + 3];
            if (ca < 128) continue;
            // 亮度加权：越亮的像素权重越高，避免暗色主导
            const lum = (0.299 * cr + 0.587 * cg + 0.114 * cb) / 255;
            const weight = 0.3 + lum * 0.7;
            r += cr * weight;
            g += cg * weight;
            b += cb * weight;
            totalWeight += weight;
          }
          if (totalWeight === 0) return resolve(null);
          resolve({
            r: Math.round(r / totalWeight),
            g: Math.round(g / totalWeight),
            b: Math.round(b / totalWeight)
          });
        } catch (e) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  /** 提取封面色并应用到播放页和游戏页背景 */
  async function applyCoverTheme(song) {
    let color = null;
    if (song.cover) {
      color = await extractCoverColor(song.cover);
    }
    if (!color && song.color) {
      const hex = song.color[0].replace('#', '');
      color = {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16)
      };
    }
    if (!color) return;

    // 直接用封面色压暗，不混固定底色：顶部保留封面色调，底部更深
    const darken = (cr, cg, cb, factor) => {
      const r = Math.round(cr * factor);
      const g = Math.round(cg * factor);
      const b = Math.round(cb * factor);
      return `rgb(${r}, ${g}, ${b})`;
    };

    const light = darken(color.r, color.g, color.b, 0.28);
    const mid = darken(color.r, color.g, color.b, 0.15);
    const dark = darken(color.r, color.g, color.b, 0.07);
    const coverColor = `rgb(${color.r}, ${color.g}, ${color.b})`;

    const player = $('#page-player');
    const game = $('#page-game');
    [player, game].forEach(p => {
      if (!p) return;
      p.style.setProperty('--cover-color', coverColor);
      p.style.setProperty('--cover-light', light);
      p.style.setProperty('--cover-mid', mid);
      p.style.setProperty('--cover-dark', dark);
    });
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
    applyCoverTheme(song);
    $('#cover-disc').classList.remove('spinning');
    $('#time-total').textContent = formatTime(song.duration * 1000);
    $('#time-current').textContent = '0:00';
    $('#progress-filled').style.width = '0%';

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
    stopPlayer();
    showPage('game');

    $('#game-score').textContent = '0';
    $('#game-combo').textContent = '0';
    $('#game-accuracy').textContent = '100%';

    setTimeout(() => {
      const stage = $('#game-stage');
      const game = new RhythmGame(
        stage,
        compileChart(state.currentSong),
        state.audio,
        state.currentSong.duration * 1000,
        {
          onJudge: (info) => {
            $('#game-score').textContent = info.score;
            $('#game-combo').textContent = info.combo;
            if (game.totalNotes > 0) {
              const acc = game._calcAccuracy();
              $('#game-accuracy').textContent = acc.toFixed(1) + '%';
            }
          },
          onPhaseChange: (phase) => {
            if (phase === 'ended') {
              $('#game-abort-btn').style.display = 'none';
              setTimeout(() => openShare(game), 800);
            }
          },
          onEnd: (result) => {
            state.gameResult = result;
          }
        }
      );

      game.init();
      state.game = game;
      showStartOverlay();
    }, 400);
  }

  function showStartOverlay() {
    const overlay = $('#phase-overlay');
    $('#phase-overlay-title').textContent = '准备好了吗？';
    $('#phase-overlay-subtitle').textContent = '先记住节奏，再照着节奏轻打屏幕吧！';
    $('#phase-overlay-btn').textContent = '开启Q弹';
    $('#phase-overlay-btn').onclick = () => {
      overlay.classList.remove('show');
      state.game.start();
      $('#game-abort-btn').style.display = 'block';
    };
    overlay.classList.add('show');
  }

  function exitGame() {
    $('#game-abort-btn').style.display = 'none';
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
    if (accuracy >= 90) return 'SS';
    if (accuracy >= 80) return 'S';
    if (accuracy >= 70) return 'A';
    if (accuracy >= 60) return 'B';
    return 'C';
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

    // 提交到本地排行榜
    const grade = calcGrade(r.accuracy);
    const rank = Leaderboard.submit({
      songId: state.currentSong.id,
      songTitle: state.currentSong.title,
      score: r.score,
      accuracy: r.accuracy,
      maxCombo: r.maxCombo,
      grade: grade,
      perfect: r.perfect,
      great: r.great,
      good: r.good,
      miss: r.miss,
      total: r.total
    });

    state.lastRank = rank;
    state.lastBest = Leaderboard.getBest(state.currentSong.id);

    showPage('share');
    $('#share-grade').textContent = grade;
    $('#share-score-value').textContent = r.score.toLocaleString();
    $('#share-score-accuracy').textContent = `准确率 ${r.accuracy.toFixed(1)}%  ·  最高连击 ${r.maxCombo}`;
    $('#share-perfect').textContent = r.perfect;
    $('#share-great').textContent = r.great;
    $('#share-good').textContent = r.good;
    $('#share-miss').textContent = r.miss;

    // 显示排名信息
    const rankInfo = $('#share-rank-info');
    const rankBadge = $('#share-rank-badge');
    const rankText = $('#share-rank-text');
    if (rank === 1) {
      rankInfo.style.display = 'flex';
      rankBadge.textContent = '#1';
      rankText.textContent = '🎉 本曲最高分！';
    } else if (rank && rank > 1) {
      rankInfo.style.display = 'flex';
      rankBadge.textContent = '#' + rank;
      rankText.textContent = `本曲第 ${rank} 名 · 最高 ${state.lastBest ? state.lastBest.score.toLocaleString() : 0}`;
    } else {
      rankInfo.style.display = 'none';
    }
  }

  function generateShareImage() {
    const r = state.gameResult;
    if (!r) return;

    const canvas = document.createElement('canvas');
    const W = 750;
    const H = 1334;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, '#0e3251');
  bgGrad.addColorStop(0.5, '#0a2438');
  bgGrad.addColorStop(1, '#061826');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

      const glowGrad = ctx.createRadialGradient(W / 2, 300, 0, W / 2, 300, 400);
  glowGrad.addColorStop(0, 'rgba(94,234,212,0.15)');
  glowGrad.addColorStop(1, 'rgba(94,234,212,0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, W, 600);

      ctx.fillStyle = '#A78BFA';
  ctx.font = 'bold 36px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Lychnis 节奏挑战', W / 2, 100);

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '24px -apple-system, sans-serif';
    ctx.fillText(state.currentSong.title + ' - ' + state.currentSong.artist, W / 2, 140);

    const grade = calcGrade(r.accuracy);
    ctx.font = 'bold 180px -apple-system, sans-serif';
      const gradeGrad = ctx.createLinearGradient(0, 180, 0, 420);
  gradeGrad.addColorStop(0, '#A78BFA');
  gradeGrad.addColorStop(1, '#38BDF8');
    ctx.fillStyle = gradeGrad;
    ctx.fillText(grade, W / 2, 380);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 64px -apple-system, sans-serif';
    ctx.fillText(r.score.toLocaleString(), W / 2, 500);

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '24px -apple-system, sans-serif';
    ctx.fillText(`准确率 ${r.accuracy.toFixed(1)}%  ·  最高连击 ${r.maxCombo}`, W / 2, 560);

    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(80, 640);
    ctx.lineTo(W - 80, 640);
    ctx.stroke();

    const stats = [
          { label: 'Perfect', value: r.perfect, color: '#A78BFA' },
    { label: 'Great', value: r.great, color: '#38BDF8' },
    { label: 'Good', value: r.good, color: '#94A3B8' },
    { label: 'Miss', value: r.miss, color: '#FB7185' },
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

      ctx.fillStyle = 'rgba(94,234,212,0.6)';
  ctx.font = 'bold 28px -apple-system, sans-serif';
  ctx.fillText('Lychnis', W / 2, H - 120);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '20px -apple-system, sans-serif';
    ctx.fillText('用你喜欢的歌，玩节奏游戏', W / 2, H - 80);

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
  // 排行榜弹窗
  // ============================================
  function showLeaderboard(songId) {
    const targetId = songId || (SONGS[0] && SONGS[0].id);
    state.lbCurrentSongId = targetId;

    // 渲染歌曲标签
    const tabsEl = $('#lb-song-tabs');
    tabsEl.innerHTML = '';
    SONGS.forEach(song => {
      const tab = document.createElement('div');
      tab.className = 'lb-song-tab' + (song.id === targetId ? ' active' : '');
      tab.textContent = song.title;
      tab.addEventListener('click', () => {
        state.lbCurrentSongId = song.id;
        tabsEl.querySelectorAll('.lb-song-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderLeaderboardList(song.id);
      });
      tabsEl.appendChild(tab);
    });

    renderLeaderboardList(targetId);
    $('#lb-modal').classList.add('show');
  }

  function closeLeaderboard() {
    $('#lb-modal').classList.remove('show');
  }

  function renderLeaderboardList(songId) {
    const list = Leaderboard.getBySong(songId);
    const listEl = $('#lb-list');

    if (list.length === 0) {
      listEl.innerHTML = '<div class="lb-empty">暂无记录，快去挑战吧！</div>';
      return;
    }

    const rankClasses = ['gold', 'silver', 'bronze'];
    listEl.innerHTML = '';
    list.forEach((r, i) => {
      const item = document.createElement('div');
      item.className = 'lb-item';
      const rankCls = i < 3 ? rankClasses[i] : '';
      item.innerHTML = `
        <div class="lb-item-rank ${rankCls}">${i + 1}</div>
        <div class="lb-item-grade">${r.grade}</div>
        <div class="lb-item-info">
          <div class="lb-item-score">${r.score.toLocaleString()}</div>
          <div class="lb-item-detail">${r.accuracy.toFixed(1)}% · 连击 ${r.maxCombo} · ${r.perfect}P ${r.great}G ${r.good}g ${r.miss}M</div>
        </div>
        <div class="lb-item-date">${r.date}</div>
      `;
      listEl.appendChild(item);
    });
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
      $('#game-abort-btn').addEventListener('pointerdown', (e) => {
    e.stopPropagation();
  });
  $('#game-abort-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!state.game || state.game.phase !== 'playing') return;
    state.game.abort();
  });
    $('#game-help-btn').addEventListener('click', () => {
      $('#help-modal').classList.add('show');
    });
    $('#help-modal-bg').addEventListener('click', () => {
      $('#help-modal').classList.remove('show');
    });
    $('#help-modal-close').addEventListener('click', () => {
      $('#help-modal').classList.remove('show');
    });

    $('#game-tap-area').addEventListener('pointerdown', () => {
      if (state.game && state.game.phase === 'playing') {
        state.game.tap();
      }
    });

    // 阻止触屏双击缩放
    let lastTouchEnd = 0;
    $('#game-tap-area').addEventListener('touchend', (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) e.preventDefault();
      lastTouchEnd = now;
    }, { passive: false });

    // 分享页
    $('#btn-generate-image').addEventListener('click', generateShareImage);
    $('#btn-retry').addEventListener('click', () => openGame());
    $('#btn-back-library').addEventListener('click', () => showPage('library'));
    $('#btn-close-preview').addEventListener('click', () => {
      $('#share-image-preview').classList.remove('show');
    });
    $('#btn-download-image').addEventListener('click', downloadShareImage);

    // 排行榜弹窗
    $('#lb-entry-btn').addEventListener('click', () => showLeaderboard());
    $('#btn-view-rank').addEventListener('click', () => showLeaderboard(state.currentSong ? state.currentSong.id : null));
    $('#lb-modal-bg').addEventListener('click', closeLeaderboard);
    $('#lb-modal-close').addEventListener('click', closeLeaderboard);
    $('#lb-clear-btn').addEventListener('click', () => {
      if (confirm('确定清空所有排行榜记录吗？')) {
        Leaderboard.clear();
        showToast('排行榜已清空');
        renderLeaderboardList(state.lbCurrentSongId || (SONGS[0] && SONGS[0].id));
      }
    });
  }

  // ============================================
  // 横竖屏适配：用 JS 主动管理旋转提示显隐
  // ============================================
  const portraitMq = window.matchMedia('(orientation: portrait)');

  function updateOrientation() {
    const hint = document.getElementById('rotate-hint');
    if (!hint) return;
    const isNarrow = window.innerWidth <= 920;
    const dismissed = sessionStorage.getItem('rotate-hint-dismissed') === '1';
    const shouldShow = portraitMq.matches && isNarrow && !dismissed;
    hint.classList.toggle('is-visible', !!shouldShow);
  }

  function handleViewportChange() {
    requestAnimationFrame(() => {
      updateOrientation();
      if (state.game) state.game._resize();
    });
  }

  // ============================================
  // 初始化
  // ============================================
  function init() {
    initLibrary();
    bindEvents();

    // 横竖屏事件监听
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', () => {
      setTimeout(handleViewportChange, 300);
    });
    if (portraitMq.addEventListener) {
      portraitMq.addEventListener('change', handleViewportChange);
    } else if (portraitMq.addListener) {
      portraitMq.addListener(handleViewportChange);
    }

    // 竖屏旋转提示按钮
    $('#rotate-hint-btn').addEventListener('click', () => {
      const hint = document.getElementById('rotate-hint');
      if (hint) {
        hint.classList.remove('is-visible');
        sessionStorage.setItem('rotate-hint-dismissed', '1');
      }
    });

    updateOrientation();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
