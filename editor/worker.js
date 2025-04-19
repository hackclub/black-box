/*
  worker.js
  Black Box editor worker thread
  Now powered by emscripten and WASM!
*/

// intentionally blank
let compiler_endpoint = "";

let module;
let startTime;
let displayState = [];

for (let i=0; i<8; i++) {
  displayState[i] = new Array(8).fill(false);
}

globalThis.displayState = displayState;

let run = false;
let ticking = false;

let eventActivations = new Array(32).fill(0);

let buttonState = {
  up: false,
  down: false,
  left: false,
  right: false,
  select: false
}

function panic(msg) {
  run = false;

  self.postMessage({ message: 'console_write', text: msg, panic: true });

  setTimeout(() => {
    throw new Error(`panic: ${msg}`);
  }, 0);

  throw new Error(`panic: ${msg}`);
}

globalThis.panic = panic;

globalThis.buttonState = buttonState;

function millis() {
  return Math.floor(performance.now() - startTime);
}

globalThis.millis = millis;

function pullEventActivations() {
  let arr = eventActivations;
  eventActivations = new Array(32).fill(0);

  return arr;
}

globalThis.pullEventActivations = pullEventActivations;

function pushSingleEvent(event_id) {
  console.log("[worker] pushSingleEvent:", event_id);

  eventActivations[event_id]++;

  tickSoon();
}

function tickSoon() {
  ticking = true;
  setTimeout(tickLoop, 0);
}

function tickLoop() {
  if (!run) return;

  let nextTimestamp = module._plat_tick(millis());

  //console.log("[worker]", nextTimestamp);

  // no timers need the event loop to be reticked

  // our 0xFFFFFFFF from js turns into a -1 here, but man i am too tired to
  // figure this out right now...
  if (nextTimestamp == -1) {
    ticking = false;
    return;
  }

  let now = millis();
  let delta = nextTimestamp - now;

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
      if (displayState[y][x]) {
        on_pixels.push(i);
      }
    }
  }

  self.postMessage({ message: 'draw_to_canvas', on_pixels });
}

globalThis.updateDisplay = updateDisplay;

function tone(freq) {
  self.postMessage({ message: 'tone', frequency: freq });
}

globalThis.tone = tone;

function noTone() {
  self.postMessage({ message: 'no_tone' });
}

globalThis.noTone = noTone;

function consoleWrite(s) {
  self.postMessage({ message: 'console_write', text: s, panic: false });
}

globalThis.consoleWrite = consoleWrite;

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
    body: JSON.stringify({ code, compileUF2: false }),
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
  tickSoon();
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

  buttonState[data.button] = data.state;

  const map = {
    "up_press": 0,
    "down_press": 1,
    "left_press": 2,
    "right_press": 3,
    "select_press": 4,
    "up_release": 5,
    "down_release": 6,
    "left_release": 7,
    "right_release": 8,
    "select_release": 9,    
  }

  const id = map[data.button + (data.state ? "_press" : "_release")];

  pushSingleEvent(id);
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
