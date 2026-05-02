export type ApiError = { message: string };

export type MeResponse = {
    email: string;
    firstName: string;
    lastName: string;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
};
export type ForgotPasswordRequest = {
  email: string;
};

export type ResetPasswordRequest = {
  token: string;
  password: string;
};

/** Réponse simple pour endpoints qui répondent { ok: true } */
export type OkResponse = { ok: true };