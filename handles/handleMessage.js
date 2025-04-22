const axios = require('axios');
const { sendMessage } = require('./sendMessage');

const userMessages = new Map(); // pour stocker le message d'origine par user

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
  // Simple détection par Google Translate (gratuit) ou heuristique
  // Ici on fait simple, mais tu peux utiliser une vraie API ou module comme "franc"
  if (/^[a-zA-Z\s.,!?']+$/.test(text)) return 'EN';
  if (/^[a-zA-ZéèàçùâêîôûëïüœÉÈÀÇÙÂÊÎÔÛËÏÜŒ\s.,!?']+$/.test(text)) return 'FR';
  return 'FR'; // fallback
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
    const originalText = userMessages.get(senderId);
    if (!originalText) {
      return sendMessage(senderId, { text: "Message original non trouvé." }, pageAccessToken);
    }

    const sourceLang = detectLanguage(originalText);
    const targetLang = quickReply;

    const translated = await translateText(originalText, sourceLang, targetLang);
    return sendMessage(senderId, { text: `Traduction (${sourceLang} → ${targetLang}) :\n${translated}` }, pageAccessToken);
  }

  // Sinon, c'est un message texte normal → on propose les langues
  userMessages.set(senderId, messageText);

  const quickReplyPayload = {
    text: 'Dans quelle langue veux-tu traduire ce message ?',
    quick_replies: quickReplies.map(q => ({
      content_type: 'text',
      title: q.title,
      payload: q.payload
    }))
  };

  await sendMessage(senderId, quickReplyPayload, pageAccessToken);
}

module.exports = { handleMessage };
