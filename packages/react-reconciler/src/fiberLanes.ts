import {
  unstable_IdlePriority,
  unstable_ImmediatePriority,
  unstable_NormalPriority,
  unstable_UserBlockingPriority,
  unstable_getCurrentPriorityLevel,
} from 'scheduler';
import { FiberRootNode } from './fiber';
import ReactCurrentBatchConfig from 'react/src/currentBatchConfig';

export type Lane = number;
export type Lanes = number;

export const SyncLane = 0b00001;
export const NoLane = 0b00000;
export const NoLanes = 0b00000;
export const InputContinueLane = 0b00010;
export const DefaultLane = 0b00100;
export const TransitionLane = 0b01000;
export const IdleLane = 0b10000;

export function mergeLanes(a: Lanes, b: Lanes): Lanes {
  return a | b;
}

export function requestUpdateLane(): Lane {
  const isTransition = ReactCurrentBatchConfig.transition !== null;
  if (isTransition) {
    return TransitionLane;
  }

  // 从上下文环境中获取优先级
  const currentSchedulerPriority = unstable_getCurrentPriorityLevel();
  const lane = schedulerPriorityToLane(currentSchedulerPriority);
  return lane;
}

export function getHighestPriorityLane(lanes: Lanes): Lane {
  return lanes & -lanes;
}

export function markRootFinished(root: FiberRootNode, lane: Lane) {
  root.pendingLanes &= ~lane;
  root.suspendedLanes = NoLanes;
  root.pingedLanes = NoLanes;
}

export function isSubsetOfLanes(set: Lanes, subSet: Lane) {
  return (set & subSet) === subSet;
}

export function lanesToSchedulerPriority(lanes: Lanes) {
  const lane = getHighestPriorityLane(lanes);
  if (lane === SyncLane) {
    return unstable_ImmediatePriority;
  }
  if (lane === InputContinueLane) {
    return unstable_UserBlockingPriority;
  }
  if (lane === DefaultLane) {
    return unstable_NormalPriority;
  }

  return unstable_IdlePriority;
}

export function schedulerPriorityToLane(schedulerPriority: number) {
  if (schedulerPriority === unstable_ImmediatePriority) {
    return SyncLane;
  }
  if (schedulerPriority === unstable_UserBlockingPriority) {
    return InputContinueLane;
  }
  if (schedulerPriority === unstable_NormalPriority) {
    return DefaultLane;
  }
  return IdleLane;
}

export function markRootSuspended(root: FiberRootNode, suspendedLane: Lane) {
  root.suspendedLanes |= suspendedLane;
  root.pingedLanes &= ~suspendedLane;
}

export function markRootPinged(root: FiberRootNode, pingedLane: Lane) {
  root.pingedLanes |= root.suspendedLanes & pingedLane;
}

export function getNextLane(root: FiberRootNode) {
  const pendingLanes = root.pendingLanes;

  if (pendingLanes === NoLanes) {
    return NoLane;
  }

  let nextLane = NoLane;

  // 未被挂起的lanes
  const suspendedLanes = pendingLanes & ~root.suspendedLanes;
  if (suspendedLanes !== NoLanes) {
    nextLane = getHighestPriorityLane(suspendedLanes);
  } else {
    // 没有被挂起的Lanes，取出已进入pinged的lanes
    const pingedLanes = pendingLanes & root.pingedLanes;
    if (pingedLanes !== NoLanes) {
      nextLane = getHighestPriorityLane(pingedLanes);
    }
  }
  return nextLane;
}
