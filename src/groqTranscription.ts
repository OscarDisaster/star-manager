import Groq from "groq-sdk";
import { createReadStream as fsCreateReadStream, readFileSync } from "fs";
import { unlink, writeFile } from "fs/promises";
import ffmpeg from "fluent-ffmpeg"; // Import ffmpeg
import axios from "axios"; // Import axios
import * as dotenv from "dotenv";
import path from "path";
import { StarRequest, RequestStatus, KnownUser } from "./types/types";

// Load environment variables from .env file
dotenv.config();

// Initialize Groq client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Define the path to the local ffmpeg binary
const ffmpegPath = process.env.FFMPEG_PATH || "./bin/ffmpeg"; // Path to ffmpeg in the root bin directory
const absoluteFfmpegPath = path.resolve(ffmpegPath);

// Set the path to the ffmpeg binary
ffmpeg.setFfmpegPath(absoluteFfmpegPath);

export async function transcribeAudio(
	mp3FilePath: string,
	language: string = "es"
): Promise<string> {
	const mp3Stream = fsCreateReadStream(mp3FilePath);

	try {
		const transcription = await groq.audio.transcriptions.create({
			file: mp3Stream,
			model: "whisper-large-v3",
			response_format: "json",
			language: language, // Use the language parameter
		});

		console.log(transcription);
		const transcriptionText = transcription.text || "No se pudo transcribir el audio.";
		return transcriptionText;
	} catch (error) {
		throw new Error(`Error transcribiendo el audio: ${(error as Error).message}`);
	} finally {
		// Clean up temporary files
		await unlink(mp3FilePath);
	}
}

export async function processVoiceMessage(
	fileUrl: string,
	language: string = "es"
): Promise<string> {
	try {
		const response = await axios.get(fileUrl, { responseType: "arraybuffer" });
		const audioBuffer = response.data;

		// Save the ogg file temporarily
		const oggFilePath = "temp.ogg";
		await writeFile(oggFilePath, audioBuffer);

		// Convert ogg to mp3 using fluent-ffmpeg
		const mp3FilePath = "temp.mp3";
		await new Promise((resolve, reject) => {
			ffmpeg(oggFilePath)
				.toFormat("mp3")
				.save(mp3FilePath)
				.on("end", resolve)
				.on("error", reject);
		});

		const transcriptionText = await transcribeAudio(mp3FilePath, language);

		// Clean up temporary files
		await unlink(oggFilePath);

		return transcriptionText;
	} catch (error) {
		throw new Error(`Error processing voice message: ${(error as Error).message}`);
	}
}

export async function convertTranscriptionToStarRequest(
	transcriptionText: string,
	telegramId: string,
	isAdmin: boolean
): Promise<StarRequest> {
	try {
		const promptFile = isAdmin ? "adminPrompt.txt" : "userPrompt.txt";
		const promptPath = path.join(__dirname, "prompts", promptFile);
		let prompt = readFileSync(promptPath, "utf-8");
		prompt = prompt.replace("{transcription}", transcriptionText);

		const completion = await groq.chat.completions.create({
			messages: [
				{
					role: "system",
					content:
						"Eres un asistente que convierte transcripciones de audio en solicitudes de estrellas. Extrae SOLO la información explícitamente mencionada. Responde con un objeto JSON que puede contener 'numEstrellas' (número), 'motivo' (string) y 'targetUser' (string, solo para solicitudes de administrador). NO incluyas campos que no estén explícitamente mencionados en la transcripción. NO uses valores por defecto como 'No especificado'.",
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

		const result = JSON.parse(completion.choices[0]?.message?.content || "{}");

		// Filtrar campos no especificados y hacer type assertion
		const filteredResult = Object.fromEntries(
			Object.entries(result).filter(
				([_, value]) => value !== "No especificado" && value !== ""
			)
		) as {
			numEstrellas?: number;
			motivo?: string;
			targetUser?: string;
		};

		// Verificar que los campos requeridos estén presentes
		if (!filteredResult.numEstrellas && !isAdmin) {
			throw new Error("El número de estrellas es obligatorio para solicitudes de usuarios.");
		}

		if (
			isAdmin &&
			(!filteredResult.numEstrellas || !filteredResult.motivo || !filteredResult.targetUser)
		) {
			throw new Error(
				"El número de estrellas, el motivo y el usuario objetivo son obligatorios para solicitudes de administradores."
			);
		}

		// Crear el objeto StarRequest con los tipos correctos
		const starRequest: StarRequest = {
			numEstrellas: filteredResult.numEstrellas || 0,
			motivo: filteredResult.motivo || "",
			telegramID: telegramId,
			status: "pending" as RequestStatus,
			targetUser: filteredResult.targetUser as KnownUser | undefined,
		};

		return starRequest;
	} catch (error) {
		throw new Error(
			`Error convirtiendo la transcripción a StarRequest: ${(error as Error).message}`
		);
	}
}
