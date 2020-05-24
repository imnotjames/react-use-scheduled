import { renderHook, cleanup, act } from '@testing-library/react-hooks';

import useScheduled from './index';

afterEach(cleanup);
jest.useFakeTimers('modern');

async function advanceTimers (msToRun, increment = 100, flushPromises = true) {
  await act(async () => {
    for (let ran = 0; ran < msToRun; ran += increment) {
      jest.advanceTimersByTime(increment);
    }

    if (flushPromises) {
      await Promise.resolve();
    }
  });
}

describe('useScheduled', () => {
  test('if you pass a `handler` and a `delay`', async () => {
    const handler = jest.fn();

    renderHook(() => {
      useScheduled(handler, 1000);
    });

    expect(handler).toHaveBeenCalledTimes(0);

    await act(async () => jest.advanceTimersByTime(5000));

    expect(handler).toHaveBeenCalledTimes(5);
  });

  test('if you pass a `delay` of `null`, the schedule is suspended', async () => {
    const handler = jest.fn();

    const { result } = renderHook(() => useScheduled(handler, null));

    await act(async () => jest.advanceTimersByTime(5000));

    expect(handler).toHaveBeenCalledTimes(0);
    expect(result.current.isSuspended).toBeTruthy();
    expect(result.current.scheduledCount).toBe(0);
    expect(result.current.successCount).toBe(0);
    expect(result.current.failureCount).toBe(0);
  });

  test('if you pass the option `occurrences` of `n`, the schedule only runs `n` times', async () => {
    const handler = jest.fn();

    const { result } = renderHook(() => useScheduled(handler, 500, { occurrences: 3 }));

    await act(async () => jest.advanceTimersByTime(5000));

    expect(handler).toHaveBeenCalledTimes(3);
    expect(result.current.isSuspended).toBeTruthy();
    expect(result.current.scheduledCount).toBe(3);
    expect(result.current.successCount).toBe(3);
    expect(result.current.failureCount).toBe(0);
  });

  test('if you pass a new `handler`, the timer will not restart ', async () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();
    let handler = handler1;

    const { rerender } = renderHook(() => {
      useScheduled(handler, 1000);
    });

    await act(async () => jest.advanceTimersByTime(500));

    handler = handler2;

    await act(async () => rerender());

    await act(async () => jest.advanceTimersByTime(500));

    expect(handler1).toHaveBeenCalledTimes(0);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  test('if you pass a larger `delay`, it will update the timer and start a new one', async () => {
    const handler = jest.fn();
    let delay = 500;

    const { rerender } = renderHook(() => {
      useScheduled(handler, delay);
    });

    await act(async () => jest.advanceTimersByTime(1000));

    expect(handler).toHaveBeenCalledTimes(2);

    delay = 1000;

    await act(async () => rerender());

    await act(async () => jest.advanceTimersByTime(5000));

    expect(handler).toHaveBeenCalledTimes(7);
  });

  test('if you pass a smaller `delay`, it will update the timer and start a new one', async () => {
    const handler = jest.fn();
    let delay = 500;

    const { rerender } = renderHook(() => {
      useScheduled(handler, delay, { deadline: Infinity});
    });

    await act(async () => jest.advanceTimersByTime(1000));

    expect(handler).toHaveBeenCalledTimes(2);

    await act(async () => jest.advanceTimersByTime(200));

    delay = 80;

    await act(async () => rerender());

    // Advanced timers by time 3 times - should technically only run two.
    await act(async () => jest.advanceTimersByTime(0));
    await act(async () => jest.advanceTimersByTime(0));
    await act(async () => jest.advanceTimersByTime(0));

    expect(handler).toHaveBeenCalledTimes(4);

    await act(async () => jest.advanceTimersByTime(5000));

    expect(handler).toHaveBeenCalledTimes(67);
  });

  test('if you disable concurrency via `allowConcurrency`, it will block the jobs and only run serially', async () => {
    const handler = jest.fn()
      .mockImplementationOnce(async () => new Promise((resolve) => setTimeout(resolve, 5000)));

    const { result } = renderHook(() => useScheduled(handler, 500, { allowConcurrent: false }));

    await advanceTimers(1000);

    expect(handler).toHaveBeenCalledTimes(1);

    await advanceTimers(4500);

    expect(handler).toHaveBeenCalledTimes(3);

    await advanceTimers(1000);

    expect(handler).toHaveBeenCalledTimes(5);

    expect(result.current.scheduledCount).toBe(13);
    expect(result.current.successCount).toBe(5);

    // 8 jobs failed to run because they hit the deadline.
    expect(result.current.failureCount).toBe(8);
  });

  test('if you change concurrency via `allowConcurrency` while running it should take effect', async () => {
    const handler = jest.fn()
        .mockImplementationOnce(async () => new Promise((resolve) => setTimeout(resolve, 5000)));

    let allowConcurrent = false;

    const { result, rerender } = renderHook(() => useScheduled(handler, 500, { allowConcurrent }));

    await advanceTimers(1000);

    expect(handler).toHaveBeenCalledTimes(1);

    allowConcurrent = true;
    await act(async () => rerender());

    await advanceTimers(4500);

    expect(handler).toHaveBeenCalledTimes(10);

    await advanceTimers(1000);

    expect(handler).toHaveBeenCalledTimes(12);

    expect(result.current.scheduledCount).toBe(13);
    expect(result.current.successCount).toBe(12);

    // Only 1 job failed to run because they hit the deadline.
    expect(result.current.failureCount).toBe(1);
  });

  test('if you pass the same parameters causes no change in the timer', async () => {
    const handler = jest.fn();

    const { rerender } = renderHook(() => {
      useScheduled(handler, 1000);
    });

    await act(async () => jest.advanceTimersByTime(500));

    await act(async () => rerender());

    await act(async () => jest.advanceTimersByTime(500));

    expect(handler).toHaveBeenCalledTimes(1);
  });
});
