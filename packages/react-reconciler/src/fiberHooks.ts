import internals from 'shared/internals';
import { FiberNode } from './fiber';
import { Dispatcher, Dispatch } from 'react/src/currentDispatcher';
import {
  UpdateQueue,
  createUpdate,
  createUpdateQueue,
  enqueueUpdate,
} from './updateQueue';
import { Action } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workLoop';

let currentlyRenderingFiber: FiberNode | null = null;
let workInProcessHook: Hook | null = null;

const { currentDispatcher } = internals;

export interface Hook {
  memoizedState: any;
  updateQueue: unknown;
  next: Hook | null;
}

export function renderWithHooks(wip: FiberNode) {
  // render 之前
  currentlyRenderingFiber = wip;
  // 重置 memoizedState
  wip.memoizedState = null;

  const current = wip.alternate;
  if (current !== null) {
    // update
  } else {
    // mount
    currentDispatcher.current = hooksDispatcherOnMount;
  }

  const Component = wip.type;
  const props = wip.pendingProps;
  const children = Component(props);

  // render之后
  currentlyRenderingFiber = null;
  return children;
}

const hooksDispatcherOnMount: Dispatcher = {
  useState: mountState,
};

function mountState<State>(
  initialState: (() => State) | State
): [State, Dispatch<State>] {
  // 找到当前useState对应的hook的数据
  const hook = mountWorkInProgressHook();

  let memoizedState: State;
  if (initialState instanceof Function) {
    memoizedState = initialState();
  } else {
    memoizedState = initialState;
  }

  const updateQueue = createUpdateQueue();
  hook.updateQueue = updateQueue;
  hook.memoizedState = memoizedState;

  const dispatch = dispatchSetState.bind(
    null,
    currentlyRenderingFiber!,
    updateQueue
  );

  updateQueue.dispatch = dispatch;

  return [memoizedState, dispatch];
}

function dispatchSetState<State>(
  fiber: FiberNode,
  updateQueue: UpdateQueue<State>,
  action: Action<State>
) {
  const update = createUpdate(action);
  enqueueUpdate(updateQueue, update);
  scheduleUpdateOnFiber(fiber);
}

function mountWorkInProgressHook(): Hook {
  const hook: Hook = {
    memoizedState: null,
    updateQueue: null,
    next: null,
  };

  if (workInProcessHook === null) {
    // mount 并且为第一个hook
    if (currentlyRenderingFiber === null) {
      throw new Error('请在函数组件中调用hook');
    } else {
      workInProcessHook = hook;
      currentlyRenderingFiber.memoizedState = workInProcessHook;
    }
  } else {
    // mount 并且不是第一个hook
    workInProcessHook.next = hook;
    workInProcessHook = hook;
  }
  return workInProcessHook;
}
