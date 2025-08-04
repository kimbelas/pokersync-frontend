export const SOCKET_EVENTS = {
  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  
  // Room Management
  JOIN_ROOM: 'join-room',
  LEAVE_ROOM: 'leave-room',
  ROOM_JOINED: 'room-joined',
  ROOM_LEFT: 'room-left',
  ROOM_UPDATED: 'room-updated',
  
  // Voting
  SUBMIT_VOTE: 'submit-vote',
  VOTE_SUBMITTED: 'vote-submitted',
  REVEAL_VOTES: 'reveal-votes',
  VOTES_REVEALED: 'votes-revealed',
  VOTING_STARTED: 'voting-started',
  
  // Stories
  STORY_CHANGED: 'story-changed',
  STORY_UPDATED: 'story-updated',
  
  // Users
  USER_JOINED: 'user-joined',
  USER_LEFT: 'user-left',
  USER_UPDATED: 'user-updated',
  
  // Errors
  ERROR: 'error'
} as const;