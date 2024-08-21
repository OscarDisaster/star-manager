import { Bot, Context, SessionFlavor, Keyboard, InlineKeyboard, session } from "grammy";
import * as dotenv from "dotenv";
import { getStarCount, updateStarCount, createStarRequest, userExists, updateStarRequestStatus, addStarsToUser, getLatestPendingRequest } from "./dbOperations"; // Import the functions
import { processVoiceMessage, convertTranscriptionToStarRequest } from "./groqTranscription"; // Import the functions
import { getMainMenu, getViewStarsMenu } from "./menus/mainMenu"; // Import the menu function
import { SessionData, StarRequest, RequestStatus } from './types/types';
import { getApprovalKeyboard } from "./keyboards/actionKeyboards";

// Load environment variables from .env file
dotenv.config();

// Ensure the TELEGRAM_BOT_TOKEN is available
if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN is not defined in the .env file");
}

// Ensure Supabase URL and Key are available
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  throw new Error("SUPABASE_URL or SUPABASE_KEY is not defined in the .env file");
}

// Ensure Groq API Key is available
if (!process.env.GROQ_API_KEY) {
  throw new Error("GROQ_API_KEY is not defined in the .env file");
}

// Ensure the USER_ADMIN is available
if (!process.env.USER_ADMIN) {
  throw new Error("USER_ADMIN is not defined in the .env file");
}

const USER_ADMIN = process.env.USER_ADMIN;

type MyContext = Context & SessionFlavor<SessionData>;

// Use the bot token from the .env file
const bot = new Bot<MyContext>(process.env.TELEGRAM_BOT_TOKEN!);

// Configure session middleware
function initial(): SessionData {
  return {};
}
bot.use(session({ initial }));

const CACHE_EXPIRY = 60 * 60 * 1000; // 1 hour in milliseconds

// Function to check user access using session
async function checkUserAccess(ctx: MyContext): Promise<boolean> {
  const now = Date.now();
  if (ctx.session.accessVerified && ctx.session.accessVerifiedAt && 
      (now - ctx.session.accessVerifiedAt < CACHE_EXPIRY)) {
    return ctx.session.accessVerified;
  }

  const hasAccess = await userExists(ctx.from!.id.toString());
  ctx.session.accessVerified = hasAccess;
  ctx.session.accessVerifiedAt = now;

  return hasAccess;
}

// Middleware to verify access
bot.use(async (ctx, next) => {
  if (!ctx.from) {
    await ctx.reply("No se pudo identificar al usuario.");
    return;
  }

  try {
    const hasAccess = await checkUserAccess(ctx);
    if (!hasAccess) {
      await ctx.reply("Lo siento, no tienes acceso a este bot.");
      return;
    }
  } catch (error) {
    console.error("Error al verificar el acceso del usuario:", error);
    await ctx.reply("Ocurrió un error al verificar tu acceso. Por favor, intenta más tarde.");
    return;
  }

  // If the user has access, continue with the next middleware or handler
  await next();
});

bot.command("start", async (ctx) => {
  const mainMenu = getMainMenu(ctx.from!.id.toString());
  await ctx.reply("Bienvenido al bot de estrellas!", {
    reply_markup: { keyboard: mainMenu.build() }
  });
});

bot.on("message:text", async (ctx) => {
  const text = ctx.message.text;

  if (text === "🙏 Pedir estrellas 🙏") {
    ctx.session.commandState = { command: "menuAskStars", data: "cuantasEstrellas" };
    ctx.session.starRequest = { numEstrellas: 0, motivo: '', telegramID: ctx.from.id, status: 'pending' };
    await ctx.reply("¿Cuántas estrellas?", { reply_markup: { remove_keyboard: true } });
  } else if (ctx.session.commandState?.command === "menuAskStars") {
    switch (ctx.session.commandState.data) {
      case "cuantasEstrellas":
        const numEstrellas = parseInt(text, 10);
        if (isNaN(numEstrellas)) {
          await ctx.reply("Por favor, introduce un número válido.");
          return;
        }
        ctx.session.starRequest!.numEstrellas = numEstrellas;
        ctx.session.commandState.data = "motivo";
        await ctx.reply("¿Cuál es el motivo?");
        break;
      case "motivo":
        ctx.session.starRequest!.motivo = text;
        ctx.session.commandState.data = "resumen";
        const inlineKeyboard = new InlineKeyboard()
          .text("Editar", "edit_request")
          .text("OK", "confirm_request")
          .text("Cancelar", "cancel_request");
        await ctx.reply(
          `Resumen de tu solicitud:\nEstrellas: ${ctx.session.starRequest!.numEstrellas}\nMotivo: ${ctx.session.starRequest!.motivo}`,
          { reply_markup: inlineKeyboard }
        );
        break;
    }
  } else if (text === "⭐ Ver estrellas ⭐") {
    const viewStarsMenu = getViewStarsMenu();
    ctx.session.commandState = { command: "ViewStarsMenu" };
    ctx.reply("Selecciona una persona:", { reply_markup: { keyboard: viewStarsMenu.build() } });
  } else if (ctx.session.commandState?.command === "ViewStarsMenu") {
    if (text === "Oscar" || text === "Laura") {
      try {
        const starCount = await getStarCount(text);
        ctx.reply(`${text} tiene ${starCount} estrellas.`);
      } catch (error) {
        ctx.reply(`Error al obtener las estrellas: ${(error as Error).message}`);
      }
    } else if (text === "🔙 Back") {
      const mainMenu = getMainMenu(ctx.from.id.toString());
      ctx.session.commandState = { command: "MainMenu" };
      ctx.reply("Menú principal:", { reply_markup: { keyboard: mainMenu.build() } });
    }
  } else if (text === "👀 Ver peticiones 👀") {
    if (ctx.from.id.toString() !== USER_ADMIN) {
      await ctx.reply("No tienes permiso para ver las peticiones.");
      return;
    }

    try {
      const latestRequest = await getLatestPendingRequest();

      if (!latestRequest) {
        await ctx.reply("No hay peticiones pendientes en este momento.");
        return;
      }

      // Obtener el nombre de usuario o first_name del usuario que hizo la solicitud
      let username = 'Usuario desconocido';
      try {
        const user = await ctx.api.getChat(latestRequest.telegram_id);
        username = user.username || user.first_name || 'Usuario desconocido';
      } catch (error) {
        console.error('Error al obtener información del usuario:', error);
      }

      const message = `Nueva solicitud de estrellas:\nUsuario: ${username}\nID de Telegram: ${latestRequest.telegram_id}\nEstrellas: ${latestRequest.numEstrellas}\nMotivo: ${latestRequest.motivo}`;
      
      const approvalKeyboard = getApprovalKeyboard();
      await ctx.reply(message, {
        reply_markup: approvalKeyboard
      });
    } catch (error) {
      console.error('Error al obtener la última petición pendiente:', error);
      await ctx.reply("Ocurrió un error al obtener las peticiones. Por favor, intenta más tarde.");
    }
  } else {
    // Resto de tu lógica existente
  }
});

bot.on("message:voice", async (ctx) => {
  const fileId = ctx.message.voice.file_id;
  const file = await ctx.api.getFile(fileId);
  const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

  try {
    const transcriptionText = await processVoiceMessage(fileUrl, "es");
    const starRequest = await convertTranscriptionToStarRequest(transcriptionText, ctx.from.id);

    ctx.session.starRequest = starRequest;
    ctx.session.commandState = { command: "menuAskStars", data: "resumen" };

    const inlineKeyboard = new InlineKeyboard()
      .text("Editar", "edit_request")
      .text("OK", "confirm_request")
      .text("Cancelar", "cancel_request");

    await ctx.reply(
      `Transcripción: ${transcriptionText}\n\nResumen de tu solicitud:\nEstrellas: ${starRequest.numEstrellas}\nMotivo: ${starRequest.motivo}`,
      { reply_markup: inlineKeyboard }
    );
  } catch (error) {
    await ctx.reply(`Error procesando el audio: ${(error as Error).message}`);
  }
});

bot.callbackQuery("edit_request", async (ctx) => {
  ctx.session.commandState = { command: "menuAskStars", data: "cuantasEstrellas" };
  await ctx.answerCallbackQuery();
  await ctx.reply("¿Cuántas estrellas?");
});

bot.callbackQuery("confirm_request", async (ctx) => {
  if (ctx.session.starRequest) {
    const confirmedRequest: StarRequest = {
      numEstrellas: ctx.session.starRequest.numEstrellas,
      motivo: ctx.session.starRequest.motivo,
      telegramID: ctx.from.id,
      status: 'pending'
    };
    
    try {
      await createStarRequest(confirmedRequest);
      await ctx.answerCallbackQuery();
      await ctx.reply(`Solicitud confirmada y guardada. Gracias!\nEstrellas: ${confirmedRequest.numEstrellas}\nMotivo: ${confirmedRequest.motivo}`);
      
      // Enviar mensaje al administrador
      const adminMessage = `Nueva solicitud de estrellas:\nUsuario: ${ctx.from!.username || ctx.from!.first_name}\nEstrellas: ${confirmedRequest.numEstrellas}\nMotivo: ${confirmedRequest.motivo}\nID: ${ctx.from!.id}`;
      const approvalKeyboard = getApprovalKeyboard();
      await ctx.api.sendMessage(USER_ADMIN, adminMessage, {
        reply_markup: approvalKeyboard
      });
    } catch (error) {
      await ctx.answerCallbackQuery();
      await ctx.reply(`Error al guardar la solicitud: ${(error as Error).message}`);
    }
  } else {
    await ctx.answerCallbackQuery();
    await ctx.reply("Error: No se encontró la solicitud.");
  }
  
  ctx.session.commandState = { command: "MainMenu" };
  const mainMenu = getMainMenu(ctx.from.id.toString());
  await ctx.reply("Menú principal:", { reply_markup: { keyboard: mainMenu.build() } });
});

bot.callbackQuery("cancel_request", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply("Solicitud cancelada.");
  ctx.session.commandState = { command: "MainMenu" };
  const mainMenu = getMainMenu(ctx.from.id.toString());
  await ctx.reply("Menú principal:", { reply_markup: { keyboard: mainMenu.build() } });
});

bot.callbackQuery(/^action_/, async (ctx) => {
  const action = ctx.callbackQuery.data.split('_')[1];
  const messageText = ctx.callbackQuery.message?.text;
  if (!messageText) {
    await ctx.answerCallbackQuery("Error: No se pudo procesar la solicitud.");
    return;
  }

  // Extraer información de la solicitud del mensaje
  const [, username, telegramId, estrellas, motivo] = messageText.match(/Usuario: (.+)\nID de Telegram: (\d+)\nEstrellas: (\d+)\nMotivo: (.+)/) || [];
  const numEstrellas = parseInt(estrellas, 10);

  let responseText = '';
  try {
    switch (action) {
      case 'approve':
        await updateStarRequestStatus(telegramId, 'approved');
        const newStarCount = await addStarsToUser(telegramId, numEstrellas);
        responseText = `Tu solicitud ha sido aprobada:\nEstrellas solicitadas: ${numEstrellas}\nMotivo: ${motivo}\nNuevas estrellas totales: ${newStarCount}`;
        break;
      case 'cancel':
        responseText = `Tu solicitud ha sido cancelada:\nEstrellas solicitadas: ${numEstrellas}\nMotivo: ${motivo}`;
        break;
      case 'reject':
        await updateStarRequestStatus(telegramId, 'rejected');
        responseText = `Tu solicitud ha sido rechazada:\nEstrellas solicitadas: ${numEstrellas}\nMotivo: ${motivo}`;
        break;
    }

    const adminResponseText = `${action === 'approve' ? 'Aprobada' : action === 'cancel' ? 'Cancelada' : 'Rechazada'} solicitud para ${username}.`;
    await ctx.answerCallbackQuery(adminResponseText);
    await ctx.editMessageText(`${messageText}\n\nRespuesta: ${adminResponseText}`);

    // Notificar al usuario sobre la decisión del admin con toda la información
    await ctx.api.sendMessage(telegramId, responseText);
  } catch (error) {
    console.error('Error processing admin action:', error);
    await ctx.answerCallbackQuery("Error al procesar la acción. Por favor, intenta de nuevo.");
  }
});

bot.start();