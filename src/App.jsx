import React from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import Header from './Component/header/Header'; 
import FirstSection from './pages/FirstSection';
import Default from './pages/Default';
import SecondSection from './pages/SecondSection';
import Loader from './Loader';


import { TransitionGroup, CSSTransition } from 'react-transition-group';
import Home from "./pages/SecondSection";

function App() {
  const location = useLocation();

  return (
    <TransitionGroup>
      <CSSTransition key={location.key} classNames="fade" timeout={200}>
        <Routes>
          <Route path="/" element={<Loader />} />
   
          <Route path="/FirstSection" element={<FirstSection />} />
          <Route path="/Default" element={<Default />} />
       

          <Route path="/SecondSection" element={<SecondSection />} />
        </Routes>
      </CSSTransition>
    </TransitionGroup>
  );
}

export default App;