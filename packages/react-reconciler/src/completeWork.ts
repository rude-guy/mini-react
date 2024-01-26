import {
  Container,
  Instance,
  appendInitialChild,
  createInstance,
  createTextInstance,
} from 'hostConfig';
import { FiberNode } from './fiber';
import {
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
} from './workTags';
import { NoFlags } from './fiberFlags';

export const completeWork = (wip: FiberNode) => {
  const newProps = wip.pendingProps;
  const current = wip.alternate;

  switch (wip.tag) {
    case HostComponent:
      if (current !== null && wip.stateNode) {
        // update
      } else {
        // mount
        // 1. 构建DOM
        const instance = createInstance(wip.type, newProps);
        // 2. 将DOM树插入到DOM中
        appendAllChildren(instance, wip);
        wip.stateNode = instance;
      }
      bubbleProperties(wip);
      return null;
    case HostText:
      if (current !== null && wip.stateNode) {
        // update
      } else {
        // mount
        // 1. 构建DOM
        const instance = createTextInstance(newProps.content);
        wip.stateNode = instance;
      }
      bubbleProperties(wip);
      return null;

    case FunctionComponent:
      bubbleProperties(wip);
      return null;
    case HostRoot:
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

  while (child !== null) {
    subTreeFlags |= child.subTreeFlags;
    subTreeFlags |= child.flags;

    child.return = wip;
    child = child.sibling;
  }
  wip.subTreeFlags |= subTreeFlags;
}
