import React from "react";
import styled from "styled-components";
import FirstSection from "./FirstSection";
import SecondSection from "./SecondSection";
import Header from '../Component/header/Header'; 

const StyledDefault = styled.div`
  
`;

function Default() {
  return (
    <StyledDefault>
      <Header /> {/* Corrected here */}
      <FirstSection />
      <SecondSection />
    </StyledDefault>
  );
}

export default Default;