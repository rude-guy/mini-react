import { Key, Props } from 'share/ReactTypes';
import { WorkTag } from './workTags';
import { Flags, NoFlags } from './fiberFlags';

export class FiberNode {
  type: any;
  tag: WorkTag;
  key: Key;
  stateNode: any;
  ref: any;

  return: FiberNode | null;
  sibling: FiberNode | null;
  child: FiberNode | null;
  index: number;

  pendingProps: Props;
  memoizedProps: Props | null;
  alternate: FiberNode | null;

  flags: Flags;

  constructor(tag: WorkTag, pendingProps: Props, key: Key) {
    // 实例
    this.tag = tag;
    this.key = key;
    this.stateNode = null;
    this.type = null;

    // 构成树状结构
    this.return = null;
    this.sibling = null;
    this.child = null;
    this.index = 0;

    this.ref = null;

    // 作为工作单元
    this.pendingProps = pendingProps;
    this.memoizedProps = null;

    this.alternate = null;
    // 副作用
    this.flags = NoFlags;
  }
}
