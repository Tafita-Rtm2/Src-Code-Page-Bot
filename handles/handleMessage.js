const axios = require('axios');
const franc = require('franc-min');
const iso6391 = require('iso-639-1');
const { sendMessage } = require('./sendMessage');

// Mémoire par utilisateur : { message: string, lang: string }
const userMemory = new Map();

const quickReplies = [
  { title: 'Français 🇫🇷', payload: 'FR' },
  { title: 'Anglais 🇬🇧', payload: 'EN' },
  { title: 'Allemand 🇩🇪', payload: 'DE' },
  { title: 'Espagnol 🇪🇸', payload: 'ES' },
  { title: 'Malgache 🇲🇬', payload: 'MG' },
  { title: 'Coréen 🇰🇷', payload: 'KO' },
  { title: 'Japonais 🇯🇵', payload: 'JA' }
];

function detectLanguage(text) {
  const langCode3 = franc(text);
  const langCode2 = iso6391.getCode(langCode3);
  return langCode2 ? langCode2.toUpperCase() : 'EN'; // fallback
}

async function translateText(text, sourceLang, targetLang) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`;
  try {
    const response = await axios.get(url);
    return response.data.responseData.translatedText;
  } catch (error) {
    console.error('Erreur traduction :', error);
    return 'Erreur de traduction.';
  }
}

async function handleMessage(event, pageAccessToken) {
  const senderId = event?.sender?.id;
  if (!senderId) return;

  const message = event.message;
  const quickReply = message?.quick_reply?.payload;
  const messageText = message?.text?.trim();

  if (!messageText) return;

  if (quickReply) {
    const memory = userMemory.get(senderId);
    if (!memory) {
      return sendMessage(senderId, { text: "Aucun message précédent trouvé pour traduire." }, pageAccessToken);
    }

    const { message: originalText, lang: detectedLang } = memory;
    const translated = await translateText(originalText, detectedLang, quickReply);
    return sendMessage(senderId, {
      text: `Traduction (${detectedLang} → ${quickReply}) :\n${translated}`
    }, pageAccessToken);
  }

  // Détection de la langue et enregistrement
  const detectedLang = detectLanguage(messageText);
  userMemory.set(senderId, { message: messageText, lang: detectedLang });

  const quickReplyPayload = {
    text: `Langue détectée : ${detectedLang}. En quelle langue veux-tu le traduire ?`,
    quick_replies: quickReplies.map(q => ({
      content_type: 'text',
      title: q.title,
      payload: q.payload
    }))
  };

  await sendMessage(senderId, quickReplyPayload, pageAccessToken);
}

module.exports = { handleMessage };
