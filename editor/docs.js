/*
  docs.js
  documentation generation for Black Box editor
*/

// what in god's name
// const EXP_CLASS_DEFINITIONS = /^(\/\*\*)\n \* ([A-Z][A-Za-z0-9 .,'*_`\n]+?)\n (\*\/)\nclass (Pixel|Matrix|Slice|Piezo|BlackBox) {(\n  )(constructor \(.*?\) {(\n    )\1(\n     ).+?\5})(\5(.+?))?\n}/gms;
// const EXP_CONSTRUCTOR_FIELDS = /(\/\*\*)(\n     )\* (.+?)\2\* @type {(.+?)}\2(\* @private\2)?\*\/(.*?)\n    this\.(.+?) = .+?;/gms;
// const EXP_METHODS = /\/\*\*(\n   )(\* )(.+?)(\n   )(\2@.+?\4)?\*\/\n  (.+?) \(/gms;
// const EXP_METHOD_TYPES = /@(param {(.+?)} (.+))|(returns {(.+?)})/gm;
const EXP_MARKDOWN_ELEMENTS = /^## (\w+)|^### (\w+)|^#### (\w+)|```c\n(.+?)\n```|(^[A-Za-z0-9,. ()`'_\[\]:\/-]+)/gms;

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
 * Create a permalink to an item and append it to `#docs_container`.
 * @param {string} item
 * @param {string} accent_color
 */
function create_permalink (item, accent_color) {
  const e_permalink = document.createElement('p');
  e_permalink.className = 'permalink';
  const e_permalink_a = document.createElement('a');
  e_permalink_a.className = accent_color;
  e_permalink_a.href = `#${item}`;
  e_permalink_a.innerHTML = '#';
  e_permalink_a.onclick = e => highlight(e.target.hash.slice(1));
  e_permalink.appendChild(e_permalink_a);
  e_docs_container.appendChild(e_permalink);
}

/**
 * Generate documentation for the Black Box API and add it to the editor page.
 * @param {string} text
 */
function generate_docs (text) {
  console.log('[docs] generating docs...');
  matchAllWithCapturingGroups(
    text,
    EXP_MARKDOWN_ELEMENTS,
    'h2',
    'h3',
    'h4',
    'code',
    'p'
  );
  let h2_count = 0;
  let accent_color;
  let item;
  for (const markdown_element of last_match) {
    const { h2, h3, h4, code, p } = markdown_element;
    if (h2) {
      if (h2_count > 0) {
        const e_hr = document.createElement('hr');
        e_docs_container.appendChild(e_hr);
      }
      accent_color = ['red', 'yellow', 'green'][h2_count++ % 3];
      item = `docs_${h2.toLowerCase()}`;
      create_permalink(item, accent_color);
      const e_section_name = document.createElement('h4');
      e_section_name.className = accent_color;
      e_section_name.setAttribute('id', item);
      e_section_name.innerHTML = h2;
      e_docs_container.appendChild(e_section_name);
    }
    if (h3) {
      item = `docs_${h3.toLowerCase()}`;
      // create_permalink(item, accent_color);
      const e_subsection_name = document.createElement('h5');
      e_subsection_name.className = accent_color;
      e_subsection_name.setAttribute('id', item);
      e_subsection_name.innerHTML = h3;
      e_docs_container.appendChild(e_subsection_name);
    }
    if (h4) {
      item = `docs_${h4.toLowerCase()}`;
      create_permalink(item, accent_color);
      const e_item_name = document.createElement('p');
      e_item_name.className = 'item';
      e_item_name.setAttribute('id', item);
      e_item_name.innerHTML = h4;
      e_docs_container.appendChild(e_item_name);
    }
    if (code) {
      // TODO: better coloring than just antiquewhite
      const e_pre = document.createElement('pre');
      e_pre.innerHTML = code;
      e_docs_container.appendChild(e_pre);
    }
    if (p) {
      const e_item_description = document.createElement('p');
      e_item_description.className = 'item_description';
      e_item_description.innerHTML = p
        .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
        .replace(/\*(.+?)\*/g, '<i>$1</i>')
        .replace(/`(.+?)`/g, `<span class="mono ${accent_color}">$1</span>`)
        .replace(/\[(.+?)\]\((.+?)\)/g, `<a href="$1" target="_blank">$2</a>`);
      e_docs_container.appendChild(e_item_description);
    }
  }
  // close
  const e_hr = document.createElement('hr');
  e_docs_container.appendChild(e_hr);
  console.log('[docs] finished generating docs');
  // hash
  if (window.location.hash === '') { return; }
  if (window.location.hash.startsWith('#docs')) {
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

get_text('/docs/api.md').then(generate_docs);

