
import { useEffect, useState } from 'react';
import axios from 'axios';
import { Heart, MessageCircle, Settings, PlusCircle, Power, PowerOff } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useAuth } from '../../contexts/AuthContext';
import ContextModal from './ContextModal';

dayjs.extend(relativeTime);

const API_BASE = import.meta.env.VITE_API_BASE_URL;

type Comment = {
  id: string;
  text: string;
  username: string;
  timestamp: string;
};

type Post = {
  id: string;
  caption: string;
  mediaType: string;
  imageUrl: string;
  permalink: string;
  timestamp: string;
  likes: number;
  commentsCount: number;
  comments: Comment[];
};

type Context = {
    _id: string;
    user: string;
    postId: string;
    context: string;
    automation: boolean;
    createdAt: string;
    updatedAt: string;
};

export default function PostCard({ post }: { post: Post }): JSX.Element {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [context, setContext] = useState<Context | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchContext = async () => {
      if (!user || !user.token) {
        return;
      }

      try {
        const res = await axios.get<{ success: boolean; data: Context }>(`${API_BASE}/context/${post.id}`, {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        });
        setContext(res.data.data);
      } catch (e) {
        // It's okay if there's no context, so we don't need to log the error
      }
    };

    fetchContext();
  }, [user, post.id]);

  const formatDate = (date: string) => dayjs(date).fromNow();

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const toggleAutomation = async () => {
    if (!user || !user.token || !context) {
      return;
    }

    try {
      const res = await axios.put<{ success: boolean; data: Context }>(
        `${API_BASE}/context/${post.id}/toggle-automation`,
        {},
        {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        }
      );
      setContext(res.data.data);
    } catch (e) {
      console.error('Failed to toggle automation', e);
    }
  };

  return (
    <div
      className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition-shadow duration-300"
    >
      <img
        src={post.imageUrl}
        alt={post.caption || 'Post'}
        className="w-full h-64 object-cover transition-transform duration-300 hover:scale-105"
      />

      <div className="p-4">
        <p className="text-gray-800 text-lg font-medium mb-3">{post.caption}</p>

        <div className="flex items-center justify-between text-gray-600 text-sm mb-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Heart className="w-5 h-5 text-red-500" />
              <span>{post.likes}</span>
            </div>
            <div className="flex items-center gap-1">
              <MessageCircle className="w-5 h-5 text-blue-500" />
              <span>{post.commentsCount}</span>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            {formatDate(post.timestamp)}
          </div>
        </div>
        <div className="flex items-center gap-4 mt-2">
            <button onClick={handleOpenModal} className="flex items-center gap-2 text-blue-500 hover:underline">
                <PlusCircle className="w-5 h-5" />
                Add/Edit Context
            </button>
            {context && (
            <button onClick={toggleAutomation} className={`flex items-center gap-2 text-white px-3 py-1 rounded-md ${context.automation ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}>
                {context.automation ? <PowerOff className="w-5 h-5" /> : <Power className="w-5 h-5" />}
                {context.automation ? 'Turn Off Automation' : 'Turn On Automation'}
            </button>
            )}
        </div>


        {post.comments.length > 0 && (
          <ul className="space-y-2 max-h-40 overflow-y-auto text-sm mt-4">
            {post.comments.slice(0, 5).map(c => (
              <li key={c.id} className="flex flex-col">
                <div>
                  <span className="font-semibold text-gray-900">{c.username}</span>{' '}
                  <span className="text-gray-700">{c.text}</span>
                </div>
                <span className="text-xs text-gray-400 ml-1">
                  {formatDate(c.timestamp)}
                </span>
              </li>
            ))}
            {post.comments.length > 5 && (
              <li className="text-sm text-blue-500 cursor-pointer mt-2">
                <button>Show more comments</button>
              </li>
            )}
          </ul>
        )}
      </div>
      {isModalOpen && (
        <ContextModal postId={post.id} onClose={handleCloseModal} />
      )}
    </div>
  );
}
