import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HelpChat from './components/HelpChat';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HelpChat />} />
        <Route path="/chatjosu4" element={<HelpChat />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
