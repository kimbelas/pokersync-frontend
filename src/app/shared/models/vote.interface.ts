export interface Vote {
  userId: string;
  userName: string;
  value: string;
  storyId: string;
  timestamp: Date;
}

export interface VotingResults {
  votes: Vote[];
  average: number;
  median: string;
  consensus: boolean;
  storyId: string;
}