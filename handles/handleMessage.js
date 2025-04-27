const axios = require('axios');
const { sendMessage } = require('./sendMessage');
const translate = require('google-translate-api-x');
const googleTTS = require('google-tts-api');

const userMessages = new Map();
const userLastTranslations = new Map();
const userOriginalMessages = new Map();

const quickReplies = [
  { title: 'Français 🇫🇷', payload: 'fr' },
  { title: 'Anglais 🇬🇧', payload: 'en' },
  { title: 'Allemand 🇩🇪', payload: 'de' },
  { title: 'Espagnol 🇪🇸', payload: 'es' },
  { title: 'Malgache 🇲🇬', payload: 'mg' },
  { title: 'Coréen 🇰🇷', payload: 'ko' },
  { title: 'Japonais 🇯🇵', payload: 'ja' }
];

const langFlags = {
  fr: '🇫🇷', en: '🇬🇧', de: '🇩🇪', es: '🇪🇸', mg: '🇲🇬', ko: '🇰🇷', ja: '🇯🇵'
};

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
    const reply = response.data.reply.trim().toLowerCase();

    if (/^[a-z]{2}$/.test(reply)) {
      return reply;
    } else {
      console.error("Réponse inattendue de GPT :", reply);
      return 'en';
    }
  } catch (error) {
    console.error('Erreur détection langue :', error);
    return 'en';
  }
}

async function translateText(text, sourceLang, targetLang) {
  try {
    const res = await translate(text, {
      from: sourceLang.toLowerCase(),
      to: targetLang.toLowerCase()
    });
    return res.text;
  } catch (error) {
    console.error('Erreur traduction :', error);
    return 'Erreur de traduction.';
  }
}

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

  if (messageText.includes('🔊')) {
    await sendTypingIndicator(senderId, pageAccessToken);

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

  if (messageText.includes('📜')) {
    await sendTypingIndicator(senderId, pageAccessToken);

    const lastOriginal = userOriginalMessages.get(senderId);

    if (!lastOriginal) {
      return sendMessage(senderId, { text: "Aucun message original à expliquer." }, pageAccessToken);
    }

    const explanation = await explainText(lastOriginal);

    return sendMessage(senderId, { text: `Explication 📖 :\n\n${explanation}` }, pageAccessToken);
  }

  if (quickReply) {
    await sendTypingIndicator(senderId, pageAccessToken);

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

    const prettyMessage = `${langFlags[sourceLang] || sourceLang} → ${langFlags[targetLang] || targetLang}\n\n"${translated}"\n\nLangue source : ${sourceLang.toUpperCase()}\nLangue cible : ${targetLang.toUpperCase()}`;

    await sendMessage(senderId, { text: prettyMessage }, pageAccessToken);

    userLastTranslations.set(senderId, translated);
    userLastTranslations.set(`${senderId}_lang`, targetLang);
    return;
  }

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
