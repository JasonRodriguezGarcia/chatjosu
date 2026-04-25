import './App.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import HomePage from './pages/HomePage';
import ChatJosuPage1 from './pages/ChatJosuPage1';
import ChatJosuPage2 from './pages/ChatJosuPage2';
import ChatJosuPage3 from './pages/ChatJosuPage3';

function App() {
  return (
    <BrowserRouter>
      {/* <CochesSummary /> */}
      <Routes>

        <Route path="/" element={<HomePage />} />
        <Route path="/chatjosu1" element={<ChatJosuPage1 />} />
        <Route path="/chatjosu2" element={<ChatJosuPage2 />} />
        <Route path="/chatjosu3" element={<ChatJosuPage3 />} />

      </Routes>

    </BrowserRouter>
  )
}

export default App