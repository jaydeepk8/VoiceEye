import React from "react";
import Header from './Component/header/Header'; 
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
   
    </div>
  );
}

export default Home;