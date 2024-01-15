import React, { useState, useEffect } from "react";
import Header from './Component/header/Header';
import Footer from './Component/footer/Footer';
import FirstSection from './pages/FirstSection';
import SecondSection from './pages/SecondSection';
import ThirdSection from './pages/ThirdSection';
import Preloader from './Preloader';

function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 5000); // Adjust timer as needed

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <Preloader />;
  }

  return (
    <>
      <Header />
      <FirstSection />
      <SecondSection />
      <ThirdSection />
      <Footer />
    </>
  );
}

export default App;
