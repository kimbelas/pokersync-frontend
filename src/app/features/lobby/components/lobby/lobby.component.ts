import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { SocketService } from '../../../../core/services/socket.service';
import { RoomService } from '../../../../core/services/room.service';
import { Room, User } from '../../../../shared/models';
import { ViewportLayoutComponent } from '../../../../core/components/viewport-layout/viewport-layout.component';

@Component({
  selector: 'app-lobby',
  standalone: true,
  imports: [CommonModule, FormsModule, ViewportLayoutComponent],
  template: `
    <app-viewport-layout layoutClass="two-section">
      <!-- Connection Status (Top Right) -->
      <div class="connection-status glass-card" [class.connected]="socketService.isConnected()">
        <div class="connection-indicator">
          <div class="status-dot" [class.online]="socketService.isConnected()"></div>
          <span class="connection-text">{{
            socketService.isConnected() ? 'Connected' : 'Disconnected'
          }}</span>
        </div>
      </div>

      <!-- Hero Section (Left/Top) -->
      <section class="hero-section section-content">
        <div class="hero-wrapper">
          <div class="hero-content animate-fade-in">
            <div class="brand-logo animate-float">
              <div class="logo-icon glass-card interactive-element">
                <span class="logo-emoji">🎯</span>
              </div>
              <h1 class="brand-title gradient-text">PokerSync</h1>
            </div>
            <p class="brand-subtitle animate-slide-in">
              Streamlined Planning Poker for Agile Teams
            </p>

            <!-- Floating decorative elements -->
            <div class="floating-cards">
              <div class="floating-card glass-subtle animate-float" style="--delay: 0s">
                <span>0</span>
              </div>
              <div class="floating-card glass-subtle animate-float" style="--delay: 0.5s">
                <span>1</span>
              </div>
              <div class="floating-card glass-subtle animate-float" style="--delay: 1s">
                <span>1</span>
              </div>
              <div class="floating-card glass-subtle animate-float" style="--delay: 1.5s">
                <span>2</span>
              </div>
              <div class="floating-card glass-subtle animate-float" style="--delay: 2s">
                <span>3</span>
              </div>
              <div class="floating-card glass-subtle animate-float" style="--delay: 2.5s">
                <span>5</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Interactive Section (Right/Bottom) -->
      <section class="interactive-section section-content animate-fade-in">
        <div class="main-content">
          <!-- Room Info Card (when in room) -->
          <div *ngIf="currentRoom()" class="room-info-section animate-scale-in">
            <div class="room-info-card glass-card glass-hover">
              <div class="room-header">
                <div class="room-icon glass-subtle animate-pulse">
                  <span>🏠</span>
                </div>
                <div class="room-details">
                  <h2 class="room-name gradient-text">{{ currentRoom()?.name }}</h2>
                  <div class="room-code-display glass-subtle">
                    <span class="room-code">{{ currentRoom()?.code }}</span>
                    <button class="copy-code-btn" (click)="copyRoomCode()" title="Copy room code">
                      📋
                    </button>
                  </div>
                </div>
                <div class="room-status">
                  <div class="status-indicator online animate-glow">
                    <div class="status-dot online"></div>
                    <span class="status-text">Active</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Room Setup (when not in room) -->
          <div *ngIf="!currentRoom()" class="room-setup">
            <!-- Tab Navigation -->
            <div class="tab-navigation glass-card">
              <button
                type="button"
                [class.active]="activeTab() === 'join'"
                (click)="setActiveTab('join')"
                class="tab-button interactive-element"
              >
                <span class="tab-icon">🚪</span>
                <span class="tab-text">Join Room</span>
              </button>
              <button
                type="button"
                [class.active]="activeTab() === 'create'"
                (click)="setActiveTab('create')"
                class="tab-button interactive-element"
              >
                <span class="tab-icon">➕</span>
                <span class="tab-text">Create Room</span>
              </button>
            </div>

            <!-- Create Room Form -->
            <div *ngIf="activeTab() === 'create'" class="form-section animate-slide-in">
              <div class="form-card glass-card glass-hover">
                <div class="form-header">
                  <h3 class="form-title gradient-text">Create New Room</h3>
                  <p class="form-subtitle">Set up your planning poker session</p>
                </div>
                <form (ngSubmit)="createRoom()" #createForm="ngForm" class="form-content">
                  <div class="glass-form-group">
                    <label class="glass-form-label">Your Name</label>
                    <input
                      class="glass-form-input interactive-element"
                      [(ngModel)]="moderatorName"
                      name="moderatorName"
                      placeholder="e.g., Sarah Chen"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    [disabled]="!createForm.valid || isCreatingRoom()"
                    class="glass-btn glass-btn-primary glass-btn-lg w-full interactive-element hover-lift"
                  >
                    <span *ngIf="isCreatingRoom()" class="loading-spinner">⏳</span>
                    {{ isCreatingRoom() ? 'Creating Room...' : '🚀 Create Room' }}
                  </button>
                </form>
              </div>
            </div>

            <!-- Join Room Form -->
            <div *ngIf="activeTab() === 'join'" class="form-section animate-slide-in">
              <div class="form-card glass-card glass-hover">
                <div class="form-header">
                  <h3 class="form-title gradient-text">Join Existing Room</h3>
                  <p class="form-subtitle">Enter the room code to join the session</p>
                </div>
                <form (ngSubmit)="joinRoom()" #joinForm="ngForm" class="form-content">
                  <div class="glass-form-group">
                    <label class="glass-form-label">Room Code</label>
                    <input
                      class="glass-form-input room-code-input interactive-element"
                      [(ngModel)]="joinRoomCode"
                      name="roomCode"
                      placeholder="ABC123"
                      maxlength="6"
                      style="text-transform: uppercase"
                      required
                    />
                  </div>
                  <div class="glass-form-group">
                    <label class="glass-form-label">Your Name</label>
                    <input
                      class="glass-form-input interactive-element"
                      [(ngModel)]="playerName"
                      name="playerName"
                      placeholder="e.g., Alex Johnson"
                      required
                    />
                  </div>
                  <div class="glass-form-group">
                    <label class="glass-form-label">Role</label>
                    <select
                      class="glass-form-select interactive-element"
                      [(ngModel)]="selectedRole"
                      name="userRole"
                    >
                      <option value="player">🎯 Player - Participate in voting</option>
                      <option value="observer">👀 Observer - Watch only</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    [disabled]="!joinForm.valid || isJoiningRoom()"
                    class="glass-btn glass-btn-primary glass-btn-lg w-full interactive-element hover-lift"
                  >
                    <span *ngIf="isJoiningRoom()" class="loading-spinner">⏳</span>
                    {{ isJoiningRoom() ? 'Joining Room...' : '🚪 Join Room' }}
                  </button>
                </form>
              </div>
            </div>
          </div>

          <!-- Participants (when in room) -->
          <div *ngIf="currentRoom()" class="participants-section animate-fade-in">
            <div class="participants-card glass-card">
              <div class="participants-header">
                <h3 class="participants-title gradient-text">
                  Team Members <span class="participants-count">({{ participants().length }})</span>
                </h3>
                <div class="team-stats">
                  <div class="stat-item glass-subtle">
                    <span class="stat-icon">👥</span>
                    <span class="stat-value">{{ getPlayerCount() }}</span>
                    <span class="stat-label">Players</span>
                  </div>
                  <div class="stat-item glass-subtle">
                    <span class="stat-icon">👁️</span>
                    <span class="stat-value">{{ getObserverCount() }}</span>
                    <span class="stat-label">Observers</span>
                  </div>
                </div>
              </div>

              <div class="participants-list">
                <div
                  *ngFor="let participant of participants(); trackBy: trackParticipant"
                  class="participant-item glass-hover animate-slide-in interactive-element"
                  [class.moderator]="participant.role === 'moderator'"
                  [class.current-user]="participant.id === currentUser()?.id"
                >
                  <div
                    class="participant-avatar avatar-md"
                    [class.moderator]="participant.role === 'moderator'"
                    [class.animate-glow]="participant.id === currentUser()?.id"
                  >
                    {{ participant.name.charAt(0).toUpperCase() }}
                  </div>

                  <div class="participant-info">
                    <div class="participant-name-row">
                      <p class="participant-name">{{ participant.name }}</p>
                      <span
                        *ngIf="participant.id === currentUser()?.id"
                        class="you-badge badge-primary animate-bounce"
                        >You</span
                      >
                      <span
                        *ngIf="participant.role === 'moderator'"
                        class="moderator-badge badge-warning"
                      >
                        👑 Moderator
                      </span>
                    </div>
                    <div class="participant-status">
                      <div class="status-dot" [class.online]="participant.isConnected"></div>
                      <span class="status-text">
                        {{ participant.isConnected ? 'Online' : 'Offline' }} •
                        {{ participant.role }}
                      </span>
                    </div>
                  </div>

                  <div class="participant-actions">
                    <div class="role-icon animate-float">
                      <span *ngIf="participant.role === 'moderator'">👑</span>
                      <span *ngIf="participant.role === 'player'">🎯</span>
                      <span *ngIf="participant.role === 'observer'">👀</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Action Buttons -->
              <div class="action-buttons">
                <button
                  *ngIf="isCurrentUserModerator()"
                  [disabled]="!canStartVoting()"
                  (click)="startVoting()"
                  class="glass-btn glass-btn-success glass-btn-lg w-full interactive-element hover-lift animate-glow"
                >
                  🚀 Start Voting Session
                </button>

                <div class="button-group">
                  <button
                    (click)="leaveRoom()"
                    class="glass-btn glass-btn-danger interactive-element"
                  >
                    🚪 Leave Room
                  </button>
                </div>

                <div
                  *ngIf="isCurrentUserModerator() && !canStartVoting()"
                  class="help-message glass-alert glass-alert-warning"
                >
                  <span>Need at least 2 players to start voting session</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Error Alert -->
          <div *ngIf="error()" class="error-toast glass-alert glass-alert-error animate-bounce">
            <span>{{ error() }}</span>
            <button (click)="clearError()" class="error-close">×</button>
          </div>
        </div>

        <!-- User Joined Toast -->
        <div *ngIf="userJoinedNotification()" class="user-joined-toast glass-card animate-slide-in">
          <span class="user-joined-icon">👋</span>
          <span class="user-joined-text">{{ userJoinedNotification() }} joined the room</span>
        </div>
      </section>
    </app-viewport-layout>
  `,
  styles: `
    /* Container */
    .lobby-container {
      min-height: 100vh;
      background: var(--bg-gradient);
      padding: var(--space-6);
      position: relative;
      overflow-x: hidden;
      overflow-y: auto;
    }

    /* Prevent horizontal scroll on mobile */
    * {
      box-sizing: border-box;
    }

    .glass-card,
    .glass-card-hover,
    .form-card {
      max-width: 100%;
      overflow-wrap: break-word;
    }

    /* Section Content */
    .section-content {
      width: 100%;
      height: 100%;
    }

    @media (max-width: 768px) {
      .section-content {
        height: auto;
        min-height: auto;
      }
    }

    /* Hero Section */
    .hero-section {
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-gradient-mesh);
      position: relative;
      overflow: hidden;
    }

    .hero-wrapper {
      text-align: center;
      position: relative;
      z-index: 1;
    }

    .hero-content {
      max-width: 32rem;
      margin: 0 auto;
      padding: var(--space-8);
    }

    .brand-logo {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2);
      margin-bottom: var(--space-6);
      position: relative;
    }

    @media (min-width: 768px) {
      .brand-logo {
        flex-direction: row;
        gap: var(--space-4);
      }
    }

    .logo-icon {
      width: 5rem;
      height: 5rem;
      background: var(--gradient-primary);
      border-radius: var(--radius-2xl);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: var(--glass-shadow-xl);
      transform: rotate(-5deg);
      transition: all var(--transition-elastic);
      cursor: pointer;
    }

    .logo-icon:hover {
      transform: rotate(5deg) scale(1.1);
      box-shadow: var(--glass-shadow-xl), var(--glass-shadow-glow);
    }

    .logo-emoji {
      font-size: var(--text-3xl);
      font-weight: var(--font-bold);
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
    }

    .brand-title {
      font-size: var(--text-5xl);
      font-weight: var(--font-extrabold);
      margin: 0;
      letter-spacing: -0.02em;
    }

    .brand-subtitle {
      font-size: var(--text-xl);
      color: var(--gray-600);
      font-weight: var(--font-medium);
      margin: 0;
      opacity: 0.9;
    }

    /* Floating Cards */
    .floating-cards {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }

    .floating-card {
      position: absolute;
      padding: var(--space-3);
      border-radius: var(--radius-lg);
      font-size: var(--text-2xl);
      animation: float 3s ease-in-out infinite;
      animation-delay: var(--delay);
      opacity: 0.7;
    }

    .floating-card:nth-child(1) {
      top: 20%;
      left: 10%;
    }

    .floating-card:nth-child(2) {
      top: 60%;
      right: 15%;
    }

    .floating-card:nth-child(3) {
      bottom: 30%;
      left: 20%;
    }

    .floating-card:nth-child(4) {
      top: 40%;
      right: 10%;
    }

    /* Interactive Section */
    .interactive-section {
      background: var(--glass-bg-subtle);
      backdrop-filter: blur(var(--blur-xl));
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      min-height: 60vh;
      padding: var(--space-6);
    }

    @media (max-width: 768px) {
      .interactive-section {
        min-height: auto;
        align-items: flex-start;
        padding-top: var(--space-4);
      }
    }

    /* Main Content */
    .main-content {
      max-width: 32rem;
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
      padding: var(--space-6);
    }

    /* Room Info Section */
    .room-info-section {
      margin-bottom: var(--space-4);
    }

    .room-info-card {
      padding: var(--space-6);
      border-radius: var(--radius-2xl);
    }

    .room-header {
      display: flex;
      align-items: center;
      gap: var(--space-4);
    }

    .room-icon {
      font-size: var(--text-3xl);
      padding: var(--space-3);
      border-radius: var(--radius-xl);
      width: 4rem;
      height: 4rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .room-details {
      flex: 1;
    }

    .room-name {
      font-size: var(--text-2xl);
      font-weight: var(--font-bold);
      margin: 0 0 var(--space-2) 0;
    }

    .room-code-display {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-full);
    }

    .room-code {
      font-size: var(--text-lg);
      font-weight: var(--font-bold);
      letter-spacing: 0.05em;
      font-family: 'JetBrains Mono', monospace;
      color: var(--primary-600);
    }

    .copy-code-btn {
      background: none;
      border: none;
      padding: var(--space-1);
      font-size: var(--text-sm);
      cursor: pointer;
      opacity: 0.7;
      transition: all var(--transition);
      border-radius: var(--radius);
    }

    .copy-code-btn:hover {
      opacity: 1;
      transform: scale(1.1);
    }

    .room-status {
      display: flex;
      align-items: center;
    }

    .status-indicator {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      background: var(--success-glass);
      border: 1px solid var(--success-glass-border);
      border-radius: var(--radius-full);
    }

    .status-text {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--gray-700);
    }

    /* Room Setup */
    .room-setup {
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
    }

    /* Tab Navigation */
    .tab-navigation {
      padding: var(--space-1);
      display: flex;
      gap: var(--space-1);
      border-radius: var(--radius-xl);
    }

    .tab-button {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      padding: var(--space-4) var(--space-6);
      background: transparent;
      border: none;
      border-radius: var(--radius-lg);
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--gray-600);
      cursor: pointer;
      transition: all var(--transition-smooth);
      position: relative;
    }

    .tab-button.active {
      background: var(--glass-bg-light);
      color: var(--primary-600);
      box-shadow: var(--glass-shadow);
    }

    .tab-button.active::after {
      content: '';
      position: absolute;
      bottom: -1px;
      left: 50%;
      transform: translateX(-50%);
      width: 60%;
      height: 3px;
      background: var(--gradient-primary);
      border-radius: var(--radius-full);
    }

    .tab-button:hover:not(.active) {
      background: var(--glass-bg);
      color: var(--gray-700);
      transform: translateY(-2px);
    }

    .tab-icon {
      font-size: var(--text-lg);
    }

    .tab-text {
      font-weight: var(--font-medium);
    }

    /* Form Section */
    .form-section {
      width: 100%;
    }

    .form-card {
      overflow: hidden;
      border-radius: var(--radius-2xl);
    }

    .form-header {
      padding: var(--space-6);
      border-bottom: 1px solid var(--glass-border);
      text-align: center;
      background: var(--glass-bg-light);
    }

    .form-title {
      font-size: var(--text-xl);
      font-weight: var(--font-semibold);
      margin: 0 0 var(--space-2) 0;
    }

    .form-subtitle {
      font-size: var(--text-sm);
      color: var(--gray-600);
      margin: 0;
    }

    .form-content {
      padding: var(--space-6);
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
    }

    .room-code-input {
      text-align: center;
      font-size: var(--text-xl);
      font-family: 'JetBrains Mono', monospace;
      letter-spacing: 0.1em;
      font-weight: var(--font-bold);
    }

    /* Participants Section */
    .participants-section {
      width: 100%;
    }

    .participants-card {
      overflow: hidden;
      border-radius: var(--radius-2xl);
    }

    .participants-header {
      padding: var(--space-6);
      border-bottom: 1px solid var(--glass-border);
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: var(--space-4);
      background: var(--glass-bg-light);
    }

    .participants-title {
      font-size: var(--text-xl);
      font-weight: var(--font-semibold);
      margin: 0;
    }

    .participants-count {
      font-size: var(--text-base);
      font-weight: var(--font-normal);
      color: var(--gray-500);
    }

    .team-stats {
      display: flex;
      gap: var(--space-4);
    }

    .stat-item {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-lg);
    }

    .stat-icon {
      font-size: var(--text-lg);
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

    .participants-list {
      padding: var(--space-6);
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      max-height: 400px;
      overflow-y: auto;
    }

    .participant-item {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      padding: var(--space-4);
      border-radius: var(--radius-lg);
      transition: all var(--transition-smooth);
      position: relative;
    }

    .participant-item.current-user {
      background: var(--primary-glass);
      border: 1px solid var(--primary-glass-border);
    }

    .participant-item.moderator {
      background: var(--warning-glass);
      border: 1px solid var(--warning-glass-border);
    }

    .participant-avatar.moderator {
      background: var(--gradient-warning);
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
      flex-wrap: wrap;
    }

    .participant-name {
      font-weight: var(--font-medium);
      color: var(--gray-800);
      font-size: var(--text-base);
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .participant-status {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .participant-actions {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 2rem;
    }

    .role-icon {
      font-size: var(--text-lg);
      opacity: 0.7;
    }

    /* Action Buttons */
    .action-buttons {
      padding: var(--space-6);
      border-top: 1px solid var(--glass-border);
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      background: var(--glass-bg-light);
    }

    .button-group {
      display: flex;
      gap: var(--space-3);
      justify-content: center;
    }

    .help-message {
      text-align: center;
      font-size: var(--text-sm);
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

    /* Connection Status */
    .connection-status {
      position: fixed;
      top: var(--space-6);
      right: var(--space-6);
      z-index: var(--z-50);
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-full);
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      min-width: 140px;
      background: var(--danger-glass);
      border-color: var(--danger-glass-border);
      color: var(--danger-600);
      backdrop-filter: blur(var(--blur-md));
    }

    .connection-status.connected {
      background: var(--success-glass);
      border-color: var(--success-glass-border);
      color: var(--success-600);
    }

    .connection-indicator {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      justify-content: center;
    }

    .connection-text {
      font-weight: var(--font-medium);
    }

    .loading-spinner {
      display: inline-block;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Responsive Design */
    @media (max-width: 1024px) {
      .lobby-container {
        padding: var(--space-4);
      }

      .floating-cards {
        opacity: 0.3;
      }
    }

    @media (max-width: 768px) {
      .lobby-container {
        min-height: 100vh;
        padding: var(--space-3);
      }

      .hero-content {
        padding: var(--space-4);
        min-height: auto;
      }
      
      .brand-title {
        font-size: var(--text-3xl);
      }

      .brand-subtitle {
        font-size: var(--text-base);
      }

      .tabs-header {
        flex-direction: column;
        width: 100%;
      }

      .tab-button {
        width: 100%;
        justify-content: center;
      }
      
      .form-content,
      .participants-header,
      .participants-list,
      .action-buttons {
        padding: var(--space-4);
      }

      .form-section {
        min-height: auto;
      }

      .room-container {
        min-height: auto;
      }

      .room-header {
        flex-direction: column;
        text-align: center;
        gap: var(--space-3);
      }

      .room-info {
        flex-direction: column;
        align-items: center;
        text-align: center;
      }

      .room-code-display {
        margin-top: var(--space-2);
      }

      .team-stats {
        flex-direction: row;
        justify-content: center;
        flex-wrap: wrap;
        gap: var(--space-3);
      }

      .stat-item {
        min-width: 100px;
      }

      .participants-header {
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: var(--space-3);
      }

      .button-group {
        flex-direction: column;
        width: 100%;
      }

      .glass-btn {
        width: 100%;
      }

      .participant-card {
        padding: var(--space-3);
      }

      .floating-cards {
        display: none;
      }
    }

    @media (max-width: 480px) {
      .lobby-container {
        padding: var(--space-2);
      }

      /* Fix connection status on mobile */
      .connection-status {
        top: var(--space-2);
        right: var(--space-2);
        padding: var(--space-2) var(--space-3);
        font-size: var(--text-xs);
        min-width: auto;
      }

      /* Fix hero section on mobile */
      .hero-section {
        min-height: 35vh;
        padding: var(--space-3);
      }

      .hero-content {
        padding: var(--space-3);
      }

      .logo-icon {
        width: 3.5rem;
        height: 3.5rem;
        font-size: var(--text-2xl);
      }

      .brand-title {
        font-size: var(--text-2xl);
        margin-top: var(--space-2);
      }

      .brand-subtitle {
        font-size: var(--text-sm);
        text-align: center;
      }

      /* Fix interactive section on mobile */
      .interactive-section {
        padding: var(--space-3);
      }

      .main-content {
        padding: 0;
      }

      .room-setup {
        margin-top: var(--space-3);
      }

      .tab-navigation {
        padding: var(--space-1);
        gap: var(--space-1);
      }

      .tab-button {
        flex: 1;
        min-width: 120px;
        padding: var(--space-3) var(--space-2);
        font-size: var(--text-sm);
      }

      .tab-icon {
        font-size: var(--text-lg);
      }

      .tab-text {
        font-size: var(--text-sm);
      }

      .form-section {
        margin-top: var(--space-3);
      }

      .form-card {
        margin: 0;
      }

      .form-header,
      .form-content {
        padding: var(--space-3);
      }

      .form-title {
        font-size: var(--text-xl);
      }

      .form-subtitle {
        font-size: var(--text-sm);
      }

      .glass-form-label {
        font-size: var(--text-sm);
      }

      .glass-form-input {
        font-size: var(--text-base);
        padding: var(--space-3);
      }

      .room-code-input {
        font-size: var(--text-lg);
        letter-spacing: 0.1em;
      }

      .room-name {
        font-size: var(--text-xl);
      }

      .room-code-display {
        flex-direction: column;
        gap: var(--space-2);
        padding: var(--space-3);
      }

      .copy-code-btn {
        width: 100%;
        justify-content: center;
        padding: var(--space-2) var(--space-4);
      }

      .participant-info {
        min-width: 0;
        flex: 1;
      }

      .participant-name {
        font-size: var(--text-sm);
      }

      .participant-name-row {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--space-1);
      }

      .participant-role {
        font-size: var(--text-xs);
      }

      .action-buttons {
        padding: var(--space-3);
      }

      .glass-btn-lg {
        font-size: var(--text-base);
        padding: var(--space-3) var(--space-4);
      }
    }
  `,
})
export class LobbyComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Form data
  moderatorName = '';
  joinRoomCode = '';
  playerName = '';
  selectedRole = 'player';

  // Component state signals
  private readonly _activeTab = signal<'create' | 'join'>('join');
  private readonly _isCreatingRoom = signal(false);
  private readonly _isJoiningRoom = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _userJoinedNotification = signal<string | null>(null);

  // Computed signals
  readonly activeTab = computed(() => this._activeTab());
  readonly isCreatingRoom = computed(() => this._isCreatingRoom());
  readonly isJoiningRoom = computed(() => this._isJoiningRoom());
  readonly error = computed(() => this._error());
  readonly userJoinedNotification = computed(() => this._userJoinedNotification());
  readonly currentRoom = computed(() => this.socketService.currentRoom());
  readonly currentUser = computed(() => this.socketService.currentUser());
  readonly participants = computed(() => this.currentRoom()?.participants || []);

  readonly isCurrentUserModerator = computed(() => this.currentUser()?.role === 'moderator');

  readonly canStartVoting = computed(
    () => this.participants().filter((p) => p.role === 'player').length > 1
  );

  constructor(
    public socketService: SocketService,
    private roomService: RoomService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.socketService.connect();
    this.setupSubscriptions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSubscriptions(): void {
    this.socketService
      .onError()
      .pipe(takeUntil(this.destroy$))
      .subscribe((error) => {
        this._error.set(error);
        this._isCreatingRoom.set(false);
        this._isJoiningRoom.set(false);
      });

    // Listen for room joined event
    this.socketService
      .onRoomJoined()
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ room }) => {
        this._isCreatingRoom.set(false);
        this._isJoiningRoom.set(false);
        
        // If the room is already in voting phase, redirect to voting board
        if (room && room.votingPhase === 'voting') {
          setTimeout(() => {
            this.router.navigate(['/voting']);
          }, 100);
        }
      });

    this.socketService
      .onRoomUpdated()
      .pipe(takeUntil(this.destroy$))
      .subscribe((room) => {
        // If the room transitions to voting phase, redirect to voting board
        if (room && room.votingPhase === 'voting' && this.router.url === '/lobby') {
          this.router.navigate(['/voting']);
        }
      });

    // Listen for voting started events to redirect all members
    this.socketService
      .onVotingStarted()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        // Navigate to voting page when voting starts
        this.router.navigate(['/voting']);
      });

    // Listen for user joined events
    this.socketService
      .onUserJoined()
      .pipe(takeUntil(this.destroy$))
      .subscribe((user) => {
        // Don't show notification for the current user
        if (user.id !== this.currentUser()?.id) {
          this._userJoinedNotification.set(user.name);
          // Auto-hide after 3 seconds
          setTimeout(() => {
            this._userJoinedNotification.set(null);
          }, 3000);
        }
      });
  }

  setActiveTab(tab: 'create' | 'join'): void {
    this._activeTab.set(tab);
    this.clearError();
  }

  async createRoom(): Promise<void> {
    if (!this.moderatorName.trim()) return;

    this._isCreatingRoom.set(true);
    this._error.set(null);

    try {
      // Generate a room name automatically
      const roomName = `Sprint ${Math.floor(Math.random() * 100) + 1} Planning`;
      const room = await this.roomService.createRoom(roomName, this.moderatorName);
      this.socketService.joinRoom(room.code, this.moderatorName, 'moderator');
    } catch (error) {
      this._error.set('Failed to create room. Please try again.');
      this._isCreatingRoom.set(false);
    }
  }

  joinRoom(): void {
    if (!this.joinRoomCode.trim() || !this.playerName.trim()) return;

    this._isJoiningRoom.set(true);
    this._error.set(null);

    this.socketService.joinRoom(
      this.joinRoomCode.toUpperCase(),
      this.playerName,
      this.selectedRole
    );
  }

  startVoting(): void {
    // Start voting session without stories - just numbers
    const room = this.currentRoom();
    if (room) {
      // Update room to voting phase and emit to all participants
      room.votingPhase = 'voting' as any;
      this.socketService.emitVotingStarted(room.id);
    }

    // Navigate to voting page
    this.router.navigate(['/voting']);
  }

  leaveRoom(): void {
    this.socketService.leaveRoom();
    this.router.navigate(['/']);
  }

  clearError(): void {
    this._error.set(null);
  }

  // Tracking function
  trackParticipant(index: number, participant: User): string {
    return participant.id;
  }

  // Stats functions
  getPlayerCount(): number {
    return this.participants().filter((p) => p.role === 'player').length;
  }

  getObserverCount(): number {
    return this.participants().filter((p) => p.role === 'observer').length;
  }

  // Room actions
  copyRoomCode(): void {
    const roomCode = this.currentRoom()?.code;
    if (roomCode) {
      navigator.clipboard
        .writeText(roomCode)
        .then(() => {
          // Could add a toast notification here
          console.log('Room code copied to clipboard');
        })
        .catch((err) => {
          console.error('Failed to copy room code:', err);
        });
    }
  }
}
