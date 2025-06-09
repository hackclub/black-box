#ifndef HARDWARE_DEFS_H
#define HARDWARE_DEFS_H

// hardware definitions:
#define MATRIX_COL_PIN(i) (4 + i) // 8 col pins
#define MATRIX_ROW_PIN(i) (12 + i) // 8 row pins
#define BUZZER_PIN 2
// first 3 buttons are on gp20,21,22, then the other 2 are on gp26,27
#define BUTTON_PIN(i) (i < 3 ? (i + 20) : (i - 3 + 26))
#define DEBOUNCE_DELAY 150

// logging:
#define DO_DEBUG_LOGGING 1
#if(DO_DEBUG_LOGGING)
#define debug_log(...) Serial.print("[DEBUG]: "); Serial.printf(__VA_ARGS__); Serial.println();
#else
#define debug_log(...)
#endif

#endif