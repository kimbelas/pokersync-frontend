import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { SocketService } from '../../../../core/services/socket.service';
import { Room, User, Vote, VotingResults, Story } from '../../../../shared/models';

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="results-container">
      <!-- Header Section -->
      <header class="results-header">
        <div class="glass-card header-card">
          <div class="header-content">
            <div class="session-info">
              <div class="session-icon">📊</div>
              <div class="session-details">
                <h1 class="session-title">Session Results</h1>
                <p class="session-subtitle">{{ currentRoom()?.name || 'Planning Poker Session' }}</p>
              </div>
            </div>
            <div class="session-meta">
              <div class="meta-item">
                <span class="meta-icon">🏠</span>
                <span class="meta-value">{{ currentRoom()?.code }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-icon">👥</span>
                <span class="meta-value">{{ participants().length }} Members</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <!-- Main Results Area -->
      <main class="results-main">
        
        <!-- Current Story Results -->
        <section *ngIf="votingResults()" class="current-results-section">
          <div class="section-header">
            <h2 class="section-title">Current Story Results</h2>
            <div class="story-info" *ngIf="currentStory()">
              <span class="story-title">{{ currentStory()?.title }}</span>
            </div>
          </div>

          <!-- Results Summary Cards -->
          <div class="results-summary">
            <div class="result-card glass-card">
              <div class="result-icon">📊</div>
              <div class="result-content">
                <h3 class="result-label">Average</h3>
                <p class="result-value">{{ formatNumber(votingResults()?.average) }}</p>
                <p class="result-description">Average of all numeric votes</p>
              </div>
            </div>

            <div class="result-card glass-card">
              <div class="result-icon">🗳️</div>
              <div class="result-content">
                <h3 class="result-label">Total Votes</h3>
                <p class="result-value">{{ votingResults()?.votes?.length || 0 }}</p>
                <p class="result-description">Participants who voted</p>
              </div>
            </div>
          </div>

          <!-- Vote Distribution -->
          <div class="vote-distribution glass-card">
            <h3 class="distribution-title">Vote Distribution</h3>
            <div class="votes-grid">
              <div *ngFor="let voteGroup of getVoteDistribution(); trackBy: trackVoteGroup" 
                   class="vote-group animate-scale-in">
                <div class="vote-card poker-card-sm" 
                     [class.selected]="voteGroup.isPopular">
                  {{ voteGroup.value }}
                </div>
                <div class="vote-details">
                  <div class="vote-count">{{ voteGroup.count }} vote{{ voteGroup.count !== 1 ? 's' : '' }}</div>
                  <div class="vote-percentage">{{ voteGroup.percentage }}%</div>
                  <div class="voter-names">
                    <span *ngFor="let voter of voteGroup.voters; let last = last" 
                          class="voter-name">
                      {{ voter }}{{ !last ? ', ' : '' }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Individual Votes -->
          <div class="individual-votes glass-card">
            <h3 class="votes-title">Individual Votes</h3>
            <div class="votes-list">
              <div *ngFor="let vote of sortedVotes(); trackBy: trackVote" 
                   class="vote-item animate-slide-in">
                <div class="voter-avatar avatar-sm">
                  {{ getVoterInitial(vote.userName) }}
                </div>
                <div class="voter-info">
                  <span class="voter-name">{{ vote.userName }}</span>
                  <span class="vote-time">{{ formatVoteTime(vote.timestamp) }}</span>
                </div>
                <div class="vote-value-display poker-card-sm">
                  {{ vote.value }}
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- No Results State -->
        <section *ngIf="!votingResults()" class="no-results-section">
          <div class="no-results-card glass-card">
            <div class="no-results-icon">📋</div>
            <h2 class="no-results-title">No Results Available</h2>
            <p class="no-results-description">
              Complete a voting session to see detailed results and analytics
            </p>
            <button class="glass-btn glass-btn-primary" (click)="goToVoting()">
              🗳️ Start Voting
            </button>
          </div>
        </section>

        <!-- Action Buttons -->
        <div class="results-actions">
          <div class="action-buttons-grid">
            <button class="glass-btn glass-btn-success" (click)="exportResults()">
              📤 Export Results
            </button>
            <button class="glass-btn glass-btn-primary" (click)="goToVoting()">
              🔄 New Round
            </button>
          </div>
        </div>

      </main>

      <!-- Team Summary Sidebar -->
      <aside class="team-sidebar">
        <div class="team-card glass-card">
          <div class="team-header">
            <h3 class="team-title">Team Summary</h3>
            <div class="team-stats">
              <div class="stat-badge">
                <span class="stat-value">{{ getVoterCount() }}</span>
                <span class="stat-label">Voters</span>
              </div>
            </div>
          </div>
          
          <div class="team-members">
            <div *ngFor="let participant of participants(); trackBy: trackParticipant" 
                 class="member-item"
                 [class.moderator]="participant.role === 'moderator'"
                 [class.voted]="hasVoted(participant.id)">
              
              <div class="member-avatar avatar-sm"
                   [class.moderator]="participant.role === 'moderator'">
                {{ participant.name.charAt(0).toUpperCase() }}
              </div>
              
              <div class="member-info">
                <div class="member-name">{{ participant.name }}</div>
                <div class="member-role">
                  <span class="role-icon">
                    {{ participant.role === 'moderator' ? '👑' : 
                       participant.role === 'player' ? '🎯' : '👀' }}
                  </span>
                  {{ participant.role }}
                </div>
              </div>
              
              <div class="member-status">
                <div *ngIf="hasVoted(participant.id)" class="voted-indicator">
                  ✅
                </div>
                <div *ngIf="!hasVoted(participant.id) && participant.role === 'player'" 
                     class="not-voted-indicator">
                  ⏳
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  `,
  styles: `
    .results-container {
      min-height: 100vh;
      background: var(--bg-gradient);
      display: grid;
      grid-template-columns: 1fr 300px;
      grid-template-rows: auto 1fr;
      gap: var(--space-6);
      padding: var(--space-6);
    }

    /* Header Section */
    .results-header {
      grid-column: 1 / -1;
    }

    .header-card {
      padding: var(--space-6);
    }

    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--space-4);
    }

    .session-info {
      display: flex;
      align-items: center;
      gap: var(--space-4);
    }

    .session-icon {
      font-size: var(--text-4xl);
      padding: var(--space-4);
      background: var(--primary-glass);
      border-radius: var(--radius-xl);
      border: 1px solid var(--primary-glass-border);
    }

    .session-title {
      font-size: var(--text-3xl);
      font-weight: var(--font-bold);
      color: var(--gray-800);
      margin: 0 0 var(--space-1) 0;
    }

    .session-subtitle {
      font-size: var(--text-lg);
      color: var(--gray-600);
      margin: 0;
    }

    .session-meta {
      display: flex;
      gap: var(--space-4);
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4);
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);
      backdrop-filter: blur(10px);
    }

    .meta-icon {
      font-size: var(--text-lg);
    }

    .meta-value {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--gray-700);
      font-family: 'JetBrains Mono', monospace;
    }

    /* Main Results */
    .results-main {
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
      overflow-y: auto;
      max-height: calc(100vh - 200px);
    }

    .current-results-section {
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--space-4);
    }

    .section-title {
      font-size: var(--text-2xl);
      font-weight: var(--font-bold);
      color: var(--gray-800);
      margin: 0;
    }

    .story-info {
      padding: var(--space-2) var(--space-4);
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);
      backdrop-filter: blur(10px);
    }

    .story-title {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--gray-700);
    }

    /* Results Summary */
    .results-summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: var(--space-4);
    }

    .result-card {
      padding: var(--space-6);
      text-align: center;
      position: relative;
      overflow: hidden;
      transition: all var(--transition);
    }

    .result-card.highlight {
      background: var(--success-glass);
      border-color: var(--success-glass-border);
    }

    .result-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--glass-shadow-lg);
    }

    .result-icon {
      font-size: var(--text-4xl);
      margin-bottom: var(--space-4);
      display: block;
    }

    .result-label {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--gray-600);
      margin: 0 0 var(--space-2) 0;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .result-value {
      font-size: var(--text-3xl);
      font-weight: var(--font-bold);
      color: var(--gray-800);
      margin: 0 0 var(--space-2) 0;
      font-family: 'JetBrains Mono', monospace;
    }

    .consensus-value.achieved {
      color: var(--success-600);
    }

    .result-description {
      font-size: var(--text-sm);
      color: var(--gray-600);
      margin: 0;
    }

    /* Vote Distribution */
    .vote-distribution {
      padding: var(--space-6);
    }

    .distribution-title {
      font-size: var(--text-xl);
      font-weight: var(--font-semibold);
      color: var(--gray-800);
      margin: 0 0 var(--space-6) 0;
    }

    .votes-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: var(--space-4);
    }

    .vote-group {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-4);
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);
      backdrop-filter: blur(10px);
      transition: all var(--transition);
    }

    .vote-group:hover {
      transform: translateY(-2px);
      box-shadow: var(--glass-shadow);
    }

    .vote-details {
      text-align: center;
    }

    .vote-count {
      font-size: var(--text-lg);
      font-weight: var(--font-bold);
      color: var(--gray-800);
      margin-bottom: var(--space-1);
    }

    .vote-percentage {
      font-size: var(--text-sm);
      color: var(--primary-600);
      font-weight: var(--font-medium);
      margin-bottom: var(--space-2);
    }

    .voter-names {
      font-size: var(--text-xs);
      color: var(--gray-600);
      line-height: 1.4;
    }

    .voter-name {
      font-weight: var(--font-medium);
    }

    /* Individual Votes */
    .individual-votes {
      padding: var(--space-6);
    }

    .votes-title {
      font-size: var(--text-xl);
      font-weight: var(--font-semibold);
      color: var(--gray-800);
      margin: 0 0 var(--space-6) 0;
    }

    .votes-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .vote-item {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      padding: var(--space-3);
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);
      backdrop-filter: blur(10px);
      transition: all var(--transition);
    }

    .vote-item:hover {
      background: var(--glass-bg-light);
    }

    .voter-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .voter-name {
      font-weight: var(--font-medium);
      color: var(--gray-800);
      font-size: var(--text-sm);
    }

    .vote-time {
      font-size: var(--text-xs);
      color: var(--gray-500);
      font-family: 'JetBrains Mono', monospace;
    }

    .vote-value-display {
      min-width: 3rem;
      height: 4rem;
      font-size: var(--text-lg);
    }

    /* No Results State */
    .no-results-section {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 400px;
    }

    .no-results-card {
      text-align: center;
      padding: var(--space-12);
      max-width: 400px;
    }

    .no-results-icon {
      font-size: var(--text-5xl);
      margin-bottom: var(--space-6);
      display: block;
    }

    .no-results-title {
      font-size: var(--text-2xl);
      font-weight: var(--font-semibold);
      color: var(--gray-800);
      margin: 0 0 var(--space-4) 0;
    }

    .no-results-description {
      color: var(--gray-600);
      margin: 0 0 var(--space-8) 0;
      line-height: 1.6;
    }

    /* Results Actions */
    .results-actions {
      margin-top: var(--space-6);
    }

    .action-buttons-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: var(--space-4);
    }

    /* Team Sidebar */
    .team-sidebar {
      position: sticky;
      top: var(--space-6);
      height: fit-content;
    }

    .team-card {
      padding: var(--space-6);
    }

    .team-header {
      margin-bottom: var(--space-6);
    }

    .team-title {
      font-size: var(--text-lg);
      font-weight: var(--font-semibold);
      color: var(--gray-800);
      margin: 0 0 var(--space-4) 0;
    }

    .team-stats {
      display: flex;
      gap: var(--space-3);
    }

    .stat-badge {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      background: var(--primary-glass);
      border: 1px solid var(--primary-glass-border);
      border-radius: var(--radius-lg);
    }

    .stat-value {
      font-size: var(--text-lg);
      font-weight: var(--font-bold);
      color: var(--primary-600);
      font-family: 'JetBrains Mono', monospace;
    }

    .stat-label {
      font-size: var(--text-xs);
      color: var(--gray-600);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .team-members {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .member-item {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3);
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);
      backdrop-filter: blur(10px);
      transition: all var(--transition);
    }

    .member-item.voted {
      background: var(--success-glass);
      border-color: var(--success-glass-border);
    }

    .member-item.moderator {
      background: var(--warning-glass);
      border-color: var(--warning-glass-border);
    }

    .member-avatar.moderator {
      background: var(--gradient-warning);
    }

    .member-info {
      flex: 1;
      min-width: 0;
    }

    .member-name {
      font-weight: var(--font-medium);
      color: var(--gray-800);
      font-size: var(--text-sm);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .member-role {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      font-size: var(--text-xs);
      color: var(--gray-600);
      text-transform: capitalize;
    }

    .role-icon {
      font-size: var(--text-sm);
    }

    .member-status {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 1.5rem;
    }

    .voted-indicator,
    .not-voted-indicator {
      font-size: var(--text-lg);
    }

    .not-voted-indicator {
      opacity: 0.5;
    }

    /* Responsive Design */
    @media (max-width: 1024px) {
      .results-container {
        grid-template-columns: 1fr;
        grid-template-rows: auto auto 1fr;
      }

      .team-sidebar {
        order: 2;
        position: static;
      }

      .results-main {
        order: 3;
        max-height: none;
      }
    }

    @media (max-width: 768px) {
      .results-container {
        padding: var(--space-4);
        gap: var(--space-4);
      }

      .header-content {
        flex-direction: column;
        align-items: flex-start;
      }

      .session-meta {
        flex-direction: column;
        gap: var(--space-2);
        width: 100%;
      }

      .meta-item {
        justify-content: center;
      }

      .results-summary {
        grid-template-columns: 1fr;
      }

      .votes-grid {
        grid-template-columns: 1fr;
      }

      .action-buttons-grid {
        grid-template-columns: 1fr;
      }

      .team-card {
        padding: var(--space-4);
      }
    }

    @media (max-width: 480px) {
      .session-icon {
        font-size: var(--text-3xl);
        padding: var(--space-3);
      }

      .session-title {
        font-size: var(--text-2xl);
      }

      .result-card {
        padding: var(--space-4);
      }

      .result-icon {
        font-size: var(--text-3xl);
      }

      .result-value {
        font-size: var(--text-2xl);
      }

      .vote-distribution,
      .individual-votes {
        padding: var(--space-4);
      }
    }
  `
})
export class ResultsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Computed signals from socket service
  readonly currentRoom = computed(() => this.socketService.currentRoom());
  readonly currentUser = computed(() => this.socketService.currentUser());
  readonly currentVotes = computed(() => this.socketService.currentVotes());
  readonly votingResults = computed(() => this.socketService.votingResults());
  readonly participants = computed(() => this.currentRoom()?.participants || []);
  readonly currentStory = computed(() => this.currentRoom()?.currentStory);

  // Computed data
  readonly sortedVotes = computed(() => {
    const votes = this.votingResults()?.votes || [];
    return [...votes].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  });

  constructor(
    public socketService: SocketService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (!this.currentRoom()) {
      this.router.navigate(['/lobby']);
      return;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Tracking functions
  trackParticipant(index: number, participant: User): string {
    return participant.id;
  }

  trackVote(index: number, vote: Vote): string {
    return `${vote.userId}-${vote.timestamp}`;
  }

  trackVoteGroup(index: number, group: any): string {
    return group.value;
  }

  // Helper functions
  formatNumber(value: number | undefined): string {
    if (value === undefined || value === null) return 'N/A';
    return value % 1 === 0 ? value.toString() : value.toFixed(1);
  }

  formatVoteTime(timestamp: Date): string {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  getVoterInitial(name: string): string {
    return name.charAt(0).toUpperCase();
  }

  hasVoted(participantId: string): boolean {
    return this.sortedVotes().some(vote => vote.userId === participantId);
  }

  getVoterCount(): number {
    return this.participants().filter(p => p.role === 'player').length;
  }

  getVoteDistribution(): any[] {
    const votes = this.votingResults()?.votes || [];
    const distribution = new Map<string, any>();

    votes.forEach((vote: Vote) => {
      if (distribution.has(vote.value)) {
        const group = distribution.get(vote.value)!;
        group.count++;
        group.voters.push(vote.userName);
      } else {
        distribution.set(vote.value, {
          value: vote.value,
          count: 1,
          voters: [vote.userName],
          percentage: 0,
          isPopular: false
        });
      }
    });

    const totalVotes = votes.length;
    const groups = Array.from(distribution.values());
    
    // Calculate percentages
    groups.forEach(group => {
      group.percentage = Math.round((group.count / totalVotes) * 100);
    });

    // Mark most popular vote(s)
    const maxCount = Math.max(...groups.map(g => g.count));
    groups.forEach(group => {
      group.isPopular = group.count === maxCount && maxCount > 1;
    });

    // Sort by count (descending) then by value
    return groups.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      
      // Try to sort numerically if both are numbers
      const aNum = parseFloat(a.value);
      const bNum = parseFloat(b.value);
      if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
      
      // Fallback to string comparison
      return a.value.localeCompare(b.value);
    });
  }

  // Navigation functions
  goToLobby(): void {
    this.router.navigate(['/lobby']);
  }

  goToVoting(): void {
    this.router.navigate(['/voting']);
  }

  // Export functionality
  exportResults(): void {
    const results = this.votingResults();
    const story = this.currentStory();
    const room = this.currentRoom();
    
    if (!results || !room) return;

    const exportData = {
      sessionInfo: {
        roomName: room.name,
        roomCode: room.code,
        date: new Date().toISOString(),
        story: story ? {
          title: story.title,
          description: story.description
        } : null
      },
      results: {
        consensus: results.consensus,
        average: results.average,
        median: results.median,
        totalVotes: results.votes.length
      },
      votes: results.votes.map((vote: Vote) => ({
        voter: vote.userName,
        value: vote.value,
        timestamp: vote.timestamp
      })),
      voteDistribution: this.getVoteDistribution(),
      participants: this.participants().map(p => ({
        name: p.name,
        role: p.role,
        voted: this.hasVoted(p.id)
      }))
    };

    // Create and download JSON file
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `pokersync-results-${room.code}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}