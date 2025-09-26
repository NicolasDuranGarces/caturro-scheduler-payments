import { useAuthContext, AuthContextValue } from '../contexts/AuthContext';

export const useAuth = (): AuthContextValue => useAuthContext();
