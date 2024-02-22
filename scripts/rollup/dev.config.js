import reactConfig from './react.config.js';
import reactDomConfig from './react-dom.config.js';
import reactNoopRendererConfig from './react-noop-renderer.config.js';

export default () => {
  return [...reactConfig, ...reactDomConfig, ...reactNoopRendererConfig];
};
