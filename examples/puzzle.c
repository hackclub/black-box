#include "blackbox.h"

// Puzzle
// by @lux
// A port of (most of) the teaser seen on the Black Box website
// Uses arrays, slices, and tasks
// Special events related to `exclam` are left unimplemented

// Data arrays
uint8_t happy[8] = {126, 255, 189, 189, 255, 189, 195, 126};
uint8_t sad[8] = {126, 255, 189, 189, 255, 195, 189, 126};
uint8_t surprised[8] = {126, 255, 189, 189, 231, 219, 219, 102};
uint8_t angry[8] = {126, 255, 189, 219, 189, 255, 195, 126};
uint8_t exclam[8] = {0, 102, 102, 102, 102, 0, 102, 0};

// We don't get a Date object, so let's just count down to 1 hour from now
uint8_t max_hours = 1;
uint8_t max_minutes = 0;
uint8_t max_seconds = 0;
// The current amount of time on the countdown in seconds
// Populated in `setup`
uint32_t current_total_seconds;

// Are we showing a data array right now?
bool showing_data = false;

// Use slices to display the countdown on the matrix
void show_countdown() {
  bb_matrix_all_off();
  // Making sense of these formulas is left as an exercise to the reader
  int current_seconds = current_total_seconds % 60;
  int current_minutes = ((current_total_seconds - current_seconds) % 3600) / 60;
  int current_hours = (current_total_seconds - current_seconds - (current_minutes * 60)) / 3600;
  // Set slices
  bb_slice_set_int(17, 21, current_hours);
  bb_slice_set_int(25, 30, current_minutes);
  bb_slice_set_int(33, 38, current_seconds);
}

// Subtract one second from the countdown
void update_countdown(task_handle self) {
  current_total_seconds -= 1;
  if (showing_data == false) {
    show_countdown();
  }
  if (current_total_seconds == 0) {
    task_cancel(self);
  }
}

// Forward declaration
void stop_showing_data(task_handle self);

// Show a data array and play a tone at a specific frequency
// This lasts for 125 milliseconds
void show_data(const uint8_t *data, uint16_t frequency) {
  showing_data = true;
  bb_matrix_set_arr(data);
  bb_tone(frequency);
  task_create_timeout(stop_showing_data, 125);
}

// Stop showing a data array and display the countdown again
void stop_showing_data(task_handle self) {
  showing_data = false;
  bb_tone_off();
  show_countdown();
}

// Tasks for showing data
void up(task_handle self) {
  show_data(happy, 440);
}

void down(task_handle self) {
  show_data(sad, 523);
}

void left(task_handle self) {
  show_data(surprised, 659);
}

void right(task_handle self) {
  show_data(angry, 880);
}

void select(task_handle self) {
  show_data(exclam, 1046);
}

// Setup
void setup() {
  // Show initial countdown state
  current_total_seconds = (max_hours * 3600) + (max_minutes * 60) + max_seconds;
  show_countdown();
  // Create tasks
  task_create_interval(update_countdown, 1000);
  task_create_event(up, EVENT_PRESS_UP);
  task_create_event(down, EVENT_PRESS_DOWN);
  task_create_event(left, EVENT_PRESS_LEFT);
  task_create_event(right, EVENT_PRESS_RIGHT);
  task_create_event(select, EVENT_PRESS_SELECT);
}