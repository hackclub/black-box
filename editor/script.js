/*
  script.js
  Black Box editor main thread
*/

document.addEventListener('DOMContentLoaded', victus.setup({
  id: 'canvas',
  w: 160,
  h: 160,
  color: '#222',
}));

let main;
let worker;

const latin_phrases = [
  'Aut viam inveniam aut faciam',
  'Nulla tenaci invia est via',
  'Simplex sigillum veri',
  'Nihil boni sine labore',
  'Vae, puto deus fio',
  'Fiat lux',
  'Absens haeres non erit',
  'Nec dextrorsum, nec sinistrorsum',
];

let unlocked;
let matrix_color;
let oscillator;
let animation_frame;
// spare copy of the matrix's enabled pixels
// this allows us to do instant color changes
let _on_pixels = [];

let messages;
let active_message;

const editor_view = document.querySelector('.cm-editor').querySelector('.cm-content').cmView.view;
const e_q = document.getElementById('q');
const e_latin_phrase = document.getElementById('latin_phrase');
const e_feedback = document.getElementById('feedback');
const e_password_container = document.getElementById('password_container');
const e_password = document.getElementById('password');
const e_submit_password = document.getElementById('submit_password');
const e_message_container = document.getElementById('message_container');
const e_message_text_container = document.getElementById('message_text_container');
const e_message_body = document.getElementById('message_body');
const e_confirm_message = document.getElementById('confirm_message');
const e_editor_container = document.getElementById('editor_container');
const e_editor_top_container = document.getElementById('editor_top_container');
const e_editor_bottom_container = document.getElementById('editor_bottom_container');
const e_cm_container = document.getElementById('cm_container');
const e_docs_container = document.getElementById('docs_container');
const e_black_box_container = document.getElementById('black_box_container');
const e_info_container = document.getElementById('info_container');
const e_info = document.getElementById('info');
const e_toggle_running = document.getElementById('toggle_running');
const e_toggle_view = document.getElementById('toggle_view');
const e_change_color = document.getElementById('change_color');
const e_gesture_container = document.getElementById('gesture_container');
const e_status = document.getElementById('status');

// TODO: make it do that thing where the device buttons light up when you press them

/**
 * Mock header contents.
 */
const blackbox_h = ``;

/**
 * Mock struct definitions.
 * We need these in order to allow declarations of type `Pixel*`, `Matrix*`,
 * `Slice*`, `Piezo*`, and `BlackBox*`.
 */
const blackbox_struct_definitions = `struct Pixel {
  int value;
}

struct Matrix {
  Pixel* pixels[64];
}

struct Slice {
  Pixel** ptr;
  int len;
}

struct BlackBox {
  Matrix* matrix;
}`;

/**
 * Submit a password.
 */
function submit_password() {
  const password = e_password.value;
  console.log(`[main] submitted password '${password}'`);
  if (password === (1+2*2*2*5*31*631*79337).toString(2*2*3*3).toUpperCase()) { // cheated cookies taste awful!
    console.log('[main] password accepted!');
    // e_password.className = 'accepted';
    e_password_container.className = 'dn';
    e_editor_container.classList.remove('dn');
    e_editor_container.classList.replace('oz', 'of');
    e_editor_container.style.animation = '2s linear 0s fade-in-from-zero';
    active_message = messages.soft_launch.show();
  } else {
    console.log('[main] password denied!');
    e_password.className = 'denied';
  }
}

e_password.onkeydown = function (e) {
  if (e_password.className === 'denied') {
    e_password.className = '';
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    submit_password();
  }
};

e_submit_password.onclick = submit_password;

window.onresize = e_message_text_container.onscroll = function () {
  if (e_message_text_container.scrollTop + e_message_text_container.clientHeight >= e_message_text_container.scrollHeight - 20) {
    e_confirm_message.disabled = false;
  }
}

e_confirm_message.onclick = function () {
  e_message_container.className = 'dn';
  e_editor_top_container.className = '';
  e_editor_bottom_container.className = '';
  // add a cookie if confirming `messages.soft_launch` for the first time
  if (active_message === messages.soft_launch) {
    localStorage.setItem('unlocked', '1');
  }
}

e_q.onclick = function () {
  active_message = messages.soft_launch.show();
}

e_feedback.onclick = function () {
  active_message = messages.feedback.show();
}

/**
 * Return a Promise which sends a message to the worker thread, resolving if it
 * succeeds and rejecting if it throws an error.
 * This allows us to properly wait for each emulation step to resolve before
 * moving to the next one.
 * @param {string} message Message type.
 * @param {object} [data] Message data.
 */
function send_message (message, data = {}) {
  let _resolve, _reject;
  const promise = new Promise((resolve, reject) => {
    _resolve = resolve;
    _reject = reject;
    const channel = new MessageChannel();
    channel.port1.onmessage = e => {
      channel.port1.close();
      if (e.data.error) {
        reject(e.data.error);
      } else {
        resolve(e.data.result);
      }
    };
    worker.postMessage({ message, ...data }, [channel.port2]);
  });
  return {
    promise,
    resolve: _resolve,
    reject: _reject,
  };
}

/**
 * Create a new worker.
 */
function new_worker () {
  const worker = new Worker('worker.js', { type: 'module' });
  worker.onmessage = function (e) {
    console.log(`[main] worker thread says: ${e.data.message}`);
    if (e.data.message === 'draw_to_canvas') {
      draw_to_canvas(e.data.on_pixels);
    }
    if (e.data.message === 'tone') {
      oscillator.frequency.value = e.data.frequency;
      if (oscillator.state === 'stopped') {
        oscillator.start();
      }
    }
    if (e.data.message === 'no_tone') {
      oscillator.stop();
    }
  };
  worker.onerror = function (e) {
    error = e.message;
    e_status.className = 'error';
    e_status.innerHTML = `Worker error: ${error}`;
    running = false;
  };
  return worker;
}

/**
 * Draw the matrix to the canvas with all pixels turned off.
 */
function blank_matrix () {
  victus.clear();
  victus.ctx.fillStyle = '#444';
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      victus.ctx.beginPath();
      victus.ctx.ellipse((x * 20) + 10, (y * 20) + 10, 7, 7, 0, 0, 2 * Math.PI);
      victus.ctx.fill();
    }
  }
}

/**
 * Draw the matrix to the canvas with the pixels at the provided indices turned on.
 * @param {number[]} on_pixels
 */
function draw_to_canvas (on_pixels) {
  victus.clear();
  const c = ['#ef654d', '#fbb601', '#c7e916'][matrix_color];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const i = (y * 8) + x;
      if (on_pixels.includes(i)) {
        victus.ctx.fillStyle = c;
      } else {
        victus.ctx.fillStyle = '#444';
      }
      victus.ctx.beginPath();
      victus.ctx.ellipse((x * 20) + 10, (y * 20) + 10, 7, 7, 0, 0, 2 * Math.PI);
      victus.ctx.fill();
    }
  }
  // set this file's version of on_pixels
  _on_pixels = on_pixels;
}

/**
 * Start the oscillator at a specific frequency.
 * If `ms` is provided, the oscillator will stop after `ms` milliseconds.
 * @param {number} frequency
 * @param {number} [ms]
 */
function tone (frequency, ms) {
  oscillator.frequency.value = frequency;
  oscillator.stop();
  oscillator.start();
  if (ms !== undefined) {
    setTimeout(no_tone, ms);
  }
}

/**
 * Stop the oscillator.
 */
function no_tone () {
  oscillator.stop();
}

/**
 * Check the state of the buttons.
 */
async function check_buttons () {
  if (victus.keys.ArrowUp?.press) {
    await send_message('up').promise;
  } else if (victus.keys.ArrowDown?.press) {
    await send_message('down').promise;
  } else if (victus.keys.ArrowLeft?.press) {
    await send_message('left').promise;
  } else if (victus.keys.ArrowRight?.press) {
    await send_message('right').promise;
  } else if (victus.keys.x?.press) {
    await send_message('select').promise;
  }
  Object.keys(victus.keys).forEach(key => victus.keys[key].press = false);
  animation_frame = window.requestAnimationFrame(check_buttons);
}

/**
 * Format an error message.
 * @param {string} message
 * @returns {string}
 */
function format (message) {
  // make any parts of the message surrounded by backticks monospace
  let formatted = message.replace(/`(.+?)`/g, '<span class="mono">$1</span>');
  // fix the thing that cparse does
  // note to self: make sure cparse's `pos.file` stays empty, otherwise this regex
  // will have to change
  const cparse_message_start = formatted.match(/:(\d+):/);
  if (cparse_message_start !== null) {
    const cparse_line_number = Number(cparse_message_start[1]);
    // correct for all the extra stuff we add to the code
    const ln = cparse_line_number - blackbox_h.split('\n').length - blackbox_struct_definitions.split('\n').length - 2;
    formatted = formatted.replace(cparse_message_start[0], '');
    formatted = `${formatted} (line ${ln})`;
  }
  return formatted;
}

/**
 * Callback for `#gesture_container` (the button with a speaker emoji).
 * Populate `oscillator`, display `#black_box_container` at full opacity,
 * and play a chime.
 */
e_gesture_container.onclick = function () {
  oscillator = new Tone.Oscillator(0, 'triangle').toDestination();
  oscillator.volume.value = -24;
  e_gesture_container.className = 'dn';
  e_black_box_container.classList.replace('oh', 'of');
  e_black_box_container.style.animation = '1s linear 0s fade-in';
  if (e_toggle_view.innerHTML === 'View docs') {
    e_toggle_running.disabled = false;
  }
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      tone([440, 659, 880][i], 63);
    }, (i * 125) + 50);
  }
}

/**
 * Callback for `#toggle_view`.
 * Switch between CodeMirror and the API documentation.
 */
e_toggle_view.onclick = function () {
  if (e_toggle_view.innerHTML === 'View docs') {
    e_docs_container.style.display = 'block';
    e_cm_container.style.display = 'none';
    e_toggle_view.innerHTML = 'View code';
    e_toggle_running.disabled = true;
  } else {
    e_cm_container.style.display = 'block';
    e_docs_container.style.display = 'none';
    e_toggle_view.innerHTML = 'View docs';
    if (oscillator !== undefined) {
      e_toggle_running.disabled = false;
    }
  }
}

/**
 * Callback for `#change_color`.
 */
e_change_color.onclick = function () {
  matrix_color = (matrix_color + 1) % 3;
  localStorage.setItem('matrix_color', JSON.stringify(matrix_color));
  e_info_container.classList.remove('dn');
  e_info.innerHTML = `Changed color to ${['red', 'yellow', 'green'][matrix_color]}`;
  draw_to_canvas(_on_pixels);
}

/**
 * Callback for `#toggle_running`.
 * Start and stop the emulator.
 */
e_toggle_running.onclick = async function () {
  // don't want to try running before we're ready!
  if (e_status.innerHTML === 'Loading...') {
    return;
  }
  if (e_toggle_running.innerHTML === 'Stop') { // same behavior without a boolean `running`
    // stop the emulator
    main.resolve();
    await send_message('stop').promise;
    // stop the oscillator
    oscillator.stop();
    // terminate the worker from this thread so everything can resolve
    worker.terminate();
    // update UI
    e_info_container.classList.add('dn');
    e_toggle_running.innerHTML = 'Start';
    e_status.className = 'warning';
    e_status.innerHTML = 'Status: Stopped';
    e_toggle_view.disabled = false;
    e_change_color.disabled = false;
    // cancel button check animation frame
    window.cancelAnimationFrame(animation_frame);
  } else {
    blank_matrix();
    try {
      // 1. create worker
      console.log('[main] time to start running!');
      console.log('[main] creating worker...');
      worker = new_worker();
      console.log('[main] finished creating worker');
      // 2. create emulator
      await send_message('create_emu').promise;
      // 3. create AST
      await send_message(
        'create_ast',
        { doc: blackbox_h + '\n\n' + blackbox_struct_definitions + '\n\n' + editor_view.state.doc.toString() }
      ).promise;
      // 4. run checks on the AST
      await send_message('sanity_check').promise;
      // 5. convert the AST to JavaScript
      await send_message('convert_ast').promise;
      // 6. eval each
      await send_message('eval_ast').promise;
      // 7. replace the matrix with a deeply nested proxy
      await send_message('create_matrix_proxy').promise;
      // 8. call main
      main = send_message('main');
      await main.promise;
      // the main message returns immediately, so we can put these lines here again
      // TODO: does this mean `send_message` can return the Promise
      // instead of a messy object?
      // 9. update UI, start checking buttons
      e_info_container.classList.remove('dn');
      e_info.innerHTML = 'Use arrow keys + X';
      e_toggle_running.innerHTML = 'Stop';
      e_status.className = 'success';
      e_status.innerHTML = 'Status: Running';
      e_toggle_view.disabled = true;
      e_change_color.disabled = true;
      Object.keys(victus.keys).forEach(key => victus.keys[key].press = false);
      animation_frame = window.requestAnimationFrame(check_buttons);
    } catch (e) {
      e_toggle_running.innerHTML = 'Start';
      e_status.className = 'error';
      e_status.innerHTML = `Error: ${format(e.message)}`;
      console.log(e.stack);
    }
  }
}

async function init () {
  // hate this
  const messages_js = await import('./messages.js');
  messages = messages_js.default;
  // rest of the easy stuff
  unlocked = localStorage.getItem('unlocked') ?? '0';
  matrix_color = Number(localStorage.getItem('matrix_color') ?? '0');
  blank_matrix();
  e_latin_phrase.innerHTML = latin_phrases[Math.floor(Math.random() * latin_phrases.length)];
  e_status.innerHTML = 'Status: Not running';
  // unlocked check
  if (unlocked === '1') {
    console.log('[main] skipping password (editor is unlocked)');
    e_editor_container.classList.remove('dn');
  } else {
    e_editor_container.classList.add('oz');
    e_password_container.classList.remove('dn');
  }
}

init();