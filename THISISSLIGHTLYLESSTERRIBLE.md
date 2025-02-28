so.

this works a little better now.

to run:
1. `npm i`
2. `npm start`
3. visit `localhost:3000`

example code:
```c
#include "hal.h"
#include <emscripten.h>

uint8_t smiley[8] = {
    0b01111110,
    0b11111111,
    0b10111101,
    0b10111101,
    0b11111111,
    0b10111101,
    0b11000011,
    0b01111110
};

EMSCRIPTEN_KEEPALIVE
int test_stuff(int argc, char** argv) {
    hal_console_write("Hello, world!\n");
    unsigned long start = hal_millis();
    while (hal_millis() - start < 1000) {}
    hal_console_write("One second has passed!\n");
    hal_matrix_set_arr(smiley);
  return 0;
}

```
here are some (hopefully most) of the things you'll need to fix if you want to use this in prod:
* actually implement the api/event loop/planned architechture. right now, this just shoves the user code into the place of plat_main_wasm.c. no event loop, no scheduling, no nothing. Once this is done, it should be plugged into the `os-test` folder and then the `/compile` route should be reworked to put the user code in the correct place.
* add full hal support. i just implemented enough to get the example code to work. this involves linking up the code in `jslib.js` with the rest of the interface.
* get rid of the dependence on `globalThis`. somebody who understands the editor code better than me can figure out where the correct place for all the loading code to go is, right now it's crammed around line 582 in `editor/script.js`
* The compilation server now works for multiple users! todo: periodically clean the `intermediate_files` directory of old compilations.