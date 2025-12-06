import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {

  return (
    <>
     <button onClick={() => {
      window.open('https://www.instagram.com/oauth/authorize?force_reauth=true&client_id=1251511386469731&redirect_uri=https://socialai-theta.vercel.app/&response_type=code&scope=instagram_business_basic%2Cinstagram_business_manage_messages%2Cinstagram_business_manage_comments%2Cinstagram_business_content_publish%2Cinstagram_business_manage_insights', '_self')
     }}>
      connect account 
     </button>
    </>
  )
}

export default App
