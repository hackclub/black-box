/*
 * executor.h: (public) headers for the event loop executor
 */

#ifndef EXECUTOR_H
#define EXECUTOR_H

#include <stdint.h>

/*
 * A timestamp, measured in ms since system start.
 */
typedef uint32_t time_stamp;
/*
 * A time duration, measured in ms.
 */
typedef uint32_t time_duration;
/*
 * A unique identifier for a task.
 */
typedef uint32_t task_handle;
/*
 * The function to run when a task is executed.
 */
typedef void (*task_target)(task_handle self);

#endif
