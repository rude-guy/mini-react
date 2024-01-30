import ReactDOM from 'react-dom';
import { ReactElementType } from 'shared/ReactTypes';

export function renderIntoDocument(element: ReactElementType) {
  const div = document.createElement('div');

  return ReactDOM.createRoot(div).render(element);
}
