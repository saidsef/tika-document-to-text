'use strict';

const el = (id) => document.getElementById(id);

const form = el('convert');
const fileInput = el('doc');
const dropzone = el('dropzone');
const fileMeta = el('file-meta');
const fileName = el('file-name');
const fileSize = el('file-size');
const fileClear = el('file-clear');
const textArea = el('text');
const counts = el('counts');
const previewWrap = el('image-preview-wrap');
const preview = el('image-preview');
const submit = el('submit');
const submitLabel = el('submit-label');
const spinner = el('spinner');
const progressWrap = el('progress-wrap');
const elapsed = el('elapsed');
const status = el('status');

const MAX_BYTES = Number(form.dataset.maxBytes) || 0;
const TONES = ['text-body-secondary', 'text-danger', 'text-success'];

const announce = (message, tone = 'text-body-secondary') => {
  status.classList.remove(...TONES);
  status.classList.add(tone);
  status.textContent = message;
};

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['kB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
};

/* ---------- file selection ---------- */

const clearSelection = () => {
  fileInput.value = '';
  fileMeta.hidden = true;
  showPreview(null);
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

const describeSelection = () => {
  const file = fileInput.files[0];
  if (!file) return clearSelection();

  // Catching this here saves the user a multi-megabyte upload that ends in a 413.
  if (MAX_BYTES && file.size > MAX_BYTES) {
    clearSelection();
    announce(`That file is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_BYTES)}.`, 'text-danger');
    return;
  }

  fileName.textContent = file.name;
  fileSize.textContent = [formatBytes(file.size), file.type || 'unknown type'].join(' · ');
  fileMeta.hidden = false;
  showPreview(file);
  announce(`${file.name} is ready. Select Convert to extract its text.`);
};

fileInput.addEventListener('change', describeSelection);
fileClear.addEventListener('click', () => {
  clearSelection();
  announce('Selection cleared.');
  fileInput.focus();
});

['dragenter', 'dragover'].forEach((name) => dropzone.addEventListener(name, (event) => {
  event.preventDefault();
  dropzone.classList.add('dragover');
}));

['dragleave', 'dragend', 'drop'].forEach((name) => dropzone.addEventListener(name, () => {
  dropzone.classList.remove('dragover');
}));

dropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  const file = event.dataTransfer.files[0];
  if (!file) return;

  // The form posts the input, not the drop, so the dropped file has to be moved onto it.
  const transfer = new DataTransfer();
  transfer.items.add(file);
  fileInput.files = transfer.files;
  describeSelection();
});

// A file dropped anywhere else would otherwise navigate away and lose the extracted text.
window.addEventListener('dragover', (event) => event.preventDefault());
window.addEventListener('drop', (event) => event.preventDefault());

/* ---------- extracted text ---------- */

const updateCounts = () => {
  const text = textArea.value;
  if (!text) return counts.replaceChildren();
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  counts.textContent = `${words.toLocaleString()} words · ${text.length.toLocaleString()} characters`;
};

textArea.addEventListener('input', updateCounts);
updateCounts();

const HINT = 'Drop a file on the upload panel, or press Ctrl or Cmd + Enter to convert.';
announce(HINT);

const downloadName = () => {
  const source = fileInput.files[0]?.name.replace(/\.[^.]+$/, '');
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `${source || 'extracted'}-${stamp}.txt`;
};

el('download').addEventListener('click', () => {
  const text = textArea.value;
  if (!text.trim()) return announce('There is no text to download yet.', 'text-danger');

  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = downloadName();
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  announce(`Saved as ${link.download}.`, 'text-success');
});

const copy = el('copy');
copy.addEventListener('click', async () => {
  const text = textArea.value;
  if (!text.trim()) return announce('There is no text to copy yet.', 'text-danger');

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Clipboard access needs a secure context; selecting the text is the next best thing.
    textArea.focus();
    textArea.select();
    return announce('Copying was blocked. The text is selected, so press Ctrl or Cmd + C.', 'text-danger');
  }

  copy.textContent = 'Copied';
  setTimeout(() => { copy.textContent = 'Copy'; }, 1500);
  announce('Text copied to the clipboard.', 'text-success');
});

el('clear').addEventListener('click', () => {
  if (!textArea.value) return;
  textArea.value = '';
  updateCounts();
  announce('Text cleared.');
  textArea.focus();
});

/* ---------- read aloud ---------- */

const synth = window.speechSynthesis;

if (synth) {
  const speechControls = el('speech-controls');
  const voiceControls = el('voice-controls');
  const voiceSelect = el('voiceselection');
  const read = el('read');
  const pause = el('pause');
  const resume = el('resume');
  const stop = el('stop');
  let voices = [];

  const speaking = (on) => {
    pause.hidden = !on;
    resume.hidden = true;
    stop.hidden = !on;
  };

  const loadVoices = () => {
    // getVoices() is empty until the engine is ready, hence the voiceschanged listener below.
    voices = synth.getVoices().slice().sort((a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name));
    if (!voices.length) return;

    voiceSelect.replaceChildren(...voices.map((voice, index) => {
      const option = new Option(`${voice.name} (${voice.lang})`, String(index));
      option.selected = voice.default;
      return option;
    }));
    voiceControls.hidden = false;
    speechControls.hidden = false;
  };

  loadVoices();
  synth.addEventListener('voiceschanged', loadVoices);

  read.addEventListener('click', () => {
    const selected = window.getSelection().toString().trim();
    const text = selected || textArea.value;
    if (!text.trim()) return announce('There is no text to read yet.', 'text-danger');

    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voices[Number(voiceSelect.value)] || null;
    utterance.rate = 0.9;

    utterance.onstart = () => {
      speaking(true);
      if (!selected) textArea.focus();
      announce(selected ? 'Reading the selection aloud.' : 'Reading aloud.');
    };
    utterance.onend = () => {
      speaking(false);
      announce('Finished reading.');
    };
    // Follow along in the textarea, but only when reading its full contents.
    utterance.onboundary = (event) => {
      if (!selected) textArea.setSelectionRange(event.charIndex, event.charIndex + (event.charLength || 0));
    };

    synth.speak(utterance);
  });

  pause.addEventListener('click', () => {
    synth.pause();
    pause.hidden = true;
    resume.hidden = false;
    announce('Paused.');
  });

  resume.addEventListener('click', () => {
    synth.resume();
    resume.hidden = true;
    pause.hidden = false;
    announce('Reading aloud.');
  });

  stop.addEventListener('click', () => {
    synth.cancel();
    speaking(false);
    announce('Stopped reading.');
  });

  window.addEventListener('pagehide', () => synth.cancel());
}

/* ---------- conversion in progress ---------- */

let ticker = null;

const idle = () => {
  clearInterval(ticker);
  submit.disabled = false;
  submitLabel.textContent = 'Convert';
  spinner.hidden = true;
  progressWrap.hidden = true;
  elapsed.textContent = '';
  form.classList.remove('busy');
};

form.addEventListener('submit', (event) => {
  if (!fileInput.files.length) {
    event.preventDefault();
    fileInput.focus();
    return announce('Choose a document to convert first.', 'text-danger');
  }

  submit.disabled = true;
  submitLabel.textContent = 'Converting';
  spinner.hidden = false;
  progressWrap.hidden = false;
  form.classList.add('busy');
  announce('Converting your document. Large scanned files can take a few minutes.');

  // The upload is a plain form post, so elapsed time is the only honest progress there is.
  const started = Date.now();
  ticker = setInterval(() => {
    const seconds = Math.round((Date.now() - started) / 1000);
    elapsed.textContent = `Working for ${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
  }, 1000);
});

// Ctrl or Cmd + Enter submits from anywhere on the page, including the textarea.
document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !submit.disabled) form.requestSubmit();
});

// Going back to this page restores the DOM as it was, mid-submit button included.
window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  idle();
  announce(HINT);
});

// The result is below the fold on a stacked layout, so take the user to it.
if (textArea.value && !window.matchMedia('(min-width: 1200px)').matches) {
  textArea.closest('.card').scrollIntoView({ block: 'start', behavior: 'smooth' });
}
