"use strict";
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
const config_1 = require("./config");
const accessUtils_1 = require("./utils/accessUtils");
const dbOperations_1 = require("./dbOperations");
const mainMenu_1 = require("./menus/mainMenu");
const actionKeyboards_1 = require("./keyboards/actionKeyboards");
const voiceHandler_1 = require("./voiceHandler");
const adminNotifications_1 = require("./handlers/adminNotifications");
const requestKeyboards_1 = require("./keyboards/requestKeyboards");
const users_1 = require("./constants/users");
const grammy_1 = require("grammy");
// Añade el manejador de errores global aquí, justo después de importar el bot
config_1.bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`Error while handling update ${ctx.update.update_id}:`);
    const e = err.error;
    if (e instanceof grammy_1.GrammyError) {
        console.error("Error in request:", e.description);
    }
    else if (e instanceof grammy_1.HttpError) {
        console.error("Could not contact Telegram:", e);
    }
    else {
        console.error("Unknown error:", e);
    }
});
config_1.bot.use((ctx, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (!ctx.from) {
        yield ctx.reply("No se pudo identificar al usuario.");
        return;
    }
    try {
        const hasAccess = yield (0, accessUtils_1.checkUserAccess)(ctx);
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
config_1.bot.command("start", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    const mainMenu = (0, mainMenu_1.getMainMenu)(ctx.from.id.toString());
    yield ctx.reply("Bienvenido al bot de estrellas!", {
        reply_markup: { keyboard: mainMenu.build() },
    });
}));
config_1.bot.on("message:text", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const text = ctx.message.text;
    if (text === "🙏 Pedir estrellas 🙏") {
        // Verificar si el usuario es admin
        if (ctx.from.id.toString() === config_1.USER_ADMIN) {
            yield ctx.reply("Como administrador, no puedes hacer peticiones de estrellas.");
            return;
        }
        ctx.session.commandState = { command: "menuAskStars", data: "cuantasEstrellas" };
        ctx.session.starRequest = {
            numEstrellas: 0,
            motivo: "",
            telegramID: ctx.from.id.toString(), // Convert to string
            status: "pending",
        };
        yield ctx.reply("¿Cuántas estrellas?", { reply_markup: { remove_keyboard: true } });
    }
    else if (((_a = ctx.session.commandState) === null || _a === void 0 ? void 0 : _a.command) === "menuAskStars") {
        // Verificar nuevamente si el usuario es admin
        if (ctx.from.id.toString() === config_1.USER_ADMIN) {
            yield ctx.reply("Como administrador, no puedes hacer peticiones de estrellas.");
            ctx.session.commandState = undefined;
            return;
        }
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
                const isAdmin = ctx.from.id.toString() === config_1.USER_ADMIN;
                const inlineKeyboard = (0, requestKeyboards_1.getRequestConfirmationKeyboard)(isAdmin);
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
        if (ctx.from.id.toString() !== config_1.USER_ADMIN) {
            yield ctx.reply("No tienes permiso para ver las peticiones.");
            return;
        }
        try {
            const latestRequest = yield (0, dbOperations_1.getLatestPendingRequest)();
            const pendingCount = yield (0, dbOperations_1.countPendingRequests)();
            if (!latestRequest) {
                yield ctx.reply("No hay peticiones pendientes en este momento.");
                return;
            }
            // Convertimos la respuesta de la base de datos a StarRequest
            const starRequest = {
                numEstrellas: latestRequest.numEstrellas,
                motivo: latestRequest.motivo,
                telegramID: latestRequest.telegram_id.toString(),
                status: latestRequest.status,
                username: ((_c = latestRequest.users) === null || _c === void 0 ? void 0 : _c.name) || "Usuario desconocido",
            };
            yield (0, adminNotifications_1.sendStarRequestToAdmin)(ctx, starRequest, pendingCount);
        }
        catch (error) {
            console.error("Error al obtener la última petición pendiente:", error);
            yield ctx.reply("Ocurrió un error al obtener las peticiones. Por favor, intenta más tarde.");
        }
    }
    else {
        // Resto de tu lógica existente
    }
}));
config_1.bot.on("message:voice", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    const isAdmin = ctx.from.id.toString() === config_1.USER_ADMIN;
    const { transcriptionText, starRequest } = yield (0, voiceHandler_1.handleVoiceMessage)(ctx, process.env.TELEGRAM_BOT_TOKEN, isAdmin);
    if (starRequest) {
        ctx.session.starRequest = starRequest;
        ctx.session.commandState = { command: "menuAskStars", data: "resumen" };
        const inlineKeyboard = (0, requestKeyboards_1.getRequestConfirmationKeyboard)(isAdmin);
        let replyMessage = `Transcripción: ${transcriptionText}\n\nResumen de tu solicitud:\nEstrellas: ${starRequest.numEstrellas}\nMotivo: ${starRequest.motivo}`;
        if (isAdmin && starRequest.targetUser) {
            replyMessage += `\nUsuario objetivo: ${starRequest.targetUser}`;
        }
        const transcriptionMessage = yield ctx.reply(replyMessage, {
            reply_markup: inlineKeyboard,
        });
        ctx.session.transcriptionMessageId = transcriptionMessage.message_id;
    }
}));
config_1.bot.callbackQuery("edit_request", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    // Si el usuario es admin y decide editar, también borramos el mensaje
    if (ctx.from.id.toString() === config_1.USER_ADMIN && ctx.session.transcriptionMessageId) {
        yield ctx.api.deleteMessage(ctx.chat.id, ctx.session.transcriptionMessageId);
        delete ctx.session.transcriptionMessageId;
    }
    ctx.session.commandState = { command: "menuAskStars", data: "cuantasEstrellas" };
    yield ctx.answerCallbackQuery();
    yield ctx.reply("¿Cuántas estrellas?");
}));
config_1.bot.callbackQuery("confirm_request", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    const isAdmin = ctx.from.id.toString() === config_1.USER_ADMIN;
    if (ctx.session.starRequest) {
        let targetUser;
        let telegramID = ctx.from.id.toString();
        if (isAdmin && ctx.session.starRequest.targetUser) {
            targetUser = ctx.session.starRequest.targetUser;
            const targetUserInfo = users_1.KNOWN_USERS.find((user) => user.name === targetUser);
            if (targetUserInfo) {
                telegramID = targetUserInfo.telegramId;
            }
            else {
                yield ctx.answerCallbackQuery("Error: Usuario objetivo no reconocido");
                return;
            }
        }
        const confirmedRequest = {
            numEstrellas: ctx.session.starRequest.numEstrellas,
            motivo: ctx.session.starRequest.motivo,
            telegramID: telegramID,
            status: "pending",
            targetUser: targetUser,
            username: isAdmin
                ? targetUser
                : ctx.from.username || ctx.from.first_name || "Unknown User",
        };
        try {
            yield (0, dbOperations_1.createStarRequest)(confirmedRequest);
            yield ctx.answerCallbackQuery();
            let confirmationMessage = `Solicitud confirmada y guardada. Gracias!\nEstrellas: ${confirmedRequest.numEstrellas}\nMotivo: ${confirmedRequest.motivo}`;
            if (isAdmin && targetUser) {
                confirmationMessage += `\nUsuario objetivo: ${targetUser}`;
            }
            yield ctx.editMessageText(confirmationMessage);
            // No necesitamos enviar notificación al admin si es una solicitud del admin
            if (!isAdmin) {
                console.log(`Sending notification to admin (${config_1.USER_ADMIN})`);
                const adminMessage = `Nueva solicitud de estrellas:\nUsuario: ${ctx.from.username || ctx.from.first_name}\nEstrellas: ${confirmedRequest.numEstrellas}\nMotivo: ${confirmedRequest.motivo}\nID: ${ctx.from.id}`;
                const approvalKeyboard = (0, actionKeyboards_1.getApprovalKeyboard)();
                try {
                    yield ctx.api.sendMessage(config_1.USER_ADMIN, adminMessage, {
                        reply_markup: approvalKeyboard,
                    });
                    console.log("Notification sent to admin successfully");
                }
                catch (error) {
                    console.error("Error sending notification to admin:", error);
                    yield ctx.reply("Error: No se pudo notificar al administrador. Por favor, contacta con soporte.");
                }
            }
        }
        catch (error) {
            console.error("Error in confirm_request:", error);
            yield ctx.answerCallbackQuery();
            yield ctx.editMessageText(`Error al guardar la solicitud: ${error.message}`);
        }
    }
    else {
        console.error("No starRequest found in session");
        yield ctx.answerCallbackQuery();
        yield ctx.editMessageText("Error: No se encontró la solicitud.");
    }
    ctx.session.commandState = { command: "MainMenu" };
    const mainMenu = (0, mainMenu_1.getMainMenu)(ctx.from.id.toString());
    yield ctx.reply("Menú principal:", { reply_markup: { keyboard: mainMenu.build() } });
}));
config_1.bot.callbackQuery("cancel_request", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    yield ctx.answerCallbackQuery();
    try {
        // Intenta editar el mensaje
        yield ctx.editMessageText("Solicitud cancelada.");
    }
    catch (error) {
        console.error("Error al editar el mensaje:", error);
        // Si falla la edición, envía un nuevo mensaje
        yield ctx.reply("Solicitud cancelada.");
    }
    // Borrar el mensaje de transcripción si existe y el usuario es admin
    if (ctx.from.id.toString() === config_1.USER_ADMIN && ctx.session.transcriptionMessageId) {
        try {
            yield ctx.api.deleteMessage(ctx.chat.id, ctx.session.transcriptionMessageId);
        }
        catch (deleteError) {
            console.error("Error al borrar el mensaje de transcripción:", deleteError);
        }
        delete ctx.session.transcriptionMessageId;
    }
    ctx.session.commandState = { command: "MainMenu" };
    const mainMenu = (0, mainMenu_1.getMainMenu)(ctx.from.id.toString());
    yield ctx.reply("Menú principal:", { reply_markup: { keyboard: mainMenu.build() } });
}));
config_1.bot.callbackQuery(/^action_/, (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const action = ctx.callbackQuery.data.split("_")[1];
    const messageText = (_a = ctx.callbackQuery.message) === null || _a === void 0 ? void 0 : _a.text;
    if (!messageText) {
        yield ctx.answerCallbackQuery("Error: No se pudo procesar la solicitud.");
        return;
    }
    // Extraemos la información directamente del mensaje
    const lines = messageText.split("\n");
    const username = lines[1].split(": ")[1];
    const numEstrellas = parseInt(lines[2].split(": ")[1], 10);
    const motivo = lines[3].split(": ")[1];
    const telegramId = lines[4].split(": ")[1];
    if (!telegramId) {
        console.error("telegramId is undefined or empty");
        yield ctx.answerCallbackQuery("Error: No se pudo identificar al usuario de la solicitud.");
        return;
    }
    let responseText = "";
    try {
        switch (action) {
            case "approve":
                yield (0, dbOperations_1.updateStarRequestStatus)(telegramId, "approved");
                console.log(`Attempting to add ${numEstrellas} stars to user ${telegramId}`);
                const newStarCount = yield (0, dbOperations_1.addStarsToUser)(telegramId, numEstrellas);
                responseText = `Tu solicitud ha sido aprobada:\nEstrellas solicitadas: ${numEstrellas}\nMotivo: ${motivo}\nNuevas estrellas totales: ${newStarCount}`;
                break;
            case "cancel":
                responseText = `Tu solicitud ha sido cancelada:\nEstrellas solicitadas: ${numEstrellas}\nMotivo: ${motivo}`;
                break;
            case "reject":
                yield (0, dbOperations_1.updateStarRequestStatus)(telegramId, "rejected");
                responseText = `Tu solicitud ha sido rechazada:\nEstrellas solicitadas: ${numEstrellas}\nMotivo: ${motivo}`;
                break;
        }
        const adminResponseText = `${action === "approve" ? "Aprobada" : action === "cancel" ? "Cancelada" : "Rechazada"} solicitud para ${username}.`;
        yield ctx.answerCallbackQuery(adminResponseText);
        yield ctx.editMessageText(`${messageText}\n\nRespuesta: ${adminResponseText}`);
        // Notificar al usuario sobre la decisión del admin con toda la información
        yield ctx.api.sendMessage(telegramId, responseText);
    }
    catch (error) {
        console.error("Error processing admin action:", error);
        yield ctx.answerCallbackQuery("Error al procesar la acción. Por favor, intenta de nuevo.");
    }
}));
config_1.bot.callbackQuery("admin_confirm_request", (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    if (ctx.from.id.toString() !== config_1.USER_ADMIN) {
        yield ctx.answerCallbackQuery("No tienes permiso para realizar esta acción.");
        return;
    }
    if (ctx.session.starRequest) {
        try {
            const request = ctx.session.starRequest;
            // Borrar el mensaje de transcripción si existe
            if (ctx.session.transcriptionMessageId) {
                yield ctx.api.deleteMessage(ctx.chat.id, ctx.session.transcriptionMessageId);
                delete ctx.session.transcriptionMessageId;
            }
            // Actualizar el estado de la solicitud a "accepted"
            yield (0, dbOperations_1.updateStarRequestStatus)(request.telegramID, "accepted");
            // Añadir las estrellas al usuario objetivo
            const targetUser = users_1.KNOWN_USERS.find((user) => user.name === request.targetUser);
            if (!targetUser) {
                throw new Error("Usuario objetivo no encontrado");
            }
            const newStarCount = yield (0, dbOperations_1.addStarsToUser)(targetUser.telegramId, request.numEstrellas);
            // Preparar mensaje de confirmación
            const confirmationMessage = `Solicitud aprobada y aplicada:\nUsuario: ${request.targetUser}\nEstrellas añadidas: ${request.numEstrellas}\nMotivo: ${request.motivo}\nNuevo total de estrellas: ${newStarCount}`;
            // Enviar un nuevo mensaje de confirmación
            yield ctx.reply(confirmationMessage);
            // Notificar al usuario objetivo
            yield ctx.api.sendMessage(targetUser.telegramId, `Papá te ha otorgado ${request.numEstrellas} estrellas.\nMotivo: ${request.motivo}\nNuevo total de estrellas: ${newStarCount}`);
            // Limpiar la sesión
            ctx.session.starRequest = undefined;
            yield ctx.answerCallbackQuery("Solicitud aprobada y aplicada con éxito.");
        }
        catch (error) {
            console.error("Error al procesar la solicitud del administrador:", error);
            yield ctx.answerCallbackQuery("Error al procesar la solicitud. Por favor, intenta de nuevo.");
            yield ctx.reply(`Error: ${error.message}`);
        }
    }
    else {
        yield ctx.answerCallbackQuery("No se encontró la solicitud en la sesión.");
    }
}));
config_1.bot.start();
console.log(`
🌟✨🤖 Bot de Estrellas StarCloud🤖✨🌟
==============================
🚀 ¡El bot ha iniciado con éxito! 🎉
🔧 Versión: 1.0.0
⏰ Hora de inicio: ${new Date().toLocaleString()}
==============================
🌈 ¡Listo para gestionar estrellas! 🌈
`);
