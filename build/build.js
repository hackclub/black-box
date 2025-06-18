document.addEventListener('DOMContentLoaded', victus.setup({
  id: 'canvas',
  w: 120,
  h: 120,
  color: '#222',
}));

const data_checker = [
  0b11001100,
  0b11001100,
  0b00110011,
  0b00110011,
  0b11001100,
  0b11001100,
  0b00110011,
  0b00110011
];

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
    this.color = '#c7e916';
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
        victus.ctx.ellipse((x * 15) + 8, (y * 15) + 8, 6, 6, 0, 0, 2 * Math.PI);
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

let matrix = new Matrix;
matrix.set_from_integers(data_checker);
matrix.draw_to_canvas();