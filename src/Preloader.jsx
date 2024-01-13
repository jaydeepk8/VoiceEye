import React from "react";
import { useNavigate } from 'react-router-dom';
import styled, { keyframes } from "styled-components";

const StyledPreloader = styled.div`
  width: 100vw;
  height: 100vh;
  background: linear-gradient(120deg, #162A28 26.38%, rgba(3, 3, 3, 0.81) 107.03%);
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
`;

const drawAnimation = keyframes`
  0% {
    stroke-dashoffset: 4500;
  }
  100% {
    stroke-dashoffset: 0;
  }
`;

const StyledHoverWrapper = styled.div`
  width: 500px;
  height: 500px;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  
`;


//outer
const StyledSvg1 = styled.svg`
  width: 250px;
  height: 250px;
  position: absolute;
  top: 50%;
  left: 50%;
  transition: transform 0.3s ease;
  transform-origin: center;
  transform: translate(-50%, -50%);
  &:hover {
    opacity: 0.50; // Make this inner circle visible
    cursor: pointer;
    // Use the adjacent sibling combinator to scale up the StyledSvg1
  
    }
  }

  

`;


//inner
const StyledSvg2 = styled.svg`
  width:   350px;
  height:  350px;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  transition: opacity 0.5s ease, transform 0.3s ease;
  opacity: 0; // Start invisible
  pointer-events: all; // Ensure this element can be hovered

  // When this element is hovered, it becomes opaque and scales the adjacent StyledSvg1
  &:hover {
    opacity: 0.40; // Make this inner circle visible
    cursor: pointer;
    // Use the adjacent sibling combinator to scale up the StyledSvg1
    + ${StyledSvg1} {
      transform: translate(-50%, -50%) scale(1.05);
    }
  }





`;

const StyledH2 = styled.h2`
  color: #FFF;
  font-family: 'Orbitron', sans-serif;
  font-size: 32px;
  font-style: normal;
  font-weight: 400;
  letter-spacing: 0.32px;
  position: absolute;
  top: 48%;
  left: 50%;
  transform: translate(-50%, -20%);
  &:hover {
   
    cursor: pointer;
   
  }
  
  
`;

const StyledH4 = styled.h4`
  color: #FFF;
  font-family: 'Libre Caslon Display', sans-serif;
  font-size: 16px;
  font-style: normal;
  font-weight: 400;
  letter-spacing: 0.48px;
  position: absolute;
  top: 53%;
  left: 50%;
  transform: translate(-50%, 10%);
  margin: 0;
`;

function Preloader() {
  const navigate = useNavigate();
  return (
    <StyledPreloader>
      <StyledHoverWrapper>
        {/* Inner circle becomes visible on hover */}
        <StyledSvg2 viewBox="0 0 270 262" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="135" cy="131" r="130.5" stroke="white" fill="none" />
        </StyledSvg2>
        {/* Outer circle SVG, which scales when the inner circle is hovered */}
        <StyledSvg1 viewBox="0 0 302 302" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="151" cy="151" r="150.5" stroke="white" fill="none" />
        </StyledSvg1>
      </StyledHoverWrapper>
      {/* Text is always visible */}
      <StyledH2 onClick={() => navigate('/FirstSection')}>Explore</StyledH2>
      <StyledH4>VoiceEye</StyledH4>
    </StyledPreloader>
  );
}

export default Preloader;