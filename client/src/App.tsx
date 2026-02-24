import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Project from './pages/Project';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/projects/:id" element={<Project />} />
    </Routes>
  );
}
