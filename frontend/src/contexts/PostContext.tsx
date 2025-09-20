import React, { createContext, useContext, useState } from 'react';

interface Post {
  id: string;
  imageUrl: string;
  caption: string;
  likes: number;
  comments: number;
  timestamp: Date;
  aiEnabled: boolean;
}

interface PostContextType {
  posts: Post[];
  createPost: (imageUrl: string, caption: string, aiEnabled: boolean) => void;
  toggleAI: (postId: string) => void;
}

const PostContext = createContext<PostContextType | undefined>(undefined);

export function PostProvider({ children }: { children: React.ReactNode }) {
  const [posts, setPosts] = useState<Post[]>([
    {
      id: '1',
      imageUrl: 'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=800',
      caption: 'Beautiful sunset at the beach 🌅',
      likes: 124,
      comments: 23,
      timestamp: new Date('2024-01-15'),
      aiEnabled: true,
    },
    {
      id: '2',
      imageUrl: 'https://images.pexels.com/photos/1279330/pexels-photo-1279330.jpeg?auto=compress&cs=tinysrgb&w=800',
      caption: 'Coffee and code ☕️💻',
      likes: 89,
      comments: 12,
      timestamp: new Date('2024-01-14'),
      aiEnabled: false,
    },
    {
      id: '3',
      imageUrl: 'https://images.pexels.com/photos/1061588/pexels-photo-1061588.jpeg?auto=compress&cs=tinysrgb&w=800',
      caption: 'Mountain adventure awaits! 🏔️',
      likes: 256,
      comments: 45,
      timestamp: new Date('2024-01-13'),
      aiEnabled: true,
    },
  ]);

  const createPost = (imageUrl: string, caption: string, aiEnabled: boolean) => {
    const newPost: Post = {
      id: Date.now().toString(),
      imageUrl,
      caption,
      likes: 0,
      comments: 0,
      timestamp: new Date(),
      aiEnabled,
    };
    setPosts(prev => [newPost, ...prev]);
  };

  const toggleAI = (postId: string) => {
    setPosts(prev => prev.map(post => 
      post.id === postId 
        ? { ...post, aiEnabled: !post.aiEnabled }
        : post
    ));
  };

  return (
    <PostContext.Provider value={{
      posts,
      createPost,
      toggleAI,
    }}>
      {children}
    </PostContext.Provider>
  );
}

export function usePosts() {
  const context = useContext(PostContext);
  if (context === undefined) {
    throw new Error('usePosts must be used within a PostProvider');
  }
  return context;
}