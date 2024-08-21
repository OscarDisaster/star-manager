"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkUserAccess = checkUserAccess;
const config_1 = require("../config");
const dbOperations_1 = require("../dbOperations");
function checkUserAccess(ctx) {
    return __awaiter(this, void 0, void 0, function* () {
        const now = Date.now();
        if (ctx.session.accessVerified &&
            ctx.session.accessVerifiedAt &&
            now - ctx.session.accessVerifiedAt < config_1.CACHE_EXPIRY) {
            return ctx.session.accessVerified;
        }
        const hasAccess = yield (0, dbOperations_1.userExists)(ctx.from.id.toString());
        ctx.session.accessVerified = hasAccess;
        ctx.session.accessVerifiedAt = now;
        return hasAccess;
    });
}
