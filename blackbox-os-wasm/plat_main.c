#include "hal.h"
#include "executor_private.h"
#include "user.h"

#include <stdint.h>
#include <stdio.h>
#include <emscripten.h>

EMSCRIPTEN_KEEPALIVE
void plat_init() {
  executor_init();
  user_setup(); // call into user setup
}

extern void plat_get_events(uint8_t* events);

EMSCRIPTEN_KEEPALIVE
unsigned int plat_tick(unsigned int current_time) {
  uint8_t events[32];
  plat_get_events(events);

  uint32_t next_ts = executor_tick_loop(current_time, events);

  return next_ts;
}
