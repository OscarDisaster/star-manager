import { bot, USER_ADMIN } from "./config";
import { checkUserAccess } from "./utils/accessUtils";
import {
	getStarCount,
	createStarRequest,
	updateStarRequestStatus,
	addStarsToUser,
	getLatestPendingRequest,
	countPendingRequests,
} from "./dbOperations";
import { getMainMenu, getViewStarsMenu } from "./menus/mainMenu";
import { StarRequest, RequestStatus, KnownUser } from "./types/types";
import { getApprovalKeyboard } from "./keyboards/actionKeyboards";
import { handleVoiceMessage } from "./voiceHandler";
import { sendStarRequestToAdmin } from "./handlers/adminNotifications";
import { getRequestConfirmationKeyboard } from "./keyboards/requestKeyboards";
import { KNOWN_USERS } from "./constants/users";
import { GrammyError, HttpError } from "grammy";

// Añade el manejador de errores global aquí, justo después de importar el bot
bot.catch((err) => {
	const ctx = err.ctx;
	console.error(`Error while handling update ${ctx.update.update_id}:`);
	const e = err.error;
	if (e instanceof GrammyError) {
		console.error("Error in request:", e.description);
	} else if (e instanceof HttpError) {
		console.error("Could not contact Telegram:", e);
	} else {
		console.error("Unknown error:", e);
	}
});

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
		reply_markup: { keyboard: mainMenu.build() },
	});
});

bot.on("message:text", async (ctx) => {
	const text = ctx.message.text;

	if (text === "🙏 Pedir estrellas 🙏") {
		// Verificar si el usuario es admin
		if (ctx.from.id.toString() === USER_ADMIN) {
			await ctx.reply("Como administrador, no puedes hacer peticiones de estrellas.");
			return;
		}

		ctx.session.commandState = { command: "menuAskStars", data: "cuantasEstrellas" };
		ctx.session.starRequest = {
			numEstrellas: 0,
			motivo: "",
			telegramID: ctx.from.id.toString(), // Convert to string
			status: "pending",
		};
		await ctx.reply("¿Cuántas estrellas?", { reply_markup: { remove_keyboard: true } });
	} else if (ctx.session.commandState?.command === "menuAskStars") {
		// Verificar nuevamente si el usuario es admin
		if (ctx.from.id.toString() === USER_ADMIN) {
			await ctx.reply("Como administrador, no puedes hacer peticiones de estrellas.");
			ctx.session.commandState = undefined;
			return;
		}

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
				const isAdmin = ctx.from.id.toString() === USER_ADMIN;
				const inlineKeyboard = getRequestConfirmationKeyboard(isAdmin);
				await ctx.reply(
					`Resumen de tu solicitud:\nEstrellas: ${
						ctx.session.starRequest!.numEstrellas
					}\nMotivo: ${ctx.session.starRequest!.motivo}`,
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
			const pendingCount = await countPendingRequests();

			if (!latestRequest) {
				await ctx.reply("No hay peticiones pendientes en este momento.");
				return;
			}

			// Convertimos la respuesta de la base de datos a StarRequest
			const starRequest: StarRequest = {
				numEstrellas: latestRequest.numEstrellas,
				motivo: latestRequest.motivo,
				telegramID: latestRequest.telegram_id.toString(),
				status: latestRequest.status as RequestStatus,
				username: latestRequest.users?.name || "Usuario desconocido",
			};

			await sendStarRequestToAdmin(ctx, starRequest, pendingCount);
		} catch (error) {
			console.error("Error al obtener la última petición pendiente:", error);
			await ctx.reply(
				"Ocurrió un error al obtener las peticiones. Por favor, intenta más tarde."
			);
		}
	} else {
		// Resto de tu lógica existente
	}
});

bot.on("message:voice", async (ctx) => {
	const isAdmin = ctx.from!.id.toString() === USER_ADMIN;
	const { transcriptionText, starRequest } = await handleVoiceMessage(
		ctx,
		process.env.TELEGRAM_BOT_TOKEN!,
		isAdmin
	);

	if (starRequest) {
		ctx.session.starRequest = starRequest;
		ctx.session.commandState = { command: "menuAskStars", data: "resumen" };

		const inlineKeyboard = getRequestConfirmationKeyboard(isAdmin);
		let replyMessage = `Transcripción: ${transcriptionText}\n\nResumen de tu solicitud:\nEstrellas: ${starRequest.numEstrellas}\nMotivo: ${starRequest.motivo}`;
		if (isAdmin && starRequest.targetUser) {
			replyMessage += `\nUsuario objetivo: ${starRequest.targetUser}`;
		}

		const transcriptionMessage = await ctx.reply(replyMessage, {
			reply_markup: inlineKeyboard,
		});
		ctx.session.transcriptionMessageId = transcriptionMessage.message_id;
	}
});

bot.callbackQuery("edit_request", async (ctx) => {
	// Si el usuario es admin y decide editar, también borramos el mensaje
	if (ctx.from.id.toString() === USER_ADMIN && ctx.session.transcriptionMessageId) {
		await ctx.api.deleteMessage(ctx.chat!.id, ctx.session.transcriptionMessageId);
		delete ctx.session.transcriptionMessageId;
	}

	ctx.session.commandState = { command: "menuAskStars", data: "cuantasEstrellas" };
	await ctx.answerCallbackQuery();
	await ctx.reply("¿Cuántas estrellas?");
});

bot.callbackQuery("confirm_request", async (ctx) => {
	const isAdmin = ctx.from.id.toString() === USER_ADMIN;

	if (ctx.session.starRequest) {
		let targetUser: KnownUser | undefined;
		let telegramID = ctx.from.id.toString();

		if (isAdmin && ctx.session.starRequest.targetUser) {
			targetUser = ctx.session.starRequest.targetUser as KnownUser;
			const targetUserInfo = KNOWN_USERS.find((user) => user.name === targetUser);
			if (targetUserInfo) {
				telegramID = targetUserInfo.telegramId;
			} else {
				await ctx.answerCallbackQuery("Error: Usuario objetivo no reconocido");
				return;
			}
		}

		const confirmedRequest: StarRequest = {
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
			await createStarRequest(confirmedRequest);
			await ctx.answerCallbackQuery();

			let confirmationMessage = `Solicitud confirmada y guardada. Gracias!\nEstrellas: ${confirmedRequest.numEstrellas}\nMotivo: ${confirmedRequest.motivo}`;
			if (isAdmin && targetUser) {
				confirmationMessage += `\nUsuario objetivo: ${targetUser}`;
			}
			await ctx.editMessageText(confirmationMessage);

			// No necesitamos enviar notificación al admin si es una solicitud del admin
			if (!isAdmin) {
				console.log(`Sending notification to admin (${USER_ADMIN})`);
				const adminMessage = `Nueva solicitud de estrellas:\nUsuario: ${
					ctx.from.username || ctx.from.first_name
				}\nEstrellas: ${confirmedRequest.numEstrellas}\nMotivo: ${
					confirmedRequest.motivo
				}\nID: ${ctx.from.id}`;
				const approvalKeyboard = getApprovalKeyboard();
				try {
					await ctx.api.sendMessage(USER_ADMIN, adminMessage, {
						reply_markup: approvalKeyboard,
					});
					console.log("Notification sent to admin successfully");
				} catch (error) {
					console.error("Error sending notification to admin:", error);
					await ctx.reply(
						"Error: No se pudo notificar al administrador. Por favor, contacta con soporte."
					);
				}
			}
		} catch (error) {
			console.error("Error in confirm_request:", error);
			await ctx.answerCallbackQuery();
			await ctx.editMessageText(`Error al guardar la solicitud: ${(error as Error).message}`);
		}
	} else {
		console.error("No starRequest found in session");
		await ctx.answerCallbackQuery();
		await ctx.editMessageText("Error: No se encontró la solicitud.");
	}

	ctx.session.commandState = { command: "MainMenu" };
	const mainMenu = getMainMenu(ctx.from.id.toString());
	await ctx.reply("Menú principal:", { reply_markup: { keyboard: mainMenu.build() } });
});

bot.callbackQuery("cancel_request", async (ctx) => {
	await ctx.answerCallbackQuery();

	try {
		// Intenta editar el mensaje
		await ctx.editMessageText("Solicitud cancelada.");
	} catch (error) {
		console.error("Error al editar el mensaje:", error);
		// Si falla la edición, envía un nuevo mensaje
		await ctx.reply("Solicitud cancelada.");
	}

	// Borrar el mensaje de transcripción si existe y el usuario es admin
	if (ctx.from.id.toString() === USER_ADMIN && ctx.session.transcriptionMessageId) {
		try {
			await ctx.api.deleteMessage(ctx.chat!.id, ctx.session.transcriptionMessageId);
		} catch (deleteError) {
			console.error("Error al borrar el mensaje de transcripción:", deleteError);
		}
		delete ctx.session.transcriptionMessageId;
	}

	ctx.session.commandState = { command: "MainMenu" };
	const mainMenu = getMainMenu(ctx.from.id.toString());
	await ctx.reply("Menú principal:", { reply_markup: { keyboard: mainMenu.build() } });
});

bot.callbackQuery(/^action_/, async (ctx) => {
	const action = ctx.callbackQuery.data.split("_")[1];
	const messageText = ctx.callbackQuery.message?.text;
	if (!messageText) {
		await ctx.answerCallbackQuery("Error: No se pudo procesar la solicitud.");
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
		await ctx.answerCallbackQuery("Error: No se pudo identificar al usuario de la solicitud.");
		return;
	}

	let responseText = "";
	try {
		switch (action) {
			case "approve":
				await updateStarRequestStatus(telegramId, "approved");
				console.log(`Attempting to add ${numEstrellas} stars to user ${telegramId}`);
				const newStarCount = await addStarsToUser(telegramId, numEstrellas);
				responseText = `Tu solicitud ha sido aprobada:\nEstrellas solicitadas: ${numEstrellas}\nMotivo: ${motivo}\nNuevas estrellas totales: ${newStarCount}`;
				break;
			case "cancel":
				responseText = `Tu solicitud ha sido cancelada:\nEstrellas solicitadas: ${numEstrellas}\nMotivo: ${motivo}`;
				break;
			case "reject":
				await updateStarRequestStatus(telegramId, "rejected");
				responseText = `Tu solicitud ha sido rechazada:\nEstrellas solicitadas: ${numEstrellas}\nMotivo: ${motivo}`;
				break;
		}

		const adminResponseText = `${
			action === "approve" ? "Aprobada" : action === "cancel" ? "Cancelada" : "Rechazada"
		} solicitud para ${username}.`;
		await ctx.answerCallbackQuery(adminResponseText);
		await ctx.editMessageText(`${messageText}\n\nRespuesta: ${adminResponseText}`);

		// Notificar al usuario sobre la decisión del admin con toda la información
		await ctx.api.sendMessage(telegramId, responseText);
	} catch (error) {
		console.error("Error processing admin action:", error);
		await ctx.answerCallbackQuery("Error al procesar la acción. Por favor, intenta de nuevo.");
	}
});

bot.callbackQuery("admin_confirm_request", async (ctx) => {
	if (ctx.from.id.toString() !== USER_ADMIN) {
		await ctx.answerCallbackQuery("No tienes permiso para realizar esta acción.");
		return;
	}

	if (ctx.session.starRequest) {
		try {
			const request = ctx.session.starRequest;

			// Borrar el mensaje de transcripción si existe
			if (ctx.session.transcriptionMessageId) {
				await ctx.api.deleteMessage(ctx.chat!.id, ctx.session.transcriptionMessageId);
				delete ctx.session.transcriptionMessageId;
			}

			// Actualizar el estado de la solicitud a "accepted"
			await updateStarRequestStatus(request.telegramID, "accepted");

			// Añadir las estrellas al usuario objetivo
			const targetUser = KNOWN_USERS.find((user) => user.name === request.targetUser);
			if (!targetUser) {
				throw new Error("Usuario objetivo no encontrado");
			}
			const newStarCount = await addStarsToUser(targetUser.telegramId, request.numEstrellas);

			// Preparar mensaje de confirmación
			const confirmationMessage = `Solicitud aprobada y aplicada:\nUsuario: ${request.targetUser}\nEstrellas añadidas: ${request.numEstrellas}\nMotivo: ${request.motivo}\nNuevo total de estrellas: ${newStarCount}`;

			// Enviar un nuevo mensaje de confirmación
			await ctx.reply(confirmationMessage);

			// Notificar al usuario objetivo
			await ctx.api.sendMessage(
				targetUser.telegramId,
				`Papá te ha otorgado ${request.numEstrellas} estrellas.\nMotivo: ${request.motivo}\nNuevo total de estrellas: ${newStarCount}`
			);

			// Limpiar la sesión
			ctx.session.starRequest = undefined;

			await ctx.answerCallbackQuery("Solicitud aprobada y aplicada con éxito.");
		} catch (error) {
			console.error("Error al procesar la solicitud del administrador:", error);
			await ctx.answerCallbackQuery(
				"Error al procesar la solicitud. Por favor, intenta de nuevo."
			);
			await ctx.reply(`Error: ${(error as Error).message}`);
		}
	} else {
		await ctx.answerCallbackQuery("No se encontró la solicitud en la sesión.");
	}
});

bot.start();

console.log(`
🌟✨🤖 Bot de Estrellas StarCloud🤖✨🌟
==============================
🚀 ¡El bot ha iniciado con éxito! 🎉
🔧 Versión: 1.0.0
⏰ Hora de inicio: ${new Date().toLocaleString()}
==============================
🌈 ¡Listo para gestionar estrellas! 🌈
`);
