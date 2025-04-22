const axios = require('axios');
const { sendMessage } = require('./sendMessage');

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

async function detectAndStoreLanguage(text, senderId) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=fr|en`; // peu importe les langues ici
  try {
    const response = await axios.get(url);
    const match = response.data.matches?.[0]?.segment;
    const langPair = response.data.matches?.[0]?.source || 'fr-FR';
    const sourceLang = langPair.slice(0, 2).toUpperCase();

    const session = userSessions.get(senderId) || {};
    session.originalText = text;
    session.detectedLang = sourceLang;
    userSessions.set(senderId, session);

    return sourceLang;
  } catch (error) {
    console.error('Erreur détection langue :', error);
    return 'FR'; // fallback
  }
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
    const session = userSessions.get(senderId);
    if (!session || !session.originalText || !session.detectedLang) {
      return sendMessage(senderId, { text: "Impossible de retrouver le message original." }, pageAccessToken);
    }

    const translated = await translateText(session.originalText, session.detectedLang, quickReply);
    return sendMessage(senderId, {
      text: `**${session.detectedLang} → ${quickReply}**\n${translated}`
    }, pageAccessToken);
  }

  const detectedLang = await detectAndStoreLanguage(messageText, senderId);

  const quickReplyPayload = {
    text: `Langue détectée : ${detectedLang}. Choisis la langue de traduction :`,
    quick_replies: quickReplies.map(q => ({
      content_type: 'text',
      title: q.title,
      payload: q.payload
    }))
  };

  await sendMessage(senderId, quickReplyPayload, pageAccessToken);
}

module.exports = { handleMessage };
