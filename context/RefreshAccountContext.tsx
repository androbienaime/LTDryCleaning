import { MultiAccountStorage } from '@/utils/multiAccountStorage';

type Tokens = {
  token: string;
  refreshToken: string;
  isExpired: boolean;
  isRefreshTokenExpired: boolean;
} | null;

const isTokenExpired = (token: string): boolean => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(base64Url.length + (4 - base64Url.length % 4) % 4, '=');

    const payload = JSON.parse(atob(base64));

    return typeof payload.exp === 'number'
      ? payload.exp < Date.now() / 1000
      : true;
  } catch {
    return true;
  }
};

export const getTokens = async (accountId: string): Promise<Tokens> => {
  const store = await MultiAccountStorage.getStore();
  const account = store.accounts.find((a) => a.id === accountId);
  
  if (!account) return null;

  return {
    token: account.token,
    refreshToken: account.refreshToken ?? '',
    isExpired: isTokenExpired(account.token),
    isRefreshTokenExpired : isTokenExpired(account.refreshToken ?? ''),
  };
};