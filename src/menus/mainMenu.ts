import { Keyboard } from "grammy";
import dotenv from 'dotenv';

dotenv.config();

const USER_ADMIN = process.env.USER_ADMIN;

export function getMainMenu(userId: string): Keyboard {
  const isAdmin = userId === USER_ADMIN;

  const keyboard = new Keyboard()
    .text("⭐ Ver estrellas ⭐")
    .row();

  if (isAdmin) {
    keyboard.text("👀 Ver peticiones 👀");
  } else {
    keyboard.text("🙏 Pedir estrellas 🙏");
  }

  return keyboard;
}

export function getViewStarsMenu(): Keyboard {
  return new Keyboard()
    .text("Oscar")
    .text("Laura")
    .row()
    .text("🔙 Back");
}