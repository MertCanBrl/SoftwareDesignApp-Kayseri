/**
 * Transit ağı özetini konsola yazdırır.
 * Çalıştırma: npx tsx src/transitNetwork/demoTransitNetwork.ts
 */
import { buildTransitNetwork } from './buildTransitNetwork';
import {
  countPlatforms,
  countStationGroups,
  getPlatformsByStationGroupId,
  listTransferStationGroups,
} from './transitNetworkUtils';
import { DEFAULT_TRANSIT_DIRECTION_CONFIG } from './transitNetworkTypes';

function main(): void {
  const network = buildTransitNetwork();
  const { directionA, directionB } = DEFAULT_TRANSIT_DIRECTION_CONFIG;

  const exampleStationGroupId = '1006019';
  const examplePlatforms = getPlatformsByStationGroupId(exampleStationGroupId, network);

  console.log('=== Kayseri Transit Network Demo ===\n');
  console.log(`Station groups: ${countStationGroups(network)}`);
  console.log(`Platforms (bidirectional): ${countPlatforms(network)}`);
  console.log(`Lines: ${network.lines.length}`);
  console.log(`Transfer connections (demo edges): ${network.transferConnections.length}\n`);

  console.log('--- Aktarma durakları ---');
  for (const g of listTransferStationGroups(network)) {
    const types = g.stationTypes.join(', ');
    console.log(`  ${g.stationGroupId}  ${g.canonicalName}  [${types}]`);
  }

  console.log(`\n--- Örnek durak (${exampleStationGroupId}) — iki yönlü platform ---`);
  const group = network.stationGroupsById[exampleStationGroupId];
  if (group) {
    console.log(`  ${group.canonicalName}  lat=${group.lat.toFixed(5)} lon=${group.lon.toFixed(5)}`);
    console.log(`  isTransferStation=${group.isTransferStation}`);
  }
  for (const p of examplePlatforms) {
    const opp = network.platformsById[p.oppositePlatformId];
    console.log(
      `  platform ${p.platformId}` +
        `\n    direction=${p.direction}  sequenceIndex=${p.sequenceIndex}` +
        `  terminal=${p.isTerminal}` +
        `\n    opposite=${p.oppositePlatformId}` +
        (opp ? ` (${opp.direction})` : '')
    );
  }

  const line = network.lines[0];
  if (line) {
    const seqA = line.platformSequenceByDirection[directionA]?.length ?? 0;
    const seqB = line.platformSequenceByDirection[directionB]?.length ?? 0;
    console.log(`\n--- Hat ${line.lineId} ---`);
    console.log(`  ${line.lineName}`);
    console.log(`  ${directionA}: ${seqA} platform (hat sırası)`);
    console.log(`  ${directionB}: ${seqB} platform (ters sıra)`);
  }

  console.log('\n=== Demo tamamlandı ===');
}

main();
