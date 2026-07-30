/**
 * 可复现的训练影子生成器。
 * 所有随机结果在开局前生成，游戏过程中只回放固定事件数组。
 */

function hashShadowSeed(value) {
  const text = String(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed) {
  let state = hashShadowSeed(seed) || 0x6d2b79f5;
  return function random() {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function getDuelTargetNotes(song) {
  const compiledSegments = compileChart(song);
  const targets = [];

  compiledSegments.forEach((segment, index) => {
    if (segment.type !== 'play') return;

    const inSegment = (segment.notes || []).filter(time => time >= segment.start && time <= segment.end);
    if (inSegment.length > 0) {
      targets.push(...inSegment);
      return;
    }

    const rawSegment = song.segments[index];
    if (rawSegment && rawSegment.beatStart != null) {
      const unit = beatMs(song.bpm);
      const offsetMs = (song.offset || 0) * 1000;
      const relativeBeatNotes = (rawSegment.notes || []).every(note => note < rawSegment.beatStart);
      const mappedNotes = (rawSegment.notes || []).map(note => {
        const beat = relativeBeatNotes ? rawSegment.beatStart + note : note;
        return Math.round(offsetMs + beat * unit);
      }).filter(time => time >= segment.start && time <= segment.end);
      if (mappedNotes.length > 0) {
        targets.push(...mappedNotes);
        return;
      }
    }

    const previous = compiledSegments[index - 1];
    if (!previous || previous.type !== 'tutorial') return;
    const shift = segment.start - previous.start;
    previous.notes.forEach(time => {
      const shiftedTime = time + shift;
      if (shiftedTime >= segment.start && shiftedTime <= segment.end) targets.push(shiftedTime);
    });
  });

  return [...new Set(targets.map(Math.round))].sort((left, right) => left - right);
}

const SHADOW_DIFFICULTY_PRESETS = {
  friendly: {
    rating: 980,
    perfectRate: 0.48,
    greatRate: 0.28,
    goodRate: 0.14,
    missRate: 0.10,
    biasMs: 12,
    jitterMs: 92,
    extraTapRate: 0.015,
    mistakeBurst: 0.16
  },
  balanced: {
    rating: 1200,
    perfectRate: 0.64,
    greatRate: 0.24,
    goodRate: 0.08,
    missRate: 0.04,
    biasMs: -6,
    jitterMs: 64,
    extraTapRate: 0.008,
    mistakeBurst: 0.1
  },
  expert: {
    rating: 1450,
    perfectRate: 0.82,
    greatRate: 0.13,
    goodRate: 0.04,
    missRate: 0.01,
    biasMs: 2,
    jitterMs: 38,
    extraTapRate: 0.003,
    mistakeBurst: 0.04
  }
};

function normalizeShadowOptions(options = {}) {
  const presetName = options.preset || 'balanced';
  const preset = SHADOW_DIFFICULTY_PRESETS[presetName] || SHADOW_DIFFICULTY_PRESETS.balanced;
  return { ...preset, ...options, preset: presetName };
}

function chooseTimingWindow(random, config) {
  const roll = random();
  if (roll < config.perfectRate) return 42;
  if (roll < config.perfectRate + config.greatRate) return 88;
  return 138;
}

function buildGeneratedSummary(totalTargets, resultCounts, rating) {
  const judged = resultCounts.perfect + resultCounts.great + resultCounts.good + resultCounts.miss;
  const weighted = resultCounts.perfect + resultCounts.great * 0.7 + resultCounts.good * 0.4;
  return {
    score: Math.round(weighted * 100),
    accuracy: judged > 0 ? Number(((weighted / judged) * 100).toFixed(1)) : 0,
    maxCombo: Math.max(0, totalTargets - resultCounts.miss),
    rating
  };
}

function generateShadowFromSeed(song, seed, options = {}) {
  if (!song || !song.id || !song.chartVersion) {
    throw new Error('生成影子需要包含 id 和 chartVersion 的歌曲');
  }

  const config = normalizeShadowOptions(options);
  const random = createSeededRandom(`${seed}:${song.id}:${song.chartVersion}`);
  const targets = getDuelTargetNotes(song);
  const durationMs = song.duration * 1000;
  const eventTimes = [];
  const resultCounts = { perfect: 0, great: 0, good: 0, miss: 0 };
  let driftMs = 0;
  let burstRemaining = 0;

  targets.forEach((targetTime, index) => {
    driftMs = Math.max(-22, Math.min(22, driftMs + (random() - 0.5) * 7));
    const inMistakeBurst = burstRemaining > 0;
    if (burstRemaining > 0) burstRemaining -= 1;
    if (!inMistakeBurst && random() < config.mistakeBurst * 0.08) {
      burstRemaining = 1 + Math.floor(random() * 2);
    }

    const missChance = Math.min(0.8, config.missRate * (inMistakeBurst ? 3.2 : 1));
    if (random() < missChance) {
      resultCounts.miss += 1;
      return;
    }

    const windowMs = chooseTimingWindow(random, config);
    const direction = random() < 0.5 ? -1 : 1;
    const magnitude = Math.max(2, random() * Math.min(windowMs, config.jitterMs));
    const timing = Math.round(targetTime + config.biasMs + driftMs + direction * magnitude);
    eventTimes.push(Math.max(0, Math.min(durationMs, timing)));

    const absoluteOffset = Math.abs(timing - targetTime);
    if (absoluteOffset <= 50) resultCounts.perfect += 1;
    else if (absoluteOffset <= 100) resultCounts.great += 1;
    else resultCounts.good += 1;

    if (index > 0 && random() < config.extraTapRate) {
      const extraOffset = 190 + Math.round(random() * 150);
      eventTimes.push(Math.max(0, Math.min(durationMs, timing + extraOffset)));
    }
  });

  eventTimes.sort((left, right) => left - right);
  const seedHash = hashShadowSeed(seed).toString(16).padStart(8, '0');

  return {
    id: `generated_${song.id}_${seedHash}`,
    source: 'generated',
    seed: String(seed),
    profile: {
      name: options.name || '训练影子',
      avatar: '',
      title: options.title || '自适应型',
      rating: config.rating
    },
    songId: song.id,
    chartVersion: song.chartVersion,
    recordingOffsetMs: 0,
    events: createTapEvents(eventTimes),
    summary: buildGeneratedSummary(targets.length, resultCounts, config.rating)
  };
}

function generateFallbackShadow(song, seed, options = {}) {
  const shadow = generateShadowFromSeed(song, seed, options);
  const validation = validateShadowRecord(shadow);
  if (!validation.valid) {
    throw new Error(`随机影子数据非法: ${validation.errors.join('；')}`);
  }
  return shadow;
}
