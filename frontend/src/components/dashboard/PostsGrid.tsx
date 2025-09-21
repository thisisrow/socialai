import { useEffect, useState } from 'react';
import axios from 'axios';
import { Heart, MessageCircle, Settings } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';

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

export default function PostsGrid(): JSX.Element {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchPosts = async () => {
      if (!user || !user.ACCESS_TOKEN || !user.IG_USER_ID || !user.IG_USERNAME) {
        setLoading(false);
        return;
      }

      try {
        const res = await axios.get<{ success: boolean; data: Post[] }>(`${API_BASE}/posts`, {
          params: {
            accessToken: user.ACCESS_TOKEN,
            igUserId: user.IG_USER_ID,
            igUsername: user.IG_USERNAME,
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

  const formatDate = (date: string) => dayjs(date).fromNow();

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
            <div
              key={post.id}
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

                {post.comments.length > 0 && (
                  <ul className="space-y-2 max-h-40 overflow-y-auto text-sm">
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}