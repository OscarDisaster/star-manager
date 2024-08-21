"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const grammy_1 = require("grammy");
const dotenv = __importStar(require("dotenv"));
const dbOperations_1 = require("./dbOperations"); // Import the functions
const groqTranscription_1 = require("./groqTranscription"); // Import the functions
const mainMenu_1 = require("./menus/mainMenu"); // Import the menu function
const actionKeyboards_1 = require("./keyboards/actionKeyboards");
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
// Use the bot token from the .env file
const bot = new grammy_1.Bot(process.env.TELEGRAM_BOT_TOKEN);
// Configure session middleware
function initial() {
    return {};
}
bot.use((0, grammy_1.session)({ initial }));
const CACHE_EXPIRY = 60 * 60 * 1000; // 1 hour in milliseconds
// Function to check user access using session
function checkUserAccess(ctx) {
    return __awaiter(this, void 0, void 0, function* () {
        const now = Date.now();
        if (ctx.session.accessVerified && ctx.session.accessVerifiedAt &&
            (now - ctx.session.accessVerifiedAt < CACHE_EXPIRY)) {
            return ctx.session.accessVerified;
        }
        const hasAccess = yield (0, dbOperations_1.userExists)(ctx.from.id.toString());
        ctx.session.accessVerified = hasAccess;
        ctx.session.accessVerifiedAt = now;
        return hasAccess;
    });
}
// Middleware to verify access
bot.use((ctx, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (!ctx.from) {
        yield ctx.reply("No se pudo identificar al usuario.");
        return;
    }
    try {
        const hasAccess = yield checkUserAccess(ctx);
        if (!hasAccess) {
            yield ctx.reply("Lo siento, no tienes acceso a este bot.");
            return;
        }
    }
    catch (error) {
        console.error("Error al verificar el acceso del usuario:", error);
        yield ctx.reply("Ocurrió un error al verificar tu acceso. Por favor, intenta más tarde.");
        return;
    }
    // If the user has access, continue with the next middleware or handler
    yield next();
}));
bot.command("start", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    const mainMenu = (0, mainMenu_1.getMainMenu)(ctx.from.id.toString());
    yield ctx.reply("Bienvenido al bot de estrellas!", {
        reply_markup: { keyboard: mainMenu.build() }
    });
}));
bot.on("message:text", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const text = ctx.message.text;
    if (text === "🙏 Pedir estrellas 🙏") {
        ctx.session.commandState = { command: "menuAskStars", data: "cuantasEstrellas" };
        ctx.session.starRequest = { numEstrellas: 0, motivo: '', telegramID: ctx.from.id, status: 'pending' };
        yield ctx.reply("¿Cuántas estrellas?", { reply_markup: { remove_keyboard: true } });
    }
    else if (((_a = ctx.session.commandState) === null || _a === void 0 ? void 0 : _a.command) === "menuAskStars") {
        switch (ctx.session.commandState.data) {
            case "cuantasEstrellas":
                const numEstrellas = parseInt(text, 10);
                if (isNaN(numEstrellas)) {
                    yield ctx.reply("Por favor, introduce un número válido.");
                    return;
                }
                ctx.session.starRequest.numEstrellas = numEstrellas;
                ctx.session.commandState.data = "motivo";
                yield ctx.reply("¿Cuál es el motivo?");
                break;
            case "motivo":
                ctx.session.starRequest.motivo = text;
                ctx.session.commandState.data = "resumen";
                const inlineKeyboard = new grammy_1.InlineKeyboard()
                    .text("Editar", "edit_request")
                    .text("OK", "confirm_request")
                    .text("Cancelar", "cancel_request");
                yield ctx.reply(`Resumen de tu solicitud:\nEstrellas: ${ctx.session.starRequest.numEstrellas}\nMotivo: ${ctx.session.starRequest.motivo}`, { reply_markup: inlineKeyboard });
                break;
        }
    }
    else if (text === "⭐ Ver estrellas ⭐") {
        const viewStarsMenu = (0, mainMenu_1.getViewStarsMenu)();
        ctx.session.commandState = { command: "ViewStarsMenu" };
        ctx.reply("Selecciona una persona:", { reply_markup: { keyboard: viewStarsMenu.build() } });
    }
    else if (((_b = ctx.session.commandState) === null || _b === void 0 ? void 0 : _b.command) === "ViewStarsMenu") {
        if (text === "Oscar" || text === "Laura") {
            try {
                const starCount = yield (0, dbOperations_1.getStarCount)(text);
                ctx.reply(`${text} tiene ${starCount} estrellas.`);
            }
            catch (error) {
                ctx.reply(`Error al obtener las estrellas: ${error.message}`);
            }
        }
        else if (text === "🔙 Back") {
            const mainMenu = (0, mainMenu_1.getMainMenu)(ctx.from.id.toString());
            ctx.session.commandState = { command: "MainMenu" };
            ctx.reply("Menú principal:", { reply_markup: { keyboard: mainMenu.build() } });
        }
    }
    else if (text === "👀 Ver peticiones 👀") {
        if (ctx.from.id.toString() !== USER_ADMIN) {
            yield ctx.reply("No tienes permiso para ver las peticiones.");
            return;
        }
        try {
            const latestRequest = yield (0, dbOperations_1.getLatestPendingRequest)();
            if (!latestRequest) {
                yield ctx.reply("No hay peticiones pendientes en este momento.");
                return;
            }
            // Obtener el nombre de usuario o first_name del usuario que hizo la solicitud
            let username = 'Usuario desconocido';
            try {
                const user = yield ctx.api.getChat(latestRequest.telegram_id);
                username = user.username || user.first_name || 'Usuario desconocido';
            }
            catch (error) {
                console.error('Error al obtener información del usuario:', error);
            }
            const message = `Nueva solicitud de estrellas:\nUsuario: ${username}\nID de Telegram: ${latestRequest.telegram_id}\nEstrellas: ${latestRequest.numEstrellas}\nMotivo: ${latestRequest.motivo}`;
            const approvalKeyboard = (0, actionKeyboards_1.getApprovalKeyboard)();
            yield ctx.reply(message, {
                reply_markup: approvalKeyboard
            });
        }
        catch (error) {
            console.error('Error al obtener la última petición pendiente:', error);
            yield ctx.reply("Ocurrió un error al obtener las peticiones. Por favor, intenta más tarde.");
        }
    }
    else {
        // Resto de tu lógica existente
    }
}));
bot.on("message:voice", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    const fileId = ctx.message.voice.file_id;
    const file = yield ctx.api.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
    try {
        const transcriptionText = yield (0, groqTranscription_1.processVoiceMessage)(fileUrl, "es");
        const starRequest = yield (0, groqTranscription_1.convertTranscriptionToStarRequest)(transcriptionText, ctx.from.id);
        ctx.session.starRequest = starRequest;
        ctx.session.commandState = { command: "menuAskStars", data: "resumen" };
        const inlineKeyboard = new grammy_1.InlineKeyboard()
            .text("Editar", "edit_request")
            .text("OK", "confirm_request")
            .text("Cancelar", "cancel_request");
        yield ctx.reply(`Transcripción: ${transcriptionText}\n\nResumen de tu solicitud:\nEstrellas: ${starRequest.numEstrellas}\nMotivo: ${starRequest.motivo}`, { reply_markup: inlineKeyboard });
    }
    catch (error) {
        yield ctx.reply(`Error procesando el audio: ${error.message}`);
    }
}));
bot.callbackQuery("edit_request", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    ctx.session.commandState = { command: "menuAskStars", data: "cuantasEstrellas" };
    yield ctx.answerCallbackQuery();
    yield ctx.reply("¿Cuántas estrellas?");
}));
bot.callbackQuery("confirm_request", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    if (ctx.session.starRequest) {
        const confirmedRequest = {
            numEstrellas: ctx.session.starRequest.numEstrellas,
            motivo: ctx.session.starRequest.motivo,
            telegramID: ctx.from.id,
            status: 'pending'
        };
        try {
            yield (0, dbOperations_1.createStarRequest)(confirmedRequest);
            yield ctx.answerCallbackQuery();
            yield ctx.reply(`Solicitud confirmada y guardada. Gracias!\nEstrellas: ${confirmedRequest.numEstrellas}\nMotivo: ${confirmedRequest.motivo}`);
            // Enviar mensaje al administrador
            const adminMessage = `Nueva solicitud de estrellas:\nUsuario: ${ctx.from.username || ctx.from.first_name}\nEstrellas: ${confirmedRequest.numEstrellas}\nMotivo: ${confirmedRequest.motivo}\nID: ${ctx.from.id}`;
            const approvalKeyboard = (0, actionKeyboards_1.getApprovalKeyboard)();
            yield ctx.api.sendMessage(USER_ADMIN, adminMessage, {
                reply_markup: approvalKeyboard
            });
        }
        catch (error) {
            yield ctx.answerCallbackQuery();
            yield ctx.reply(`Error al guardar la solicitud: ${error.message}`);
        }
    }
    else {
        yield ctx.answerCallbackQuery();
        yield ctx.reply("Error: No se encontró la solicitud.");
    }
    ctx.session.commandState = { command: "MainMenu" };
    const mainMenu = (0, mainMenu_1.getMainMenu)(ctx.from.id.toString());
    yield ctx.reply("Menú principal:", { reply_markup: { keyboard: mainMenu.build() } });
}));
bot.callbackQuery("cancel_request", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    yield ctx.answerCallbackQuery();
    yield ctx.reply("Solicitud cancelada.");
    ctx.session.commandState = { command: "MainMenu" };
    const mainMenu = (0, mainMenu_1.getMainMenu)(ctx.from.id.toString());
    yield ctx.reply("Menú principal:", { reply_markup: { keyboard: mainMenu.build() } });
}));
bot.callbackQuery(/^action_/, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const action = ctx.callbackQuery.data.split('_')[1];
    const messageText = (_a = ctx.callbackQuery.message) === null || _a === void 0 ? void 0 : _a.text;
    if (!messageText) {
        yield ctx.answerCallbackQuery("Error: No se pudo procesar la solicitud.");
        return;
    }
    // Extraer información de la solicitud del mensaje
    const [, username, telegramId, estrellas, motivo] = messageText.match(/Usuario: (.+)\nID de Telegram: (\d+)\nEstrellas: (\d+)\nMotivo: (.+)/) || [];
    const numEstrellas = parseInt(estrellas, 10);
    let responseText = '';
    try {
        switch (action) {
            case 'approve':
                yield (0, dbOperations_1.updateStarRequestStatus)(telegramId, 'approved');
                const newStarCount = yield (0, dbOperations_1.addStarsToUser)(telegramId, numEstrellas);
                responseText = `Tu solicitud ha sido aprobada:\nEstrellas solicitadas: ${numEstrellas}\nMotivo: ${motivo}\nNuevas estrellas totales: ${newStarCount}`;
                break;
            case 'cancel':
                responseText = `Tu solicitud ha sido cancelada:\nEstrellas solicitadas: ${numEstrellas}\nMotivo: ${motivo}`;
                break;
            case 'reject':
                yield (0, dbOperations_1.updateStarRequestStatus)(telegramId, 'rejected');
                responseText = `Tu solicitud ha sido rechazada:\nEstrellas solicitadas: ${numEstrellas}\nMotivo: ${motivo}`;
                break;
        }
        const adminResponseText = `${action === 'approve' ? 'Aprobada' : action === 'cancel' ? 'Cancelada' : 'Rechazada'} solicitud para ${username}.`;
        yield ctx.answerCallbackQuery(adminResponseText);
        yield ctx.editMessageText(`${messageText}\n\nRespuesta: ${adminResponseText}`);
        // Notificar al usuario sobre la decisión del admin con toda la información
        yield ctx.api.sendMessage(telegramId, responseText);
    }
    catch (error) {
        console.error('Error processing admin action:', error);
        yield ctx.answerCallbackQuery("Error al procesar la acción. Por favor, intenta de nuevo.");
    }
}));
bot.start();
