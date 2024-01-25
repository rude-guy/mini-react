import { REACT_ELEMENT_SYMBOL } from 'shared/ReactSymbols';
import {
  ReactElementType,
  ElementType,
  Key,
  Ref,
  Props,
} from 'shared/ReactTypes';

export const ReactElement = function (
  type: ElementType,
  key: Key,
  ref: Ref,
  props: Props
): ReactElementType {
  const element = {
    $$typeof: REACT_ELEMENT_SYMBOL,
    type,
    key,
    ref,
    props,
    __mark_ref: 'mark',
  };
  return element;
};

export const jsx = function (
  type: ElementType,
  config: any,
  ...maybeChildren: any
) {
  const props: Props = {};
  let key: Key = null;
  let ref: Ref = null;
  for (const prop in config) {
    const val = config[prop];
    if (prop === 'key') {
      if (val !== undefined) {
        key = `${val}`;
      }
      continue;
    }
    if (prop === 'ref') {
      if (val !== undefined) {
        ref = val;
      }
    }
    if (Object.hasOwn(config, prop)) {
      props[prop] = val;
    }
  }
  const maybeChildrenLength = maybeChildren.length;
  if (maybeChildrenLength) {
    if (maybeChildrenLength === 1) {
      props.children = maybeChildren[0];
    } else {
      props.children = maybeChildren;
    }
  }
  return ReactElement(type, key, ref, props);
};

export const jsxDEV = function (type: ElementType, config: any) {
  const props: Props = {};
  let key: Key = null;
  let ref: Ref = null;
  for (const prop in config) {
    const val = config[prop];
    if (prop === 'key') {
      if (val !== undefined) {
        key = `${val}`;
      }
      continue;
    }
    if (prop === 'ref') {
      if (val !== undefined) {
        ref = val;
      }
    }
    if (Object.hasOwn(config, prop)) {
      props[prop] = val;
    }
  }
  return ReactElement(type, key, ref, props);
};
