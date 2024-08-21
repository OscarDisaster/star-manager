export interface SessionData {
	requestingStars?: string | null;
	commandState?: {
		command?: string;
		data?: any;
		startCommandMessageId?: number;
	};
	starRequest?: StarRequest;
	accessVerified?: boolean;
	accessVerifiedAt?: number;
	transcriptionMessageId?: number; // ID del mensaje de transcripción
}

export type RequestStatus = "pending" | "accepted" | "rejected";

export type KnownUser = "Oscar" | "Laura";

export interface UserInfo {
	name: KnownUser;
	telegramId: string;
}

export interface StarRequest {
	numEstrellas: number;
	motivo: string;
	telegramID: string;
	status: RequestStatus;
	username?: string;
	targetUser?: KnownUser;
}
