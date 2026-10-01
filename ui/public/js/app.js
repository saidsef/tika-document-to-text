'use strict';

const el = (id) => document.getElementById(id);

const form = el('convert');
const fileInput = el('doc');
const dropzone = el('dropzone');
const dropzoneTitle = el('dropzone-title');
const dropOverlay = el('drop-overlay');
const fileMeta = el('file-meta');
const fileExt = el('file-ext');
const fileName = el('file-name');
const fileSize = el('file-size');
const fileClear = el('file-clear');
const textArea = el('text');
const resultMeta = el('result-meta');
const counts = el('counts');
const previewWrap = el('image-preview-wrap');
const preview = el('image-preview');
const submit = el('submit');
const submitLabel = el('submit-label');
const submitKbd = el('submit-kbd');
const spinner = el('spinner');
const progressWrap = el('progress-wrap');
const elapsed = el('elapsed');
const status = el('status');
const undo = el('undo');
const copy = el('copy');
const copyLabel = el('copy-label');
const download = el('download');
const clear = el('clear');

const MAX_BYTES = Number(form.dataset.maxBytes) || 0;
const MUTED = ['text-muted-foreground-1'];
const DANGER = ['text-red-600', 'dark:text-red-400'];
const SUCCESS = ['text-teal-700', 'dark:text-teal-400'];
const TONES = [...MUTED, ...DANGER, ...SUCCESS];

const IS_MAC = /mac|iphone|ipad/i.test(navigator.userAgentData?.platform || navigator.platform);
const MOD = IS_MAC ? '⌘' : 'Ctrl';
document.querySelectorAll('[data-mod]').forEach((node) => { node.textContent = MOD; });

const announce = (message, tone = MUTED) => {
  status.classList.remove(...TONES);
  status.classList.add(...tone);
  status.textContent = message;
};

const plural = (count, word) => `${count.toLocaleString()} ${word}${count === 1 ? '' : 's'}`;

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['GB', 'MB', 'kB'];
  let value = bytes / 1024;
  let unit = units.pop();
  while (value >= 1024 && units.length) { value /= 1024; unit = units.pop(); }
  return `${Number.isInteger(value) ? value : value.toFixed(1)} ${unit}`;
};

const alertDismiss = el('alert-dismiss');
if (alertDismiss) {
  alertDismiss.addEventListener('click', () => {
    el('alert').remove();
    fileInput.focus();
  });
}

/* ---------- choosing a file ---------- */

let busy = false;

const setInvalid = (on) => {
  if (on) dropzone.dataset.invalid = '';
  else delete dropzone.dataset.invalid;
  fileInput.setAttribute('aria-invalid', String(on));
};

const showPreview = (file) => {
  if (preview.src && preview.src.startsWith('blob:')) URL.revokeObjectURL(preview.src);
  if (file && file.type.startsWith('image/')) {
    preview.src = URL.createObjectURL(file);
    previewWrap.hidden = false;
  } else {
    preview.removeAttribute('src');
    previewWrap.hidden = true;
  }
};

const clearSelection = () => {
  fileInput.value = '';
  fileMeta.hidden = true;
  dropzoneTitle.textContent = 'Drop a file here or';
  showPreview(null);
};

const extensionOf = (file) => {
  const dot = file.name.lastIndexOf('.');
  const ext = dot > 0 ? file.name.slice(dot + 1) : file.type.split('/')[1] || 'file';
  return ext.slice(0, 4);
};

const describeSelection = (how = 'chosen') => {
  const file = fileInput.files[0];
  if (!file) {
    clearSelection();
    return;
  }

  if (MAX_BYTES && file.size > MAX_BYTES) {
    clearSelection();
    setInvalid(true);
    announce(`${file.name} is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_BYTES)}.`, DANGER);
    return;
  }

  setInvalid(false);
  fileExt.textContent = extensionOf(file);
  fileName.textContent = file.name;
  fileSize.textContent = `${formatBytes(file.size)} · ready to convert`;
  fileMeta.hidden = false;
  dropzoneTitle.textContent = 'Drop a different file or';
  showPreview(file);
  announce(`${file.name} ${how === 'pasted' ? 'was pasted from the clipboard' : 'is ready'}. Select Convert to text, or press ${MOD} + Enter.`);
};

const selectFile = (file, how) => {
  const transfer = new DataTransfer();
  transfer.items.add(file);
  fileInput.files = transfer.files;
  describeSelection(how);
};

// A file named .png that the browser cannot decode would otherwise show a broken image.
preview.addEventListener('error', () => { previewWrap.hidden = true; });

fileInput.addEventListener('change', () => describeSelection());
fileClear.addEventListener('click', () => {
  clearSelection();
  announce('Selection cleared.');
  fileInput.focus();
});

// Accept a file dropped anywhere on the page, not only on the drop zone.
let dragDepth = 0;
const carriesFiles = (event) => Array.from(event.dataTransfer?.types || []).includes('Files');
const dragging = (on) => {
  dropOverlay.hidden = !on;
  if (on) dropzone.dataset.dragover = '';
  else delete dropzone.dataset.dragover;
};

window.addEventListener('dragenter', (event) => {
  if (!carriesFiles(event) || busy) return;
  event.preventDefault();
  dragDepth += 1;
  dragging(true);
});

window.addEventListener('dragover', (event) => {
  if (!carriesFiles(event)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = busy ? 'none' : 'copy';
});

window.addEventListener('dragleave', (event) => {
  if (!carriesFiles(event)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) dragging(false);
});

window.addEventListener('drop', (event) => {
  if (!carriesFiles(event)) return;
  event.preventDefault();
  dragDepth = 0;
  dragging(false);
  const [file, ...rest] = event.dataTransfer.files;
  if (!file || busy) return;
  selectFile(file);
  if (rest.length) announce(`Only one file converts at a time, so ${file.name} was kept.`);
});

// A copied screenshot arrives as a file, which suits OCR.
document.addEventListener('paste', (event) => {
  const file = event.clipboardData?.files?.[0];
  if (!file || busy) return;
  // Office copies carry an image of the selection as well, but the user meant the text.
  if (event.target === textArea && event.clipboardData.types.includes('text/plain')) return;
  event.preventDefault();
  selectFile(file, 'pasted');
});

/* ---------- the extracted text ---------- */

let cleared = '';
let undoTimer = null;

const hideUndo = () => {
  clearTimeout(undoTimer);
  undo.hidden = true;
  cleared = '';
};

const textChanged = () => {
  const text = textArea.value;
  const empty = !text.trim();
  const words = empty ? 0 : text.trim().split(/\s+/).length;
  counts.textContent = text ? `${plural(words, 'word')} · ${plural(text.length, 'character')}` : '';
  [copy, download, clear].forEach((button) => { button.disabled = empty; });
  el('speak').disabled = empty;
  // The chips describe the converted file, so they go when its text does.
  if (resultMeta) resultMeta.hidden = empty;
};

// Replaced below when the browser can speak.
let stopReading = () => {};

textArea.addEventListener('input', () => {
  hideUndo();
  textChanged();
});
textChanged();

const HINT = window.matchMedia('(pointer: coarse)').matches
  ? 'Choose a file, then select Convert to text.'
  : `Drop or paste a file anywhere on the page, then press ${MOD} + Enter to convert.`;

const downloadName = () => {
  const source = (fileInput.files[0]?.name || textArea.dataset.source).replace(/\.[^.]+$/, '');
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `${source || 'extracted'}-${stamp}.txt`;
};

download.addEventListener('click', () => {
  const text = textArea.value;
  if (!text.trim()) return announce('There is no text to download yet.', DANGER);

  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = downloadName();
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  announce(`Saved as ${link.download}.`, SUCCESS);
});

copy.addEventListener('click', async () => {
  const text = textArea.value;
  if (!text.trim()) return announce('There is no text to copy yet.', DANGER);

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    textArea.focus();
    textArea.select();
    return announce(`Copying was blocked. The text is selected, so press ${MOD} + C.`, DANGER);
  }

  copyLabel.textContent = 'Copied';
  setTimeout(() => { copyLabel.textContent = 'Copy'; }, 1500);
  announce('Text copied to the clipboard.', SUCCESS);
});

clear.addEventListener('click', () => {
  if (!textArea.value) return;
  stopReading();
  cleared = textArea.value;
  textArea.value = '';
  textChanged();
  announce('Text cleared.');
  undo.hidden = false;
  clearTimeout(undoTimer);
  undoTimer = setTimeout(hideUndo, 10000);
  textArea.focus();
});

undo.addEventListener('click', () => {
  if (!cleared) return;
  textArea.value = cleared;
  hideUndo();
  textChanged();
  announce('Text restored.', SUCCESS);
  textArea.focus();
});

/* ---------- read aloud ---------- */

const synth = window.speechSynthesis;

if (synth) {
  const speechControls = el('speech-controls');
  const voiceSelect = el('voiceselection');
  const speak = el('speak');
  const speakLabel = el('speak-label');
  const stop = el('stop');
  const LABELS = { idle: 'Listen', speaking: 'Pause', paused: 'Resume' };
  const languageNames = new Intl.DisplayNames(['en'], { type: 'language' });
  const baseOf = (tag) => (tag || '').toLowerCase().split(/[-_]/)[0];
  let voices = [];
  let state = 'idle';
  let chosen = '';
  let current = null;

  const setState = (next) => {
    state = next;
    speak.dataset.state = next;
    speakLabel.textContent = LABELS[next];
    stop.hidden = next === 'idle';
  };

  const nameOf = (base) => {
    try {
      return languageNames.of(base) || base;
    } catch {
      return base;
    }
  };

  const loadVoices = () => {
    // getVoices() is empty until the engine is ready, hence the voiceschanged listener below.
    voices = synth.getVoices();
    if (!voices.length) return;

    // Voices for the detected language come first, so the default matches the document.
    const tag = (textArea.lang || navigator.language || '').toLowerCase();
    const wanted = baseOf(tag);
    const groups = new Map();
    voices.forEach((voice) => {
      const base = baseOf(voice.lang);
      if (!groups.has(base)) groups.set(base, []);
      groups.get(base).push(voice);
    });
    const order = [...groups.keys()].sort((a, b) => (b === wanted) - (a === wanted) || nameOf(a).localeCompare(nameOf(b)));

    voiceSelect.replaceChildren(...order.map((base) => {
      const group = document.createElement('optgroup');
      group.label = nameOf(base);
      group.append(...groups.get(base)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((voice) => new Option(`${voice.name} (${voice.lang})`, voice.voiceURI)));
      return group;
    }));

    const matching = groups.get(wanted) || [];
    const fallback = matching.find((voice) => voice.default) ||
      matching.find((voice) => voice.lang.toLowerCase().replace('_', '-') === tag) ||
      matching[0] || voices.find((voice) => voice.default) || voices[0];
    voiceSelect.value = chosen || fallback.voiceURI;
    speechControls.hidden = false;
  };

  stopReading = () => {
    current = null;
    synth.cancel();
    setState('idle');
  };

  loadVoices();
  synth.addEventListener('voiceschanged', loadVoices);
  voiceSelect.addEventListener('change', () => { chosen = voiceSelect.value; });

  speak.addEventListener('click', (event) => {
    if (state === 'speaking') {
      synth.pause();
      setState('paused');
      return announce('Paused.');
    }
    if (state === 'paused') {
      synth.resume();
      setState('speaking');
      return announce('Reading aloud.');
    }

    const { selectionStart, selectionEnd } = textArea;
    const selected = textArea.value.slice(selectionStart, selectionEnd).trim();
    const text = selected || textArea.value;
    if (!text.trim()) return announce('There is no text to read yet.', DANGER);

    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voices.find((voice) => voice.voiceURI === voiceSelect.value) || null;
    utterance.rate = 0.9;
    current = utterance;

    // A cancelled utterance can still report back after Stop, Clear or a new Listen.
    utterance.onstart = () => {
      if (current !== utterance) return;
      setState('speaking');
      // A keyboard user keeps focus on the button so Pause stays one key press away.
      if (!selected && event.detail > 0) textArea.focus({ preventScroll: true });
      announce(selected ? 'Reading the selection aloud.' : 'Reading aloud.');
    };
    utterance.onend = () => {
      if (current !== utterance) return;
      current = null;
      setState('idle');
      if (!selected) textArea.setSelectionRange(0, 0);
      announce('Finished reading.');
    };
    // Follow along in the textarea, but only when reading its full contents.
    utterance.onerror = () => {
      if (current !== utterance) return;
      current = null;
      setState('idle');
    };
    utterance.onboundary = (boundary) => {
      if (!selected && current === utterance) textArea.setSelectionRange(boundary.charIndex, boundary.charIndex + (boundary.charLength || 0));
    };

    synth.speak(utterance);
  });

  stop.addEventListener('click', () => {
    stopReading();
    announce('Stopped reading.');
    speak.focus();
  });

  window.addEventListener('pagehide', () => synth.cancel());
}

/* ---------- conversion in progress ---------- */

let ticker = null;

const idle = () => {
  clearInterval(ticker);
  busy = false;
  submit.disabled = false;
  submitLabel.textContent = 'Convert to text';
  submitKbd.hidden = false;
  spinner.hidden = true;
  progressWrap.hidden = true;
  elapsed.textContent = '0:00';
  delete form.dataset.busy;
};

form.addEventListener('submit', (event) => {
  if (!fileInput.files.length) {
    event.preventDefault();
    setInvalid(true);
    fileInput.focus();
    return announce('Choose a document to convert first.', DANGER);
  }

  busy = true;
  stopReading();
  submit.disabled = true;
  submitLabel.textContent = 'Converting';
  submitKbd.hidden = true;
  spinner.hidden = false;
  progressWrap.hidden = false;
  form.dataset.busy = '';
  announce('Converting your document. Large scanned files can take a few minutes.');

  const started = Date.now();
  ticker = setInterval(() => {
    const seconds = Math.round((Date.now() - started) / 1000);
    elapsed.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }, 1000);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !submit.disabled) form.requestSubmit();
});

// Going back to this page restores the DOM as it was, mid-submit button included.
window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  idle();
  announce(HINT);
});

if (textArea.value) {
  const source = textArea.dataset.source;
  const words = textArea.value.trim().split(/\s+/).length;
  announce(`Extracted ${plural(words, 'word')}${source ? ` from ${source}` : ''}.`, SUCCESS);
  if (!window.matchMedia('(min-width: 1024px)').matches) {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el('result').scrollIntoView({ block: 'start', behavior: still ? 'auto' : 'smooth' });
  }
} else {
  announce(HINT);
}
