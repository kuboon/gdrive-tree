---
name: remix-interaction
description: usage of @remix-run/interaction
---

# @remix-run/interaction Reference

## Package Info

- **Package**: `@remix-run/interaction`
- **Repository**:
  https://github.com/remix-run/remix/tree/main/packages/interaction
- **Version**: v0.5.0
- **License**: MIT

## Core Concepts

- Declarative event bindings with plain objects
- Semantic interactions (e.g., `press`, `longPress`, arrow keys)
- Reentry protection via `AbortSignal` for async listeners
- Type-safe listeners and custom `EventTarget` subclasses
- Efficient listener updates without unnecessary DOM churn

## Type Signatures

### EventListeners

```typescript
type EventListeners<target extends EventTarget = EventTarget> = Partial<
  {
    [k in EventType<target>]:
      | ListenerOrDescriptor<ListenerFor<target, k>>
      | Array<ListenerOrDescriptor<ListenerFor<target, k>>>;
  }
>;
```

### Dispatched

```typescript
type Dispatched<event extends Event, target extends EventTarget> =
  & Omit<event, "currentTarget">
  & { currentTarget: target };
```

### EventsContainer

```typescript
interface EventsContainer<target extends EventTarget> {
  dispose: () => void;
  set: (listeners: EventListeners<target>) => void;
}
```

### Interaction

```typescript
interface Interaction {
  readonly target: EventTarget;
  readonly signal: AbortSignal;
  on<target extends EventTarget>(
    target: target,
    listeners: EventListeners<target>,
  ): void;
}

type InteractionSetup = (handle: Interaction) => void;
```

### ContainerOptions

```typescript
type ContainerOptions = {
  signal?: AbortSignal;
};
```

## API Functions

### `on(target, listeners)`

Add event listeners with async reentry protection. Shorthand for
`createContainer` without options.

```typescript
import { on } from "@remix-run/interaction";

let button = document.createElement("button");
let dispose = on(button, {
  click(event, signal) {
    console.log("clicked");
  },
});

// later
dispose();
```

**Listener Signature**: `(event, signal) => void | Promise<void>`

- `event`: Dispatched event with typed `currentTarget`
- `signal`: AbortSignal aborted on reentry or disposal

**Arrays of Listeners**:

```typescript
on(button, {
  click: [
    (event) => console.log("first"),
    { capture: true, listener(event) {/* capture phase */} },
    {
      once: true,
      listener(event) {
        console.log("only once");
      },
    },
  ],
});
```

### `createContainer(target, options?)`

Creates an event container with efficient listener updates. Use this when you
need to update listeners in place (e.g., in component systems).

```typescript
import { createContainer } from "@remix-run/interaction";

let container = createContainer(form);

container.set({
  change(event) {
    console.log("form changed");
  },
  async submit(event, signal) {
    event.preventDefault();
    await fetch("/save", { method: "POST", signal });
  },
});

// later – only minimal necessary changes are rebound
container.set({
  change(event) {
    console.log("different listener");
  },
});

container.dispose();
```

**With AbortSignal**:

```typescript
let controller = new AbortController();
let container = createContainer(window, {
  signal: controller.signal,
});
container.set({ resize: () => {} });
controller.abort(); // disposes container
```

### `defineInteraction(type, setup)`

Defines a reusable interaction type with its setup function.

```typescript
import {
  defineInteraction,
  type Interaction,
  on,
} from "@remix-run/interaction";

// 1. Define the interaction
export let keydownEnter = defineInteraction("my:keydown-enter", KeydownEnter);

// 2. Provide type safety for consumers
declare global {
  interface HTMLElementEventMap {
    [keydownEnter]: KeyboardEvent;
  }
}

// 3. Setup function
function KeydownEnter(handle: Interaction) {
  if (!(handle.target instanceof HTMLElement)) return;

  handle.on(handle.target, {
    keydown(event) {
      if (event.key === "Enter") {
        handle.target.dispatchEvent(
          new KeyboardEvent(keydownEnter, { key: "Enter" }),
        );
      }
    },
  });
}

// 4. Usage
let button = document.createElement("button");
on(button, {
  [keydownEnter](event) {
    console.log("Enter key pressed");
  },
});
```

**Interaction Handle**:

- `handle.target`: The element the interaction is attached to
- `handle.signal`: AbortSignal for cleanup when disposed
- `handle.on(target, listeners)`: Add event listeners with automatic cleanup

### `TypedEventTarget<eventMap>`

Type-safe `EventTarget` subclass for custom events.

```typescript
import { on, TypedEventTarget } from "@remix-run/interaction";

interface DrummerEventMap {
  kick: DrummerEvent;
  snare: DrummerEvent;
  hat: DrummerEvent;
}

class DrummerEvent extends Event {
  constructor(type: keyof DrummerEventMap) {
    super(type);
  }
}

class Drummer extends TypedEventTarget<DrummerEventMap> {
  kick() {
    this.dispatchEvent(new DrummerEvent("kick"));
  }
}

let drummer = new Drummer();

// Type-safe with on()
on(drummer, {
  kick: (event) => {
    // event is Dispatched<DrummerEvent, Drummer>
  },
});
```

## Built-in Interactions

### Press Interactions

```typescript
import {
  longPress,
  press,
  pressCancel,
  pressDown,
  pressUp,
} from "@remix-run/interaction/press";

on(button, {
  [press](event) {
    console.log("pressed");
  },
  [longPress](event) {
    event.preventDefault(); // prevents `press`
    console.log("long pressed");
  },
});
```

- `press`: Normalized press (pointer or keyboard Enter/Space)
- `pressDown`: Press down event
- `pressUp`: Press up event
- `longPress`: Long press event (cancels `press` with preventDefault)
- `pressCancel`: Press cancelled event

### Keyboard Interactions

```typescript
import {
  arrowDown,
  arrowLeft,
  arrowRight,
  arrowUp,
  backspace,
  del,
  end,
  enter,
  escape,
  home,
  pageDown,
  pageUp,
  space,
} from "@remix-run/interaction/keys";

on(element, {
  [arrowUp](event) {
    console.log("arrow up");
  },
  [escape](event) {
    console.log("escape");
  },
});
```

### Form Interactions

```typescript
import { formReset } from "@remix-run/interaction/form";

on(hiddenInput, {
  [formReset]() {
    hiddenInput.value = "";
  },
});
```

### Swipe Interactions

```typescript
import {
  swipeCancel,
  swipeEnd,
  swipeMove,
  swipeStart,
} from "@remix-run/interaction/swipe";

on(element, {
  [swipeStart](event) {
    console.log("swipe started");
  },
  [swipeEnd](event) {
    console.log("swipe ended");
  },
});
```

### Popover Interactions

```typescript
import {
  popoverHide,
  popoverShow,
  popoverToggle,
} from "@remix-run/interaction/popover";

on(popover, {
  [popoverShow](event) {
    console.log("popover shown");
  },
});
```

## Event Listener Options

All DOM `AddEventListenerOptions` are supported via descriptors:

```typescript
on(button, {
  click: {
    capture: true,
    listener(event) {
      console.log("capture phase");
    },
  },
  focus: {
    once: true,
    listener(event) {
      console.log("focused once");
    },
  },
});
```

Available options: `capture`, `once`, `passive`, `signal`

## Async Listeners with Reentry Protection

The `signal` parameter is aborted when:

- The listener is re-entered (same event fires again)
- The component/container is disposed

```typescript
on(input, {
  async input(event, signal) {
    let query = event.currentTarget.value;

    // Pass signal to abort on reentry or disposal
    try {
      let response = await fetch(`/search?q=${query}`, { signal });
      let results = await response.json();
      if (!signal.aborted) {
        // Update UI with results
      }
    } catch (error) {
      if (signal.aborted) return; // ignore abort errors
      throw error;
    }
  },
});
```

## Error Handling

Errors thrown in listeners dispatch an `ErrorEvent` on the target element with
`bubbles: true`:

```typescript
let button = document.createElement("button");

// Handle errors
button.addEventListener("error", (event) => {
  console.error("Listener error:", event.error);
});

on(button, {
  click() {
    throw new Error("oops");
  },
});

button.click(); // ErrorEvent dispatched
```

## DOM Semantics

All standard DOM event semantics are preserved:

```typescript
on(button, {
  click: [
    (event) => {
      event.stopImmediatePropagation();
    },
    () => {
      // Not called due to stopImmediatePropagation
    },
  ],
});
```

## Custom Interaction Example

```typescript
import { defineInteraction, type Interaction } from "@remix-run/interaction";

export let tempo = defineInteraction("myapp:tempo", Tempo);

declare global {
  interface HTMLElementEventMap {
    [tempo]: TempoEvent;
  }
}

export class TempoEvent extends Event {
  bpm: number;

  constructor(type: typeof tempo, bpm: number) {
    super(type);
    this.bpm = bpm;
  }
}

function Tempo(handle: Interaction) {
  if (!(handle.target instanceof HTMLElement)) return;

  let target = handle.target;
  let taps: number[] = [];
  let resetTimer = 0;

  function handleTap() {
    clearTimeout(resetTimer);

    taps.push(Date.now());
    taps = taps.filter((tap) => Date.now() - tap < 4000);

    if (taps.length >= 4) {
      let intervals = [];
      for (let i = 1; i < taps.length; i++) {
        intervals.push(taps[i] - taps[i - 1]);
      }
      let bpm = intervals.map((interval) => 60000 / interval);
      let avgBpm = Math.round(
        bpm.reduce((sum, value) => sum + value, 0) / bpm.length,
      );
      target.dispatchEvent(new TempoEvent(tempo, avgBpm));
    }

    resetTimer = setTimeout(() => {
      taps = [];
    }, 4000);
  }

  handle.on(target, {
    click: handleTap,
  });
}

// Usage
on(button, {
  [tempo](event) {
    console.log("BPM:", event.bpm);
  },
});
```

## Notes

- Interactions are initialized at most once per target
- Interactions support cleanup via `AbortSignal`
- Custom interactions should use namespaced types (e.g.,
  `myapp:interaction-name`)
- Prefer built-in interactions over custom ones when possible
- Use `createContainer` for component systems that need efficient updates
- Use `on` for simple, one-time listener setup

## Related Packages

- [@remix-run/component](../component) - Component library that uses
  `@remix-run/interaction` for events

## Links

- [Package README](https://github.com/remix-run/remix/blob/main/packages/interaction/README.md)
- [Demos](https://github.com/remix-run/remix/tree/main/packages/interaction/demos)
- [Source Code](https://github.com/remix-run/remix/tree/main/packages/interaction/src)
