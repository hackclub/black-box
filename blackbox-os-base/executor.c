/*
 * executor.c: Cross-platform task scheduler and event loop
 */

#include <stdint.h>
#include <stdbool.h>
#include <string.h>
#include "executor.h"
#include "hal.h"

/*
 * ===============
 * === DEFINES ===
 * ===============
 */

// maximum number of tasks that can be executed
// each task takes 24 bytes of global memory (24 byte struct + 4 byte queue)
#define NUM_TASKS 8

// number of distinct events the system can handle
// this is limited to 32 as each one occupies a bit in a uint32
#define NUM_EVENTS 32

// maximum number of activations a task can have
#define MAX_ACTIVATIONS 65535

// if this task is alive (not cancelled)
// if not, assume all the other memory in the struct is invalid, and can be
// reallocated
#define TASK_STATUS_ALIVE 0x01
// if this task is currently in the task queue
#define TASK_STATUS_ON_QUEUE 0x02
// if this task is currently executing
#define TASK_STATUS_RUNNING 0x04
// if this task is not accepting new activations
// if it's in the queue, the task won't be executed
#define TASK_STATUS_PAUSED 0x08
// if this task should be cancelled the next time it goes through the queue
#define TASK_STATUS_CANCEL_DEFERRED 0x10

// if you want a task in the queue to be deleted without running it, combine
// TASK_STATUS_PAUSED and TASK_STATUS_CANCEL_DEFERRED

#define TIMESTAMP_MAX 0xFFFFFFFFUL

/*
 * =============
 * === TYPES ===
 * =============
 */

typedef enum {
  // task is activated by an external event
  // data_a = bitfield of events
  TASK_TYPE_EVENT = 0,
  // task is activated by a one-off timeout, and then cancelled after
  // data_a = timestamp that the
  TASK_TYPE_TIMEOUT = 1,
  // task is activated by a repeating interval
  // data_a = next time to check for activation
  // data_b = interval for activation (ms)
  TASK_TYPE_INTERVAL = 2,
} task_type;

// this should pack down to 20 bytes (tested on clang armv7-a)
typedef struct {
  // the function to call to execute this task
  task_target target;
  // the full id (24-bit nonce and 8-bit index)
  uint32_t id;
  // the number of pending activations this task has
  uint16_t pending_activations;
  // the status flags of this task, as a bitfield
  // NOTE: uint8_t to save size on struct alignment
  uint8_t status_flags;

  // the type of this task
  // NOTE: uint8_t to save size on struct alignment
  uint8_t type;
  // data for this task (type-dependent)
  uint32_t data_a;
  // data for this task (type-dependent)
  uint32_t data_b;
} executor_task;

/*
 * ==================
 * === TASK ARRAY ===
 * ==================
 */


// all the tasks
executor_task tasks[NUM_TASKS];

/*
 * =======================
 * === FLAG OPERATIONS ===
 * =======================
 */

/*
 * Check if a task has (all) the specified status flags.
 */
static bool task_is(executor_task* task, uint8_t flags) {
  // sanity check
  if (task == NULL) {
    hal_panic("task_check: received NULL task pointer");
    return false;
  }

  return ((task->status_flags) & flags) == flags;
}

/*
 * Set the specified status flags on a task.
 */
static void task_set(executor_task* task, uint8_t flags) {
  // sanity check
  if (task == NULL) {
    hal_panic("task_set: received NULL task pointer");
    return;
  }

  task->status_flags |= flags;
}

/*
 * Unset the specified status flags on a task.
 */
static void task_unset(executor_task* task, uint8_t flags) {
  // sanity check
  if (task == NULL) {
    hal_panic("task_unset: received NULL task pointer");
    return;
  }

  uint8_t cur_flags = task->status_flags;
  task->status_flags = cur_flags & ~flags;
}

/*
 * ==================
 * === TASK QUEUE ===
 * ==================
 */

// ring buffer that represents the currently active task queue
executor_task* task_queue[NUM_TASKS];
// how many items are currently in the task queue
uint8_t task_queue_size;
// an index representing the head of the task queue
uint8_t task_queue_head;

// TODO: should task_queue_* modify the status bits of a task?
// i'm wagering on no right now
// though i will add sanity checks

/*
 * Push an item to the task queue.
 */
static void task_queue_push(executor_task* task) {
  if (task_queue_size >= NUM_TASKS) {
    // this should never happen, the rest of the code should make it impossible
    // but in case it does...
    hal_panic("task_queue_push: queue is full");
    return;
  }

  if (task == NULL) {
    hal_panic("task_queue_push: task is null");
    return;
  }

  if (task_is(task, TASK_STATUS_ON_QUEUE)) {
    hal_panic("task_queue_push: task was already queued");
    return;
  }

  // figure out where in the queue we should write the new task
  uint8_t write_index = (task_queue_head + task_queue_size) % NUM_TASKS;

  task_queue[write_index] = task;
  task_queue_size++;
}

/*
 * Peek the head of the task queue. Returns NULL if the queue is empty.
 */
// currently unused
/*
static executor_task* task_queue_peek() {
  if (task_queue_size == 0) {
    return NULL;
  }

  return task_queue[task_queue_head];
}
*/

/*
 * Pop the head of the task queue. Returns NULL if the queue is empty.
 */
static executor_task* task_queue_pop() {
  if (task_queue_size == 0) {
    return NULL;
  }

  executor_task* item = task_queue[task_queue_head];

  // advance the head, wrapping around if needed
  task_queue_head = (task_queue_head + 1) % NUM_TASKS;
  task_queue_size--;

  return item;
}

/*
 * ================
 * === TASK IDS ===
 * ================
 */

// task ids, as passed to the user, are split into 2 parts
// the lowest 8 bits are an index into the tasks array, for fast access
// the highest 24 bits are a unique number for every task created, to
// essentially prevent a use-after-free
// without it, this can happen:
// 1. a task is allocated with an index (ex: 5)
// 2. user code stores this index somewhere for future use
// 3. the task is cancelled at some point, but that index is still retained
// 4. a new task gets assigned the same index
// 5. user code cancels the old index again, cancelling the newly-craeted task

// if you make more than 2^24 tasks over the lifetime of the program, it *will*
// roll over and start duplicating ids, but it's just a safeguard at the end
// of the day

// this starts at 1 so that task id 0 can be reserved for the null id (0).
// in addition, nonce % 2^24 can never be 0, so we do a special rollover
uint32_t task_id_nonce = 1;

// generate the higher 24 bits of the task id
// this can be ORed with the index (lower 8 bits) to make a full task ID
static uint32_t generate_task_id() {
  uint32_t new_task_id = task_id_nonce;
  task_id_nonce++;

  // handle rollover
  task_id_nonce %= 16777216UL;
  if (task_id_nonce == 0) task_id_nonce++;

  return (new_task_id << 8);
}

// resolve a task handle to a pointer
static executor_task* resolve_task_handle(task_handle handle) {
  // handle 0 is reserved
  if (handle == 0) return NULL;

  // get the index into the task

  uint8_t index = handle & 0xFF;
  if (index >= NUM_TASKS) return NULL;

  executor_task* task = &tasks[index];

  if (!task_is(task, TASK_STATUS_ALIVE)) return NULL;
  if (task->id != handle) return NULL;

  return task;
}

/*
 * =======================
 * === TASK MANAGEMENT ===
 * =======================
 */

/*
 * Activate a task `num_activations` number of times. This modifies the task
 * queue, and respects the task status.
 */
static void activate_task(executor_task* task, uint16_t num_activations) {
  // sanity check
  if (num_activations == 0) return;
  if (task == NULL) {
    hal_panic("activate_task: task is null");
    return;
  }
  if (!task_is(task, TASK_STATUS_ALIVE)) {
    hal_panic("activate_task: task is dead");
    return;
  }

  // ignore activations to paused tasks
  if (task_is(task, TASK_STATUS_PAUSED)) {
    return;
  }

  int32_t possible_activations = (MAX_ACTIVATIONS - task->pending_activations);

  // this happens if task->pending_activations > MAX_ACTIVATIONS
  if (possible_activations < 0) {
    hal_panic("activate_task: possible_activations has underflowed");
    return;
  }

  if (num_activations > possible_activations) {
    // current behavior is to just clamp activations to the maximum possible
    task->pending_activations += possible_activations;
  } else {
    task->pending_activations += num_activations;
  }

  // handle queuing behavior

  // check if it's already queued
  if (task_is(task, TASK_STATUS_ON_QUEUE)) {
    // nothing to do
    return;
  } else {
    task_queue_push(task);
    task_set(task, TASK_STATUS_ON_QUEUE);
  }
}

// cancel a task, with no sanity checks. use with caution!
static void cancel_task(executor_task* task) {
  task_unset(task, TASK_STATUS_ALIVE);
  // we already zero out the task when allocating
  //memset(task, 0, sizeof(*task));
}

/*
 * ================
 * === USER API ===
 * ================
 */

// not quite the user api, this still gets proxied through api_impl.c

// TODO: should failures be panics or returns? currently silently ignored.

// allocate a new task, with fields zeroed and id set
// returns NULL if no slot was found
static executor_task* allocate_task() {
  for (uint8_t task_slot=0; task_slot<NUM_TASKS; task_slot++) {
    if (task_is(&tasks[task_slot], TASK_STATUS_ALIVE)) continue;

    executor_task* task = &tasks[task_slot];
    // zero it out
    memset(task, 0, sizeof(*task));
    // mark it as alive
    task_set(task, TASK_STATUS_ALIVE);
    // assign the id
    uint32_t task_id = generate_task_id() | task_slot;
    task->id = task_id;

    return task;
  }

  return NULL;
}

// create an event task. returns 0 if the creation failed
task_handle executor_api_task_create_event(
  task_target target,
  uint32_t event_mask
) {
  executor_task* task = allocate_task();
  if (task == NULL) return 0;

  task->type = TASK_TYPE_EVENT;
  task->data_a = event_mask;
  task->target = target;

  return task->id;
}

// create an interval task. returns 0 if the creation failed
task_handle executor_api_task_create_interval(
  task_target target,
  uint32_t next_activate,
  uint32_t interval
) {
  executor_task* task = allocate_task();
  if (task == NULL) return 0;

  task->type = TASK_TYPE_INTERVAL;
  task->data_a = next_activate;
  task->data_b = interval;
  task->target = target;

  return task->id;
}

// create a timeout task. returns 0 if the creation failed
task_handle executor_api_task_create_timeout(
  task_target target,
  uint32_t activate_timestamp
) {
  executor_task* task = allocate_task();
  if (task == NULL) return 0;

  task->type = TASK_TYPE_TIMEOUT;
  task->data_a = activate_timestamp;
  task->target = target;

  return task->id;
}

// cancel a task
void executor_api_task_cancel(task_handle handle) {
  executor_task* task = resolve_task_handle(handle);

  if (task == NULL) return;
  if (!task_is(task, TASK_STATUS_ALIVE)) return;
  if (task_is(task, TASK_STATUS_CANCEL_DEFERRED)) return;

  // if this task is running or on queue, we need to defer cancellation
  if (task_is(task, TASK_STATUS_RUNNING) || task_is(task, TASK_STATUS_ON_QUEUE)) {
    task_set(task, TASK_STATUS_PAUSED | TASK_STATUS_CANCEL_DEFERRED);
  } else {
    // destroy it now
    cancel_task(task);
  }
}

// pause a task
void executor_api_task_pause(task_handle handle) {
  executor_task* task = resolve_task_handle(handle);

  if (task == NULL) return;
  if (!task_is(task, TASK_STATUS_ALIVE)) return;

  task_set(task, TASK_STATUS_PAUSED);
}

// unpause a task
void executor_api_task_unpause(task_handle handle) {
  executor_task* task = resolve_task_handle(handle);

  if (task == NULL) return;
  if (!task_is(task, TASK_STATUS_ALIVE)) return;

  task_unset(task, TASK_STATUS_PAUSED);
}

/*
 * ====================
 * === PLATFORM API ===
 * ====================
 */

// last time the event loop tick was called
uint32_t last_tick_timestamp;

// if the executor has been initalized
bool is_initialized = false;

/*
// awful debugging code
// at least it looks cool
static void debug_print_task_state() {
  printf("task state:\n");
  for (uint8_t i=0; i<NUM_TASKS; i++) {
    printf("  %02hx: ", i);
    executor_task* task = &tasks[i];
    if (!task_is(task, TASK_STATUS_ALIVE)) {
      printf("(free)\n");
      continue;
    }

    printf("id=%04x ", task->id);

    if (task->type == TASK_TYPE_EVENT) {
      printf("EVNT ");
    } else if (task->type == TASK_TYPE_TIMEOUT) {
      printf("TOUT ");
    } else if (task->type == TASK_TYPE_INTERVAL) {
      printf("INTR ");
    } else {
      printf("???? ");
    }

    if (task_is(task, TASK_STATUS_ALIVE)) {
      printf("a");
    } else {
      printf("-");
    }

    if (task_is(task, TASK_STATUS_ON_QUEUE)) {
      printf("q");
    } else {
      printf("-");
    }

    if (task_is(task, TASK_STATUS_RUNNING)) {
      printf("r");
    } else {
      printf("-");
    }

    if (task_is(task, TASK_STATUS_PAUSED)) {
      printf("p");
    } else {
      printf("-");
    }

    if (task_is(task, TASK_STATUS_CANCEL_DEFERRED)) {
      printf("c");
    } else {
      printf("-");
    }

    printf(" P=%04u a=%u b=%u\n", task->pending_activations, task->data_a, task->data_b);
  }

  printf("task queue:\n");

  if (task_queue_size == 0) {
    printf("  (empty)");
  } else {
    for (uint8_t i=0; i<task_queue_size; i++) {
      executor_task* task = task_queue[(task_queue_head + i) % NUM_TASKS];

      printf("  id=%04x\n", task->id);
    }
  }
}
*/

/*
 * Initialize the executor. This needs to be run before the loop is ticked.
 */
void executor_init() {
  memset(&tasks, 0, sizeof(tasks));

  memset(&task_queue, 0, sizeof(task_queue));
  task_queue_size = 0;
  task_queue_head = 0;

  last_tick_timestamp = 0;
}

/*
 * Run a tick of the event loop. Takes in the current timestamp, and an array
 * of the number of times events have occurred since the last tick.
 * 
 * Returns the timestamp that the executor should be ticked at next, assuming
 * no events happen before then. Returns 0xFFFFFFFF if no timers require the 
 * event loop to be ticked. Returns 0 if the tick loop should be invoked as
 * soon as possible.
 */
uint32_t executor_tick_loop(uint32_t current_time, uint8_t event_counts_in[NUM_EVENTS]) {
  // step 0: sanity check
  if (current_time < last_tick_timestamp) {
    hal_panic("executor_tick_loop: time went backwards! did the global timer overflow?");
    return TIMESTAMP_MAX;
  }

  // step 1: copy the event counts
  // why pass in events? it's safer than having an interrupt poke the executor
  // and less race conditions if you move the responsibility to plat_main

  // number of times each event has been fired since we were last ticked
  uint8_t event_counts[NUM_EVENTS];

  // critical section: we cannot have event_counts change while we work on it
  // copy the entire thing to a local variable
  hal_critical_enter();
  memcpy(event_counts, event_counts_in, sizeof(event_counts));
  hal_critical_exit();

  // step 2: calculate activations for tasks

  // step 2.1: handle event-based activations
  for (uint8_t event_id=0; event_id<NUM_EVENTS; event_id++) {
    uint8_t event_activations = event_counts[event_id];

    if (event_activations == 0) continue;

    uint32_t event_bitmask = (1 << event_id);

    // find tasks that match this event
    for (uint8_t i=0; i<NUM_TASKS; i++) {
      executor_task* task = &tasks[i];

      if (!task_is(task, TASK_STATUS_ALIVE)) continue;
      if ((task->type) != TASK_TYPE_EVENT) continue;

      // check if task is listening for this event
      if ((task->data_a & event_bitmask) != 0) {
        activate_task(task, event_activations);
      }
    }
  }

  // step 2.2: handle timer-based activations
  for (uint8_t i=0; i<NUM_TASKS; i++) {
    executor_task* task = &tasks[i];

    if (!task_is(task, TASK_STATUS_ALIVE)) continue;

    if ((task->type) == TASK_TYPE_TIMEOUT) {
      uint32_t timeout_at = task->data_a;

      if (current_time >= timeout_at) {
        // activate this task
        activate_task(task, 1);
        // set the timeout to the max so it doesn't activate again before it runs
        task->data_a = TIMESTAMP_MAX;
        // mark the task to be deleted after next execution
        task_set(task, TASK_STATUS_CANCEL_DEFERRED);
      }
    }

    if ((task -> type) == TASK_TYPE_INTERVAL) {
      // check if this task needs to be activated yet

      uint32_t interval_at = task->data_a;
      uint32_t interval_rate = task->data_b;

      if (current_time >= interval_at) {
        // it needs to be activated!

        // avoid a possible division by zero
        if (interval_rate == 0) {
          hal_panic("executor_tick_loop: encountered a task interval_rate of 0");
          return TIMESTAMP_MAX;
        }

        // handle "overdue" activations, ones that should've happened by now
        // XXX: there's a potential overflow here...
        uint16_t overdue_activations = (current_time - interval_at) / interval_rate;

        // activate the task
        // 1 activation, and however many more if we're behind schedule
        // XXX: and an overflow here too...
        activate_task(task, 1 + overdue_activations);

        // bump the next time we should check it
        // we only ever increment by multiples of interval_rate, to ensure that
        // the "phase" of the timing stays correct
        task->data_a += (1 + overdue_activations) * interval_rate;
      }
    }
  }

  // step 3: pick a task from the queue and execute it

  {
    executor_task* task = task_queue_pop();

    if (task == NULL) goto done_executing;

    // sanity check first
    // !TASK_STATUS_ALIVE -> if you want to cancel a task on the queue, just
    // add TASK_STATUS_DEFERRED_CANCEL and wait for it to work its way through
    // !TASK_STATUS_ON_QUEUE -> this should never happen...
    if (!task_is(task, TASK_STATUS_ALIVE | TASK_STATUS_ON_QUEUE)) {
      hal_panic("executor_tick_loop: task from queue has invalid flags");
      return TIMESTAMP_MAX;
    }

    // it's not on the queue anymore
    task_unset(task, TASK_STATUS_ON_QUEUE);

    // if this task is paused (but is still in the queue from a previous activation)
    // ignore it
    if (task_is(task, TASK_STATUS_PAUSED)) {
      // handle TASK_STATUS_CANCEL_DEFERRED here because we jump past the
      // normal handling code

      if (task_is(task, TASK_STATUS_CANCEL_DEFERRED)) {
        cancel_task(task);
      }

      goto done_executing;
    }

    // it's time for the moment we've been waiting for
    // execute that task!
    task_set(task, TASK_STATUS_RUNNING);
    task->target(task->id);
    task_unset(task, TASK_STATUS_RUNNING);

    // drop the activations by 1
    if (task->pending_activations == 0) {
      hal_panic("executor_tick_loop: pending_activations would underflow");
      return TIMESTAMP_MAX;
    }

    task->pending_activations--;

    // does it need to be cancelled now?
    if (task_is(task, TASK_STATUS_CANCEL_DEFERRED)) {
      cancel_task(task);

      goto done_executing;
    }

    // does it need to be re-queued? (activations > 0)
    if (task->pending_activations > 0) {
      if (!task_is(task, TASK_STATUS_ON_QUEUE)) {
        task_queue_push(task);
        task_set(task, TASK_STATUS_ON_QUEUE);
      }
    }
  }

done_executing:

  // step 4: calculate when the event loop should tick next

  // if we have stuff in the queue, the answer should be "right away"
  if (task_queue_size > 0) {
    return 0;
  }

  // if not, go down the list of all the tasks and see which one is earliest
  uint32_t soonest = TIMESTAMP_MAX;

  for (uint8_t i=0; i<NUM_TASKS; i++) {
    executor_task* task = &tasks[i];
    if (!task_is(task, TASK_STATUS_ALIVE)) continue;

    // only interval and timeout tasks change our next tick time
    if (!(
      (task->type == TASK_TYPE_INTERVAL) ||
      (task->type == TASK_TYPE_TIMEOUT)
    )) continue;

    // paused tasks shouldn't cause us to tick earlier
    if (task_is(task, TASK_STATUS_PAUSED)) continue;

    uint32_t task_next_activation = task->data_a;

    // bump down soonest to the soonest next activation
    if (task_next_activation < soonest) {
      soonest = task_next_activation;
    }
  }

  // this will be TIMESTAMP_MAX (0xFFFFFFFF) if nothing bumped it down
  return soonest;
}
