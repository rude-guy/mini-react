import { scheduleMicroTask } from 'hostConfig';
import { beginWork } from './beginWork';
import {
  commitHookEffectListCreate,
  commitHookEffectListDestroy,
  commitHookEffectListUnmount,
  commitLayoutEffects,
  commitMutationEffects,
} from './commitWork';
import { completeWork } from './completeWork';
import {
  FiberNode,
  FiberRootNode,
  PendingPassiveEffect,
  createWorkInProgress,
} from './fiber';
import { MutationMask, NoFlags, PassiveMask } from './fiberFlags';
import {
  Lane,
  NoLane,
  SyncLane,
  getHighestPriorityLane,
  lanesToSchedulerPriority,
  markRootFinished,
  mergeLanes,
} from './fiberLanes';
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue';
import { HostRoot } from './workTags';
import {
  unstable_scheduleCallback as scheduleCallback,
  unstable_NormalPriority as NormalPriority,
  unstable_shouldYield,
  unstable_cancelCallback,
  CallbackNode,
} from 'scheduler';
import { HookHasEffect, Passive } from './hookEffectTags';
import { SuspenseException, getSuspendedThenable } from './thenable';
import { resetHooksOnUnwind } from './fiberHooks';
import { throwException } from './fiberThrow';
import { unwindWork } from './fiberUnwindWork';

let workInProgress: FiberNode | null = null;
let wipRootRenderLane: Lane = NoLane;
let rootDoesHasPassiveEffects = false;

type RootExitStatus = number;
const RootInComplete = 1; // 中断执行
const RootCompleted = 2; // 执行完成

type SuspendedReason = typeof NotSuspended | typeof SuspendedOnData;
const NotSuspended = 0;
const SuspendedOnData = 1;
let wipSuspenseReason: SuspendedReason = NotSuspended;
let wipThrowValue: any = null;

function prepareFreshStack(root: FiberRootNode, lane: Lane) {
  root.finishedLane = NoLane;
  root.finishedWork = null;
  workInProgress = createWorkInProgress(root.current, {});
  wipRootRenderLane = lane;
}

export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
  // fiberRootNode
  const root = markUpdateFromFiberToRoot(fiber);
  markRootUpdated(root, lane);
  ensureRootIsScheduled(root);
}

export function ensureRootIsScheduled(root: FiberRootNode) {
  const updateLane = getHighestPriorityLane(root.pendingLanes);

  // 存在 高优先级打断低优先级
  const exitingCallback = root.callbackNode;

  /** 策略逻辑 */
  if (updateLane === NoLane) {
    if (exitingCallback !== null) {
      unstable_cancelCallback(exitingCallback);
    }
    root.callbackNode = null;
    root.callbackPriority = NoLane;
    return;
  }

  const curPriority = updateLane;
  const prevPriority = root.callbackPriority;
  if (curPriority === prevPriority) {
    return;
  }

  // 更高优先级
  if (exitingCallback !== null) {
    unstable_cancelCallback(exitingCallback);
  }

  let newCallbackNode: CallbackNode | null = null;

  if (__DEV__) {
    console.log(
      `在${updateLane === SyncLane ? '微' : '宏'}任务调度优先：`,
      updateLane
    );
  }

  if (updateLane === SyncLane) {
    // 同步优先级 微任务调度
    scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root));
    scheduleMicroTask(flushSyncCallbacks);
  } else {
    // 其他优先 宏任务调度
    const schedulerPriority = lanesToSchedulerPriority(updateLane);
    newCallbackNode = scheduleCallback(
      schedulerPriority,
      performConcurrentWorkOnRoot.bind(null, root)
    );
  }

  root.callbackNode = newCallbackNode;
  root.callbackPriority = updateLane;
}

export function markRootUpdated(root: FiberRootNode, lane: Lane) {
  root.pendingLanes = mergeLanes(root.pendingLanes, lane);
}

// 向上遍历找到根节点
function markUpdateFromFiberToRoot(fiber: FiberNode) {
  let node = fiber;
  let parent = fiber.return;
  while (parent !== null) {
    node = parent;
    parent = parent.return;
  }
  if (node.tag === HostRoot) {
    return node.stateNode;
  }
  return null;
}

function performConcurrentWorkOnRoot(root: FiberRootNode, didTimeout: boolean) {
  const curCallback = root.callbackNode;
  // 并发开始执行前，需要保证useEffect回调执行完 回调中可能会产生更高优先级，会打断当前的并发更新
  const didFlushPassiveEffect = flushPassiveEffects(root.pendingPassiveEffect);
  if (didFlushPassiveEffect) {
    if (root.callbackNode !== curCallback) {
      return null;
    }
  }

  const lane = getHighestPriorityLane(root.pendingLanes);
  const callbackNode = root.callbackNode;
  if (lane === NoLane) {
    return;
  }
  const needSync = lane === SyncLane || didTimeout;
  // render 阶段
  const exitStatus = renderRoot(root, lane, !needSync);

  ensureRootIsScheduled(root);

  if (exitStatus === RootInComplete) {
    // 中断执行，返回函数
    if (root.callbackNode !== callbackNode) {
      return null;
    }
    return performConcurrentWorkOnRoot.bind(null, root);
  }
  // 执行完成
  if (exitStatus === RootCompleted) {
    const finishedWork = root.current.alternate;
    root.finishedWork = finishedWork;
    root.finishedLane = lane;
    wipRootRenderLane = NoLane;

    // wip fiberNode树中的flags
    commitRoot(root);
  } else if (__DEV__) {
    console.warn('还是实现并发更新结束状态');
  }
}

function performSyncWorkOnRoot(root: FiberRootNode) {
  const nextLane = getHighestPriorityLane(root.pendingLanes);

  if (nextLane !== SyncLane) {
    // 其他比SyncLane优先级低
    // NoLane
    ensureRootIsScheduled(root);
    return;
  }

  // render阶段
  const exitStatus = renderRoot(root, nextLane, false);

  if (exitStatus === RootCompleted) {
    const finishedWork = root.current.alternate;
    root.finishedWork = finishedWork;
    root.finishedLane = nextLane;
    wipRootRenderLane = NoLane;

    // wip fiberNode树中的flags
    commitRoot(root);
  } else if (__DEV__) {
    console.warn('还是实现同步更新结束状态');
  }
}

function renderRoot(root: FiberRootNode, lane: Lane, shouldTimeSlice: boolean) {
  if (__DEV__) {
    console.warn(`开始${shouldTimeSlice ? '并发' : '同步'}更新`);
  }

  if (wipRootRenderLane !== lane) {
    // 初始化
    prepareFreshStack(root, lane);
  }

  do {
    try {
      if (wipSuspenseReason !== NotSuspended && workInProgress !== null) {
        const throwValue = wipThrowValue;
        wipSuspenseReason = NotSuspended;
        wipThrowValue = null;
        // unwind
        throwAndUnwindWorkLoop(root, workInProgress, throwValue, lane);
      }

      shouldTimeSlice ? workLoopConcurrent() : workLoopSync();
      break;
    } catch (e) {
      if (__DEV__) {
        console.warn('workLoop发生错误中断', e);
      }
      handleThrow(root, e);
    }
  } while (true);

  // 中断执行
  if (shouldTimeSlice && workInProgress !== null) {
    return RootInComplete;
  }

  if (!shouldTimeSlice && workInProgress !== null && __DEV__) {
    console.error('render阶段结束时wip应该为null');
  }

  // TODO: 报错

  // 执行完成
  return RootCompleted;
}

function throwAndUnwindWorkLoop(
  root: FiberRootNode,
  unitOfWork: FiberNode,
  throwValue: any,
  lane: Lane
) {
  // 重置 FC 全局变量
  resetHooksOnUnwind();
  // 请求返回后重新触发更新
  throwException(root, throwValue, lane);
  // unwind
  unwindUnitOfWork(unitOfWork);
}

function unwindUnitOfWork(unitOfWork: FiberNode) {
  let inCompleteWork: FiberNode | null = unitOfWork;

  do {
    const next = unwindWork(inCompleteWork);
    if (next !== null) {
      workInProgress = next;
      return;
    }
    const returnFiber = inCompleteWork.return as FiberNode;
    // 清除标记的副作用, 因为会重新beginWork
    if (returnFiber !== null) {
      returnFiber.deletions = null;
    }
    inCompleteWork = returnFiber;
  } while (inCompleteWork !== null);

  // 使用use，抛出了data，但没有定义Suspense
  // TODO：到了Root
  workInProgress = null;
}

function handleThrow(root: FiberRootNode, throwValue: any) {
  // Error boundary

  if (throwValue === SuspenseException) {
    throwValue = getSuspendedThenable();
    wipSuspenseReason = SuspendedOnData;
  }

  wipThrowValue = throwValue;
}

function commitRoot(root: FiberRootNode) {
  const finishedWork = root.finishedWork;

  if (finishedWork === null) {
    return;
  }

  if (__DEV__) {
    console.warn('commit阶段', finishedWork);
  }

  const lane = root.finishedLane;
  if (lane === NoLane && __DEV__) {
    console.warn('commit阶段finishedLane不应该为NoLane', finishedWork);
  }

  /// 重置
  root.finishedWork = null;
  root.finishedLane = NoLane;
  markRootFinished(root, lane);

  if (
    (finishedWork.flags & PassiveMask) !== NoFlags ||
    (finishedWork.subTreeFlags & PassiveMask) !== NoFlags
  ) {
    if (!rootDoesHasPassiveEffects) {
      rootDoesHasPassiveEffects = true;
      // 调度副作用
      scheduleCallback(NormalPriority, () => {
        // 执行副作用
        flushPassiveEffects(root.pendingPassiveEffect);
        return;
      });
    }
  }

  /** 判断3个子阶段是否存在需要执行的操作 */

  // root flags | root subTreeFlags
  const subTreeHasEffect =
    (finishedWork.subTreeFlags & MutationMask) !== NoFlags;
  const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags;

  if (subTreeHasEffect || rootHasEffect) {
    // 阶段3/1 beforeMutation

    // 阶段3/2 mutation
    commitMutationEffects(finishedWork, root);

    // 切换fiber树
    root.current = finishedWork;

    // 阶段3/3 Layout
    commitLayoutEffects(finishedWork, root);
  } else {
    root.current = finishedWork;
  }

  rootDoesHasPassiveEffects = false;
  ensureRootIsScheduled(root);
}

function flushPassiveEffects(pendingPassiveEffect: PendingPassiveEffect) {
  let didFlushPassiveEffect = false;
  pendingPassiveEffect.unmount.forEach((effect) => {
    didFlushPassiveEffect = true;
    commitHookEffectListUnmount(Passive, effect);
  });
  pendingPassiveEffect.unmount = [];

  pendingPassiveEffect.update.forEach((effect) => {
    didFlushPassiveEffect = true;
    commitHookEffectListDestroy(Passive | HookHasEffect, effect);
  });

  pendingPassiveEffect.update.forEach((effect) => {
    didFlushPassiveEffect = true;
    commitHookEffectListCreate(Passive | HookHasEffect, effect);
  });
  pendingPassiveEffect.update = [];
  flushSyncCallbacks();
  return didFlushPassiveEffect;
}

function workLoopSync() {
  while (workInProgress !== null) {
    // 执行工作
    perFromUnitOfWork(workInProgress);
  }
}

function workLoopConcurrent() {
  while (workInProgress !== null && !unstable_shouldYield()) {
    // 执行工作
    perFromUnitOfWork(workInProgress);
  }
}

// 执行工作单元 -> 递
function perFromUnitOfWork(fiber: FiberNode) {
  const next = beginWork(fiber, wipRootRenderLane);
  // 执行完后，将pendingProps -> memoizedProps
  fiber.memoizedProps = fiber.pendingProps;

  if (next === null) {
    completeUnitOfWork(fiber);
  } else {
    workInProgress = next;
  }
}

// 完成工作单元 -> 归
function completeUnitOfWork(fiber: FiberNode) {
  let node: FiberNode | null = fiber;
  do {
    completeWork(node);

    const sibling = node.sibling;
    if (sibling !== null) {
      workInProgress = sibling;
      return;
    }
    node = node.return;
    workInProgress = node;
  } while (node !== null);
}
