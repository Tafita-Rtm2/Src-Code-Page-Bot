const { sendMessage } = require('./sendMessage');

const handlePostback = async (event, pageAccessToken) => {
  const { id: senderId } = event.sender || {};
  const { payload } = event.postback || {};

  if (!senderId || !name) return console.error('Invalid postback event object');

  try {
    await sendMessage(senderId, { text: `"🎉 Bienvenue sur "Bot Traduction Rtm" ! 🤖 Je suis ravi de vous aider à traduire votre texte, votre phrase ou votre mot dans la langue de votre choix 🔍

Pour commencer, n'hésitez pas à saisir le texte, la phrase ou le mot que vous souhaitez que je traduise et je ferai de mon mieux pour vous aider 📝

Tapez, et commençons à traduire ! 💬"
: ${name}` }, pageAccessToken);
  } catch (err) {
    console.error('Error sending postback response:', err.message || err);
  }
};

module.exports = { handlePostback };
