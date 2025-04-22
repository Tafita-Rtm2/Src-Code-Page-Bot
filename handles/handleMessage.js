const axios = require('axios');
const { sendMessage } = require('./sendMessage');
const franc = require('franc-min');
const iso6391 = require('iso-639-1');

const userSessions = new Map();

const quickReplies = [
  { title: 'Français 🇫🇷', payload: 'FR' },
  { title: 'Anglais 🇬🇧', payload: 'EN' },
  { title: 'Allemand 🇩🇪', payload: 'DE' },
  { title: 'Espagnol 🇪🇸', payload: 'ES' },
  { title: 'Malgache 🇲🇬', payload: 'MG' },
  { title: 'Coréen 🇰🇷', payload: 'KO' },
  { title: 'Japonais 🇯🇵', payload: 'JA' }
];

function detectLanguageLocally(text) {
  const iso639_3 = franc(text || '');
  if (iso639_3 === 'und') return 'EN'; // fallback
  const iso639_1 = iso6391.getCode(iso639_3);
  return iso639_1 ? iso639_1.toUpperCase() : 'EN';
}

function getLanguageName(code) {
  return iso6391.getName(code.toLowerCase()) || code;
}

async function translateText(text, from, to) {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
    const response = await axios.get(url);
    return response.data?.responseData?.translatedText || 'Traduction non trouvée.';
  } catch (err) {
    console.error('Erreur de traduction:', err);
    return 'Erreur lors de la traduction.';
  }
}

async function handleMessage(event, pageAccessToken) {
  const senderId = event?.sender?.id;
  if (!senderId || !event.message) return;

  const message = event.message;
  const quickReply = message.quick_reply?.payload;
  const messageText = message.text?.trim();

  if (quickReply) {
    const session = userSessions.get(senderId);
    if (!session || !session.originalText || !session.detectedLang) {
      return sendMessage(senderId, { text: "Aucun message à traduire. Envoie un message d'abord." }, pageAccessToken);
    }

    const translation = await translateText(session.originalText, session.detectedLang, quickReply);
    return sendMessage(senderId, {
      text: `**${getLanguageName(session.detectedLang)} → ${getLanguageName(quickReply)}**\n${translation}`
    }, pageAccessToken);
  }

  if (!messageText) return;

  const detectedLang = detectLanguageLocally(messageText);
  userSessions.set(senderId, {
    originalText: messageText,
    detectedLang
  });

  const langName = getLanguageName(detectedLang);

  return sendMessage(senderId, {
    text: `Langue détectée : ${langName}\nChoisis une langue pour la traduction :`,
    quick_replies: quickReplies.map(q => ({
      content_type: 'text',
      title: q.title,
      payload: q.payload
    }))
  }, pageAccessToken);
}

module.exports = { handleMessage };
