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
}

export type RequestStatus = 'pending' | 'accepted' | 'rejected';

export interface StarRequest {
  numEstrellas: number;
  motivo: string;
  telegramID: number;
  status: RequestStatus;
}

// Esto asegura que el archivo sea tratado como un módulo
export {};