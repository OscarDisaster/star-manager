"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMainMenu = getMainMenu;
exports.getViewStarsMenu = getViewStarsMenu;
const grammy_1 = require("grammy");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const USER_ADMIN = process.env.USER_ADMIN;
function getMainMenu(userId) {
    const isAdmin = userId === USER_ADMIN;
    const keyboard = new grammy_1.Keyboard()
        .text("⭐ Ver estrellas ⭐")
        .row();
    if (isAdmin) {
        keyboard.text("👀 Ver peticiones 👀");
    }
    else {
        keyboard.text("🙏 Pedir estrellas 🙏");
    }
    return keyboard;
}
function getViewStarsMenu() {
    return new grammy_1.Keyboard()
        .text("Oscar")
        .text("Laura")
        .row()
        .text("🔙 Back");
}
