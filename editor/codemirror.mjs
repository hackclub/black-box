import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { indentWithTab, history, defaultKeymap, historyKeymap } from '@codemirror/commands';
import { StreamLanguage, foldGutter, indentOnInput, bracketMatching, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
// import { openSearchPanel, highlightSelectionMatches } from '@codemirror/search';
import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers, highlightActiveLine, highlightActiveLineGutter, highlightSpecialChars, drawSelection, rectangularSelection, keymap, ViewPlugin } from '@codemirror/view';
import { c } from '@codemirror/legacy-modes/mode/clike';

const default_doc = `// Core definitions for black box
#include "blackbox.h"

// An example task that blinks a single pixel
void blink(task_handle self) {
  // Toggle the pixel at (3, 3)
  bb_matrix_toggle_pos(3, 3);
}

// Your main code goes here!
// Set up global variables, timers, events, etc.
void setup() {
  // COGITO ERGO SUM
  
  // Run \`blink\` every 500ms (every half second)
  task_create_interval(blink, 500);
}`;

let params = new URLSearchParams(window.location.search);

const extensions = [
  closeBrackets(),
  history(),
  foldGutter(),
  // indentOnInput(), // ?
  bracketMatching(),
  lineNumbers(),
  highlightActiveLine(),
  highlightSpecialChars(),
  drawSelection(),
  // rectangularSelection(), // ?
  highlightActiveLineGutter(),
  keymap.of([
    indentWithTab,
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...historyKeymap,
  ]),
  StreamLanguage.define(c),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  EditorView.updateListener.of(update => {
    if (update.docChanged && params.get('code') === null) {
      localStorage.setItem('doc', update.state.doc.toString());
    }
  }),
  EditorState.readOnly.of(params.get('code') !== null),
];

let doc;
// if (params.get('code') !== null) {
//   console.log('[cm] setting code based on URL parameter')
//   doc = atob(decodeURIComponent(params.get('code')));
// }
if (localStorage.getItem('doc') !== null) {
  console.log('[cm] setting code based on local storage')
  doc = localStorage.getItem('doc');
} else {
  console.log('[cm] setting code to default');
  doc = default_doc;
}

let state = EditorState.create({
  extensions,
  doc,
});
let editor = new EditorView({
  state,
  parent: document.getElementById('cm_container'),
});
