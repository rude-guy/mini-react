import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  const [num, setNum] = useState(100);
  console.log('hello');

  function selectValue() {
    setNum(num + 1);
    setNum(num + 1);
    console.log('num:', num);
    setNum((num) => num + 1);
    setNum((num) => num + 1);
    console.log('num:', num);
  }

  return <div onClick={selectValue}>{num}</div>;
}

const root = ReactDOM.createRoot(document.querySelector('#root')!);

root.render(<App />);
