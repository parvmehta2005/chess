import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import GameLobby from './GameLobby';
import Game from './components/Game';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

function App() {
    return (
    <Router>
      <div className="App">
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Protected routes */}
          <Route path="/lobby" element={
            <ProtectedRoute>
              <GameLobby />
            </ProtectedRoute>
          } />
          <Route path="/game/:id" element={
            <ProtectedRoute>
              <Game />
            </ProtectedRoute>
          } />
          
          {/* Redirect root to login if not authenticated, otherwise to lobby */}
          <Route path="/" element={
            <ProtectedRoute>
              <Navigate to="/lobby" replace />
            </ProtectedRoute>
          } />
        </Routes>
      </div>
    </Router>
  );
}

export default App;