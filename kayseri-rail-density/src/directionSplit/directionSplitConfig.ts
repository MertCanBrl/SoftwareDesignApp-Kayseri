import { DEFAULT_TRANSIT_DIRECTION_CONFIG } from '../transitNetwork/transitNetworkTypes';
import type { DirectionSplitConfig } from './directionSplitTypes';

const { directionA, directionB } = DEFAULT_TRANSIT_DIRECTION_CONFIG;

/**
 * Varsayılan heuristic oran kuralları.
 * directionRoles.label alanları ileride gerçek hat yön adlarıyla değiştirilebilir.
 */
export const DEFAULT_DIRECTION_SPLIT_CONFIG: DirectionSplitConfig = {
  directionRoles: {
    directionA: {
      direction: directionA,
      label: 'directionA (hat sonu yönü — yapılandırılabilir)',
    },
    directionB: {
      direction: directionB,
      label: 'directionB (hat başı yönü — yapılandırılabilir)',
    },
  },
  centerStationGroupId: '1006019',
  universityAnchorStationGroupId: '1006048',
  industrialAnchorStationGroupId: '1006001',
  baseRatio: {
    [directionA]: 0.5,
    [directionB]: 0.5,
  },
  morningPeakHours: [7, 8, 9],
  eveningPeakHours: [17, 18, 19],
  morningCenterBoost: 0.14,
  eveningCenterBoost: 0.14,
  weekendBoostFactor: 0.35,
  universityMorningBoost: 0.12,
  universityEveningBoost: 0.12,
  industrialMorningBoost: 0.13,
  industrialEveningBoost: 0.13,
  transferConfidencePenalty: 0.2,
  terminalDominantRatio: 0.68,
  minRatio: 0.08,
  maxRatio: 0.92,
};
