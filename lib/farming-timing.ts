/** Runs a day (`Method.farmingRunsPerDay`) was a Tangleroot-only calendar setting. The pet window no longer shows it,
 * but saved records may still hold a value from 0.01 to 3, so it keeps loading and validating. */
export function validFarmingSchedule(value:unknown):boolean {
 return value==null||(typeof value==='number'&&Number.isFinite(value)&&value>=0.01&&value<=3);
}
