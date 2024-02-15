import React from "react";
import Header from "./Component/header/Header";
import FirstSection from "./pages/FirstSection";
import SecondSection from "./pages/SecondSection";
import ThirdSection from "./pages/ThirdSection";
import Footers from "./Component/footer/Footers";

function Home() {
  return (
    <div>
      <Header />

      <FirstSection />

      <SecondSection />

      <ThirdSection />

      <Footers />
    </div>
  );
}

export default Home;
