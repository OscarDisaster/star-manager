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
exports.countPendingRequests = countPendingRequests;
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv_1 = __importDefault(require("dotenv"));
const users_1 = require("./constants/users");
dotenv_1.default.config(); // Load environment variables from .env file
// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase URL or Key is missing in environment variables");
    process.exit(1);
}
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
// Get table names from .env
const USERS_TABLE = process.env.USERS_TABLE;
const STAR_REQUESTS_TABLE = process.env.STAR_REQUESTS_TABLE;
function getStarCount(name) {
    return __awaiter(this, void 0, void 0, function* () {
        const { data, error } = yield supabase
            .from(USERS_TABLE)
            .select("stars")
            .eq("name", name)
            .single();
        if (error)
            throw new Error(`Error fetching data: ${error.message}`);
        return data.stars;
    });
}
function updateStarCount(name, newStarsCount) {
    return __awaiter(this, void 0, void 0, function* () {
        const { error } = yield supabase
            .from(USERS_TABLE)
            .update({ stars: newStarsCount })
            .eq("name", name);
        if (error)
            throw new Error(`Error updating data: ${error.message}`);
    });
}
function createStarRequest(request) {
    return __awaiter(this, void 0, void 0, function* () {
        let targetTelegramId = request.telegramID;
        // Si hay un targetUser, usa su telegramId en lugar del del admin
        if (request.targetUser) {
            const targetUser = users_1.KNOWN_USERS.find((user) => user.name === request.targetUser);
            if (targetUser) {
                targetTelegramId = targetUser.telegramId;
            }
            else {
                throw new Error(`Usuario objetivo no reconocido: ${request.targetUser}`);
            }
        }
        const { error } = yield supabase.from(STAR_REQUESTS_TABLE).insert({
            numEstrellas: request.numEstrellas,
            motivo: request.motivo,
            telegram_id: targetTelegramId,
            status: request.status,
        });
        if (error)
            throw new Error(`Error creating star request: ${error.message}`);
    });
}
function userExists(telegramId) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`Checking existence for user with telegram_id: ${telegramId}`);
        const { data, error } = yield supabase
            .from(USERS_TABLE)
            .select("id")
            .eq("telegram_id", telegramId)
            .single();
        if (error) {
            if (error.code === "PGRST116") {
                console.log(`User with telegram_id ${telegramId} not found`);
                return false;
            }
            throw new Error(`Error checking user existence: ${error.message}`);
        }
        console.log(`User exists: ${!!data}`);
        return !!data;
    });
}
function updateStarRequestStatus(telegramId, newStatus) {
    return __awaiter(this, void 0, void 0, function* () {
        const { error } = yield supabase
            .from(STAR_REQUESTS_TABLE)
            .update({ status: newStatus })
            .eq("telegram_id", telegramId)
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .limit(1);
        if (error)
            throw new Error(`Error updating star request status: ${error.message}`);
    });
}
function addStarsToUser(telegramId, starsToAdd) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`Attempting to add ${starsToAdd} stars to user with telegram_id: ${telegramId}`);
        const { data, error } = yield supabase
            .from(USERS_TABLE)
            .select("stars")
            .eq("telegram_id", telegramId);
        if (error)
            throw new Error(`Error fetching user stars: ${error.message}`);
        if (!data || data.length === 0)
            throw new Error(`No user found with telegram_id: ${telegramId}`);
        if (data.length > 1)
            throw new Error(`Multiple users found with telegram_id: ${telegramId}`);
        const currentStars = data[0].stars || 0;
        const newStarCount = currentStars + starsToAdd;
        const { error: updateError } = yield supabase
            .from(USERS_TABLE)
            .update({ stars: newStarCount })
            .eq("telegram_id", telegramId);
        if (updateError)
            throw new Error(`Error updating user stars: ${updateError.message}`);
        console.log(`Updated stars for user ${telegramId}: ${currentStars} -> ${newStarCount}`);
        return newStarCount;
    });
}
function getLatestPendingRequest() {
    return __awaiter(this, void 0, void 0, function* () {
        const { data, error } = yield supabase
            .from(STAR_REQUESTS_TABLE)
            .select(`
            *,
            users:telegram_id (
                name
            )
        `)
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .limit(1)
            .single();
        if (error) {
            if (error.code === "PGRST116")
                return null;
            throw new Error(`Error fetching latest pending request: ${error.message}`);
        }
        return data;
    });
}
function countPendingRequests() {
    return __awaiter(this, void 0, void 0, function* () {
        const { count, error } = yield supabase
            .from(STAR_REQUESTS_TABLE)
            .select("*", { count: "exact", head: true })
            .eq("status", "pending");
        if (error)
            throw new Error(`Error counting pending requests: ${error.message}`);
        return count || 0;
    });
}
