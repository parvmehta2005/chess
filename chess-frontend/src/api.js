import axios from 'axios';

class ChessAPI {
  constructor() {
    this.baseURL = 'http://localhost:5000/api';
    this.axios = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    this.playerId = this.getOrCreatePlayerId();
  }

  getOrCreatePlayerId() {
    let playerId = localStorage.getItem('chess-player-id');
    if (!playerId) {
      playerId = 'player_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('chess-player-id', playerId);
    }
    return playerId;
  }

  async createGame(gameMode = 'local') {
    try {
      const response = await this.axios.post('/games', {
        gameMode,
        playerId: this.playerId
      });
      return response.data;
    } catch (error) {
      console.error('Error creating game:', error);
      throw error;
    }
  }

  async getGame(gameId) {
    try {
      const response = await this.axios.get(`/games/${gameId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching game:', error);
      throw error;
    }
  }

  async joinGame(gameId) {
    try {
      const response = await this.axios.post(`/games/${gameId}/join`, {
        playerId: this.playerId
      });
      return response.data;
    } catch (error) {
      console.error('Error joining game:', error);
      throw error;
    }
  }

  async getAvailableGames() {
    try {
      const response = await this.axios.get('/games');
      return response.data;
    } catch (error) {
      console.error('Error fetching available games:', error);
      throw error;
    }
  }

  getPlayerId() {
    return this.playerId;
  }
}

export default ChessAPI;