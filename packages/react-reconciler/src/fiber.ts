import { Key, Props, ReactElementType } from 'shared/ReactTypes';
import {
  ContextProvider,
  Fragment,
  FunctionComponent,
  HostComponent,
  OffscreenComponent,
  SuspenseComponent,
  WorkTag,
} from './workTags';
import { Flags, NoFlags } from './fiberFlags';
import { Container } from 'hostConfig';
import { Lane, Lanes, NoLane, NoLanes } from './fiberLanes';
import { Effect } from './fiberHooks';
import { CallbackNode } from 'scheduler';
import { REACT_PROVIDER_TYPE, REACT_SUSPENSE_TYPE } from 'shared/ReactSymbols';

export interface OffscreenProps {
  mode: 'visible' | 'hidden';
  children: any;
}

export class FiberNode {
  type: any;
  tag: WorkTag;
  key: Key;
  stateNode: any;
  ref: any;

  return: FiberNode | null;
  sibling: FiberNode | null;
  child: FiberNode | null;
  index: number;

  pendingProps: Props;
  memoizedProps: Props | null;
  memoizedState: any;
  updateQueue: unknown;

  alternate: FiberNode | null;

  flags: Flags;
  subTreeFlags: Flags;
  deletions: FiberNode[] | null;

  constructor(tag: WorkTag, pendingProps: Props, key: Key) {
    // 实例
    this.tag = tag;
    this.key = key || null;
    this.stateNode = null;
    this.type = null;

    // 构成树状结构
    this.return = null;
    this.sibling = null;
    this.child = null;
    this.index = 0;

    this.ref = null;

    // 作为工作单元
    this.pendingProps = pendingProps;
    this.memoizedProps = null;
    this.updateQueue = null;
    this.memoizedState = null;

    this.alternate = null;
    // 副作用
    this.flags = NoFlags;
    this.subTreeFlags = NoFlags;
    this.deletions = null;
  }
}

export interface PendingPassiveEffect {
  unmount: Effect[];
  update: Effect[];
}

export class FiberRootNode {
  container: Container;
  current: FiberNode;
  finishedWork: FiberNode | null;
  pendingLanes: Lanes;
  finishedLane: Lane;
  pendingPassiveEffect: PendingPassiveEffect;
  callbackNode: CallbackNode | null;
  callbackPriority: Lane;
  constructor(container: Container, hostRootFiber: FiberNode) {
    this.container = container;
    this.current = hostRootFiber;
    hostRootFiber.stateNode = this;
    this.finishedWork = null;
    this.pendingLanes = NoLanes;
    this.finishedLane = NoLane;

    this.pendingPassiveEffect = {
      unmount: [],
      update: [],
    };

    this.callbackNode = null;
    this.callbackPriority = NoLane;
  }
}

export const createWorkInProgress = (
  current: FiberNode,
  pendingProps: Props
): FiberNode => {
  let wip = current.alternate;
  // mount
  if (wip === null) {
    wip = new FiberNode(current.tag, pendingProps, current.key);
    wip.stateNode = current.stateNode;

    wip.alternate = current;
    current.alternate = wip;
  } else {
    // update
    wip.pendingProps = pendingProps;
    wip.flags = NoFlags;
    wip.subTreeFlags = NoFlags;
    wip.deletions = null;
  }
  wip.type = current.type;
  wip.updateQueue = current.updateQueue;
  wip.child = current.child;
  wip.memoizedProps = current.memoizedProps;
  wip.memoizedState = current.memoizedState;
  wip.ref = current.ref;

  return wip;
};
export const createFiberFromElement = (element: ReactElementType) => {
  const { type, key, props, ref } = element;

  let fiberTag: WorkTag = FunctionComponent;

  if (typeof type === 'string') {
    fiberTag = HostComponent;
  } else if (
    typeof type === 'object' &&
    type.$$typeof === REACT_PROVIDER_TYPE
  ) {
    fiberTag = ContextProvider;
  } else if (type === REACT_SUSPENSE_TYPE) {
    fiberTag = SuspenseComponent;
  } else if (typeof type !== 'function' && __DEV__) {
    console.warn('未定义的type类型', type);
  }

  const fiber = new FiberNode(fiberTag, props, key);
  fiber.type = type;
  fiber.ref = ref;
  return fiber;
};

export const createFiberFromFragment = (elements: any[], key: Key) => {
  const fiber = new FiberNode(Fragment, elements, key);
  return fiber;
};

export const createFiberFromOffscreen = (pendingProps: OffscreenProps) => {
  const fiber = new FiberNode(OffscreenComponent, pendingProps, null);
  return fiber;
};
