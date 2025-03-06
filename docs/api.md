# API Reference

A complete reference of the Black Box API.

## Matrix

### Types

#### led_state
```c
typedef enum {
  LED_OFF = 0,
  LED_ON = 1
} led_state;
```

The state of an LED, either on or off.

### Methods

#### bb_matrix_set_arr
```c
void bb_matrix_set_arr(uint8_t arr[8]);
```

Set the state of the LED matrix using an array. Each byte in the array represents a row of 8 pixels, with the most significant bit on the left.\
Rows are ordered top-to-bottom.

#### bb_matrix_get_arr
```c
void bb_matrix_get_arr(uint8_t out_arr[8]);
```

Copy the current state of the LED matrix to an array.

#### bb_matrix_set_pos
```c
void bb_matrix_set_pos(uint8_t x, uint8_t y, led_state state);
```

Set the pixel at (`x`, `y`) to the specified state.

#### bb_matrix_get_pos
```c
led_state bb_matrix_get_pos(uint8_t x, uint8_t y);
```

Get the state of the pixel at (`x`, `y`).

#### bb_matrix_toggle_pos
```c
void bb_matrix_toggle_pos(uint8_t x, uint8_t y);
```

Toggle the pixel at (`x`, `y`).

#### bb_matrix_all_on
```c
void bb_matrix_all_on();
```

Turn all LEDs in the matrix on.

#### bb_matrix_all_off
```c
void bb_matrix_all_off();
```

Turn all LEDs in the matrix off.

## Piezo

### Methods

#### bb_tone
```c
void bb_tone(uint16_t frequency);
```

Play a tone at the specifed frequency.\
If a tone is already playing, it will be stopped and the new frequency will be played.

#### bb_tone_off
```c
void bb_tone_off();
```

Stop playing a tone.

## Input

### Types

#### bb_button
```c
typedef enum {
  BUTTON_UP = 0,
  BUTTON_DOWN = 1,
  BUTTON_LEFT = 2,
  BUTTON_RIGHT = 3,
  BUTTON_SELECT = 4,
} bb_button;
```

A button on the Black Box device.

### Methods

#### bb_get_button
```c
bool bb_get_button(bb_button button);
```

Check if a button is pressed.\
Don't call this in a `while` loop. Instead, use `task_create_event` or run the check inside an interval task.

## Timing

### Types

#### time_stamp
```c
typedef uint32_t time_stamp;
```

A moment in time, measured in milliseconds since system start.

#### time_duration
```c
typedef uint32_t time_duration;
```

A duration of time, measured in milliseconds.

#### millis
```c
time_stamp millis();
```

Get the number of milliseconds since the application has started.\
Do not use `millis` in a `while` loop to wait until a specific time, as it will hang the program. Use tasks instead.

## Tasks

### Types

#### task_handle
```c
typedef uint32_t task_handle;
```

A unique identifier for a task.

#### task_target

```c
typedef void (*task_target)(task_handle self);
```

The function to run when a task is executed.

### Methods

#### task_create_timeout
```c
task_handle task_create_timeout(task_target target, time_duration duration);
```

Schedule the given function to run after `duration` milliseconds.\
Returns a task handle that can be used to manipulate the task, or `0` if the task failed to create.

#### task_create_interval
```c
task_handle task_create_interval(task_target target, time_duration interval);
```

Schedule the given function to run every `interval` milliseconds.\
Returns a task handle that can be used to manipulate the task, or `0` if the task failed to create.

#### task_create_event
```c
task_handle task_create_event(task_target target, event_mask events);
```

Register the given function as an event handler, to be run whenever the specified event(s) occur.\
Returns a task handle that can be used to manipulate the task, or `0` if the task failed to create.

The following values are valid as events:
```c
// button presses
EVENT_PRESS_UP
EVENT_PRESS_DOWN
EVENT_PRESS_LEFT
EVENT_PRESS_RIGHT
EVENT_PRESS_SELECT

// button releases
EVENT_RELEASE_UP
EVENT_RELEASE_DOWN
EVENT_RELEASE_LEFT
EVENT_RELEASE_RIGHT
EVENT_RELEASE_SELECT
```

#### task_pause
```c
void task_pause(task_handle handle);
```

Pause a task, preventing it from executing but allowing it to be unpaused in the future.

#### task_unpause
```c
void task_unpause(task_handle handle);
```

Unpause a task, allowing it to execute again.

#### task_cancel
```c
void task_cancel(task_handle handle);
```

Cancel a task, permanently preventing it from executing.

## Utility

### Methods

#### debug_print
```c
uint32_t debug_print(const char* str, ...);
```

Format and print the specified string to the debug console.\
Returns the number of characters printed.\
For information on the formatting accepted by `debug_print`, see [https://cplusplus.com/reference/cstdio/printf/](https://cplusplus.com/reference/cstdio/printf/).
