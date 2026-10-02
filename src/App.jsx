import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import Deaf from "./pages/Deaf";

import Home from "./Home";
import Loader from "./Loader";
import Blind from "./pages/Blind";

function App() {
  const location = useLocation();

  return (
    <Routes>
      <Route path="/" element={<Loader />} />
      <Route path="/Home" element={<Home />} />
      <Route path="/Deaf" element={<Deaf />} />
      <Route path="/Blind" element={<Blind />} />
      <Route path="*" element={<Navigate to="/Home" replace />} />
    </Routes>
  );
}

export default App;
