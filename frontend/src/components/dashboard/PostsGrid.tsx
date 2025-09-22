import { useEffect, useState } from 'react';
import axios from 'axios';
import { Settings } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';
import PostCard from './PostCard';

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

export default function PostsGrid(): JSX.Element {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchPosts = async () => {
      if (!user || !user.token) {
        setLoading(false);
        return;
      }

      try {
        const res = await axios.get<{ success: boolean; data: Post[] }>(`${API_BASE}/posts`, {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        });
        setPosts(res.data?.data ?? []);
      } catch (e) {
        console.error('load posts failed', e);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center items-center">
        <div className="text-gray-500 animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!user || !user.ACCESS_TOKEN || !user.IG_USER_ID || !user.IG_USERNAME) {
    return (
      <div className="text-center p-8 bg-white rounded-lg shadow-md">
        <h3 className="text-xl font-semibold mb-4">Connect Your Instagram Account</h3>
        <p className="text-gray-600 mb-6">
          Please go to the settings page to connect your Instagram account to see your posts.
        </p>
        <Link to="/dashboard/settings" className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 w-max mx-auto">
          <Settings className="w-5 h-5" />
          Go to Settings
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Your Posts</h2>
        <div className="text-sm text-gray-600">{posts.length} posts</div>
      </div>

      {posts.length === 0 ? (
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-4">No posts found</h3>
            <p className="text-gray-600">We couldn't find any posts for your connected account.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map(post => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
