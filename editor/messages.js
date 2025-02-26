/*
  messages.js
  modal messages for Black Box editor
*/

let EXP_MESSAGE = /## (.+?)\n#### (.+?)\n\n(.+?)\n\n\[(.+?)\]( \[(.+?)\])?/gms;
let EXP_BODY_PARAGRAPH = /(.+?)(\n\n|$)/gs;

let last_match;

const e_message_container = document.getElementById('message_container');
const e_message_text_container = document.getElementById('message_text_container');
const e_message_heading = document.getElementById('message_heading');
const e_message_subheading = document.getElementById('message_subheading');
const e_message_body = document.getElementById('message_body');
const e_confirm_message = document.getElementById('confirm_message');
const e_deny_message = document.getElementById('deny_message');
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
  constructor (name, s, small = false) {
    this.name = name;
    this.small = small;
    matchWithCapturingGroups(
      s,
      EXP_MESSAGE,
      'heading', 'subheading', 'body', 'confirm', '_', 'deny'
    );
    const message = last_match;
    this.heading = message.heading;
    this.subheading = message.subheading;
    this.body = message.body;
    this.confirm = message.confirm;
    this.deny = message.deny;
  }
  /**
   * Show this message, and return it.
   */
  show () {
    // the easy part
    e_message_heading.innerHTML = this.heading;
    e_message_subheading.innerHTML = this.subheading;
    e_message_body.innerHTML = '';
    e_confirm_message.innerHTML = this.confirm;
    if (this.deny === '') {
      e_deny_message.className = 'dn';
    } else {
      e_deny_message.className = '';
      e_deny_message.innerHTML = this.deny;
    }
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
    if (this.small === true) {
      e_message_container.className = 'small';
    } else {
      e_message_container.className = '';
    }
    e_confirm_message.disabled = true;
    e_deny_message.disabled = true;
    e_editor_top_container.classList.add('oh');
    e_editor_top_container.classList.add('in');
    e_editor_bottom_container.classList.add('oh');
    e_editor_bottom_container.classList.add('in');
    // the third easy part
    e_message_text_container.scrollTo({ top: 0 });
    if (e_message_text_container.scrollTop + e_message_text_container.clientHeight >= e_message_text_container.scrollHeight - 20) {
      e_confirm_message.disabled = false;
      e_deny_message.disabled = false;
    }
    // return
    return this;
  }
}

// class SmallMessage extends Message {}

const confirm_edit = new Message('confirm_edit',
`## Are you sure?
#### ...

If you hit Edit, the code you were editing before you viewed this permalink will be lost forever! (A long time!)

[Edit] [Cancel]`,
true
);

const confirm_reset = new Message('confirm_reset',
`## Are you sure?
#### ...

If you hit Reset, the code you were editing before will be lost forever! (A long time!)

[Reset] [Cancel]`,
true
);

const feedback = new Message('feedback',
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

const soft_launch = new Message('soft_launch',
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

const launch = new Message('launch',
`## Black Box editor
#### Official launch

**Welcome to the Black Box editor!**

This is what you'll be using to design and test your submission for Black Box. It won't be easy, but I know you can do it!\\
*Read the docs*, *ask questions*, and above all, **try your best!**

If you'd like to **report a bug in the editor** that *prevents your code from working* the way it should, or you'd like to **request a feature** that the editor is missing, you can do so using the <b class="red">Feedback</b> link at the top of the page.\\
I can't wait to see what you create with it &#x1f604;

[Let's go!]`
);

const v0_1_0rc2 = new Message('v0_1_0rc2',
`## What's new?
#### Version 0.1.0rc2

These features are now available:

<ul>
  <li>**Empty arrays** &ndash; Define arrays without an initializer list, like \`int data[8];\`</li>
  <li>**UI improvements** &ndash; Increased status contrast, made the buttons light up</li>
  <li>**"What's new?"** &ndash; You're looking at this right now</li>
</ul>

These bugs have been fixed:

<ul>
  <li>Accessing global variables, functions, and macros should now work 100% of the time</li>
  <li>Accessing anything that doesn't exist now throws an error</li>
  <li>The AST now correctly parses prefix expressions, e.g. \`int a = -1;\`</li>
  <li>Fixed an issue with \`blackbox->sleep()\`</li>
</ul>

[Awesome!]`
);

const v0_1_0 = new Message('v0_1_0',
`## What's new?
#### Version 0.1.0

These features are now available:

<ul>
  <li>**Permalinks** &ndash; Use this when you're ready to submit</li>
</ul>

These bugs have been fixed:

<ul>
  <li>Fixed static analysis</li>
</ul>

[Awesome!]`
);

const v0_2_0 = new Message('v0_2_0',
`## What's new?
#### Version 0.2.0

These features are now available:

<ul>
  <li>**Improved permalinks** &ndash; Each permalink is now assigned a 6-character hex code as a slug (<a href="https://github.com/hackclub/black-box/issues/6" target="_blank">#6</a>)</li>
  <li>**UI improvements** &ndash; Removed audio icon; enabled viewing docs while your code is running (<a href="https://github.com/hackclub/black-box/issues/11" target="_blank">#11</a>)</li>
</ul>

These bugs have been fixed:

<ul>
  <li>Fixed another issue with \`blackbox->sleep()\` (<a href="https://github.com/hackclub/black-box/issues/10" target="_blank">#10</a>)</li>
  <li>Tried to prevent some ACE exploits (I'll admit defeat on this one)</li>
</ul>

[Awesome!]`
);

export default {
  confirm_edit,
  confirm_reset,
  feedback,
  soft_launch,
  launch,
  v0_1_0rc2,
  v0_1_0,
  v0_2_0,
}