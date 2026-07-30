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
      rating: 1390
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
      rating: 1180
    },
    songId: 'stay',
    chartVersion: 'stay-v1',
    recordingOffsetMs: 0,
    events: createTapEvents([
      2897, 3576, 4245, 4966, 8345, 8651, 9676, 10014, 16493, 17205, 17908, 18269,
      18576, 19306, 19905, 20616, 25043, 25767, 26075, 26387, 26568, 26885, 27071,
      30215, 30861, 31560, 32239, 35575, 36366, 36516, 36692, 36950, 42457, 43170,
      43817, 44483, 47924, 48537, 48708, 48895, 49259, 49948, 50036, 50212, 54675,
      55391, 56058
    ]),
    summary: {
      score: 4460,
      accuracy: 92.9,
      maxCombo: 47
    }
  },
  {
    id: 'shadow_koi_jinli_001',
    source: 'recorded',
    profile: {
      name: '锦鲤少女',
      avatar: '',
      title: '追拍型',
      rating: 1320
    },
    songId: 'jinli',
    chartVersion: 'jinli-v1',
    recordingOffsetMs: 0,
    events: createTapEvents([
      5937, 6920, 7936, 8993, 14096, 14533, 14873, 16191, 16509, 16858, 22324,
      23367, 24030, 24395, 25427, 25786, 26170, 30527, 31232, 31605, 32334, 32674,
      33348, 33632, 38789, 39186, 39879, 40142, 40837, 41044, 41227, 41885, 42179,
      47073, 48059, 48378, 48743, 49147, 50503, 50813, 53236, 53513, 54271, 54548,
      54979, 57323, 58300, 58725, 59057, 61455, 61769, 62438, 65600, 65890, 66285,
      66622, 73835, 74499, 74809, 75187, 75445, 75811, 76492, 76888, 81965, 82388,
      82741, 83063, 84072, 84408, 84821, 85084, 85294, 85842, 88251, 88562, 88931,
      89241
    ]),
    summary: {
      score: 7110,
      accuracy: 91.2,
      maxCombo: 75
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

