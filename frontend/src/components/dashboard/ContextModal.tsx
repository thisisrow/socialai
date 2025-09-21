import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

interface ContextModalProps {
  postId: string;
  onClose: () => void;
}

const ContextModal = ({ postId, onClose }: ContextModalProps) => {
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(true);
  const [contextExists, setContextExists] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const fetchContext = async () => {
      try {
        const res = await axios.get(`${API_BASE}/context/${postId}`, {
          headers: { Authorization: `Bearer ${user?.token}` },
        });
        if (res.data.success) {
          setContext(res.data.data.context);
          setContextExists(true);
        }
      } catch (error) {
        // If context is not found, it's not an error, just means it doesn't exist yet
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          setContextExists(false);
        } else {
          console.error('Failed to fetch context', error);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchContext();
  }, [postId, user?.token]);

  const handleSave = async () => {
    try {
      if (contextExists) {
        await axios.put(`${API_BASE}/context/${postId}`, { context }, {
          headers: { Authorization: `Bearer ${user?.token}` },
        });
      } else {
        await axios.post(`${API_BASE}/context`, { postId, context }, {
          headers: { Authorization: `Bearer ${user?.token}` },
        });
      }
      onClose();
    } catch (error) {
      console.error('Failed to save context', error);
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API_BASE}/context/${postId}`, {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      onClose();
    } catch (error) {
      console.error('Failed to delete context', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">Post Context</h2>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <textarea
            className="w-full p-2 border rounded-md"
            rows={4}
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Add context to your post..."
          />
        )}
        <div className="flex justify-end gap-4 mt-4">
          <button onClick={onClose} className="px-4 py-2 bg-gray-300 rounded-md">Cancel</button>
          {contextExists && (
            <button onClick={handleDelete} className="px-4 py-2 bg-red-500 text-white rounded-md">Delete</button>
          )}
          <button onClick={handleSave} className="px-4 py-2 bg-blue-500 text-white rounded-md">
            {contextExists ? 'Update' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContextModal;
