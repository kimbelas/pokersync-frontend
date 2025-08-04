import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Room, VotingDeck, VotingPhase } from '../../shared/models';

@Injectable({
  providedIn: 'root'
})
export class RoomService {

  constructor() { }

  async createRoom(roomName: string, moderatorName: string): Promise<Room> {
    // Mock implementation - replace with actual API call
    const room: Room = {
      id: this.generateId(),
      code: this.generateRoomCode(),
      name: roomName,
      moderatorId: this.generateId(),
      participants: [{
        id: this.generateId(),
        name: moderatorName,
        role: 'moderator' as any,
        isConnected: true
      }],
      deck: this.getDefaultDeck(),
      votingPhase: VotingPhase.WAITING,
      createdAt: new Date(),
      settings: {
        autoReveal: false,
        allowObservers: true,
        timerEnabled: false,
        timerDuration: 300
      }
    };

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return room;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private getDefaultDeck(): VotingDeck {
    return {
      name: 'Fibonacci',
      cards: ['0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89', '?', '☕']
    };
  }
}