const axios = require('axios');
const { sendMessage } = require('./sendMessage');
const franc = require('franc');
const langs = require('langs');

const userMessages = new Map(); // stocke { original text, detected language }

const quickReplies = [
  { title: 'Français 🇫🇷', payload: 'FR' },
  { title: 'Anglais 🇬🇧', payload: 'EN' },
  { title: 'Allemand 🇩🇪', payload: 'DE' },
  { title: 'Espagnol 🇪🇸', payload: 'ES' },
  { title: 'Malgache 🇲🇬', payload: 'MG' },
  { title: 'Coréen 🇰🇷', payload: 'KO' },
  { title: 'Japonais 🇯🇵', payload: 'JA' }
];

// Détecte automatiquement n'importe quelle langue
function detectLanguage(text) {
  const langCode = franc(text);

  if (langCode === 'und') {
    return 'EN'; // fallback si pas détecté
  }

  const language = langs.where('3', langCode);
  if (!language) {
    return 'EN'; // fallback si inconnu
  }

  // Retourne ISO-639-1 code (2 lettres) si dispo, sinon 3 lettres
  return language['1'] || langCode;
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

    const translated = await translateText(originalText, sourceLang, targetLang);
    return sendMessage(senderId, { text: `Traduction (${sourceLang} → ${targetLang}) :\n${translated}` }, pageAccessToken);
  }

  // Sinon, on reçoit un nouveau message texte normal
  const detectedLang = detectLanguage(messageText);

  userMessages.set(senderId, { originalText: messageText, sourceLang: detectedLang });

  const quickReplyPayload = {
    text: `Message détecté en [${detectedLang}]. Vers quelle langue veux-tu traduire ?`,
    quick_replies: quickReplies.map(q => ({
      content_type: 'text',
      title: q.title,
      payload: q.payload
    }))
  };

  await sendMessage(senderId, quickReplyPayload, pageAccessToken);
}

module.exports = { handleMessage };
