"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getApprovalKeyboard = getApprovalKeyboard;
const grammy_1 = require("grammy");
function getApprovalKeyboard() {
    return new grammy_1.InlineKeyboard()
        .text("Aprobar", "action_approve")
        .text("Rechazar", "action_reject")
        .text("Cancelar", "action_cancel");
}
