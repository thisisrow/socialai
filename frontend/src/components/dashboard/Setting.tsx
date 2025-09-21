import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function Setting() {
  const { user, updateUser } = useAuth();
  const [formData, setFormData] = useState({
    ACCESS_TOKEN: '',
    IG_USER_ID: '',
    IG_USERNAME: '',
    IG_VERIFY_TOKEN: '',
    APP_SECRET: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        ACCESS_TOKEN: user.ACCESS_TOKEN || '',
        IG_USER_ID: user.IG_USER_ID || '',
        IG_USERNAME: user.IG_USERNAME || '',
        IG_VERIFY_TOKEN: user.IG_VERIFY_TOKEN || '',
        APP_SECRET: user.APP_SECRET || '',
      });
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      await axios.post(`${API_BASE_URL}/users/connectiondetails`, formData);
      
      if(user) {
        const updatedUser = {
            ...user,
            ...formData
        }
        updateUser(updatedUser);
      }

      setMessage('Connection details saved successfully!');
    } catch (error: any) {
      setMessage(error.response?.data?.details || error.response?.data?.error || 'An error occurred while saving the details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Connection Settings
        </h1>
        <p className="text-gray-600">
          Configure your Instagram connection details.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Access Token
          </label>
          <input
            type="text"
            name="ACCESS_TOKEN"
            value={formData.ACCESS_TOKEN}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="Enter your Access Token"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Instagram User ID
          </label>
          <input
            type="text"
            name="IG_USER_ID"
            value={formData.IG_USER_ID}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="Enter your Instagram User ID"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Instagram Username
          </label>
          <input
            type="text"
            name="IG_USERNAME"
            value={formData.IG_USERNAME}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="Enter your Instagram Username"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Verify Token
          </label>
          <input
            type="text"
            name="IG_VERIFY_TOKEN"
            value={formData.IG_VERIFY_TOKEN}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="Enter your Verify Token"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            App Secret
          </label>
          <input
            type="text"
            name="APP_SECRET"
            value={formData.APP_SECRET}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="Enter your App Secret"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : 'Save Connection Details'}
        </button>
      </form>
      {message && <p className="mt-4 text-center text-sm text-gray-600">{message}</p>}
    </div>
  );
}
