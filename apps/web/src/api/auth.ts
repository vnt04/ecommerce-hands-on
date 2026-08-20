import { apiGet, apiPost, setAccessToken } from './client.js';

export type SessionUser = {
      id: string;
      email: string;
      fullName: string;
      role: string;
};

type SessionResponse = { accessToken: string; user: SessionUser };

export async function register(input: { email: string; password: string; fullName: string }): Promise<SessionUser> {
      const { data } = await apiPost<SessionResponse>('/auth/register', input);

      setAccessToken(data.accessToken);

      return data.user;
}

export async function login(input: { email: string; password: string }): Promise<SessionUser> {
      const { data } = await apiPost<SessionResponse>('/auth/login', input);

      setAccessToken(data.accessToken);

      return data.user;
}

export async function logout(): Promise<void> {
      await apiPost<void>('/auth/logout');

      setAccessToken(undefined);
}

export async function fetchCurrentUser(): Promise<SessionUser> {
      return (await apiGet<SessionUser>('/auth/me')).data;
}
