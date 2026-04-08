/**
 * Safe localStorage utilities to prevent crashes during logout/token invalidation
 * These functions handle null values, JSON parsing errors, and localStorage access errors gracefully
 */

// Safe token getter function to prevent crashes during logout
export const getToken = () => {
  try {
    return localStorage.getItem('token') || null;
  } catch (error) {
    console.warn('Failed to access token from localStorage:', error);
    return null;
  }
};

// Safe complex token getter for persist:root pattern (redux-persist style)
export const getPersistedToken = () => {
  try {
    const persistRoot = localStorage.getItem("persist:root");
    if (!persistRoot) return null;
    
    const parsed = JSON.parse(persistRoot);
    if (!parsed?.user) return null;
    
    const userObj = JSON.parse(parsed.user);
    return userObj?.currentUser?.accessToken || null;
  } catch (error) {
    console.warn('Failed to access persisted token:', error);
    return null;
  }
};

// Safe user profile getter
export const getUserProfile = () => {
  try {
    const profile = localStorage.getItem('userProfile');
    return profile ? JSON.parse(profile) : null;
  } catch (error) {
    console.warn('Failed to parse userProfile from localStorage:', error);
    return null;
  }
};

// Safe wallet address getter
export const getWalletAddress = () => {
  try {
    return localStorage.getItem('walletAddress') || null;
  } catch (error) {
    console.warn('Failed to access walletAddress from localStorage:', error);
    return null;
  }
};

// Safe registration status getter
export const getRegistrationStatus = () => {
  try {
    return localStorage.getItem('registered') === 'true';
  } catch (error) {
    console.warn('Failed to access registration status from localStorage:', error);
    return false;
  }
};

// Safe generic JSON getter
export const getJsonItem = (key, defaultValue = null) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.warn(`Failed to parse ${key} from localStorage:`, error);
    return defaultValue;
  }
};

// Safe generic string getter
export const getStringItem = (key, defaultValue = null) => {
  try {
    return localStorage.getItem(key) || defaultValue;
  } catch (error) {
    console.warn(`Failed to access ${key} from localStorage:`, error);
    return defaultValue;
  }
};

// Safe setter with error handling
export const setItem = (key, value) => {
  try {
    if (typeof value === 'object') {
      localStorage.setItem(key, JSON.stringify(value));
    } else {
      localStorage.setItem(key, value);
    }
    return true;
  } catch (error) {
    console.warn(`Failed to set ${key} in localStorage:`, error);
    return false;
  }
};

// Safe remover with error handling
export const removeItem = (key) => {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`Failed to remove ${key} from localStorage:`, error);
    return false;
  }
};

// Clear all app-related localStorage items safely
export const clearAppStorage = () => {
  const appKeys = ['token', 'userProfile', 'walletAddress', 'registered', 'persist:root'];
  const results = {};
  
  appKeys.forEach(key => {
    results[key] = removeItem(key);
  });
  
  return results;
};