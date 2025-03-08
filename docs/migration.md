# Migration Guide

Welcome to Black Box v2! This is a ground-up rework of the API and emulator, adding many new features and fixing a lot of outstanding bugs.

How you write code has changed in a few important ways:
- All the code you write is now compiled with a real C compiler.
    - All features of standard C are available, including structs, arrays, pointers, enums, headers like `stdint.h` and `stdbool.h`, and more!
    - Types and casting work properly now.
    - Code that relies on some of the "features" of the old editor (like being able to call `console.log` directly) will no longer work.
- The API has been entirely reworked
    - Instead of an object-oriented api (with `Blackbox`, `Pixel`, `Piezo`, etc.), the API is now just plain old function calls.
    - Timers and button events are handled with tasks now, similar to `setInterval`, `setTimeout`, and `addEventListener` in JavaScript.
    - `delay` have been removed in favor of timeout and interval tasks.
    - Checking for button press and release is now supported.
    - Printing to the console is now supported, via `debug_print`.

But why make these changes?
- The old code emulator had a lot of bugs and strange incompatibilities with C, making it difficult to write code.
- The new API is much closer to writing code on a real device, and in the future, you will be able to compile and upload your new code to your device without modification.

## Example and explanation

Here's an example of a program using the new API. This program blinks the entire screen every second, but pauses when the select button is held.

```c
#include "blackbox.h"

// If the screen is allowed to blink
bool blinking = true;
// If the screen is currently all on
bool is_on = false;

void on_select_press(task_handle self) {
  // When the select button is held, prevent the screen from blinking
  blinking = false;
  debug_print("stopped the screen from blinking");
}

void on_select_release(task_handle self) {
  // When it's released, allow it to blink again
  blinking = true;
  debug_print("allowed the screen to blink again");
}

void toggle_screen(task_handle self) {
  // Only toggle the screen if we're not paused
  if (blinking) {
    if (is_on) {
      bb_matrix_all_off();
      is_on = false;
    } else {
      bb_matrix_all_on();
      is_on = true;
    }
  }
}

// This function is called once at startup
// Set up global variables, timers, events, etc.
void setup() {
  // Run `loop` every 500ms (every half second)
  task_create_interval(toggle_screen, 500);

  // Run `on_select_press` when the select button is pressed
  task_create_event(on_select_press, EVENT_PRESS_SELECT);

  // Run `on_select_release` when the select button is released
  task_create_event(on_select_release, EVENT_RELEASE_SELECT);
}
```

So, what's different?

First, the functions. Instead of `blackbox.matrix.turn_all_on()`, it's `bb_matrix_all_on()`. If you want a full list of functions you can call and how to call them, check the API reference (open by clicking `View Docs` in the editor).

Next, inputs and timers. You'll notice that `main` has been renamed to `setup`, and no longer contains a `while (1)` loop. Why? Just like JavaScript, the new API is built around an event loop. If you have a while loop, or otherwise do a lot of processing in a function, it will cause everything to hang until it completes. 

In order to actually do stuff with your program, you need to create tasks. Tasks are bits of code that run when certain things happen, like a timeout elapsing or a button being pressed. Each task has a target function (which *must* take in `task_handle self` and return `void`) that will be called when it runs, and some additional parameters that control when the task runs.

There are three main types of tasks:

**Timeout tasks**: similar to `setTimeout` in JavaScript, these tasks will run once after a delay you specify.
```c
void my_task_target(task_handle self) {
  debug_print("this will be printed after 3 seconds");
}

void setup() {
  task_create_timeout(my_task_target, 3000);
}
```

**Interval tasks**: similar to `setInterval` in JavaScript, these tasks will run repeatedly at an interval that you specify.
```c
void my_task_target(task_handle self) {
  debug_print("this will be printed every 3 seconds");
}

void setup() {
  task_create_interval(my_task_target, 3000);
}
```

**Event tasks**: similar to `addEventListener` in JavaScript, these tasks will run whenever an event you specify occurs.
```c
void my_task_target(task_handle self) {
  debug_print("this will be printed when the select button is pressed");
}

void setup() {
  task_create_event(my_task_target, EVENT_PRESS_SELECT);
}
```

**Advanced Usage**: When using an event task, you can specify multiple events to listen to using the logical OR operator. This can be useful by, for example, allowing you to create a single task that handles multiple button presses.
```c
int player_speed = 0;

void button_handler(task_handle self) {
  player_speed = 0;

  if (bb_get_button(BUTTON_RIGHT)) {
    player_speed += 1;
  }

  if (bb_get_button(BUTTON_LEFT)) {
    player_speed -= 1;
  }

  // at the end, player_speed is 1 if right is pressed, -1 if left is pressed
  // or 0 when both or neither button is pressed
}

void setup() {
  task_create_event(my_task_target, EVENT_PRESS_LEFT | EVENT_PRESS_RIGHT | EVENT_RELEASE_LEFT | EVENT_RELEASE_RIGHT);
}
```

**Resource limitations:** by default, a program can have a maximum of 16 active tasks. Be careful about creating tasks dynamically (inside other tasks or loops, as opposed to once inside `setup`), as you can easily hit this limit without realizing.

To see if a task created successfully, check the return value of `task_create` call like so:
```c
task_handle my_task = task_create_timeout(my_task_target, 1000);

if (my_task == 0) {
  debug_print("couldn't create task, the limit has been reached!");
} else {
  debug_print("task created successfully");
}
```

When you get a valid (non-zero) `task_handle` from task creation, you can store it and use it to manage that task. For example, `task_cancel(handle)` can be used to delete a task, preventing it from running and freeing up its resources for future tasks.

## And that's it!

That's the bulk of the API changes. If you want to know everything that the new API supports, check out the API reference (accessible by clicking `View Docs` in the editor).

Good luck with migrating your code, and if you have any questions, feel free to ask them in the [#black-box](https://hackclub.slack.com/archives/C08APN1CKEJ) channel in Slack. Happy hacking!
