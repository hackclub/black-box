/*
  messages.js
  modal messages for Black Box editor
*/

let EXP_MESSAGE = /## (.+?)\n#### (.+?)\n\n(.+?)\n\n\[(.+?)\]/gms;
let EXP_BODY_PARAGRAPH = /(.+?)(\n\n|$)/gs;

let last_match;

const e_message_container = document.getElementById('message_container');
const e_message_text_container = document.getElementById('message_text_container');
const e_message_heading = document.getElementById('message_heading');
const e_message_subheading = document.getElementById('message_subheading');
const e_message_body = document.getElementById('message_body');
const e_confirm_message = document.getElementById('confirm_message');
const e_editor_top_container = document.getElementById('editor_top_container');
const e_editor_bottom_container = document.getElementById('editor_bottom_container');

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
 * A message that can be displayed in `#message_container`.
 */
class Message {
  /**
   * Construct a new message from a well-formed string.
   * @param {string} s
   */
  constructor (s) {
    matchWithCapturingGroups(
      s,
      EXP_MESSAGE,
      'heading', 'subheading', 'body', 'confirmation'
    );
    const message = last_match;
    this.heading = message.heading;
    this.subheading = message.subheading;
    this.body = message.body;
    this.confirmation = message.confirmation;
  }
  /**
   * Show this message, and return it.
   */
  show () {
    // the easy part
    e_message_heading.innerHTML = this.heading;
    e_message_subheading.innerHTML = this.subheading;
    e_message_body.innerHTML = '';
    e_confirm_message.innerHTML = this.confirmation;
    // the hard part
    matchAllWithCapturingGroups(
      this.body,
      EXP_BODY_PARAGRAPH,
      'text',
      '_',
    );
    for (const paragraph of last_match) {
      const p = document.createElement('p');
      p.innerHTML = paragraph.text
        .replaceAll('\\\n', '<br>')
        .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
        .replace(/\*(.+?)\*/g, '<i>$1</i>')
        .replace(/`(.+?)`/g, `<span class="mono green">$1</span>`);
      e_message_body.appendChild(p);
    }
    // the second easy part
    e_message_container.className = '';
    e_confirm_message.disabled = true;
    e_editor_top_container.classList.add('oh');
    e_editor_top_container.classList.add('in');
    e_editor_bottom_container.classList.add('oh');
    e_editor_bottom_container.classList.add('in');
    // the third easy part
    e_message_text_container.scrollTo({ top: 0 });
    if (e_message_text_container.scrollTop + e_message_text_container.clientHeight >= e_message_text_container.scrollHeight) {
      e_confirm_message.disabled = false;
    }
    // return
    return this;
  }
}

const feedback = new Message(
`## Feedback
#### Vox populi vox dei

If you have a suggestion on how to improve the editor, I'd love to hear it!

You have two options:

<ul>
  <li>
    <a class="red" href="https://github.com/hackclub/black-box/issues/new?template=bug_report.md" target="_blank">Report a bug</a>
  </li>
  <li>
    <a class="yellow" href="https://github.com/hackclub/black-box/issues/new?template=feature_request.md" target="_blank">Request a feature</a>
  </li>
</ul>

[Nevermind]`
);

const soft_launch = new Message(
`## Black Box editor
#### (Soft launch)

**You've unlocked the pre-release version of the Black Box editor!**

This is what you'll be using to design and test your submission for Black Box.\\
I've been working on this in private for almost three weeks, and now it's just about ready for public consumption. **I need your help to get it there.**

Your mission, should you choose to accept it: *Write your first program in the editor!*\\
*Read the docs*, *ask questions*, and above all, **try your best!**

If you'd like to **report a bug in the editor** that *prevents your code from working* the way it should, or you'd like to **request a feature** that the editor is missing, you can do so using the <b class="red">Feedback</b> link at the top of the page.\\
Your feedback will help me make the editor **the best it can be** ahead of Black Box's official launch on February 22 &#x1f604;

[Let's go!]`
);

export default {
  feedback,
  soft_launch,
}