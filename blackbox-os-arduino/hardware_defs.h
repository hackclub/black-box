#ifndef HARDWARE_DEFS_H
#define HARDWARE_DEFS_H

// hardware definitions:
#define MATRIX_COL_PIN_START 4 // 8 col pins
#define MATRIX_ROW_PIN_START 12 // 8 row pins
#define BUZZER_PIN 2
#define BUTTON_PIN_START 20// 5 button pins

// logging:
#define DO_DEBUG_LOGGING 1
#if(DO_DEBUG_LOGGING)
#define debug_log(...) Serial.print("[DEBUG]: "); Serial.printf(__VA_ARGS__); Serial.println();
#else
#define debug_log(...)
#endif

#endif