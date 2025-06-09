#include <cstdint>
#include "hardware_defs.h"
#include <string.h>
namespace blackbox{
    extern "C" {
        #include "executor_private.h"
    }
}

namespace user {
    extern "C" {
        #include "user.h"
        #include USER_CODE_LIB
    }
}
namespace hal {
    extern "C" {
        #include "hal.h"
    }
}

bool ticking = true;

/*
events is an array of 32 counters. each counter counts how many times the corresponding event has occurred.
right now, only the first 10 event counters are in use:
up_press, down_press, left_press, right_press, select_press, up_release, down_release, left_release, right_release, select_release
*/
volatile uint8_t events[32];
volatile uint32_t button_debounce_times[5] = {0, 0, 0, 0, 0};
template <uint8_t ButtonIndex>
void ISR_ButtonEvent() {
    static_assert(ButtonIndex < 5, "There should be no more than 5 buttons.");
    // debounce the button
    uint32_t now = millis();
    if (now - button_debounce_times[ButtonIndex] < DEBOUNCE_DELAY) {
        return;
    }
    button_debounce_times[ButtonIndex] = now;
    // check if the button is pressed or released
    if (digitalRead(BUTTON_PIN(ButtonIndex)) == HIGH) {
        events[ButtonIndex + 5]++;
        debug_log("Button %u released, that event is now %u", ButtonIndex, events[ButtonIndex + 5]);
    } else {
        events[ButtonIndex]++;
        debug_log("Button %u pressed, that event is now %u", ButtonIndex, events[ButtonIndex]);
    }

    // run the event loop again in case smth was waiting for a button
    ticking = true;
}

// this is a define to be less repetitive, it can't be a for loop because
// the ISR needs to be a template function
// there's probably a better way to do this but this'll work for now
#define SETUP_BUTTON_PIN(i) \
pinMode(BUTTON_PIN(i), INPUT_PULLUP); \
attachInterrupt(digitalPinToInterrupt(BUTTON_PIN(i)), ISR_ButtonEvent<(i)>, CHANGE);

void setup(){
    Serial.begin(115200);
    debug_log("Starting up...");
    // inputs and ISRs
    SETUP_BUTTON_PIN(0);
    SETUP_BUTTON_PIN(1);
    SETUP_BUTTON_PIN(2);
    SETUP_BUTTON_PIN(3);
    SETUP_BUTTON_PIN(4);

    // buzzer
    pinMode(BUZZER_PIN, OUTPUT);

    debug_log("initting executor...");
    blackbox::executor_init();
    debug_log("starting user code...");
    user::user_setup(); // call into user setup
}

uint8_t events_copy[32];
unsigned int plat_tick(unsigned int current_time) {
    debug_log("plat_tick: %u", current_time);

    noInterrupts();
    for (int i = 0; i < 32; i++) {
        events_copy[i] = events[i];
        events[i] = 0;
    }
    interrupts();
    
    uint32_t next_ts = blackbox::executor_tick_loop(current_time, events_copy);
  
    return next_ts;
}  

void loop(){
  if (!ticking){
    return;
  }
  uint32_t nextTimestamp = plat_tick(millis());
  
  debug_log("next timestamp is %x, in %u ms", nextTimestamp, nextTimestamp - millis());

  // no timers need the event loop to be reticked

  if (nextTimestamp == 0xFFFFFFFFUL) {
    debug_log("no timers need the event loop to be reticked, waiting for interrupts...");
    ticking = false;
    return;
  }

  uint32_t now = millis();
  uint32_t delta = nextTimestamp - now;

  if (nextTimestamp <= now) delta = 0;

  while(millis()<now+delta){
  if(ticking){
    // there’s been an event that we need to handle
    break;
  }
}
}

// an array to hold the current state of the matrix
uint8_t ardu_matrix_state[8];
// multicore!
// use the second core to constantly refresh the LED matrix
void setup1() {
    // matrix pins
    // PERF: could reimplement this with PIO for best speed
    for (int i = 0; i < 8; i++) {
        pinMode(MATRIX_COL_PIN(i), OUTPUT);
        // TODO: should this come back?
        // digitalWrite(MATRIX_COL_PIN(i), LOW);
    }
    for (int i = 0; i < 8; i++) {
        pinMode(MATRIX_ROW_PIN(i), OUTPUT);
        digitalWrite(MATRIX_ROW_PIN(i), LOW);
    }
}

void loop1() {
    if(rp2040.fifo.available() > 0){
        debug_log("Matrix FIFO available: %u", rp2040.fifo.available());
        // read the state of the matrix from the FIFO
        // the 8 LSBs are the row, the next 3 are the row idx
        uint32_t fifo_val;
        while(rp2040.fifo.pop_nb(&fifo_val)){
            uint8_t row_idx = (fifo_val >> 8) & 0x07;
            uint8_t row_val = fifo_val & 0xFF;
            ardu_matrix_state[row_idx] = row_val;
        }
        debug_log("New matrix state: %x %x %x %x %x %x %x %x", 
            ardu_matrix_state[0], ardu_matrix_state[1], ardu_matrix_state[2], 
            ardu_matrix_state[3], ardu_matrix_state[4], ardu_matrix_state[5], 
            ardu_matrix_state[6], ardu_matrix_state[7]);
    }
    // write to the led matrix
    for (int i = 0; i < 8; i++) {
        uint8_t row_val = ardu_matrix_state[i];
        for (int j = 0; j < 8; j++) {
            if (row_val & (1 << (7 - j))) {
                // the display is common cathode, so HIGH is on and LOW is off
                digitalWrite(MATRIX_COL_PIN(j), HIGH);
            } else {
                digitalWrite(MATRIX_COL_PIN(j), LOW);
            }
        }
        digitalWrite(MATRIX_ROW_PIN(i), LOW);
        // 125Hz cycle
        delay(1); // delay to allow the leds to turn on
        digitalWrite(MATRIX_ROW_PIN(i), HIGH);
    }
}