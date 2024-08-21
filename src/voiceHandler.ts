import { Context } from "grammy";
import { processVoiceMessage, convertTranscriptionToStarRequest } from "./groqTranscription";
import { StarRequest, RequestStatus, KnownUser } from "./types/types";
import { KNOWN_USERS } from "./constants/users";
import { normalizeString } from "./utils/stringUtils";

export async function handleVoiceMessage(
	ctx: Context,
	botToken: string,
	isAdmin: boolean
): Promise<{ transcriptionText: string; starRequest: StarRequest | null }> {
	const fileId = ctx.message?.voice?.file_id;
	if (!fileId) {
		await ctx.reply("Error: No se pudo obtener el archivo de voz.");
		return { transcriptionText: "", starRequest: null };
	}

	const file = await ctx.api.getFile(fileId);
	const fileUrl = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;

	try {
		const transcriptionText = await processVoiceMessage(fileUrl, "es");
		const convertedRequest = await convertTranscriptionToStarRequest(
			transcriptionText,
			ctx.from!.id.toString(),
			isAdmin
		);

		if (isAdmin) {
			// Verificar que la solicitud del admin tenga todos los campos necesarios
			if (
				!convertedRequest.numEstrellas ||
				!convertedRequest.motivo ||
				!convertedRequest.targetUser
			) {
				await ctx.reply(
					"Error: El número de estrellas, el motivo y el usuario objetivo son obligatorios para solicitudes de administradores."
				);
				return { transcriptionText, starRequest: null };
			}

			// Normalizar y verificar que el usuario objetivo sea válido
			const normalizedTargetUser = normalizeString(convertedRequest.targetUser);
			const validUser = KNOWN_USERS.find(
				(user) => normalizeString(user.name) === normalizedTargetUser
			);

			if (!validUser) {
				await ctx.reply(
					`Error: El usuario objetivo "${convertedRequest.targetUser}" no es válido.`
				);
				return { transcriptionText, starRequest: null };
			}

			// Usar el nombre original del usuario (con la ortografía correcta)
			convertedRequest.targetUser = validUser.name;
		}

		const starRequest: StarRequest = {
			numEstrellas: convertedRequest.numEstrellas,
			motivo: convertedRequest.motivo,
			telegramID: ctx.from!.id.toString(),
			status: "pending" as RequestStatus,
			username: ctx.from?.username || ctx.from?.first_name || "Usuario desconocido",
			targetUser: isAdmin ? (convertedRequest.targetUser as KnownUser) : undefined,
		};

		return { transcriptionText, starRequest };
	} catch (error) {
		await ctx.reply(`Error procesando el audio: ${(error as Error).message}`);
		return { transcriptionText: "", starRequest: null };
	}
}
