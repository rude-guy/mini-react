import {
  Container,
  Instance,
  appendChildToContainer,
  commitUpdate,
  insertChildToContainer,
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

function recordHostChildrenToDelete(
  childToDelete: FiberNode[],
  unmountFiber: FiberNode
) {
  // 1. 找到第一个 root host 节点
  const lastOne = childToDelete[childToDelete.length - 1];
  if (!lastOne) {
    childToDelete.push(unmountFiber);
  } else {
    let node = lastOne.sibling;
    // 2. 没找到一个 host 节点，判断下这个节点是不是 1 找到那个节点的兄弟节点
    while (node !== null) {
      if (node === unmountFiber) {
        childToDelete.push(unmountFiber);
        break;
      }
      node = node.sibling;
    }
  }
}

function commitDeletion(childToDelete: FiberNode) {
  const rootChildrenToDelete: FiberNode[] = [];

  // 递归子树
  commitNestedComponent(childToDelete, (unmountFiber) => {
    switch (unmountFiber.tag) {
      case HostComponent:
        // TODO: 解绑ref
        recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
        return;
      case HostText:
        recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
        return;
      case FunctionComponent:
        // TODO: useEffect unmount
        break;
      default:
        if (__DEV__) {
          console.warn('未处理的unmount类型', unmountFiber);
        }
    }
  });

  if (rootChildrenToDelete.length) {
    const hostParent = getHostParent(childToDelete);
    if (hostParent !== null) {
      rootChildrenToDelete.forEach((node) =>
        removeChild(node.stateNode, hostParent)
      );
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

  // host sibling
  const hostSibling = getHostSibling(finishedWork);

  if (hostParent) {
    // finishedWork -> DOM
    insertOrAppendPlacemenNodeIntoContainer(
      finishedWork,
      hostParent,
      hostSibling
    );
  }
};

function getHostSibling(fiber: FiberNode) {
  let node: FiberNode = fiber;

  findSibling: while (true) {
    // HostComponent和HostRoot可以作为节点挂载的父元素调用append
    while (node.sibling === null) {
      const parent = node.return;
      if (
        parent === null ||
        parent.tag === HostComponent ||
        parent.tag === HostRoot
      ) {
        return null;
      }
      node = parent;
    }
    node.sibling.return = node.return;
    node = node.sibling;
    while (node.tag !== HostComponent && node.tag !== HostText) {
      if ((node.flags & Placement) !== NoFlags) {
        // 向下遍历，node flags必须为稳定的节点
        continue findSibling;
      }

      if (node.child === null) {
        continue findSibling;
      } else {
        node.child.return = node;
        node = node.child;
      }
    }

    if ((node.flags & Placement) === NoFlags) {
      return node.stateNode;
    }
  }
}

function getHostParent(fiber: FiberNode): Container | null {
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
}

function insertOrAppendPlacemenNodeIntoContainer(
  finishedWork: FiberNode,
  hostParent: Container,
  before?: Instance
) {
  // fiber Host
  if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
    if (before) {
      insertChildToContainer(finishedWork.stateNode, hostParent, before);
    } else {
      appendChildToContainer(hostParent, finishedWork.stateNode);
    }
    return;
  }

  const child = finishedWork.child;

  if (child !== null) {
    insertOrAppendPlacemenNodeIntoContainer(child, hostParent);

    let sibling = child.sibling;
    while (sibling !== null) {
      insertOrAppendPlacemenNodeIntoContainer(sibling, hostParent);
      sibling = sibling.sibling;
    }
  }
}
