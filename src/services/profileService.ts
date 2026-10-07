import { UserProfile } from '../types/diet';

const PROFILE_STORAGE_KEY = 'min_diet_user_profile';

const DEFAULT_PROFILE: UserProfile = {
  birthDate: '1995-01-01',
  gender: 'female',
  height: 165,