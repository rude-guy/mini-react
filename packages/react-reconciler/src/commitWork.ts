import {
  Container,
  Instance,
  appendChildToContainer,
  commitUpdate,
  hiddenInstance,
  hiddenTextInstance,
  insertChildToContainer,
  removeChild,
  unhiddenInstance,
  unhiddenTextInstance,
} from 'hostConfig';
import { FiberNode, FiberRootNode, PendingPassiveEffect } from './fiber';
import {
  ChildDeletion,
  Flags,
  LayoutMask,
  MutationMask,
  NoFlags,
  PassiveEffect,
  PassiveMask,
  Placement,
  Ref,
  Update,
  Visibility,
} from './fiberFlags';
import {
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
  OffscreenComponent,
} from './workTags';
import { Effect, FCUpdateQueue } from './fiberHooks';
import { HookHasEffect } from './hookEffectTags';

let nextEffect: FiberNode | null;

export const commitEffects = (
  phrase: 'mutation' | 'layout',
  mask: Flags,
  callback: (fiber: FiberNode, root: FiberRootNode) => void
) => {
  return (finishedWork: FiberNode, root: FiberRootNode) => {
    nextEffect = finishedWork;

    while (nextEffect !== null) {
      // 向下遍历
      const child: FiberNode | null = nextEffect.child;
      // 子节点 subTreeFlags不存在或者子节点不存在 不需要进行更新操作
      if ((nextEffect.subTreeFlags & mask) !== NoFlags && child !== null) {
        nextEffect = child;
      } else {
        // 向上遍历
        up: while (nextEffect !== null) {
          callback(nextEffect, root);
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
};

const commitMutationEffectsOnFiber = (
  finishedWork: FiberNode,
  root: FiberRootNode
) => {
  // flags Placement
  const { flags, tag } = finishedWork;
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
        commitDeletion(childToDelete, root);
      });
    }
    finishedWork.flags &= ~ChildDeletion;
  }

  // fiber PassiveEffect
  if ((flags & PassiveEffect) !== NoFlags) {
    // 收集回调
    commitPassiveEffect(finishedWork, root, 'update');
    finishedWork.flags &= ~PassiveEffect;
  }

  // fiber Ref
  if ((flags & Ref) !== NoFlags && tag === HostComponent) {
    // 解绑Ref
    safelyDetachRef(finishedWork);
  }

  // fiber Visibility
  if ((flags & Visibility) !== NoFlags && tag === OffscreenComponent) {
    const isHidden = finishedWork.pendingProps.mode === 'hidden';
    hiddenOrUnhiddenAllChildren(finishedWork, isHidden);
    finishedWork.flags &= ~Visibility;
  }
};

function hiddenOrUnhiddenAllChildren(
  finishedWork: FiberNode,
  isHidden: boolean
) {
  findHostSubtreeRoot(finishedWork, (hostRoot) => {
    const instance = hostRoot.stateNode;
    if (hostRoot.tag === HostComponent) {
      isHidden ? hiddenInstance(instance) : unhiddenInstance(instance);
    } else if (hostRoot.tag === HostText) {
      isHidden
        ? hiddenTextInstance(instance)
        : unhiddenTextInstance(instance, hostRoot.memoizedProps.content);
    }
  });
}

function findHostSubtreeRoot(
  finishedWork: FiberNode,
  callback: (hostSubtreeRoot: FiberNode) => void
) {
  let node = finishedWork;
  let hostSubtreeRoot: FiberNode | null = null;

  while (true) {
    if (node.tag === HostComponent) {
      if (hostSubtreeRoot === null) {
        hostSubtreeRoot = node;
        callback(node);
      }
    } else if (node.tag === HostText) {
      if (hostSubtreeRoot === null) {
        callback(node);
      }
    } else if (
      node.tag === OffscreenComponent &&
      node.pendingProps.mode === 'hidden' &&
      node !== finishedWork
    ) {
      // OffscreenComponent 嵌套
    } else if (node.child !== null) {
      node.child.return = node;
      node = node.child;
      continue;
    }

    if (node === finishedWork) {
      return;
    }

    while (node.sibling === null) {
      if (node.return === null || node.return === finishedWork) {
        return;
      }
      // 切换到父节点置空
      if (hostSubtreeRoot === node) {
        hostSubtreeRoot = null;
      }
      node = node.return;
    }
    // 切换到兄弟节点置空
    if (hostSubtreeRoot === node) {
      hostSubtreeRoot = null;
    }
    node.sibling.return = node;
    node = node.sibling;
  }
}

function safelyDetachRef(current: FiberNode) {
  const ref = current.ref;
  if (ref !== null) {
    if (typeof ref === 'function') {
      ref(null);
    } else {
      ref.current = null;
    }
  }
}

const commitLayoutEffectsOnFiber = (
  finishedWork: FiberNode,
  root: FiberRootNode
) => {
  // flags Ref
  const { flags, tag } = finishedWork;
  if ((flags & Ref) !== NoFlags && tag === HostComponent) {
    // 新的Ref
    safelyAttachRef(finishedWork);
    finishedWork.flags &= ~Ref;
  }
};

function safelyAttachRef(fiber: FiberNode) {
  const ref = fiber.ref;
  if (ref !== null) {
    const instance = fiber.stateNode;
    // 函数类型
    if (typeof ref === 'function') {
      ref(instance);
    } else {
      // 对象类型
      ref.current = instance;
    }
  }
}

export const commitMutationEffects = commitEffects(
  'mutation',
  MutationMask | PassiveMask,
  commitMutationEffectsOnFiber
);

export const commitLayoutEffects = commitEffects(
  'layout',
  LayoutMask,
  commitLayoutEffectsOnFiber
);

function commitPassiveEffect(
  fiber: FiberNode,
  root: FiberRootNode,
  type: keyof PendingPassiveEffect
) {
  if (
    fiber.tag !== FunctionComponent ||
    (type === 'update' && (fiber.flags & PassiveEffect) === NoFlags)
  ) {
    return;
  }
  const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;
  if (updateQueue !== null) {
    if (updateQueue.lastEffect === null && __DEV__) {
      console.warn('当FC组件存在useEffect时，updateQueue.lastEffect不能为null');
    }
    root.pendingPassiveEffect[type].push(updateQueue.lastEffect!);
  }
}

function commitHookEffectList(
  flags: Flags,
  lastEffect: Effect,
  callback: (effect: Effect) => void
) {
  let effect = lastEffect.next as Effect;
  do {
    if ((effect.tag & flags) === flags) {
      callback(effect);
    }
    effect = effect.next as Effect;
  } while (effect !== lastEffect.next);
}

export function commitHookEffectListUnmount(flags: Flags, lastEffect: Effect) {
  commitHookEffectList(flags, lastEffect, (effect) => {
    const destroy = effect.destroy;
    if (typeof destroy === 'function') {
      destroy();
    }
    effect.tag &= ~HookHasEffect;
  });
}

export function commitHookEffectListDestroy(flags: Flags, lastEffect: Effect) {
  commitHookEffectList(flags, lastEffect, (effect) => {
    const destroy = effect.destroy;
    if (typeof destroy === 'function') {
      destroy();
    }
  });
}

export function commitHookEffectListCreate(flags: Flags, lastEffect: Effect) {
  commitHookEffectList(flags, lastEffect, (effect) => {
    const create = effect.create;
    if (typeof create === 'function') {
      effect.destroy = create();
    }
  });
}

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

function commitDeletion(childToDelete: FiberNode, root: FiberRootNode) {
  const rootChildrenToDelete: FiberNode[] = [];

  // 递归子树
  commitNestedComponent(childToDelete, (unmountFiber) => {
    switch (unmountFiber.tag) {
      case HostComponent:
        recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
        // 解绑ref
        safelyDetachRef(unmountFiber);
        return;
      case HostText:
        recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
        return;
      case FunctionComponent:
        commitPassiveEffect(unmountFiber, root, 'unmount');
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
