import React from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Header from './Component/header/Header'; 
import FirstSection from './pages/FirstSection';
import Preloader from './Preloader';
import SecondSection from './pages/SecondSection';

function App() {
  const location = useLocation(); 

  return (
    <>
      {location.pathname !== '/' && <Header />} 
      <Routes>
        <Route path="/" element={<Preloader />} />
        <Route path="/FirstSection" element={<FirstSection />} />
        <Route path="/SecondSection" element={<SecondSection />} />
      </Routes>
    </>
  );
}

export default App;
