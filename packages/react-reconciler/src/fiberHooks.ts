import internals from 'shared/internals';
import { FiberNode } from './fiber';
import { Dispatcher, Dispatch } from 'react/src/currentDispatcher';
import {
  Update,
  UpdateQueue,
  basicStateReducer,
  createUpdate,
  createUpdateQueue,
  enqueueUpdate,
  processUpdateQueue,
} from './updateQueue';
import { Action, ReactContext, Thenable, Useable } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workLoop';
import {
  Lane,
  NoLane,
  NoLanes,
  mergeLanes,
  removeLanes,
  requestUpdateLane,
} from './fiberLanes';
import { Flags, PassiveEffect } from './fiberFlags';
import { HookHasEffect, Passive } from './hookEffectTags';
import currentBatchConfig from 'react/src/currentBatchConfig';
import { REACT_CONTEXT_TYPE } from 'shared/ReactSymbols';
import { trackUsedThenable } from './thenable';
import { markWipReceivedUpdate } from './beginWork';
import { readContext as readContextOrigin } from './fiberContext';

let currentlyRenderingFiber: FiberNode | null = null;
let workInProgressHook: Hook | null = null;
let currentHook: Hook | null = null;
let renderLane: Lane = NoLane;

const { currentDispatcher } = internals;

export interface Hook {
  memoizedState: any;
  updateQueue: unknown;
  next: Hook | null;
  baseState: any;
  baseQueue: Update<any> | null;
}

export interface Effect {
  tag: Flags;
  create: EffectCallback | void;
  destroy: EffectCallback | void;
  deps: HookDeps;
  next: Effect | null;
}

export interface FCUpdateQueue<State> extends UpdateQueue<State> {
  lastEffect: Effect | null;
  lastRenderedState: State;
}

type EffectCallback = () => void;
export type HookDeps = any[] | null;

function readContext<Value>(context: ReactContext<Value>): Value {
  const consumer = currentlyRenderingFiber as FiberNode;
  return readContextOrigin(consumer, context);
}

export function renderWithHooks(
  wip: FiberNode,
  Component: FiberNode['type'],
  lane: Lane
) {
  // render 之前
  currentlyRenderingFiber = wip;
  renderLane = lane;
  // 重置 memoizedState
  wip.memoizedState = null;
  // 重置 effect 链表
  wip.updateQueue = null;

  const current = wip.alternate;
  if (current !== null) {
    // update
    currentDispatcher.current = hooksDispatcherOnUpdate;
  } else {
    // mount
    currentDispatcher.current = hooksDispatcherOnMount;
  }

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
  useTransition: mountTransition,
  useRef: mountRef,
  useContext: readContext,
  use,
  useCallback: mountCallback,
  useMemo: mountMemo,
};

const hooksDispatcherOnUpdate: Dispatcher = {
  useState: updateState,
  useEffect: updateEffect,
  useTransition: updateTransition,
  useRef: updateRef,
  useContext: readContext,
  use,
  useCallback: updateCallback,
  useMemo: updateMemo,
};

function updateEffect(create: EffectCallback | void, deps: HookDeps | void) {
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  let destroy: EffectCallback | void;

  if (currentHook !== null) {
    const prevEffect = currentHook.memoizedState as Effect;
    destroy = prevEffect.destroy;

    if (nextDeps !== null) {
      // 浅比较依赖
      const prevDeps = prevEffect.deps;
      if (areHookInputsEqual(nextDeps, prevDeps)) {
        hook.memoizedState = pushEffect(Passive, create, destroy, nextDeps);
        return;
      } else {
        currentlyRenderingFiber!.flags |= PassiveEffect;
        hook.memoizedState = pushEffect(
          Passive | HookHasEffect,
          create,
          destroy,
          nextDeps
        );
      }
    }
  }
}

function areHookInputsEqual(nextDeps: HookDeps, prevDeps: HookDeps) {
  if (prevDeps === null || nextDeps === null) {
    return false;
  }
  for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
    if (Object.is(nextDeps[i], prevDeps[i])) {
      continue;
    }
    return false;
  }
  return true;
}

function mountEffect(create: EffectCallback | void, deps: HookDeps | void) {
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
  deps: HookDeps
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

  const queue = hook.updateQueue as FCUpdateQueue<State>;
  const baseState = hook.baseState;

  const pending = queue.shared.pending;
  let baseQueue = hook.baseQueue;
  const current = currentHook as Hook;

  if (pending !== null) {
    // pending baseQueue update保存在current中
    if (baseQueue !== null) {
      // 合并baseQueue，形成环状链表
      const baseFirst = baseQueue.next;
      const pendingFirst = pending.next;
      baseQueue.next = pendingFirst;
      pending.next = baseFirst;
    }
    baseQueue = pending;
    // 保存到current
    current.baseQueue = pending;
    queue.shared.pending = null;
  }

  if (baseQueue !== null) {
    const prevState = hook.memoizedState;
    const {
      memoizedState,
      baseState: newBaseState,
      baseQueue: newBaseQueue,
    } = processUpdateQueue(baseState, baseQueue, renderLane, (update) => {
      const skippedLane = update.lane;
      const fiber = currentlyRenderingFiber as FiberNode;
      // 标记lane
      fiber.lanes = mergeLanes(fiber.lanes, skippedLane);
    });

    // NaN === NaN false -> Object.is true
    // +0 === -0 true -> Object.is false
    if (!Object.is(prevState, memoizedState)) {
      markWipReceivedUpdate();
    }

    hook.memoizedState = memoizedState;
    hook.baseState = newBaseState;
    hook.baseQueue = newBaseQueue;

    queue.lastRenderedState = memoizedState;
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
    baseState: currentHook.baseState,
    baseQueue: currentHook.baseQueue,
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

  const queue = createFCUpdateQueue();
  hook.updateQueue = queue;
  hook.memoizedState = memoizedState;
  hook.baseState = memoizedState;

  const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber!, queue);

  queue.dispatch = dispatch;
  queue.lastRenderedState = memoizedState;

  return [memoizedState, dispatch];
}

function mountRef<T>(initialVal: T): { current: T } {
  const hook = mountWorkInProgressHook();
  const ref = { current: initialVal };
  hook.memoizedState = ref;
  return ref;
}

function updateRef() {
  const hook = updateWorkInProgressHook();
  return hook.memoizedState;
}

function mountTransition(): [boolean, (callback: () => void) => void] {
  const [isPending, setPending] = mountState(false);
  const hook = mountWorkInProgressHook();
  const start = startTransition.bind(null, setPending);
  hook.memoizedState = start;
  return [isPending, start];
}

function updateTransition(): [boolean, (callback: () => void) => void] {
  const [isPending] = updateState();
  const hook = updateWorkInProgressHook();
  const start = hook.memoizedState;
  return [isPending as boolean, start];
}

function startTransition(setPending: Dispatch<boolean>, callback: () => void) {
  setPending(true);

  const prevTransition = currentBatchConfig.transition;
  currentBatchConfig.transition = 1;

  callback();
  setPending(false);

  currentBatchConfig.transition = prevTransition;
}

function dispatchSetState<State>(
  fiber: FiberNode,
  updateQueue: FCUpdateQueue<State>,
  action: Action<State>
) {
  const lane = requestUpdateLane();
  const update = createUpdate(action, lane);

  // eagerState策略
  const current = fiber.alternate;
  if (
    fiber.lanes === NoLanes &&
    (current === null || current.lanes === NoLanes)
  ) {
    // 当前产生的update是fiber的第一个update
    // 1. 更新前的状态；2. 计算状态的方法
    const currentState = updateQueue.lastRenderedState;
    const eagerState = basicStateReducer(currentState, action);
    update.hasEagerState = true;
    update.eagerState = eagerState;
    if (Object.is(eagerState, currentState)) {
      enqueueUpdate(updateQueue, update, fiber, NoLane);
      if (__DEV__) {
        console.warn('命中eagerState', fiber);
      }
      return;
    }
  }

  enqueueUpdate(updateQueue, update, fiber, lane);
  scheduleUpdateOnFiber(fiber, lane);
}

function mountWorkInProgressHook(): Hook {
  const hook: Hook = {
    memoizedState: null,
    updateQueue: null,
    baseState: null,
    baseQueue: null,
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

function use<T>(useable: Useable<T>) {
  if (useable !== null && typeof useable === 'object') {
    if (typeof (useable as Thenable<T>).then === 'function') {
      const thenable = useable as Thenable<T>;
      return trackUsedThenable(thenable);
    } else if ((useable as ReactContext<T>).$$typeof === REACT_CONTEXT_TYPE) {
      const context = useable as ReactContext<T>;
      return readContext(context);
    }
  }

  throw new Error('不支持的useable参数: ' + useable);
}

export function resetHooksOnUnwind() {
  currentlyRenderingFiber = null;
  currentHook = null;
  workInProgressHook = null;
}

export function bailoutHook(wip: FiberNode, renderLane: Lane) {
  const current = wip.alternate as FiberNode;
  wip.updateQueue = current.updateQueue;
  wip.flags &= ~PassiveEffect;

  current.lanes = removeLanes(current.lanes, renderLane);
}

function mountCallback<T>(callback: T, deps: HookDeps | undefined) {
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  hook.memoizedState = [callback, nextDeps];
  return callback;
}

function updateCallback<T>(callback: T, deps: HookDeps | undefined) {
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;

  const prevState = hook.memoizedState;
  if (prevState !== null) {
    const prevDeps = prevState[1];
    if (areHookInputsEqual(prevDeps, nextDeps)) {
      return prevState[0];
    }
  }

  hook.memoizedState = [callback, nextDeps];
  return callback;
}

function mountMemo<T>(nextCreate: () => T, deps: HookDeps | undefined) {
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  const nextValue = nextCreate();
  hook.memoizedState = [nextValue, nextDeps];
  return nextValue;
}

function updateMemo<T>(nextCreate: () => T, deps: HookDeps | undefined) {
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;

  const prevState = hook.memoizedState;
  if (prevState !== null) {
    const prevDeps = prevState[1];
    if (areHookInputsEqual(prevDeps, nextDeps)) {
      return prevState[0];
    }
  }

  const nextValue = nextCreate();
  hook.memoizedState = [nextValue, nextDeps];
  return nextValue;
}
