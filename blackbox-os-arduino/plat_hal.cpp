// idk why this is the magic that makes the c/c++ interop work
// but it is
#include <Arduino.h>
extern "C" {

#include "hal.h"

/*
 * Get the number of milliseconds since the application has started. 
 */
uint32_t hal_millis(){
  return millis();
}

/// LED Matrix

/*
 * Set the state of the LED matrix using an array. Each byte in the array
 * represents a row of 8 pixels, with the most significant bit on the left.
 * Rows are ordered top-to-bottom.
 */
void hal_matrix_set_arr(uint8_t arr[8]){
    // TODO
}

/*
 * Copy the current state of the LED matrix to an array.
 */
void hal_matrix_get_arr(uint8_t out_arr[8]){
    // TODO
}

/// Input
/*
 * Get the state of a button
 */
hal_button_state hal_button_get_state(hal_button button){
    // TODO
    return HAL_BUTTON_STATE_UP;
}

uint16_t hal_rand(){
    return random(0, 65535);
}

/// Sound

/*
 * Play a tone at the specifed frequency.
 */
void hal_tone(uint16_t frequency){
    // TODO
}

/*
 * Stop playing tones.
 */
void hal_tone_off(){
    // TODO
}

/*
 * Print the specified string to the debug console.
 */
void hal_console_write(char* str){
    Serial.println(str);
}

/// Critical section

/*
 * Enter a critical section, disabling interrupts if they were already enabled.
 * This is a no-op if the platform does not support preemption.
 */
void hal_critical_enter(){
    noInterrupts();
}

/*
 * Leave a critical section, restoring the system to its previous state.
 */
void hal_critical_exit(){
    interrupts();
}

/// Error handling

/*
 * Halt after a critical error. This function should not return.
 */
void hal_panic(const char* message){
    Serial.print("PANIC: ");
    Serial.println(message);
    while(1);
}
}