import Groq from "groq-sdk";
import { createReadStream as fsCreateReadStream } from "fs";
import { unlink, writeFile } from "fs/promises";
import ffmpeg from 'fluent-ffmpeg'; // Import ffmpeg
import axios from 'axios'; // Import axios
import * as dotenv from 'dotenv';
import { StarRequest } from './types/types';

// Load environment variables from .env file
dotenv.config();

// Initialize Groq client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Define the path to the local ffmpeg binary
const ffmpegPath = './bin/ffmpeg'; // Path to ffmpeg in the root bin directory

// Set the path to the ffmpeg binary
ffmpeg.setFfmpegPath(ffmpegPath);

export async function transcribeAudio(mp3FilePath: string, language: string = "es"): Promise<string> {
  const mp3Stream = fsCreateReadStream(mp3FilePath);

  try {
    const transcription = await groq.audio.transcriptions.create({
      file: mp3Stream,
      model: "whisper-large-v3",
      response_format: "json",
      language: language // Use the language parameter
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

export async function processVoiceMessage(fileUrl: string, language: string = "es"): Promise<string> {
  try {
    const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const audioBuffer = response.data;

    // Save the ogg file temporarily
    const oggFilePath = 'temp.ogg';
    await writeFile(oggFilePath, audioBuffer);

    // Convert ogg to mp3 using fluent-ffmpeg
    const mp3FilePath = 'temp.mp3';
    await new Promise((resolve, reject) => {
      ffmpeg(oggFilePath)
        .toFormat('mp3')
        .save(mp3FilePath)
        .on('end', resolve)
        .on('error', reject);
    });

    const transcriptionText = await transcribeAudio(mp3FilePath, language);

    // Clean up temporary files
    await unlink(oggFilePath);

    return transcriptionText;
  } catch (error) {
    throw new Error(`Error processing voice message: ${(error as Error).message}`);
  }
}

export async function convertTranscriptionToStarRequest(transcriptionText: string, telegramID: number): Promise<StarRequest> {
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "Eres un asistente que convierte transcripciones de audio en solicitudes de estrellas. Extrae el número de estrellas y el motivo del texto transcrito. Responde solo con un objeto JSON que contenga 'numEstrellas' (número) y 'motivo' (string)."
        },
        {
          role: "user",
          content: `Convierte esta transcripción en una solicitud de estrellas: "${transcriptionText}"`
        }
      ],
      model: "mixtral-8x7b-32768",
      temperature: 0.5,
      max_tokens: 1024,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(chatCompletion.choices[0]?.message?.content || "{}");

    return {
      numEstrellas: result.numEstrellas || 0,
      motivo: result.motivo || "",
      telegramID: telegramID,
      status: 'pending'
    };
  } catch (error) {
    throw new Error(`Error convirtiendo la transcripción a StarRequest: ${(error as Error).message}`);
  }
}