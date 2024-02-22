import { FiberNode } from 'react-reconciler/src/fiber';
import { HostText } from 'react-reconciler/src/workTags';
import { Props } from 'shared/ReactTypes';

export interface Container {
  rootID: number;
  children: (Instance | TextInstance)[];
}

export interface Instance {
  id: number;
  type: string;
  children: (Instance | TextInstance)[];
  parent: number;
  props: Props;
}
export interface TextInstance {
  text: string;
  id: number;
  parent: number;
}

let insertCounter = 0;

export const createInstance = (type: string, props: Props): Instance => {
  const instance = {
    id: insertCounter++,
    type,
    children: [],
    parent: -1,
    props,
  };
  return instance;
};

export const appendInitialChild = (
  parent: Container | Instance,
  child: Instance
) => {
  const preParentId = child.parent;
  const parentId = 'rootID' in parent ? parent.rootID : parent.id;
  if (preParentId !== -1 && preParentId !== parentId) {
    throw Error('child already has parent');
  }
  child.parent = parentId;
  parent.children.push(child);
};

export const createTextInstance = (content: string) => {
  const textInstance = {
    text: content,
    id: insertCounter++,
    parent: -1,
  };
  return textInstance;
};

export const appendChildToContainer = (parent: Container, child: Instance) => {
  const preParentId = child.parent;
  if (preParentId !== -1 && preParentId !== parent.rootID) {
    throw Error('child already has parent');
  }
  child.parent = parent.rootID;
  parent.children.push(child);
};

export const commitUpdate = (fiber: FiberNode) => {
  switch (fiber.tag) {
    case HostText:
      const text = fiber.memoizedProps.content;
      return commitTextUpdate(fiber.stateNode, text);
    default:
      if (__DEV__) {
        console.warn('未实现的更新类型', fiber);
      }
      break;
  }
};

export function commitTextUpdate(textInstance: TextInstance, content: string) {
  textInstance.text = content;
}

export function removeChild(
  child: Instance | TextInstance,
  container: Container
) {
  const index = container.children.indexOf(child);
  if (index === -1) {
    throw Error('container not contain child');
  }
  container.children.splice(index, 1);
}

export function insertChildToContainer(
  child: Instance,
  container: Container,
  before: Instance
) {
  const beforeIndex = container.children.indexOf(before);
  if (beforeIndex === -1) {
    throw Error('before is not child of container');
  }
  const childIndex = container.children.indexOf(child);
  if (childIndex !== -1) {
    container.children.splice(childIndex, 1); // 删除已存在的子节点
  }
  container.children.splice(beforeIndex, 0, child);
}

export const scheduleMicroTask =
  typeof queueMicrotask === 'function'
    ? queueMicrotask
    : typeof Promise === 'function'
      ? (callback: (...args: any[]) => void) =>
          Promise.resolve(null).then(callback)
      : setTimeout;
