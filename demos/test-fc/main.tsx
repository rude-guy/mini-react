import React from 'react';
import ReactDOM from 'react-dom/client';

const App = () => {
  return (
    <div>
      <Child />
    </div>
  );
};

const Child = () => {
  return <span>word</span>;
};

const root = document.querySelector('#root')!;

ReactDOM.createRoot(root).render(<App />);
