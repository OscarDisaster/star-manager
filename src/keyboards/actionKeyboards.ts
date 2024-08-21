import { InlineKeyboard } from "grammy";

export function getApprovalKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Aprobar", "action_approve")
    .text("Cancelar", "action_cancel")
    .text("Rechazar", "action_reject");
}
