import {
  unstable_ImmediatePriority as ImmediatePriority,
  unstable_UserBlockingPriority as UserBlockingPriority,
  unstable_NormalPriority as NormalPriority,
  unstable_LowPriority as LowPriority,
  unstable_IdlePriority as IdlePriority,
  unstable_scheduleCallback as scheduleCallback,
  unstable_shouldYield as shouldYield,
  CallbackNode,
  unstable_getFirstCallbackNode as getFirstCallbackNode,
  unstable_cancelCallback as cancelCallback,
} from 'scheduler';

import './style.css';
const root = document.querySelector('#root');

type Priority =
  | typeof ImmediatePriority
  | typeof UserBlockingPriority
  | typeof NormalPriority
  | typeof LowPriority
  | typeof IdlePriority;

interface Work {
  count: number;
  priority: Priority;
}

const workList: Work[] = [];
let prevPriority: Priority = IdlePriority;
let curCallback: CallbackNode | null = null;

[ImmediatePriority, UserBlockingPriority, NormalPriority, LowPriority].forEach(
  (priority) => {
    const btn = document.createElement('button');
    root?.appendChild(btn);
    btn.innerText = [
      '',
      'ImmediatePriority',
      'UserBlockingPriority',
      'NormalPriority',
      'LowPriority',
    ][priority];

    btn.onclick = () => {
      workList.unshift({
        count: 100,
        priority: priority as Priority,
      });
      scheduler();
    };
  }
);

function scheduler() {
  const cbNode = getFirstCallbackNode();
  const curWork = workList.sort((w1, w2) => w1.priority - w2.priority)[0];

  // 策略逻辑
  if (!curWork) {
    curCallback = null;
    cbNode && cancelCallback(cbNode);
    return;
  }

  const { priority: curPriority } = curWork;
  if (curPriority === prevPriority) {
    return;
  }

  // 更高优先级
  cbNode && cancelCallback(cbNode);

  curCallback = scheduleCallback(curPriority, perform.bind(null, curWork));
}

function perform(work: Work, didTimeout?: boolean) {
  /**
   * 1. work.priority
   * 2. 处理饥饿问题
   * 3. 时间切片
   */
  const needSync = work.priority === ImmediatePriority || didTimeout;
  while ((needSync || !shouldYield()) && work.count) {
    // 执行任务
    work.count--;
    insertSpan(work.priority + '');
  }

  // 中断执行 || 执行完
  prevPriority = work.priority;
  if (!work.count) {
    const workIndex = workList.indexOf(work);
    workList.splice(workIndex, 1);
    prevPriority = IdlePriority;
  }

  const prevCallback = curCallback;
  scheduler();
  const newCallback = curCallback;

  if (newCallback && prevCallback === newCallback) {
    return perform.bind(null, work);
  }
}

function insertSpan(content: string) {
  const span = document.createElement('span');
  span.innerText = content;
  doSomeBusyWork(10000000);
  root?.appendChild(span);
}

function doSomeBusyWork(len: number) {
  let result = 0;
  while (len--) {
    result += len;
  }
}
