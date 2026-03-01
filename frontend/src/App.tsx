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
import GameRoomGMDummyPage from './pages/GameRoomGMDummyPage'
import GameRoomPlayerDummyPage from './pages/GameRoomPlayerDummyPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<GameInstructions />} />
      <Route path="/dummy/live-feed" element={<LiveFeedBlockDemoPage />} />
      <Route path="/dummy/gm" element={<GameRoomGMDummyPage />} />
      <Route path="/dummy/player" element={<GameRoomPlayerDummyPage />} />
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
