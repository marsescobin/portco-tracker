import { Routes, Route, Navigate } from 'react-router-dom'
import { Nav } from '@/components/Nav'
import Companies from './pages/Companies'
import Daily from './pages/Daily'
import Admin from './pages/Admin'

function App() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/companies" replace />} />
          <Route path="/companies" element={<Companies />} />
          <Route path="/daily" element={<Daily />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
