import { InlineKeyboard } from "grammy";

export function getRequestConfirmationKeyboard(isAdmin: boolean): InlineKeyboard {
	if (isAdmin) {
		return new InlineKeyboard()
			.text("Confirmar y Aplicar", "admin_confirm_request")
			.text("Cancelar", "cancel_request");
	} else {
		return new InlineKeyboard()
			.text("Editar", "edit_request")
			.text("OK", "confirm_request")
			.text("Cancelar", "cancel_request");
	}
}
