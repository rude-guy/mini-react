import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  const [isDel, del] = useState(false);
  const divRef = useRef(null);

  console.log('render divRef', divRef.current);

  useEffect(() => {
    console.log('useEffect divRef', divRef.current);
  }, []);

  return (
    <div ref={divRef} onClick={() => del(true)}>
      {isDel ? null : <Child />}
    </div>
  );
}

function Child() {
  return <p ref={(dom) => console.log('dom is:', dom)}>Child</p>;
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <App />
);

function Cpn() {}

function a() {
  const ctx = { Provider: <p></p> };

  return (
    <>
      <ctx.Provider value={1}>
        <Cpn />
        <ctx.Provider value={2}>
          <Cpn />
          <ctx.Provider value={3}>
            <Cpn />
          </ctx.Provider>
        </ctx.Provider>
      </ctx.Provider>
    </>
  );
}
