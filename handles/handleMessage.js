const axios = require('axios');
const { sendMessage } = require('./sendMessage');
const translate = require('google-translate-api-x');
const googleTTS = require('google-tts-api');

const userMessages = new Map(); 
const userLastTranslations = new Map(); 
const userOriginalMessages = new Map(); // nouveau pour stocker les messages originaux pour 📜

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

// Fonction pour activer l'indicateur "typing..."
async function sendTypingIndicator(senderId, pageAccessToken) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`,
      {
        recipient: { id: senderId },
        sender_action: 'typing_on'
      }
    );
  } catch (error) {
    console.error('Erreur envoi typing indicator :', error);
  }
}

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

// Fonction pour expliquer un texte
async function explainText(text) {
  const prompt = `Explique simplement cette phrase : "${text}". Donne une explication courte et facile à comprendre.`;
  const url = `https://renzweb.onrender.com/api/gpt-4o-all?prompt=${encodeURIComponent(prompt)}&img=&uid=4`;

  try {
    const response = await axios.get(url);
    return response.data.reply.trim();
  } catch (error) {
    console.error('Erreur explication :', error);
    return "Erreur lors de l'explication.";
  }
}

async function handleMessage(event, pageAccessToken) {
  const senderId = event?.sender?.id;
  if (!senderId) return;

  const message = event.message;
  const quickReply = message?.quick_reply?.payload;
  const messageText = message?.text?.trim();

  if (!messageText) return;

  // *** NOUVEAU : si utilisateur envoie 🔊 ***
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

  // *** NOUVEAU : si utilisateur envoie 📜 ***
  if (messageText.includes('Explication📜')) {
    const lastOriginal = userOriginalMessages.get(senderId);

    if (!lastOriginal) {
      return sendMessage(senderId, { text: "Aucun message original à expliquer." }, pageAccessToken);
    }

    const explanation = await explainText(lastOriginal);

    return sendMessage(senderId, { text: `Explication :\n${explanation}` }, pageAccessToken);
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

    const prettyMessage = `\n${langFlags[sourceLang] || sourceLang} → ${langFlags[targetLang] || targetLang}\n\n"${translated}"\n\nLangue source : ${sourceLang}\nLangue cible : ${targetLang}`;

    await sendMessage(senderId, { text: prettyMessage }, pageAccessToken);

    userLastTranslations.set(senderId, translated);
    userLastTranslations.set(`${senderId}_lang`, targetLang);
    return;
  }

  // Stocker le message utilisateur pour traduction et explication
  userMessages.set(senderId, messageText);
  userOriginalMessages.set(senderId, messageText);

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
