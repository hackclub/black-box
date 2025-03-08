/*
 * executor_private.h: Private declarations for the executor
 */

#ifndef EXECUTOR_PRIVATE_H
#define EXECUTOR_PRIVATE_H

#include "executor.h"

/*
 * Initialize the executor. This needs to be run before the loop is ticked.
 */
void executor_init();

/*
 * Run a tick of the event loop. Takes in the current timestamp, and an array
 * of the number of times events have occurred since the last tick.
 * 
 * Returns the timestamp that the executor should be ticked at next, assuming
 * no events happen before then. Returns 0xFFFFFFFF if no timers require the 
 * event loop to be ticked. Returns 0 if the tick loop should be invoked as
 * soon as possible.
 */
uint32_t executor_tick_loop(uint32_t current_time, uint8_t* event_counts_in);
// XXX: ^ event_counts_in lost its length... do we care?
// should all of this be moved to a config.h of sorts (probably!)

task_handle executor_api_task_create_event(
  task_target target,
  uint32_t event_mask
);
task_handle executor_api_task_create_interval(
  task_target target,
  uint32_t next_activate,
  uint32_t interval
);
task_handle executor_api_task_create_timeout(
  task_target target,
  uint32_t activate_timestamp
);
void executor_api_task_cancel(task_handle handle);
void executor_api_task_pause(task_handle handle);
void executor_api_task_unpause(task_handle handle);

#endif
