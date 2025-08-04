import { Injectable, signal, computed } from '@angular/core';
import { Observable, fromEvent, BehaviorSubject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { SOCKET_EVENTS } from '../../shared/constants/socket-events';
import { Room, User, Vote, Story, VotingResults } from '../../shared/models';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket!: Socket;
  private mockMode = false; // Disable mock mode - use real backend
  
  // Connection state signals
  private readonly _isConnected = signal(false); // Start disconnected
  private readonly _connectionError = signal<string | null>(null);
  
  // Room state signals
  private readonly _currentRoom = signal<Room | null>(null);
  private readonly _currentUser = signal<User | null>(null);
  
  // Voting state signals
  private readonly _currentVotes = signal<Vote[]>([]);
  private readonly _votingResults = signal<any>(null);
  
  // Computed signals
  readonly isConnected = computed(() => this._isConnected());
  readonly connectionError = computed(() => this._connectionError());
  readonly currentRoom = computed(() => this._currentRoom());
  readonly currentUser = computed(() => this._currentUser());
  readonly currentVotes = computed(() => this._currentVotes());
  readonly votingResults = computed(() => this._votingResults());
  
  // Connection status observable
  readonly connectionStatus$ = new BehaviorSubject<'connecting' | 'connected' | 'disconnected'>('disconnected');

  constructor() {
    if (!this.mockMode) {
      this.initializeSocket();
      this.setupEventListeners();
      this.connect(); // Auto-connect on service initialization
    }
  }

  private initializeSocket(): void {
    this.socket = io(environment.socketUrl, {
      autoConnect: false,
      transports: ['websocket', 'polling']
    });
  }

  private setupEventListeners(): void {
    // Connection events
    this.socket.on(SOCKET_EVENTS.CONNECT, () => {
      this._isConnected.set(true);
      this._connectionError.set(null);
      this.connectionStatus$.next('connected');
    });

    this.socket.on(SOCKET_EVENTS.DISCONNECT, () => {
      this._isConnected.set(false);
      this.connectionStatus$.next('disconnected');
    });

    this.socket.on(SOCKET_EVENTS.ERROR, (error: string) => {
      this._connectionError.set(error);
    });

    // Room events
    this.socket.on(SOCKET_EVENTS.ROOM_JOINED, (data: { room: Room; user: User }) => {
      this._currentRoom.set(data.room);
      this._currentUser.set(data.user);
    });

    this.socket.on(SOCKET_EVENTS.ROOM_UPDATED, (room: Room) => {
      this._currentRoom.set(room);
    });

    // Voting events
    this.socket.on(SOCKET_EVENTS.VOTING_STARTED, (data: any) => {
      // Update current room with voting phase (simplified voting)
      const currentRoom = this._currentRoom();
      if (currentRoom) {
        // No story needed for simplified voting
        currentRoom.votingPhase = 'voting' as any;
        this._currentRoom.set({ ...currentRoom });
      }
    });

    this.socket.on(SOCKET_EVENTS.VOTE_SUBMITTED, (votes: Vote[]) => {
      this._currentVotes.set(votes);
    });

    this.socket.on(SOCKET_EVENTS.VOTES_REVEALED, (results: any) => {
      this._votingResults.set(results);
      // Update current votes with the revealed vote values
      if (results && results.votes) {
        this._currentVotes.set(results.votes);
      }
    });
  }

  // Connection methods
  connect(): void {
    if (this.mockMode) {
      // Mock mode - already connected
      return;
    }
    
    if (!this.socket.connected) {
      this.connectionStatus$.next('connecting');
      this.socket.connect();
    }
  }

  disconnect(): void {
    if (this.mockMode) {
      // Mock mode - do nothing
      return;
    }
    
    if (this.socket.connected) {
      this.socket.disconnect();
    }
  }

  // Room methods
  joinRoom(roomCode: string, userName: string, role: string = 'player'): void {
    if (this.mockMode) {
      // Mock implementation
      setTimeout(() => {
        const mockUser: User = {
          id: 'user-' + Math.random().toString(36).substr(2, 9),
          name: userName,
          role: role as any,
          isConnected: true
        };

        // Add some mock participants for testing
        const mockParticipants = [mockUser];
        
        // If user is joining, add a mock moderator
        if (role !== 'moderator') {
          mockParticipants.unshift({
            id: 'moderator-id',
            name: 'Sarah Chen',
            role: 'moderator' as any,
            isConnected: true
          });
        }

        const mockRoom: Room = {
          id: 'room-' + Math.random().toString(36).substr(2, 9),
          code: roomCode,
          name: role === 'moderator' ? `Room ${roomCode}` : 'Sprint 23 Planning',
          moderatorId: role === 'moderator' ? mockUser.id : 'moderator-id',
          participants: mockParticipants,
          deck: {
            name: 'Fibonacci',
            cards: ['0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89', '?', '☕']
          },
          votingPhase: 'waiting' as any,
          createdAt: new Date(),
          settings: {
            autoReveal: false,
            allowObservers: true,
            timerEnabled: false,
            timerDuration: 300
          }
        };

        this._currentRoom.set(mockRoom);
        this._currentUser.set(mockUser);
      }, 500);
    } else {
      this.socket.emit(SOCKET_EVENTS.JOIN_ROOM, { roomCode, userName, role });
    }
  }

  leaveRoom(): void {
    if (this.mockMode) {
      this._currentRoom.set(null);
      this._currentUser.set(null);
      this._currentVotes.set([]);
      this._votingResults.set(null);
    } else {
      this.socket.emit(SOCKET_EVENTS.LEAVE_ROOM);
      this._currentRoom.set(null);
      this._currentUser.set(null);
      this._currentVotes.set([]);
      this._votingResults.set(null);
    }
  }

  // Voting methods
  submitVote(vote: string, storyId: string): void {
    if (this.mockMode) {
      // Mock implementation - could add mock vote logic here
      return;
    }
    this.socket.emit(SOCKET_EVENTS.SUBMIT_VOTE, { vote, storyId });
  }

  revealVotes(): void {
    if (this.mockMode) {
      // Mock implementation - could add mock reveal logic here
      return;
    }
    this.socket.emit(SOCKET_EVENTS.REVEAL_VOTES);
  }

  // Story methods
  updateStory(story: Story): void {
    if (this.mockMode) {
      // Mock implementation - could add mock story logic here
      return;
    }
    this.socket.emit(SOCKET_EVENTS.STORY_UPDATED, story);
  }

  // Emit voting started event
  emitVotingStarted(roomId: string): void {
    if (this.mockMode) {
      // Mock implementation - trigger voting started for all participants
      setTimeout(() => {
        const currentRoom = this._currentRoom();
        if (currentRoom) {
          currentRoom.votingPhase = 'voting' as any;
          this._currentRoom.set({ ...currentRoom });
        }
      }, 100);
      return;
    }
    this.socket.emit(SOCKET_EVENTS.VOTING_STARTED, { roomId });
  }

  // Observable methods for reactive programming
  onRoomJoined(): Observable<{ room: Room; user: User }> {
    if (this.mockMode) {
      return new Observable(subscriber => {
        // Mock implementation - return empty observable
        return () => {};
      });
    }
    return fromEvent(this.socket, SOCKET_EVENTS.ROOM_JOINED);
  }

  onRoomUpdated(): Observable<Room> {
    if (this.mockMode) {
      return new Observable(subscriber => {
        // Mock implementation - return empty observable
        return () => {};
      });
    }
    return fromEvent(this.socket, SOCKET_EVENTS.ROOM_UPDATED);
  }

  onUserJoined(): Observable<User> {
    if (this.mockMode) {
      return new Observable(subscriber => {
        return () => {};
      });
    }
    return fromEvent(this.socket, SOCKET_EVENTS.USER_JOINED);
  }

  onUserLeft(): Observable<User> {
    if (this.mockMode) {
      return new Observable(subscriber => {
        return () => {};
      });
    }
    return fromEvent(this.socket, SOCKET_EVENTS.USER_LEFT);
  }

  onVotingStarted(): Observable<any> {
    if (this.mockMode) {
      return new Observable(subscriber => {
        return () => {};
      });
    }
    return fromEvent(this.socket, SOCKET_EVENTS.VOTING_STARTED);
  }

  onVotesRevealed(): Observable<VotingResults> {
    if (this.mockMode) {
      return new Observable(subscriber => {
        return () => {};
      });
    }
    return fromEvent(this.socket, SOCKET_EVENTS.VOTES_REVEALED);
  }

  onError(): Observable<string> {
    if (this.mockMode) {
      return new Observable(subscriber => {
        return () => {};
      });
    }
    return fromEvent(this.socket, SOCKET_EVENTS.ERROR);
  }
}