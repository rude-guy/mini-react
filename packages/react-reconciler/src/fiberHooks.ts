import internals from 'shared/internals';
import { FiberNode } from './fiber';
import { Dispatcher, Dispatch } from 'react/src/currentDispatcher';
import {
  UpdateQueue,
  createUpdate,
  createUpdateQueue,
  enqueueUpdate,
  processUpdateQueue,
} from './updateQueue';
import { Action } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workLoop';
import { Lane, NoLane, requestUpdateLane } from './fiberLanes';
import { Flags, PassiveEffect } from './fiberFlags';
import { HookHasEffect, Passive } from './hookEffectTags';

let currentlyRenderingFiber: FiberNode | null = null;
let workInProgressHook: Hook | null = null;
let currentHook: Hook | null = null;
let renderLane: Lane = NoLane;

const { currentDispatcher } = internals;

export interface Hook {
  memoizedState: any;
  updateQueue: unknown;
  next: Hook | null;
}

export interface Effect {
  tag: Flags;
  create: EffectCallback | void;
  destroy: EffectCallback | void;
  deps: EffectDeps;
  next: Effect | null;
}

export interface FCUpdateQueue<State> extends UpdateQueue<State> {
  lastEffect: Effect | null;
}

type EffectCallback = () => void;
type EffectDeps = any[] | null;

export function renderWithHooks(wip: FiberNode, lane: Lane) {
  // render 之前
  currentlyRenderingFiber = wip;
  renderLane = lane;
  // 重置 memoizedState
  wip.memoizedState = null;

  const current = wip.alternate;
  if (current !== null) {
    // update
    currentDispatcher.current = hooksDispatcherOnUpdate;
  } else {
    // mount
    currentDispatcher.current = hooksDispatcherOnMount;
  }

  const Component = wip.type;
  const props = wip.pendingProps;
  const children = Component(props);

  // render之后
  currentlyRenderingFiber = null;
  workInProgressHook = null;
  currentHook = null;
  renderLane = NoLane;
  return children;
}

const hooksDispatcherOnMount: Dispatcher = {
  useState: mountState,
  useEffect: mountEffect,
};

const hooksDispatcherOnUpdate: Dispatcher = {
  useState: updateState,
  useEffect: updateEffect,
};

function updateEffect() {}

function mountEffect(create: EffectCallback | void, deps: EffectDeps | void) {
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  currentlyRenderingFiber!.flags |= PassiveEffect;

  hook.memoizedState = pushEffect(
    Passive | HookHasEffect,
    create,
    undefined,
    nextDeps
  );
}

function pushEffect(
  hookFlags: Flags,
  create: EffectCallback | void,
  destroy: EffectCallback | void,
  deps: EffectDeps
): Effect {
  const effect: Effect = {
    tag: hookFlags,
    create,
    destroy,
    deps,
    next: null,
  };

  const fiber = currentlyRenderingFiber as FiberNode;
  const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;

  if (updateQueue === null) {
    const updateQueue = createFCUpdateQueue();
    fiber.updateQueue = updateQueue;
    effect.next = effect;
    updateQueue.lastEffect = effect;
  } else {
    const lastEffect = updateQueue.lastEffect;
    if (lastEffect === null) {
      effect.next = effect;
      updateQueue.lastEffect = effect;
    } else {
      const firstEffect = lastEffect.next;
      lastEffect.next = effect;
      effect.next = firstEffect;
      updateQueue.lastEffect = effect;
    }
  }
  return effect;
}

function createFCUpdateQueue<State>() {
  const updateQueue = createUpdateQueue<State>() as FCUpdateQueue<State>;
  updateQueue.lastEffect = null;
  return updateQueue;
}

function updateState<State>(): [State, Dispatch<State>] {
  // 找到当前useState对应的hook的数据
  const hook = updateWorkInProgressHook();

  // 实现update计算新state

  const queue = hook.updateQueue as UpdateQueue<State>;
  const pending = queue.shared.pending;
  queue.shared.pending = null;

  if (pending !== null) {
    const { memoizedState } = processUpdateQueue(
      hook.memoizedState,
      pending,
      renderLane
    );
    hook.memoizedState = memoizedState;
  }

  return [hook.memoizedState, queue.dispatch as Dispatch<State>];
}

function updateWorkInProgressHook(): Hook {
  // TODO: render 阶段触发的更新
  let nextCurrentHook: Hook | null = null;

  if (currentHook === null) {
    // 这是FC，在update时第一个hook
    const current = currentlyRenderingFiber?.alternate;
    if (current !== null) {
      nextCurrentHook = current?.memoizedState;
    } else {
      // mount
      nextCurrentHook = null;
    }
  } else {
    // 这个FC 后续的hook
    nextCurrentHook = currentHook.next;
  }

  // 当hooks在条件判断中使用
  if (nextCurrentHook === null) {
    // mount u1 u2 u3
    // update u1 u2 u3 u4
    throw new Error(
      `组件 ${currentlyRenderingFiber?.type.name} 本次执行时的Hook比上次执行时多`
    );
  }

  currentHook = nextCurrentHook as Hook;

  const newHooks: Hook = {
    memoizedState: currentHook.memoizedState,
    updateQueue: currentHook.updateQueue,
    next: null,
  };

  if (workInProgressHook === null) {
    // mount 并且为第一个hook
    if (currentlyRenderingFiber === null) {
      throw new Error('请在函数组件中调用hook');
    } else {
      workInProgressHook = newHooks;
      currentlyRenderingFiber.memoizedState = workInProgressHook;
    }
  } else {
    // mount 并且不是第一个hook
    workInProgressHook.next = newHooks;
    workInProgressHook = newHooks;
  }
  return workInProgressHook;
}

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
  const lane = requestUpdateLane();
  const update = createUpdate(action, lane);
  enqueueUpdate(updateQueue, update);
  scheduleUpdateOnFiber(fiber, lane);
}

function mountWorkInProgressHook(): Hook {
  const hook: Hook = {
    memoizedState: null,
    updateQueue: null,
    next: null,
  };

  if (workInProgressHook === null) {
    // mount 并且为第一个hook
    if (currentlyRenderingFiber === null) {
      throw new Error('请在函数组件中调用hook');
    } else {
      workInProgressHook = hook;
      currentlyRenderingFiber.memoizedState = workInProgressHook;
    }
  } else {
    // mount 并且不是第一个hook
    workInProgressHook.next = hook;
    workInProgressHook = hook;
  }
  return workInProgressHook;
}
