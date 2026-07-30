/**
 * 影子对决数据仓库。
 * 影子事件均为相对歌曲起点的毫秒时间戳，不包含音频或视频数据。
 */

function createTapEvents(times) {
  return times.map(time => ({ time, type: 'tap' }));
}

const SHADOWS = [
  {
    id: 'shadow_mio_snowjam_001',
    source: 'recorded',
    profile: {
      name: '节拍小澪',
      avatar: '',
      title: '稳定型',
      rating: 1120
    },
    songId: 'snowjam',
    chartVersion: 'snowjam-v1',
    recordingOffsetMs: 0,
    events: createTapEvents([
      4982, 5508, 7523, 16993, 17514, 19472, 29005, 29531, 31489, 41017, 41482, 43508,
      53023, 53493, 55514, 64972, 65505, 67531, 76989, 77517, 79482, 89008, 89523, 91493,
      101014, 101472, 103505, 113031, 115489, 125017, 125482, 127508, 137023, 137493, 139514,
      148972, 149505, 151531, 160989, 161517, 163482, 173008, 173523, 175493, 185014, 185472,
      187505
    ]),
    summary: {
      score: 5148,
      accuracy: 93.6,
      maxCombo: 28
    }
  },
  {
    id: 'shadow_ritsu_subobjective_001',
    source: 'recorded',
    profile: {
      name: '律动阿澈',
      avatar: '',
      title: '追拍型',
      rating: 1280
    },
    songId: 'subobjective',
    chartVersion: 'subobjective-v1',
    recordingOffsetMs: 0,
    events: createTapEvents([
      5789, 6399, 7075, 7675, 8281, 8952, 9562, 10224, 15816, 16468, 17136, 17694,
      18369, 18979, 19655, 20255, 25963, 26634, 27244, 27906, 28496, 29148, 29816, 30374,
      36101, 36712, 37387, 37988, 38593, 39265, 39874, 40537, 46178, 46831, 47498, 48057,
      49363, 49973, 50649, 56301, 56907, 57578, 58188, 58850, 59440, 60092, 60760, 66370,
      67045, 67655, 68331, 68931, 69537, 70208, 70818, 76532, 77122, 77774, 78442, 79000,
      79675, 80285, 80961, 86613, 87219, 87890, 88500, 89162, 89752, 90404, 91072, 96682,
      97988, 98599, 99274, 99875, 100480, 101152, 106813, 107476, 108065, 108718, 109385,
      109944, 110618, 111229, 116956, 117557, 118162, 118834, 119443, 120106, 120695, 121348,
      127067, 127626, 128300, 128911, 129586, 130187, 130792, 131464, 137125, 137788, 138377,
      139030, 139697, 140256, 141562, 147224, 147900, 148500, 149106, 149777, 150387, 151049,
      151639, 157343, 158011, 158569, 159244, 159854, 160530, 161130, 161736, 167459, 168069,
      168731, 169321, 169973, 170641, 171199, 171874, 177536, 178212, 178812
    ]),
    summary: {
      score: 16840,
      accuracy: 95.1,
      maxCombo: 51
    }
  },
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

