"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRequestConfirmationKeyboard = getRequestConfirmationKeyboard;
const grammy_1 = require("grammy");
function getRequestConfirmationKeyboard(isAdmin) {
    if (isAdmin) {
        return new grammy_1.InlineKeyboard()
            .text("Confirmar y Aplicar", "admin_confirm_request")
            .text("Cancelar", "cancel_request");
    }
    else {
        return new grammy_1.InlineKeyboard()
            .text("Editar", "edit_request")
            .text("OK", "confirm_request")
            .text("Cancelar", "cancel_request");
    }
}
