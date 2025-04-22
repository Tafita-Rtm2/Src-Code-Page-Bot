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

async function detectLanguage(text) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|en`;
  try {
    const response = await axios.get(url);
    const langPair = response.data.matches?.[0]?.source || response.data.responseData?.match?.langpair || 'en-EN';
    const sourceLang = langPair.slice(0, 2).toUpperCase();
    return sourceLang;
  } catch (error) {
    console.error('Erreur détection de langue :', error);
    return 'EN'; // fallback
  }
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
      text: `**${session.detectedLang} → ${quickReply}**\n${translation}`
    }, pageAccessToken);
  }

  // Nouvel envoi utilisateur : détecter langue et proposer traductions
  const detectedLang = await detectLanguage(messageText);
  userSessions.set(senderId, {
    originalText: messageText,
    detectedLang: detectedLang
  });

  await sendMessage(senderId, {
    text: `Langue détectée : ${detectedLang}. Choisis la langue de traduction :`,
    quick_replies: quickReplies.map(q => ({
      content_type: 'text',
      title: q.title,
      payload: q.payload
    }))
  }, pageAccessToken);
}

module.exports = { handleMessage };
