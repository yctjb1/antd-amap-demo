import Home from './pages/Home';
// import { useState } from 'react'
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
import CesiumViewerProvider from './pages/components/CesiumViewerProvider';
import './App.css'

function App() {
  // const [count, setCount] = useState(0)

  return (
    <CesiumViewerProvider>
      <Home />
    </CesiumViewerProvider>
  )
}

export default App
