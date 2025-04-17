#include <cstdint>
#include "hardware_defs.h"

namespace blackbox{
    extern "C" {
        #include "executor_private.h"
    }
}
namespace user {
    extern "C" {
        #include "user.h"
#include <string.h>
    }
}
namespace hal {
    extern "C" {
        #include "hal.h"
    }
}

/*
events is an array of 32 counters. each counter counts how many times the corresponding event has occurred.
right now, only the first 10 event counters are in use:
up_press, down_press, left_press, right_press, select_press, up_release, down_release, left_release, right_release, select_release
*/
volatile uint8_t events[32];

template <uint8_t ButtonIndex>
void ISR_ButtonEvent() {
    static_assert(ButtonIndex < 5, "There should be no more than 5 buttons.");
    // TODO: debounce?
    if (digitalRead(BUTTON_PIN_START + ButtonIndex) == HIGH) {
        events[ButtonIndex + 5]++;
    } else {
        events[ButtonIndex]++;
    }
}

// this is a define to be less repetitive, it can't be a for loop because
// the ISR needs to be a template function
// there's probably a better way to do this but this'll work for now
#define SETUP_BUTTON_PIN(i) \
pinMode(BUTTON_PIN_START + (i), INPUT_PULLUP); \
attachInterrupt(digitalPinToInterrupt(BUTTON_PIN_START + (i)), ISR_ButtonEvent<(i)>, CHANGE);

void setup(){
    Serial.begin(115200);
    // inputs and ISRs
    SETUP_BUTTON_PIN(0);
    SETUP_BUTTON_PIN(1);
    SETUP_BUTTON_PIN(2);
    SETUP_BUTTON_PIN(3);
    SETUP_BUTTON_PIN(4);

    // buzzer
    pinMode(BUZZER_PIN, OUTPUT);

    blackbox::executor_init();
    user::setup(); // call into user setup
}

uint8_t events_copy[32];
unsigned int plat_tick(unsigned int current_time) {
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
    // todo: inputs, tick, etc.

  uint32_t nextTimestamp = plat_tick(millis());

  //console.log("[worker]", nextTimestamp);

  // no timers need the event loop to be reticked

  if (nextTimestamp == 0xFFFFFFFF) {
    //ticking = false;
    return;
  }

  uint32_t now = millis();
  uint32_t delta = nextTimestamp - now;

  if (delta <= 0) delta = 0;

  delay(delta);
}

// multicore!
// use the second core to constantly refresh the LED matrix
void setup1() {
    // matrix pins
    // PERF: could reimplement this with PIO for best speed
    for (int i = 0; i < 8; i++) {
        pinMode(MATRIX_COL_PIN_START + i, OUTPUT);
        digitalWrite(MATRIX_COL_PIN_START + i, LOW);
    }
    for (int i = 0; i < 8; i++) {
        pinMode(MATRIX_ROW_PIN_START + i, OUTPUT);
        digitalWrite(MATRIX_ROW_PIN_START + i, LOW);
    }
}

void loop1() {
    // write to the led matrix
    for (int i = 0; i < 8; i++) {
        // FIXME: ok i have to leave it at this for now
        // but this is one of many failed attempts to find a way
        // to communicate out of the HAL space into the main sketch space
        // without changing common APIs
        // more work needed here
        uint8_t row_val = hal::ardu_matrix_state[i];
        for (int j = 0; j < 8; j++) {
            if (row_val & (1 << (7 - j))) {
                digitalWrite(MATRIX_ROW_PIN_START + j, HIGH);
            } else {
                digitalWrite(MATRIX_ROW_PIN_START + j, LOW);
            }
        }
        digitalWrite(MATRIX_COL_PIN_START + i, HIGH);
        // 125Hz cycle
        delay(1); // delay to allow the leds to turn on
        digitalWrite(MATRIX_COL_PIN_START + i, LOW);
    }
}