import { Bot, Context, SessionFlavor, session } from "grammy";
import * as dotenv from "dotenv";
import { SessionData } from "./types/types";

// Load environment variables from .env file
dotenv.config();

// Ensure required environment variables are available
const requiredEnvVars = [
	"TELEGRAM_BOT_TOKEN",
	"SUPABASE_URL",
	"SUPABASE_KEY",
	"GROQ_API_KEY",
	"USER_ADMIN",
];

requiredEnvVars.forEach((varName) => {
	if (!process.env[varName]) {
		throw new Error(`${varName} is not defined in the .env file`);
	}
});

export const USER_ADMIN = process.env.USER_ADMIN!;

export type MyContext = Context & SessionFlavor<SessionData>;

// Use the bot token from the .env file
export const bot = new Bot<MyContext>(process.env.TELEGRAM_BOT_TOKEN!);

// Configure session middleware
function initial(): SessionData {
	return {};
}
bot.use(session({ initial }));

export const CACHE_EXPIRY = 60 * 60 * 1000; // 1 hour in milliseconds
