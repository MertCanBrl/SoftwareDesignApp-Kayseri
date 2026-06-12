import platformTypesJson from '../../assets/data/station-platform-types.json';
import type { PlatformType } from '../types';

const PLATFORM_TYPE_MAP: Record<string, PlatformType> = Object.fromEntries(
  (platformTypesJson as { durakId: string; platformType: string }[]).map((e) => [
    e.durakId,
    e.platformType as PlatformType,
  ])
);

export function getPlatformType(durakId: string): PlatformType {
  return PLATFORM_TYPE_MAP[durakId] ?? 'single_area';
}

/** Strips _G / _D suffix to get the base station ID. */
export function getParentId(id: string): string {
  if (id.endsWith('_G') || id.endsWith('_D')) return id.slice(0, -2);
  return id;
}

export function isPlatformId(id: string): boolean {
  return id.endsWith('_G') || id.endsWith('_D');
}
