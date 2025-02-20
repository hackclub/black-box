/*
  worker.js
  Black Box editor worker thread
*/

import cparse from './cparse.js';

const AsyncFunction = async function () {}.constructor;

let emu;
let ast;
let ast_as_js;
let while_count = 0;

let last_match;

// TODO: setting nonexistent fields on `emu.globals.blackbox` and other structs is allowed when it shouldn't be
// TODO: calling a nonexistent function doesn't kill the emulator
// TODO: sanity check BLACKBOX_TIMEOUT_1 and BLACKBOX_TIMEOUT_2
// TODO: global letiable declarations should be eval-ed immediately so other global letiable declarations can use them

// TODO: in my heart of hearts i wish the following two functions didn't have to be
// defined in a total of three different places

/**
 * Match a string `value` against a regular expression `ex`.
 * If successful, `true` is returned, and `last_match` stores an object with
 * information about the first match; otherwise, `false` is returned, and
 * `last_match` is undefined.
 * If successful, `last_match.raw` will be equal to `value`; each remaining
 * argument will add another key to `last_match`, with the value equal to the
 * contents of the corresponding capturing group.
 * Passing `_` as an argument prevents that group from being added as a key.
 * @param {string} value
 * @param {RegExp} ex
 * @param {...string} groups
 * @returns {boolean}
 */
function matchWithCapturingGroups (value, ex, ...groups) {
  matchAllWithCapturingGroups(value, ex, ...groups);
  last_match = last_match[0];
  return last_match !== undefined;
}

/**
 * Match a string `value` against a regular expression `ex`.
 * If successful, `true` is returned, and `last_match` stores an array of objects
 * which hold information about each match; otherwise, `false` is returned, and
 * `last_match` is an empty array.
 * If successful, each object in `last_match` contains a key `raw` which is equal
 * to the matched value; each remaining argument will add another key, with the
 * value equal to the contents of the corresponding capturing group for that match.
 * Passing `_` as an argument prevents that group from being added as a key.
 * @param {string} value
 * @param {RegExp} ex
 * @param  {...string} groups
 * @returns {boolean}
 */
function matchAllWithCapturingGroups (value, ex, ...groups) {
  last_match = Array.from(value.matchAll(ex), match => {
    let object = {};
    let i = 0;
    object.index = match.index;
    object.raw = (match[0] || '').trim();
    for (const group of groups) {
      if (group === '_') {
        i++;
        continue;
      }
      object[group] = (match[i + 1] || '');
      i++;
    }
    return object;
  });
  return last_match.length > 0;
}

/**
 * Convert a node from cparse's AST object to an eval-able JavaScript string.
 * Returns `''` when passed either an unsupported node or the value `undefined`.
 * A few types of nodes are eval-ed as soon as they are converted, to allow
 * the result to influence conversions which occur later. In these cases, `''`
 * is returned.
 * @param {*} node 
 * @returns {string}
 */
function ast_node_to_js (node) {
  // console.log(node);
  if (node === undefined) {
    return '';
  }
  switch (node.type) {
    case 'Literal':
      if (typeof node.value === 'string') {
        return `'${node.value}'`;
      }
      if (Array.isArray(node.value)) {
        return node.value.map(ast_node_to_js);
      }
      return node.value;
    case 'Definition':
      return node.name;
    case 'Identifier':
      return node.value;
    case 'Type': {
      let js_type;
      if (node.name === 'short' || node.name === 'int' || node.name === 'long' || node.name === 'float' || node.name === 'double') {
        js_type = 'Number';
      } else if (node.name === 'char') {
        js_type = 'String';
      } else {
        js_type = node.name;
      }
      return `new ${js_type}`;
    }
    case 'PointerType': {
      if (node.length !== undefined) {
        const length = ast_node_to_js(node.length);
        return `Array(${length}).fill(0).map(x => ${ast_node_to_js(node.target)})`;
      }
      return ast_node_to_js(node.target);
    }
    case 'SuffixExpression': {
      const value = ast_node_to_js(node.value);
      return `${value}${node.operator}`;
    }
    case 'BinaryExpression': {
      const left = ast_node_to_js(node.left);
      const right = ast_node_to_js(node.right);
      switch (node.operator) {
        case '->': {
          return `${left}.${right}`;
        }
        default: {
          return `${left}${node.operator}${right}`;
        }
      }
    }
    case 'CallExpression': {
      const base = ast_node_to_js(node.base);
      const args = node.arguments.map(ast_node_to_js).join(', ');
      // once upon a time this case passed `emu` as the first argument,
      // but because the calls `function_name()` and `some->struct->function_name()`
      // both evaluate to `CallExpression`, this no longer makes sense.
      // `emu` is injected later on.
      if (args === '') {
        return `${base}()`;
      }
      return `${base}(${args})`;
    }
    case 'IndexExpression': {
      const value = ast_node_to_js(node.value);
      const index = ast_node_to_js(node.index);
      return `${value}[${index}]`;
    }
    case 'PrefixExpression': {
      const value = ast_node_to_js(node.value);
      return `${node.operator}${value}`;
    }
    case 'ExpressionStatement': {
      return ast_node_to_js(node.expression);
    }
    // TODO: update cparse to add an `elseIf` field to this case.
    case 'IfStatement': {
      const condition = ast_node_to_js(node.condition);
      const body = node.body.map(ast_node_to_js).join('\n');
      // can't name a variable `else`. how queer!
      const _else = (node.else || []).map(ast_node_to_js).join('\n');
      return `if (${condition}) {
${body}
} else {
${_else}
}`;
    }
    // TODO: do the same sort of thing that we do for `WhileStatement`?
    // TODO: `too_many_iterations` message (10,000)?
    case 'ForStatement': {
      const init = ast_node_to_js(node.init);
      const condition = ast_node_to_js(node.condition);
      const step = ast_node_to_js(node.step);
      const body = node.body.map(ast_node_to_js).join('\n');
      return `for (${init}; ${condition}; ${step}) {
${inject(body)}
}`;
    }
    case 'WhileStatement': {
      const condition = ast_node_to_js(node.condition);
      const body = node.body.map(ast_node_to_js).join('\n');
      // if we actually used the `while` keyword here, an infinite loop would
      // lock up the whole thread.
      // instead, we create a plain old function that repeatedly calls itself
      // on an interval until `emu.running` is false or the condition returns `false`.
      let W = while_count++;
      // TODO: async
      return `function ___WHILE_${W} () {
if (!emu.running) { return null; }
if ((${condition}) === false) { return null; }
${inject(body)}
setTimeout(___WHILE_${W}, 0)
}
___WHILE_${W}()`
    }
    case 'ReturnStatement': {
      const value = node.value !== undefined ? ast_node_to_js(node.value) : '';
      const result = value !== '' ? `return ${value}` : `return`;
      return result;
    }
    case 'letiableDeclaration': {
      const value = node.value !== undefined ? ast_node_to_js(node.value) : 'undefined';
      return `let ${node.name} = ${value}`;
    }
    case 'GloballetiableDeclaration': {
      // TODO: restructure this to make more sense?
      // global declarations are eval-ed immediately, because loops need to be able to inject them
      const def_type = ast_node_to_js(node.defType);
      let value;
      // TODO: please don't tell me i have to do a hotfix 3
      if (node.value === undefined) {
        value = '';
      } else {
        let node_value_to_js = ast_node_to_js(node.value);
        if (Array.isArray(node_value_to_js)) {
          // global declarations of arrays are added to emu.globals immediately
          // without even using eval, because producing a true array from a string
          // is really hard
          emu.globals[node.name] = new Array(...node_value_to_js);
          return '';
        } else {
          if (node_value_to_js.constructor.name === 'String') {
            value = `(${emu.update_references(node_value_to_js)})`;
          } else {
            value = `(${node_value_to_js})`;
          }
        }
      }
      eval(`emu.globals['${node.name}'] = ${def_type}${value}`);
      return '';
    }
    case 'FunctionDeclaration': {
      // no redefinitions
      if (emu.globals[node.name] !== undefined) {
        throw new Error(`A function named \`${node.name}\` is already defined`);
      }
      // no unreachable code
      const return_statement_count = node.body.filter(node => node.type === 'ReturnStatement').length;
      if (return_statement_count > 1) {
        throw new Error('Unreachable code detected');
      }
      // do work
      const args = node.arguments.map(ast_node_to_js).map(arg => `'${arg}'`).join(', ');
      const body = node.body.map(ast_node_to_js).join('\n');
      // these declarations are eval-ed immediately for the same reason given in
      // `GloballetiableDeclaration`
      if (args !== '') {
        eval(`emu.globals['${node.name}'] = emu.make_function('${node.name}', \`${body}\`, ${args});`)
      } else {
        eval(`emu.globals['${node.name}'] = emu.make_function('${node.name}', \`${body}\`);`)
      }
      return '';
    }
    case 'DefineStatement': {
      emu.defines[node.identifier] = node.value;
    }
    // TODO: add a `StructDefinition` case back - what if people want to have their own structs?
    default:
      return '';
  }
}

/**
 * Wrapper for an abstract syntax tree describing C code.
 * Perform sanity checks on specific nodes using `find()`, `where()`, and `or_else()`.
 * When finished, get the value of those nodes using `then_get()`.
 */
class AST {
  /**
   * Create a new AST from the C code in `doc`.
   * Uses cparse.
   * @param {string} doc
   */
  constructor (doc) {
    /**
     * The raw AST object created by cparse.
     * @type {object}
     */
    this.ast = cparse(doc);
    /**
     * Status of the AST.
     * Sanity checks performed with `find()` and `where()` can affect this value.
     * @type {boolean}
     */
    this.ok = true;
  }
  /**
   * Sets `this.active_index` to the provided index.
   * @param {number} index
   */
  look_at (index) {
    this.active_index = index;
  }
  /**
   * Find the index of the first node in the AST with all of the key-value pairs provided
   * in `object`, and set it as active.
   * If no such node is found, the AST is marked as not OK.
   * Each of `object`'s values should be a string. For more complicated lookups, combine
   * this function with `where()`.
   * @param {object} object
   */
  find (object) {
    const expected_entries = Object.entries(object);
    const found = this.ast.findIndex(node => {
      for (const expected_entry of expected_entries) {
        const [expected_key, expected_value] = expected_entry;
        const got_value = node[expected_key];
        if (expected_value !== got_value) {
          return false;
        }
      }
      return true;
    });
    if (found === -1) {
      this.ok = false;
    } else {
      this.look_at(found);
    }
    return this;
  }
  /**
   * Shorthand to find a specific `void` function in the AST.
   * Use `then_get()` on the result.
   */
  find_void_function (name) {
    const void_function = ast.find({ type: 'FunctionDeclaration', name })
      .where('defType.type', 'Type')
      .and.where('defType.modifier.length', 0)
      .and.where('defType.name', 'void')
      .or_else(`Missing \`void ${name}()\``)
    const got = void_function.then_get();
    const has_return_statement = got.body.find(node => node.type === 'ReturnStatement') !== undefined;
    if (has_return_statement) {
      throw new Error(`Found \`return\` statement in \`void ${name}\``);
    }
    // discard got
    return void_function;
  }
  /**
   * Verify that the active node contains a key-value pair.
   * Nested keys can be accessed by passing a `key` with dots in it.
   * If the key is undefined, or the value does not match, the AST is marked
   * as not OK.
   * @param {string} key
   * @param {*} value
   */
  where (key, value) {
    const steps = key.split('.');
    let v = this.ast[this.active_index][steps[0]];
    for (const step of steps.slice(1)) {
      v = v[step];
      if (v === undefined) {
        this.ok = false;
        return this;
      }
    }
    if (v !== value) {
      this.ok = false;
    }
    return this;
  }
  /**
   * Throw an error with a provided message if the AST is marked as not OK.
   * @param {string} err
   */
  or_else (err) {
    if (this.ok === false) {
      throw new Error(err);
    }
    return this;
  }
  /**
   * Return the currently active AST node.
   */
  then_get () {
    return this.ast[this.active_index];
  }
  /**
   * Getter to allow for more natural method chaining,
   * e.g. `AST.find().where().and.where()`.
   */
  get and () {
    return this;
  }
}

/**
 * Represents one of the 64 pixels on the 8x8 LED matrix.
 */
class Pixel {
  constructor () {
    /**
     * The value of this pixel - either `0` when turned off or `1` when turned on.
     * @type {number}
     */
    this.value = 0;
  }
  /**
   * Return whether this pixel is turned on.
   * @returns {boolean}
   */
  is_on () {
    return this.value === 1;
  }
  /**
   * Return whether this pixel is turned off.
   * @returns {boolean}
   */
  is_off () {
    return this.value === 0;
  }
  /**
   * Turn this pixel on.
   */
  turn_on () {
    this.value = 1;
  }
  /**
   * Turn this pixel off.
   */
  turn_off () {
    this.value = 0;
  }
  /**
   * Toggle the state of this pixel.
   */
  toggle () {
    if (this.is_on()) {
      this.turn_off();
    } else {
      this.turn_on();
    }
  }
}

/**
 * Represents the 8x8 LED matrix.
 */
class Matrix {
  constructor () {
    /**
     * An array containing all 64 pixels in the matrix.
     * @type {Pixel[]}
     */
    this.pixels = Array(64).fill(0).map(x => new Pixel);
  }
  /**
   * Return the *n*-th pixel of the matrix.
   * @param {number} n
   * @returns {Pixel}
   */
  pixel (n) {
    return this.pixels[n];
  }
  /**
   * Return the pixel at coordinates (`x`, `y`) of the matrix.
   * @param {number} x
   * @param {number} y
   * @returns {Pixel}
   */
  pixel_xy (x, y) {
    return this.pixels[(y * 8) + x];
  }
  /**
   * Turn on all 64 pixels of the matrix.
   */
  turn_all_on () {
    for (let i = 0; i < 64; i++) {
      if (this.pixel(i).is_off()) {
        this.pixel(i).turn_on();
      }
    }
  }
  /**
   * Turn off all 64 pixels of the matrix.
   */
  turn_all_off () {
    for (let i = 0; i < 64; i++) {
      if (this.pixel(i).is_on()) {
        this.pixel(i).turn_off();
      }
    }
  }
  /**
   * Update the pixels in successive rows of the matrix, starting with the
   * first row, according to the binary representation of the provided
   * integers.
   * @param {number[]} ns
   */
  set_from_integers (ns) {
    // TODO: sanity checking
    for (let i = 0; i < ns.length; i++) {
      this.row(i).set_from_integer(ns[i]);
    }
  }
  /**
   * Return a slice of the matrix which contains only the pixels from index
   * `start` to index `end`, both inclusive.
   * @param {number} start
   * @param {number} end
   * @returns {Slice}
   */
  slice (start, end) {
    // TODO: sanity checking
    return new Slice(start, end);
  }
  /**
   * Return a slice of the matrix which contains only the pixels in the *n*-th
   * row of the matrix.
   * @param {number} n
   * @returns {Slice}
   */
  row (n) {
    return new Slice(n * 8, (n * 8) + 7);
  }
}

/**
 * Create an array containing the indices of every pixel in the matrix that's
 * turned on, and send a message `draw_to_canvas` to the main thread telling
 * it to update the canvas.
 */
function draw_to_canvas () {
  const on_pixels = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const i = (y * 8) + x;
      if (emu.globals.blackbox.matrix.pixel_xy(x, y).is_on()) {
        on_pixels.push(i);
      }
    }
  }
  self.postMessage({ message: 'draw_to_canvas', on_pixels });
}

/**
 * Represents a slice of the 8x8 LED matrix which contains only the pixels
 * from index `start` to index `end`, both inclusive.
 * Updating pixels in the slice will update those pixels on the original matrix.
 */
class Slice {
  constructor (start, end) {
    /**
     * The index of the first pixel in the slice.
     * @type {number}
     */
    this.start = start;
    /**
     * The index of the last pixel in the slice.
     * @type {number}
     */
    this.end = end;
  }
  /**
   * Return the *n*-th pixel of the slice.
   * @param {number} n
   * @returns {Pixel}
   */
  pixel (n) {
    return emu.globals.blackbox.matrix.pixel(this.start + n);
  }
  /**
   * Turn on all pixels in the slice.
   */
  turn_all_on () {
    for (let i = this.start; i <= this.end; i++) {
      if (emu.globals.blackbox.matrix.pixel(i).is_off()) {
        emu.globals.blackbox.matrix.pixel(i).turn_on();
      }
    }
  }
  /**
   * Turn off all pixels in the slice.
   */
  turn_all_off () {
    for (let i = this.start; i <= this.end; i++) {
      if (emu.globals.blackbox.matrix.pixel(i).is_on()) {
        emu.globals.blackbox.matrix.pixel(i).turn_off();
      }
    }
  }
  /**
   * Update the pixels in the slice according to the binary representation
   * of the provided integer `n`.
   * The lowest bit of `n` will be stored at the end of the slice.
   * @param {number} n
   */
  set_from_integer (n) {
    this.turn_all_off();
    for (let i = 0; i < this.length; i++) {
      const shifted = (n >>> i);
      if (shifted === 0) {
        break;
      }
      if (shifted & 1 === 1) {
        emu.globals.blackbox.matrix.pixel(this.end - i).turn_on();
      }
    }
  }
  /**
   * Return the length of the slice.
   */
  get length () {
    return (this.end - this.start) + 1;
  }
}

/**
 * Represents the piezo buzzer.
 */
class Piezo {
  constructor () {
    /**
     * The frequency of the buzzer.
     * @type {number}
     * @private
     */
    this.frequency = 0;
  }
  /**
   * Set the frequency of the buzzer to `n` Hz.
   * You probably want to combine this with `piezo->no_tone()`
   * and one of `BlackBox`'s timeouts.
   * @param {number} n
   */
  tone (n) {
    self.postMessage({ message: 'tone', frequency: n });
  }
  /**
   * Stop the buzzer.
   */
  no_tone () {
    self.postMessage({ message: 'no_tone' });
  }
}

/**
 * Represents the Black Box device as a whole.
 */
class BlackBox {
  constructor () {
    /**
     * The device's 8x8 LED matrix.
     * @type {Matrix}
     */
    this.matrix = new Matrix;
    /**
     * The device's piezo buzzer.
     * @type {Piezo}
     */
    this.piezo = new Piezo;
    /**
     * Declare `void on_up()` in the global scope, and it will be called
     * when the up button is pressed.
     * @type {*}
     */
    this.on_up = function () {};
    /**
     * Declare `void on_down()` in the global scope, and it will be called
     * when the down button is pressed.
     * @type {*}
     */
    this.on_down = function () {};
    /**
     * Declare `void on_left()` in the global scope, and it will be called
     * when the left button is pressed.
     * @type {*}
     */
    this.on_left = function () {};
    /**
     * Declare `void on_right()` in the global scope, and it will be called
     * when the right button is pressed.
     * @type {*}
     */
    this.on_right = function () {};
    /**
     * Declare `void on_select()` in the global scope, and it will be called
     * when the select button is pressed.
     * @type {*}
     */
    this.on_select = function () {};
    /**
     * Declare `void on_timeout_1()` in the global scope, and it will be called
     * every `X` milliseconds.
     * Set the timeout with `#define BLACKBOX_TIMEOUT_1 X`.
     * @type {*}
     */
    this.on_timeout_1 = function () {};
    /**
     * Declare `void on_timeout_2()` in the global scope, and it will be called
     * every `Y` milliseconds.
     * Set the timeout with `#define BLACKBOX_TIMEOUT_2 Y`.
     * @type {*}
     */
    this.on_timeout_2 = function () {};
  }
  /**
   * Sleep for `n` milliseconds.
   * **This method is blocking.**
   * @param {number} n
   */
  sleep (n) {
    // no implementation - handled internally
  }
}

/**
 * Inject the body of a function or loop with additional code.
 * The new body will create bindings for all the global variables which exist
 * at the time of injection.
 * TODO: figure out if we'll ever need to inject a `tail` value again.
 * @param {string} original
 * @returns {string}
 */
function inject (original) {
  // let head = `let { ${Object.keys(emu.globals).join(', ')} } = emu.globals`;
  let original_without_last = original.split('\n').slice(0, -1).join('\n');
  let original_last = original.split('\n').at(-1);
  // let tail = `emu.update_globals({ ${Object.keys(emu.globals).join(', ')} })`;
  if (original_last.startsWith('return')) {
    return `${original_without_last}
${original_last}`
  }
  return `${original}`
}

/**
 * Return the type of a value.
 * Prefers `constructor.name` over `typeof`.
 * @param {*} value
 * @returns {string}
 */
// function type_of (value) {
//   if (value === undefined) {
//     return 'undefined';
//   }
//   if (value === null) {
//     return 'null';
//   }
//   if (typeof value === 'function') {
//     return 'function';
//   }
//   return value.constructor.name;
// }

// function c_type_of (value) {
//   if (typeof value === 'number') {
//     const decimal_part = Math.floor(Math.abs(value));
//     if (decimal_part === 0) {
//       if (value >= -9_223_372_036_854_775_808 && value < -2_147_483_648) {
//         return 'long';
//       }
//       if (value >= -2_147_483_648 && value < -32_768) {
//         return 'int';
//       }
//       if (value >= -32_768 && value < -128) {
//         return 'short';
//       }
//       if (value >= -128 && value < 0) {
//         return 'signed char';
//       }
//       if (value >= 0 && value < 256) {
//         return 'unsigned char';
//       }
//       if (value >= 256 && value < 32_768) {
//         return 'short';
//       }
//       if (value >= 32_768 && value < 65_536) {
//         return 'unsigned short';
//       }
//       if (value >= 65_536 && value < 2_147_483_648) {
//         return 'int';
//       }
//       if (value >= 2_147_483_648 && value < 4_294_967_296) {
//         return 'unsigned int';
//       }
//       if (value >= 4_294_967_296 && value < 9_223_372_036_854_775_808) {
//         return 'long';
//       }
//     }
//     // TODO: ...
//   }
//   // TODO: ...
// }

/**
 * Typechecks a value which is about to change.
 * If the value's new type does not match the old one, this function throws.
 * @param {*} value_old
 * @param {*} value_new
 */
// TODO: typecheck declarations like `int a = "B";` as soon as they happen
// function typecheck (value_old, value_new) {
//   // console.log('typechecking', value_old, 'vs', value_new);
//   if (value_old === undefined) {
//     return;
//   }
//   const type_of_value_old = type_of(value_old);
//   const type_of_value_new = type_of(value_new);
//   if (type_of_value_old !== type_of_value_new) {
//     throw new Error(`Expected \`${type_of_value_old}\`, got \`${type_of_value_new}\``);
//   }
// }

/**
 * Create a new emulator.
 */
function new_emu () {
  return {
    /**
     * Whether the emulator is running.
     * The `main` message sets this to `true`, and the `stop` message
     * sets this to false.
     * @type {boolean}
     */
    running: false,
    /**
     * Whether the emulator is sleeping.
     * A call to `blackbox->sleep` sets this to true for the duration of the call.
     * @type {boolean}
     */
    sleeping: false,
    /**
     * Object for globally defined variables and functions.
     * @type {object}
     */
    globals: {},
    /**
     * Object for constants created with the `#define` directive.
     * @type {object}
     */
    defines: {},
    /**
     * ID returned by `setInterval()` for timeout 1.
     * @type {number|undefined}
     * @private
     */
    interval_id_1: undefined,
    /**
     * ID returned by `setInterval()` for timeout 2.
     * @type {number|undefined}
     * @private
     */
    interval_id_2: undefined,
    /**
     * Update references to global defines and variables in `original`.
     * @param {string} original
     * @returns {string}
     */
    update_references (original) {
      let updated = original;
      // replace references to global defines so that they access `emu.defines`
      const Ds = Object.keys(this.defines).sort((a, b) => b.length - a.length);
      for (const key of Ds) {
        const R = new RegExp(`(?<![A-Za-z0-9_.])(${key})`, 'g');
        while (matchWithCapturingGroups(updated, R) === true) {
          const reference = last_match;
          const replacement = `emu.defines.${reference.raw}`;
          updated = updated.substring(0, reference.index) + replacement + updated.substring(reference.index + reference.raw.length);
        }
      }
      // replace references to global functions so that they access `emu.globals`
      const Fs = Object.keys(this.functions).sort((a, b) => b.length - a.length);
      for (const key of Fs) {
        const R = new RegExp(`(?<![A-Za-z0-9_.])${key}\\((.*?)\\)`, 'g');
        while (matchWithCapturingGroups(updated, R, 'args') === true) {
          const reference = last_match;
          const replacement = `await emu.globals.${key}(emu, ${reference.args})`;
          updated = updated.substring(0, reference.index) + replacement + updated.substring(reference.index + reference.raw.length);
        }
      }
      // replace references to global variables so that they access `emu.globals`
      // TODO: does this need to be sorted?
      const Vs = Object.keys(this.variables).sort((a, b) => b.length - a.length);
      for (const key of Vs) {
        // TODO: this better be a safe expression or i don't know what i'm gonna do
        const R = new RegExp(`(?<![A-Za-z0-9_.])${key}(?![A-Za-z0-9_])`, 'g');
        while (matchWithCapturingGroups(updated, R) === true) {
          const reference = last_match;
          const replacement = `emu.globals.${reference.raw}`;
          updated = updated.substring(0, reference.index) + replacement + updated.substring(reference.index + reference.raw.length);
        }
      }
      // finished
      return updated;
    },
    /**
     * Create a Function object to store on `this.globals`.
     * To allow created functions to access other variables and functions on
     * `this.globals`, `emu`, an emulator object, is accepted as the first argument.
     * Other replacements will be performed on the function body to ensure
     * proper calling and sleeping.
     * @param {string} name
     * @param {string} body 
     * @param  {...any} args
     * @returns {Function}
     */
    make_function (name, body, ...args) {
      console.log('making function', name);
      // 1. update references
      // this behavior was previously exclusive to this function,
      // but it was broken out so global letiable declarations could use it
      body = this.update_references(body);
      // 2. replace calls to `blackbox->sleep()` such that `emu.sleeping`
      // is set to `true` until a promise with the call's duration resolves
      while (
        matchWithCapturingGroups(
          body,
          /(emu\.globals\.)?blackbox\.sleep\((.+?)\)/g,
          '_',
          'ms',
        ) === true
      ) {
        const blackbox_sleep_call = last_match;
        const replacement = `emu.sleeping = true
await new Promise(resolve => setTimeout(resolve, ${Number(blackbox_sleep_call.ms)}))
emu.sleeping = false`;
        body = body.substring(0, blackbox_sleep_call.index) + replacement + body.substring(blackbox_sleep_call.index + blackbox_sleep_call.raw.length);
      }
      // 3. extra replacements to make to the main function
      if (name === 'main') {
        // find the infinite loop inside the body (remember, this was converted into a plain function)
        // and start the 2 timeouts before it
        matchWithCapturingGroups(
          body,
          /function ___WHILE_\d+ \(\) {/g
        );
        const loop_signature = last_match;
        const replacement = `emu.interval_id_1 = setInterval(() => emu.globals.on_timeout_1(emu), ${emu.defines.BLACKBOX_TIMEOUT_1})
emu.interval_id_2 = setInterval(() => emu.globals.on_timeout_2(emu), ${emu.defines.BLACKBOX_TIMEOUT_2})
${loop_signature.raw}`;
        body = body.substring(0, loop_signature.index) + replacement + body.substring(loop_signature.index + loop_signature.raw.length);
      }
      // 4. create function
      const F = new AsyncFunction(
        'emu',
        ...args,
        inject(body),
      );
      return F;
    },
    /**
     * Return whether a specific function name is reserved.
     * Reserved functions must have a definition and should not be called directly.
     * @param {string} function_name
     * @returns {boolean}
     */
    reserved (function_name) {
      return [
        'main',
        'on_up', 'on_down', 'on_left', 'on_right', 'on_select',
        'on_timeout_1', 'on_timeout_2',
      ].includes(function_name);
    },
    /**
     * Getter for user-defined global functions.
     */
    get functions () {
      return Object.fromEntries(
        Object.entries(this.globals)
          .filter(entry => typeof entry[1] === 'function')
          .filter(entry => this.reserved(entry[0]) === false)
      );
    },
    /**
     * Getter for user-defined global variables.
     */
    get variables () {
      return Object.fromEntries(
        Object.entries(this.globals)
          .filter(entry => typeof entry[1] !== 'function')
      );
    },
  };
}

/**
 * Create a new message.
 * @param {function} cb
 */
function new_message (cb) {
  return function (event, args) {
    try {
      const result = cb(args);
      event.ports[0].postMessage({ result });
    } catch (error) {
      event.ports[0].postMessage({ error });
    }
  }
}

/**
 * Return an object containing every message passed as an argument.
 * This is understood to be a collection of all the types of messages that
 * this thread can receive from the main thread.
 * @param  {...function} callbacks
 * @returns {object}
 */
function create_messages (...callbacks) {
  return Object.fromEntries(callbacks.map(cb => [cb.name, new_message(cb)]));
}

/**
 * Return a Proxy which calls `callback` if any part of `object` changes.
 * `callback` should take no parameters.
 * @param {object} object 
 * @param {function} callback 
 * @returns {Proxy}
 */
function watch (object, callback) {
  return new Proxy(
    object,
    {
      set(target, property, value) {
        target[property] = value;
        callback();
        return true;
      },
      get(target, property) {
        const value = target[property];
        if (typeof value === 'object' && value !== undefined && value !== null) {
          return watch(value, callback);
        }
        return value;
      }
    }
  )
}

/**
 * Callback for `create_emu` message.
 * Create a new emulator object.
 */
function create_emu () {
  console.log('[worker] creating emulator...');
  emu = new_emu();
  console.log('[worker] finished creating emulator');
}

/**
 * Callback for `create_ast` message.
 * Create an AST from the C code provided in `args.doc`.
 * @param {object} args
 * @param {string} args.doc
 */
function create_ast (args) {
  console.log('[worker] creating AST...');
  ast = new AST(args.doc);
  console.log('[worker] finished creating AST');
  console.log(ast);
}

/**
 * Callback for `sanity_check` message.
 * Perform checks on the AST to ensure it is complete.
 */
function sanity_check () {
  console.log('[worker] sanity checking...');
  // 1. the code should include blackbox.h
  const include_blackbox_h = ast.find({ type: 'IncludeStatement', value: 'blackbox' })
    .or_else('Missing blackbox.h');
  // 2. the code should include a global declaration `BlackBox* blackbox`...
  const blackbox = ast.find({ type: 'GloballetiableDeclaration', name: 'blackbox' })
    .where('defType.type', 'PointerType')
    .and.where('defType.target.name', 'BlackBox')
    .and.where('defType.target.modifier.length', 0)
    .or_else('Missing global `BlackBox* blackbox;`')
    .then_get();
  // ...with no value
  if (blackbox.value !== undefined) {
    throw new Error('The `blackbox` global should not have a value');
  }
  // 3. the code should include functions `on_up`, `on_down`, `on_left`,
  // `on_right`, and `on_select`, all returning `void`
  const on_up = ast.find_void_function('on_up').then_get();
  const on_down = ast.find_void_function('on_down').then_get();
  const on_left = ast.find_void_function('on_left').then_get();
  const on_right = ast.find_void_function('on_right').then_get();
  const on_select = ast.find_void_function('on_select').then_get();
  // 4. the code should include functions `on_timeout_1` and `on_timeout_2`,
  // both returning `void`
  const on_timeout_1 = ast.find_void_function('on_timeout_1').then_get();
  const on_timeout_2 = ast.find_void_function('on_timeout_2').then_get();
  // 5. the code should include a function `void main()`...
  const main = ast.find_void_function('main').then_get();
  // ...which ends with a `while (1)` loop
  const main_last = main.body.at(-1);
  if (!(main_last.type === 'WhileStatement' && main_last.condition.value === 1)) {
    throw new Error('`void main()` should end with `while (1) {}`');
  }
  console.log('[worker] finished sanity checking');
}

/**
 * Callback for `convert_ast` message.
 * Convert each node of the AST to eval-able JavaScript code.
 */
function convert_ast () {
  console.log('[worker] converting AST nodes to JavaScript...');
  ast_as_js = ast.ast.map(ast_node_to_js).filter(node => node.length > 0);
  console.log('[worker] finished converting AST nodes to JavaScript');
  // console.log(ast_as_js);
}

/**
 * Callback for `eval_ast` message.
 * `eval` each piece of code in the converted AST.
 */
function eval_ast () {
  console.log('[worker] evaling converted AST nodes...');
  ast_as_js.forEach(node => {
    eval(`"use strict";\n${node}`);
  });
  // function hoisting for `BlackBox* blackbox` - special case
  // TODO: does C allow this in the first place?
  emu.globals.blackbox.on_up = emu.globals.on_up;
  emu.globals.blackbox.on_down = emu.globals.on_down;
  emu.globals.blackbox.on_left = emu.globals.on_left;
  emu.globals.blackbox.on_right = emu.globals.on_right;
  emu.globals.blackbox.on_select = emu.globals.on_select;
  emu.globals.blackbox.on_timeout_1 = emu.globals.on_timeout_1;
  emu.globals.blackbox.on_timeout_2 = emu.globals.on_timeout_2;
  console.log('[worker] finished evaling converted AST nodes');
}

/**
 * Callback for `create_matrix_proxy` message.
 * Replace `emu.globals.blackbox.matrix` with a deeply nested Proxy
 * with `draw_to_canvas()` as the callback.
 */
function create_matrix_proxy () {
  console.log('[worker] creating matrix proxy...');
  emu.globals.blackbox.matrix = watch(
    emu.globals.blackbox.matrix,
    draw_to_canvas
  );
  console.log('[worker] finished creating matrix proxy');
  console.log(emu);
}

/**
 * Callback for `main` message.
 * Start the emulator by calling `emu.globals.main()`.
 * This message returns immediately, but the main function may continue running
 * for much longer.
 */
function main () {
  console.log('[worker] starting...');
  emu.running = true;
  emu.globals.main(emu);
}

// TODO: don't repeat yourself

/**
 * Callback for `up` message.
 * Call the function in `blackbox->on_up`.
 */
function up () {
  if (emu.sleeping) {
    console.log('[worker] skipping (emulator is asleep)');
    return;
  }
  emu.globals.blackbox.on_up(emu);
}

/**
 * Callback for `down` message.
 * Call the function in `blackbox->on_down`.
 */
function down () {
  if (emu.sleeping) {
    console.log('[worker] skipping (emulator is asleep)');
    return;
  }
  emu.globals.blackbox.on_down(emu);
}

/**
 * Callback for `left` message.
 * Call the function in `blackbox->on_left`.
 */
function left () {
  if (emu.sleeping) {
    console.log('[worker] skipping (emulator is asleep)');
    return;
  }
  emu.globals.blackbox.on_left(emu);
}

/**
 * Callback for `right` message.
 * Call the function in `blackbox->on_right`.
 */
function right () {
  if (emu.sleeping) {
    console.log('[worker] skipping (emulator is asleep)');
    return;
  }
  emu.globals.blackbox.on_right(emu);
}

/**
 * Callback for `select` message.
 * Call the function in `blackbox->on_select`.
 */
function select () {
  if (emu.sleeping) {
    console.log('[worker] skipping (emulator is asleep)');
    return;
  }
  emu.globals.blackbox.on_select(emu);
}

/**
 * Callback for `stop` message.
 * Stop the emulator.
 */
function stop () {
  console.log('[worker] stopping...');
  emu.running = false;
  clearInterval(emu.interval_id_1);
  clearInterval(emu.interval_id_2);
}

const messages = create_messages(
  create_emu,
  create_ast,
  sanity_check,
  convert_ast,
  eval_ast,
  create_matrix_proxy,
  main,
  up,
  down,
  left,
  right,
  select,
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