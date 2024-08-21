import { Context } from "grammy";
import { StarRequest } from "../types/types";
import { getApprovalKeyboard } from "../keyboards/actionKeyboards";

export async function sendStarRequestToAdmin(
	ctx: Context,
	request: StarRequest,
	pendingCount: number
) {
	const message = `Nueva solicitud de estrellas:
Usuario: ${request.username}
Estrellas: ${request.numEstrellas}
Motivo: ${request.motivo}
ID: ${request.telegramID}

Peticiones pendientes: ${pendingCount}`;

	const approvalKeyboard = getApprovalKeyboard();
	await ctx.reply(message, {
		reply_markup: approvalKeyboard,
	});
}
