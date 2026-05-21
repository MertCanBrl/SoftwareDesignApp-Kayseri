import { getPlatformsByStationGroupId } from '../transitNetwork/transitNetworkUtils';
import type { TransitNetwork } from '../transitNetwork/transitNetworkTypes';
import { DEFAULT_TRANSIT_DIRECTION_CONFIG, StationType } from '../transitNetwork/transitNetworkTypes';
import { DEFAULT_DIRECTION_SPLIT_CONFIG } from './directionSplitConfig';
import type {
  DirectionSplitConfig,
  DirectionSplitInput,
  DirectionSplitReason,
  DirectionSplitResult,
  DirectionPlatformSplit,
} from './directionSplitTypes';
import {
  allocatePassengerCounts,
  applyBoost,
  applyDampening,
  getAwayFromCenterDirection,
  getSplitConfidence,
  getStationSequenceIndex,
  getTerminalDominantDirection,
  getTowardCenterDirection,
  getTowardIndustrialDirection,
  getTowardUniversityDirection,
  hasStationType,
  isEveningPeak,
  isMorningPeak,
  normalizeRatios,
  sortPlatformsByDirection,
  type RatioMap,
} from './directionSplitUtils';

function cloneBaseRatios(config: DirectionSplitConfig): RatioMap {
  const { directionA, directionB } = DEFAULT_TRANSIT_DIRECTION_CONFIG;
  return {
    [directionA]: config.baseRatio[directionA],
    [directionB]: config.baseRatio[directionB],
  };
}

function applyTerminalBias(params: {
  ratios: RatioMap;
  reasons: DirectionSplitReason[];
  input: DirectionSplitInput;
  network: TransitNetwork;
  config: DirectionSplitConfig;
}): { ratios: RatioMap; reasons: DirectionSplitReason[]; isTerminalBias: boolean } {
  const { input, network, config } = params;
  let { ratios, reasons } = params;
  const platforms = getPlatformsByStationGroupId(input.stationGroupId, network);
  const isTerminalStation =
    hasStationType(input.stationTypes, StationType.TERMINAL) ||
    platforms.some((p) => p.isTerminal);

  if (!isTerminalStation) {
    return { ratios, reasons, isTerminalBias: false };
  }

  if (
    hasStationType(input.stationTypes, StationType.INDUSTRIAL) &&
    isMorningPeak(input.hour, config)
  ) {
    return { ratios, reasons, isTerminalBias: false };
  }

  const seq = getStationSequenceIndex(input.stationGroupId, network);
  const lineLength = network.stationGroups.length;
  const { directionA, directionB } = DEFAULT_TRANSIT_DIRECTION_CONFIG;
  const dom = config.terminalDominantRatio;
  let target: typeof directionA | typeof directionB | null = null;

  if (seq === 0) {
    if (isMorningPeak(input.hour, config)) target = directionA;
    else if (isEveningPeak(input.hour, config)) target = directionB;
  } else if (seq != null && seq === lineLength - 1) {
    if (isMorningPeak(input.hour, config)) target = directionB;
    else if (isEveningPeak(input.hour, config)) target = directionA;
  } else {
    const terminal = getTerminalDominantDirection(platforms);
    if (terminal.isTerminal) {
      if (isMorningPeak(input.hour, config)) {
        target = terminal.direction === directionA ? directionB : directionA;
      } else if (isEveningPeak(input.hour, config)) {
        target = terminal.direction;
      }
    }
  }

  if (!target) {
    return { ratios, reasons, isTerminalBias: false };
  }

  const other = target === directionA ? directionB : directionA;
  ratios = {
    [directionA]: target === directionA ? dom : 1 - dom,
    [directionB]: target === directionB ? dom : 1 - dom,
  };
  ratios = normalizeRatios(ratios, config);
  reasons = [...reasons, 'TERMINAL_SINGLE_DIRECTION_BIAS'];
  return { ratios, reasons, isTerminalBias: true };
}

/**
 * Durak bazlı toplam yolcuyu iki platforma heuristic olarak dağıtır.
 * totalPassengerCount = directionA + directionB (mevcut veri varsayımı).
 */
export function estimateDirectionSplit(
  input: DirectionSplitInput,
  network: TransitNetwork,
  config: DirectionSplitConfig = DEFAULT_DIRECTION_SPLIT_CONFIG
): DirectionSplitResult {
  const { directionA, directionB } = DEFAULT_TRANSIT_DIRECTION_CONFIG;
  const platforms = sortPlatformsByDirection(
    getPlatformsByStationGroupId(input.stationGroupId, network)
  );

  if (platforms.length < 2) {
    const single = platforms[0];
    const ratio = 1;
    const count = Math.max(0, Math.round(input.totalPassengerCount));
    return {
      stationGroupId: input.stationGroupId,
      stationName: input.stationName,
      totalPassengerCount: input.totalPassengerCount,
      splits: single
        ? [
            {
              platformId: single.platformId,
              direction: single.direction,
              ratio,
              passengerCount: count,
              confidence: 'low',
              reasons: ['BASE_EQUAL_SPLIT'],
            },
          ]
        : [],
    };
  }

  let ratios = cloneBaseRatios(config);
  let reasons: DirectionSplitReason[] = ['BASE_EQUAL_SPLIT'];

  const centerSeq = getStationSequenceIndex(config.centerStationGroupId, network);
  const stationSeq = getStationSequenceIndex(input.stationGroupId, network);
  const isCenterStation =
    input.stationGroupId === config.centerStationGroupId ||
    (stationSeq != null && centerSeq != null && stationSeq === centerSeq);

  if (isCenterStation) {
    reasons = [...reasons, 'CENTER_STATION_BALANCED'];
  }

  const weekendFactor = input.isWeekend ? config.weekendBoostFactor : 1;

  const isUniversityStation = hasStationType(input.stationTypes, StationType.UNIVERSITY);
  const isIndustrialStation = hasStationType(input.stationTypes, StationType.INDUSTRIAL);

  if (!isCenterStation && !isUniversityStation && !isIndustrialStation && isMorningPeak(input.hour, config)) {
    const towardCenter = getTowardCenterDirection(input.stationGroupId, network, config);
    if (towardCenter) {
      const boost = applyDampening(config.morningCenterBoost, input.isWeekend, config);
      ratios = applyBoost(ratios, towardCenter, boost, config);
      reasons = [...reasons, 'MORNING_PEAK_TOWARD_CENTER'];
      if (input.isWeekend && weekendFactor < 1) {
        reasons = [...reasons, 'WEEKEND_DAMPENING'];
      }
    }
  }

  if (!isCenterStation && !isUniversityStation && !isIndustrialStation && isEveningPeak(input.hour, config)) {
    const awayFromCenter = getAwayFromCenterDirection(input.stationGroupId, network, config);
    if (awayFromCenter) {
      const boost = applyDampening(config.eveningCenterBoost, input.isWeekend, config);
      ratios = applyBoost(ratios, awayFromCenter, boost, config);
      reasons = [...reasons, 'EVENING_PEAK_AWAY_FROM_CENTER'];
      if (input.isWeekend && weekendFactor < 1) {
        reasons = [...reasons, 'WEEKEND_DAMPENING'];
      }
    }
  }

  if (isUniversityStation) {
    if (isMorningPeak(input.hour, config)) {
      const towardUni = getTowardUniversityDirection(input.stationGroupId, network, config);
      if (towardUni) {
        const boost = applyDampening(config.universityMorningBoost, input.isWeekend, config);
        ratios = applyBoost(ratios, towardUni, boost, config);
        reasons = [...reasons, 'UNIVERSITY_MORNING_TOWARD_CAMPUS'];
      }
    }
    if (isEveningPeak(input.hour, config)) {
      const towardCity = getAwayFromCenterDirection(input.stationGroupId, network, config);
      if (towardCity) {
        const boost = applyDampening(config.universityEveningBoost, input.isWeekend, config);
        ratios = applyBoost(ratios, towardCity, boost, config);
        reasons = [...reasons, 'UNIVERSITY_EVENING_TOWARD_CITY'];
      }
    }
  }

  if (isIndustrialStation) {
    if (isMorningPeak(input.hour, config)) {
      const towardIndustrial = getTowardIndustrialDirection(input.stationGroupId, network);
      if (towardIndustrial) {
        const boost = applyDampening(config.industrialMorningBoost, input.isWeekend, config);
        ratios = applyBoost(ratios, towardIndustrial, boost, config);
        reasons = [...reasons, 'INDUSTRIAL_MORNING_TOWARD_INDUSTRIAL'];
      }
    }
    if (isEveningPeak(input.hour, config)) {
      const towardCity = getTowardCenterDirection(input.stationGroupId, network, config);
      if (towardCity) {
        const boost = applyDampening(config.industrialEveningBoost, input.isWeekend, config);
        ratios = applyBoost(ratios, towardCity, boost, config);
        reasons = [...reasons, 'INDUSTRIAL_EVENING_TOWARD_CITY'];
      }
    }
  }

  if (input.isWeekend && reasons.includes('BASE_EQUAL_SPLIT') && reasons.length === 1) {
    reasons = [...reasons, 'WEEKEND_DAMPENING'];
  }

  const terminalResult = applyTerminalBias({ ratios, reasons, input, network, config });
  ratios = terminalResult.ratios;
  reasons = terminalResult.reasons;

  if (input.isTransferStation) {
    const towardCenter = getTowardCenterDirection(input.stationGroupId, network, config);
    const awayFromCenter = getAwayFromCenterDirection(input.stationGroupId, network, config);
    if (towardCenter && awayFromCenter) {
      const pull = 0.04;
      ratios = applyBoost(ratios, towardCenter, pull, config);
      ratios = applyBoost(ratios, awayFromCenter, pull, config);
      ratios = normalizeRatios(
        {
          [directionA]: (ratios[directionA] + ratios[directionB]) / 2,
          [directionB]: (ratios[directionA] + ratios[directionB]) / 2,
        },
        config
      );
    }
    reasons = [...reasons, 'TRANSFER_STATION_UNCERTAINTY'];
  }

  ratios = normalizeRatios(ratios, config);
  const counts = allocatePassengerCounts(input.totalPassengerCount, ratios);

  const confidence = getSplitConfidence({
    input,
    reasons,
    isTerminalBias: terminalResult.isTerminalBias,
    config,
  });

  const splits: DirectionPlatformSplit[] = platforms.map((platform) => ({
    platformId: platform.platformId,
    direction: platform.direction,
    ratio: ratios[platform.direction] ?? 0.5,
    passengerCount: counts[platform.direction] ?? 0,
    confidence,
    reasons,
  }));

  return {
    stationGroupId: input.stationGroupId,
    stationName: input.stationName,
    totalPassengerCount: input.totalPassengerCount,
    splits,
  };
}
