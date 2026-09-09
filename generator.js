"use strict";

(() => {
  const output = document.getElementById('generatedPassword');
  const options = document.getElementById('generatorLengths');
  const copy = document.getElementById('copyGeneratedPassword');
  const generate = document.getElementById('generatePassword');
  const status = document.getElementById('toast');
  let length = 32;
  let statusTimer;
  let copyTimer;
  const copyIcon = copy.innerHTML;
  const groups = [
    'ABCDEFGHJKLMNPQRSTUVWXYZ',
    'abcdefghijkmnopqrstuvwxyz',
    '23456789',
    '!@#$%^&*()-_=+[]{}:,.?',
  ];
  const alphabet = groups.join('');

  function randomIndex(limit) {
    const ceiling = 256 - (256 % limit);
    const bytes = new Uint8Array(1);
    do { crypto.getRandomValues(bytes); } while (bytes[0] >= ceiling);
    return bytes[0] % limit;
  }

  function announce(message) {
    clearTimeout(statusTimer);
    status.textContent = message;
    status.classList.add('show');
    statusTimer = setTimeout(() => status.classList.remove('show'), 2400);
  }

  function resetCopy() {
    clearTimeout(copyTimer);
    copy.innerHTML = copyIcon;
    copy.classList.remove('copied');
    copy.setAttribute('aria-label', 'Copy generated password');
    copy.title = 'Copy generated password';
  }

  function createPassword() {
    const chars = groups.map(group => group[randomIndex(group.length)]);
    while (chars.length < length) chars.push(alphabet[randomIndex(alphabet.length)]);
    for (let index = chars.length - 1; index > 0; index--) {
      const other = randomIndex(index + 1);
      [chars[index], chars[other]] = [chars[other], chars[index]];
    }
    output.value = chars.join('');
    resetCopy();
  }

  options.addEventListener('click', event => {
    const button = event.target.closest('[data-length]');
    const selected = Number(button?.dataset.length);
    if (![16, 32, 64].includes(selected)) return;
    length = selected;
    options.querySelectorAll('[data-length]').forEach(option => {
      const active = Number(option.dataset.length) === length;
      option.classList.toggle('active', active);
      option.setAttribute('aria-pressed', String(active));
    });
    createPassword();
    announce(`Generated a new ${length}-character password.`);
  });
  generate.addEventListener('click', () => {
    createPassword();
    announce(`Generated a new ${length}-character password.`);
  });
  copy.addEventListener('click', async () => {
    const value = output.value;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      if (output.value !== value) return;
      resetCopy();
      copy.textContent = '✓';
      copy.classList.add('copied');
      copy.setAttribute('aria-label', 'Generated password copied');
      copy.title = 'Copied';
      announce('Generated password copied to the clipboard.');
      copyTimer = setTimeout(resetCopy, 1500);
    } catch {
      announce('Clipboard access was blocked by the browser.');
    }
  });
  if (!globalThis.crypto?.getRandomValues) {
    generate.disabled = true;
    copy.disabled = true;
    options.querySelectorAll('button').forEach(button => { button.disabled = true; });
    announce('Secure password generation is unavailable in this browser.');
    return;
  }
  createPassword();
})();
