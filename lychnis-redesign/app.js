/* ============================================
 * Lychnis 节奏游戏 - 交互逻辑
 * ============================================ */

(function () {
    'use strict';

    // ============= Tab 筛选交互 =============
    const tabBar = document.querySelector('.tab-bar');
    const tabItems = document.querySelectorAll('.tab-item');
    const songItems = document.querySelectorAll('.song-item');

    if (tabBar) {
        tabBar.addEventListener('click', function (e) {
            const tabItem = e.target.closest('.tab-item');
            if (!tabItem) return;

            // 更新选中态
            tabItems.forEach((item) => {
                item.classList.remove('active');
                item.setAttribute('aria-selected', 'false');
            });
            tabItem.classList.add('active');
            tabItem.setAttribute('aria-selected', 'true');

            // 筛选歌曲
            const difficulty = tabItem.getAttribute('data-difficulty');
            filterSongs(difficulty);
        });
    }

    function filterSongs(difficulty) {
        songItems.forEach((item) => {
            const itemDifficulty = item.getAttribute('data-difficulty');
            if (difficulty === 'all' || itemDifficulty === difficulty) {
                item.classList.remove('filtered-out');
            } else {
                item.classList.add('filtered-out');
            }
        });
    }

    // ============= 键盘导航 (无障碍) =============
    songItems.forEach((item) => {
        item.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const playBtn = item.querySelector('.play-btn');
                if (playBtn) playBtn.click();
            }
        });
    });

    // ============= 播放按钮交互 =============
    const playButtons = document.querySelectorAll('.play-btn');
    playButtons.forEach((btn) => {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            const songItem = btn.closest('.song-item');
            const title = songItem?.querySelector('.song-title')?.textContent;

            // 切换播放图标
            const isPlaying = btn.classList.contains('playing');

            if (isPlaying) {
                btn.classList.remove('playing');
                btn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                        <path d="M8 5.5v13a1 1 0 001.5.87l11-6.5a1 1 0 000-1.74l-11-6.5A1 1 0 008 5.5z" fill="currentColor"/>
                    </svg>
                `;
                btn.setAttribute('aria-label', `播放 ${title}`);
            } else {
                // 停止其他正在播放的
                playButtons.forEach((b) => {
                    b.classList.remove('playing');
                    b.innerHTML = `
                        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                            <path d="M8 5.5v13a1 1 0 001.5.87l11-6.5a1 1 0 000-1.74l-11-6.5A1 1 0 008 5.5z" fill="currentColor"/>
                        </svg>
                    `;
                });
                btn.classList.add('playing');
                btn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                        <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/>
                        <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/>
                    </svg>
                `;
                btn.setAttribute('aria-label', `暂停 ${title}`);
            }
        });
    });

    // ============= 歌曲项点击 (进入详情) =============
    songItems.forEach((item) => {
        item.addEventListener('click', function () {
            const title = item.querySelector('.song-title')?.textContent;
            // 在实际应用中这里会导航到歌曲详情页
            console.log('进入歌曲详情:', title);
        });
    });

    // ============= 排行榜按钮 =============
    const leaderboardBtn = document.querySelector('.leaderboard-btn');
    if (leaderboardBtn) {
        leaderboardBtn.addEventListener('click', function () {
            console.log('进入本地排行榜');
        });
    }

    // ============= 迷你播放器控制 =============
    const miniPlayerPlay = document.querySelector('.mini-player-play');
    if (miniPlayerPlay) {
        miniPlayerPlay.addEventListener('click', function () {
            const isPlaying = miniPlayerPlay.classList.contains('playing');
            if (isPlaying) {
                miniPlayerPlay.classList.remove('playing');
                miniPlayerPlay.innerHTML = `
                    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                        <path d="M8 5.5v13a1 1 0 001.5.87l11-6.5a1 1 0 000-1.74l-11-6.5A1 1 0 008 5.5z" fill="currentColor"/>
                    </svg>
                `;
                miniPlayerPlay.setAttribute('aria-label', '播放');
            } else {
                miniPlayerPlay.classList.add('playing');
                miniPlayerPlay.innerHTML = `
                    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                        <rect x="7" y="5" width="3.5" height="14" rx="1" fill="currentColor"/>
                        <rect x="13.5" y="5" width="3.5" height="14" rx="1" fill="currentColor"/>
                    </svg>
                `;
                miniPlayerPlay.setAttribute('aria-label', '暂停');
            }
        });
    }

    // ============= 主题切换 (Light/Dark) =============
    // 通过键盘快捷键 T 切换主题, 演示用
    document.addEventListener('keydown', function (e) {
        if (e.key === 't' || e.key === 'T') {
            const html = document.documentElement;
            const currentTheme = html.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            html.setAttribute('data-theme', newTheme);
            console.log('主题已切换为:', newTheme);
        }
    });

    // ============= 初始化日志 =============
    console.log('%c Lychnis 节奏游戏 ', 'background: #00F285; color: #000; padding: 4px 8px; border-radius: 4px; font-weight: bold;');
    console.log('设计基于 QQ音乐 Design Guidelines v2026.04');
    console.log('按 T 键切换 Light/Dark 主题');
})();
