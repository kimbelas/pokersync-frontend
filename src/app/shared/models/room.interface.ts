export interface Room {
  id: string;
  code: string;
  name: string;
  moderatorId: string;
  participants: User[];
  currentStory?: Story;
  deck: VotingDeck;
  votingPhase: VotingPhase;
  createdAt: Date;
  settings: RoomSettings;
}

export interface RoomSettings {
  autoReveal: boolean;
  allowObservers: boolean;
  timerEnabled: boolean;
  timerDuration: number;
}

export enum VotingPhase {
  WAITING = 'waiting',
  VOTING = 'voting',
  REVEALED = 'revealed'
}

export interface VotingDeck {
  name: string;
  cards: string[];
}

// Import dependencies
import { User } from './user.interface';
import { Story } from './story.interface';