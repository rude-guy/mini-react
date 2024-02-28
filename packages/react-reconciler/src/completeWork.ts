import {
  Container,
  Instance,
  appendInitialChild,
  createInstance,
  createTextInstance,
} from 'hostConfig';
import { FiberNode } from './fiber';
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
import { NoFlags, Ref, Update, Visibility } from './fiberFlags';
import { updateFiberProps } from 'react-dom/src/SyntheticEvent';
import { popProvider } from './fiberContext';
import { popSuspenseHandler } from './suspenseContext';
import { NoLanes, mergeLanes } from './fiberLanes';

function markUpdate(fiber: FiberNode) {
  fiber.flags |= Update;
}

function markRef(fiber: FiberNode) {
  fiber.flags |= Ref;
}

export const completeWork = (wip: FiberNode) => {
  const newProps = wip.pendingProps;
  const current = wip.alternate;

  switch (wip.tag) {
    case HostComponent:
      if (current !== null && wip.stateNode) {
        // TODO: update
        // props 是否变化
        markUpdate(wip);
        // 标记Ref
        if (wip.ref !== current.ref) {
          markRef(wip);
        }
      } else {
        // mount
        // 1. 构建DOM
        const instance = createInstance(wip.type, newProps);
        // 2. 将DOM树插入到DOM中
        appendAllChildren(instance, wip);
        wip.stateNode = instance;
        // 标记Ref
        if (wip.ref !== null) {
          markRef(wip);
        }
      }
      bubbleProperties(wip);
      return null;
    case HostText:
      if (current !== null && wip.stateNode) {
        // update
        const oldText = current.memoizedProps.content;
        const newText = newProps.content;
        if (oldText !== newText) {
          markUpdate(wip);
        }
      } else {
        // mount
        // 1. 构建DOM
        const instance = createTextInstance(newProps.content);
        wip.stateNode = instance;
      }
      bubbleProperties(wip);
      return null;

    case FunctionComponent:
    case HostRoot:
    case Fragment:
    case OffscreenComponent:
      bubbleProperties(wip);
      return null;
    case ContextProvider:
      const context = wip.type._context;
      popProvider(context);
      bubbleProperties(wip);
      return null;
    case SuspenseComponent:
      popSuspenseHandler();
      const offscreenFiber = wip.child as FiberNode;
      const isHidden = offscreenFiber.pendingProps.mode === 'hidden';
      const currentOffscreenFiber = offscreenFiber.alternate;
      if (currentOffscreenFiber !== null) {
        // update
        const wasHidden = currentOffscreenFiber.pendingProps.mode === 'hidden';
        if (isHidden !== wasHidden) {
          offscreenFiber.flags |= Visibility;
          bubbleProperties(offscreenFiber);
        }
      } else {
        // mount
        if (isHidden) {
          offscreenFiber.flags |= Visibility;
          bubbleProperties(offscreenFiber);
        }
      }
      bubbleProperties(wip);
      return null;
    default:
      if (__DEV__) {
        console.warn('未处理的completeWork类型', wip);
      }
      return null;
  }
};

function appendAllChildren(parent: Container | Instance, wip: FiberNode) {
  let node = wip.child;

  while (node !== null) {
    // 当前节点
    if (node?.tag === HostComponent || node?.tag === HostText) {
      appendInitialChild(parent, node.stateNode);
    }
    // 判断子节点
    else if (node.child !== null) {
      node.child.return = node;
      node = node.child;
      continue;
    }

    if (node === wip) {
      return;
    }

    // 判断兄弟节点
    while (node.sibling === null) {
      if (node.return === null || node.return === wip) {
        return;
      }
      node = node.return;
    }

    node.sibling.return = node.return;
    node = node.sibling;
  }
}

// 子节点和兄弟节点冒泡到当前节点
function bubbleProperties(wip: FiberNode) {
  let subTreeFlags = NoFlags;
  let child = wip.child;
  let newChildLanes = NoLanes;

  while (child !== null) {
    subTreeFlags |= child.subTreeFlags;
    subTreeFlags |= child.flags;

    newChildLanes = mergeLanes(
      newChildLanes,
      mergeLanes(child.lanes, child.childLanes)
    );

    child.return = wip;
    child = child.sibling;
  }
  wip.subTreeFlags |= subTreeFlags;
  wip.childLanes = newChildLanes;
}
