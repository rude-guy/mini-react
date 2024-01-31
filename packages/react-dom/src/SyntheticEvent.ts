import { Container } from 'hostConfig';
import { Props } from 'shared/ReactTypes';

export const elementPropsKey = '__props';
const validEventTypeList = ['click'];

type EventCallback = (e: Event) => void;

interface SyntheticEvent extends Event {
  __stopPropagation: boolean;
}

interface Paths {
  capture: EventCallback[];
  bubble: EventCallback[];
}

export interface DOMElement extends Element {
  [elementPropsKey]: Props;
}

export function updateFiberProps(node: DOMElement, props: Props) {
  node[elementPropsKey] = props;
}

export function initEvent(container: Container, eventType: string) {
  if (!validEventTypeList.includes(eventType)) {
    console.warn('当前不支持', eventType, '事件');
    return;
  }
  if (__DEV__) {
    console.log('初始化事件', eventType);
  }
  container.addEventListener(eventType, (e) => {
    dispatchEvent(container, eventType, e);
  });
}

function createSyntheticEvent(e: Event) {
  const syntheticEvent = e as SyntheticEvent;
  syntheticEvent.__stopPropagation = false;
  const originalStopPropagation = e.stopPropagation;

  syntheticEvent.stopPropagation = () => {
    syntheticEvent.__stopPropagation = true;
    if (originalStopPropagation) {
      originalStopPropagation();
    }
  };
  return syntheticEvent;
}

function dispatchEvent(container: Container, eventType: string, e: Event) {
  const targetElement = e.target;

  if (targetElement === null) {
    console.warn('事件不存在target', e);
    return;
  }
  // 1. 收集沿途的事件
  const { capture, bubble } = collectPaths(
    targetElement as DOMElement,
    container,
    eventType
  );
  // 2. 构造合成事件
  const se = createSyntheticEvent(e);
  // 3. 遍历 capture
  triggerEventFlow(capture, se);

  if (!se.__stopPropagation) {
    // 4. 遍历 bubble
    triggerEventFlow(bubble, se);
  }
}

function triggerEventFlow(paths: EventCallback[], se: SyntheticEvent) {
  for (const eventCallback of paths) {
    eventCallback.call(null, se);

    // 阻止事件传播
    if (se.__stopPropagation) {
      break;
    }
  }
}

function getEventCallbackNameFormEventType(
  eventType: string
): string[] | undefined {
  return {
    click: ['onClickCapture', 'onClick'],
  }[eventType];
}

function collectPaths(
  targetElement: DOMElement,
  container: Container,
  eventType: string
) {
  const paths: Paths = {
    capture: [],
    bubble: [],
  };

  while (targetElement && targetElement !== container) {
    const props = targetElement[elementPropsKey];
    if (props) {
      const callbackNameList = getEventCallbackNameFormEventType(eventType);
      if (callbackNameList) {
        callbackNameList.forEach((callbackName, i) => {
          const eventCallback = props[callbackName];
          if (eventCallback) {
            if (i === 0) {
              // capture
              paths.capture.unshift(eventCallback);
            } else {
              paths.bubble.push(eventCallback);
            }
          } else {
            console.warn(`${callbackName} is not defined`);
            return;
          }
        });
      }
    }
    targetElement = targetElement.parentNode as DOMElement;
  }

  return paths;
}