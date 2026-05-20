import { haversineDistanceMeters } from '../utils/haversine';
import { getBuiltTransitNetwork } from './buildTransitNetwork';
import type {
  StationDirection,
  StationGroup,
  StationPlatform,
  StationType,
  TransitNetwork,
} from './transitNetworkTypes';
import { DEFAULT_TRAM_LINE_ID } from './transitNetworkTypes';

function resolveNetwork(network?: TransitNetwork): TransitNetwork {
  return network ?? getBuiltTransitNetwork();
}

export function getStationGroupById(
  stationGroupId: string,
  network?: TransitNetwork
): StationGroup | undefined {
  return resolveNetwork(network).stationGroupsById[stationGroupId];
}

export function getPlatformsByStationGroupId(
  stationGroupId: string,
  network?: TransitNetwork
): readonly StationPlatform[] {
  const group = getStationGroupById(stationGroupId, network);
  return group?.platforms ?? [];
}

export function getPlatformById(
  platformId: string,
  network?: TransitNetwork
): StationPlatform | undefined {
  return resolveNetwork(network).platformsById[platformId];
}

export function getOppositePlatform(
  platform: StationPlatform,
  network?: TransitNetwork
): StationPlatform | undefined {
  return getPlatformById(platform.oppositePlatformId, network);
}

export function getOppositePlatformById(
  platformId: string,
  network?: TransitNetwork
): StationPlatform | undefined {
  const platform = getPlatformById(platformId, network);
  if (!platform) return undefined;
  return getOppositePlatform(platform, network);
}

export function isTransferStation(
  stationGroupId: string,
  network?: TransitNetwork
): boolean {
  return getStationGroupById(stationGroupId, network)?.isTransferStation ?? false;
}

export function getStationTypes(
  stationGroupId: string,
  network?: TransitNetwork
): readonly StationType[] {
  return getStationGroupById(stationGroupId, network)?.stationTypes ?? [];
}

export type NearbyTransferStation = {
  stationGroup: StationGroup;
  distanceM: number;
};

/**
 * Verilen koordinata en yakın aktarma durakları (metre).
 */
export function getNearbyTransferStations(
  lat: number,
  lon: number,
  options?: {
    network?: TransitNetwork;
    maxResults?: number;
    maxDistanceM?: number;
  }
): NearbyTransferStation[] {
  const network = resolveNetwork(options?.network);
  const maxResults = options?.maxResults ?? 5;
  const maxDistanceM = options?.maxDistanceM;

  const origin = { latitude: lat, longitude: lon };
  const ranked: NearbyTransferStation[] = [];

  for (const group of network.stationGroups) {
    if (!group.isTransferStation) continue;
    const distanceM = haversineDistanceMeters(origin, {
      latitude: group.lat,
      longitude: group.lon,
    });
    if (maxDistanceM != null && distanceM > maxDistanceM) continue;
    ranked.push({ stationGroup: group, distanceM });
  }

  ranked.sort((a, b) => a.distanceM - b.distanceM);
  return ranked.slice(0, maxResults);
}

export function getLinePlatformsByDirection(
  lineId: string,
  direction: StationDirection,
  network?: TransitNetwork
): readonly StationPlatform[] {
  const net = resolveNetwork(network);
  const line = net.lines.find((l) => l.lineId === lineId);
  if (!line) return [];

  const platformIds = line.platformSequenceByDirection[direction];
  if (!platformIds) return [];

  return platformIds
    .map((id) => net.platformsById[id])
    .filter((p): p is StationPlatform => p != null);
}

export function getDefaultLinePlatformsByDirection(
  direction: StationDirection,
  network?: TransitNetwork
): readonly StationPlatform[] {
  return getLinePlatformsByDirection(DEFAULT_TRAM_LINE_ID, direction, network);
}

export function listTransferStationGroups(network?: TransitNetwork): readonly StationGroup[] {
  return resolveNetwork(network).stationGroups.filter((g) => g.isTransferStation);
}

export function countPlatforms(network?: TransitNetwork): number {
  return Object.keys(resolveNetwork(network).platformsById).length;
}

export function countStationGroups(network?: TransitNetwork): number {
  return resolveNetwork(network).stationGroups.length;
}
