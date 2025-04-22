const axios = require('axios');
const { sendMessage } = require('./sendMessage');
const franc = require('franc-min');
const languageCodes = require('language-codes');

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
  const iso639_3 = franc(text);
  const lang = languageCodes.all().find(l => l['iso639-3'] === iso639_3);
  return lang ? lang.iso639_1?.toUpperCase() || 'EN' : 'EN';
}

function getLanguageName(code) {
  const lang = languageCodes.get(code.toLowerCase());
  return lang ? lang.name : code;
}

async function translateText(text, from, to) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
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
    const session = userSessions.get(senderId);
    if (!session || !session.originalText || !session.detectedLang) {
      return sendMessage(senderId, { text: "Aucun message à traduire. Envoie un message d'abord." }, pageAccessToken);
    }

    const translation = await translateText(session.originalText, session.detectedLang, quickReply);
    return sendMessage(senderId, {
      text: `**${getLanguageName(session.detectedLang)} → ${getLanguageName(quickReply)}**\n${translation}`
    }, pageAccessToken);
  }

  const detectedLang = detectLanguageLocally(messageText);
  userSessions.set(senderId, {
    originalText: messageText,
    detectedLang: detectedLang
  });

  const languageName = getLanguageName(detectedLang);

  await sendMessage(senderId, {
    text: `Langue détectée : ${languageName}. Choisis une langue pour la traduction :`,
    quick_replies: quickReplies.map(q => ({
      content_type: 'text',
      title: q.title,
      payload: q.payload
    }))
  }, pageAccessToken);
}

module.exports = { handleMessage };
