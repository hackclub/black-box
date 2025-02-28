/*
 * hal.h: Hardware abstraction library headers
 */

#ifndef HAL_H
#define HAL_H

#include <stdint.h>
#include <stdbool.h>

/*
 * Get the number of milliseconds since the application has started. 
 */
uint32_t hal_millis();

/// LED Matrix

/*
 * Set the state of the LED matrix using an array. Each byte in the array
 * represents a row of 8 pixels, with the most significant bit on the left.
 * Rows are ordered top-to-bottom.
 */
void hal_matrix_set_arr(uint8_t arr[8]);

/*
 * Copy the current state of the LED matrix to an array.
 */
void hal_matrix_get_arr(uint8_t out_arr[8]);

/// Input

typedef enum {
  HAL_BUTTON_UP = 0,
  HAL_BUTTON_DOWN = 1,
  HAL_BUTTON_LEFT = 2,
  HAL_BUTTON_RIGHT = 3,
  HAL_BUTTON_SELECT = 4,
} hal_button;

typedef enum {
  HAL_BUTTON_STATE_UP = 0,
  HAL_BUTTON_STATE_DOWN = 1,
} hal_button_state;

/*
 * Get the state of a button
 */
hal_button_state hal_button_get_state(hal_button button);

/// Sound

/*
 * Play a tone at the specifed frequency.
 */
void hal_tone(uint16_t frequency);

/*
 * Stop playing tones.
 */
void hal_tone_off();

/*
 * Print the specified string to the debug console.
 */
void hal_console_write(char* str);

/// Critical section

/*
 * Enter a critical section, disabling interrupts if they were already enabled.
 * This is a no-op if the platform does not support preemption.
 */
void hal_critical_enter();

/*
 * Leave a critical section, restoring the system to its previous state.
 */
void hal_critical_exit();

/// Error handling

/*
 * Halt after a critical error. This function should not return.
 */
void hal_panic(const char* message);

#endif
