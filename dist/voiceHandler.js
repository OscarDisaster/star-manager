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
exports.handleVoiceMessage = handleVoiceMessage;
const groqTranscription_1 = require("./groqTranscription");
const users_1 = require("./constants/users");
const stringUtils_1 = require("./utils/stringUtils");
function handleVoiceMessage(ctx, botToken, isAdmin) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        const fileId = (_b = (_a = ctx.message) === null || _a === void 0 ? void 0 : _a.voice) === null || _b === void 0 ? void 0 : _b.file_id;
        if (!fileId) {
            yield ctx.reply("Error: No se pudo obtener el archivo de voz.");
            return { transcriptionText: "", starRequest: null };
        }
        const file = yield ctx.api.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;
        try {
            const transcriptionText = yield (0, groqTranscription_1.processVoiceMessage)(fileUrl, "es");
            const convertedRequest = yield (0, groqTranscription_1.convertTranscriptionToStarRequest)(transcriptionText, ctx.from.id.toString(), isAdmin);
            if (isAdmin) {
                // Verificar que la solicitud del admin tenga todos los campos necesarios
                if (!convertedRequest.numEstrellas ||
                    !convertedRequest.motivo ||
                    !convertedRequest.targetUser) {
                    yield ctx.reply("Error: El número de estrellas, el motivo y el usuario objetivo son obligatorios para solicitudes de administradores.");
                    return { transcriptionText, starRequest: null };
                }
                // Normalizar y verificar que el usuario objetivo sea válido
                const normalizedTargetUser = (0, stringUtils_1.normalizeString)(convertedRequest.targetUser);
                const validUser = users_1.KNOWN_USERS.find((user) => (0, stringUtils_1.normalizeString)(user.name) === normalizedTargetUser);
                if (!validUser) {
                    yield ctx.reply(`Error: El usuario objetivo "${convertedRequest.targetUser}" no es válido.`);
                    return { transcriptionText, starRequest: null };
                }
                // Usar el nombre original del usuario (con la ortografía correcta)
                convertedRequest.targetUser = validUser.name;
            }
            const starRequest = {
                numEstrellas: convertedRequest.numEstrellas,
                motivo: convertedRequest.motivo,
                telegramID: ctx.from.id.toString(),
                status: "pending",
                username: ((_c = ctx.from) === null || _c === void 0 ? void 0 : _c.username) || ((_d = ctx.from) === null || _d === void 0 ? void 0 : _d.first_name) || "Usuario desconocido",
                targetUser: isAdmin ? convertedRequest.targetUser : undefined,
            };
            return { transcriptionText, starRequest };
        }
        catch (error) {
            yield ctx.reply(`Error procesando el audio: ${error.message}`);
            return { transcriptionText: "", starRequest: null };
        }
    });
}
