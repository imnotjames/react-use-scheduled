import { useEffect, useRef, useState, useCallback } from 'react';

export default function useScheduled (
  callback,
  delay,
  {
    suspend = false,
    allowConcurrent = true,
    occurrences = Infinity,
    deadline = null
  } = {}
) {
  // Keep track of the callback we want to use as a reference so we can
  // more easily swap out the callbacks in queued tasks.
  const callbackRef = useRef(callback);

  // Mutex is a number because we keep track of how many times
  // we enter and leave.  This helps because at any time the `allowConcurrent`
  // flag could be changed - so we need to be able to handle that case.
  const mutex = useRef({});

  // The queue is always used but is only really important when `allowConcurrent`
  // is set.  The jobs will be queued up here to be attempted to be run if they
  // weren't able to run when something else was running.
  const queue = useRef([]);

  // Keeping track of state for the return object, mostly..
  const [scheduledCount, setScheduledCount] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [failureCount, setFailureCount] = useState(0);
  const [lastScheduleTime, setLastScheduleTime] = useState(null);

  // The last time we ran our internal timeout keeping track of run times.
  // This allows us to pick up where we left off in case of a refresh.
  const [lastTimeout, setLastTimeout] = useState(null);
  const [nextTimeout, setNextTimeout] = useState(null);

  // Other ways that the hook may be suspended.
  suspend = suspend || scheduledCount >= occurrences; // Once we go above the `occurrences` runs we suspend.
  suspend = suspend || delay === null; // If delay is null entirely it's counted as suspended
  suspend = suspend || delay <= 0; // If delay is <= 0 it's invalid - we'd just be recursively calling it.

  // If the deadline is null, it defaults to the delay.
  // This means that the task can wait up until when the next
  // task is supposed to start by default.
  if (deadline === null) {
    deadline = delay;
  }

  useEffect(
    () => {
      callbackRef.current = callback;
    },
    [callback]
  );

  useEffect(
    () => {
      if (suspend) {
        setNextTimeout(null);
        setLastTimeout(null);
        return;
      }

      if (lastTimeout === null) {
        // If the last timeout is null but we aren't suspended
        // we need to reset it to the current time.
        // This will kick us back into this function beause of the effect
        // but we shouldn't hit this branch next time.
        setLastTimeout(Date.now());
        return;
      }

      // If we are refreshing the effect because the delay has changed or
      // the callback has changed we want to keep the same schedule
      // if at all possible.  If we used `setInterval` and cleared the
      // interval all the time we'd end up never firing off our scheduled
      // task.

      setNextTimeout(lastTimeout + delay);
    },
    [delay, suspend, lastTimeout]
  );

  useEffect(() => {
    if (!nextTimeout) {
      // If there's no next timeout we're going to stop this entirely.
      return;
    }

    // `nextTimeout` is the absolute time when this should be run.
    // This may be in the past.  However, `setTimeout` expects a
    // relative time as a parameter.
    const timeout = nextTimeout - Date.now();

    const timeoutId = setTimeout(
      async () => {
        if (mutex.current[nextTimeout]) {
          // If the mutex for this timestamp exists for this task we're
          // trying to schedule for the current time while we're running
          // that current time.  This can happen for a variety of reasons,
          // but generally it just means we need to skip this run.
          return;
        }

        const hasOtherTasks = Object.keys(mutex.current).length > 0;

        // console.log(mutex.current, hasOtherTasks);

        // We've started for this run!
        mutex.current[nextTimeout] = true;

        // Handle if we for some reason are past the time when we expected to
        // fire off.  This normally only happens when the delay amount has
        // been reduced from what it was before OR if the browser went to sleep
        // and woke up much later.

        // Add this entry to the queue.
        queue.current.push({ when: nextTimeout });

        // Setting this will effectively fire off the next timeout.
        setLastTimeout(nextTimeout);

        // We scheduled something!
        setScheduledCount(n => n + 1);

        if (!allowConcurrent && hasOtherTasks) {
          // We aren't allowing concurrent jobs and there's currently
          // a job running somewhere in another castle!
          // We put the run on our queue so let's just end here.
          delete mutex.current[nextTimeout];
          return;
        }

        while (true) {
          const job = queue.current.pop();

          // console.log("POP JOB", job);

          if (!job) {
            // If nothing is on the queue, bail out of the loop.
            // We do this to aim for a better atomicity.
            break;
          }

          if (Date.now() - job.when > deadline) {
            // If the job's original schedule time has passed the deadline
            // we count it as a failure and don't run the job.
            // Them's the rules.
            // console.log("DEADLINE FAILURE");
            setFailureCount(n => n + 1);
            continue;
          }

          // We're actually running our callback!
          try {
            // Mark job as started..
            setLastScheduleTime(Date.now());

            // console.log("CALLBACK");
            // And actually run the job!
            await callbackRef.current();

            // console.log("CALLBACK COMPLETE");

            // Mark job as successful.
            setSuccessCount(n => n + 1);
          } catch (e) {
            // Mark off a failure to run the job.
            setFailureCount(n => n + 1);
          }
        }

        delete mutex.current[nextTimeout];
      },
      timeout
    );

    // Ensure that `useEffect` will clean up if we are refreshing the effect.
    return () => clearTimeout(timeoutId);
  }, [callbackRef, delay, nextTimeout, deadline, allowConcurrent]);

  const reset = useCallback(
    () => {
      setScheduledCount(0);
      setSuccessCount(0);
      setFailureCount(0);

      setLastTimeout(null);
      setNextTimeout(null);

      setLastScheduleTime(null);
    },
    [setScheduledCount, setSuccessCount, setFailureCount, setLastTimeout]
  );

  return {
    reset,
    isSuspended: suspend,
    scheduledCount,
    successCount,
    failureCount,
    lastScheduleTime
  };
}
