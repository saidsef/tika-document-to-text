document.addEventListener('DOMContentLoaded', () => {
  const Speech = function() {};
  Speech.prototype.getSelection = (e) => {
    console.log('getSelection prototype activate');
    if (window.getSelection) {
      return window.getSelection().toString().length ? window.getSelection().toString() : e;
    } else if (document.selection && document.selection.type != "Control") {
      return document.selection.createRange().text;
    } else {
      return e;
    }
  }
  function download(text) {
    const fileUrl = URL.createObjectURL(new Blob([text.val()], {type: 'plain/txt'}));
    return [fileUrl, `download-${new Date().getMilliseconds().toString()}.txt`];
  }
  function doVoices() {
    const voicelist = $('#voiceselection');
    if (voicelist.find('option').length == 0) {
      speechSynthesis.getVoices().sort((a,b) => { return a.lang.localeCompare(a.lang); }).forEach((voice, index) => {
        const option = $('<option>').val(index).html(voice.name + ' (' + voice.lang + ')');
        if (voice.default) option.prop("selected");
        voicelist.append(option);
      });
    }
  }
  if ('speechSynthesis' in window) {
    const msg = new SpeechSynthesisUtterance();
    const d = $('#download'); d.hide();
    const speech = new Speech();
    doVoices();
    if ('onvoiceschanged' in speechSynthesis) {
      speechSynthesis.addEventListener('voiceschanged', doVoices);
    }
    $('#read').click(() => {
      const text = speech.getSelection($('#text'));
      speechSynthesis.cancel();
      msg.voice   = speechSynthesis.getVoices()[$('#voiceselection').find(":selected").val()];
      msg.rate    = 0.9;
      msg.pitch   = 1;
      msg.text    = typeof(text) === 'object' ? text.val() : text;
      msg.onpause = (e) => {
        console.log(`Speech paused after ${e.elapsedTime} milliseconds.`);
      }
      msg.onresume = (e) => {
        console.log(`Speech resumed after ${e.elapsedTime} milliseconds.`);
      }
      msg.onend = (e) => {
        console.log(`Speech finished after ${e.elapsedTime} milliseconds.`);
      };
      msg.onboundary = (e) => {
        if (typeof(text) === 'object')
          text.focus().prop({'selectionStart': e.charIndex, 'selectionEnd': (e.charIndex+e.charLength+1), 'color': 'ff00cc', 'selectionDirection': 'forward'});
      }
      speechSynthesis.speak(msg);

      if (typeof(text) === 'object') {
        if (text.val().length > 10) {
          const link  = download(text);
          d.prop({'href': link[0], 'download': link[1]})
          d.show()
        }
      }
    });
    $('#pause').click(() => {
      msg.paused = true;
      speechSynthesis.pause();
    });
    $('#resume').click(() => {
      speechSynthesis.resume();
    });
  }
}, false);
document.addEventListener('unload', () => {
  window.speechSynthesis.cancel();
}, false);
