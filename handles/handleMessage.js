const axios = require('axios');
const franc = require('franc');
const iso6391 = require('iso-639-1');
const { sendMessage } = require('./sendMessage');

async function handleMessage(event, pageAccessToken) {
  const senderId = event?.sender?.id;
  if (!senderId) return console.error('Invalid event object');

  // 1. Handle quick reply payload for translation
  const quick = event.message?.quick_reply?.payload;
  if (quick) {
    const [action, srcLang, tgtLang, encodedText] = quick.split('|');
    if (action === 'translate' && srcLang && tgtLang && encodedText) {
      const text = decodeURIComponent(encodedText);
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${srcLang}|${tgtLang}`;
      try {
        const { data } = await axios.get(url);
        const translated = data.responseData?.translatedText;
        return sendMessage(senderId, { text: translated || 'Erreur de traduction.' }, pageAccessToken);
      } catch (err) {
        console.error('Translation API error:', err.message);
        return sendMessage(senderId, { text: 'Erreur lors de la traduction.' }, pageAccessToken);
      }
    }
  }

  // 2. Handle normal text: propose language options
  const text = event.message?.text?.trim();
  if (!text) return console.log('No text to translate');

  // Detect language ISO-639-1
  let lang3 = franc(text, { minLength: 3 });
  let srcLang = iso6391.getCode(lang3.toUpperCase()) || 'en';
  srcLang = srcLang.toUpperCase();

  // Define target languages excluding source
  const allLangs = ['EN', 'FR', 'ES', 'DE', 'MG'];
  const targets = allLangs.filter(l => l !== srcLang);

  // Build quick replies
  const quickReplies = targets.map(l => ({
    content_type: 'text',
    title: iso6391.getName(l),
    payload: `translate|${srcLang}|${l}|${encodeURIComponent(text)}`
  }));

  // Send message with quick replies
  return sendMessage(senderId, {
    text: 'Choisissez la langue de traduction :',
    quick_replies: quickReplies
  }, pageAccessToken);
}

module.exports = { handleMessage };
