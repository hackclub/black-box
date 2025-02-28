#include "hal.h"
#include "executor_private.h"
#include "user.h"

#include <stdio.h>
#include <emscripten.h>

EMSCRIPTEN_KEEPALIVE
void plat_init() {
  executor_init();
  setup(); // call into user setup
}

EMSCRIPTEN_KEEPALIVE
unsigned int plat_tick(unsigned int current_time) {
  // TODO: handle properly
  uint8_t events[32] = {0};

  uint32_t next_ts = executor_tick_loop(current_time, events);

  return next_ts;
}
