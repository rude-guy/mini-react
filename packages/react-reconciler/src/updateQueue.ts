import { Dispatch } from 'react/src/currentDispatcher';
import { Action } from 'shared/ReactTypes';
import { Lane, NoLane, isSubsetOfLanes, mergeLanes } from './fiberLanes';
import { FiberNode } from './fiber';

export interface Update<State> {
  action: Action<State>;
  next: Update<any> | null; // 指向下一个update
  lane: Lane;
  hasEagerState: boolean;
  eagerState: State | null;
}

export interface UpdateQueue<State> {
  shared: {
    pending: Update<State> | null;
  };
  dispatch: Dispatch<State> | null;
}

export const createUpdate = <State>(
  action: Action<State>,
  lane: Lane,
  hasEagerState = false,
  eagerState = null
): Update<State> => {
  return {
    action,
    lane,
    next: null,
    hasEagerState,
    eagerState,
  };
};

export const createUpdateQueue = <State>(): UpdateQueue<State> => {
  return {
    shared: {
      pending: null,
    },
    dispatch: null,
  };
};

// 追加update
export const enqueueUpdate = <State>(
  updateQueue: UpdateQueue<State>,
  update: Update<State>,
  fiber: FiberNode,
  lane: Lane
) => {
  const pending = updateQueue.shared.pending;
  if (pending === null) {
    // pending = a -> a
    update.next = update;
  } else {
    // pending = b -> a -> b
    // pending = c -> a -> b -> c
    update.next = pending.next;
    pending.next = update;
  }
  updateQueue.shared.pending = update;

  fiber.lanes = mergeLanes(fiber.lanes, lane);

  // 消费的是wip，如果遇到问题需要从current进行重置
  const alternate = fiber.alternate;
  if (alternate !== null) {
    alternate.lanes = mergeLanes(alternate.lanes, lane);
  }
};

export function basicStateReducer<State>(
  state: State,
  action: Action<State>
): State {
  // baseState 1 -> update (x) => 2x -> memoizedState 2
  if (action instanceof Function) {
    return action(state);
  } else {
    // baseState 1 -> update 2 -> memoizedState 2
    return action;
  }
}

// 消费update
export const processUpdateQueue = <State>(
  baseState: State,
  pendingUpdate: Update<State> | null,
  renderLane: Lane,
  onSkipUpdate?: <State>(update: Update<State>) => void
): {
  memoizedState: State;
  baseState: State;
  baseQueue: Update<State> | null;
} => {
  const result: ReturnType<typeof processUpdateQueue<State>> = {
    memoizedState: baseState,
    baseState,
    baseQueue: null,
  };

  let newBaseState = baseState;
  let newBaseQueueFirst: Update<State> | null = null;
  let newBaseQueueLast: Update<State> | null = null;
  let newState = baseState;

  if (pendingUpdate !== null) {
    // 第一个update
    const first = pendingUpdate.next;
    let pending = pendingUpdate.next as Update<any>;
    do {
      const updateLane = pending!.lane;
      if (!isSubsetOfLanes(renderLane, updateLane)) {
        // 优先级不够 被跳过
        const clone = createUpdate(pending.action, pending.lane);

        onSkipUpdate?.(clone);

        // 是不是第一个被跳过的update
        if (newBaseQueueFirst === null) {
          newBaseQueueFirst = newBaseQueueLast = clone;
          newBaseState = newState;
        } else {
          newBaseQueueLast!.next = clone;
          newBaseQueueLast = clone;
        }
      } else {
        // 优先级足够
        if (newBaseQueueLast !== null) {
          const clone = createUpdate(pending.action, NoLane);
          newBaseQueueLast.next = clone;
          newBaseQueueLast = clone;
        }
        const action = pendingUpdate.action;
        if (pendingUpdate.hasEagerState) {
          newState = pendingUpdate.eagerState!;
        } else {
          newState = basicStateReducer(baseState, action);
        }
      }
      pending = pending.next!;
    } while (pending !== first);

    if (newBaseQueueLast === null) {
      // 本次计算没有update被跳过
      newBaseState = newState;
    } else {
      // 本次计算有update被跳过 生成环状链表
      newBaseQueueLast.next = newBaseQueueFirst;
    }
  }
  result.memoizedState = newState;
  result.baseState = newBaseState;
  result.baseQueue = newBaseQueueLast;
  return result;
};
