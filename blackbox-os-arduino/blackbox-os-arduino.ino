#include <cstdint>

namespace blackbox{
    extern "C" {
        #include "executor_private.h"
    }
}
namespace user {
    extern "C" {
        #include "user.h"
    }
}
void setup(){
    Serial.begin(115200);
    blackbox::executor_init();
    user::setup(); // call into user setup
}

void plat_get_events(uint8_t* events) {
    // This function is called from the executor to get the events.
    // In this case, we are just returning a dummy event.
    for (int i = 0; i < 32; i++) {
        events[i] = 0;
    }
}

unsigned int plat_tick(unsigned int current_time) {
    uint8_t events[32];
    plat_get_events(events);
  
    uint32_t next_ts = blackbox::executor_tick_loop(current_time, events);
  
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