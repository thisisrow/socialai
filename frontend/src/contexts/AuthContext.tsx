import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface User {
  id: string;
  username: string;
  email: string;
  token?: string;
  ACCESS_TOKEN?: string | null;
  IG_USER_ID?: string | null;
  IG_USERNAME?: string | null;
  IG_VERIFY_TOKEN?: string | null;
  APP_SECRET?: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      if (parsedUser.token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${parsedUser.token}`;
      }
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
        id: response.data.user.id,
        username: response.data.user.username,
        email: response.data.user.email,
        token: response.data.token,
        ACCESS_TOKEN: response.data.user.ACCESS_TOKEN,
        IG_USER_ID: response.data.user.IG_USER_ID,
        IG_USERNAME: response.data.user.IG_USERNAME,
        IG_VERIFY_TOKEN: response.data.user.IG_VERIFY_TOKEN,
        APP_SECRET: response.data.user.APP_SECRET,
      };
      
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      
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
        id: response.data.user.id,
        username: response.data.user.username,
        email: response.data.user.email,
        token: response.data.token,
        ACCESS_TOKEN: response.data.user.ACCESS_TOKEN,
        IG_USER_ID: response.data.user.IG_USER_ID,
        IG_USERNAME: response.data.user.IG_USERNAME,
        IG_VERIFY_TOKEN: response.data.user.IG_VERIFY_TOKEN,
        APP_SECRET: response.data.user.APP_SECRET,
      };
      
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      
      axios.defaults.headers.common['Authorization'] = `Bearer ${userData.token}`;
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      signup,
      logout,
      updateUser,
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