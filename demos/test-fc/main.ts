import './style.css';
const button = document.querySelector('button');
const root = document.querySelector('#root');

interface Work {
  count: number;
}

const workList: Work[] = [];

function scheduler() {
  const curWork = workList.pop();
  if (curWork) {
    perform(curWork);
  }
}

function perform(work: Work) {
  while (work.count) {
    // 执行任务
    work.count--;
    insertSpan('0');
  }
  scheduler();
}

function insertSpan(content: string) {
  const span = document.createElement('span');
  span.innerText = content;
  root?.appendChild(span);
}

button &&
  (button.onclick = () => {
    workList.unshift({ count: 100 });
    scheduler();
  });
