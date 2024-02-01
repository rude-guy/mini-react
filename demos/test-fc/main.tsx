import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

const App = () => {
  const [num, setNum] = useState(100);

  const arr =
    num % 2 === 0
      ? [<li key={'1'}>1</li>, <li key={'2'}>2</li>, <li key={'3'}>3</li>]
      : [<li key={'3'}>3</li>, <li key={'2'}>2</li>, <li key={'1'}>1</li>];

  return <div onClick={() => setNum((n) => n + 1)}>{arr}</div>;
};

const Child = () => {
  return <span>word</span>;
};

const root = document.querySelector('#root')!;

ReactDOM.createRoot(root).render(<App />);
