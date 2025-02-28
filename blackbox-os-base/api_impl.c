/*
 * api_impl.c: Implementation for blackbox.h, invoked from userland
 */

#include "blackbox.h"
#include "executor_private.h"
#include "hal.h"
#include <stdarg.h>
#include <stdio.h>

/// Timing

time_stamp millis() {
  return hal_millis();
}

/// Task management/event loop

task_handle task_create_timeout(task_target target, time_duration duration) {
  return executor_api_task_create_timeout(
    target, 
    hal_millis() + duration
  );
}

task_handle task_create_interval(task_target target, time_duration interval) {
  if (interval == 0) {
    // bump to 1, a task interval of 0 isn't allowed
    interval = 1;
  }

  return executor_api_task_create_interval(
    target,
    hal_millis() + interval,
    interval
  );
}

task_handle task_create_event(task_target target, event_mask events) {
  return executor_api_task_create_event(target, events);
}

void task_cancel(task_handle handle) {
  executor_api_task_cancel(handle);
}

void task_pause(task_handle handle) {
  executor_api_task_pause(handle);
}

void task_unpause(task_handle handle) {
  executor_api_task_unpause(handle);
}

/// LED Matrix

void bb_matrix_set_arr(uint8_t arr[8]) {
  hal_matrix_set_arr(arr);
}

void bb_matrix_get_arr(uint8_t out_arr[8]) {
  hal_matrix_get_arr(out_arr);
}

// TODO: reading and writing the entire matrix state to flip 1 pixel might be
// inefficient if we're doing cross-language calls. do we store the full matrix
// state somewhere? maybe here? maybe assumed as part of hal impl? idk

void bb_matrix_set_pos(uint8_t x, uint8_t y, led_state state) {
  if (x >= 8 || y >= 8) return;

  uint8_t matrix_state[8];
  hal_matrix_get_arr(matrix_state);

  // x=0 is the leftmost led, but in the raw data, bit 0 is the rightmost led
  // do 7 - x to correct the ordering
  if (state == LED_ON) {
    // OR to flip led on
    matrix_state[y] = (matrix_state[y] | 1 << (7 - x));
  } else {
    // AND with everything but our bit of interest to flip led off
    matrix_state[y] = (matrix_state[y] & ~(1 << (7 - x)));
  }

  hal_matrix_set_arr(matrix_state);
}

void bb_matrix_toggle_pos(uint8_t x, uint8_t y) {
  if (x >= 8 || y >= 8) return;

  uint8_t matrix_state[8];
  hal_matrix_get_arr(matrix_state);

  // XOR to toggle a bit
  matrix_state[y] = (matrix_state[y] ^ 1 << (7 - x));

  hal_matrix_set_arr(matrix_state);
}

led_state bb_matrix_get_pos(uint8_t x, uint8_t y) {
  // assume out-of-bounds LEDs are off
  if (x >= 8 || y >= 8) return LED_OFF;

  uint8_t matrix_state[8];
  hal_matrix_get_arr(matrix_state);

  if (matrix_state[y] & (1 << (7 - x))) {
    return LED_ON;
  } else {
    return LED_OFF;
  }
}

void bb_matrix_all_on() {
  uint8_t all_on[8] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

  hal_matrix_set_arr(all_on);
}

void bb_matrix_all_off() {
  uint8_t all_off[8] = {0};

  hal_matrix_set_arr(all_off);
}

/// Synchronous Input

bool bb_get_button(bb_button button) {
  // this assumes that hal_button and bb_button are defined identically
  // not enforced, but should remain true hopefully

  return (hal_button_get_state((hal_button) button) == HAL_BUTTON_STATE_DOWN);
}

// Sound

void bb_tone(uint16_t frequency) {
  hal_tone(frequency);
}

void bb_tone_off() {
  hal_tone_off();
}

/// Debug

uint32_t debug_print(const char* str, ...) {
  va_list arg, arg2;
  va_start(arg, str);
  va_copy(arg2, arg);
  uint32_t string_size = vsnprintf(NULL, 0, str, arg);

  // XXX: this can cause a stack overflow if the user prints something too long
  // clamp the size? or just yolo (current strategy)
  // because a clamped size with a sufficiently crowded stack will *also* overflow
  char buffer[string_size + 1];

  vsnprintf(buffer, (string_size + 1), str, arg2);
  hal_console_write(buffer);

  va_end(arg2);
  va_end(arg);

  return string_size;
}
