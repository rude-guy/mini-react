import React, { useState, useTransition } from 'react';
import ReactDOM from 'react-dom/client';
import TabButton from './tabButton';
import AboutTab from './aboutTab';
import PostsTab from './postsTab';
import ContactTab from './contactTab';

function App() {
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState('about');
  console.log('tab:', tab);

  function selectTab(nextTab) {
    startTransition(() => {
      setTab(nextTab);
    });
  }

  return (
    <>
      <TabButton isActive={tab === 'about'} onClick={() => selectTab('about')}>
        About
      </TabButton>
      <TabButton isActive={tab === 'posts'} onClick={() => selectTab('posts')}>
        Posts (slow)
      </TabButton>
      <TabButton
        isActive={tab === 'contact'}
        onClick={() => selectTab('contact')}
      >
        Contact
      </TabButton>
      <hr />
      {tab === 'about' && <AboutTab />}
      {tab === 'posts' && <PostsTab />}
      {tab === 'contact' && <ContactTab />}
    </>
  );
}

const root = ReactDOM.createRoot(document.querySelector('#root')!);

root.render(<App />);
