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
    - Slices and `delay` have been removed.
    - Checking for button press and release is now supported.
    - Printing to the console is now supported, via `debug_print`.

But why make these changes?
- The old code emulator had a lot of bugs and strange incompatibilities with C, making it difficult to write code.
- The new API is much closer to writing code on a real device, and in the future, you will be able to compile and upload your code to your device without modification.

## Example and explanation

Here's an example of what a program using the new API might look like. This program blinks the entire screen every second, but pauses when the select button is held.

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

First, the functions. Instead of `blackbox.matrix.turn_all_on()`, it's `bb_matrix_all_on()`. If you want a full list of functions you can call and how to call them, go to the API reference (link pending...)

Next, inputs and timers. You'll notice that `main` has been renamed to `setup`, and no longer contains a `while (1)` loop. Why? Just like JavaScript, the new API is built around an event loop. If you have a while loop, or otherwise do a lot of processing in a function, it will cause everything to hang until it completes. 

TODO: fill this in

## More about tasks

TODO: fill this in

## And that's it!

That's the bulk of the API changes. If you want to know everything that the new API supports, check out the API reference (link pending...)

Good luck with migrating your code, and if you have any questions, feel free to ask them in the `#black-box` channel in Slack!
