import { Action, ReactContext, Useable } from 'shared/ReactTypes';

export interface Dispatcher {
  useState: <T>(initialState: () => T | T) => [T, Dispatch<T>];
  useEffect: (callback: () => void | void, deps: any[]) => void;
  useRef: <T>(initialVal: T) => { current: T };
  useTransition: () => [boolean, (callback: () => void) => void];
  useContext: <T>(context: ReactContext<T>) => T;
  use: <T>(useable: Useable<T>) => T;
}

export type Dispatch<State> = (action: Action<State>) => void;

const currentDispatcher: { current: Dispatcher | null } = {
  current: null,
};

export const resolveDispatcher = (): Dispatcher => {
  const dispatcher = currentDispatcher.current;
  if (dispatcher === null) {
    throw new Error('hooks 只能在 react 函数组件中调用');
  }
  return dispatcher;
};

export default currentDispatcher;
