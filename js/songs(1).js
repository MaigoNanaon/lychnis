/**
 * 歌曲数据 & 谱面定义（段落式 · 拍数优先）
 *
 * ============================================================
 *  新谱面格式（推荐，写谱极快）
 * ============================================================
 *  核心约定：
 *    - 歌曲上记录 bpm，因此 1 个【四分音符】= 1 拍（beat）。
 *    - 歌曲上记录总体参数 offset（单位：秒，如 2.34），
 *      表示「0 拍位置」对应的真实时间。0 点之前用负拍数。
 *    - 每个段落只写【相对拍数位置】，不再手写绝对毫秒：
 *        beatStart / beatEnd  段落起止（单位 beat）
 *        notes               音符位置数组（单位 beat，相对整首歌 0 拍）
 *
 *  段落类型（不变）：
 *    tutorial  教程段 — 扫描线自动点亮音符，玩家观察记忆
 *    play      打击段 — 玩家需在音符位置点击屏幕，模仿前一教程段
 *    idle      空闲段 — 只放歌不操作
 *
 *  playMode（仅 play 段，可选，默认 1）：
 *    1  扫描线始终可见
 *    2  扫描线在前 1/3 逐渐消失
 *    3  扫描线完全隐藏
 *
 *  运行时由 compileChart(song) 把 beat 编译成绝对毫秒：
 *    time(ms) = offset(秒)*1000 + beat * (60000 / bpm)
 *  游戏引擎拿到的是编译后的绝对毫秒，无需改动。
 *
 *  每个 seg 单独定义（不自动复制），例如：
 *    { type: 'tutorial', beatStart: 0,   beatEnd: 4,   notes: [1, 1.5, 3.5] },
 *    { type: 'play',     beatStart: 4,   beatEnd: 8,   notes: [1, 1.5, 3.5], playMode: 1 },
 *    { type: 'idle',     beatStart: 8,   beatEnd: 12,  notes: [] },
 *    { type: 'tutorial', beatStart: 12,  beatEnd: 16,  notes: [1, 1.5, 3.5] },
 *
 *  兼容：旧格式（带 start/end 绝对毫秒的段）也能直接放进 segments，
 *        compileChart 会自动检测并原样返回，无需迁移。
 */

/** 每拍毫秒数 */
function beatMs(bpm) { return 60000 / bpm; }

/**
 * 把单个 beat 段编译成绝对毫秒段（返回新对象，不改动入参）。
 */
function _compileSeg(seg, offsetSec, bpm) {
  const unit = beatMs(bpm);
  const at = (beat) => Math.round(offsetSec * 1000 + beat * unit);
  return {
    type: seg.type,
    start: at(seg.beatStart),
    end: at(seg.beatEnd),
    notes: (seg.notes || []).map(at),
    ...(seg.playMode != null ? { playMode: seg.playMode } : {}),
    ...(seg.message != null ? { message: seg.message } : {})
  };
}

/**
 * 编译整首歌的谱面：
 *  - 若段里出现 beatStart，则按拍编译；
 *  - 否则原样返回（兼容旧格式）。
 */
function compileChart(song) {
  if (!song.segments || song.segments.length === 0) return [];
  const isBeatFormat = song.segments.some(s => s.beatStart != null);
  if (!isBeatFormat) return song.segments; // 旧格式直通
  const offset = song.offset != null ? song.offset : 0;
  return song.segments.map(s => _compileSeg(s, offset, song.bpm));
}

const SONGS = [
  {
    id: 'harehareya',
    title: 'ハレハレヤ',
    artist: '神秘组员早期翻唱',
    cover: 'assets/covers/harehareya.jpg',
    audio: 'assets/audio/harehareya.mp3',
    bpm: 92,
    duration: 136,
    difficulty: '简单',
    color: ['#38BDF8', '#0EA5E9'],
    offset: 0.71,   // 0 拍位置 = 歌曲 0.000 秒
    // —— 新格式：每个 seg 单独定义，单位 beat（1 四分音符 = 1 拍） ——
    // 音符只在 [1, 1.5, 3.5] 拍；play 段 playMode 在 1 / 3 间交替。
    segments: [
      { type: 'tutorial', beatStart: -0.5,   beatEnd: 3.5,   notes: [0, 2], message:"记住节奏～"},
      { type: 'play',     beatStart: 3.5,   beatEnd: 7.5,   notes: [4, 6 ], playMode: 1 },
      { type: 'tutorial', beatStart: 7.5,   beatEnd: 11.5,  notes: [8, 9, 10, 11] },
      { type: 'play',     beatStart: 11.5,  beatEnd: 15.5,  notes: [12, 13, 14, 15], playMode: 1 },
      { type: 'tutorial', beatStart: 15.5,   beatEnd: 19.5,  notes: [16, 17, 18, 19] , message:"难度上升，扫描线消失！" },
      { type: 'play',     beatStart: 19.5,  beatEnd: 23.5,  notes: [20, 21, 22, 23], playMode: 2},
      { type: 'tutorial', beatStart: 23.5,  beatEnd: 27.5,  notes: [24, 24.66, 25, 25.66, 26, 26.5, 27] },
      { type: 'play',     beatStart: 27.5,  beatEnd: 31.5,  notes: [28, 28.66, 29, 29.66, 30, 30.5, 31] , playMode: 2 },
      { type: 'tutorial', beatStart: 31.5,  beatEnd: 35.5,  notes: [32, 33, 34, 34.5, 35, ] },
      { type: 'play',     beatStart: 35.5,  beatEnd: 39.5,  notes: [36, 37, 38, 38.5, 39, ] , playMode: 2 },
      { type: 'tutorial', beatStart: 39.5,  beatEnd: 43.5,  notes: [40] },
      { type: 'play',     beatStart: 43.5,  beatEnd: 47.5,  notes: [44], playMode: 2 },
      { type: 'tutorial', beatStart: 47.5,  beatEnd: 51.5,  notes: [48, 48.5, 49, 50, 50.5, 51] },
      { type: 'play',     beatStart: 51.5,  beatEnd: 55.5,  notes: [52, 52.5, 53, 54, 54.5, 55], playMode: 1 },
      { type: 'idle', beatStart: 55.5,  beatEnd: 59.5, message:"注意集中～" },
      { type: 'tutorial', beatStart: 59.5,  beatEnd: 61.5,  notes: [60, 60.3, 61] },
      { type: 'play',     beatStart: 61.5,  beatEnd: 63.5,  notes: [62, 62.3, 63], playMode: 2 },
      { type: 'tutorial', beatStart: 63.5,  beatEnd: 67.5,  notes: [66, 66.5, 67] },
      { type: 'play',     beatStart: 67.5,  beatEnd: 71.5,  notes: [70, 70.5, 71], playMode: 2 },
      { type: 'tutorial', beatStart: 71.5,   beatEnd: 75.5,  notes: [72, 73, 74, 75] },
      { type: 'play',     beatStart: 75.5,  beatEnd: 79.5,  notes: [76, 77, 78, 79], playMode: 2 },
      { type: 'tutorial', beatStart: 79.5,   beatEnd: 87.5,  notes: [80, 81, 82, 83, 84, 84.5] },
      { type: 'play',     beatStart: 87.5,  beatEnd: 95.5,  notes: [88, 89, 90, 91, 92, 92.5], playMode: 2 },
      { type: 'tutorial', beatStart: 95.5,   beatEnd: 103.5,  notes: [96, 97, 98, 98.5, 99, 99.5, 100, 101] },
      { type: 'play',     beatStart: 103.5,  beatEnd: 111.5,  notes: [104, 105, 106, 106.5, 107, 107.5, 108, 109], playMode: 2 },
      { type: 'tutorial', beatStart: 111.5, beatEnd: 119.5, notes: [112, 114, 115, 115.5, 116, 117.5, 118] },
      { type: 'play',     beatStart: 119.5, beatEnd: 127.5, notes: [120, 122, 123, 123.5, 124, 125.5, 126], playMode: 2 },
      { type: 'tutorial', beatStart: 127.5, beatEnd: 131.5, notes: [128, 128.5, 129.5, 130] },
      { type: 'play',     beatStart: 131.5, beatEnd: 135.5, notes: [132, 132.5, 133.5, 134], playMode: 2 },
      { type: 'tutorial', beatStart: 135.5,   beatEnd: 139.5,  notes: [136, 137, 138, 139] },
      { type: 'play',     beatStart: 139.5,  beatEnd: 143.5,  notes: [140, 141, 142, 143], playMode: 2 },
      { type: 'tutorial', beatStart: 143.5, beatEnd: 151.5, notes: [144, 146, 147, 147.5, 148, 149.5, 150] },
      { type: 'play',     beatStart: 151.5, beatEnd: 159.5, notes: [152, 154, 155, 155.5, 156, 157.5, 158], playMode: 2 },
      { type: 'tutorial', beatStart: 159.5, beatEnd: 163.5, notes: [160, 160.5, 161.5, 162] },
      { type: 'play',     beatStart: 163.5, beatEnd: 167.5, notes: [164, 164.5, 165.5, 166], playMode: 2 },
      { type: 'tutorial', beatStart: 167.5,   beatEnd: 171.5,  notes: [168, 169, 170, 170.5, 171] },
      { type: 'play',     beatStart: 171.5,  beatEnd: 175.5,  notes: [172, 173, 174, 174.5, 175], playMode: 2 },
    ]
  },
  {
    id: 'yuureitokyo',
    title: '幽霊東京',
    artist: '神秘组员早期翻唱',
    cover: 'assets/covers/yuureitokyo.png',
    audio: 'assets/audio/yuureitokyo.mp3',
    bpm: 124,
    duration: 200,
    offset: 2,
    difficulty: '困难',
    color: ['#A78BFA', '#8B5CF6'],
    segments: [
      { type: 'tutorial', beatStart: -0.5,   beatEnd: 7.5,   notes: [0, 1, 2, 3, 4, 5, 6, 7] ,message:"记住节奏～"},
      { type: 'play',     beatStart: 7.5,   beatEnd: 15.5,   notes: [8, 9, 10, 11, 12, 13, 14, 15], playMode: 1 },
      { type: 'tutorial', beatStart: 15.5,   beatEnd: 23.5,   notes: [16, 17, 18, 19, 20, 21, 22, 22.5, 23] },
      { type: 'play',     beatStart: 23.5,   beatEnd: 31.5,   notes: [24, 25, 26, 27, 28, 29, 30, 30.5, 31], playMode: 1 },
      { type: 'tutorial', beatStart: 31.5,   beatEnd: 39.5,   notes: [32, 33, 34, 36, 37, 38]},
      { type: 'play',     beatStart: 39.5,   beatEnd: 47.5,   notes: [40, 41, 42, 44, 45, 46], playMode: 1 },
      { type: 'tutorial', beatStart: 47.5,   beatEnd: 55.5,   notes: [48, 48.5, 50, 50.5, 52, 52.5, 54, 54.5]},
      { type: 'play',     beatStart: 55.5,   beatEnd: 63.5,   notes: [56, 56.5, 58, 58.5, 60, 60.5, 62, 62.5], playMode: 1 },
      { type: 'idle', beatStart: 63.5,   beatEnd: 79.5, message:"扫描线消失！"},
      { type: 'tutorial', beatStart: 79.5,   beatEnd: 87.5,   notes: [80, 81, 81.5, 82, 84, 86, 87]},
      { type: 'play',     beatStart: 87.5,   beatEnd: 95.5,   notes: [88, 89, 89.5, 90, 92, 94, 95], playMode: 2 },
      { type: 'tutorial', beatStart: 95.5,   beatEnd: 103.5,   notes: [96, 96.5, 98, 98.5, 100, 100.5, 102, 102.5]},
      { type: 'play',     beatStart: 103.5,   beatEnd: 111.5,   notes: [104, 104.5, 106, 106.5, 108, 108.5, 110, 110.5], playMode: 2 },
      { type: 'tutorial', beatStart: 111.5,   beatEnd: 115.5,   notes: [112, 112.75, 113.5, 114.5, 115]},
      { type: 'play',     beatStart: 115.5,   beatEnd: 119.5,   notes: [116, 116.75, 117.5, 118.5, 119], playMode: 2 },
      { type: 'tutorial', beatStart: 119.5,   beatEnd: 123.5,   notes: [121, 121.5, 123]},
      { type: 'play',     beatStart: 123.5,   beatEnd: 127.5,   notes: [125, 125.5, 127], playMode: 2 },
      { type: 'tutorial', beatStart: 127.5,   beatEnd: 131.5,   notes: [128, 128.75, 129.5, 130.5, 131]},
      { type: 'play',     beatStart: 131.5,   beatEnd: 135.5,   notes: [132, 132.75, 133.5, 134.5, 135], playMode: 2 },
      { type: 'tutorial', beatStart: 135.5,   beatEnd: 139.5,   notes: [136, 137, 138, 139]},
      { type: 'play',     beatStart: 139.5,   beatEnd: 143.5,   notes: [140, 141, 142, 143], playMode: 2 },
      { type: 'idle',     beatStart: 143.5,   beatEnd: 147.5, messages:"加油～"},
      { type: 'tutorial', beatStart: 147.5,   beatEnd: 155.5,   notes: [148, 149, 150, 151, 152, 153, 154, 155]},
      { type: 'play',     beatStart: 155.5,   beatEnd: 163.5,   notes: [156, 157, 158, 159, 160, 161, 162, 163], playMode: 2 },
      { type: 'tutorial', beatStart: 163.5,   beatEnd: 171.5,   notes: [164, 164.75, 165.5, 166, 168, 170]},
      { type: 'play',     beatStart: 171.5,   beatEnd: 179.5,   notes: [172, 172.75, 173.5, 174, 176, 178], playMode: 2 },
      { type: 'idle',     beatStart: 179.5,   beatEnd: 183.5,   },
      { type: 'tutorial', beatStart: 183.5,   beatEnd: 191.5,   notes: [184, 186, 188, 190]},
      { type: 'play',     beatStart: 191.5,   beatEnd: 199.5,   notes: [192, 194, 196, 198], playMode: 1 },
      { type: 'tutorial', beatStart: 199.5,   beatEnd: 207.5,   notes: [200, 202, 204, 206]},
      { type: 'play',     beatStart: 207.5,   beatEnd: 215.5,   notes: [208, 210, 212, 214], playMode: 1 },
      { type: 'tutorial', beatStart: 215.5,   beatEnd: 223.5,   notes: [216, 217, 217.5, 218, 219, 220, 221.5, 222, 223]},
      { type: 'play',     beatStart: 223.5,   beatEnd: 231.5,   notes: [224, 225, 225.5, 226, 227, 228, 229.5, 230, 231],playMode: 2 },
      { type: 'tutorial', beatStart: 231.5,   beatEnd: 235.5,   notes: [232, 232.25, 232.5, 232.75, 233, 234, 234.5]},
      { type: 'play',     beatStart: 235.5,   beatEnd: 239.5,   notes: [236, 236.25, 236.5, 236.75, 237, 238, 238.5],playMode: 2 },
      { type: 'tutorial', beatStart: 239.5,   beatEnd: 243.5,   notes: [240, 241, 242, 243]},
      { type: 'play',     beatStart: 243.5,   beatEnd: 247.5,   notes: [244, 245, 246, 247],playMode: 2 },
      { type: 'tutorial', beatStart: 247.5,   beatEnd: 255.5,   notes: [248, 248.75, 249.5, 250, 251, 252, 254, 254.5, 255,255.5]},
      { type: 'play',     beatStart: 255.5,   beatEnd: 263.5,   notes: [256, 256.75, 257.5, 258, 259, 260, 262, 262.5, 263, 263.5], playMode: 2 },
      { type: 'tutorial', beatStart: 263.5,   beatEnd: 267.5,   notes: [264, 265.5, 266]},
      { type: 'play',     beatStart: 267.5,   beatEnd: 271.5,   notes: [268, 269.5, 270], playMode: 2 },
      { type: 'idle',     beatStart: 271.5,   beatEnd: 275.5,   messages:""},
      { type: 'tutorial', beatStart: 275.5,   beatEnd: 283.5,   notes: [276, 276.75, 277.5, 278, 278.75, 279.5, 280, 280.75, 281.5, 282]},
      { type: 'play',     beatStart: 283.5,   beatEnd: 291.5,   notes: [284, 284.75, 285.5, 286, 286.75, 287.5, 288, 288.75, 289.5, 290], playMode: 2 },
      { type: 'tutorial', beatStart: 291.5,   beatEnd: 299.5,   notes: [292, 292.75, 293.5, 294, 294.75, 295.5, 296, 296.75, 297.5, 298]},
      { type: 'play',     beatStart: 299.5,   beatEnd: 307.5,   notes: [300, 300.75, 301.5, 302, 302.75, 303.5, 304, 304.75, 305.5, 306], playMode: 2 },
      { type: 'tutorial', beatStart: 307.5,   beatEnd: 315.5,   notes: [308, 309, 310, 312, 313, 314]},
      { type: 'play',     beatStart: 315.5,   beatEnd: 323.5,   notes: [316, 317, 318, 320, 321, 322], playMode: 2 },
      { type: 'tutorial', beatStart: 323.5,   beatEnd: 327.5,   notes: [324, 324.25, 324.5, 324.75, 325, 326, 326.5]},
      { type: 'play',     beatStart: 327.5,   beatEnd: 331.5,   notes: [328, 328.25, 328.5, 328.75, 329, 330, 330.5],playMode: 2 },
      { type: 'tutorial', beatStart: 331.5,   beatEnd: 335.5,   notes: [332, 333, 334, 335]},
      { type: 'play',     beatStart: 335.5,   beatEnd: 339.5,   notes: [336, 337, 338, 339],playMode: 2 },
      { type: 'idle', beatStart: 339.5,   beatEnd: 343.5 },
      { type: 'tutorial', beatStart: 343.5,   beatEnd: 351.5,   notes: [344, 344.75, 345.5, 346, 347, 348, 350, 350.5, 351,351.5]},
      { type: 'play',     beatStart: 351.5,   beatEnd: 359.5,   notes: [352, 352.75, 353.5, 354, 355, 356, 358, 358.5, 359, 359.5], playMode: 2 },
      { type: 'tutorial', beatStart: 359.5,   beatEnd: 363.5,   notes: [360, 361.5, 362]},
      { type: 'play',     beatStart: 363.5,   beatEnd: 367.5,   notes: [364, 365.5, 366], playMode: 2 },
      { type: 'idle', beatStart: 367.5,   beatEnd: 371.5 },
      { type: 'tutorial', beatStart: 371.5,   beatEnd: 379.5,   notes: [372, 373, 374, 375, 376, 377, 378, 378.5, 379] },
      { type: 'play',     beatStart: 379.5,   beatEnd: 387.5,   notes: [380, 381, 382, 383, 384, 385, 386, 386.5, 387], playMode: 2 },
      { type: 'tutorial', beatStart: 387.5,   beatEnd: 395.5,   notes: [388, 390, 390.75, 391.5]},
      { type: 'play',     beatStart: 395.5,   beatEnd: 403.5,   notes: [396, 398, 398.75, 399.5], playMode: 2 },
    ]
  },
  {
    id: 'qingtian',
    title: '晴天',
    artist: '周杰伦',
    cover: 'assets/covers/晴天.jpeg',
    audio: 'assets/audio/晴天.mp3',
    bpm: 137.1,
    duration: 145,
    difficulty: '中等',
    color: ['#FBBF24', '#F59E0B'],
    offset: 0.985,   // TODO: 校准「0 拍」对应的真实秒数
    // TODO: 自行编写谱面，替换下方占位 idle 段
    segments: [
      { type: 'tutorial', beatStart: -0.5,   beatEnd: 7.5, notes: [0, 2, 4, 6] ,message:"记住节奏～"},
      { type: 'play',     beatStart: 7.5,   beatEnd: 15.5,   notes: [8, 10, 12, 14], playMode: 1 },
      { type: 'tutorial', beatStart: 15.5,   beatEnd: 23.5, notes: [16, 18, 20, 22, 23] },
      { type: 'play',     beatStart: 23.5,   beatEnd: 31.5,   notes: [24, 26, 28, 30, 31], playMode: 1 },
      { type: 'tutorial', beatStart: 31.5,   beatEnd: 39.5, notes: [32, 34, 35.5, 37, 38] },
      { type: 'play',     beatStart: 39.5,   beatEnd: 47.5,   notes: [40, 42, 43.5, 45, 46], playMode: 1 },
      { type: 'tutorial', beatStart: 47.5,   beatEnd: 55.5, notes: [48, 50, 51.5, 53, 54, 55] },
      { type: 'play',     beatStart: 55.5,   beatEnd: 63.5,   notes: [56, 58, 59.5, 61, 62, 63], playMode: 1 },
      { type: 'tutorial', beatStart: 63.5,   beatEnd: 71.5, notes: [65, 66, 67, 68, 70, 71], message:"难度上升，扫描线消失！" },
      { type: 'play',     beatStart: 71.5,   beatEnd: 79.5,   notes: [73, 74, 75, 76, 78, 79], playMode: 2 },
      { type: 'tutorial', beatStart: 79.5,   beatEnd: 87.5, notes: [81, 83, 85, 85.5, 86, 87] },
      { type: 'play',     beatStart: 87.5,   beatEnd: 95.5,   notes: [89, 91, 93, 93.5, 94, 95], playMode: 2 },
      { type: 'tutorial', beatStart: 95.5,   beatEnd: 111.5, notes: [96, 97, 98, 99, 100, 101, 102, 103, 103.5, 105, 107, 108, 108.5, 109, 110] },
      { type: 'play',     beatStart: 111.5,  beatEnd: 127.5,   notes: [112, 113, 114, 115, 116, 117, 118, 119, 119.5, 121, 123, 124, 124.5, 125, 126], playMode: 2 },
      { type: 'tutorial', beatStart: 127.5,   beatEnd: 136.5, notes: [130, 130.75, 131.5, 134, 134.75, 135.5] },
      { type: 'play',     beatStart: 135.5,  beatEnd: 144.5,   notes: [138, 138.75, 139.5, 142, 142.75, 143.5], playMode: 2 },
      { type: 'tutorial', beatStart: 143.5,  beatEnd: 151.5, notes: [148, 149, 150, 151] },
      { type: 'play',     beatStart: 151.5,  beatEnd: 159.5,   notes: [156, 157, 158, 159], playMode: 2 },
      { type: 'tutorial', beatStart: 159.5,  beatEnd: 175.5, notes: [160, 161, 162, 163, 164, 165, 166, 167, 168, 170, 171.5, 172.5, 173, 174] },
      { type: 'play',     beatStart: 175.5,  beatEnd: 191.5,   notes: [176, 177, 178, 179, 180, 181, 182, 183, 184, 186, 187.5, 188.5, 189, 190], playMode: 2 },
      { type: 'tutorial', beatStart: 191.5,  beatEnd: 199.5, notes: [193, 194, 195, 197, 198, 199] },
      { type: 'play',     beatStart: 199.5,  beatEnd: 207.5,   notes: [201, 202, 203, 205, 206, 207], playMode: 2 },
      { type: 'tutorial', beatStart: 207.5,  beatEnd: 215.5, notes: [209, 210, 211, 213, 214, 214.5, 215] },
      { type: 'play',     beatStart: 215.5,  beatEnd: 223.5,   notes: [217, 218, 219, 221, 222, 222.5, 223], playMode: 2 },
      { type: 'tutorial', beatStart: 223.5,  beatEnd: 231.5, notes: [225, 226, 227, 229, 230, 231] },
      { type: 'play',     beatStart: 231.5,  beatEnd: 239.5,   notes: [233, 234, 235, 237, 238, 239], playMode: 2 },
      { type: 'tutorial', beatStart: 239.5,  beatEnd: 247.5, notes: [241, 242, 243, 244, 245.5, 246] },
      { type: 'play',     beatStart: 247.5,  beatEnd: 255.5,   notes: [249, 250, 251, 252, 253.5, 254], playMode: 2 },
      { type: 'tutorial', beatStart: 255.5,  beatEnd: 263.5, notes: [257, 258, 259, 261, 262, 263] },
      { type: 'play',     beatStart: 263.5,  beatEnd: 271.5,   notes: [265, 266, 267, 269, 270, 271], playMode: 2 },
      { type: 'tutorial', beatStart: 271.5,  beatEnd: 279.5, notes: [273, 274, 275, 277, 278, 278.5, 279] },
      { type: 'play',     beatStart: 279.5,  beatEnd: 287.5,   notes: [281, 282, 283, 285, 286, 286.5, 287], playMode: 2 },
      { type: 'tutorial', beatStart: 287.5,  beatEnd: 295.5, notes: [289, 290, 291, 293, 294, 295] },
      { type: 'play',     beatStart: 295.5,  beatEnd: 303.5,   notes: [297, 298, 299, 301, 302, 303], playMode: 2 },
      { type: 'tutorial', beatStart: 303.5,  beatEnd: 311.5, notes: [305, 306, 306.5, 307, 308, 310, 311] },
      { type: 'play',     beatStart: 311.5,  beatEnd: 319.5,   notes: [313, 314, 314.5, 315, 316, 318, 319], playMode: 2 },
    ]
  },
  {
    id: 'stay',
    title: 'Stay Fere Forever',
    artist: 'Jewel',
    cover: 'assets/covers/stay.jpeg',
    audio: 'assets/audio/stay.mp3',
    bpm: 88,           // TODO: 填写 BPM
    duration: 65,      // TODO: 填写歌曲时长（秒）
    difficulty: '中等',
    color: ['#F472B6', '#818CF8'],
    offset: 0.158,        // TODO: 0 拍位置对应的真实时间（秒）
    // TODO: 填写谱面段落（参考其它歌曲格式）
    segments: [
      { type: 'tutorial', beatStart: -0.5,   beatEnd: 3.5, notes: [0, 1, 2, 3] ,message:"记住节奏～"},
      { type: 'play',     beatStart: 3.5,   beatEnd: 7.5,   notes: [4, 5, 6, 7], playMode: 1 },  
      { type: 'tutorial', beatStart: 7.5,   beatEnd: 11.5, notes: [8,8.5, 10, 10.5] },
      { type: 'play',     beatStart: 11.5,   beatEnd: 15.5,   notes: [12, 12.5, 14, 14.5], playMode: 1 },  
      { type: 'tutorial', beatStart: 15.5,   beatEnd: 23.5, notes: [16, 17, 18, 18.5, 19, 20, 21, 22], message:"难度上升，扫描线消失！" },
      { type: 'play',     beatStart: 23.5,   beatEnd: 31.5,   notes: [24, 25, 26, 26.5, 27, 28, 29, 30], playMode: 2 },
      { type: 'tutorial', beatStart: 31.5,   beatEnd: 36.0, notes: [32.5, 33.5, 34, 34.5, 34.75, 35.25, 35.5]},
      { type: 'play',     beatStart: 35.5,   beatEnd: 40.0,   notes: [36.5, 37.5, 38, 38.5, 38.75, 39.25, 39.5], playMode: 2 },
      { type: 'tutorial', beatStart: 39.5,   beatEnd: 43.5, notes: [40, 41, 42, 43] },
      { type: 'play',     beatStart: 43.5,   beatEnd: 47.5,   notes: [44, 45, 46, 47], playMode: 2 }, 
      { type: 'tutorial', beatStart: 47.5,   beatEnd: 52.0, notes: [48, 49, 49.25, 49.5, 50,] },
      { type: 'play',     beatStart: 51.5,   beatEnd: 56.0,   notes: [52, 53, 53.25, 53.5, 54], playMode: 2 }, 
      { type: 'tutorial', beatStart: 55.5,   beatEnd: 60.5, notes: [57, 58, 59, 60] },
      { type: 'play',     beatStart: 60.5,   beatEnd: 65.5,   notes: [62, 63, 64, 65], playMode: 2 }, 
      { type: 'tutorial', beatStart: 65.5,   beatEnd: 70.0, notes: [66, 67, 67.25, 67.5, 68, 69, 69.25, 69.5] },
      { type: 'play',     beatStart: 69.5,   beatEnd: 74.0,   notes: [70, 71, 71.25, 71.5, 72, 73, 73.25, 73.5], playMode: 2 }, 
      { type: 'tutorial', beatStart: 73.5,   beatEnd: 78.5, notes: [75, 76, 77, 78] },
      { type: 'play',     beatStart: 78.5,   beatEnd: 83.5,   notes: [80, 81, 82, 83], playMode: 2 }, 
    ]
  },
  {
    id: 'jinli',
    title: '锦鲤抄',
    artist: '银临·云之泣',
    cover: 'assets/covers/jinli.jpeg',
    audio: 'assets/audio/jinli.mp3',
    bpm: 175,           // TODO: 填写 BPM
    duration: 90,      // TODO: 填写歌曲时长（秒）
    difficulty: '简单·三拍子',
    color: ['#FBBF77', '#F472B6'],
    offset: 1.8,        // TODO: 0 拍位置对应的真实时间（秒）
    segments: [
      { type: 'tutorial', beatStart: -1,   beatEnd: 11.5, notes: [0, 3, 6, 9] ,message:"记住节奏～"},
      { type: 'play',     beatStart: 11,   beatEnd: 23.5,   notes: [12, 15, 18, 21], playMode: 1 }, 
      { type: 'tutorial', beatStart: 23,   beatEnd: 35.5, notes: [24, 25, 26, 30, 31, 32] },
      { type: 'play',     beatStart: 35,   beatEnd: 47.5, notes: [36, 37, 38, 42, 43, 44], playMode: 1 }, 
      { type: 'tutorial', beatStart: 47,   beatEnd: 59.5, notes: [48, 51, 52, 53, 54, 57, 58, 59 ], message:"难度上升，扫描线消失！" },
      { type: 'play',     beatStart: 59,   beatEnd: 71.5, notes: [60, 63, 64, 65, 66, 69, 70, 71], playMode: 2 }, 
      { type: 'tutorial', beatStart: 71,   beatEnd: 83.5, notes: [72, 74, 75, 77, 78, 80, 81] },
      { type: 'play',     beatStart: 83,   beatEnd: 95.5, notes: [84, 86, 87, 89, 90, 92, 93], playMode: 2 }, 
      { type: 'tutorial', beatStart: 95,   beatEnd: 107.5, notes: [96, 97, 99, 100, 102, 103, 105, 106] },
      { type: 'play',     beatStart: 107,   beatEnd: 119.5, notes: [108, 109, 111, 112, 114, 115, 117, 118], playMode: 2 }, 
      { type: 'tutorial', beatStart: 119,   beatEnd: 131.5, notes: [120, 123, 124, 125, 126, 130, 131] },
      { type: 'play',     beatStart: 131,   beatEnd: 143.5, notes: [132, 135, 136, 137, 138, 142, 143], playMode: 2 }, 
      // TODO: 填写谱面段落
      { type: 'tutorial', beatStart: 143,   beatEnd: 149.5, notes: [144, 147, 148, 149] },
      { type: 'play',     beatStart: 149,   beatEnd: 155.5, notes: [150, 153, 154, 155], playMode: 2 }, 
      { type: 'tutorial', beatStart: 155,   beatEnd: 161.5, notes: [156, 159, 160, 161] },
      { type: 'play',     beatStart: 161,   beatEnd: 167.5, notes: [162, 165, 166, 167], playMode: 2 }, 
      { type: 'tutorial', beatStart: 167,   beatEnd: 173.5, notes: [168, 169, 170, 171] },
      { type: 'play',     beatStart: 173,   beatEnd: 179.5, notes: [174, 175, 176, 177], playMode: 2 }, 
      { type: 'tutorial', beatStart: 179,   beatEnd: 185.5, notes: [180, 181, 182, 183] },
      { type: 'play',     beatStart: 185,   beatEnd: 191.5, notes: [186, 187, 188, 189], playMode: 2 }, 
      { type: 'idle', beatStart: 191,   beatEnd: 197, message:"继续变难！"},
      { type: 'tutorial', beatStart: 197,   beatEnd: 209.5, notes: [198, 199.5, 200, 201, 202, 203, 204, 206, 207] },
      { type: 'play',     beatStart: 209,   beatEnd: 221.5, notes: [210, 211.5, 212, 213, 214, 215, 216, 218, 219], playMode: 2 }, 
      { type: 'tutorial', beatStart: 221.1,   beatEnd: 233.5, notes: [222, 223, 224, 225, 228, 229, 230, 231, 233] },
      { type: 'play',     beatStart: 233.1,   beatEnd: 245.5, notes: [234, 235, 236, 237, 240, 241, 242, 243, 245], playMode: 2 }, 
      { type: 'tutorial', beatStart: 245.1,   beatEnd: 251.5, notes: [246, 247, 248, 249] },
      { type: 'play',     beatStart: 251.1,   beatEnd: 257.5, notes: [252, 253, 254, 255], playMode: 2 }, 
    ]
  }
];

function getSongById(id) {
  return SONGS.find(s => s.id === id);
}
