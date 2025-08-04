import { VotingResults } from './vote.interface';

export interface Story {
  id: string;
  title: string;
  description?: string;
  estimate?: string;
  votingResults?: VotingResults;
}