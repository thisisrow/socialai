import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = 'https://shortlisting-task-1-ten.vercel.app/api';

interface User {
  id: string;
  username: string;
  email: string;
  instagramUsername?: string;
  token?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  connectInstagram: (username: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading user from localStorage
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/users/login`, {
        username,
        password,
      });
      
      const userData: User = {
        id: response.data._id,
        username: response.data.username,
        email: response.data.email,
        token: response.data.token
      };
      
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      
      // Set the default Authorization header for future requests
      axios.defaults.headers.common['Authorization'] = `Bearer ${userData.token}`;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const signup = async (username: string, email: string, password: string) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/users/register`, {
        username,
        email,
        password,
      });
      
      const userData: User = {
        id: response.data._id,
        username: response.data.username,
        email: response.data.email,
        token: response.data.token
      };
      
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      
      // Set the default Authorization header for future requests
      axios.defaults.headers.common['Authorization'] = `Bearer ${userData.token}`;
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  const connectInstagram = async (username: string) => {
    // Simulate Instagram connection
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (user) {
      const updatedUser = {
        ...user,
        instagramUsername: username,
      };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      signup,
      logout,
      connectInstagram,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}