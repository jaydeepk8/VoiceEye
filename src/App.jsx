
import React from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import Header from './Component/header/Header'; 

import Footers from './Component/footer/Footers'; 
import FirstSection from './pages/FirstSection';
import Default from './pages/Default';
import SecondSection from './pages/SecondSection';
import ThirdSection from './pages/ThirdSection';

import Cursor from "./Component/Cursor";
import Home from './Home';
import Loader from './Loader';






function App() {
  const location = useLocation();

  return (

      <Routes>
  <Route path="/" element={<Loader />} />
  <Route path="/" element={<Home />} />
  <Route path="/FirstSection" element={<FirstSection />} />
  <Route path="/Default" element={<Default />} />
  <Route path="/Cursor" element={<Cursor />} />
  <Route path="/SecondSection" element={<SecondSection />} />
  <Route path="/ThirdSection" element={<ThirdSection />} />

  <Route path="/Footers" element={<Footers />} />

  
</Routes>
   

  );
}

export default App;