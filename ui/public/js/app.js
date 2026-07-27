'use strict';

const el = (id) => document.getElementById(id);

const form = el('convert');
const fileInput = el('doc');
const textArea = el('text');
const previewWrap = el('image-preview-wrap');
const preview = el('image-preview');
const submit = el('submit');
const status = el('status');

const announce = (message) => { status.textContent = message; };

/* ---------- image preview ---------- */

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (preview.src && preview.src.startsWith('blob:')) URL.revokeObjectURL(preview.src);
  if (file && file.type.startsWith('image/')) {
    preview.src = URL.createObjectURL(file);
    previewWrap.hidden = false;
  } else {
    preview.removeAttribute('src');
    previewWrap.hidden = true;
  }
});

/* ---------- download ---------- */

el('download').addEventListener('click', () => {
  const text = textArea.value;
  if (!text.trim()) return announce('There is no text to download yet.');

  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `extracted-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.txt`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

/* ---------- read aloud ---------- */

const synth = window.speechSynthesis;

if (synth) {
  const voiceControls = el('voice-controls');
  const voiceSelect = el('voiceselection');
  const read = el('read');
  const pause = el('pause');
  const resume = el('resume');
  let voices = [];

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
    read.hidden = false;
  };

  loadVoices();
  synth.addEventListener('voiceschanged', loadVoices);

  read.addEventListener('click', () => {
    const selected = window.getSelection().toString().trim();
    const text = selected || textArea.value;
    if (!text.trim()) return announce('There is no text to read yet.');

    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voices[Number(voiceSelect.value)] || null;
    utterance.rate = 0.9;

    utterance.onstart = () => {
      pause.hidden = false;
      resume.hidden = true;
      if (!selected) textArea.focus();
      announce('Reading aloud.');
    };
    utterance.onend = () => {
      pause.hidden = true;
      resume.hidden = true;
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
  });

  resume.addEventListener('click', () => {
    synth.resume();
    resume.hidden = true;
    pause.hidden = false;
  });

  window.addEventListener('pagehide', () => synth.cancel());
}

/* ---------- conversion in progress ---------- */

form.addEventListener('submit', () => {
  submit.disabled = true;
  submit.textContent = 'Converting…';
  form.classList.add('busy');
  announce('Converting your document. Large scanned files can take a few minutes.');
});

// Going back to this page restores the DOM as it was, mid-submit button included.
window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  submit.disabled = false;
  submit.textContent = 'Convert';
  form.classList.remove('busy');
  announce('');
});
