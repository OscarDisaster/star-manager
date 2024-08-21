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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transcribeAudio = transcribeAudio;
exports.processVoiceMessage = processVoiceMessage;
exports.convertTranscriptionToStarRequest = convertTranscriptionToStarRequest;
const groq_sdk_1 = __importDefault(require("groq-sdk"));
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg")); // Import ffmpeg
const axios_1 = __importDefault(require("axios")); // Import axios
const dotenv = __importStar(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load environment variables from .env file
dotenv.config();
// Initialize Groq client
const groq = new groq_sdk_1.default({ apiKey: process.env.GROQ_API_KEY });
// Define the path to the local ffmpeg binary
const ffmpegPath = process.env.FFMPEG_PATH || "./bin/ffmpeg"; // Path to ffmpeg in the root bin directory
const absoluteFfmpegPath = path_1.default.resolve(ffmpegPath);
// Set the path to the ffmpeg binary
fluent_ffmpeg_1.default.setFfmpegPath(absoluteFfmpegPath);
function transcribeAudio(mp3FilePath_1) {
    return __awaiter(this, arguments, void 0, function* (mp3FilePath, language = "es") {
        const mp3Stream = (0, fs_1.createReadStream)(mp3FilePath);
        try {
            const transcription = yield groq.audio.transcriptions.create({
                file: mp3Stream,
                model: "whisper-large-v3",
                response_format: "json",
                language: language, // Use the language parameter
            });
            console.log(transcription);
            const transcriptionText = transcription.text || "No se pudo transcribir el audio.";
            return transcriptionText;
        }
        catch (error) {
            throw new Error(`Error transcribiendo el audio: ${error.message}`);
        }
        finally {
            // Clean up temporary files
            yield (0, promises_1.unlink)(mp3FilePath);
        }
    });
}
function processVoiceMessage(fileUrl_1) {
    return __awaiter(this, arguments, void 0, function* (fileUrl, language = "es") {
        try {
            const response = yield axios_1.default.get(fileUrl, { responseType: "arraybuffer" });
            const audioBuffer = response.data;
            // Save the ogg file temporarily
            const oggFilePath = "temp.ogg";
            yield (0, promises_1.writeFile)(oggFilePath, audioBuffer);
            // Convert ogg to mp3 using fluent-ffmpeg
            const mp3FilePath = "temp.mp3";
            yield new Promise((resolve, reject) => {
                (0, fluent_ffmpeg_1.default)(oggFilePath)
                    .toFormat("mp3")
                    .save(mp3FilePath)
                    .on("end", resolve)
                    .on("error", reject);
            });
            const transcriptionText = yield transcribeAudio(mp3FilePath, language);
            // Clean up temporary files
            yield (0, promises_1.unlink)(oggFilePath);
            return transcriptionText;
        }
        catch (error) {
            throw new Error(`Error processing voice message: ${error.message}`);
        }
    });
}
function convertTranscriptionToStarRequest(transcriptionText, telegramId, isAdmin) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            const promptFile = isAdmin ? "adminPrompt.txt" : "userPrompt.txt";
            const promptPath = path_1.default.join(__dirname, "prompts", promptFile);
            let prompt = (0, fs_1.readFileSync)(promptPath, "utf-8");
            prompt = prompt.replace("{transcription}", transcriptionText);
            const completion = yield groq.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: "Eres un asistente que convierte transcripciones de audio en solicitudes de estrellas. Extrae SOLO la información explícitamente mencionada. Responde con un objeto JSON que puede contener 'numEstrellas' (número), 'motivo' (string) y 'targetUser' (string, solo para solicitudes de administrador). NO incluyas campos que no estén explícitamente mencionados en la transcripción. NO uses valores por defecto como 'No especificado'.",
                    },
                    {
                        role: "user",
                        content: prompt,
                    },
                ],
                model: "mixtral-8x7b-32768",
                temperature: 0.2,
                max_tokens: 1024,
                response_format: { type: "json_object" },
            });
            const result = JSON.parse(((_b = (_a = completion.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) || "{}");
            // Filtrar campos no especificados y hacer type assertion
            const filteredResult = Object.fromEntries(Object.entries(result).filter(([_, value]) => value !== "No especificado" && value !== ""));
            // Verificar que los campos requeridos estén presentes
            if (!filteredResult.numEstrellas && !isAdmin) {
                throw new Error("El número de estrellas es obligatorio para solicitudes de usuarios.");
            }
            if (isAdmin &&
                (!filteredResult.numEstrellas || !filteredResult.motivo || !filteredResult.targetUser)) {
                throw new Error("El número de estrellas, el motivo y el usuario objetivo son obligatorios para solicitudes de administradores.");
            }
            // Crear el objeto StarRequest con los tipos correctos
            const starRequest = {
                numEstrellas: filteredResult.numEstrellas || 0,
                motivo: filteredResult.motivo || "",
                telegramID: telegramId,
                status: "pending",
                targetUser: filteredResult.targetUser,
            };
            return starRequest;
        }
        catch (error) {
            throw new Error(`Error convirtiendo la transcripción a StarRequest: ${error.message}`);
        }
    });
}
