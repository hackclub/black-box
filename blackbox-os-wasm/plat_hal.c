/*
 * plat_hal.c: WASM implementation of the hardware abstraction layer.asm
 * This is just telling C that these funcs exist - in reality, they're all
 * implemented in js/plat_hal.js.
*/

#include "hal.h"

extern uint32_t hal_millis();

extern void hal_matrix_set_arr(uint8_t arr[8]);

extern void hal_matrix_get_arr(uint8_t out_arr[8]);

extern hal_button_state hal_button_get_state(hal_button button);

extern void hal_tone(uint16_t frequency);

extern void hal_tone_off();

extern void hal_console_write(char* str);

extern void hal_panic(const char* str);

// these are no-ops on wasm

void hal_critical_enter() {};
void hal_critical_exit() {};
