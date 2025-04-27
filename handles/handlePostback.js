const { sendMessage } = require('./sendMessage');
const axios = require('axios'); // pour récupérer le prénom

const handlePostback = async (event, pageAccessToken) => {
  const { id: senderId } = event.sender || {};
  const { payload } = event.postback || {};

  if (!senderId || !payload) return console.error('Invalid postback event object');

  try {
    if (payload === 'get_started_button') { // <-- ici on met ton vrai payload
      // Appel à Facebook Graph API pour récupérer le prénom
      const response = await axios.get(`https://graph.facebook.com/${senderId}?fields=first_name&access_token=${pageAccessToken}`);
      const firstName = response.data.first_name || '';

      const welcomeMessage = `🎉 Bienvenue sur "Bot Traduction Rtm" ${firstName} ! 🤖 Je suis ravi de vous aider à traduire votre texte, votre phrase ou votre mot dans la langue de votre choix 🔍

Pour commencer, n'hésitez pas à saisir le texte, la phrase ou le mot que vous souhaitez que je traduise et je ferai de mon mieux pour vous aider 📝

Tapez, et commençons à traduire ! 💬`;

      await sendMessage(senderId, { text: welcomeMessage }, pageAccessToken);
    } else {
      // pour les autres postbacks normaux
      await sendMessage(senderId, { text: `Vous avez envoyé un postback avec le payload : ${payload}` }, pageAccessToken);
    }
  } catch (err) {
    console.error('Erreur lors de l\'envoi de la réponse au postback:', err.message || err);
  }
};

module.exports = { handlePostback };
