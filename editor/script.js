/*
  script.js
  Black Box editor main thread
*/

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

let params;

// value of `unlocked` local storage
// has the user confirmed the intro message before?
let unlocked;

let matrix_color;
let oscillator;
let animation_frame;
// spare copy of the matrix's enabled pixels
// this allows us to do instant color changes
let _on_pixels = [];

let messages;
let active_message;

let old_button_state = {
  up: false, 
  down: false,
  left: false,
  right: false,
  select: false,
};

const editor_view = document.querySelector('.cm-editor').querySelector('.cm-content').cmView.view;
const e_q = document.getElementById('q');
const e_reset = document.getElementById('reset');
const e_latin_phrase = document.getElementById('latin_phrase');
const e_editor_version = document.getElementById('editor_version');
const e_feedback = document.getElementById('feedback');
const e_password_container = document.getElementById('password_container');
const e_password = document.getElementById('password');
const e_submit_password = document.getElementById('submit_password');
const e_message_container = document.getElementById('message_container');
const e_message_text_container = document.getElementById('message_text_container');
const e_message_body = document.getElementById('message_body');
const e_confirm_message = document.getElementById('confirm_message');
const e_deny_message = document.getElementById('deny_message');
const e_editor_container = document.getElementById('editor_container');
const e_editor_top_container = document.getElementById('editor_top_container');
const e_editor_bottom_container = document.getElementById('editor_bottom_container');
const e_cm_container = document.getElementById('cm_container');
const e_docs_container = document.getElementById('docs_container');
const e_black_box_container = document.getElementById('black_box_container');
const e_up = document.getElementById('up');
const e_down = document.getElementById('down');
const e_left = document.getElementById('left');
const e_right = document.getElementById('right');
const e_select = document.getElementById('select');
const e_info_container = document.getElementById('info_container');
const e_info = document.getElementById('info');
const e_toggle_running = document.getElementById('toggle_running');
const e_toggle_view = document.getElementById('toggle_view');
const e_change_color = document.getElementById('change_color');
const e_permalink = document.getElementById('permalink');
const e_edit = document.getElementById('edit');
const e_gesture_container = document.getElementById('gesture_container');
const e_status = document.getElementById('status');

const BYPASS_PASSWORD = true;

document.addEventListener('DOMContentLoaded', victus.setup({
  id: 'canvas',
  w: 160,
  h: 160,
  color: '#222',
}));

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
    // e_editor_container.style.animation = '2s linear 0s fade-in-from-zero';
    // only show the message if the user has never seen it before
    if (unlocked === '0') {
      // active_message = messages.soft_launch.show();
      active_message = messages.launch.show();
    }
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
    e_deny_message.disabled = false;
  }
}

e_confirm_message.onclick = function () {
  e_message_container.className = 'dn';
  e_editor_top_container.className = '';
  e_editor_bottom_container.className = '';
  // add a cookie if confirming the intro message
  // if (active_message === messages.soft_launch) {
  if (active_message === messages.launch) {
    localStorage.setItem('unlocked', '1');
    try_show_changes();
  }
  // add a cookie if confirming the latest version message
  if (active_message.name.startsWith('v0')) {
    localStorage.setItem('version', active_message.name);
  }
  // confirm edit
  if (active_message.name === 'confirm_edit') {
    // console.log('[main] user hit Edit - they want to edit the permalink!');
    localStorage.setItem('doc', editor_view.state.doc.toString());
    window.location.href = window.location.href.slice(0, window.location.href.indexOf('?'));
  }
  // confirm reset
  if (active_message.name === 'confirm_reset') {
    localStorage.removeItem('doc');
    window.location.href = window.location.href.slice(0, window.location.href.indexOf('?'));
  }
}

e_deny_message.onclick = function () {
  e_message_container.className = 'dn';
  e_editor_top_container.className = '';
  e_editor_bottom_container.className = '';
  // if (active_message.name === 'confirm_edit') {
  //   console.log("[main] user hit Cancel - they don't want to edit the permalink!");
  // }
}

e_q.onclick = function () {
  // active_message = messages.soft_launch.show();
  active_message = messages.launch.show();
}

e_reset.onclick = function () {
  active_message = messages.confirm_reset.show();
}

function try_show_changes (force = false) {
  const V = e_editor_version.innerHTML;
  const messages_key = V.replaceAll('.', '_');
  if (force) {
    active_message = messages[messages_key].show();
    return;
  }
  if (localStorage.getItem('unlocked') === '1' && localStorage.getItem('version') !== messages_key) {
    active_message = messages[messages_key].show();
  }
}

e_editor_version.onclick = () => try_show_changes(true);

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
  return new Promise((resolve, reject) => {
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
  // TODO: this function doesn't work right
  worker.onerror = function (e) {
    let error = e.message;
    e_status.className = 'error';
    e_status.innerHTML = `Worker error: ${error}`;
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
 * Populate the oscillator if it is undefined.
 */
function populate_oscillator () {
  if (oscillator === undefined) {
    console.log('[main] populating oscillator');
    oscillator = new Tone.Oscillator(0, 'triangle').toDestination();
    oscillator.volume.value = -24;
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        tone([440, 659, 880][i], 63);
      }, (i * 125) + 50);
    }
  }
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
  // FIXME: this is better than last time but still super hacky...
  // fix it at some point?

  let new_button_state = {
    up: (victus.keys.ArrowUp?.held) ?? false,
    down: (victus.keys.ArrowDown?.held) ?? false,
    left: (victus.keys.ArrowLeft?.held) ?? false,
    right: (victus.keys.ArrowRight?.held) ?? false,
    select: (victus.keys.x?.held) ?? false,
  };

  let button_elems = {
    up: e_up,
    down: e_down,
    left: e_left,
    right: e_right,
    select: e_select,
  }

  for (const [button, val] of Object.entries(new_button_state)) {
    if (old_button_state[button] == val) continue;
    
    // button state has changed since last time

    if (val) {
      button_elems[button].className = 'active';
    } else {
      button_elems[button].className = '';
    }

    send_message("button", { button: button, state: val });
  }

  old_button_state = new_button_state;

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
  // chop the filename
  formatted = formatted.replace(/\.\/intermediate_files\/[-A-Za-z0-9-_=]+\.c/g, 'user_code.c');
  // trim to the line that contains "error:"
  let lines = formatted.split('\n');
  let error_line = lines.find(line => line.includes('error:'));
  if (error_line !== undefined) {
    formatted = error_line;
  } else {
    // if there is no line with "error:", just display the first line
    formatted = lines[0];
  }
  return formatted;
}

/**
 * Make a GET request to the Black Box backend.
 * @param {string} route
 * @returns {string|undefined}
 */
async function backend_get (route) {
  const response = await fetch(`https://black-box-backend.a.selfhosted.hackclub.com/${route}`);
  let text;
  if (response.ok) {
    text = await response.text();
  } else {
    throw new Error(`Invalid request: GET /${route}`);
  }
  return text;
}

/**
 * Make a POST request to the Black Box backend.
 * @param {string} route
 * @param {string} body
 * @returns {object|undefined}
 */
async function backend_post (route, body) {
  const response = await fetch(`https://black-box-backend.a.selfhosted.hackclub.com/${route}`, {
    method: 'POST',
    body,
  });
  let json;
  if (response.ok) {
    json = await response.json();
  }
  return json;
}

/**
 * Callback for `#gesture_container` (the button with a speaker emoji).
 * Populate `oscillator`, display `#black_box_container` at full opacity,
 * and play a chime.
 */
// e_gesture_container.onclick = function () {
//   oscillator = new Tone.Oscillator(0, 'triangle').toDestination();
//   oscillator.volume.value = -24;
//   e_gesture_container.className = 'dn';
//   e_black_box_container.classList.replace('oh', 'of');
//   e_black_box_container.style.animation = '1s linear 0s fade-in';
//   if (e_toggle_view.innerHTML === 'View docs') {
//     e_toggle_running.disabled = false;
//   }
//   for (let i = 0; i < 3; i++) {
//     setTimeout(() => {
//       tone([440, 659, 880][i], 63);
//     }, (i * 125) + 50);
//   }
// }

/**
 * Callback for `#toggle_view`.
 * Switch between CodeMirror and the API documentation.
 */
e_toggle_view.onclick = function () {
  if (e_toggle_view.innerHTML === 'View docs') {
    e_docs_container.style.display = 'block';
    e_cm_container.style.display = 'none';
    e_toggle_view.innerHTML = 'View code';
    // e_toggle_running.disabled = true;
  } else {
    e_cm_container.style.display = 'block';
    e_docs_container.style.display = 'none';
    e_toggle_view.innerHTML = 'View docs';
    // if (oscillator !== undefined) {
    //   e_toggle_running.disabled = false;
    // }
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
 * Callback for `#permalink`.
 * Generate a permanent link to the code in the editor.
 */
e_permalink.onclick = async function () {
  const doc = editor_view.state.doc.toString();
  // TODO: rejected case
  backend_post('permagen', doc).then(json => {
    window.location.href = `${window.location.href.split('?')[0]}?code=${json.permacode}`;
  });
}

/**
 * Callback for `#edit`.
 * Display confirmation message.
 */
e_edit.onclick = function () {
  active_message = messages.confirm_edit.show();
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
    await send_message('stop');
    // stop the oscillator
    oscillator.stop();
    // terminate the worker from this thread so everything can resolve
    worker.terminate();
    // update UI
    e_info_container.classList.add('dn');
    e_toggle_running.innerHTML = 'Start';
    e_status.className = 'warning';
    e_status.innerHTML = 'Status: Stopped';
    // e_toggle_view.disabled = false;
    e_change_color.disabled = false;
    // cancel button check animation frame
    window.cancelAnimationFrame(animation_frame);
  } else {
    blank_matrix();
    populate_oscillator();
    try {
      // 1. create worker
      console.log('[main] creating worker...');
      worker = new_worker();
      console.log('[main] finished creating worker');
      // 2. initialize emulator
      await send_message('initialize_emu');
      // 3. compile the code
      e_status.className = 'warning';
      e_status.innerHTML = 'Status: Compiling...';
      await send_message(
        'compile_code',
        { code: editor_view.state.doc.toString() }
      );
      // 5. call main
      await send_message('main');
      // the main message returns immediately, so we can put these lines here again
      console.log('[main] done invoking main');
      // 6. update UI, start checking buttons
      e_info_container.classList.remove('dn');
      e_info.innerHTML = 'Use arrow keys + X';
      e_toggle_running.innerHTML = 'Stop';
      e_status.className = 'success';
      e_status.innerHTML = 'Status: Running';
      // e_toggle_view.disabled = true;
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
  // cookie
  unlocked = localStorage.getItem('unlocked') ?? '0';
  // version check
  try_show_changes();
  // URL parameters
  params = new URLSearchParams(window.location.search);
  if (params.get('code') !== null) {
    backend_get(params.get('code')).then(
      // accepted
      text => {
        console.log('[cm] setting code based on URL parameter');
        editor_view.dispatch({ changes: { from: 0, to: editor_view.state.doc.length, insert: text }});
        e_info_container.classList.remove('dn');
        e_info.innerHTML = `Loaded permalink <span class="mono">${params.get('code')}</span>`;
      },
      // rejected
      reject_reason => {
        window.location.href = window.location.href.slice(0, window.location.href.indexOf('?'));
      }
    );
    e_cm_container.className = 'cna';
    e_toggle_view.className = 'dn';
    e_permalink.className = 'dn';
    e_edit.className = '';
  }
    // rest of the easy stuff
  matrix_color = Number(localStorage.getItem('matrix_color') ?? '0');
  blank_matrix();
  e_latin_phrase.innerHTML = latin_phrases[Math.floor(Math.random() * latin_phrases.length)];
  e_status.innerHTML = 'Status: Not running';
  // automatically fill the password if set to bypass
  // unlocked check
  if (unlocked === '1') {
    console.log('[main] skipping password (editor is unlocked)');
    e_editor_container.classList.remove('dn');
  }
  if (BYPASS_PASSWORD === true) {
    e_password.value = (1+2*2*2*5*31*631*79337).toString(2*2*3*3).toUpperCase();
    submit_password();
  }
  // omitted due to bypass
  // else {
  //   e_editor_container.classList.add('oz');
  //   e_password_container.classList.remove('dn');
  // }
}

init();
