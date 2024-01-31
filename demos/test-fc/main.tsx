import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

const App = () => {
  const [num, setNum] = useState(100);
  return <div onClick={() => setNum((n) => n + 1)}>{num}</div>;
};

const Child = () => {
  return <span>word</span>;
};

const root = document.querySelector('#root')!;

ReactDOM.createRoot(root).render(<App />);
