import { Dispatch } from 'react/src/currentDispatcher';
import { Action } from 'shared/ReactTypes';
import { Lane } from './fiberLanes';

export interface Update<State> {
  action: Action<State>;
  next: Update<any> | null; // 指向下一个update
  lane: Lane;
}

export interface UpdateQueue<State> {
  shared: {
    pending: Update<State> | null;
  };
  dispatch: Dispatch<State> | null;
}

export const createUpdate = <State>(
  action: Action<State>,
  lane: Lane
): Update<State> => {
  return {
    action,
    lane,
    next: null,
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
  update: Update<State>
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
};

// 消费update
export const processUpdateQueue = <State>(
  baseState: State,
  pendingUpdate: Update<State> | null,
  renderLane: Lane
): { memoizedState: State } => {
  const result: ReturnType<typeof processUpdateQueue<State>> = {
    memoizedState: baseState,
  };

  if (pendingUpdate !== null) {
    // 第一个update
    const first = pendingUpdate.next;
    let pending = pendingUpdate.next;
    do {
      const updateLane = pending!.lane;
      if (updateLane === renderLane) {
        const action = pendingUpdate.action;
        // baseState 1 -> update (x) => 2x -> memoizedState 2
        if (action instanceof Function) {
          baseState = action(baseState);
        } else {
          // baseState 1 -> update 2 -> memoizedState 2
          baseState = action;
        }
      } else {
        if (__DEV__) {
          console.error('不应该进入updateLane !== renderLane');
        }
      }
      pending = pending!.next;
    } while (pending !== first);
  }
  result.memoizedState = baseState;
  return result;
};
