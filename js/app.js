/**
 * Q-beat! 主应用逻辑（段落式游戏）
 */

(function () {
  'use strict';

  const state = {
    currentSong: null,
    audio: new AudioEngine(),
    game: null,
    gameResult: null,
    mode: 'solo',
    duelPhase: 'home',
    matchSessionId: 0,
    matchTimer: null,
    matchDelayResolve: null,
    matchedShadow: null,
    lastMatchedShadowId: null,
    duelGame: null,
    duelResult: null,
    duelRenderers: null,
    duelResultTimer: null,
  };

  const $ = (sel) => document.querySelector(sel);
  const pages = {
    library: $('#page-library'),
    duelMatching: $('#page-duel-matching'),
    duelOpponent: $('#page-duel-opponent'),
    duelGame: $('#page-duel-game'),
    duelResult: $('#page-duel-result'),
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
    const duelGame = $('#page-duel-game');
    [player, game, duelGame].forEach(p => {
      if (!p) return;
      p.style.setProperty('--cover-color', coverColor);
      p.style.setProperty('--cover-light', light);
      p.style.setProperty('--cover-mid', mid);
      p.style.setProperty('--cover-dark', dark);
    });
  }

  // ============================================
  // 页面1: 曲库 (lychnis-redesign 风格卡片)
  // ============================================
  // 中文难度 → 英文 key（与 Tab 的 data-difficulty 对齐）
  const DIFF_KEY = { '简单': 'easy', '中等': 'medium', '困难': 'hard', '专家': 'expert' };

  function initLibrary() {
    const list = $('#song-list');
    list.innerHTML = '';
    SONGS.forEach((song, index) => {
      const card = document.createElement('div');
      card.className = 'song-item';
      card.setAttribute('data-difficulty', DIFF_KEY[song.difficulty] || 'all');
      card.tabIndex = 0;
      const num = String(index + 1).padStart(2, '0');
      card.innerHTML = `
        <div class="song-cover" aria-hidden="true">
          <img class="song-cover-img" src="${song.cover}" alt="">
          <div class="cover-overlay"></div>
          <span class="cover-num">${num}</span>
        </div>
        <div class="song-info">
          <h3 class="song-title">${song.title}</h3>
          <p class="song-artist">${song.artist}</p>
          <div class="song-tags">
            <span class="tag tag-bpm">BPM ${song.bpm}</span>
            <span class="tag tag-${DIFF_KEY[song.difficulty] || 'easy'}">${song.difficulty}</span>
            <span class="tag tag-time">${song.duration}s</span>
          </div>
        </div>
        <button class="play-btn" aria-label="播放 ${song.title}">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M8 5.5v13a1 1 0 001.5.87l11-6.5a1 1 0 000-1.74l-11-6.5A1 1 0 008 5.5z" fill="currentColor"/>
          </svg>
        </button>
      `;
      // 整张卡片点击 → 进播放页（与原来行为一致）
      card.addEventListener('click', () => openPlayer(song));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPlayer(song); }
      });
      // 播放小按钮：阻止冒泡后同样进播放页
      const playBtn = card.querySelector('.play-btn');
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openPlayer(song);
      });
      list.appendChild(card);
    });
  }

  // Tab 难度筛选
  function initLibraryTabs() {
    const tabBar = document.querySelector('.tab-bar');
    if (!tabBar) return;
    tabBar.addEventListener('click', (e) => {
      const tab = e.target.closest('.tab-item');
      if (!tab) return;
      tabBar.querySelectorAll('.tab-item').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const diff = tab.getAttribute('data-difficulty');
      document.querySelectorAll('#song-list .song-item').forEach(item => {
        const d = item.getAttribute('data-difficulty');
        if (diff === 'all' || d === diff) {
          item.classList.remove('filtered-out');
        } else {
          item.classList.add('filtered-out');
        }
      });
    });
  }

  // ============================================
  // 影子对决：匹配与对手确认
  // ============================================
  function getLocalPlayerRating() {
    const stored = Number(localStorage.getItem('qbeat-player-rating'));
    return Number.isFinite(stored) && stored > 0 ? stored : 1200;
  }

  function clearMatchTimer() {
    if (state.matchTimer) clearTimeout(state.matchTimer);
    state.matchTimer = null;
    if (state.matchDelayResolve) state.matchDelayResolve();
    state.matchDelayResolve = null;
  }

  function loadAudioWithTimeout(song, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('audio-load-timeout')), timeoutMs);
      state.audio.load(song.audio).then(value => {
        clearTimeout(timeout);
        resolve(value);
      }).catch(error => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  function selectMatchedShadow() {
    const playerRating = getLocalPlayerRating();
    const candidates = validateShadowPool()
      .filter(result => result.valid)
      .map(result => result.shadow)
      .sort((left, right) => {
        const leftGap = Math.abs(left.profile.rating - playerRating);
        const rightGap = Math.abs(right.profile.rating - playerRating);
        return leftGap - rightGap;
      });

    if (candidates.length > 0) {
      return candidates.find(shadow => shadow.id !== state.lastMatchedShadowId) || candidates[0];
    }
    const fallbackSong = SONGS.find(song => getDuelTargetNotes(song).length > 0) || SONGS[0];
    return generateFallbackShadow(fallbackSong, `match-${state.matchSessionId}`);
  }

  function renderMatchedOpponent(shadow) {
    const song = getSongById(shadow.songId);
    if (!song) {
      showToast('对手曲目不可用，请重新匹配');
      cancelShadowMatch();
      return;
    }

    state.matchedShadow = shadow;
    state.lastMatchedShadowId = shadow.id;
    state.currentSong = song;
    state.duelPhase = 'opponent-ready';
    $('#duel-opponent-avatar').textContent = shadow.profile.name.slice(-1);
    $('#duel-opponent-name').textContent = shadow.profile.name;
    $('#duel-opponent-source').textContent = shadow.source === 'recorded' ? '历史影像' : '训练影子';
    $('#duel-opponent-rating').textContent = shadow.profile.rating;
    $('#duel-song-cover').src = song.cover;
    $('#duel-song-cover').alt = `${song.title} 封面`;
    $('#duel-song-title').textContent = song.title;
    $('#duel-song-meta').textContent = `${song.artist} · ${song.difficulty} · ${song.duration}s`;
    showPage('duelOpponent');
  }

  function startShadowMatch() {
    if (state.duelPhase === 'matching') return;
    stopPlayer();
    clearMatchTimer();
    state.mode = 'shadow-duel';
    state.duelPhase = 'matching';
    state.matchedShadow = null;
    state.matchSessionId += 1;
    const sessionId = state.matchSessionId;
    const playerRating = getLocalPlayerRating();
    $('#duel-match-skill-label').textContent = `当前能力值 ${playerRating} · 正在分析节奏表现`;
    $('#duel-match-retry-btn').classList.remove('show');
    $('.duel-matching-dots').style.display = 'flex';
    showPage('duelMatching');

    const shadow = selectMatchedShadow();
    const song = getSongById(shadow.songId);
    const minimumDelay = new Promise(resolve => {
      state.matchDelayResolve = resolve;
      state.matchTimer = setTimeout(() => {
        state.matchTimer = null;
        state.matchDelayResolve = null;
        resolve();
      }, 3000);
    });
    const audioReady = song
      ? loadAudioWithTimeout(song).then(() => true).catch(() => false)
      : Promise.resolve(false);

    Promise.all([minimumDelay, audioReady]).then(([, loaded]) => {
      if (state.matchSessionId !== sessionId || state.duelPhase !== 'matching') return;
      state.matchTimer = null;
      if (!loaded) {
        state.duelPhase = 'match-error';
        $('#duel-match-skill-label').textContent = '歌曲加载失败，请检查网络或重新尝试';
        $('.duel-matching-dots').style.display = 'none';
        $('#duel-match-retry-btn').classList.add('show');
        return;
      }
      renderMatchedOpponent(shadow);
    });
  }

  function cancelShadowMatch() {
    clearMatchTimer();
    state.audio.stop();
    state.matchSessionId += 1;
    state.duelPhase = 'home';
    state.matchedShadow = null;
    state.mode = 'solo';
    showPage('library');
  }

  function confirmShadowDuel() {
    if (!state.matchedShadow || !state.currentSong) return;
    openDuelGame();
  }

  function updateDuelLiveStats(side, judgeInfo) {
    $(`#duel-${side}-score`).textContent = judgeInfo.score;
    $(`#duel-${side}-combo`).textContent = judgeInfo.combo;
  }

  function updateDuelLead(playerScore, shadowScore) {
    const diff = playerScore - shadowScore;
    $('#duel-score-diff').textContent = `分差 ${Math.abs(diff)}`;
    $('#duel-lead-label').textContent = diff === 0 ? '势均力敌' : diff > 0 ? '你暂时领先' : '影子暂时领先';
  }

  function applyDuelRating(result) {
    if (result.aborted || result.ratingApplied) return null;
    const currentRating = getLocalPlayerRating();
    const shadowRating = state.matchedShadow.profile.rating;
    const expected = 1 / (1 + Math.pow(10, (shadowRating - currentRating) / 400));
    const actual = result.winner.outcome === 'win' ? 1 : result.winner.outcome === 'draw' ? 0.5 : 0;
    const nextRating = Math.max(600, Math.round(currentRating + 32 * (actual - expected)));
    localStorage.setItem('qbeat-player-rating', String(nextRating));
    result.ratingApplied = true;
    return { before: currentRating, after: nextRating, delta: nextRating - currentRating };
  }

  function openDuelResult(result) {
    exitDuelGame(false);
    state.duelResult = result;
    state.duelPhase = result.aborted ? 'aborted' : 'finished';
    const outcome = result.winner.outcome;
    const display = {
      win: ['WIN', '对决胜利', '你以稳定的节奏赢下了这场对决'],
      lose: ['LOSE', '惜败于影子', '只差一点，再挑战一次就能反超'],
      draw: ['DRAW', '真正的旗鼓相当', '你们打出了完全相同的结果'],
      aborted: ['STOP', '本局已中止', '中止对局不会影响你的能力值']
    }[outcome];

    $('#duel-result-emblem').textContent = display[0];
    $('#duel-result-emblem').className = `duel-result-emblem is-${outcome}`;
    $('#duel-result-title').textContent = display[1];
    $('#duel-result-subtitle').textContent = display[2];
    $('#duel-result-shadow-name').textContent = state.matchedShadow.profile.name;
    $('#duel-result-player-score').textContent = result.player.score.toLocaleString();
    $('#duel-result-shadow-score').textContent = result.shadow.score.toLocaleString();
    $('#duel-result-player-detail').textContent = `${result.player.accuracy.toFixed(1)}% · 连击 ${result.player.maxCombo}`;
    $('#duel-result-shadow-detail').textContent = `${result.shadow.accuracy.toFixed(1)}% · 连击 ${result.shadow.maxCombo}`;
    ['perfect', 'great', 'good', 'miss'].forEach(key => {
      $(`#duel-result-${key}`).textContent = `${result.player[key]} : ${result.shadow[key]}`;
    });

    const rating = applyDuelRating(result);
    if (!rating) {
      $('#duel-rating-change').textContent = result.aborted ? '能力值不受影响' : '能力值已结算';
    } else {
      const sign = rating.delta >= 0 ? '+' : '';
      $('#duel-rating-change').textContent = `能力值 ${rating.after}（${sign}${rating.delta}）`;
    }
    showPage('duelResult');
  }

  function openDuelGame() {
    exitDuelGame(false);
    state.mode = 'shadow-duel';
    state.duelPhase = 'playing';
    state.duelResult = null;
    $('#duel-game-song-title').textContent = state.currentSong.title;
    $('#duel-game-shadow-name').textContent = state.matchedShadow.profile.name;
    $('#duel-game-shadow-avatar').textContent = state.matchedShadow.profile.name.slice(-1);
    ['player', 'shadow'].forEach(side => {
      $(`#duel-${side}-score`).textContent = '0';
      $(`#duel-${side}-combo`).textContent = '0';
    });
    $('#duel-lead-label').textContent = '势均力敌';
    $('#duel-score-diff').textContent = '分差 0';
    $('#duel-progress-bar').style.width = '0%';
    $('#duel-pause-overlay').classList.remove('show');
    applyCoverTheme(state.currentSong);
    showPage('duelGame');

    const segments = compileChart(state.currentSong);
    const shadowRenderer = new DuelLaneRenderer($('#duel-shadow-stage'), segments, 'shadow');
    const playerRenderer = new DuelLaneRenderer($('#duel-player-stage'), segments, 'player');
    shadowRenderer.init();
    playerRenderer.init();
    state.duelRenderers = { shadow: shadowRenderer, player: playerRenderer };

    state.duelGame = new DuelGame(state.currentSong, state.matchedShadow, state.audio, {
      onPlayerJudge: info => {
        playerRenderer.update(info.noteTime == null ? info.eventTime : info.noteTime);
        playerRenderer.renderJudge(info);
        updateDuelLiveStats('player', info);
      },
      onShadowJudge: info => {
        shadowRenderer.update(info.noteTime == null ? info.eventTime : info.noteTime);
        shadowRenderer.renderJudge(info);
        updateDuelLiveStats('shadow', info);
      },
      onTimeUpdate: info => {
        playerRenderer.update(info.currentTime);
        shadowRenderer.update(info.currentTime);
        updateDuelLead(info.player.score, info.shadow.score);
        const progress = Math.min(100, Math.max(0, info.currentTime / info.duration * 100));
        $('#duel-progress-bar').style.width = `${progress}%`;
      },
      onEnd: result => {
        state.duelResult = result;
        state.duelPhase = result.aborted ? 'aborted' : 'finished';
        clearTimeout(state.duelResultTimer);
        state.duelResultTimer = setTimeout(() => {
          state.duelResultTimer = null;
          openDuelResult(result);
        }, result.aborted ? 0 : 650);
      }
    });
    state.duelGame.init();
    state.duelGame.start();
  }

  function exitDuelGame(returnToOpponent = true) {
    clearTimeout(state.duelResultTimer);
    state.duelResultTimer = null;
    if (state.duelGame) {
      state.duelGame.destroy();
      state.duelGame = null;
    }
    if (state.duelRenderers) {
      state.duelRenderers.player.destroy();
      state.duelRenderers.shadow.destroy();
      state.duelRenderers = null;
    }
    state.audio.stop();
    if (returnToOpponent && state.matchedShadow) {
      state.duelPhase = 'opponent-ready';
      showPage('duelOpponent');
    }
  }

  function abortOrExitDuel() {
    if (state.duelGame && (state.duelGame.phase === 'playing' || state.duelGame.phase === 'paused')) {
      state.duelGame.abort();
      return;
    }
    exitDuelGame(true);
  }

  function pauseDuelForBackground() {
    if (!state.duelGame || state.duelGame.phase !== 'playing') return;
    state.duelGame.pause();
    $('#duel-pause-overlay').classList.add('show');
  }

  function resumeDuelFromOverlay() {
    if (!state.duelGame || state.duelGame.phase !== 'paused') return;
    $('#duel-pause-overlay').classList.remove('show');
    state.duelGame.resume();
  }

  function returnDuelHome() {
    exitDuelGame(false);
    state.matchSessionId += 1;
    state.mode = 'solo';
    state.duelPhase = 'home';
    state.matchedShadow = null;
    state.duelResult = null;
    showPage('library');
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
    updatePlayBtn();
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

  // 播放/暂停合并到同一个按钮：根据当前是否在播放来切换
  function togglePlay() {
    if (!state.currentSong) return;
    if (state.audio.audioEl.paused) {
      playPlayer();
    } else {
      pausePlayer();
    }
    updatePlayBtn();
  }

  // 同步播放按钮图标与状态（playing 显示暂停图标 ⏸，否则显示播放 ▶）
  function updatePlayBtn() {
    const btn = $('#btn-play');
    if (!btn) return;
    const playing = !state.audio.audioEl.paused;
    btn.textContent = playing ? '⏸' : '▶';
    btn.title = playing ? '暂停' : '播放';
  }

  function stopPlayer() {
    state.audio.stop();
    $('#cover-disc').classList.remove('spinning');
    stopPlayerTimer();
    $('#progress-filled').style.width = '0%';
    $('#time-current').textContent = '0:00';
    updatePlayBtn();
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
                      setTimeout(() => openShare(game), 1900);
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
    $('#phase-overlay-subtitle').textContent = '先记住节奏，再照着节奏，轻打屏幕任意位置吧！';
    $('#phase-overlay-btn').textContent = 'Q！';
    $('#phase-overlay-btn').onclick = () => {
      overlay.classList.remove('show');
      state.game.start();
    };
    overlay.classList.add('show');
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
  ctx.fillText('Q-beat! 节奏挑战', W / 2, 100);

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
  ctx.fillText('Q-beat!', W / 2, H - 120);
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
    a.download = `q-beat-score-${Date.now()}.png`;
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
    // 影子对决匹配
    $('#shadow-duel-entry-btn').addEventListener('click', startShadowMatch);
    $('#duel-match-cancel-btn').addEventListener('click', cancelShadowMatch);
    $('#duel-match-cancel-secondary-btn').addEventListener('click', cancelShadowMatch);
    $('#duel-match-retry-btn').addEventListener('click', startShadowMatch);
    $('#duel-opponent-back-btn').addEventListener('click', cancelShadowMatch);
    $('#duel-rematch-btn').addEventListener('click', startShadowMatch);
    $('#duel-start-btn').addEventListener('click', confirmShadowDuel);
    $('#duel-game-back-btn').addEventListener('click', abortOrExitDuel);
    $('#duel-game-stop-btn').addEventListener('click', abortOrExitDuel);
    $('#duel-game-help-btn').addEventListener('click', () => {
      showToast('上方是影子，下方是你。跟随扫描线轻点下半屏！', 3200);
    });
    $('#duel-player-tap-area').addEventListener('pointerdown', event => {
      if (event.target.closest('button')) return;
      if (state.duelGame && state.duelGame.phase === 'playing') state.duelGame.tap();
    });
    $('#duel-resume-btn').addEventListener('click', resumeDuelFromOverlay);
    $('#duel-retry-btn').addEventListener('click', openDuelGame);
    $('#duel-result-rematch-btn').addEventListener('click', startShadowMatch);
    $('#duel-result-home-btn').addEventListener('click', returnDuelHome);

    // 播放页
    $('#player-back-btn').addEventListener('click', () => {
      stopPlayer();
      showPage('library');
    });
    $('#btn-play').addEventListener('click', togglePlay);
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
  // 游戏页停止按钮（与播放页同形状的圆形 ⏹）：游戏中→中止结算，未开始→直接退出
  $('#game-stop-btn').addEventListener('pointerdown', (e) => {
    e.stopPropagation();
  });
  $('#game-stop-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (state.game && state.game.phase === 'playing') {
      state.game.abort();
    } else {
      exitGame();
    }
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
    initLibraryTabs();
    bindEvents();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pauseDuelForBackground();
    });

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
