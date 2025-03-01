# API Reference

A complete reference of the Black Box API.

## LED Matrix

### type `led_state`
```c
typedef enum {
  LED_OFF = 0,
  LED_ON = 1
} led_state;
```

The state of an LED, either on or off.

### function `bb_matrix_set_arr`
```c
void bb_matrix_set_arr(uint8_t arr[8]);
```

Set the state of the LED matrix using an array. Each byte in the array represents a row of 8 pixels, with the most significant bit on the left. Rows are ordered top-to-bottom.

### function `bb_matrix_get_arr`
```c
void bb_matrix_get_arr(uint8_t out_arr[8]);
```

Copy the current state of the LED matrix to an array.

### function `bb_matrix_set_pos`
```c
void bb_matrix_set_pos(uint8_t x, uint8_t y, led_state state);
```

Set the pixel at `(x, y)` to the specified state.

### function `bb_matrix_toggle_pos`
```c
void bb_matrix_toggle_pos(uint8_t x, uint8_t y);
```

Toggle the pixel at `(x, y)`.

### function `bb_matrix_get_pos`
```c
led_state bb_matrix_get_pos(uint8_t x, uint8_t y);
```

Get the state of the pixel at `(x, y)`.

### function `bb_matrix_all_on`
```c
void bb_matrix_all_on();
```

Turn all LEDs in the matrix on.

### function `bb_matrix_all_off`
```c
void bb_matrix_all_off();
```

Turn all LEDs in the matrix off.

## Input

###  type `bb_button`
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

## `bb_get_button`
```c
bool bb_get_button(bb_button button);
```

Check if a button is pressed. Don't call this in a while loop to check for buttons, use `task_create_event`, or run the check inside an interval task.

## Sound

### function `bb_tone`
```c
void bb_tone(uint16_t frequency);
```

Play a tone at the specifed frequency. If a tone is already playing, it will be stopped and the new frequency will be played.

### function `bb_tone_off`
```c
void bb_tone_off();
```

Stop playing tones played by `bb_tone`.

## Timing

### type `time_stamp`
```c
typedef uint32_t time_stamp;
```

A moment in time, measured in ms since system start.

### type `time_duration`
```c
typedef uint32_t time_duration;
```

A duration of time, measured in milliseconds.

### function `millis`
```c
time_stamp millis();
```

Get the number of milliseconds since the application has started. Do not use `millis` in a while loop to wait until a specific time, as it will hang the program. Use **Tasks** instead.

## Tasks

### type `task_handle`
```c
typedef uint32_t task_handle;
```

A unique identifier for a task.

### type `task_target`

```c
typedef void (*task_target)(task_handle self);
```

The function to run when a task is executed.

### function `task_create_timeout`
```c
task_handle task_create_timeout(task_target target, time_duration duration);
```

Schedule the given function to run after `duration` milliseconds. Returns a task handle that can be used to manipulate the task, or `0` if the task failed to create.

### function `task_create_interval`
```c
task_handle task_create_interval(task_target target, time_duration interval);
```

Schedule the given function to run every `interval` milliseconds. Returns a task handle that can be used to manipulate the task, or `0` if the task failed to create.

### function `task_create_event`
```c
task_handle task_create_event(task_target target, event_mask events);
```

Register the given function as an event handler, to be run whenever the specified event(s) occur. Returns a task handle that can be used to manipulate the task, or `0` if the task failed to create.

### function `task_cancel`
```c
void task_cancel(task_handle handle);
```

Cancel a task. This permanently prevents it from executing.

### function `task_pause`
```c
void task_pause(task_handle handle);
```

Pause a task, preventing it from executing but allowing it to be unpaused in the future.

### function `task_unpause`
```c
void task_unpause(task_handle handle);
```

Unpause a task, allowing it to execute again.

## Debug

### function `debug_print`
```c
uint32_t debug_print(const char* str, ...);
```

Format and print the specified string to the debug console. Returns the number of characters printed. 

For information on the formatting accepted by `debug_print`, see [https://cplusplus.com/reference/cstdio/printf/](https://cplusplus.com/reference/cstdio/printf/)
