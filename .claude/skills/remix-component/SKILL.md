---
name: remix-component
description: usage of @remix-run/component
---

# @remix-run/component Reference

## Package Info

- **Package**: `@remix-run/component`
- **Repository**:
  https://github.com/remix-run/remix/tree/main/packages/component
- **Version**: v0.4.0
- **License**: MIT

## Core Concepts

- Manual update model: `handle.update()` triggers re-render
- State = plain JavaScript variables (no hooks)
- Real DOM events via `@remix-run/interaction`
- Two-phase component structure: Setup → Render

## Type Signatures

### Component

```typescript
type Component<Context = NoContext, Setup = undefined, Props = ElementProps> = (
  handle: Handle<Context>,
  setup: Setup,
) => (props: Props) => RemixNode;

type NoContext = Record<string, never>;
type RemixNode = Renderable | RemixNode[];
type Renderable =
  | RemixElement
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined;
```

### Handle

```typescript
interface Handle<C = Record<string, never>> {
  id: string;
  update(task?: Task): void;
  queueTask(task: Task): void;
  signal: AbortSignal;
  context: Context<C>;
  frame: FrameHandle;
  on<T extends EventTarget>(target: T, listeners: EventListeners<T>): void;
}

type Task = (signal: AbortSignal) => void;

interface Context<C> {
  set(values: C): void;
  get<ComponentType>(component: ComponentType): ContextFrom<ComponentType>;
}
```

### Props Types

````typescript
type Props<T extends keyof JSX.IntrinsicElements> = JSX.IntrinsicElements[T]

interface HostProps<eventTarget extends EventTarget> {
  key?: any
  children?: RemixNode
  on?: EventListeners<eventTarget>
  connect?: (node: eventTarget, signal: AbortSignal) => void
  css?: StyleProps | string
  animate?: AnimateProp
  className?: string
  // ... standard HTML/SVG/MathML attributes
}

## API Methods

### `handle.update(task?: Task)`
Triggers component re-render.

```tsx
function Counter(handle: Handle) {
  let count = 0
  return () => (
    <button on={{ click: () => { count++; handle.update() } }}>
      {count}
    </button>
  )
}
````

### `handle.queueTask(task: Task)`

Queues task after next render (for DOM operations).

```tsx
handle.queueTask(() => element.scrollIntoView());
```

### `handle.signal: AbortSignal`

Aborted when component disconnects.

```tsx
function Clock(handle: Handle) {
  let interval = setInterval(() => {
    if (handle.signal.aborted) {
      clearInterval(interval);
      return;
    }
    handle.update();
  }, 1000);
  return () => <span>{new Date().toLocaleTimeString()}</span>;
}
```

### `handle.context`

Ancestor/descendant communication.

```tsx
// Provider
function App(handle: Handle<{ theme: string }>) {
  handle.context.set({ theme: "dark" });
  return () => (
    <div>
      <Header />
    </div>
  );
}

// Consumer
function Header(handle: Handle) {
  let { theme } = handle.context.get(App);
  return () => (
    <header css={{ backgroundColor: theme === "dark" ? "#000" : "#fff" }} />
  );
}
```

### `handle.id: string`

Unique ID for component instance.

```tsx
<label htmlFor={handle.id}>Name</label>
<input id={handle.id} />
```

### `handle.on<T>(target: T, listeners: EventListeners<T>)`

Register global event listeners (cleaned up on disconnect).

```tsx
handle.on(window, { keydown: (e) => {/* ... */} });
```

## Special Props

### `css`

Inline styles with pseudo-selectors, nested rules, media queries.

```tsx
css={{
  color: 'white',
  backgroundColor: 'blue',
  '&:hover': { backgroundColor: 'darkblue' },
  '&::before': { content: '""' },
  '&[aria-selected="true"]': { border: '2px solid yellow' },
  '.icon': { width: '16px' },
  '@media (max-width: 768px)': { padding: '8px' },
}}
```

### `connect`

Direct DOM node access on mount/unmount.

```tsx
connect={(node: HTMLElement, signal: AbortSignal) => {
  // node is DOM element
  signal.addEventListener('abort', () => { /* cleanup */ })
}}
```

### `on`

Type-safe event listeners.

```tsx
on={{
  input: (event) => { /* event.currentTarget is typed */ },
  click: (event) => { /* ... */ },
}}
```

### `animate`

Enter/exit/layout animations.

```tsx
animate={{
  enter: { opacity: 0, duration: 200 },
  exit: { opacity: 0, duration: 150 },
  layout: true,
}}
```

## Component Patterns

### Setup vs Props

```tsx
function Counter(handle: Handle, setup: number) {
  // setup: passed once on creation
  let count = setup;

  // props: passed on every render
  return (props: { label: string }) => (
    <button
      on={{
        click: () => {
          count++;
          handle.update();
        },
      }}
    >
      {props.label} {count}
    </button>
  );
}

// Usage
<Counter setup={10} label="Count" />;
```

### Basic Component

```tsx
function Component(handle: Handle) {
  // Setup phase: runs once
  let state = 0;

  // Render phase: returns render function
  return () => <div>{state}</div>;
}
```

### Component with Context

```tsx
function Component(handle: Handle<{ value: string }>) {
  handle.context.set({ value: "data" });
  return () => <div />;
}
```

## Root Creation

```tsx
import { createRangeRoot, createRoot } from "@remix-run/component";

// Standard root
createRoot(document.body).render(<App />);

// Range-based root
createRangeRoot(range).render(<App />);
```

## Server-Side Rendering

```tsx
import { renderToString } from "@remix-run/component/server";

let html = await renderToString(<App />);
```

## Fragment

```tsx
<>
  <li>Item 1</li>
  <li>Item 2</li>
</>;
```

## アーキテクチャ詳細

### コアモジュール

#### `component.ts`

- `Handle` インターフェース
- `createComponent`: コンポーネントインスタンスの作成
- `Fragment`, `Frame`: 組み込みコンポーネント
- コンテキスト管理

###Package Exports

```typescript
import { createRoot, Fragment, Handle } from "@remix-run/component";
import { jsx, jsxDEV, jsxs } from "@remix-run/component/jsx-runtime";
import { renderToString } from "@remix-run/component/server";
```

## Key Differences from React

| Feature   | Remix Component          | React               |
| --------- | ------------------------ | ------------------- |
| State     | Plain variables          | useState hook       |
| Updates   | Manual `handle.update()` | Automatic           |
| Lifecycle | Setup/Render phases      | Hooks               |
| Events    | Real DOM events          | Synthetic events    |
| CSS       | `css` prop               | className/CSS-in-JS |

## Common Patterns

### State Management

```tsx
// ✅ Derive computed values
function TodoList(handle: Handle) {
  let todos: Array<{ text: string; completed: boolean }> = [];
  return () => {
    let completedCount = todos.filter((t) => t.completed).length;
    return <div>Completed: {completedCount}</div>;
  };
}

// ❌ Don't store derived state
function TodoList(handle: Handle) {
  let todos: string[] = [];
  let completedCount = 0; // Unnecessary
  return () => <div>Completed: {completedCount}</div>;
}
```

### Cleanup with connect

```tsx
connect={(node, signal) => {
  let observer = new ResizeObserver(() => handle.update())
  observer.observe(node)
  signal.addEventListener('abort', () => observer.disconnect())
}}
```

### Global Events

```tsx
function KeyboardTracker(handle: Handle) {
  let lastKey = "";
  handle.on(window, {
    keydown: (event) => {
      lastKey = event.key;
      handle.update();
    },
  });
  return () => <div>Last key: {lastKey}</div>;
}
```

### Controlled Inputs

```tsx
function SearchInput(handle: Handle) {
  let query = "";
  return () => (
    <input
      type="text"
      value={query}
      on={{
        input: (e) => {
          query = e.currentTarget.value;
          handle.update();
        },
      }}
    />
  );
}
```

### Post-Render Tasks

```tsx
function Form(handle: Handle) {
  let showDetails = false;
  let section: HTMLElement;
  return () => (
    <form>
      <input
        type="checkbox"
        on={{
          change: (e) => {
            showDetails = e.currentTarget.checked;
            handle.update();
            if (showDetails) {
              handle.queueTask(() => section.scrollIntoView());
            }
          },
        }}
      />
      {showDetails && <section connect={(node) => (section = node)} />}
    </form>
  );
}
```

## Important Constraints

- No hooks system (useState, useEffect, etc.)
- Must call `handle.update()` to trigger re-render
- State persists in closure between renders
- Setup phase runs once, render function runs on each update
- `connect` callback receives AbortSignal for cleanup
- `handle.signal` aborts when component unmounts
- Context flows from ancestor to descendants only
- Component identity determined by position in tree + key prop
