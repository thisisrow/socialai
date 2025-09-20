import PostsGrid from './PostsGrid';
import CreatePost from './CreatePost';
import { useDashboardContext } from './DashboardLayout';

export default function Dashboard() {
  const { activeTab } = useDashboardContext();

  return (
    <>
      {activeTab === 'posts' && <PostsGrid />}
      {activeTab === 'create' && <CreatePost />}
    </>
  );
}
