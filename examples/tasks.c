#include "blackbox.h"

// Tasks
// by @lux
// Use a timeout task to flash a pixel and play a tone for just 100 milliseconds
// Trigger the task using the select button

// Store a handle to the timeout task in case of super fast presses
task_handle th_turn_off;

// This is called a "forward declaration"
// It lets us place the code for `turn_off` after the code for `turn_on`
void turn_off(task_handle self);

void turn_on(task_handle self) {
  // Cancel the previous timeout task in case the button is pressed super fast
  task_cancel(th_turn_off);
  // Turn on the pixel and play the tone
  bb_matrix_set_pos(1, 1, LED_ON);
  bb_tone(440);
  // Create a timeout task that triggers 100 milliseconds from now
  // Store it in `th_turn_off`
  th_turn_off = task_create_timeout(turn_off, 100);
}

void turn_off(task_handle self) {
  // Turn off the pixel and stop playing the tone
  bb_matrix_set_pos(1, 1, LED_OFF);
  bb_tone_off();
}

void setup() {
  // Create an event task that triggers when the select button is pressed
  task_create_event(turn_on, EVENT_PRESS_SELECT);
}