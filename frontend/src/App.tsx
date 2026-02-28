import { Route, Routes } from 'react-router-dom'
import RoomPage from './RoomPage'
import RoomHistoryPage from './RoomHistoryPage'
import Home from './pages/Home'
import GameInstructions from './pages/GameInstructions'
import GamesHistoryPage from './pages/GamesHistoryPage'
import RoleSelection from './pages/RoleSelection'
import GMLandingPage from './pages/GMLandingPage'
import PlayerJoinPage from './pages/PlayerJoinPage'
import LiveFeedBlockDemoPage from './pages/LiveFeedBlockDemoPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<GameInstructions />} />
      <Route path="/dummy/live-feed" element={<LiveFeedBlockDemoPage />} />
      <Route path="/role-selection" element={<RoleSelection />} />
      <Route path="/gm" element={<GMLandingPage />} />
      <Route path="/join" element={<PlayerJoinPage />} />
      <Route path="/home" element={<Home />} />
      <Route path="/room/:roomId" element={<RoomPage />} />
      <Route path="/room/:roomId/history" element={<RoomHistoryPage />} />
      <Route path="/games" element={<GamesHistoryPage />} />
    </Routes>
  )
}

export default App
