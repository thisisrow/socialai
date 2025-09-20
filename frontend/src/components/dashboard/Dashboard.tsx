import  { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import PostsGrid from './PostsGrid';
import CreatePost from './CreatePost';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('posts');



  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="flex-1 p-6 ml-64">
          {activeTab === 'posts' && <PostsGrid />}
          {activeTab === 'create' && <CreatePost />}
        </main>
      </div>
    </div>
  );
}