import { ReactElementType } from 'shared/ReactTypes';
import { FiberNode } from './fiber';
import { UpdateQueue, processUpdateQueue } from './updateQueue';
import {
  Fragment,
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
} from './workTags';
import { mountChildFibers, reconcileChildFibers } from './childFibers';
import { renderWithHooks } from './fiberHooks';
import { Lane } from './fiberLanes';
import { Ref } from './fiberFlags';

export const beginWork = (wip: FiberNode, renderLane: Lane) => {
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
    default:
      if (__DEV__) {
        console.warn('未实现的 beginWork 类型', wip.tag);
      }
      break;
  }
  return null;
};

function updateFragment(wip: FiberNode) {
  const nextChildren = wip.pendingProps;
  reconcileChildren(wip, nextChildren);
  return wip.child;
}

function updateFunctionComponent(wip: FiberNode, renderLane: Lane) {
  const nextChildren = renderWithHooks(wip, renderLane);
  reconcileChildren(wip, nextChildren);
  return wip.child;
}

function updateHostRoot(wip: FiberNode, renderLane: Lane) {
  const baseState = wip.memoizedState;
  const updateQueue = wip.updateQueue as UpdateQueue<Element>;
  const pending = updateQueue.shared.pending;
  updateQueue.shared.pending = null;
  const { memoizedState } = processUpdateQueue(baseState, pending, renderLane);
  wip.memoizedState = memoizedState;

  const nextChildren = wip.memoizedState;
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
