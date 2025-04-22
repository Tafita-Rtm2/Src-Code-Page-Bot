const fs = require('fs');
const path = require('path');
const axios = require('axios');
const franc = require('franc');
const iso6391 = require('iso-639-1');
const { sendMessage } = require('./sendMessage');

const commands = new Map();
const prefix = '-';

// Load command modules
fs.readdirSync(path.join(__dirname, '../commands'))
  .filter(file => file.endsWith('.js'))
  .forEach(file => {
    const command = require(`../commands/${file}`);
    commands.set(command.name.toLowerCase(), command);
  });

async function handleMessage(event, pageAccessToken) {
  const senderId = event?.sender?.id;
  if (!senderId) return console.error('Invalid event object');

  // Check for quick reply
  const quick = event.message?.quick_reply?.payload;
  if (quick) {
    // Payload format: translate|SRC|TGT|ENCODED_TEXT
    const [action, srcLang, tgtLang, encodedText] = quick.split('|');
    if (action === 'translate' && srcLang && tgtLang && encodedText) {
      const text = decodeURIComponent(encodedText);
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${srcLang}|${tgtLang}`;
      try {
        const { data } = await axios.get(url);
        const translated = data.responseData?.translatedText;
        return sendMessage(senderId, { text: translated || 'Erreur de traduction' }, pageAccessToken);
      } catch (err) {
        console.error('Translation API error:', err.message);
        return sendMessage(senderId, { text: 'Erreur lors de la requête de traduction.' }, pageAccessToken);
      }
    }
  }

  // Normal message handling: send language options
  const messageText = event?.message?.text?.trim();
  if (!messageText) return console.log('Received event without message text');

  // Detect language
  let langCode = franc(messageText, { minLength: 3 });
  if (langCode === 'und' || !iso6391.getCode(langCode.toUpperCase())) {
    langCode = 'en';
  } else {
    // franc returns ISO639-3, convert to ISO639-1
    langCode = iso6391.getCode(langCode.toUpperCase()) || 'en';
  }
  langCode = langCode.toUpperCase();

  // Define target languages
  const allLangs = ['EN', 'FR', 'ES', 'DE', 'MG'];
  const targets = allLangs.filter(l => l !== langCode);

  // Build quick replies
  const quickReplies = targets.map(l => ({
    content_type: 'text',
    title: iso6391.getName(l),
    payload: `translate|${langCode}|${l}|${encodeURIComponent(messageText)}`
  }));

  // Send quick replies to user
  return sendMessage(senderId, {
    text: 'Choisissez la langue de traduction:',
    quick_replies: quickReplies
  }, pageAccessToken);
}

module.exports = { handleMessage };
