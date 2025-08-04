export interface User {
  id: string;
  name: string;
  role: UserRole;
  isConnected: boolean;
  avatar?: string;
}

export enum UserRole {
  MODERATOR = 'moderator',
  PLAYER = 'player',
  OBSERVER = 'observer'
}