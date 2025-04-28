const { sendMessage } = require('./sendMessage');
const axios = require('axios');

// Fonction pour récupérer le nom de l'utilisateur
async function getUserName(senderId, pageAccessToken) {
  try {
    const response = await axios.get(`https://graph.facebook.com/${senderId}?fields=first_name&access_token=${pageAccessToken}`);
    return response.data.first_name;
  } catch (error) {
    console.error("Erreur lors de la récupération du nom de l'utilisateur :", error);
    return null;
  }
}

// Fonction de gestion du postback
async function handlePostback(event, pageAccessToken) {
  const senderId = event.sender.id;
  const payload = event.postback.payload;

  // Récupérer le prénom de l'utilisateur
  const userName = await getUserName(senderId, pageAccessToken);

  // Préparer le message de bienvenue avec le prénom
  const welcomeText = userName
    ? `👋 Bienvenue ${userName}  sur "Bot Traduction Rtm ! 🤖 Je suis ravi de vous aider à traduire votre texte, votre phrase ou votre mot dans la langue de votre choix 🔍Pour commencer, n'hésitez pas à saisir le texte, la phrase ou le mot que vous souhaitez que je traduise et je ferai de mon mieux pour vous aider 📝ecrire, et commençons à traduire ! 💬" 😊`
    : `👋 Bienvenue ${userName}  sur "Bot Traduction Rtm ! 🤖 Je suis ravi de vous aider à traduire votre texte, votre phrase ou votre mot dans la langue de votre choix 🔍Pour commencer, n'hésitez pas à saisir le texte, la phrase ou le mot que vous souhaitez que je traduise et je ferai de mon mieux pour vous aider 📝ecrire, et commençons à traduire ! 💬";

  // Envoyer le message de bienvenue
  sendMessage(senderId, { text: welcomeText }, pageAccessToken);
}

module.exports = { handlePostback };
