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

// Nouvelle fonction detectLanguage via GPT
async function detectLanguage(text) {
  const prompt = `Detect only the language code (2 letters) of this text without translating: "${text}". Reply only with the language code like EN, FR, ES, MG, etc.`;
  const url = `https://renzweb.onrender.com/api/gpt-4o-all?prompt=${encodeURIComponent(prompt)}&img=&uid=4`;

  try {
    const response = await axios.get(url);
    const reply = response.data.reply.trim().toUpperCase();

    if (/^[A-Z]{2}$/.test(reply)) {
      return reply;
    } else {
      console.error("Réponse inattendue de GPT :", reply);
      return 'EN'; // par défaut si réponse étrange
    }
  } catch (error) {
    console.error('Erreur détection langue :', error);
    return 'EN'; // par défaut si erreur
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
    const originalText = userMessages.get(senderId);
    if (!originalText) {
      return sendMessage(senderId, { text: "Message original non trouvé." }, pageAccessToken);
    }

    const sourceLang = await detectLanguage(originalText); // Modifié ici aussi → await
    const targetLang = quickReply;

    if (sourceLang === targetLang) {
      return sendMessage(senderId, { text: "La langue source et cible sont identiques. Choisis une langue différente." }, pageAccessToken);
    }

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
