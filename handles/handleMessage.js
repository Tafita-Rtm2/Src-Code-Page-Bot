const axios = require('axios');
const { sendMessage } = require('./sendMessage');
const translate = require('google-translate-api-x'); // ajouté
const googleTTS = require('google-tts-api'); // ajouté

const userMessages = new Map(); 
const userLastTranslations = new Map(); // nouveau pour garder la dernière traduction

const quickReplies = [
  { title: 'Français 🇫🇷', payload: 'FR' },
  { title: 'Anglais 🇬🇧', payload: 'EN' },
  { title: 'Allemand 🇩🇪', payload: 'DE' },
  { title: 'Espagnol 🇪🇸', payload: 'ES' },
  { title: 'Malgache 🇲🇬', payload: 'MG' },
  { title: 'Coréen 🇰🇷', payload: 'KO' },
  { title: 'Japonais 🇯🇵', payload: 'JA' }
];

const langFlags = {
  FR: '🇫🇷', EN: '🇬🇧', DE: '🇩🇪', ES: '🇪🇸', MG: '🇲🇬', KO: '🇰🇷', JA: '🇯🇵'
};

// Fonction pour détecter la langue via GPT
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
      return 'EN';
    }
  } catch (error) {
    console.error('Erreur détection langue :', error);
    return 'EN';
  }
}

// Fonction traduction via MyMemory (on la laisse comme chez toi)
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

  // *** NOUVEAU : Si le message est 🔊 ***
  if (messageText.includes('🔊')) {
    const lastTranslation = userLastTranslations.get(senderId);
    const lastLang = userLastTranslations.get(`${senderId}_lang`) || 'en';

    if (!lastTranslation) {
      return sendMessage(senderId, { text: "Aucune traduction récente trouvée." }, pageAccessToken);
    }

    try {
      const url = googleTTS.getAudioUrl(lastTranslation, {
        lang: lastLang.toLowerCase(),
        slow: false,
        host: 'https://translate.google.com'
      });

      const audioPayload = {
        attachment: {
          type: "audio",
          payload: {
            url: url
          }
        }
      };

      return sendMessage(senderId, audioPayload, pageAccessToken);
    } catch (error) {
      console.error('Erreur TTS :', error);
      return sendMessage(senderId, { text: "Erreur génération audio." }, pageAccessToken);
    }
  }

  if (quickReply) {
    const originalText = userMessages.get(senderId);
    if (!originalText) {
      return sendMessage(senderId, { text: "Message original non trouvé." }, pageAccessToken);
    }

    const sourceLang = await detectLanguage(originalText);
    const targetLang = quickReply;

    if (sourceLang === targetLang) {
      return sendMessage(senderId, { text: "La langue source et cible sont identiques. Choisis une langue différente." }, pageAccessToken);
    }

    const translated = await translateText(originalText, sourceLang, targetLang);

    // *** NOUVEAU affichage stylé avec drapeaux ***
    const prettyMessage = `\n${langFlags[sourceLang] || sourceLang} → ${langFlags[targetLang] || targetLang}\n\n"${translated}"\n\nLangue source : ${sourceLang}\nLangue cible : ${targetLang}`;

    await sendMessage(senderId, { text: prettyMessage }, pageAccessToken);

    // *** NOUVEAU : on garde en mémoire la dernière traduction pour 🔊 ***
    userLastTranslations.set(senderId, translated);
    userLastTranslations.set(`${senderId}_lang`, targetLang);

    return;
  }

  // Message normal
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
