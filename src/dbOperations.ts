import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { StarRequest } from "./types/types";
import { KNOWN_USERS } from "./constants/users";

dotenv.config(); // Load environment variables from .env file

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
	console.error("Supabase URL or Key is missing in environment variables");
	process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Get table names from .env
const USERS_TABLE = process.env.USERS_TABLE!;
const STAR_REQUESTS_TABLE = process.env.STAR_REQUESTS_TABLE!;

export async function getStarCount(name: string): Promise<number> {
	const { data, error } = await supabase
		.from(USERS_TABLE)
		.select("stars")
		.eq("name", name)
		.single();

	if (error) throw new Error(`Error fetching data: ${error.message}`);
	return data.stars;
}

export async function updateStarCount(name: string, newStarsCount: number): Promise<void> {
	const { error } = await supabase
		.from(USERS_TABLE)
		.update({ stars: newStarsCount })
		.eq("name", name);

	if (error) throw new Error(`Error updating data: ${error.message}`);
}

export async function createStarRequest(request: StarRequest): Promise<void> {
	let targetTelegramId = request.telegramID;

	// Si hay un targetUser, usa su telegramId en lugar del del admin
	if (request.targetUser) {
		const targetUser = KNOWN_USERS.find((user) => user.name === request.targetUser);
		if (targetUser) {
			targetTelegramId = targetUser.telegramId;
		} else {
			throw new Error(`Usuario objetivo no reconocido: ${request.targetUser}`);
		}
	}

	const { error } = await supabase.from(STAR_REQUESTS_TABLE).insert({
		numEstrellas: request.numEstrellas,
		motivo: request.motivo,
		telegram_id: targetTelegramId,
		status: request.status,
	});

	if (error) throw new Error(`Error creating star request: ${error.message}`);
}

export async function userExists(telegramId: string): Promise<boolean> {
	console.log(`Checking existence for user with telegram_id: ${telegramId}`);
	const { data, error } = await supabase
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
}

export async function updateStarRequestStatus(
	telegramId: string,
	newStatus: string
): Promise<void> {
	const { error } = await supabase
		.from(STAR_REQUESTS_TABLE)
		.update({ status: newStatus })
		.eq("telegram_id", telegramId)
		.eq("status", "pending")
		.order("created_at", { ascending: false })
		.limit(1);

	if (error) throw new Error(`Error updating star request status: ${error.message}`);
}

export async function addStarsToUser(telegramId: string, starsToAdd: number): Promise<number> {
	console.log(`Attempting to add ${starsToAdd} stars to user with telegram_id: ${telegramId}`);

	const { data, error } = await supabase
		.from(USERS_TABLE)
		.select("stars")
		.eq("telegram_id", telegramId);

	if (error) throw new Error(`Error fetching user stars: ${error.message}`);
	if (!data || data.length === 0)
		throw new Error(`No user found with telegram_id: ${telegramId}`);
	if (data.length > 1) throw new Error(`Multiple users found with telegram_id: ${telegramId}`);

	const currentStars = data[0].stars || 0;
	const newStarCount = currentStars + starsToAdd;

	const { error: updateError } = await supabase
		.from(USERS_TABLE)
		.update({ stars: newStarCount })
		.eq("telegram_id", telegramId);

	if (updateError) throw new Error(`Error updating user stars: ${updateError.message}`);

	console.log(`Updated stars for user ${telegramId}: ${currentStars} -> ${newStarCount}`);
	return newStarCount;
}

export async function getLatestPendingRequest() {
	const { data, error } = await supabase
		.from(STAR_REQUESTS_TABLE)
		.select(
			`
            *,
            users:telegram_id (
                name
            )
        `
		)
		.eq("status", "pending")
		.order("created_at", { ascending: false })
		.limit(1)
		.single();

	if (error) {
		if (error.code === "PGRST116") return null;
		throw new Error(`Error fetching latest pending request: ${error.message}`);
	}

	return data;
}

export async function countPendingRequests(): Promise<number> {
	const { count, error } = await supabase
		.from(STAR_REQUESTS_TABLE)
		.select("*", { count: "exact", head: true })
		.eq("status", "pending");

	if (error) throw new Error(`Error counting pending requests: ${error.message}`);
	return count || 0;
}
