import './App.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import HomePage from './pages/HomePage';
import ChatJosuPage from './pages/ChatJosuPage';

function App() {
  return (
    <BrowserRouter>
      {/* <CochesSummary /> */}
      <Routes>

        <Route path="/" element={<HomePage />} />
        <Route path="/chatjosu" element={<ChatJosuPage />} />

      </Routes>

    </BrowserRouter>
  )
}

export default App