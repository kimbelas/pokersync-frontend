import { TestBed } from '@angular/core/testing';
import { SocketService } from './socket.service';
import { SOCKET_EVENTS } from '../../shared/constants/socket-events';

// Mock Socket.IO
const mockSocket = {
  connected: false,
  connect: jest.fn(),
  disconnect: jest.fn(),
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn()
};

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => mockSocket)
}));

describe('SocketService', () => {
  let service: SocketService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SocketService);
    jest.clearAllMocks();
  });

  describe('Connection Management', () => {
    it('should create service with initial disconnected state', () => {
      expect(service).toBeTruthy();
      expect(service.isConnected()).toBeFalsy();
    });

    it('should connect to socket when connect() is called', () => {
      service.connect();
      expect(mockSocket.connect).toHaveBeenCalled();
    });

    it('should disconnect from socket when disconnect() is called', () => {
      mockSocket.connected = true;
      service.disconnect();
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should update connection state when socket connects', () => {
      // Simulate connection event
      const connectCallback = mockSocket.on.mock.calls
        .find(call => call[0] === SOCKET_EVENTS.CONNECT)?.[1];
      
      connectCallback?.();
      
      expect(service.isConnected()).toBeTruthy();
      expect(service.connectionError()).toBeNull();
    });

    it('should update connection state when socket disconnects', () => {
      // First connect
      const connectCallback = mockSocket.on.mock.calls
        .find(call => call[0] === SOCKET_EVENTS.CONNECT)?.[1];
      connectCallback?.();
      
      // Then disconnect
      const disconnectCallback = mockSocket.on.mock.calls
        .find(call => call[0] === SOCKET_EVENTS.DISCONNECT)?.[1];
      disconnectCallback?.();
      
      expect(service.isConnected()).toBeFalsy();
    });
  });

  describe('Room Management', () => {
    it('should emit join room event with correct parameters', () => {
      const roomCode = 'ABC123';
      const userName = 'TestUser';
      const role = 'player';

      service.joinRoom(roomCode, userName, role);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        SOCKET_EVENTS.JOIN_ROOM,
        { roomCode, userName, role }
      );
    });

    it('should emit leave room event and clear room state', () => {
      // Set up initial room state
      const mockRoom = { id: '1', code: 'ABC123', name: 'Test Room' };
      const mockUser = { id: '1', name: 'Test User', role: 'player' };
      
      // Simulate room joined
      const roomJoinedCallback = mockSocket.on.mock.calls
        .find(call => call[0] === SOCKET_EVENTS.ROOM_JOINED)?.[1];
      roomJoinedCallback?.({ room: mockRoom, user: mockUser });

      expect(service.currentRoom()).toEqual(mockRoom);
      expect(service.currentUser()).toEqual(mockUser);

      // Leave room
      service.leaveRoom();

      expect(mockSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.LEAVE_ROOM);
      expect(service.currentRoom()).toBeNull();
      expect(service.currentUser()).toBeNull();
    });

    it('should update room state when room updated event is received', () => {
      const updatedRoom = { id: '1', code: 'ABC123', name: 'Updated Room' };
      
      const roomUpdatedCallback = mockSocket.on.mock.calls
        .find(call => call[0] === SOCKET_EVENTS.ROOM_UPDATED)?.[1];
      roomUpdatedCallback?.(updatedRoom);

      expect(service.currentRoom()).toEqual(updatedRoom);
    });
  });

  describe('Voting Management', () => {
    it('should emit submit vote event with correct parameters', () => {
      const vote = '5';
      const storyId = 'story-123';

      service.submitVote(vote, storyId);

      expect(mockSocket.emit).toHaveBeenCalledWith(
        SOCKET_EVENTS.SUBMIT_VOTE,
        { vote, storyId }
      );
    });

    it('should emit reveal votes event', () => {
      service.revealVotes();
      expect(mockSocket.emit).toHaveBeenCalledWith(SOCKET_EVENTS.REVEAL_VOTES);
    });

    it('should update votes when vote submitted event is received', () => {
      const mockVotes = [
        { userId: '1', userName: 'User1', value: '5', storyId: 'story-1', timestamp: new Date() }
      ];
      
      const voteSubmittedCallback = mockSocket.on.mock.calls
        .find(call => call[0] === SOCKET_EVENTS.VOTE_SUBMITTED)?.[1];
      voteSubmittedCallback?.(mockVotes);

      expect(service.currentVotes()).toEqual(mockVotes);
    });

    it('should update voting results when votes revealed event is received', () => {
      const mockResults = {
        votes: [],
        average: 5,
        median: '5',
        consensus: true,
        storyId: 'story-1'
      };
      
      const votesRevealedCallback = mockSocket.on.mock.calls
        .find(call => call[0] === SOCKET_EVENTS.VOTES_REVEALED)?.[1];
      votesRevealedCallback?.(mockResults);

      expect(service.votingResults()).toEqual(mockResults);
    });
  });

  describe('Error Handling', () => {
    it('should update error state when error event is received', () => {
      const errorMessage = 'Connection failed';
      
      const errorCallback = mockSocket.on.mock.calls
        .find(call => call[0] === SOCKET_EVENTS.ERROR)?.[1];
      errorCallback?.(errorMessage);

      expect(service.connectionError()).toBe(errorMessage);
    });
  });

  describe('Observable Methods', () => {
    it('should return observable for room updates', () => {
      const observable = service.onRoomUpdated();
      expect(observable).toBeDefined();
    });

    it('should return observable for user joined events', () => {
      const observable = service.onUserJoined();
      expect(observable).toBeDefined();
    });

    it('should return observable for voting started events', () => {
      const observable = service.onVotingStarted();
      expect(observable).toBeDefined();
    });

    it('should return observable for error events', () => {
      const observable = service.onError();
      expect(observable).toBeDefined();
    });
  });
});