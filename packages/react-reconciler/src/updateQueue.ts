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
  pendingUpdate: Update<State> | null
): { memoizedState: State } => {
  const result: ReturnType<typeof processUpdateQueue<State>> = {
    memoizedState: baseState,
  };

  if (pendingUpdate !== null) {
    const action = pendingUpdate.action;
    // baseState 1 -> update (x) => 2x -> memoizedState 2
    if (action instanceof Function) {
      result.memoizedState = action(result.memoizedState);
    } else {
      // baseState 1 -> update 2 -> memoizedState 2
      result.memoizedState = action;
    }
  }

  return result;
};
