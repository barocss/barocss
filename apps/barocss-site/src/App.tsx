import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';

const App: React.FC = () => {

  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/docs" element={
            <main className="flex-1 py-20 bg-white">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <h1 className="text-4xl font-bold text-gray-900 mb-8">Documentation</h1>
                <p className="text-lg text-gray-600">Documentation page coming soon...</p>
              </div>
            </main>
          } />
          <Route path="/examples" element={
            <main className="flex-1 py-20 bg-white">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <h1 className="text-4xl font-bold text-gray-900 mb-8">Examples</h1>
                <p className="text-lg text-gray-600">Examples page coming soon...</p>
              </div>
            </main>
          } />
        </Routes>
        <Footer />
      </div>
    </Router>
  );
};

export default App;
