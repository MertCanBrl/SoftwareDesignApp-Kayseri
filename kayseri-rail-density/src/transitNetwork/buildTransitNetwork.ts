import type { StationRecord } from '../types';
import { DURAK_ID_CANONICAL_AD } from '../constants/durakCanonicalMap';
import { buildMergedStations } from '../utils/stations';
import { resolveStationTypes } from './stationTypeOverrides';
import { getTransferStationOverride } from './transferStationOverrides';
import type {
  StationDirection,
  StationGroup,
  StationPlatform,
  TransitDirectionConfig,
  TransitLine,
  TransitNetwork,
  TransferConnection,
} from './transitNetworkTypes';
import {
  DEFAULT_TRAM_LINE_ID,
  DEFAULT_TRAM_LINE_NAME,
  DEFAULT_TRANSIT_DIRECTION_CONFIG,
  StationType,
} from './transitNetworkTypes';

export type BuildTransitNetworkOptions = {
  directionConfig?: TransitDirectionConfig;
  lineId?: string;
  lineName?: string;
  /** Test veya özel senaryolar için; verilmezse buildMergedStations([]) kullanılır. */
  stationRecords?: readonly StationRecord[];
};

function canonicalIdSort(a: string, b: string): number {
  return Number(a) - Number(b);
}

function makePlatformId(stationGroupId: string, direction: StationDirection): string {
  return `${stationGroupId}__${direction}`;
}

function orderedCanonicalIds(): string[] {
  return (Object.keys(DURAK_ID_CANONICAL_AD) as string[]).sort(canonicalIdSort);
}

function buildPlatformsForStation(params: {
  record: StationRecord;
  lineId: string;
  directionConfig: TransitDirectionConfig;
  sequenceIndexA: number;
  sequenceIndexB: number;
  lineLength: number;
}): StationPlatform[] {
  const { record, lineId, directionConfig, sequenceIndexA, sequenceIndexB, lineLength } =
    params;
  const { directionA, directionB } = directionConfig;
  const stationGroupId = record.durakId;
  const stationName = record.durakAd;

  const platformA: StationPlatform = {
    platformId: makePlatformId(stationGroupId, directionA),
    stationGroupId,
    stationName,
    direction: directionA,
    lineId,
    oppositePlatformId: makePlatformId(stationGroupId, directionB),
    sequenceIndex: sequenceIndexA,
    isTerminal: sequenceIndexA === 0 || sequenceIndexA === lineLength - 1,
    lat: record.latitude,
    lon: record.longitude,
  };

  const platformB: StationPlatform = {
    platformId: makePlatformId(stationGroupId, directionB),
    stationGroupId,
    stationName,
    direction: directionB,
    lineId,
    oppositePlatformId: makePlatformId(stationGroupId, directionA),
    sequenceIndex: sequenceIndexB,
    isTerminal: sequenceIndexB === 0 || sequenceIndexB === lineLength - 1,
    lat: record.latitude,
    lon: record.longitude,
  };

  return [platformA, platformB];
}

function buildStationGroup(record: StationRecord, platforms: StationPlatform[]): StationGroup {
  const transferOverride = getTransferStationOverride(record.durakId);
  const stationTypes = resolveStationTypes(record.durakId);
  const isTransferFromTypes = stationTypes.includes(StationType.TRANSFER);
  const isTransferStation =
    transferOverride?.isTransferStation ?? isTransferFromTypes;

  if (isTransferStation && !stationTypes.includes(StationType.TRANSFER)) {
    stationTypes.push(StationType.TRANSFER);
  }

  return {
    stationGroupId: record.durakId,
    stationName: record.durakAd,
    canonicalName: record.durakAd,
    lat: record.latitude,
    lon: record.longitude,
    isTransferStation,
    stationTypes,
    platforms,
  };
}

/** Örnek aktarma kenarları — çok hatlı ağ genişletildiğinde güncellenecek. */
function buildDemoTransferConnections(
  stationGroups: readonly StationGroup[],
  directionConfig: TransitDirectionConfig
): TransferConnection[] {
  const transferIds = new Set(
    stationGroups.filter((g) => g.isTransferStation).map((g) => g.stationGroupId)
  );
  const connections: TransferConnection[] = [];
  const directions = [directionConfig.directionA, directionConfig.directionB] as const;

  const pairs: [string, string][] = [
    ['1006019', '1006028'],
    ['1006019', '1006057'],
  ];

  for (const [fromId, toId] of pairs) {
    if (!transferIds.has(fromId) || !transferIds.has(toId)) continue;
    const fromOverride = getTransferStationOverride(fromId);
    const toOverride = getTransferStationOverride(toId);
    const weight = Math.min(
      fromOverride?.transferWeight ?? 0.5,
      toOverride?.transferWeight ?? 0.5
    );
    connections.push({
      fromStationGroupId: fromId,
      toStationGroupId: toId,
      connectedLines: [
        ...new Set([
          ...(fromOverride?.connectedLines ?? [DEFAULT_TRAM_LINE_ID]),
          ...(toOverride?.connectedLines ?? [DEFAULT_TRAM_LINE_ID]),
        ]),
      ],
      transferWeight: weight,
      possibleDirections: directions,
      notes: 'Demo aktarma bağlantısı — manuel override listesinden türetildi.',
    });
  }

  return connections;
}

/**
 * stations.json + kanonik durak listesi üzerinden tam transit ağı üretir.
 * stationGroupId = mevcut durakId; UI hâlâ StationRecord ile çalışabilir.
 */
export function buildTransitNetwork(options: BuildTransitNetworkOptions = {}): TransitNetwork {
  const directionConfig = options.directionConfig ?? DEFAULT_TRANSIT_DIRECTION_CONFIG;
  const lineId = options.lineId ?? DEFAULT_TRAM_LINE_ID;
  const lineName = options.lineName ?? DEFAULT_TRAM_LINE_NAME;

  const records = [...(options.stationRecords ?? buildMergedStations([]))].sort((a, b) =>
    canonicalIdSort(a.durakId, b.durakId)
  );

  const idOrder = orderedCanonicalIds();
  const indexById = new Map(idOrder.map((id, idx) => [id, idx] as const));
  const lineLength = idOrder.length;

  const allPlatforms: StationPlatform[] = [];
  const stationGroups: StationGroup[] = [];

  for (const record of records) {
    const seqA = indexById.get(record.durakId) ?? 0;
    const seqB = lineLength - 1 - seqA;
    const platforms = buildPlatformsForStation({
      record,
      lineId,
      directionConfig,
      sequenceIndexA: seqA,
      sequenceIndexB: seqB,
      lineLength,
    });
    allPlatforms.push(...platforms);
    stationGroups.push(buildStationGroup(record, platforms));
  }

  const { directionA, directionB } = directionConfig;
  const platformSequenceA = idOrder.map((id) => makePlatformId(id, directionA));
  const platformSequenceB = [...idOrder]
    .reverse()
    .map((id) => makePlatformId(id, directionB));

  const line: TransitLine = {
    lineId,
    lineName,
    directions: [directionA, directionB],
    platformSequenceByDirection: {
      [directionA]: platformSequenceA,
      [directionB]: platformSequenceB,
    },
  };

  const platformsById: Record<string, StationPlatform> = Object.fromEntries(
    allPlatforms.map((p) => [p.platformId, p] as const)
  );
  const stationGroupsById: Record<string, StationGroup> = Object.fromEntries(
    stationGroups.map((g) => [g.stationGroupId, g] as const)
  );

  const transferConnections = buildDemoTransferConnections(stationGroups, directionConfig);

  return {
    lines: [line],
    stationGroups,
    platformsById,
    stationGroupsById,
    transferConnections,
  };
}

let cachedNetwork: TransitNetwork | null = null;

/** Uygulama genelinde tek örnek (lazy). Mevcut ekranları etkilemez. */
export function getBuiltTransitNetwork(): TransitNetwork {
  if (!cachedNetwork) {
    cachedNetwork = buildTransitNetwork();
  }
  return cachedNetwork;
}

export function resetBuiltTransitNetworkCache(): void {
  cachedNetwork = null;
}

/** platformId → mevcut durakId (stationGroupId). */
export function platformIdToStationGroupId(platformId: string): string {
  const sep = platformId.indexOf('__');
  return sep >= 0 ? platformId.slice(0, sep) : platformId;
}
