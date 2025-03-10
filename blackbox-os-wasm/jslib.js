// globals: millis, tone, noTone, displayState, updateDisplay, buttonState,
// panic, pullEventActivations

mergeInto(LibraryManager.library, {
  hal_millis: function() {
    return globalThis.millis();
  },
  hal_matrix_set_arr: function(ptr) {
    let arr = new Uint8Array(Module.HEAP8.buffer, ptr, 8);
    //console.log(`Setting matrix to:`);
    //for (let i = 0; i < 8; i++) {
    //    console.log(arr[i].toString(2));
    //}
    // convert the array of ints to an array of arrays of booleans
    for (let i = 0; i < 8; i++) {
      let row = arr[i];
      let paddedByte = row.toString(2).padStart(8, '0');
      //console.log(`Padded byte for ${row}: ${paddedByte}`);
      let result = paddedByte.split('').map(function(bit) {
        return bit === '1';
      });
      //console.log(`Resulting row: ${result}`);
      globalThis.displayState[i] = result;
    }
    //console.log(`Setting display to:`);
    //console.log(displayState);
    globalThis.updateDisplay();
  },
  hal_matrix_get_arr: function(ptr) {
    let arr = new Uint8Array(Module.HEAP8.buffer, ptr, 8);
    // convert an array of arrays of booleans to an array of ints
    for (let i = 0; i < 8; i++) {
      arr[i] = parseInt(globalThis.displayState[i].map(function(bit) {
        return bit ? '1' : '0';
      }).join(''), 2);
    }
  },
  hal_button_get_state: function(button){
    switch (button) {
      case 0:
        return globalThis.buttonState["up"] ? 1 : 0;
      case 1:
        return globalThis.buttonState["down"] ? 1 : 0;
      case 2:
        return globalThis.buttonState["left"] ? 1 : 0;
      case 3:
        return globalThis.buttonState["right"] ? 1 : 0;
      case 4:
        return globalThis.buttonState["select"] ? 1 : 0;
      default:
        return 0;
    }
  },
  hal_tone: function(frequency) {
    console.log(`[jslib] Playing tone at ${frequency} Hz`);
    globalThis.tone(frequency);
  },
  hal_tone_off: function() {
    console.log(`[jslib] Stopping tone`);
    globalThis.noTone();
  },
  hal_console_write: function(ptr) {
    console.log(UTF8ToString(ptr));
    globalThis.consoleWrite(UTF8ToString(ptr));
  },
  hal_panic: function(ptr) {
    const str = UTF8ToString(ptr);
    console.error("[jslib] panic:", str);

    globalThis.panic(str);
  },
  hal_rand: function() {
    return Math.trunc(Math.random() * 65536);
  },
  plat_get_events: function(ptr) {
    let arr = new Uint8Array(Module.HEAP8.buffer, ptr, 32);

    const activs = pullEventActivations();

    for (let i=0; i<activs.length; i++) {
      arr[i] = activs[i];
    }
  }
});
