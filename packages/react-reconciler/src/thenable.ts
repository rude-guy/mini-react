import {
  FulfilledThenable,
  PendingThenable,
  RejectedThenable,
  Thenable,
} from 'shared/ReactTypes';

export const SuspenseException = new Error(
  '这不是个真实的错误，而是Suspense工作的一部分。如果你捕获到这个错误，请将它继续抛出去'
);

let suspendedThenable: Thenable<any> | null = null;

export function getSuspendedThenable() {
  if (suspendedThenable === null) {
    throw new Error('应该存在suspendedThenable，这是个bug');
  }
  const thenable = suspendedThenable;
  suspendedThenable = null;
  return thenable;
}

function noop() {}

export function trackUsedThenable<T>(thenable: Thenable<T>) {
  switch (thenable.status) {
    case 'fulfilled':
      return thenable.value;
    case 'rejected':
      throw new Error(thenable.result);
    default:
      // 包装 Promise
      if (typeof thenable.status === 'string') {
        thenable.then(noop, noop);
      } else {
        // untracked 状态
        // pending
        const pending = thenable as unknown as PendingThenable<T, void, any>;
        pending.status = 'pending';
        pending.then(
          (val) => {
            if (pending.status === 'pending') {
              // @ts-ignore
              const fulfilled: FulfilledThenable<T, void, any> = pending;
              fulfilled.status = 'fulfilled';
              fulfilled.value = val;
            }
          },
          (err) => {
            if (pending.status === 'pending') {
              // @ts-ignore
              const rejected: RejectedThenable<T, void, any> = pending;
              rejected.status = 'rejected';
              rejected.result = err;
            }
          }
        );
      }
      break;
  }

  suspendedThenable = thenable;

  throw SuspenseException;
}
