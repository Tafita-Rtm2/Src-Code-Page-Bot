const axios = require('axios');
const { sendMessage } = require('./sendMessage');
const franc = require('franc'); // <= installe cette librairie

const userMessages = new Map();

const quickReplies = [
  { title: 'Français 🇫🇷', payload: 'FR' },
  { title: 'Anglais 🇬🇧', payload: 'EN' },
  { title: 'Allemand 🇩🇪', payload: 'DE' },
  { title: 'Espagnol 🇪🇸', payload: 'ES' },
  { title: 'Malgache 🇲🇬', payload: 'MG' },
  { title: 'Coréen 🇰🇷', payload: 'KO' },
  { title: 'Japonais 🇯🇵', payload: 'JA' }
];

function mapFrancToLang(francLang) {
  // Mapping de franc ISO 639-3 vers ISO 639-1
  const map = {
    fra: 'FR',
    eng: 'EN',
    deu: 'DE',
    spa: 'ES',
    mal: 'MG',
    kor: 'KO',
    jpn: 'JA'
  };
  return map[francLang] || 'EN'; // Default English
}

function detectLanguage(text) {
  const langFranc = franc(text || '');
  return mapFrancToLang(langFranc);
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
    const userData = userMessages.get(senderId);
    if (!userData) {
      return sendMessage(senderId, { text: "Message original non trouvé." }, pageAccessToken);
    }

    const { originalText, sourceLang } = userData;
    const targetLang = quickReply;

    if (sourceLang.toUpperCase() === targetLang.toUpperCase()) {
      await sendMessage(senderId, { text: `Pas besoin de traduire : c'est déjà en ${targetLang}. Voici ton message :\n\n${originalText}` }, pageAccessToken);
      return;
    }

    const translated = await translateText(originalText, sourceLang, targetLang);
    return sendMessage(senderId, { text: `Traduction (${sourceLang} → ${targetLang}) :\n${translated}` }, pageAccessToken);
  }

  const sourceLang = detectLanguage(messageText);
  userMessages.set(senderId, { originalText: messageText, sourceLang });

  const quickReplyPayload = {
    text: `Message détecté en ${sourceLang}. Dans quelle langue veux-tu traduire ce message ?`,
    quick_replies: quickReplies.map(q => ({
      content_type: 'text',
      title: q.title,
      payload: q.payload
    }))
  };

  await sendMessage(senderId, quickReplyPayload, pageAccessToken);
}

module.exports = { handleMessage };
