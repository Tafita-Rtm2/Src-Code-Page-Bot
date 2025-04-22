const axios = require('axios');
const franc = require('franc');
const iso6391 = require('iso-639-1');
const { sendMessage } = require('./sendMessage');

async function handleMessage(event, pageAccessToken) {
  const senderId = event.sender && event.sender.id;
  if (!senderId) return;

  // 1) Si l’utilisateur clique sur un quick reply, on traduit directement
  if (
    event.message &&
    event.message.quick_reply &&
    event.message.quick_reply.payload
  ) {
    const [action, srcLang, tgtLang, encodedText] = event.message.quick_reply.payload.split('|');
    if (action === 'translate' && srcLang && tgtLang && encodedText) {
      const text = decodeURIComponent(encodedText);
      try {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${srcLang}|${tgtLang}`;
        const { data } = await axios.get(url);
        const translated = data.responseData?.translatedText || 'Erreur de traduction.';
        return sendMessage(
          senderId,
          { text: translated },
          pageAccessToken
        );
      } catch (err) {
        console.error('Translation API error:', err.message);
        return sendMessage(
          senderId,
          { text: 'Erreur lors de la traduction.' },
          pageAccessToken
        );
      }
    }
  }

  // 2) Sinon, on a reçu un texte « normal » : on détecte la langue et on propose des quick replies
  if (event.message && event.message.text) {
    const text = event.message.text.trim();
    // Détection ISO‑639‑3 puis conversion en ISO‑639‑1
    let lang3 = franc(text, { minLength: 3 });
    let srcLang = iso6391.getCode(lang3.toUpperCase()) || 'en';
    srcLang = srcLang.toUpperCase();

    // Langues cibles possibles
    const allLangs = ['EN', 'FR', 'ES', 'DE', 'MG'];
    const targets = allLangs.filter(l => l !== srcLang);

    // Construction des quick replies
    const quickReplies = targets.map(l => ({
      content_type: 'text',
      title: iso6391.getName(l) || l,
      payload: `translate|${srcLang}|${l}|${encodeURIComponent(text)}`
    }));

    return sendMessage(
      senderId,
      {
        text: 'Choisissez la langue de traduction :',
        quick_replies: quickReplies
      },
      pageAccessToken
    );
  }
}

module.exports = { handleMessage };
