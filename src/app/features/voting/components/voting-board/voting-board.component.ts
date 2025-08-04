import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { SocketService } from '../../../../core/services/socket.service';
import { VotingService } from '../../../../core/services/voting.service';
import { Room, User, Vote, VotingResults } from '../../../../shared/models';
import { ViewportLayoutComponent } from '../../../../core/components/viewport-layout/viewport-layout.component';

@Component({
  selector: 'app-voting-board',
  standalone: true,
  imports: [CommonModule, FormsModule, ViewportLayoutComponent],
  template: `
    <app-viewport-layout layoutClass="split-vertical">
      <!-- Header Section -->
      <header class="voting-header">
        <div class="glass-card glass-card-header">
          <div class="header-content">
            <div class="room-info">
              <div class="room-badge glass-hover animate-scale-in">
                <span class="room-icon animate-float">🏠</span>
                <div class="room-details">
                  <h1 class="room-name gradient-text">{{ currentRoom()?.name || 'Planning Session' }}</h1>
                </div>
              </div>
              <div class="voting-status">
                <div class="status-indicator glass-subtle" [class.voting]="votingPhase() === 'voting'" [class.revealed]="votingPhase() === 'revealed'">
                  <span class="status-dot" [class.active]="votingPhase() === 'voting'"></span>
                  <span class="status-text">{{ getPhaseDisplay() }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <!-- Main Voting Area -->
      <main class="voting-main">
        <div class="voting-layout">
          
          <!-- Participants Panel -->
          <aside class="participants-panel animate-slide-in">
            <div class="glass-card participants-card">
              <div class="participants-header">
                <h3 class="participants-title gradient-text">
                  Team <span class="participants-count">({{ participants().length }})</span>
                </h3>
                <div class="votes-progress">
                  <span class="votes-count">{{ getVotedCount() }}/{{ getVotersCount() }} voted</span>
                  <div class="progress-bar glass-subtle">
                    <div class="progress-fill" [style.width.%]="getVotingProgress()"></div>
                  </div>
                </div>
              </div>
              
              <div class="participants-list">
                <div *ngFor="let participant of participants(); trackBy: trackParticipant" 
                     class="participant-card glass-card-hover animate-slide-in interactive-element"
                     [class.moderator]="participant.role === 'moderator'"
                     [class.voted]="hasVoted(participant.id)"
                     [class.current-user]="participant.id === currentUser()?.id">
                  
                  <div class="participant-avatar" 
                       [class.moderator]="participant.role === 'moderator'"
                       [class.voted]="hasVoted(participant.id)"
                       [class.animate-glow]="hasVoted(participant.id)">
                    {{ participant.name.charAt(0).toUpperCase() }}
                  </div>
                  
                  <div class="participant-info">
                    <div class="participant-name-row">
                      <p class="participant-name">{{ participant.name }}</p>
                      <span *ngIf="participant.id === currentUser()?.id" class="you-badge animate-bounce">You</span>
                    </div>
                    <div class="participant-status">
                      <div class="status-dot" [class.online]="participant.isConnected"></div>
                      <span class="status-text">{{ participant.role }}</span>
                      <span *ngIf="participant.role === 'moderator'" class="crown-icon animate-float">👑</span>
                    </div>
                  </div>

                  <div class="vote-status">
                    <div *ngIf="participant.role !== 'observer'" class="vote-indicator">
                      <span *ngIf="hasVoted(participant.id) && votingPhase() === 'voting'" class="voted-icon animate-scale-in">✅</span>
                      <span *ngIf="!hasVoted(participant.id) && votingPhase() === 'voting'" class="thinking-icon animate-pulse">🤔</span>
                      <span *ngIf="votingPhase() === 'revealed' && getParticipantVote(participant.id)" 
                            class="vote-value glass-subtle animate-flip">{{ getParticipantVote(participant.id) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <!-- Voting Cards Section -->
          <section class="voting-section">
            <div *ngIf="canVote()" class="voting-cards-container">
              <h3 class="voting-title gradient-text animate-fade-in">Select Your Estimate</h3>
              <div class="poker-cards-grid">
                <button *ngFor="let card of pokerDeck(); trackBy: trackCard; let i = index"
                        class="poker-card animate-scale-in interactive-element gpu-accelerated"
                        [class.selected]="selectedCard() === card"
                        [class.disabled]="votingPhase() !== 'voting'"
                        [style.animation-delay.ms]="i * 50"
                        (click)="selectCard(card)">
                  <span class="card-value">{{ card }}</span>
                  <div class="card-decoration">
                    <span class="card-suit top-left">{{ card }}</span>
                    <span class="card-suit bottom-right">{{ card }}</span>
                  </div>
                </button>
              </div>
              
              <div class="voting-actions">
                <button *ngIf="selectedCard() && !hasSubmittedVote()"
                        class="glass-btn glass-btn-success glass-btn-lg submit-vote-btn interactive-element hover-lift animate-glow"
                        (click)="submitVote()"
                        [disabled]="isSubmittingVote()">
                  <span *ngIf="isSubmittingVote()" class="loading-spinner">⏳</span>
                  {{ isSubmittingVote() ? 'Submitting...' : '🗳️ Submit Vote' }}
                </button>
                
                <button *ngIf="hasSubmittedVote() && votingPhase() === 'voting'"
                        class="glass-btn glass-btn-ghost glass-btn-lg interactive-element"
                        (click)="changeVote()">
                  🔄 Change Vote
                </button>
              </div>

              <div *ngIf="hasSubmittedVote() && votingPhase() === 'voting'" 
                   class="vote-submitted-message glass-alert glass-alert-success animate-bounce">
                <span>✅ Your vote has been submitted!</span>
              </div>
            </div>

            <!-- Observer Message -->
            <div *ngIf="!canVote()" class="observer-section">
              <div class="observer-card glass-card glass-hover">
                <div class="observer-icon animate-float">👀</div>
                <h3 class="observer-title gradient-text">Observer Mode</h3>
                <p class="observer-description">You're watching this session as an observer</p>
              </div>
            </div>

            <!-- Moderator Controls -->
            <div *ngIf="isCurrentUserModerator()" class="moderator-controls animate-fade-in">
              <div class="controls-card glass-card">
                <h4 class="controls-title gradient-text">Moderator Controls</h4>
                <div class="controls-actions">
                  <button *ngIf="votingPhase() === 'voting' && getVotedCount() > 0"
                          class="glass-btn glass-btn-warning interactive-element hover-lift"
                          (click)="revealVotes()">
                    👁️ Reveal Votes
                  </button>
                  
                  <button *ngIf="votingPhase() === 'revealed'"
                          class="glass-btn glass-btn-primary interactive-element hover-lift"
                          (click)="startNewRound()">
                    🔄 New Round
                  </button>
                  
                  <button class="glass-btn glass-btn-ghost interactive-element"
                          (click)="goToResults()">
                    📊 View Results
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

      </main>


      <!-- Navigation -->
      <nav class="voting-nav glass-subtle">
        <div class="nav-content">
          <div class="nav-actions">
            <button *ngIf="isCurrentUserModerator()" 
                    class="glass-btn glass-btn-ghost interactive-element" 
                    (click)="endSession()">
              🚪 End Session
            </button>
            <button class="glass-btn glass-btn-danger interactive-element" (click)="leaveRoom()">
              🚪 Leave Room
            </button>
          </div>
        </div>
      </nav>
      
      <!-- Error Alert -->
      <div *ngIf="error()" class="glass-alert glass-alert-error error-toast animate-bounce">
        <span>{{ error() }}</span>
        <button (click)="clearError()" class="error-close interactive-element">×</button>
      </div>

      <!-- Results Modal -->
      <div *ngIf="votingPhase() === 'revealed' && showResultsModal()" 
           class="modal-backdrop" 
           (click)="closeResultsModal($event)">
        <div class="modal-content results-modal glass-card animate-scale-in" (click)="$event.stopPropagation()">
          <button class="modal-close glass-btn-ghost" (click)="closeResultsModal($event)">×</button>
          
          <!-- Simple Average Display -->
          <div class="simple-result-display">
            <div class="average-number animate-number-in">{{ getCalculatedAverage() }}</div>
            <div class="voter-count animate-fade-in">{{ getVotedCount() }} {{ getVotedCount() === 1 ? 'voter' : 'voters' }}</div>
          </div>
        </div>
      </div>

      <!-- User Joined Toast -->
      <div *ngIf="userJoinedNotification()" class="user-joined-toast glass-card animate-slide-in">
        <span class="user-joined-icon">👋</span>
        <span class="user-joined-text">{{ userJoinedNotification() }} joined the room</span>
      </div>
    </app-viewport-layout>
  `,
  styles: `
    /* Header Section */
    .voting-header {
      position: sticky;
      top: 0;
      z-index: var(--z-40);
      padding: var(--space-6);
    }

    .header-content {
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
    }

    .room-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--space-4);
    }

    .room-badge {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-4);
      border-radius: var(--radius-xl);
    }

    .room-icon {
      font-size: var(--text-2xl);
    }

    .room-details h1 {
      font-size: var(--text-xl);
      font-weight: var(--font-bold);
      margin: 0;
    }

    .room-code {
      font-size: var(--text-sm);
      color: var(--gray-600);
      font-family: 'JetBrains Mono', monospace;
      margin: 0;
    }

    .voting-status {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .status-indicator {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-full);
      transition: all var(--transition-smooth);
    }

    .status-indicator.voting {
      background: var(--warning-glass);
      border-color: var(--warning-glass-border);
    }

    .status-indicator.revealed {
      background: var(--success-glass);
      border-color: var(--success-glass-border);
    }

    .status-dot {
      width: 0.5rem;
      height: 0.5rem;
      border-radius: var(--radius-full);
      background: var(--gray-400);
      transition: all var(--transition);
    }

    .status-dot.active {
      background: var(--warning-500);
      animation: pulse 2s infinite;
    }

    .status-text {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--gray-700);
      text-transform: capitalize;
    }

    /* Voting Title Section */
    .voting-title-section {
      width: 100%;
    }

    .voting-title-card {
      padding: var(--space-6);
      border-radius: var(--radius-2xl);
      text-align: center;
    }

    .voting-title-content {
      max-width: 600px;
      margin: 0 auto;
    }

    .voting-main-title {
      font-size: var(--text-3xl);
      font-weight: var(--font-bold);
      margin: 0 0 var(--space-3) 0;
      letter-spacing: -0.02em;
    }

    .voting-subtitle {
      font-size: var(--text-lg);
      color: var(--gray-600);
      font-weight: var(--font-medium);
      margin: 0;
      opacity: 0.9;
    }

    /* Main Voting Layout */
    .voting-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: var(--space-6);
      padding-top: 0;
      overflow-y: auto;
    }

    .voting-layout {
      display: grid;
      grid-template-columns: 320px 1fr;
      gap: var(--space-6);
      width: 100%;
      max-width: 1400px;
      margin: 0 auto;
      align-items: start;
    }

    /* Participants Panel */
    .participants-panel {
      position: sticky;
      top: var(--space-6);
    }

    .participants-card {
      height: fit-content;
      max-height: calc(100vh - 200px);
      display: flex;
      flex-direction: column;
      border-radius: var(--radius-2xl);
    }

    .participants-header {
      padding: var(--space-4);
      border-bottom: 1px solid var(--glass-border);
      background: var(--glass-bg-light);
    }

    .participants-title {
      font-size: var(--text-lg);
      font-weight: var(--font-semibold);
      margin-bottom: var(--space-3);
    }

    .participants-count {
      font-size: var(--text-sm);
      font-weight: var(--font-normal);
      color: var(--gray-500);
    }

    .votes-progress {
      margin-top: var(--space-2);
    }

    .votes-count {
      font-size: var(--text-sm);
      color: var(--gray-600);
      display: block;
      margin-bottom: var(--space-2);
    }

    .progress-bar {
      width: 100%;
      height: 6px;
      border-radius: var(--radius-full);
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: var(--gradient-primary);
      transition: width var(--transition-smooth);
      border-radius: var(--radius-full);
    }

    .participants-list {
      padding: var(--space-4);
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      overflow-y: auto;
      flex: 1;
    }

    .participant-card {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3);
      border-radius: var(--radius-lg);
      transition: all var(--transition-smooth);
      position: relative;
    }

    .participant-card.current-user {
      background: var(--primary-glass);
      border: 1px solid var(--primary-glass-border);
    }

    .participant-card.voted {
      background: var(--success-glass);
      border: 1px solid var(--success-glass-border);
    }

    .participant-card.moderator {
      background: var(--warning-glass);
      border: 1px solid var(--warning-glass-border);
    }

    .participant-avatar {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: var(--radius-full);
      background: var(--gradient-primary);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: var(--font-semibold);
      font-size: var(--text-sm);
      transition: all var(--transition-smooth);
    }

    .participant-avatar.moderator {
      background: var(--gradient-warning);
    }

    .participant-avatar.voted {
      background: var(--gradient-success);
    }

    .participant-info {
      flex: 1;
      min-width: 0;
    }

    .participant-name-row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-bottom: var(--space-1);
    }

    .participant-name {
      font-weight: var(--font-medium);
      color: var(--gray-800);
      font-size: var(--text-sm);
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .you-badge {
      background: var(--primary-glass);
      color: var(--primary-700);
      font-size: var(--text-xs);
      font-weight: var(--font-medium);
      padding: var(--space-1) var(--space-2);
      border-radius: var(--radius-sm);
      border: 1px solid var(--primary-glass-border);
    }

    .participant-status {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .crown-icon {
      font-size: var(--text-xs);
    }

    .vote-status {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 2rem;
    }

    .vote-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .voted-icon,
    .thinking-icon {
      font-size: var(--text-lg);
    }

    .vote-value {
      font-weight: var(--font-bold);
      color: var(--gray-800);
      font-size: var(--text-lg);
      padding: var(--space-1) var(--space-3);
      border-radius: var(--radius);
      font-family: 'JetBrains Mono', monospace;
    }

    @keyframes flip {
      from {
        transform: rotateY(180deg);
      }
      to {
        transform: rotateY(0);
      }
    }

    .animate-flip {
      animation: flip 0.6s ease-out;
    }

    /* Voting Section */
    .voting-section {
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
    }

    .voting-cards-container {
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
    }

    .voting-title {
      font-size: var(--text-xl);
      font-weight: var(--font-semibold);
      text-align: center;
      margin: 0;
    }

    .poker-cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(5rem, 1fr));
      gap: var(--space-4);
      justify-items: center;
      padding: var(--space-6);
      background: var(--glass-bg-subtle);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-2xl);
      backdrop-filter: blur(var(--blur-xl));
    }

    .poker-card {
      position: relative;
      overflow: hidden;
    }

    .card-value {
      position: relative;
      z-index: 1;
      font-size: var(--text-2xl);
      font-weight: var(--font-bold);
    }

    .card-decoration {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }

    .card-suit {
      position: absolute;
      font-size: var(--text-sm);
      opacity: 0.3;
    }

    .card-suit.top-left {
      top: var(--space-2);
      left: var(--space-2);
    }

    .card-suit.bottom-right {
      bottom: var(--space-2);
      right: var(--space-2);
      transform: rotate(180deg);
    }

    .voting-actions {
      display: flex;
      justify-content: center;
      gap: var(--space-4);
    }

    .submit-vote-btn {
      min-width: 200px;
    }

    .vote-submitted-message {
      text-align: center;
      font-size: var(--text-sm);
    }

    /* Observer Section */
    .observer-section {
      display: flex;
      justify-content: center;
    }

    .observer-card {
      text-align: center;
      padding: var(--space-8);
      max-width: 24rem;
      border-radius: var(--radius-2xl);
    }

    .observer-icon {
      font-size: var(--text-5xl);
      margin-bottom: var(--space-4);
      display: block;
    }

    .observer-title {
      font-size: var(--text-xl);
      font-weight: var(--font-semibold);
      margin-bottom: var(--space-2);
    }

    .observer-description {
      color: var(--gray-600);
    }

    /* Moderator Controls */
    .moderator-controls {
      position: sticky;
      bottom: 0;
      margin-top: var(--space-6);
    }

    .controls-card {
      padding: var(--space-4);
      border-radius: var(--radius-xl);
      background: var(--glass-bg-light);
    }

    .controls-title {
      font-size: var(--text-lg);
      font-weight: var(--font-medium);
      margin-bottom: var(--space-4);
    }

    .controls-actions {
      display: flex;
      gap: var(--space-3);
      justify-content: center;
      flex-wrap: wrap;
    }

    /* Results Section */
    .results-section {
      margin-top: var(--space-6);
    }

    .results-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-6);
    }


    /* Results Stats */
    .results-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: var(--space-4);
      max-width: 600px;
      width: 100%;
    }

    .stat-card {
      text-align: center;
      padding: var(--space-4);
      border-radius: var(--radius-xl);
      animation-delay: var(--delay);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2);
    }

    .stat-icon {
      font-size: var(--text-2xl);
    }

    .stat-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-1);
    }

    .stat-value {
      font-size: var(--text-xl);
      font-weight: var(--font-bold);
      font-family: 'JetBrains Mono', monospace;
      color: var(--primary-600);
    }

    .stat-label {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--gray-600);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }


    /* Navigation */
    .voting-nav {
      position: sticky;
      bottom: 0;
      backdrop-filter: blur(var(--blur-xl));
      border-top: 1px solid var(--glass-border);
      padding: var(--space-4);
      margin-top: var(--space-6);
    }

    .nav-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      max-width: 1400px;
      margin: 0 auto;
    }

    .nav-actions {
      display: flex;
      gap: var(--space-3);
    }

    /* Error Toast */
    .error-toast {
      position: fixed;
      top: var(--space-6);
      right: var(--space-6);
      z-index: var(--z-50);
      min-width: 300px;
    }

    .error-close {
      background: none;
      border: none;
      color: var(--danger-600);
      font-size: var(--text-xl);
      cursor: pointer;
      padding: var(--space-1);
      border-radius: var(--radius);
      transition: all var(--transition);
    }

    .error-close:hover {
      background: rgba(220, 38, 38, 0.1);
    }

    .loading-spinner {
      display: inline-block;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Modal Styles */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(var(--blur-md));
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: var(--z-50);
      padding: var(--space-4);
      animation: fadeIn 0.3s ease-out;
    }

    .results-modal {
      max-width: 400px;
      width: 90%;
      padding: var(--space-12) var(--space-8);
      border-radius: var(--radius-3xl);
      box-shadow: var(--glass-shadow-xl), 0 0 100px rgba(14, 165, 233, 0.3);
      position: relative;
      text-align: center;
      background: var(--gradient-primary);
      color: white;
      overflow: hidden;
    }

    .results-modal::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: linear-gradient(45deg, transparent, rgba(255,255,255,0.1), transparent);
      animation: shimmer 3s infinite;
    }

    .modal-close {
      position: absolute;
      top: var(--space-4);
      right: var(--space-4);
      width: 2.5rem;
      height: 2.5rem;
      border-radius: var(--radius-full);
      font-size: var(--text-xl);
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: white;
      cursor: pointer;
      transition: all var(--transition);
      z-index: 1;
    }

    .modal-close:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: rotate(90deg);
    }

    .simple-result-display {
      position: relative;
      z-index: 1;
    }

    .average-number {
      font-size: 8rem;
      font-weight: var(--font-black);
      font-family: 'JetBrains Mono', monospace;
      line-height: 1;
      margin-bottom: var(--space-4);
      text-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      letter-spacing: -0.02em;
    }

    .voter-count {
      font-size: var(--text-xl);
      font-weight: var(--font-medium);
      opacity: 0.95;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    @keyframes numberIn {
      0% {
        transform: scale(0) rotate(180deg);
        opacity: 0;
      }
      50% {
        transform: scale(1.2) rotate(90deg);
      }
      100% {
        transform: scale(1) rotate(0deg);
        opacity: 1;
      }
    }

    .animate-number-in {
      animation: numberIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    /* User Joined Toast */
    .user-joined-toast {
      position: fixed;
      bottom: var(--space-6);
      right: var(--space-6);
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-xl);
      display: flex;
      align-items: center;
      gap: var(--space-3);
      background: var(--success-glass);
      border: 1px solid var(--success-glass-border);
      box-shadow: var(--glass-shadow-lg);
      z-index: var(--z-50);
      animation: slideInRight 0.3s ease-out;
    }

    .user-joined-icon {
      font-size: var(--text-xl);
    }

    .user-joined-text {
      font-weight: var(--font-medium);
      color: var(--gray-800);
    }

    @keyframes slideInRight {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    /* Responsive Design */
    @media (max-width: 1024px) {
      .voting-layout {
        grid-template-columns: 1fr;
        gap: var(--space-4);
      }

      .participants-panel {
        position: static;
        order: -1;
      }

      .participants-card {
        max-height: 300px;
      }

      .participants-list {
        max-height: 200px;
      }
    }

    @media (max-width: 768px) {
      .voting-header {
        padding: var(--space-4);
      }

      .voting-main {
        padding: var(--space-4);
      }

      .header-content {
        gap: var(--space-4);
      }

      .room-info {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--space-3);
      }

      .poker-cards-grid {
        grid-template-columns: repeat(auto-fit, minmax(4rem, 1fr));
        gap: var(--space-3);
        padding: var(--space-4);
      }

      .results-cards {
        grid-template-columns: 1fr;
        gap: var(--space-3);
      }

      .nav-content {
        flex-direction: column;
        gap: var(--space-3);
      }

      .nav-actions {
        width: 100%;
        justify-content: center;
      }

      .controls-actions {
        flex-direction: column;
      }

      .results-stats {
        grid-template-columns: 1fr;
        gap: var(--space-3);
      }

      .average-number {
        font-size: var(--text-6xl);
      }

      .voter-count {
        font-size: var(--text-lg);
      }

      .results-modal {
        padding: var(--space-8) var(--space-6);
      }
    }

    @media (max-width: 480px) {
      .poker-cards-grid {
        grid-template-columns: repeat(4, 1fr);
      }

      .participants-list {
        padding: var(--space-3);
      }

      .participant-card {
        padding: var(--space-2);
      }

      .participant-avatar {
        width: 2rem;
        height: 2rem;
        font-size: var(--text-xs);
      }
    }
  `
})
export class VotingBoardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // State signals
  private readonly _selectedCard = signal<string | null>(null);
  private readonly _hasSubmittedVote = signal(false);
  private readonly _isSubmittingVote = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _showResultsModal = signal(false);
  private readonly _userJoinedNotification = signal<string | null>(null);

  // Computed signals
  readonly selectedCard = computed(() => this._selectedCard());
  readonly hasSubmittedVote = computed(() => this._hasSubmittedVote());
  readonly isSubmittingVote = computed(() => this._isSubmittingVote());
  readonly error = computed(() => this._error());
  readonly showResultsModal = computed(() => this._showResultsModal());
  readonly userJoinedNotification = computed(() => this._userJoinedNotification());

  // Socket service computed signals
  readonly currentRoom = computed(() => this.socketService.currentRoom());
  readonly currentUser = computed(() => this.socketService.currentUser());
  readonly currentVotes = computed(() => this.socketService.currentVotes());
  readonly votingResults = computed(() => this.socketService.votingResults());
  readonly participants = computed(() => this.currentRoom()?.participants || []);
  readonly votingPhase = computed(() => this.currentRoom()?.votingPhase || 'waiting');

  // Computed logic
  readonly isCurrentUserModerator = computed(() => 
    this.currentUser()?.role === 'moderator'
  );

  readonly canVote = computed(() => 
    this.currentUser()?.role === 'player'
  );

  readonly pokerDeck = computed(() => 
    this.currentRoom()?.deck?.cards || ['0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89', '?', '☕']
  );

  constructor(
    public socketService: SocketService,
    private votingService: VotingService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (!this.currentRoom()) {
      this.router.navigate(['/lobby']);
      return;
    }

    this.setupSubscriptions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSubscriptions(): void {
    this.socketService.onError()
      .pipe(takeUntil(this.destroy$))
      .subscribe(error => {
        this._error.set(error);
        this._isSubmittingVote.set(false);
      });

    this.socketService.onVotingStarted()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this._hasSubmittedVote.set(false);
        this._selectedCard.set(null);
      });

    // Listen for user joined events
    this.socketService.onUserJoined()
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this._userJoinedNotification.set(user.name);
        // Auto-hide after 3 seconds
        setTimeout(() => {
          this._userJoinedNotification.set(null);
        }, 3000);
      });

    // Show modal when votes are revealed
    this.socketService.onVotesRevealed()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this._showResultsModal.set(true);
      });
  }

  // Tracking functions
  trackParticipant(index: number, participant: User): string {
    return participant.id;
  }

  trackCard(index: number, card: string): string {
    return card;
  }

  // Card helpers  
  getCardSuit(index: number): string {
    // Return Fibonacci numbers for card decorations
    const fibonacci = ['0', '1', '1', '2', '3', '5', '8', '13'];
    return fibonacci[index % fibonacci.length];
  }

  // Voting logic
  selectCard(card: string): void {
    if (this.votingPhase() !== 'voting') return;
    this._selectedCard.set(card);
  }

  submitVote(): void {
    const card = this.selectedCard();
    if (!card) return;

    this._isSubmittingVote.set(true);
    this.socketService.submitVote(card, 'simple-voting');
    this._hasSubmittedVote.set(true);
    this._isSubmittingVote.set(false);
  }

  changeVote(): void {
    this._hasSubmittedVote.set(false);
    this._selectedCard.set(null);
  }

  revealVotes(): void {
    this.socketService.revealVotes();
  }

  startNewRound(): void {
    this._hasSubmittedVote.set(false);
    this._selectedCard.set(null);
    // Trigger new voting round (moderator action)
    const room = this.currentRoom();
    if (room) {
      room.votingPhase = 'voting' as any;
      this.socketService.emitVotingStarted(room.id);
    }
  }

  // Participant logic
  hasVoted(participantId: string): boolean {
    return this.currentVotes().some(vote => vote.userId === participantId);
  }

  getParticipantVote(participantId: string): string | null {
    const vote = this.currentVotes().find(v => v.userId === participantId);
    return vote?.value || null;
  }

  getVotedCount(): number {
    return this.currentVotes().length;
  }

  getVotersCount(): number {
    return this.participants().filter(p => p.role === 'player').length;
  }

  getVotingProgress(): number {
    const voters = this.getVotersCount();
    const voted = this.getVotedCount();
    return voters > 0 ? (voted / voters) * 100 : 0;
  }

  getPhaseDisplay(): string {
    switch (this.votingPhase()) {
      case 'voting': return 'Voting in Progress';
      case 'revealed': return 'Votes Revealed';
      default: return 'Waiting to Start';
    }
  }

  // Result calculations
  getCalculatedAverage(): number {
    // First check if we have voting results from backend
    const results = this.votingResults();
    if (results && results.average !== undefined) {
      return results.average;
    }
    
    // Fallback to calculating from votes
    const votes = this.currentVotes().map(v => parseFloat(v.value)).filter(v => !isNaN(v));
    if (votes.length === 0) return 0;
    const sum = votes.reduce((a, b) => a + b, 0);
    return Math.round((sum / votes.length) * 10) / 10;
  }

  getCalculatedMedian(): number {
    const votes = this.currentVotes().map(v => parseFloat(v.value)).filter(v => !isNaN(v)).sort((a, b) => a - b);
    if (votes.length === 0) return 0;
    const mid = Math.floor(votes.length / 2);
    return votes.length % 2 === 0 ? (votes[mid - 1] + votes[mid]) / 2 : votes[mid];
  }

  getVoteSpread(): string {
    const votes = this.currentVotes().map(v => parseFloat(v.value)).filter(v => !isNaN(v));
    if (votes.length === 0) return '0';
    const min = Math.min(...votes);
    const max = Math.max(...votes);
    return `${min}-${max}`;
  }

  getResultMessage(): string {
    const average = this.getCalculatedAverage();
    const votes = this.currentVotes().map(v => parseFloat(v.value)).filter(v => !isNaN(v));
    
    if (votes.length === 0) return 'No votes submitted';
    
    const uniqueVotes = new Set(votes);
    if (uniqueVotes.size === 1) {
      return '🎯 Perfect consensus achieved!';
    } else if (uniqueVotes.size <= 2) {
      return '✨ Great alignment in the team';
    } else {
      return '🤔 Consider discussing the differences';
    }
  }

  // Navigation
  goToLobby(): void {
    this.router.navigate(['/lobby']);
  }

  goToResults(): void {
    this.router.navigate(['/results']);
  }

  endSession(): void {
    // End session and destroy room
    this.socketService.leaveRoom();
    this.router.navigate(['/lobby']);
  }

  leaveRoom(): void {
    this.socketService.leaveRoom();
    this.router.navigate(['/lobby']);
  }

  clearError(): void {
    this._error.set(null);
  }

  copyRoomCode(): void {
    const roomCode = this.currentRoom()?.code;
    if (roomCode) {
      navigator.clipboard.writeText(roomCode).then(() => {
        // Could add a toast notification here
        console.log('Room code copied to clipboard');
      }).catch(err => {
        console.error('Failed to copy room code:', err);
      });
    }
  }

  closeResultsModal(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this._showResultsModal.set(false);
  }
}