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
    artist: '（翻唱。原作：羽生迷子）',
    cover: 'assets/covers/harehareya.jpg',
    audio: 'assets/audio/harehareya.mp3',
    bpm: 91,
    duration: 208,
    difficulty: '简单',
    color: ['#38BDF8', '#0EA5E9'],
    offset: 0,   // 0 拍位置 = 歌曲 0.000 秒
    // —— 新格式：每个 seg 单独定义，单位 beat（1 四分音符 = 1 拍） ——
    // 音符只在 [1, 1.5, 3.5] 拍；play 段 playMode 在 1 / 3 间交替。
    segments: [
      { type: 'tutorial', beatStart: 0,   beatEnd: 4,   notes: [1, 1.5, 3.5] },
      { type: 'play',     beatStart: 4,   beatEnd: 8,   notes: [1, 1.5, 3.5], playMode: 1 },
      { type: 'tutorial', beatStart: 8,   beatEnd: 12,  notes: [1, 1.5, 3.5] },
      { type: 'play',     beatStart: 12,  beatEnd: 16,  notes: [1, 1.5, 3.5], playMode: 3 },
      { type: 'tutorial', beatStart: 16,  beatEnd: 20,  notes: [1, 1.5, 3.5] },
      { type: 'play',     beatStart: 20,  beatEnd: 24,  notes: [1, 1.5, 3.5], playMode: 1 },
      { type: 'tutorial', beatStart: 24,  beatEnd: 28,  notes: [1, 1.5, 3.5] },
      { type: 'play',     beatStart: 28,  beatEnd: 32,  notes: [1, 1.5, 3.5], playMode: 3 },
      { type: 'tutorial', beatStart: 32,  beatEnd: 36,  notes: [1, 1.5, 3.5] },
      { type: 'play',     beatStart: 36,  beatEnd: 40,  notes: [1, 1.5, 3.5], playMode: 1 },
      { type: 'tutorial', beatStart: 40,  beatEnd: 44,  notes: [1, 1.5, 3.5] },
      { type: 'play',     beatStart: 44,  beatEnd: 48,  notes: [1, 1.5, 3.5], playMode: 3 },
      { type: 'tutorial', beatStart: 48,  beatEnd: 52,  notes: [1, 1.5, 3.5] },
      { type: 'play',     beatStart: 52,  beatEnd: 56,  notes: [1, 1.5, 3.5], playMode: 1 },
      { type: 'tutorial', beatStart: 56,  beatEnd: 60,  notes: [1, 1.5, 3.5] },
      { type: 'play',     beatStart: 60,  beatEnd: 64,  notes: [1, 1.5, 3.5], playMode: 3 },
      { type: 'tutorial', beatStart: 64,  beatEnd: 68,  notes: [1, 1.5, 3.5] },
      { type: 'play',     beatStart: 68,  beatEnd: 72,  notes: [1, 1.5, 3.5], playMode: 1 },
      { type: 'tutorial', beatStart: 72,  beatEnd: 76,  notes: [1, 1.5, 3.5] },
      { type: 'play',     beatStart: 76,  beatEnd: 80,  notes: [1, 1.5, 3.5], playMode: 3 },
      { type: 'tutorial', beatStart: 80,  beatEnd: 84,  notes: [1, 1.5, 3.5] },
      { type: 'play',     beatStart: 84,  beatEnd: 88,  notes: [1, 1.5, 3.5], playMode: 1 },
      { type: 'tutorial', beatStart: 88,  beatEnd: 92,  notes: [1, 1.5, 3.5] },
      { type: 'play',     beatStart: 92,  beatEnd: 96,  notes: [1, 1.5, 3.5], playMode: 3 },
      { type: 'tutorial', beatStart: 96,  beatEnd: 100, notes: [1, 1.5, 3.5] },
      { type: 'play',     beatStart: 100, beatEnd: 104, notes: [1, 1.5, 3.5], playMode: 1 },
      { type: 'tutorial', beatStart: 104, beatEnd: 108, notes: [1, 1.5, 3.5] },
      { type: 'play',     beatStart: 108, beatEnd: 112, notes: [1, 1.5, 3.5], playMode: 3 },
      { type: 'tutorial', beatStart: 112, beatEnd: 116, notes: [1, 1.5, 3.5] },
      { type: 'play',     beatStart: 116, beatEnd: 120, notes: [1, 1.5, 3.5], playMode: 1 },
      { type: 'tutorial', beatStart: 120, beatEnd: 124, notes: [1, 1.5, 3.5] },
      { type: 'play',     beatStart: 124, beatEnd: 128, notes: [1, 1.5, 3.5], playMode: 3 },
      { type: 'tutorial', beatStart: 128, beatEnd: 132, notes: [1, 1.5, 3.5] },
      { type: 'play',     beatStart: 132, beatEnd: 136, notes: [1, 1.5, 3.5], playMode: 1 },
      { type: 'tutorial', beatStart: 136, beatEnd: 140, notes: [1, 1.5, 3.5] },
      { type: 'play',     beatStart: 140, beatEnd: 144, notes: [1, 1.5, 3.5], playMode: 3 },
      { type: 'tutorial', beatStart: 144, beatEnd: 148, notes: [1, 1.5, 3.5] },
      { type: 'play',     beatStart: 148, beatEnd: 152, notes: [1, 1.5, 3.5], playMode: 1 },
      { type: 'tutorial', beatStart: 152, beatEnd: 156, notes: [1, 1.5, 3.5] },
      { type: 'play',     beatStart: 156, beatEnd: 160, notes: [1, 1.5, 3.5], playMode: 3 },
      { type: 'tutorial', beatStart: 160, beatEnd: 164, notes: [1, 1.5, 3.5] },
      { type: 'play',     beatStart: 164, beatEnd: 168, notes: [1, 1.5, 3.5], playMode: 1 },
      { type: 'tutorial', beatStart: 168, beatEnd: 172, notes: [1, 1.5, 3.5] },
      { type: 'play',     beatStart: 172, beatEnd: 176, notes: [1, 1.5, 3.5], playMode: 3 },
      { type: 'tutorial', beatStart: 176, beatEnd: 180, notes: [1, 1.5, 3.5] },
      { type: 'play',     beatStart: 180, beatEnd: 184, notes: [1, 1.5, 3.5], playMode: 1 },
      { type: 'tutorial', beatStart: 184, beatEnd: 188, notes: [1, 1.5, 3.5] },
      { type: 'play',     beatStart: 188, beatEnd: 192, notes: [1, 1.5, 3.5], playMode: 3 },
      { type: 'tutorial', beatStart: 192, beatEnd: 196, notes: [1, 1.5, 3.5] },
      { type: 'play',     beatStart: 196, beatEnd: 200, notes: [1, 1.5, 3.5], playMode: 1 },
      { type: 'idle',     beatStart: 200, beatEnd: 204, notes: [], message: '中场休息～喝口水吧' },
      { type: 'tutorial', beatStart: 204, beatEnd: 208, notes: [1, 1.5, 3.5] }
    ]
  },
  {
    id: 'snowjam',
    title: 'Snow Jam',
    artist: '（翻唱。原作：Rin音）',
    cover: 'assets/covers/snowjam.jpg',
    audio: 'assets/audio/snowjam.mp3',
    bpm: 86,
    duration: 191,
    difficulty: '中等',
    color: ['#5EEAD4', '#2DD4BF'],
    segments: [
      { type: 'tutorial', start: 0,      end: 4000,   notes: [1000, 1500, 3500] },
      { type: 'play',     start: 4000,   end: 8000,   notes: [5000, 5500, 7500] , playMode: 3 },
      { type: 'idle',     start: 8000,   end: 12000,  notes: [] },
      { type: 'tutorial', start: 12000,  end: 16000,  notes: [13000, 13500, 15500] },
      { type: 'play',     start: 16000,  end: 20000,  notes: [17000, 17500, 19500] , playMode: 1 },
      { type: 'idle',     start: 20000,  end: 24000,  notes: [] },
      { type: 'tutorial', start: 24000,  end: 28000,  notes: [25000, 25500, 27500] },
      { type: 'play',     start: 28000,  end: 32000,  notes: [29000, 29500, 31500] , playMode: 2 },
      { type: 'idle',     start: 32000,  end: 36000,  notes: [] },
      { type: 'tutorial', start: 36000,  end: 40000,  notes: [37000, 37500, 39500] },
      { type: 'play',     start: 40000,  end: 44000,  notes: [41000, 41500, 43500] , playMode: 3 },
      { type: 'idle',     start: 44000,  end: 48000,  notes: [] },
      { type: 'tutorial', start: 48000,  end: 52000,  notes: [49000, 49500, 51500] },
      { type: 'play',     start: 52000,  end: 56000,  notes: [53000, 53500, 55500] , playMode: 1 },
      { type: 'idle',     start: 56000,  end: 60000,  notes: [] },
      { type: 'tutorial', start: 60000,  end: 64000,  notes: [61000, 61500, 63500] },
      { type: 'play',     start: 64000,  end: 68000,  notes: [65000, 65500, 67500] , playMode: 2 },
      { type: 'idle',     start: 68000,  end: 72000,  notes: [] },
      { type: 'tutorial', start: 72000,  end: 76000,  notes: [73000, 73500, 75500] },
      { type: 'play',     start: 76000,  end: 80000,  notes: [77000, 77500, 79500] , playMode: 3 },
      { type: 'idle',     start: 80000,  end: 84000,  notes: [] },
      { type: 'tutorial', start: 84000,  end: 88000,  notes: [85000, 85500, 87500] },
      { type: 'play',     start: 88000,  end: 92000,  notes: [89000, 89500, 91500] , playMode: 1 },
      { type: 'idle',     start: 92000,  end: 96000,  notes: [] },
      { type: 'tutorial', start: 96000,  end: 100000, notes: [97000, 97500, 99500] },
      { type: 'play',     start: 100000, end: 104000, notes: [101000, 101500, 103500] , playMode: 2 },
      { type: 'idle',     start: 104000, end: 108000, notes: [] },
      { type: 'tutorial', start: 108000, end: 112000, notes: [109000, 109500, 111500] },
      { type: 'play',     start: 112000, end: 116000, notes: [113000, 113500, 115500] , playMode: 3 },
      { type: 'idle',     start: 116000, end: 120000, notes: [] },
      { type: 'tutorial', start: 120000, end: 124000, notes: [121000, 121500, 123500] },
      { type: 'play',     start: 124000, end: 128000, notes: [125000, 125500, 127500] , playMode: 1 },
      { type: 'idle',     start: 128000, end: 132000, notes: [] },
      { type: 'tutorial', start: 132000, end: 136000, notes: [133000, 133500, 135500] },
      { type: 'play',     start: 136000, end: 140000, notes: [137000, 137500, 139500] , playMode: 2 },
      { type: 'idle',     start: 140000, end: 144000, notes: [] },
      { type: 'tutorial', start: 144000, end: 148000, notes: [145000, 145500, 147500] },
      { type: 'play',     start: 148000, end: 152000, notes: [149000, 149500, 151500] , playMode: 3 },
      { type: 'idle',     start: 152000, end: 156000, notes: [] },
      { type: 'tutorial', start: 156000, end: 160000, notes: [157000, 157500, 159500] },
      { type: 'play',     start: 160000, end: 164000, notes: [161000, 161500, 163500] , playMode: 1 },
      { type: 'idle',     start: 164000, end: 168000, notes: [] },
      { type: 'tutorial', start: 168000, end: 172000, notes: [169000, 169500, 171500] },
      { type: 'play',     start: 172000, end: 176000, notes: [173000, 173500, 175500] , playMode: 2 },
      { type: 'idle',     start: 176000, end: 180000, notes: [] },
      { type: 'tutorial', start: 180000, end: 184000, notes: [181000, 181500, 183500] },
      { type: 'play',     start: 184000, end: 188000, notes: [185000, 185500, 187500] , playMode: 3 },
      { type: 'idle',     start: 188000, end: 191000, notes: [] }
    ]
  },
  {
    id: 'subobjective',
    title: 'sub/objective',
    artist: '（翻唱。原作：たなか）',
    cover: 'assets/covers/subobjective.png',
    audio: 'assets/audio/subobjective.mp3',
    bpm: 95,
    duration: 179,
    difficulty: '困难',
    color: ['#818CF8', '#6366F1'],
    segments: [
      { type: 'tutorial', start: 225,      end: 5277,   notes: [725, 1356, 1988, 2619, 3251, 3882, 4514, 5145] },
      { type: 'play',     start: 5277,   end: 10329,   notes: [5777, 6408, 7040, 7671, 8303, 8934, 9566, 10197] , playMode: 1 },
      { type: 'tutorial', start: 10329,  end: 15381,  notes: [10829, 11460, 12092, 12723, 13355, 13986, 14618, 15249] },
      { type: 'play',     start: 15381,  end: 20433,  notes: [15831, 16462, 17094, 17725, 18357, 18988, 19620, 20251] , playMode: 2 },
      { type: 'tutorial', start: 20433,  end: 25485,  notes: [20833, 21464, 22096, 22727, 23359, 23990, 24622, 25253] },
      { type: 'play',     start: 25485,  end: 30537,  notes: [25985, 26616, 27248, 27879, 28511, 29142, 29774, 30405] , playMode: 2 },
{ type: 'tutorial', start: 30537,  end: 35589,  notes: [31037, 31668.5, 32300, 32931.5, 33563, 34194.5, 34826, 35457.5] },
{ type: 'play',     start: 35589,  end: 40641, notes: [36089, 36720.5, 37352, 37983.5, 38615, 39246.5, 39878, 40509.5], playMode: 2},
{ type: 'tutorial', start: 40641,  end: 45693, notes: [41141, 41772.5, 42404, 43035.5, 43667, 44298.5, 44930, 45561.5] },
{ type: 'play',     start: 45693,  end: 50745, notes: [46193, 46824.5, 47456, 48087.5, 48719, 49350.5, 49982, 50613.5], playMode: 2 },
{ type: 'tutorial', start: 50745,  end: 55797, notes: [51245, 51876.5, 52508, 53139.5, 53771, 54402.5, 55034, 55665.5] },
{ type: 'play',     start: 55797,  end: 60849, notes: [56297, 56928.5, 57560, 58191.5, 58823, 59454.5, 60086, 60717.5], playMode: 2 },
{ type: 'tutorial', start: 60849,  end: 65901, notes: [61349, 61980.5, 62612, 63243.5, 63875, 64506.5, 65138, 65769.5] },
{ type: 'play',     start: 65901,  end: 70953, notes: [66401, 67032.5, 67664, 68295.5, 68927, 69558.5, 70190, 70821.5] , playMode: 2},
{ type: 'tutorial', start: 70953,  end: 76005, notes: [71453, 72084.5, 72716, 73347.5, 73979, 74610.5, 75242, 75873.5] },
{ type: 'play',     start: 76005,  end: 81057, notes: [76505, 77136.5, 77768, 78399.5, 79031, 79662.5, 80294, 80925.5], playMode: 2 },
{ type: 'tutorial', start: 81057,  end: 86109, notes: [81557, 82188.5, 82820, 83451.5, 84083, 84714.5, 85346, 85977.5] },
{ type: 'play',     start: 86109,  end: 91161, notes: [86609, 87240.5, 87872, 88503.5, 89135, 89766.5, 90398, 91029.5] , playMode: 2},
{ type: 'tutorial', start: 91161,  end: 96213, notes: [91661, 92292.5, 92924, 93555.5, 94187, 94818.5, 95450, 96081.5] },
{ type: 'play',     start: 96213,  end: 101265, notes: [96713, 97344.5, 97976, 98607.5, 99239, 99870.5, 100502, 101133.5] , playMode: 2},
{ type: 'tutorial', start: 101265,  end: 106317, notes: [101765, 102396.5, 103028, 103659.5, 104291, 104922.5, 105554, 106185.5] },
{ type: 'play',     start: 106317,  end: 111369, notes: [106817, 107448.5, 108080, 108711.5, 109343, 109974.5, 110606, 111237.5] , playMode: 2},
{ type: 'tutorial', start: 111369,  end: 116421, notes: [111869, 112500.5, 113132, 113763.5, 114395, 115026.5, 115658, 116289.5] },
{ type: 'play',     start: 116421,  end: 121473, notes: [116921, 117552.5, 118184, 118815.5, 119447, 120078.5, 120710, 121341.5] , playMode: 2},
{ type: 'tutorial', start: 121473,  end: 126525, notes: [121973, 122604.5, 123236, 123867.5, 124499, 125130.5, 125762, 126393.5] },
{ type: 'play',     start: 126525,  end: 131577, notes: [127025, 127656.5, 128288, 128919.5, 129551, 130182.5, 130814, 131445.5], playMode: 2 },
{ type: 'tutorial', start: 131577,  end: 136629, notes: [132077, 132708.5, 133340, 133971.5, 134603, 135234.5, 135866, 136497.5] },
{ type: 'play',     start: 136629,  end: 141681, notes: [137129, 137760.5, 138392, 139023.5, 139655, 140286.5, 140918, 141549.5] , playMode: 2},
{ type: 'tutorial', start: 141681,  end: 146733, notes: [142181, 142812.5, 143444, 144075.5, 144707, 145338.5, 145970, 146601.5] },
{ type: 'play',     start: 146733,  end: 151785, notes: [147233, 147864.5, 148496, 149127.5, 149759, 150390.5, 151022, 151653.5] , playMode: 2},
{ type: 'tutorial', start: 151785,  end: 156837, notes: [152285, 152916.5, 153548, 154179.5, 154811, 155442.5, 156074, 156705.5] },
{ type: 'play',     start: 156837,  end: 161889, notes: [157337, 157968.5, 158600, 159231.5, 159863, 160494.5, 161126, 161757.5] , playMode: 2},
{ type: 'tutorial', start: 161889,  end: 166941, notes: [162389, 163020.5, 163652, 164283.5, 164915, 165546.5, 166178, 166809.5] },
{ type: 'play',     start: 166941,  end: 171993, notes: [167441, 168072.5, 168704, 169335.5, 169967, 170598.5, 171230, 171861.5] , playMode: 2},
{ type: 'tutorial', start: 171993,  end: 177045, notes: [172493, 173124.5, 173756, 174387.5, 175019, 175650.5, 176282, 176913.5] },
{ type: 'play',     start: 177045,  end: 182097, notes: [177545, 178176.5, 178808, 179439.5, 180071, 180702.5, 181334, 181965.5] , playMode: 2},
    ]
  },
  {
    id: 'yuureitokyo',
    title: '幽霊東京',
    artist: '（翻唱。原作：Ayase·初音ミク）',
    cover: 'assets/covers/yuureitokyo.png',
    audio: 'assets/audio/yuureitokyo.mp3',
    bpm: 124,
    duration: 200,
    offset: 2,
    difficulty: '困难',
    color: ['#A78BFA', '#8B5CF6'],
    segments: [
      { type: 'tutorial', beatStart: -0.5,   beatEnd: 7.5,   notes: [0, 1, 2, 3, 4, 5, 6, 7] },
      { type: 'play',     beatStart: 7.5,   beatEnd: 15.5,   notes: [8, 9, 10, 11, 12, 13, 14, 15], playMode: 1 },
      { type: 'tutorial', beatStart: 15.5,   beatEnd: 23.5,   notes: [16, 17, 18, 19, 20, 21, 22, 22.5, 23] },
      { type: 'play',     beatStart: 23.5,   beatEnd: 31.5,   notes: [24, 25, 26, 27, 28, 29, 30, 30.5, 31], playMode: 1 },
      { type: 'tutorial', beatStart: 31.5,   beatEnd: 39.5,   notes: [32, 33, 34, 36, 37, 38]},
      { type: 'play',     beatStart: 39.5,   beatEnd: 47.5,   notes: [40, 41, 42, 44, 45, 46], playMode: 1 },
      { type: 'tutorial', beatStart: 47.5,   beatEnd: 55.5,   notes: [48, 48.5, 50, 50.5, 52, 52.5, 54, 54.5]},
      { type: 'play',     beatStart: 55.5,   beatEnd: 63.5,   notes: [56, 56.5, 58, 58.5, 60, 60.5, 62, 62.5], playMode: 1 },
      { type: 'idle', beatStart: 63.5,   beatEnd: 79.5, message:"休息一下，难度即将上升！"},
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
      { type: 'idle',     beatStart: 143.5,   beatEnd: 147.5},
      { type: 'tutorial', beatStart: 147.5,   beatEnd: 155.5,   notes: [148, 149, 150, 151, 152, 153, 154, 155]},
      { type: 'play',     beatStart: 155.5,   beatEnd: 163.5,   notes: [156, 157, 158, 159, 160, 161, 162, 163], playMode: 2 },
      { type: 'tutorial', beatStart: 163.5,   beatEnd: 171.5,   notes: [164, 164.75, 165.5, 166, 168, 170]},
      { type: 'play',     beatStart: 171.5,   beatEnd: 179.5,   notes: [172, 172.75, 173.5, 174, 176, 178], playMode: 2 },
      { type: 'idle',     beatStart: 179.5,   beatEnd: 183.5,   },
     ]
  }
];

function getSongById(id) {
  return SONGS.find(s => s.id === id);
}
