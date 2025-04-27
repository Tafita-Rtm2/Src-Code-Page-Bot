const axios = require('axios');
const franc = require('franc-min');
const iso6391 = require('iso-639-1');
const { sendMessage } = require('./sendMessage');

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
  const lang3 = franc(text);
  if (lang3 === 'und') {
    console.warn('Langue non détectée, fallback EN');
    return 'EN';
  }

  const lang2 = iso6391.getCode(lang3); // ex: 'fra' → 'fr'
  if (!lang2) {
    console.warn(`Langue ISO non trouvée pour ${lang3}, fallback EN`);
    return 'EN';
  }

  return lang2.toUpperCase();
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

  if (quickReply) {
    const memory = userMemory.get(senderId);
    if (!memory) {
      console.warn('Mémoire vide pour quick reply', senderId);
      return sendMessage(senderId, { text: "Aucun message précédent trouvé pour traduire." }, pageAccessToken);
    }

    const { message: originalText, lang: detectedLang } = memory;
    const translated = await translateText(originalText, detectedLang, quickReply);
    return sendMessage(senderId, {
      text: `Traduction (${detectedLang} → ${quickReply}) :\n${translated}`
    }, pageAccessToken);
  }

  if (messageText) {
    const detectedLang = detectLanguage(messageText);
    userMemory.set(senderId, { message: messageText, lang: detectedLang });
    console.log('Mémoire mise à jour :', userMemory);

    const quickReplyPayload = {
      text: `Langue détectée : ${detectedLang}. En quelle langue veux-tu le traduire ?`,
      quick_replies: quickReplies.map(q => ({
        content_type: 'text',
        title: q.title,
        payload: q.payload
      }))
    };

    return sendMessage(senderId, quickReplyPayload, pageAccessToken);
  }
}
