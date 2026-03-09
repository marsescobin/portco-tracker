import { Routes, Route, Navigate } from 'react-router-dom'
import { Nav } from '@/components/Nav'
import Companies from './pages/Companies'
import Digest from './pages/Digest'
import Admin from './pages/Admin'

function App() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/companies" replace />} />
          <Route path="/companies" element={<Companies />} />
          <Route path="/digest" element={<Digest />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
