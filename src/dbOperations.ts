import { createClient } from "@supabase/supabase-js";
import dotenv from 'dotenv';
import { StarRequest } from './types/types';

dotenv.config(); // Load environment variables from .env file

// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

// Get table names from .env
const USERS_TABLE = process.env.USERS_TABLE!;
const STAR_REQUESTS_TABLE = process.env.STAR_REQUESTS_TABLE!;

export async function getStarCount(name: string) {
  const { data, error } = await supabase
    .from(USERS_TABLE)
    .select('stars')
    .eq('name', name)
    .single();

  if (error) {
    throw new Error(`Error fetching data: ${error.message}`);
  }

  return data.stars;
}

export async function updateStarCount(name: string, newStarsCount: number) {
  const { error } = await supabase
    .from(USERS_TABLE)
    .update({ stars: newStarsCount })
    .eq('name', name);

  if (error) {
    throw new Error(`Error updating data: ${error.message}`);
  }
}

export async function createStarRequest(request: StarRequest) {
  const { error } = await supabase
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
}

export async function userExists(telegramId: string): Promise<boolean> {
  const { data, error } = await supabase
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
}

export async function updateStarRequestStatus(telegramId: string, newStatus: string) {
  const { error } = await supabase
    .from('starRequests')
    .update({ status: newStatus })
    .eq('telegram_id', telegramId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Error updating star request status: ${error.message}`);
  }
}

export async function addStarsToUser(telegramId: string, starsToAdd: number) {
  const { data, error } = await supabase
    .from(USERS_TABLE)
    .select('stars')
    .eq('telegram_id', telegramId)
    .single();

  if (error) {
    throw new Error(`Error fetching user stars: ${error.message}`);
  }

  const currentStars = data.stars || 0;
  const newStarCount = currentStars + starsToAdd;

  const { error: updateError } = await supabase
    .from(USERS_TABLE)
    .update({ stars: newStarCount })
    .eq('telegram_id', telegramId);

  if (updateError) {
    throw new Error(`Error updating user stars: ${updateError.message}`);
  }

  return newStarCount;
}

export async function getLatestPendingRequest() {
  const { data, error } = await supabase
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
}