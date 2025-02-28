#include "hal.h"
#include "executor_private.h"
#include "user.h"

#include <stdio.h>
#include <emscripten.h>

EMSCRIPTEN_KEEPALIVE
void plat_init() {
  hal_console_write("in the plat init woooo");
  hal_console_write("setting up that executor");
  executor_init();
  hal_console_write("calling that user code");
  setup(); // call into user setup
  hal_console_write("we are good to go!");
}

EMSCRIPTEN_KEEPALIVE
unsigned int plat_tick(unsigned int current_time) {
  hal_console_write("in the plat tick woooo");

  // TODO: handle properly
  uint8_t events[32] = {0};

  uint32_t next_ts = executor_tick_loop(current_time, events);

  printf("%u\n", next_ts);

  return next_ts;
}
