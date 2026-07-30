/**
 * 影子对决数据仓库。
 * 影子事件均为相对歌曲起点的毫秒时间戳，不包含音频或视频数据。
 */

function createTapEvents(times) {
  return times.map(time => ({ time, type: 'tap' }));
}

const SHADOWS = [
  {
    id: 'shadow_yoru_yuurei_001',
    source: 'recorded',
    profile: {
      name: '夜巡小羽',
      avatar: '',
      title: '迅捷型',
      rating: 1180
    },
    songId: 'yuureitokyo',
    chartVersion: 'yuureitokyo-v1',
    recordingOffsetMs: 0,
    events: createTapEvents([
      5866, 6374, 6825, 7330, 7834, 8266, 8785, 9256, 13629, 14064, 14585, 15087,
      15543, 16051, 16502, 16765, 17028, 21331, 21850, 22321, 23306, 23741, 24262, 29119,
      29334, 30084, 30292, 31039, 31302, 31976, 32253, 44579, 45081, 45273, 45552, 46538,
      47479, 47987, 52309, 52572, 53318, 53508, 54511, 55224, 55484, 58096, 58496, 58877,
      59334, 59600, 62470, 62733, 63480, 65847, 66245, 66595, 67097, 67290, 69746, 70248,
      70705, 71213, 77470, 77975, 78480, 78911, 79430, 79901, 80403, 80838, 85230, 85611,
      85947, 86213, 87147, 88136, 94931, 95847, 96850, 97804, 102661, 103580, 104585, 105570,
      110866, 111132, 111341, 111846, 112351, 113024, 113301, 113772, 116210, 116282, 116439,
      116578, 116672, 117180, 117389, 120072, 120576, 121008, 121527, 125869, 126250, 126564,
      126843, 127345, 127801, 128793, 129002, 129265, 129528, 131653, 132414, 132643, 139435,
      139749, 140149, 140409, 140745, 141132, 141341, 141725, 142109, 142299, 147535, 147885,
      148145, 148459, 148859, 149119, 149455, 149842, 150051, 154910, 155415, 155847, 156850,
      157321, 157822, 160677, 160835, 160974, 161068, 161213, 161663, 161926, 164609, 165041,
      165559, 166030, 172339, 172652, 173052, 173312, 173769, 174277, 175212, 175475, 175738,
      175928, 178140, 178853, 179113, 185838, 186359, 186861, 187801, 188309, 188760, 189023,
      189286, 193589, 194592, 194942, 195322
    ]),
    summary: {
      score: 23820,
      accuracy: 96.2,
      maxCombo: 64
    }
  },
  {
    id: 'shadow_hoshi_stay_001',
    source: 'recorded',
    profile: {
      name: '节奏小星',
      avatar: '',
      title: '稳定型',
      rating: 980
    },
    songId: 'stay',
    chartVersion: 'stay-v1',
    recordingOffsetMs: 0,
    events: createTapEvents([
      2909, 3610, 5016, 8367, 8617, 9772, 10091, 16558, 17277, 17864, 18569, 19294,
      19972, 20647, 25036, 25826, 26108, 26432, 26648, 26884, 30100, 30770, 31462,
      32225, 36306, 36507, 36635, 37003, 42474, 43178, 43830, 44409, 47867, 48546,
      48811, 48914, 49232, 49865, 50142, 50315, 54711, 55429, 56067, 56765
    ]),
    summary: {
      score: 4010,
      accuracy: 83.5,
      maxCombo: 44
    }
  },
  {
    id: 'shadow_koi_jinli_001',
    source: 'recorded',
    profile: {
      name: '锦鲤少女',
      avatar: '',
      title: '追拍型',
      rating: 1080
    },
    songId: 'jinli',
    chartVersion: 'jinli-v1',
    recordingOffsetMs: 0,
    events: createTapEvents([
      5932, 6908, 14223, 14477, 14814, 16137, 16504, 16899, 22399, 23364, 23816,
      24097, 24424, 25547, 25845, 26114, 30642, 31307, 31652, 32390, 32623, 33387,
      33727, 38796, 39172, 40170, 40856, 41166, 41890, 47096, 48020, 48467, 48786,
      49167, 50434, 50742, 53196, 54560, 54905, 57280, 58415, 58711, 58999, 61440,
      61808, 62060, 62112, 62412, 65549, 65917, 66551, 73743, 74304, 74406, 75135,
      75898, 76553, 76906, 82027, 82409, 82772, 83083, 84104, 84352, 84858, 85077,
      85731, 88227, 88530, 88908, 89191
    ]),
    summary: {
      score: 6430,
      accuracy: 82.4,
      maxCombo: 70
    }
  }
];

function validateShadowRecord(shadow, songs = SONGS) {
  const errors = [];
  const song = songs.find(item => item.id === shadow.songId);

  if (!shadow.id) errors.push('缺少影子 id');
  if (!song) errors.push(`歌曲不存在: ${shadow.songId}`);
  if (song && shadow.chartVersion !== song.chartVersion) {
    errors.push(`谱面版本不一致: ${shadow.chartVersion} !== ${song.chartVersion}`);
  }
  if (!Array.isArray(shadow.events) || shadow.events.length === 0) {
    errors.push('点击事件为空');
  } else if (song) {
    let previousTime = -Infinity;
    shadow.events.forEach((event, index) => {
      if (event.type !== 'tap') errors.push(`事件 ${index} 类型不支持`);
      if (!Number.isFinite(event.time)) errors.push(`事件 ${index} 时间非法`);
      if (event.time < 0 || event.time > song.duration * 1000) {
        errors.push(`事件 ${index} 超出歌曲时长`);
      }
      if (event.time < previousTime) errors.push(`事件 ${index} 未按时间升序排列`);
      previousTime = event.time;
    });
  }

  return { valid: errors.length === 0, errors, shadow, song };
}

function validateShadowPool(shadows = SHADOWS, songs = SONGS) {
  return shadows.map(shadow => validateShadowRecord(shadow, songs));
}

function getCompatibleShadows(songId, chartVersion) {
  return SHADOWS.filter(shadow => (
    shadow.songId === songId
    && shadow.chartVersion === chartVersion
    && validateShadowRecord(shadow).valid
  ));
}

