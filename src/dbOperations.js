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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStarCount = getStarCount;
exports.updateStarCount = updateStarCount;
exports.createStarRequest = createStarRequest;
exports.userExists = userExists;
exports.updateStarRequestStatus = updateStarRequestStatus;
exports.addStarsToUser = addStarsToUser;
exports.getLatestPendingRequest = getLatestPendingRequest;
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config(); // Load environment variables from .env file
// Initialize Supabase client
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
// Get table names from .env
const USERS_TABLE = process.env.USERS_TABLE;
const STAR_REQUESTS_TABLE = process.env.STAR_REQUESTS_TABLE;
function getStarCount(name) {
    return __awaiter(this, void 0, void 0, function* () {
        const { data, error } = yield supabase
            .from(USERS_TABLE)
            .select('stars')
            .eq('name', name)
            .single();
        if (error) {
            throw new Error(`Error fetching data: ${error.message}`);
        }
        return data.stars;
    });
}
function updateStarCount(name, newStarsCount) {
    return __awaiter(this, void 0, void 0, function* () {
        const { error } = yield supabase
            .from(USERS_TABLE)
            .update({ stars: newStarsCount })
            .eq('name', name);
        if (error) {
            throw new Error(`Error updating data: ${error.message}`);
        }
    });
}
function createStarRequest(request) {
    return __awaiter(this, void 0, void 0, function* () {
        const { error } = yield supabase
            .from(STAR_REQUESTS_TABLE)
            .insert({
            numEstrellas: request.numEstrellas,
            motivo: request.motivo,
            telegram_id: request.telegramID.toString(),
            status: request.status
        });
        if (error) {
            throw new Error(`Error creating star request: ${error.message}`);
        }
    });
}
function userExists(telegramId) {
    return __awaiter(this, void 0, void 0, function* () {
        const { data, error } = yield supabase
            .from(USERS_TABLE)
            .select('id')
            .eq('telegram_id', telegramId)
            .single();
        if (error) {
            if (error.code === 'PGRST116') {
                // No se encontró el usuario
                return false;
            }
            throw new Error(`Error checking user existence: ${error.message}`);
        }
        return !!data;
    });
}
function updateStarRequestStatus(telegramId, newStatus) {
    return __awaiter(this, void 0, void 0, function* () {
        const { error } = yield supabase
            .from('starRequests')
            .update({ status: newStatus })
            .eq('telegram_id', telegramId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1);
        if (error) {
            throw new Error(`Error updating star request status: ${error.message}`);
        }
    });
}
function addStarsToUser(telegramId, starsToAdd) {
    return __awaiter(this, void 0, void 0, function* () {
        const { data, error } = yield supabase
            .from(USERS_TABLE)
            .select('stars')
            .eq('telegram_id', telegramId)
            .single();
        if (error) {
            throw new Error(`Error fetching user stars: ${error.message}`);
        }
        const currentStars = data.stars || 0;
        const newStarCount = currentStars + starsToAdd;
        const { error: updateError } = yield supabase
            .from(USERS_TABLE)
            .update({ stars: newStarCount })
            .eq('telegram_id', telegramId);
        if (updateError) {
            throw new Error(`Error updating user stars: ${updateError.message}`);
        }
        return newStarCount;
    });
}
function getLatestPendingRequest() {
    return __awaiter(this, void 0, void 0, function* () {
        const { data, error } = yield supabase
            .from('starRequests')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        if (error) {
            if (error.code === 'PGRST116') {
                // No se encontraron solicitudes pendientes
                return null;
            }
            throw new Error(`Error fetching latest pending request: ${error.message}`);
        }
        return data;
    });
}
