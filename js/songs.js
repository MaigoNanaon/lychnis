/**
 * 歌曲数据 & 谱面定义
 *
 * 谱面(chart)格式 —— 每个音符对象包含：
 *   { time: 毫秒, type: 'tap' }
 *   time: 相对于歌曲播放开始的毫秒数
 *   type: 目前仅支持 'tap'（点击音符）
 *
 * ========== 如何添加你的歌曲 ==========
 * 1. 将音频文件（mp3/ogg）放入 assets/audio/ 目录
 * 2. 将封面图片放入 assets/covers/ 目录（可选，没有则用渐变色）
 * 3. 复制下面的歌曲对象，修改 id / title / artist / audio / bpm / color
 * 4. 编写谱面：可用 genChart() 辅助生成，也可手动逐条定义
 *
 * 手动谱面示例：
 *   chart: [
 *     { time: 3000, type: 'tap' },
 *     { time: 3500, type: 'tap' },
 *     { time: 4000, type: 'tap' },
 *     ...
 *   ]
 */

/**
 * 根据BPM和节奏型自动生成谱面
 * @param {number} bpm           每分钟节拍数
 * @param {number[][]} patterns  每小节的拍位模式，按小节循环
 *                               [0,2] 表示在1拍和3拍放音符
 *                               [0,0.5,2] 表示1拍、1.5拍(八分音符)、3拍
 * @param {number} measures      总小节数
 * @param {number} startOffset   第一个音符前的空白（毫秒）
 */
function genChart(bpm, patterns, measures = 16, startOffset = 3000) {
  const beatMs = 60000 / bpm; // 一拍的毫秒数
  const notes = [];
  for (let m = 0; m < measures; m++) {
    const pattern = patterns[m % patterns.length];
    for (const beat of pattern) {
      notes.push({
        time: Math.round(startOffset + (m * 4 + beat) * beatMs),
        type: 'tap'
      });
    }
  }
  return notes;
}

const SONGS = [
  {
    id: 'lovestory',
    title: 'Love Story',
    artist: 'Demo Singer',
    cover: null,                 // null = 使用渐变色作为封面
    audio: 'assets/audio/lovestory.mp3',
    bpm: 120,
    duration: 35,
    difficulty: '简单',
    color: ['#FF6B6B', '#FF8E8E'],
    // ✅ 手动谱面示例：第 3 / 3.5 / 4 / 4.5 / 5 秒各一个音符
    chart: [
      { time: 3000, type: 'tap' },   // 第 3.0 秒
      { time: 3500, type: 'tap' },   // 第 3.5 秒
      { time: 4000, type: 'tap' },   // 第 4.0 秒
      { time: 4500, type: 'tap' },   // 第 4.5 秒
      { time: 5000, type: 'tap' },   // 第 5.0 秒
    ]
  },
  {
    id: 'midnight',
    title: 'Midnight Run',
    artist: 'Demo Artist',
    cover: null,
    audio: 'assets/audio/midnight.mp3',
    bpm: 128,
    duration: 35,
    difficulty: '中等',
    color: ['#4ECDC4', '#44A5A0'],
    chart: genChart(128, [
      [0, 1, 2, 3],
      [0, 1, 2, 3],
      [0, 0.5, 2, 2.5],
      [0, 1, 2, 3],
    ], 12, 3000)
  },
  {
    id: 'sakura',
    title: 'Sakura Dance',
    artist: 'Demo Musician',
    cover: null,
    audio: 'assets/audio/sakura.mp3',
    bpm: 140,
    duration: 35,
    difficulty: '困难',
    color: ['#FFB6C1', '#FF69B4'],
    chart: genChart(140, [
      [0, 0.5, 1, 2, 2.5, 3],
      [0, 1, 1.5, 2, 3, 3.5],
      [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],
      [0, 1, 2, 2.5, 3],
    ], 12, 3000)
  },
  {
    id: 'electric',
    title: 'Electric Dreams',
    artist: 'Demo Producer',
    cover: null,
    audio: 'assets/audio/electric.mp3',
    bpm: 150,
    duration: 35,
    difficulty: '专家',
    color: ['#9B59B6', '#8E44AD'],
    chart: genChart(150, [
      [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],
      [0, 0.5, 1, 2, 2.5, 3, 3.5],
      [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],
      [0, 1, 1.5, 2, 2.5, 3, 3.5],
    ], 12, 3000)
  }
];

/** 根据 id 获取歌曲 */
function getSongById(id) {
  return SONGS.find(s => s.id === id);
}
