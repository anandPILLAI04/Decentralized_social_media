import { useState, useCallback, createContext, useContext, useMemo } from 'react';
import { getToken, getPersistedToken, getWalletAddress, getUserProfile, clearAppStorage, setItem } from '../utils/safeStorage';

/**
 * Auth context & hook
 * Provides reactive authentication state (wallet address, token, user profile)
 * and methods (login, logout) throughout the component tree.
 */

const AuthContext = createContext(null);

/**
 * AuthProvider – wraps the app and provides reactive auth state via context.
 * Login sets state + localStorage; logout clears both.
 */
export function AuthProvider({ children }) {
  const [walletAddress, setWalletAddress] = useState(() => getWalletAddress());
  const [token, setToken] = useState(() => getToken() || getPersistedToken());
  const [userProfile, setUserProfile] = useState(() => getUserProfile());
  const [registered, setRegistered] = useState(() => localStorage.getItem('registered') === 'true');

  const isAuthenticated = !!(walletAddress && registered);

  const login = useCallback(({ address, token: authToken, user }) => {
    setWalletAddress(address);
    setToken(authToken);
    setUserProfile(user);
    setRegistered(true);

    setItem('walletAddress', address);
    if (authToken) localStorage.setItem('token', authToken);
    localStorage.setItem('registered', 'true');
    if (user) localStorage.setItem('userProfile', JSON.stringify(user));
  }, []);

  const logout = useCallback(() => {
    setWalletAddress(null);
    setToken(null);
    setUserProfile(null);
    setRegistered(false);
    clearAppStorage();
  }, []);

  const updateProfile = useCallback((user) => {
    setUserProfile(user);
    if (user) localStorage.setItem('userProfile', JSON.stringify(user));
  }, []);

  const value = useMemo(() => ({
    walletAddress,
    token,
    userProfile,
    isAuthenticated,
    registered,
    login,
    logout,
    updateProfile,
  }), [walletAddress, token, userProfile, isAuthenticated, registered, login, logout, updateProfile]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth hook – returns the current authentication state.
 * Requires AuthProvider in the tree; falls back to localStorage reads if missing.
 */
export function useAuth() {
  const ctx = useContext(AuthContext);

  // If wrapped in AuthProvider, use context
  if (ctx) return ctx;

  // Standalone fallback – derive state from localStorage (not reactive)
  const walletAddress = getWalletAddress();
  const token = getToken() || getPersistedToken();
  const userProfile = getUserProfile();
  const isAuthenticated = !!(walletAddress && (token || userProfile));

  return {
    walletAddress,
    token,
    userProfile,
    isAuthenticated,
    registered: localStorage.getItem('registered') === 'true',
    login: () => console.warn('useAuth: login() called outside AuthProvider'),
    logout: () => {
      clearAppStorage();
      window.location.href = '/';
    },
    updateProfile: () => console.warn('useAuth: updateProfile() called outside AuthProvider'),
  };
}

export default useAuth;
