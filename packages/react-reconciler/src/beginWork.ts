import { ReactElementType } from 'shared/ReactTypes';
import {
  FiberNode,
  OffscreenProps,
  createFiberFromFragment,
  createFiberFromOffscreen,
  createWorkInProgress,
} from './fiber';
import { UpdateQueue, processUpdateQueue } from './updateQueue';
import {
  ContextProvider,
  Fragment,
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
  OffscreenComponent,
  SuspenseComponent,
} from './workTags';
import {
  cloneChildFibers,
  mountChildFibers,
  reconcileChildFibers,
} from './childFibers';
import { bailoutHook, renderWithHooks } from './fiberHooks';
import { Lane, NoLanes, includesSomeLanes } from './fiberLanes';
import {
  ChildDeletion,
  DidCapture,
  NoFlags,
  Placement,
  Ref,
} from './fiberFlags';
import { pushProvider } from './fiberContext';
import { pushSuspenseHandler } from './suspenseContext';

// 是否触发了更新 是否能命中bailout
let didReceiveUpdate = false;

export function markWipReceivedUpdate() {
  didReceiveUpdate = true;
}

export const beginWork = (wip: FiberNode, renderLane: Lane) => {
  // bailout策略
  didReceiveUpdate = false;
  const current = wip.alternate;
  if (current !== null) {
    const oldProps = current.memoizedProps;
    const newProps = wip.pendingProps;

    // 四要素 props type
    if (oldProps !== newProps || wip.type !== current.type) {
      didReceiveUpdate = true;
    } else {
      // state context
      const hasSchedulerUpdateOrContext = checkScheduledUpdateOrContext(
        current,
        renderLane
      );
      if (!hasSchedulerUpdateOrContext) {
        // 命中bailout
        didReceiveUpdate = false;
        switch (wip.tag) {
          case ContextProvider:
            const newValue = wip.memoizedProps.value;
            const context = wip.type._context;
            pushProvider(context, newValue);
            break;
          // TODO: Suspense
        }
        return bailoutOnAlreadyFinishedWork(wip, renderLane);
      }
    }
  }

  wip.lanes = NoLanes;

  // 比较,返回子 fiberNode
  switch (wip.tag) {
    case HostRoot:
      return updateHostRoot(wip, renderLane);
    case HostComponent:
      return updateHostComponent(wip);
    case HostText:
      return null;
    case FunctionComponent:
      return updateFunctionComponent(wip, renderLane);
    case Fragment:
      return updateFragment(wip);
    case ContextProvider:
      return updateContextProvider(wip);
    case SuspenseComponent:
      return updateSuspenseComponent(wip);
    case OffscreenComponent:
      return updateOffscreenComponent(wip);
    default:
      if (__DEV__) {
        console.warn('未实现的 beginWork 类型', wip.tag);
      }
      break;
  }
  return null;
};

function bailoutOnAlreadyFinishedWork(wip: FiberNode, renderLane: Lane) {
  if (!includesSomeLanes(wip.childLanes, renderLane)) {
    if (__DEV__) {
      console.warn('bailout整颗子树', wip);
    }
    return null;
  }
  if (__DEV__) {
    console.warn('bailout一个fiber', wip);
  }
  cloneChildFibers(wip);
  return wip.child;
}

function checkScheduledUpdateOrContext(
  current: FiberNode,
  renderLane: Lane
): boolean {
  const updateLanes = current.lanes;
  if (includesSomeLanes(updateLanes, renderLane)) {
    return true;
  }
  return false;
}

function updateOffscreenComponent(wip: FiberNode) {
  const nextProps = wip.pendingProps;
  const nextChildren = nextProps.children;
  reconcileChildren(wip, nextChildren);
  return wip.child;
}

function updateSuspenseComponent(wip: FiberNode) {
  const current = wip.alternate;
  const nextProps = wip.pendingProps;

  let showFallback = false;
  const didSuspend = (wip.flags & DidCapture) !== NoFlags;

  if (didSuspend) {
    showFallback = true;
    wip.flags &= ~DidCapture;
  }

  const nextPrimaryChildren = nextProps.children;
  const nextFallbackChildren = nextProps.fallback;

  pushSuspenseHandler(wip);

  if (current === null) {
    // mount
    if (showFallback) {
      // 挂起
      return mountSuspenseFallbackChildren(
        wip,
        nextPrimaryChildren,
        nextFallbackChildren
      );
    } else {
      // 正常
      return mountSuspensePrimaryChildren(wip, nextPrimaryChildren);
    }
  } else {
    // update
    if (showFallback) {
      // 挂起
      return updateSuspenseFallbackChildren(
        wip,
        nextPrimaryChildren,
        nextFallbackChildren
      );
    } else {
      // 正常
      return updateSuspensePrimaryChildren(wip, nextPrimaryChildren);
    }
  }
}

function updateSuspensePrimaryChildren(wip: FiberNode, primaryChildren: any) {
  const current = wip.alternate as FiberNode;
  const currentPrimaryChildFragment = current.child as FiberNode;
  const currentFallbackChildFragment: FiberNode | null =
    currentPrimaryChildFragment.sibling;

  const primaryChildProps: OffscreenProps = {
    mode: 'visible',
    children: primaryChildren,
  };

  const primaryChildFragment = createWorkInProgress(
    currentPrimaryChildFragment,
    primaryChildProps
  );

  if (currentFallbackChildFragment !== null) {
    // 移除fallback
    const deletions = wip.deletions;
    if (deletions === null) {
      wip.deletions = [currentFallbackChildFragment];
      wip.flags |= ChildDeletion;
    } else {
      wip.deletions!.push(currentFallbackChildFragment);
    }
  }

  primaryChildFragment.return = wip;
  primaryChildFragment.sibling = null;
  wip.child = primaryChildFragment;

  return primaryChildFragment;
}

function updateSuspenseFallbackChildren(
  wip: FiberNode,
  primaryChildren: any,
  fallbackChildren: any
) {
  const current = wip.alternate as FiberNode;
  const currentPrimaryChildFragment = current.child as FiberNode;
  const currentFallbackChildFragment: FiberNode | null =
    currentPrimaryChildFragment.sibling;

  const primaryChildProps: OffscreenProps = {
    mode: 'hidden',
    children: primaryChildren,
  };

  const primaryChildFragment = createWorkInProgress(
    currentPrimaryChildFragment,
    primaryChildProps
  );

  let fallbackChildFragment: FiberNode;

  if (currentFallbackChildFragment !== null) {
    fallbackChildFragment = createWorkInProgress(
      currentFallbackChildFragment,
      fallbackChildren
    );
  } else {
    fallbackChildFragment = createFiberFromFragment(fallbackChildren, null);
    fallbackChildFragment.flags |= Placement;
  }

  primaryChildFragment.return = wip;
  fallbackChildFragment.return = wip;
  primaryChildFragment.sibling = fallbackChildFragment;
  wip.child = primaryChildFragment;

  return fallbackChildFragment;
}

function mountSuspensePrimaryChildren(wip: FiberNode, primaryChildren: any) {
  const primaryChildProps: OffscreenProps = {
    mode: 'visible',
    children: primaryChildren,
  };
  const primaryChildFragment = createFiberFromOffscreen(primaryChildProps);

  primaryChildFragment.return = wip;
  wip.child = primaryChildFragment;

  return primaryChildFragment;
}

function mountSuspenseFallbackChildren(
  wip: FiberNode,
  primaryChildren: any,
  fallbackChildren: any
) {
  const primaryChildProps: OffscreenProps = {
    mode: 'hidden',
    children: primaryChildren,
  };
  const primaryChildFragment = createFiberFromOffscreen(primaryChildProps);
  const fallbackChildFragment = createFiberFromFragment(fallbackChildren, null);

  // Placement 只有在update流程中mark，但在suspense中的fallback是处于mount状态，需要手动Placement
  fallbackChildFragment.flags |= Placement;

  primaryChildFragment.return = wip;
  fallbackChildFragment.return = wip;
  primaryChildFragment.sibling = fallbackChildFragment;
  wip.child = primaryChildFragment;

  return fallbackChildFragment;
}

function updateContextProvider(wip: FiberNode) {
  const provideType = wip.type;
  const context = provideType._context;
  const newProps = wip.pendingProps;

  pushProvider(context, newProps.value);

  const children = newProps.children;
  reconcileChildren(wip, children);
  return wip.child;
}

function updateFragment(wip: FiberNode) {
  const nextChildren = wip.pendingProps;
  reconcileChildren(wip, nextChildren);
  return wip.child;
}

function updateFunctionComponent(wip: FiberNode, renderLane: Lane) {
  const nextChildren = renderWithHooks(wip, renderLane);

  const current = wip.alternate;
  if (current !== null && !didReceiveUpdate) {
    bailoutHook(wip, renderLane);
    return bailoutOnAlreadyFinishedWork(wip, renderLane);
  }
  reconcileChildren(wip, nextChildren);
  return wip.child;
}

function updateHostRoot(wip: FiberNode, renderLane: Lane) {
  const baseState = wip.memoizedState;
  const updateQueue = wip.updateQueue as UpdateQueue<Element>;
  const pending = updateQueue.shared.pending;
  updateQueue.shared.pending = null;
  const { memoizedState } = processUpdateQueue(baseState, pending, renderLane);

  const prevChildren = wip.child;

  /**
   * 挂起未完成状态（RootDidNotComplete），未进行commitWork，updateQueue.shared.pending 被置空状态会丢失，保存在current的memoizedState
   * 因为没有进行commitWork, fiber的alternate是不会被切换的
   */
  const current = wip.alternate;
  if (current !== null) {
    if (current.memoizedState == null) {
      current.memoizedState = memoizedState;
    }
  }

  wip.memoizedState = memoizedState;
  const nextChildren = wip.memoizedState;

  if (prevChildren === nextChildren) {
    return bailoutOnAlreadyFinishedWork(wip, renderLane);
  }

  reconcileChildren(wip, nextChildren);
  return wip.child;
}

function updateHostComponent(wip: FiberNode) {
  const pendingProps = wip.pendingProps;
  const nextChildren = pendingProps.children;
  reconcileChildren(wip, nextChildren);
  markRef(wip.alternate, wip);
  return wip.child;
}

function reconcileChildren(wip: FiberNode, children?: ReactElementType) {
  const current = wip.alternate;
  if (current !== null) {
    // update
    wip.child = reconcileChildFibers(wip, current.child, children);
  } else {
    // mount
    wip.child = mountChildFibers(wip, null, children);
  }
}

function markRef(current: FiberNode | null, wip: FiberNode) {
  const ref = wip.ref;
  if (
    (current === null && ref !== null) ||
    (current !== null && current.ref !== ref)
  ) {
    wip.flags |= Ref;
  }
}
