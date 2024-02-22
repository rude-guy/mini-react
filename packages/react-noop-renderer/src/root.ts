import {
  createContainer,
  updateContainer,
} from 'react-reconciler/src/fiberReconciler';
import { ReactElementType } from 'shared/ReactTypes';
import { Container, Instance } from './hostConfig';
import { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE } from 'shared/ReactSymbols';

let idCounter = 0;

export function createRoot() {
  const container: Container = {
    rootID: idCounter++,
    children: [],
  };

  // @ts-ignore
  const root = createContainer(container);

  function getChildren(parent: Container | Instance) {
    if (parent) {
      return parent.children;
    }
    return null;
  }

  function getChildrenAsJsx(root: Container) {
    const children = childToJsx(root.children);
    if (Array.isArray(children)) {
      return {
        $$typeof: REACT_FRAGMENT_TYPE,
        type: REACT_FRAGMENT_TYPE,
        key: null,
        ref: null,
        props: { children },
        __mark_ref: 'mark',
      };
    }
    return children;
  }

  function childToJsx(child: any) {
    if (typeof child === 'string' || typeof child === 'number') {
      return child;
    }

    if (Array.isArray(child)) {
      if (child.length === 0) {
        return null;
      }
      if (child.length === 1) {
        return childToJsx(child[0]);
      }
      const children = child.map(childToJsx);
      if (
        children.every(
          (child) => typeof child === 'string' || typeof child === 'number'
        )
      ) {
        return children.join('');
      }
      return children;
    }

    // Instance
    if (Array.isArray(child.children)) {
      const instance: Instance = child;
      const children = childToJsx(instance.children);
      const props = instance.props;

      if (children !== null) {
        props.children = children;
      }

      return {
        $$typeof: REACT_ELEMENT_TYPE,
        type: instance.type,
        key: null,
        ref: null,
        props,
        __mark_ref: 'mark',
      };
    }

    // textInstance
    return child.text;
  }

  return {
    render(element: ReactElementType) {
      return updateContainer(element, root);
    },
    getChildren() {
      return getChildren(container);
    },
    getChildrenAsJsx() {
      return getChildrenAsJsx(container);
    },
  };
}
