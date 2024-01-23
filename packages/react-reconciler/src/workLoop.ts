import { beginWork } from './beginWork';
import { completeWork } from './completeWork';
import { FiberNode } from './fiber';

let workInProgress: FiberNode | null = null;

function prepareFreshStack(root: FiberNode) {
  workInProgress = root;
}

function renderRoot(root: FiberNode) {
  // 初始化
  prepareFreshStack(root);

  do {
    try {
      workLoop();
      break;
    } catch (e) {
      console.warn('workLoop发生错误中断', e);
      workInProgress = null;
    }
  } while (true);
}

function workLoop() {
  while (workInProgress !== null) {
    // 执行工作
    performUnitOfWork(workInProgress);
  }
}

// 执行工作单元 -> 递
function performUnitOfWork(fiber: FiberNode) {
  const next = beginWork(fiber);
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
