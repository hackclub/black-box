document.addEventListener('DOMContentLoaded', victus.setup({
  id: 'canvas',
  w: 160,
  h: 160,
  color: '#222',
}));

/*
  AERE PERENNIUS
*/

const eG = document.getElementById('gesture_container');
const eM = document.getElementById('canvas_container');
const eC = document.getElementById('controls_container');

eG.onclick = function() {
  piezo = new Piezo;
  for (let eX of [eG, eM, eC]) {
    let cf = eX.classList.contains('dv') ? 'dv' : 'dn';
    let ct = cf === 'dv' ? 'dn' : 'dv';
    eX.classList.replace(cf, ct);
    eX.style.animation = ct === 'dv' ? '1s linear 0s fade-in' : '';
  }
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      piezo?.tone([Note.A4, Note.E5, Note.A5][i], 63);
    }, (i * 125) + 50);
  }
  window.requestAnimationFrame(fI);
}

let aI = [];

const DH = [126, 255, 189, 189, 255, 189, 195, 126];
const DS = [126, 255, 189, 189, 255, 195, 189, 126];
const DO = [126, 255, 189, 189, 231, 219, 219, 102];
const DA = [126, 255, 189, 219, 189, 255, 195, 126];
const DX = [0, 102, 102, 102, 102, 0, 102, 0];

const Note = {
  A4: 440,
  C5: 523,
  E5: 659,
  A5: 880,
  C6: 1046,
  E6: 1318,
}

class Pixel {
  constructor () {
    this.value = 0;
  }
  is_on () {
    return this.value === 1;
  }
  is_off () {
    return this.value === 0;
  }
  turn_on () {
    this.value = 1;
  }
  turn_off () {
    this.value = 0;
  }
  set_from_integer (n) {
    this.value = n;
  }
}

class Matrix {
  constructor () {
    this.pixels = Array(64).fill(0).map(x => new Pixel);
    this.color = ['#ff3411', '#fbb601', '#c7e916'][Math.floor(Math.random() * 3)];
  }
  pixel (n) {
    return this.pixels[n];
  }
  pixel_xy (x, y) {
    return this.pixels[(y * 8) + x];
  }
  row (n) {
    return new MatrixSlice(n * 8, (n * 8) + 7, this);
  }
  slice (start, end) {
    return new MatrixSlice(start, end, this);
  }
  turn_all_on () {
    this.pixels.forEach(pixel => pixel.turn_on());
  }
  turn_all_off () {
    this.pixels.forEach(pixel => pixel.turn_off());
  }
  set_from_bit_array (bit_array) {
    this.pixels.forEach((pixel, index) => {
      if (bit_array[index] === 0) {
        pixel.turn_off();
      } else {
        pixel.turn_on();
      }
    });
  }
  set_from_integers (ns) {
    ns.forEach((n, i) => this.row(i).set_from_integer(n));
  }
  draw_to_canvas () {
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (this.pixel_xy(x, y).is_on()) {
          victus.ctx.fillStyle = this.color;
        } else {
          victus.ctx.fillStyle = '#444';
        }
        victus.ctx.beginPath();
        victus.ctx.ellipse((x * 20) + 10, (y * 20) + 10, 7, 7, 0, 0, 2 * Math.PI);
        victus.ctx.fill();
      }
    }
  }
}

class MatrixSlice extends Matrix {
  constructor (start, end, matrix) {
    super();
    this.start = start;
    this.end = end;
    this.pixels = matrix.pixels.slice(this.start, this.end + 1); // inclusive slice
    this._matrix = matrix;
  }
  slice (start, end) {
    return new MatrixSlice(this.start + start, this.start + end, this._matrix);
  }
  set_from_integer (n) {
    this.turn_all_off();
    const bit_string = (n >>> 0).toString(2).padStart(this.length, '0');
    const bit_array = bit_string.split('').map(Number);
    this.set_from_bit_array(bit_array);
  }
  get length () {
    return this.pixels.length;
  }
}

class Piezo {
  constructor () {
    this.osc = new Tone.Oscillator(0, 'triangle').toDestination();
    this.osc.volume.value = -24;
  }
  tone (frequency, ms) {
    this.osc.frequency.value = frequency;
    this.osc.stop();
    this.osc.start();
    if (ms !== undefined) {
      setTimeout(() => this.no_tone(), ms);
    }
  }
  no_tone () {
    this.osc.stop();
  }
}

function fUT () {
  const N = new Date;
  const U = E.getTime() - N.getTime();
  if (U < -2000) {
    return;
  }
  victus.clear();
  const e = Math.floor(U / 86_400_000);
  const H = Math.floor((U - (e * 86_400_000)) / 3_600_000);
  const M = Math.floor((U - (e * 86_400_000) - (H * 3_600_000)) / 60_000);
  const S = Math.floor((U - (e * 86_400_000) - (H * 3_600_000) - (M * 60_000)) / 1000);
  if (e === 0 && H === 0 && M === 0 && S === 0) {
    fXX();
    return;
  }
  se.set_from_integer(e);
  sH.set_from_integer(H);
  sM.set_from_integer(M);
  sS.set_from_integer(S);
  matrix.draw_to_canvas();
}

function fUD (D, B) {
  clearInterval(IfUT);
  IfUT = undefined;
  victus.clear();
  matrix.set_from_integers(D);
  matrix.draw_to_canvas();
  B.classList.add('active');
  setTimeout(() => {
    victus.clear();
    matrix.turn_all_off();
    matrix.draw_to_canvas();
    B.classList.remove('active');
  }, 250);
}

function fFC () {
  if (aI.length === 5 && aI.every((x, i) => x === i)) {
    clearInterval(IfUT);
    IfUT = undefined;
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        victus.clear();
        matrix.set_from_integers(DX);
        matrix.draw_to_canvas();
        piezo?.tone(Note.C6, 125);
      }, (i * 250) + 500);
      setTimeout(() => {
        victus.clear();
        matrix.turn_all_off();
        matrix.draw_to_canvas();
      }, (i * 250) + 625);
    }
    setTimeout(() => {
      fUT();
      IfUT = setInterval(fUT, 1000);
    }, 1375);
  } else {
    setTimeout(() => {
      fUT();
      IfUT = setInterval(fUT, 1000);
    }, 250);
  }
}

function fXX () {
  clearInterval(IfUT);
  IfUT = undefined;
  victus.clear();
  matrix.turn_all_off();
  matrix.draw_to_canvas();
  for (let i = 0; i < 9; i++) {
    setTimeout(() => {
      victus.clear();
      matrix.set_from_integers(DX);
      matrix.draw_to_canvas();
      piezo?.tone(Note.E6, 125);
    }, (i * 250) + 500);
    setTimeout(() => {
      victus.clear();
      matrix.turn_all_off();
      matrix.draw_to_canvas();
    }, (i * 250) + 625);
  }
}

function fIu () {
  aI.length === 5 && aI.shift();
  aI.push(0);
  piezo?.tone(Note.A4, 125);
  fUD(DH, document.getElementById('up'));
  fFC();
}

function fId () {
  aI.length === 5 && aI.shift();
  aI.push(1);
  piezo?.tone(Note.C5, 125);
  fUD(DS, document.getElementById('down'));
  fFC();
}

function fIl () {
  aI.length === 5 && aI.shift();
  aI.push(2);
  piezo?.tone(Note.E5, 125);
  fUD(DO, document.getElementById('left'));
  fFC();
}

function fIr () {
  aI.length === 5 && aI.shift();
  aI.push(3);
  piezo?.tone(Note.A5, 125);
  fUD(DA, document.getElementById('right'));
  fFC();
}

function fIs () {
  aI.length === 5 && aI.shift();
  aI.push(4);
  piezo?.tone(Note.C6, 125);
  fUD(DX, document.getElementById('select'));
  fFC();
}

function fI () {
  const ku = victus.keys.ArrowUp?.press;
  const kd = victus.keys.ArrowDown?.press;
  const kl = victus.keys.ArrowLeft?.press;
  const kr = victus.keys.ArrowRight?.press;
  const ks = victus.keys.x?.press;
  if (IfUT !== undefined) {
    if (ku) {
      fIu();
    } else if (kd) {
      fId();
    } else if (kl) {
      fIl();
    } else if (kr) {
      fIr();
    } else if (ks) {
      fIs();
    }
  }
  Object.keys(victus.keys).forEach(key => victus.keys[key].press = false);
  window.requestAnimationFrame(fI);
}

const E = new Date(Date.UTC(2025, 1, 5, 18, 0, 0, 0));

let matrix = new Matrix;
let piezo = null;
matrix.draw_to_canvas();
const se = matrix.row(1).slice(1, 3);
const sH = matrix.row(2).slice(1, 5);
const sM = matrix.row(3).slice(1, 6);
const sS = matrix.row(4).slice(1, 6);

fUT();
let IfUT = setInterval(fUT, 1000);