import { FiberNode } from './fiber';

const suspenseHandlerStack: FiberNode[] = [];

export const getSuspenseHandler = () => {
  return suspenseHandlerStack[suspenseHandlerStack.length - 1];
};

export const pushSuspenseHandler = (fiber: FiberNode) => {
  suspenseHandlerStack.push(fiber);
};

export const popSuspenseHandler = () => {
  suspenseHandlerStack.pop();
};
