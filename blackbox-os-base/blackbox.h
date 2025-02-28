/*
 * blackbox.h: Userland API for Black Box
 */

#ifndef BLACKBOX_H
#define BLACKBOX_H

#include <stdint.h>
#include <stdbool.h>
#include <stdarg.h>
#include "executor.h"
#include "events.h"

/// Timing

/*
 * Get the number of milliseconds since the application has started. 
 */
time_stamp millis();

/// Task management/event loop

/*
 * Schedule the given function to run after `duration` milliseconds.
 * Returns a task handle that can be used to manipulate the task, or 0 if the
 * task failed to create.
 */
task_handle task_create_timeout(task_target target, time_duration duration);

/*
 * Schedule the given function to run every `interval` milliseconds.
 * Returns a task handle that can be used to manipulate the task, or 0 if the
 * task failed to create.
 */
task_handle task_create_interval(task_target target, time_duration interval);

/*
 * Register the given function as an event handler, to be run whenever the
 * specified event(s) occur.
 * Returns a task handle that can be used to manipulate the task, or 0 if the
 * task failed to create.
 */
task_handle task_create_event(task_target target, event_mask events);

/*
 * Cancel a task. This permanently prevents it from executing.
 */
void task_cancel(task_handle handle);

/*
 * Pause a task, preventing it from executing but allowing it to be unpaused in
 * the future.
 */
void task_pause(task_handle handle);

/*
 * Unpause a task, allowing it to execute again.
 */
void task_unpause(task_handle handle);

/// LED Matrix

typedef enum {
  LED_OFF = 0,
  LED_ON = 1
} led_state;

/*
 * Set the state of the LED matrix using an array. Each byte in the array
 * represents a row of 8 pixels, with the most significant bit on the left.
 * Rows are ordered top-to-bottom.
 */
void bb_matrix_set_arr(uint8_t arr[8]);

/*
 * Copy the current state of the LED matrix to an array.
 */
void bb_matrix_get_arr(uint8_t out_arr[8]);

/*
 * Set the pixel at (x, y) to the specified state.
 */
void bb_matrix_set_pos(uint8_t x, uint8_t y, led_state state);

/* 
 * Toggle the pixel at (x, y).
 */
void bb_matrix_toggle_pos(uint8_t x, uint8_t y);

/*
 * Get the state of the pixel at (x, y).
 */
led_state bb_matrix_get_pos(uint8_t x, uint8_t y);

/*
 * Turn all LEDs in the matrix on.
 */
void bb_matrix_all_on();

/*
 * Turn all LEDs in the matrix off.
 */
void bb_matrix_all_off();

/// Synchronous Input

typedef enum {
  BUTTON_UP = 0,
  BUTTON_DOWN = 1,
  BUTTON_LEFT = 2,
  BUTTON_RIGHT = 3,
  BUTTON_SELECT = 4,
} bb_button;

/*
 * Check if a button is pressed. Don't call this in a while loop to check for
 * buttons, use `task_create_event`, or check inside an interval task.
 */
bool bb_get_button(bb_button button);

/// Sound

/*
 * Play a tone at the specifed frequency.
 */
void bb_tone(uint16_t frequency);

/*
 * Stop playing tones.
 */
void bb_tone_off();

/// Debug

/*
 * Format and print the specified string to the debug console. Returns the
 * number of characters printed.
 */
uint32_t debug_print(const char* str, ...);

#endif
