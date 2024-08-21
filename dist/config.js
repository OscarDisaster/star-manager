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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CACHE_EXPIRY = exports.bot = exports.USER_ADMIN = void 0;
const grammy_1 = require("grammy");
const dotenv = __importStar(require("dotenv"));
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
exports.USER_ADMIN = process.env.USER_ADMIN;
// Use the bot token from the .env file
exports.bot = new grammy_1.Bot(process.env.TELEGRAM_BOT_TOKEN);
// Configure session middleware
function initial() {
    return {};
}
exports.bot.use((0, grammy_1.session)({ initial }));
exports.CACHE_EXPIRY = 60 * 60 * 1000; // 1 hour in milliseconds
