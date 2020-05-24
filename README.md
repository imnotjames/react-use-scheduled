# Custom React Hook `useScheduled` :calendar:

React hook to handle deferring activities for a later time - once or recurring.
This may be used as an analogue of `setInterval` or `setTimeout` in the
React Programming Model.

While [most implementations using the method described by Dan Abramov][dan-set-interval]
work well enough for many use cases, there are edge cases where they may fire off
schedule - or in the worst cases, won't fire at all.  This is because it uses `setInterval`
without taking into account our current state.  When a component re-renders in a way
that updates the `delay` passed to `useInterval` the hook implementation
will `clearInterval` and then start a new interval with `setInterval`.

For example, if you were to use `useScheduled(fireworksCallback, 400)` and
`useInterval(fireworksCallback, 400)` in your React Component that often has
the props change, you'd see the following behavior:

| Time  | Render | useScheduled | useInterval | 
| ----: | ------ | ------------ | ----------- |
| 0ms   | :gift: | :calendar:   | :calendar:  |
| 100ms |        | :watch:      | :watch:     |
| 200ms |        | :watch:      | :watch:     |
| 300ms | :gift: | :watch:      | :calendar:  |
| 400ms | :gift: | :fireworks:  | :calendar:  |
| 500ms |        | :watch:      | :watch:     |
| 600ms |        | :watch:      | :watch:     |
| 700ms |        | :watch:      | :watch:     |
| 800ms |        | :fireworks:  | :fireworks: |

`useScheduled` does not suffer from this fate.  It keeps a record of the last time
it had scheduled an interval and on any updated inputs it will reschedule from that
last time instead of the current time to keep the schedule stable.

Other interval implementations are fire and forget and only execute tasks asynchronously.
This is good in some cases but may limit the usefulness in others.

## Installation

```bash
npm install use-scheduled
```

## Usage

```jsx
import React, { useCallback } from 'react';
import useScheduled from 'use-scheduled';

export const App = () => {
  const [callCount, setCallCount] = useState(0);

  const { lastScheduleTime } = useScheduled(
    useCallback(
      () => setCallCount(n => n + 1),
      [setCallCount]
    ),
    5000
  );

  return (
    <div>
      Our Interval has been called {callCount} times.
      It was last called at {lastScheduleTime}.
    </div>
  );
};
```

Don't forget to use the `useCallback` hook to correctly refresh the
interval `callback` value only when dependencies have changed.

## API Reference

```javascript
const returnObject = useScheduled(callback, delay, options);
```

* `callback` is a function to be called on the schedule.
* `delay` is the time in milliseconds to wait between calls to the scheduled `callback`.
* `options` is an object to allow more detailed configuration of the `useScheduled` hook.

### Options Object

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `suspend` | `boolean` | `false` | Will suspend the interval when set.  When becoming unset it will reset the interval timer.  Does not stop any tasks that have already started. | 
| `allowConcurrent` | `boolean` | `true` | Whether or not to allow multiple iterations of the interval to run at the same time. |
| `occurrences` | `number` | `Infinity` | How many times to run the scheduled task. |
| `deadline` | `number` | `1000` | If for any reason the scheduled task does not run it will wait pending at least `deadline` milliseconds. |

### Return Object

This hook returns an object with the following predefined keys.

| Key | Type | Description |
| --- | --- | --- |
| `reset` | `function` | Resets the interval back to the original state - including occurence count, timeouts, etc. |
| `scheduledCount` | `number` | How many times this interval has been scheduled. |
| `successCount` | `number` | How many times the interval has completed successfully.  |
| `failureCount` | `number` | How many times the interval has completed with a failure.  |
| `lastScheduleTime` | `number` | When the last task was successfully started.  |

## License

[MIT Licensed](LICENSE)

[dan-set-interval]: https://overreacted.io/making-setinterval-declarative-with-react-hooks/
