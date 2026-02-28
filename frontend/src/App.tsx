import { Route, Routes } from 'react-router-dom'
import RoomPage from './RoomPage'
import RoomHistoryPage from './RoomHistoryPage'
import Home from './pages/Home'
import GameInstructions from './pages/GameInstructions'
import RoleSelection from './pages/RoleSelection'
import GMLandingPage from './pages/GMLandingPage'
import PlayerJoinPage from './pages/PlayerJoinPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<GameInstructions />} />
      <Route path="/role-selection" element={<RoleSelection />} />
      <Route path="/gm" element={<GMLandingPage />} />
      <Route path="/join" element={<PlayerJoinPage />} />
      <Route path="/home" element={<Home />} />
      <Route path="/room/:roomId" element={<RoomPage />} />
      <Route path="/room/:roomId/history" element={<RoomHistoryPage />} />
    </Routes>
  )
}

export default App
