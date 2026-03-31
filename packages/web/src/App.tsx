import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { Issues } from './pages/Issues';
import { Agents } from './pages/Agents';
import { Wiki } from './pages/Wiki';
import { Ontology } from './pages/Ontology';
import { Context } from './pages/Context';

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-[var(--color-surface)] text-slate-800">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/issues" element={<Issues />} />
              <Route path="/agents" element={<Agents />} />
              <Route path="/wiki" element={<Wiki />} />
              <Route path="/ontology" element={<Ontology />} />
              <Route path="/context" element={<Context />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
