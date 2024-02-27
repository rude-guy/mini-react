export type Type = any;
export type Key = any;
export type Ref = { current: any } | ((instance: any) => void);
export type Props = any;
export type ElementType = any;

export interface ReactElementType {
  $$typeof: symbol | number;
  type: Type;
  key: Key;
  ref: Ref;
  props: Props;
  __mark_ref: string;
}

export type Action<State> = State | ((prevState: State) => State);

export type ReactContext<T> = {
  $$typeof: symbol | number;
  Provider: ReactProvider<T> | null;
  _currentValue: T;
};

export type ReactProvider<T> = {
  $$typeof: symbol | number;
  _context: ReactContext<T> | null;
};

export type Useable<T> = Thenable<T> | ReactContext<T>;

export interface Wakeable<Result> {
  then(
    onFulfilled: () => Result,
    onRejected: () => Result
  ): void | Wakeable<Result>;
}

export interface ThenableImpl<T, Result, Err> {
  then(
    onFulfilled: (value: T) => Result,
    onRejected: (err: Err) => Result
  ): void | Wakeable<T>;
}

export interface UntrackedThenable<T, Result, Err>
  extends ThenableImpl<T, Result, Err> {
  status: void;
}

export interface PendingThenable<T, Result, Err>
  extends ThenableImpl<T, Result, Err> {
  status: 'pending';
}

export interface FulfilledThenable<T, Result, Err>
  extends ThenableImpl<T, Result, Err> {
  status: 'fulfilled';
  value: T;
}

export interface RejectedThenable<T, Result, Err>
  extends ThenableImpl<T, Result, Err> {
  status: 'rejected';
  result: Err;
}

export type Thenable<T, Result = void, Err = any> =
  | UntrackedThenable<T, Result, T>
  | PendingThenable<T, Result, Err>
  | FulfilledThenable<T, Result, Err>
  | RejectedThenable<T, Result, Err>;
