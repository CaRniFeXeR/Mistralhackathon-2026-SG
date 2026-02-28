import { Route, Routes } from 'react-router-dom'
import RoomPage from './RoomPage'
import Home from './pages/Home'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/room/:roomId" element={<RoomPage />} />
    </Routes>
  )
}

export default App
