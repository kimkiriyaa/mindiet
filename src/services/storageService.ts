import { DailyLog, AuthUser, UserSession, UserProfile } from '../types/diet';

const DEFAULT_TARGET_CALORIES = 2000;
const REGISTERED_USERS_KEY = 'registered_users';
const CURRENT_SESSION_KEY = 'min_diet_session';
const LEGACY_SESSION_KEY = 'diet_session';

export const GOOGLE_SHEET_SCRIPT_URL =