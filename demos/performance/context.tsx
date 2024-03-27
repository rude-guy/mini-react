import React, {
  useState,
  useContext,
  createContext,
  memo,
  useMemo,
} from 'react';

const ctx = createContext({ fn: () => {} });

export default function App() {
  const [num, update] = useState(1);
  const context = useMemo(() => ({ fn: () => console.log('fn') }), []);
  return (
    <ctx.Provider value={context}>
      <div
        onClick={() => {
          update((v) => v + 1);
        }}
      >
        {num}
        <Cpn />
      </div>
    </ctx.Provider>
  );
}

const Cpn = memo(function () {
  console.log('Cpn render');
  return (
    <div>
      <Child />
    </div>
  );
});

function Child() {
  console.log('Child render');
  const context = useContext(ctx);

  return <div>ctx: {context.num}</div>;
}
