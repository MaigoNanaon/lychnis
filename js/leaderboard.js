/**
 * 本地排行榜（LocalStorage 版）
 *
 * 存储结构：
 *   key: lychnis_leaderboard
 *   value: JSON 数组，按 score 降序排列
 *
 * 每条记录：
 *   { songId, songTitle, score, accuracy, maxCombo, grade,
 *     perfect, great, good, miss, total, date }
 */

const LB_KEY = 'lychnis_leaderboard';
const LB_MAX_PER_SONG = 50;

const Leaderboard = {

  /** 获取所有记录 */
  getAll() {
    try {
      const raw = localStorage.getItem(LB_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  },

  /** 按歌曲 ID 获取排行榜（降序） */
  getBySong(songId) {
    return this.getAll()
      .filter(r => r.songId === songId)
      .sort((a, b) => b.score - a.score);
  },

  /** 获取某首歌的最高分记录 */
  getBest(songId) {
    const list = this.getBySong(songId);
    return list.length > 0 ? list[0] : null;
  },

  /**
   * 提交一条成绩，返回排名（从 1 开始）
   * 如果未进 Top 50，返回 null
   */
  submit(data) {
    const record = {
      ...data,
      date: new Date().toLocaleDateString('zh-CN', {
        month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      })
    };

    const all = this.getAll();
    all.push(record);

    // 按歌曲分组，每组只保留 Top N
    const grouped = {};
    all.forEach(r => {
      if (!grouped[r.songId]) grouped[r.songId] = [];
      grouped[r.songId].push(r);
    });

    const trimmed = [];
    Object.values(grouped).forEach(list => {
      list.sort((a, b) => b.score - a.score);
      trimmed.push(...list.slice(0, LB_MAX_PER_SONG));
    });

    localStorage.setItem(LB_KEY, JSON.stringify(trimmed));

    // 计算排名
    const songList = this.getBySong(data.songId);
    const rank = songList.findIndex(r =>
      r.score === data.score &&
      r.date === record.date
    );
    return rank >= 0 ? rank + 1 : null;
  },

  /** 清空所有记录 */
  clear() {
    localStorage.removeItem(LB_KEY);
  }
};
