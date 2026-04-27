import { useSelector } from 'react-redux';
import { selectAuthToken, type AuthRootSlice } from '../store/authSlice.js';

export const useAuthToken = (): string | null =>
  useSelector((s: AuthRootSlice) => selectAuthToken(s));
