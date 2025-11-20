import React, { useState } from 'react';
import LandingPage from './components/LandingPage';
import GeneratorPage from './components/GeneratorPage';

function App() {
  const [currentPage, setCurrentPage] = useState('landing');

  const navigateToGenerator = () => {
    setCurrentPage('generator');
  };

  const navigateToLanding = () => {
    setCurrentPage('landing');
  };

  return (
    <div className="min-h-screen font-sans antialiased">
      {currentPage === 'landing' && <LandingPage onGetStarted={navigateToGenerator} />}
      {currentPage === 'generator' && <GeneratorPage onBack={navigateToLanding} />}
    </div>
  );
}

export default App;
