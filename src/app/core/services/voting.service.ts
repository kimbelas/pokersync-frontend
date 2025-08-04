import { Injectable, signal, computed } from '@angular/core';
import { VotingResults, Vote } from '../../shared/models';

@Injectable({
  providedIn: 'root'
})
export class VotingService {
  private readonly _currentVotes = signal<Vote[]>([]);
  
  readonly currentVotes = computed(() => this._currentVotes());

  constructor() { }

  calculateResults(votes: Vote[]): VotingResults {
    if (votes.length === 0) {
      return {
        votes: [],
        average: 0,
        median: '0',
        consensus: false,
        storyId: ''
      };
    }

    // Filter out non-numeric votes for calculations
    const numericVotes = votes
      .map(vote => parseFloat(vote.value))
      .filter(value => !isNaN(value));

    const average = numericVotes.length > 0 
      ? numericVotes.reduce((sum, value) => sum + value, 0) / numericVotes.length
      : 0;

    // Calculate median
    const sortedVotes = [...numericVotes].sort((a, b) => a - b);
    const median = this.calculateMedian(sortedVotes);

    // Check for consensus (all votes are the same)
    const uniqueVotes = new Set(votes.map(vote => vote.value));
    const consensus = uniqueVotes.size === 1;

    return {
      votes,
      average,
      median: median.toString(),
      consensus,
      storyId: votes[0]?.storyId || ''
    };
  }

  private calculateMedian(sortedNumbers: number[]): number {
    const length = sortedNumbers.length;
    if (length === 0) return 0;
    
    if (length % 2 === 0) {
      return (sortedNumbers[length / 2 - 1] + sortedNumbers[length / 2]) / 2;
    } else {
      return sortedNumbers[Math.floor(length / 2)];
    }
  }

  updateVotes(votes: Vote[]): void {
    this._currentVotes.set(votes);
  }

  clearVotes(): void {
    this._currentVotes.set([]);
  }

  hasUserVoted(userId: string): boolean {
    return this.currentVotes().some(vote => vote.userId === userId);
  }
}