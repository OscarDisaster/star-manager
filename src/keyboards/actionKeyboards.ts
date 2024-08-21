import { InlineKeyboard } from "grammy";

export function getApprovalKeyboard() {
	return new InlineKeyboard()
		.text("Aprobar", "action_approve")
		.text("Rechazar", "action_reject")
		.text("Cancelar", "action_cancel");
}
