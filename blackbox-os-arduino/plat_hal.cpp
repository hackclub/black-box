// idk why this is the magic that makes the c/c++ interop work
// but it is
#include <Arduino.h>
#include "hardware_defs.h"

extern "C" {

#include "hal.h"

/*
 * Get the number of milliseconds since the application has started. 
 */
uint32_t hal_millis(){
  return millis();
}

/// LED Matrix

// an array to hold the current state of the matrix
volatile uint8_t ardu_matrix_state[8];

/*
 * Set the state of the LED matrix using an array. Each byte in the array
 * represents a row of 8 pixels, with the most significant bit on the left.
 * Rows are ordered top-to-bottom.
 */
void hal_matrix_set_arr(uint8_t arr[8]){
    for (int i = 0; i < 8; i++) {
        ardu_matrix_state[i] = arr[i];
    }
}

/*
 * Copy the current state of the LED matrix to an array.
 */
void hal_matrix_get_arr(uint8_t out_arr[8]){
    for (int i = 0; i < 8; i++) {
        out_arr[i] = ardu_matrix_state[i];
    }
}

/// Input
/*
 * Get the state of a button
 */
hal_button_state hal_button_get_state(hal_button button){
    if(digitalRead(BUTTON_PIN_START + button) == HIGH){
        return HAL_BUTTON_STATE_UP;
    } else {
        return HAL_BUTTON_STATE_DOWN;
    }
}

uint16_t hal_rand(){
    return random(0, 65535);
}

/// Sound

/*
 * Play a tone at the specifed frequency.
 */
void hal_tone(uint16_t frequency){
    tone(BUZZER_PIN, frequency);
}

/*
 * Stop playing tones.
 */
void hal_tone_off(){
    noTone(BUZZER_PIN);
    digitalWrite(BUZZER_PIN, LOW);
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