import internals from 'shared/internals';
import { FiberNode } from './fiber';
import { Dispatcher, Dispatch } from 'react/src/currentDispatcher';
import {
  Update,
  UpdateQueue,
  createUpdate,
  createUpdateQueue,
  enqueueUpdate,
  processUpdateQueue,
} from './updateQueue';
import { Action, ReactContext } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workLoop';
import { Lane, NoLane, requestUpdateLane } from './fiberLanes';
import { Flags, PassiveEffect } from './fiberFlags';
import { HookHasEffect, Passive } from './hookEffectTags';
import currentBatchConfig from 'react/src/currentBatchConfig';

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
  useTransition: mountTransition,
  useRef: mountRef,
  useContext: readContext,
};

const hooksDispatcherOnUpdate: Dispatcher = {
  useState: updateState,
  useEffect: updateEffect,
  useTransition: updateTransition,
  useRef: updateRef,
  useContext: readContext,
};

function updateEffect(create: EffectCallback | void, deps: EffectDeps | void) {
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

function areHookInputsEqual(nextDeps: EffectDeps, prevDeps: EffectDeps) {
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
    const {
      memoizedState,
      baseState: newBaseState,
      baseQueue: newBaseQueue,
    } = processUpdateQueue(baseState, baseQueue, renderLane);
    hook.memoizedState = memoizedState;
    hook.baseState = newBaseState;
    hook.baseQueue = newBaseQueue;
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

  const updateQueue = createUpdateQueue();
  hook.updateQueue = updateQueue;
  hook.memoizedState = memoizedState;
  hook.baseState = memoizedState;

  const dispatch = dispatchSetState.bind(
    null,
    currentlyRenderingFiber!,
    updateQueue
  );

  updateQueue.dispatch = dispatch;

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

function readContext<T>(context: ReactContext<T>) {
  const consumer = currentlyRenderingFiber;
  if (consumer === null) {
    throw new Error('只能在函数组件中使用useContext');
  }
  const value = context._currentValue;
  return value;
}
