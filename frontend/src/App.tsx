import { Route, Routes } from 'react-router-dom'
import RoomPage from './RoomPage'
import RoomHistoryPage from './RoomHistoryPage'
import Home from './pages/Home'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/room/:roomId" element={<RoomPage />} />
      <Route path="/room/:roomId/history" element={<RoomHistoryPage />} />
    </Routes>
  )
}

export default App
