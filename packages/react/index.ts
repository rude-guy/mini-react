import { jsxDEV, jsx, isValidElement as isValidElementFn } from './src/jsx';
import currentDispatcher, {
  Dispatcher,
  resolveDispatcher,
} from './src/currentDispatcher';
import currentBatchConfig from './src/currentBatchConfig';
export { createContext } from './src/context';
export {
  REACT_FRAGMENT_TYPE as Fragment,
  REACT_SUSPENSE_TYPE as Suspense,
} from 'shared/ReactSymbols';
export { memo } from './src/memo';

export const useState: Dispatcher['useState'] = (initialState) => {
  const dispatcher = resolveDispatcher();
  return dispatcher.useState(initialState);
};

export const useEffect: Dispatcher['useEffect'] = (create, deps) => {
  const dispatcher = resolveDispatcher();
  return dispatcher.useEffect(create, deps);
};

export const useRef: Dispatcher['useRef'] = (initialVal) => {
  const dispatcher = resolveDispatcher();
  return dispatcher.useRef(initialVal);
};

export const useTransition: Dispatcher['useTransition'] = () => {
  const dispatch = resolveDispatcher();
  return dispatch.useTransition();
};

export const useContext: Dispatcher['useContext'] = (context) => {
  const dispatch = resolveDispatcher();
  return dispatch.useContext(context);
};

export const use: Dispatcher['use'] = (useable) => {
  const dispatch = resolveDispatcher();
  return dispatch.use(useable);
};

// 内部数据共享层
export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
  currentDispatcher,
  currentBatchConfig,
};

export const version = '0.0.0';

// TODO: 根据环境区分 jsx/jsxDEV
export const createElement = jsx;

export const isValidElement = isValidElementFn;
