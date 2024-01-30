import { Props, ReactElementType } from 'shared/ReactTypes';
import {
  FiberNode,
  createFiberFormElement,
  createWorkInProgress,
} from './fiber';
import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import { HostText } from './workTags';
import { ChildDeletion, Placement } from './fiberFlags';

function ChildReconciler(shouldTrackEffect: boolean) {
  function deleteChild(returnFiber: FiberNode, childToDelete: FiberNode) {
    if (!shouldTrackEffect) {
      return;
    }
    const deletions = returnFiber.deletions;
    if (deletions === null) {
      returnFiber.deletions = [childToDelete];
      returnFiber.flags |= ChildDeletion;
    } else {
      deletions.push(childToDelete);
    }
  }
  // 创建子fiber
  function reconcileSingleElement(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    element: ReactElementType
  ) {
    const key = element.key;

    work: if (currentFiber !== null) {
      // update
      if (currentFiber.key === key) {
        // key相同
        if (element.$$typeof === REACT_ELEMENT_TYPE) {
          if (element.type === currentFiber.type) {
            // type 相同
            const existing = useFiber(currentFiber, element.props);
            existing.return = returnFiber;
            return existing;
          }
          deleteChild(returnFiber, currentFiber);
          break work;
        } else {
          if (__DEV__) {
            console.warn('未实现的ReactElement类型', element);
            break work;
          }
        }
      } else {
        // 删除子节点
        deleteChild(returnFiber, currentFiber);
      }
    }

    const fiber = createFiberFormElement(element);
    fiber.return = returnFiber;
    return fiber;
  }

  // 创建文本子fiber
  function reconcileSingleTextNode(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    content: string | number
  ) {
    if (currentFiber !== null) {
      // update
      if (currentFiber.tag === HostText) {
        const existing = useFiber(currentFiber, { content });
        existing.return = returnFiber;
        return existing;
      }
      deleteChild(returnFiber, currentFiber);
    }
    const fiber = new FiberNode(HostText, { content }, null);
    fiber.return = returnFiber;
    return fiber;
  }

  // 插入节点操作
  function placeSingleChild(fiber: FiberNode) {
    if (shouldTrackEffect && fiber.alternate === null) {
      fiber.flags |= Placement;
    }
    return fiber;
  }

  return function reconcileChildFibers(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    newChild?: ReactElementType
  ) {
    // 判断当前的 fiber 类型
    if (typeof newChild === 'object' && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE:
          return placeSingleChild(
            reconcileSingleElement(returnFiber, currentFiber, newChild)
          );
        default:
          if (__DEV__) {
            console.warn('未实现的 reconcile 类型', newChild);
          }
          break;
      }
    }

    // TODO: 多节点情况

    // HostText
    if (typeof newChild === 'string' || typeof newChild === 'number') {
      return placeSingleChild(
        reconcileSingleTextNode(returnFiber, currentFiber, newChild)
      );
    }

    // 兜底删除
    if (currentFiber !== null) {
      deleteChild(returnFiber, currentFiber);
    }

    if (__DEV__) {
      console.warn('未实现的 reconcile 类型', newChild);
    }

    return null;
  };
}

function useFiber(fiber: FiberNode, pendingProps: Props): FiberNode {
  const clone = createWorkInProgress(fiber, pendingProps);
  clone.index = 0;
  clone.sibling = null;
  return clone;
}

// 追踪副作用 update
export const reconcileChildFibers = ChildReconciler(true);

// 不追踪副作用 mount
export const mountChildFibers = ChildReconciler(false);
