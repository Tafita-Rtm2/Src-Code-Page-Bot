const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { sendMessage } = require('./sendMessage');

const commands = new Map();
const userStates = new Map(); // Suivi des états des utilisateurs
const userConversations = new Map(); // Historique des conversations des utilisateurs
const userSubscriptions = new Map(); // Gestion des abonnements utilisateurs
const validCodes = ["8280", "4321", "1235", "2007", "2006", "1214", "1215"]; // Codes d'abonnement valides
const subscriptionDuration = 30 * 24 * 60 * 60 * 1000; // Durée de l'abonnement : 30 jours en millisecondes

// Charger les commandes
const commandFiles = fs.readdirSync(path.join(__dirname, '../commands')).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`../commands/${file}`);
  commands.set(command.name, command);
}

// Fonction principale pour gérer les messages entrants
async function handleMessage(event, pageAccessToken) {
  const senderId = event.sender.id;

  // Ajouter le message reçu à l'historique de l'utilisateur
  if (!userConversations.has(senderId)) {
    userConversations.set(senderId, []);
  }
  userConversations.get(senderId).push({ type: 'user', text: event.message.text || 'Image' });

  // Vérifier si l'utilisateur est abonné
  const isSubscribed = checkSubscription(senderId);

  if (!isSubscribed) {
    await handleSubscriptionFlow(senderId, event.message.text, pageAccessToken);
    return;
  }

  if (event.message.attachments && event.message.attachments[0].type === 'image') {
    const imageUrl = event.message.attachments[0].payload.url;
    await askForImagePrompt(senderId, imageUrl, pageAccessToken);
  } else if (event.message.text) {
    const messageText = event.message.text.trim();

    // Commande "stop" pour quitter le mode actuel
    if (messageText.toLowerCase() === 'stop') {
      userStates.delete(senderId);
      await sendMessage(senderId, { text: "🔓 Vous avez quitté le mode actuel. Tapez le bouton 'menu' pour continuer ✔." }, pageAccessToken);
      return;
    }

    // Si l'utilisateur attend une analyse d'image et entre une commande
    if (userStates.has(senderId) && userStates.get(senderId).awaitingImagePrompt) {
      const args = messageText.split(' ');
      const commandName = args[0].toLowerCase();
      const command = commands.get(commandName);

      if (command) {
        userStates.delete(senderId); // Quitter le mode image
        await sendMessage(senderId, { text: `` }, pageAccessToken);
        return await command.execute(senderId, args.slice(1), pageAccessToken, sendMessage);
      }

      const { imageUrl } = userStates.get(senderId);
      await analyzeImageWithPrompt(senderId, imageUrl, messageText, pageAccessToken);
      return;
    }

    // Traitement des commandes
    const args = messageText.split(' ');
    const commandName = args[0].toLowerCase();
    const command = commands.get(commandName);

    if (command) {
      if (userStates.has(senderId) && userStates.get(senderId).lockedCommand) {
        const previousCommand = userStates.get(senderId).lockedCommand;
        if (previousCommand !== commandName) {
          // Ligne supprimée ici pour éviter l'affichage
        }
      } else {
        await sendMessage(senderId, { text: `` }, pageAccessToken);
      }
      userStates.set(senderId, { lockedCommand: commandName });
      return await command.execute(senderId, args.slice(1), pageAccessToken, sendMessage);
    }

    // Si une commande est verrouillée, utiliser la commande verrouillée pour traiter la demande
    if (userStates.has(senderId) && userStates.get(senderId).lockedCommand) {
      const lockedCommand = userStates.get(senderId).lockedCommand;
      const lockedCommandInstance = commands.get(lockedCommand);
      if (lockedCommandInstance) {
        return await lockedCommandInstance.execute(senderId, args, pageAccessToken, sendMessage);
      }
    } else {
      await sendMessage(senderId, { text: "miarahaba mba ahafahana mampiasa dia. tapez le bouton 'menu' pour continuer ." }, pageAccessToken);
    }
  }
}

// Fonction pour gérer le flux d'abonnement
async function handleSubscriptionFlow(senderId, messageText, pageAccessToken) {
  // Si l'utilisateur envoie un code d'abonnement
  if (validCodes.includes(messageText)) {
    const expirationDate = Date.now() + subscriptionDuration;
    userSubscriptions.set(senderId, expirationDate);
    console.log(`Abonnement activé pour l'utilisateur ${senderId}. Valide jusqu'au : ${new Date(expirationDate).toLocaleString()}`);
    await sendMessage(senderId, {
      text: `Félicitations ! 🎉🎊 Votre abonnement de 30 jours est activé avec succès ! 🚀✅ Vous pouvez utiliser toutes les fonctionnalités disponibles 24h/24, 7j/7, sans arrêt et sans limite. 🌈🔓\n\nMerci de choisir notre chat, on vous donne toujours le meilleur ! 🤩👌\nVeuillez taper le bouton menu pour commencer à utiliser et voir les options disponibles. 🖱️📋.`
    }, pageAccessToken);
    return;
  }

  // Si l'utilisateur envoie un message qui n'est pas un code valide
  await sendMessage(senderId, {
    text: ` Bonjour chers utilisateurs de la page Chatbot Facebook Messenger de Malagasy Bot Traduction ! 👋🤖🇲🇬 \nPour utiliser mes services, vous devez d'abord fournir un code de validation pour activer le bot. 🔐🔑 \n\nSi vous l'avez déjà, veuillez le fournir. 📝✅ \n\nSi vous ne l'avez pas encore, veuillez faire un abonnement chez l'admin. 📞\n\nContacts :  Facebook : RTM Tafitaniaina (https://www.facebook.com/manarintso.niaina) \n👤🌐 WhatsApp : +261 38 58 58 330 📱 Numéro : 0336177772 ☎️\n\nLes paiements disponibles sont via Mvola et Airtel Money. 💸💳\n\nUn code de validation est valide pendant 30 jours. ⏳📆\n\nL'abonnement pour utiliser tous les services pendant 30 jours coûte 3000 Ar la version texte uniquement et 5000 ar la version texte capable de voir des image ca ve dire repondre et analyser des image. 💯💰.`
  }, pageAccessToken);
}

// Demander le prompt de l'utilisateur pour analyser l'image
async function askForImagePrompt(senderId, imageUrl, pageAccessToken) {
  userStates.set(senderId, { awaitingImagePrompt: true, imageUrl: imageUrl });
  await sendMessage(senderId, { text: "📷 Image reçue. Que voulez-vous que je fasse avec cette image ? Posez toutes vos questions !ou vous voulez que je l'edite et tou ce que vous voulez 📸😊." }, pageAccessToken);
}

// Fonction pour analyser l'image avec le prompt fourni par l'utilisateur
async function analyzeImageWithPrompt(senderId, imageUrl, prompt, pageAccessToken) {
  try {
    await sendMessage(senderId, { text: "🔍 Je traite votre requête concernant l'image. Patientez un instant... 🤔⏳" }, pageAccessToken);

    let imageAnalysis;
    const lockedCommand = userStates.get(senderId)?.lockedCommand;

    if (lockedCommand && commands.has(lockedCommand)) {
      const lockedCommandInstance = commands.get(lockedCommand);
      if (lockedCommandInstance && lockedCommandInstance.analyzeImage) {
        imageAnalysis = await lockedCommandInstance.analyzeImage(imageUrl, prompt);
      }
    } else {
      imageAnalysis = await analyzeImageWithGemini(imageUrl, prompt);
    }

    if (imageAnalysis) {
      const formattedResponse = `📄 Voici la réponse à votre question concernant l'image :\n${imageAnalysis}`;
      const maxMessageLength = 2000;

      if (formattedResponse.length > maxMessageLength) {
        const messages = splitMessageIntoChunks(formattedResponse, maxMessageLength);
        for (const message of messages) {
          await sendMessage(senderId, { text: message }, pageAccessToken);
        }
      } else {
        await sendMessage(senderId, { text: formattedResponse }, pageAccessToken);
      }
    } else {
      await sendMessage(senderId, { text: "❌ Aucune information exploitable n'a été détectée dans cette image." }, pageAccessToken);
    }

    userStates.set(senderId, { awaitingImagePrompt: true, imageUrl: imageUrl });
  } catch (error) {
    console.error('Erreur lors de l\'analyse de l\'image :', error);
    await sendMessage(senderId, { text: "⚠️ Une erreur est survenue lors de l'analyse de l'image." }, pageAccessToken);
  }
}

// Fonction qui utilise l’API GPT-4O PRO
async function analyzeImageWithGemini(imageUrl, prompt) {
  const apiUrl = 'https://kaiz-apis.gleeze.com/api/gpt-4o-pro';

  try {
    const response = await axios.get(apiUrl, {
      params: {
        ask: prompt,
        uid: 4,
        imageUrl: imageUrl
      }
    });

    const data = response.data;

    return {
      text: data.response || null,
      images: data.images || []
    };

  } catch (error) {
    console.error('Erreur avec GPT-4O API :', error);
    throw new Error("Erreur lors de l'analyse avec GPT-4O API");
  }
}

// Fonction pour envoyer une image brute téléchargée (upload réel)
async function sendImageFromUrl(senderId, imageUrl, pageAccessToken) {
  try {
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(imageResponse.data, 'binary');

    const form = new FormData();
    form.append('recipient', JSON.stringify({ id: senderId }));
    form.append('message', JSON.stringify({ attachment: { type: 'image', payload: {} } }));
    form.append('filedata', imageBuffer, {
      filename: 'image.jpg',
      contentType: 'image/jpeg'
    });

    await axios.post(`https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`, form, {
      headers: form.getHeaders()
    });

  } catch (err) {
    console.error('Erreur lors de l’envoi d’image brute :', err);
  }
}

// Fonction pour découper un texte long en morceaux de 2000 caractères
function splitMessageIntoChunks(text, chunkSize = 2000) {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

// Fonction principale qui gère texte + image
async function analyzeImageWithPrompt(senderId, imageUrl, prompt, pageAccessToken) {
  try {
    await sendMessage(senderId, { text: "⏳ Traitement de votre image en cours..." }, pageAccessToken);

    const analysisResult = await analyzeImageWithGemini(imageUrl, prompt);

    // S'il y a des images, on ignore le texte
    if (analysisResult.images.length > 0) {
      for (const img of analysisResult.images) {
        await sendImageFromUrl(senderId, img, pageAccessToken);
      }
      await sendMessage(senderId, { text: "✅ Image bien créée et envoyée avec succès !" }, pageAccessToken);
    } else if (analysisResult.text && analysisResult.text !== "Failed to parse the response.") {
      // Sinon on envoie uniquement le texte s’il n’y a pas d’image
      const responseText = `📄 Voici la réponse :\n${analysisResult.text}`;
      const chunks = splitMessageIntoChunks(responseText, 2000);
      for (const chunk of chunks) {
        await sendMessage(senderId, { text: chunk }, pageAccessToken);
      }
    } else {
      await sendMessage(senderId, {
        text: "❌ Aucun contenu utile trouvé dans la réponse de l'API."
      }, pageAccessToken);
    }

  } catch (error) {
    console.error("Erreur d'analyse d'image :", error);
    await sendMessage(senderId, {
      text: "❌ Une erreur est survenue pendant l'analyse de l'image."
    }, pageAccessToken);
  }
}

// Fonction utilitaire pour découper un message en morceaux
function splitMessageIntoChunks(message, chunkSize) {
  const chunks = [];
  for (let i = 0; i < message.length; i += chunkSize) {
    chunks.push(message.slice(i, i + chunkSize));
  }
  return chunks;
}

// Fonction pour vérifier l'abonnement de l'utilisateur
function checkSubscription(senderId) {
  const expirationDate = userSubscriptions.get(senderId);
  if (!expirationDate) return false; // Pas d'abonnement
  if (Date.now() < expirationDate) return true; // Abonnement encore valide
  userSubscriptions.delete(senderId); // Supprimer l'abonnement expiré
  return false;
}

module.exports = { handleMessage };
