import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-noop-renderer';

function App() {
  return (
    <>
      <Child />
      <div>Hello word</div>
    </>
  );
}

function Child() {
  return 'Child';
}

const root = ReactDOM.createRoot();

root.render(<App />);

window.root = root;
