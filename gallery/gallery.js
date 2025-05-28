document.addEventListener('DOMContentLoaded', victus.setup({
  id: 'canvas',
  w: 120,
  h: 120,
  color: '#222',
}));

const data_heart = [
  0b00000000,
  0b01100110,
  0b11111111,
  0b11111111,
  0b01111110,
  0b00111100,
  0b00011000,
  0b00000000
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
    this.color = '#fbb601';
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

async function get_json(url) {
  const response = await fetch(url);
  let json;
  if (response.ok) {
    json = await response.json();
  }
  return json;
}

function append_preview (section, code_url, matrix_color, preview_a, preview_b) {
  console.log(preview_a, preview_b);
  let a = document.createElement('a');
  a.setAttribute('href', code_url);
  a.setAttribute('target', '_blank');
  let svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('version', '1.1');
  svg.setAttribute('width', '64');
  svg.setAttribute('height', '64');
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  let rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('width', '100%');
  rect.setAttribute('height', '100%');
  rect.setAttribute('fill', '#222');
  svg.appendChild(rect);
  const bits_upper = preview_a.toString(2).padStart(32, '0');
  const bits_lower = preview_b.toString(2).padStart(32, '0');
  const bits = bits_upper.concat(bits_lower).split('').map(Number);
  let cx = 4;
  let cy = 4;
  const fill = matrix_color === 'Red' ? '#ef654d'
    : matrix_color === 'Yellow' ? '#fbb601'
    : '#c7e916';
  for (const bit of bits) {
    let circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', cx.toString());
    circle.setAttribute('cy', cy.toString());
    circle.setAttribute('r', 3);
    circle.setAttribute('fill', bit === 1 ? fill : '#444');
    svg.appendChild(circle);
    cx += 8;
    cx %= 64;
    if (cx === 4) {
      cy += 8;
    }
  }
  a.appendChild(svg);
  section.appendChild(a);
}

/**
 * Append a submission to the gallery.
 * @param {*} submission
 */
function append_submission (submission) {
  let e_section = document.createElement('div');
  e_section.classList.add('section');
  // airbridge fields
  const code_url = submission.fields['Code URL'];
  const matrix_color = submission.fields['Matrix Color'];
  const preview_a = submission.fields['Preview A'];
  const preview_b = submission.fields['Preview B'];
  const project_identifier = submission.fields['Project Identifier'];
  const slack_username = submission.fields['Slack Username'];
  const verb = submission.fields['Verb'];
  // description (username + verb + identifier)
  let e_description = document.createElement('p');
  e_description.innerHTML = `<b>${slack_username}</b> ${verb} <b>${project_identifier}</b>`;
  // link
  // let e_link = document.createElement('p');
  // e_link.innerHTML = `<a href="${code_url}">View in editor</a>`;
  e_section.appendChild(e_description);
  append_preview(e_section, code_url, matrix_color, preview_a, preview_b);
  // e_section.appendChild(e_link);
  document.getElementById('gallery_container').appendChild(e_section);
}

let matrix = new Matrix;
matrix.set_from_integers(data_heart);
matrix.draw_to_canvas();

get_json('https://api2.hackclub.com/v0.1/Black%20Box/YSWS%20Project%20Submission').then(json => {
  const backed = json.filter(submission => submission.fields['Slack Username'] && submission.fields['Verb'] && submission.fields['Project Identifier']);
  console.log(backed);
  for (const submission of backed) {
    append_submission(submission);
  }
  document.getElementById('n_submissions').innerHTML = `Showing <b>${backed.length} submissions</b>`;
})