/**
 * Re-shards an existing assets/data/passengerData.json (same schema as convert output).
 * Use after updating the monolith without re-running the Excel import.
 */
import fs from 'fs';
import path from 'path';
import { emitPassengerDataArtifacts, type EmitRow } from './emitPassengerDataArtifacts';

const PROJECT_ROOT = path.join(__dirname, '..');
const inPath = path.join(PROJECT_ROOT, 'assets', 'data', 'passengerData.json');

function main() {
  if (!fs.existsSync(inPath)) {
    console.error(`File not found: ${inPath}`);
    process.exit(1);
  }
  console.log('Reading', inPath, '...');
  const raw = JSON.parse(fs.readFileSync(inPath, 'utf8')) as EmitRow[];
  if (!Array.isArray(raw) || !raw.length) {
    console.error('passengerData.json is not a non-empty array.');
    process.exit(1);
  }
  const { dates, byDateCount } = emitPassengerDataArtifacts(raw, PROJECT_ROOT);
  console.log('Done. Day shards:', byDateCount, 'passengerDates entries:', dates.length);
}

main();
