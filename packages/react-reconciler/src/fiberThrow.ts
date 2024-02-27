import { Wakeable } from 'shared/ReactTypes';
import { FiberRootNode } from './fiber';
import { Lane } from './fiberLanes';
import { ensureRootIsScheduled, markRootUpdated } from './workLoop';
import { getSuspenseHandler } from './suspenseContext';
import { ShouldCapture } from './fiberFlags';

export function throwException(root: FiberRootNode, value: any, lane: Lane) {
  // Error Boundary

  // thenable
  if (
    value !== null &&
    typeof value === 'object' &&
    typeof value.then === 'function'
  ) {
    const wakeable: Wakeable<any> = value;

    const suspenseBoundary = getSuspenseHandler();
    if (suspenseBoundary !== null) {
      suspenseBoundary.flags |= ShouldCapture;
    }

    attachPingListener(root, wakeable, lane);
  }
}

function attachPingListener(
  root: FiberRootNode,
  wakeable: Wakeable<any>,
  lane: Lane
) {
  let pingCache = root.pingCache;
  // WeakMap{promise: Set<Lane>}
  let threadIds: Set<Lane> | undefined;

  if (pingCache === null) {
    threadIds = new Set<Lane>();
    pingCache = root.pingCache = new WeakMap<Wakeable<any>, Set<Lane>>();
    pingCache.set(wakeable, threadIds);
  } else {
    threadIds = pingCache.get(wakeable);
    if (threadIds === undefined) {
      threadIds = new Set<Lane>();
      pingCache.set(wakeable, threadIds);
    }
  }
  if (!threadIds.has(lane)) {
    threadIds.add(lane);

    function ping() {
      if (pingCache !== null) {
        pingCache.delete(wakeable);
      }
      markRootUpdated(root, lane);
      ensureRootIsScheduled(root);
    }

    wakeable.then(ping, ping);
  }
}
