import React from "react";
import Header from './Component/header/Header'; 
import Footer from './Component/footer/Footer'; 
import FirstSection from './pages/FirstSection';
import SecondSection from './pages/SecondSection';
import ThirdSection from './pages/ThirdSection';


function Home() {
  return (
    <div>
      <Header /> 
      <section>
        <FirstSection />
      </section>
      <section>
        <SecondSection />
      </section>
      <section>
        <ThirdSection />
      </section>
      <Footer />
    </div>
  );
}

export default Home;