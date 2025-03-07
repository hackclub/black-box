/*
  docs.js
  documentation generation for Black Box editor
*/

// what in god's name
const EXP_CLASS_DEFINITIONS = /^(\/\*\*)\n \* ([A-Z][A-Za-z0-9 .,'*_`\n]+?)\n (\*\/)\nclass (Pixel|Matrix|Slice|Piezo|BlackBox) {(\n  )(constructor \(.*?\) {(\n    )\1(\n     ).+?\5})(\5(.+?))?\n}/gms;
const EXP_CONSTRUCTOR_FIELDS = /(\/\*\*)(\n     )\* (.+?)\2\* @type {(.+?)}\2(\* @private\2)?\*\/(.*?)\n    this\.(.+?) = .+?;/gms;
const EXP_METHODS = /\/\*\*(\n   )(\* )(.+?)(\n   )(\2@.+?\4)?\*\/\n  (.+?) \(/gms;
const EXP_METHOD_TYPES = /@(param {(.+?)} (.+))|(returns {(.+?)})/gm;

let last_match;

const e_docs_container = document.getElementById('docs_container');
const e_cm_container = document.getElementById('cm_container');
const e_toggle_running = document.getElementById('toggle_running');
const e_toggle_view = document.getElementById('toggle_view');
const e_change_color = document.getElementById('change_color');

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
 * Get the contents of a file as a string.
 * @param {string} url
 */
async function get_text(url) {
  const response = await fetch(url, { cache: 'no-cache' });
  let text;
  if (response.ok) {
    text = await response.text();
  }
  return text;
}

/**
 * Generate documentation for the Black Box API and add it to the editor page.
 * @param {string} text
 */
function generate_docs (text) {
  console.log('[docs] generating docs...');
  matchAllWithCapturingGroups(
    text,
    EXP_CLASS_DEFINITIONS,
    '_',
    'description',
    '_',
    'name',
    '_',
    'constructor',
    '_', '_', '_',
    'methods',
  );
  let i = 0;
  for (const class_definition of last_match) {
    const accent_color = ['red', 'yellow', 'green'][i % 3];
    const { description, name, constructor, methods } = class_definition;
    // container
    const e_class_container = document.createElement('div');
    e_class_container.setAttribute('id', `${name.toLowerCase()}_docs_container`);
    // name
    const e_permalink = document.createElement('p');
    e_permalink.className = 'permalink';
    const e_permalink_a = document.createElement('a');
    e_permalink_a.className = accent_color;
    e_permalink_a.href = `#class_${name.toLowerCase()}`;
    e_permalink_a.innerHTML = '#';
    e_permalink_a.onclick = e => highlight(e.target.hash.slice(1));
    e_permalink.appendChild(e_permalink_a);
    e_class_container.appendChild(e_permalink);
    const e_name = document.createElement('h4');
    e_name.className = accent_color;
    e_name.setAttribute('id', `class_${name.toLowerCase()}`);
    e_name.innerHTML = name;
    e_class_container.appendChild(e_name);
    // description
    const e_description = document.createElement('p');
    e_description.innerHTML = description
      .split('\n * ')
      .join(' ')
      .replaceAll('. ', '.<br>')
      .replace(/`(.+?)`/g, `<span class="mono ${accent_color}">$1</span>`);
    e_class_container.appendChild(e_description);
    // constructor
    matchAllWithCapturingGroups(
      constructor,
      EXP_CONSTRUCTOR_FIELDS,
      '_', '_',
      'field_description',
      'field_type',
      'private',
      '_',
      'field_name'
    );
    last_match = last_match.filter(match => match.private === '');
    if (last_match.length !== 0) {
      const e_fields = document.createElement('h5');
      e_fields.className = accent_color;
      e_fields.innerHTML = 'Fields';
      e_class_container.appendChild(e_fields);
    }
    for (const field of last_match) {
      const { field_description, field_type, field_name } = field;
      // field (name and type)
      const e_permalink = document.createElement('p');
      e_permalink.className = 'permalink';
      const e_permalink_a = document.createElement('a');
      e_permalink_a.className = accent_color;
      e_permalink_a.href = `#field_${name.toLowerCase()}_${field_name}`;
      e_permalink_a.innerHTML = '#';
      e_permalink_a.onclick = e => highlight(e.target.hash.slice(1));
      e_permalink.appendChild(e_permalink_a);
      e_class_container.appendChild(e_permalink);
      const e_field = document.createElement('p');
      e_field.className = 'field';
      e_field.setAttribute('id', `field_${name.toLowerCase()}_${field_name}`);
      e_field.innerHTML = `${field_name}: <span class="mono ${accent_color}">${field_type}</span>`;
      e_class_container.appendChild(e_field);
      // field description
      const e_field_description = document.createElement('p');
      e_field_description.className = 'field_description';
      e_field_description.innerHTML = field_description
        .split('\n     * ')
        .join(' ')
        .replaceAll('. ', '.<br>')
        .replace(/`(.+?)`/g, `<span class="mono ${accent_color}">$1</span>`);
      e_class_container.appendChild(e_field_description);
    }
    // methods
    matchAllWithCapturingGroups(
      methods,
      EXP_METHODS,
      '_', '_',
      'method_description',
      '_',
      'method_types',
      'method_name'
    );
    if (last_match.length !== 0) {
      const e_methods = document.createElement('h5');
      e_methods.className = accent_color;
      e_methods.innerHTML = 'Methods';
      e_class_container.appendChild(e_methods);
    }
    for (const method of last_match) {
      const { method_description, method_types, method_name } = method;
      // method types
      matchAllWithCapturingGroups(
        method_types,
        EXP_METHOD_TYPES,
        '_',
        'param_type',
        'param_name',
        '_',
        'return_type'
      );
      const params = last_match
        .filter(match => match.param_type !== '' && match.param_name !== '')
        .map(match => `${match.param_name}: <span class="mono ${accent_color}">${match.param_type}</span>`);
      const return_type = last_match
        .find(match => match.return_type !== '')
        ?.return_type;
      // method (name, params and return type)
      const e_permalink = document.createElement('p');
      e_permalink.className = 'permalink';
      const e_permalink_a = document.createElement('a');
      e_permalink_a.className = accent_color;
      e_permalink_a.href = `#method_${name.toLowerCase()}_${method_name.replaceAll(' ', '_')}`;
      e_permalink_a.innerHTML = '#';
      e_permalink_a.onclick = e => highlight(e.target.hash.slice(1));
      e_permalink.appendChild(e_permalink_a);
      e_class_container.appendChild(e_permalink);
      const e_method = document.createElement('p');
      e_method.className = 'method';
      e_method.setAttribute('id', `method_${name.toLowerCase()}_${method_name.replaceAll(' ', '_')}`);
      if (return_type === undefined) {
        e_method.innerHTML = `${method_name}(${params.join(', ')})`;
      } else {
        e_method.innerHTML = `${method_name}(${params.join(', ')}): <span class="mono ${accent_color}">${return_type}</span>`;
      }
      e_class_container.appendChild(e_method);
      // method description
      const e_method_description = document.createElement('p');
      e_method_description.className = 'method_description';
      e_method_description.innerHTML = method_description
        .split('\n   * ')
        .join(' ')
        .replaceAll('. ', '.<br>')
        .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
        .replace(/\*(.+?)\*/g, '<i>$1</i>')
        .replace(/`(.+?)`/g, `<span class="mono ${accent_color}">$1</span>`);
      e_class_container.appendChild(e_method_description);
    }
    // close
    e_class_container.appendChild(document.createElement('hr'));
    e_docs_container.appendChild(e_class_container);
    i++;
  }
  console.log('[docs] finished generating docs');
  // hash
  if (window.location.hash === '') { return; }
  if (
    window.location.hash.startsWith('#class') ||
    window.location.hash.startsWith('#field') ||
    window.location.hash.startsWith('#method')
  ) {
    console.log(`[docs] highlighting ${window.location.hash}`);
    e_docs_container.style.display = 'block';
    e_cm_container.style.display = 'none';
    e_toggle_view.innerHTML = 'View code';
    const id = window.location.hash.slice(1);
    const e = document.getElementById(id);
    if (e === null) {
      return;
    }
    highlight(id);
    const y = e.getBoundingClientRect().top;
    e_docs_container.scroll({ top: y - 72, behavior: 'instant' });
    e_toggle_running.disabled = true;
  }
}

/**
 * Highlight the given element.
 * For use with anchor links.
 * @param {string} id
 */
function highlight (id) {
  const e = document.getElementById(id);
  if (e === null) {
    return;
  }
  const highlighted = document.querySelector('.highlight');
  if (highlighted !== null) {
    highlighted.classList.remove('highlight');
  }
  e.classList.add('highlight');
}

get_text('./worker.js').then(generate_docs);

