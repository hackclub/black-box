/*
  worker.js
  Black Box editor worker thread
  Now powered by emscripten and WASM!
*/

// intentionally blank
let compiler_endpoint = "";

let module;
let startTime;
let displayState = new Array(64).fill(false);

let run = false;
let ticking = false;

let buttonState = {
  up: false,
  down: false,
  left: false,
  right: false,
  select: false
}

function millis() {
  return Math.floor(performance.now() - startTime);
}

function tickLoop() {
  if (!run) return;

  let nextTimestamp = module._plat_tick(millis());

  console.log("[worker]", nextTimestamp);

  // no timers need the event loop to be reticked

  // our 0xFFFFFFFF from js turns into a -1 here, but man i am too tired to
  // figure this out right now...
  if (nextTimestamp == -1) {
    ticking = false;
    return;
  }

  let now = millis();
  let delta = now - nextTimestamp;

  if (delta <= 0) delta = 0;

  setTimeout(tickLoop, delta);
}

/**
 * Create an array containing the indices of every pixel in the matrix that's
 * turned on, and send a message `draw_to_canvas` to the main thread telling
 * it to update the canvas.
 */
function updateDisplay() {
  const on_pixels = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const i = (y * 8) + x;
      if (displayState[i].is_on()) {
        on_pixels.push(i);
      }
    }
  }

  self.postMessage({ message: 'draw_to_canvas', on_pixels });
}

function tone(freq) {
  self.postMessage({ message: 'tone', frequency: freq });
}

function noTone() {
  self.postMessage({ message: 'no_tone' });
}

/**
 * Create a new message.
 * @param {function} cb
 */
function new_message(cb) {
  return function (event, args) {
    let cb2 = cb;
    // PATCH: walter min: allow new_message to be async
    cb2(args).then(result => {
      event.ports[0].postMessage({ result });
    }).catch(error => {
      event.ports[0].postMessage({ error });
    });
  }
}

/**
 * Return an object containing every message passed as an argument.
 * This is understood to be a collection of all the types of messages that
 * this thread can receive from the main thread.
 * @param  {...function} callbacks
 * @returns {object}
 */
function create_messages(...callbacks) {
  return Object.fromEntries(callbacks.map(cb => [cb.name, new_message(cb)]));
}

/**
 * Callback for `compile_code` message.
 * Compile the C code provided in `args`.
 * @param {object} args
 * @param {string} args.code
 */
async function compile_code(args) {
  const code = args.code;

  console.log('[worker] compiling wasm');

  // grab the code and send it to the compiler
  const response = await fetch(compiler_endpoint + "/compile", {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const { error, codeId } = await response.json();
  if (error) {
    console.log(error);
    throw new Error(error);
  }
  // now, load user_out.js from the compiler as a js module
  const user_out = await import(compiler_endpoint + `/intermediate_files/${codeId}.js`);
  console.log("[worker] user_out loaded");
  module = await user_out.default();
  console.log("[worker] Module initialized");

  console.log("[main] test stuff done");
}

/**
 * Callback for `initialize_emu` message.
 * Initialize the emulator state.
 */
async function initialize_emu() {
  console.log('[worker] initalizing emulator...');

  startTime = performance.now();
  
  console.log('[worker] finished initalizing emulator');
}

/**
 * Callback for `main` message.
 * Start the compiled code.
 * This message returns immediately, but the main function may continue running
 * for much longer.
 */
async function main() {
  console.log('[worker] starting...');

  run = true;
  ticking = true;

  console.log("[worker] plat init...");
  module._plat_init();
  console.log("[worker] ok!");


  console.log("[worker] entering tickloop");
  tickLoop();
}

/**
 * Callback for `button` message.
 * @param data object
 * @param data.button string
 * @param data.state boolean
 */
async function button(data) {
  if (!run) {
    console.log('[worker] skipping button (emulator is not running)');
    return;
  }

  // TODO: fire event to event loop
}

/**
 * Callback for `stop` message.
 * Stop the emulator.
 */
async function stop() {
  console.log('[worker] stopping...');

  run = false;
}

const messages = create_messages(
  initialize_emu,
  compile_code,
  main,
  button,
  stop,
);

self.addEventListener('message', event => {
  const { message, ...args } = event.data;
  console.log(`[worker] main thread says: ${message}`);
  const cb = messages[message];
  if (cb !== undefined) {
    cb(event, args);
  }
}, false);
