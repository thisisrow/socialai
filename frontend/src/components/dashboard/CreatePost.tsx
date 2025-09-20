import React, { useState } from 'react';
import { usePosts } from '../../contexts/PostContext';
import { Upload, Image, Video, Sparkles, Send } from 'lucide-react';

export default function CreatePost() {
  const [caption, setCaption] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiContext, setAiContext] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const { createPost } = usePosts();

  const handleGenerateCaption = async () => {
    setIsGenerating(true);
    // Simulate AI generation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const aiCaptions = [
      'Capturing moments that matter ✨ #blessed #photography',
      'Every sunset brings the promise of a new dawn 🌅 #motivation',
      'Life is better when you\'re laughing 😄 #joy #happiness',
      'Adventure awaits those who seek it 🌍 #travel #explore',
    ];
    
    setCaption(aiCaptions[Math.floor(Math.random() * aiCaptions.length)]);
    setIsGenerating(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (imageUrl && caption) {
      createPost(imageUrl, caption, aiEnabled);
      setImageUrl('');
      setCaption('');
      setAiContext('');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Create New Post</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Media Upload */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Media</h3>
          
          {imageUrl ? (
            <div className="relative">
              <img
                src={imageUrl}
                alt="Preview"
                className="w-full h-64 object-cover rounded-lg"
              />
              <button
                type="button"
                onClick={() => setImageUrl('')}
                className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600"
              >
                ×
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-purple-400 transition-colors">
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-600 mb-4">Drag and drop your image or video here</p>
                <div className="flex justify-center gap-4">
                  <button
                    type="button"
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    <Image className="w-4 h-4" />
                    Choose Image
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700"
                  >
                    <Video className="w-4 h-4" />
                    Choose Video
                  </button>
                </div>
              </div>
              
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-2">Or paste an image URL for demo:</p>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>
          )}
        </div>

        {/* Caption */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Caption</h3>
            <button
              type="button"
              onClick={handleGenerateCaption}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {isGenerating ? 'Generating...' : 'AI Generate'}
            </button>
          </div>
          
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write your caption here..."
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            required
          />
        </div>

        {/* AI Configuration */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Comment Replies</h3>
          
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={aiEnabled}
                onChange={(e) => setAiEnabled(e.target.checked)}
                className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
              />
              <span className="text-gray-700">Enable AI-powered comment replies</span>
            </label>
            
            {aiEnabled && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  AI Context (Optional)
                </label>
                <textarea
                  value={aiContext}
                  onChange={(e) => setAiContext(e.target.value)}
                  placeholder="Provide context for AI replies (e.g., brand voice, specific topics to focus on...)"
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!imageUrl || !caption}
          className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-5 h-5" />
          Create Post
        </button>
      </form>
    </div>
  );
}