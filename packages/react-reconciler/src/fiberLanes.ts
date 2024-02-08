export type Lane = number;
export type Lanes = number;

export const SyncLane = 0b0001;
export const NoLane = 0b0000;
export const NoLanes = 0b0000;

export function mergeLanes(a: Lanes, b: Lanes): Lanes {
  return a | b;
}

export function requestUpdateLane(): Lane {
  return SyncLane; // 同步更新
}

export function getHighestPriorityLane(lanes: Lanes): Lane {
  return lanes & -lanes;
}
