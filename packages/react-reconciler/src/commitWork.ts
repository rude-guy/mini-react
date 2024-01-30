import {
  Container,
  appendChildToContainer,
  commitUpdate,
  removeChild,
} from 'hostConfig';
import { FiberNode, FiberRootNode } from './fiber';
import {
  ChildDeletion,
  MutationMask,
  NoFlags,
  Placement,
  Update,
} from './fiberFlags';
import {
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
} from './workTags';

let nextEffect: FiberNode | null;

export const commitMutationEffect = (finishedWork: FiberNode) => {
  nextEffect = finishedWork;

  while (nextEffect !== null) {
    // 向下遍历
    const child: FiberNode | null = nextEffect.child;
    // 子节点 subTreeFlags不存在或者子节点不存在 不需要进行更新操作
    if (
      (nextEffect.subTreeFlags & MutationMask) !== NoFlags &&
      child !== null
    ) {
      nextEffect = child;
    } else {
      // 向上遍历
      up: while (nextEffect !== null) {
        commitMutationEffectsOnFiber(nextEffect);
        const sibling = nextEffect.sibling;
        if (sibling !== null) {
          nextEffect = sibling;
          break up;
        }
        nextEffect = nextEffect.return;
      }
    }
  }
};

const commitMutationEffectsOnFiber = (finishedWork: FiberNode) => {
  // flags Placement
  const flags = finishedWork.flags;
  if ((flags & Placement) !== NoFlags) {
    commitPlacement(finishedWork);
    finishedWork.flags &= ~Placement;
  }

  // flags Update
  if ((flags & Update) !== NoFlags) {
    commitUpdate(finishedWork);
    finishedWork.flags &= ~Update;
  }

  // flags ChildDeletion
  if ((flags & ChildDeletion) !== NoFlags) {
    const deletions = finishedWork.deletions;
    if (deletions !== null) {
      deletions.forEach((childToDelete) => {
        commitDeletion(childToDelete);
      });
    }
    finishedWork.flags &= ~ChildDeletion;
  }
};

function commitDeletion(childToDelete: FiberNode) {
  let rootHostNode: FiberNode | null = null;

  // 递归子树
  commitNestedComponent(childToDelete, (unmountFiber) => {
    switch (unmountFiber.tag) {
      case HostComponent:
        if (rootHostNode === null) {
          rootHostNode = unmountFiber;
        }
        // TODO: 解绑ref
        return;
      case HostText:
        if (rootHostNode === null) {
          rootHostNode = unmountFiber;
        }
        return;
      case FunctionComponent:
        // TODO: useEffect unmount
        break;
      default:
        if (__DEV__) {
          console.error('未处理的unmount类型', unmountFiber);
        }
    }
  });

  if (rootHostNode !== null) {
    const hostParent = getHostParent(childToDelete);
    if (hostParent !== null) {
      removeChild(rootHostNode, hostParent);
    }
  }
  childToDelete.return = null;
  childToDelete.child = null;
}

function commitNestedComponent(
  root: FiberNode,
  onCommitUnmount: (fiber: FiberNode) => void
) {
  let node = root;
  while (true) {
    onCommitUnmount(node);
    if (node.child !== null) {
      // 向下遍历
      node.child.return = node;
      node = node.child;
      continue;
    }
    // 终止条件
    if (node === root) {
      return;
    }

    while (node.sibling === null) {
      if (node.return === null || node.return === root) {
        return;
      }
      // 向上归
      node = node.return;
    }

    node.sibling.return = node.return;
    node = node.sibling;
  }
}

const commitPlacement = (finishedWork: FiberNode) => {
  if (__DEV__) {
    console.warn('执行Placement操作', finishedWork);
  }

  // parent DOM
  const hostParent = getHostParent(finishedWork);
  if (hostParent) {
    // finishedWork -> DOM
    appendPlacemenNodeIntoContainer(finishedWork, hostParent);
  }
};

const getHostParent = (fiber: FiberNode): Container | null => {
  let parent = fiber.return;

  while (parent !== null) {
    const parentTag = parent.tag;
    // 只存在 HostComponent HostRoot
    if (parentTag === HostComponent) {
      return parent.stateNode;
    }
    if (parentTag === HostRoot) {
      return (parent.stateNode as FiberRootNode).container;
    }
    parent = parent.return;
  }

  if (__DEV__) {
    console.warn('未找到HostParent');
  }

  return null;
};

function appendPlacemenNodeIntoContainer(
  finishedWork: FiberNode,
  hostParent: Container
) {
  // fiber Host
  if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
    appendChildToContainer(hostParent, finishedWork.stateNode);
    return;
  }

  const child = finishedWork.child;

  if (child !== null) {
    appendPlacemenNodeIntoContainer(child, hostParent);

    let sibling = child.sibling;
    while (sibling !== null) {
      appendPlacemenNodeIntoContainer(sibling, hostParent);
      sibling = sibling.sibling;
    }
  }
}
