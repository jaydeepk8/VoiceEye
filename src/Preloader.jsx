import React from "react";
import { useNavigate } from 'react-router-dom';
import styled, { keyframes } from "styled-components";

const StyledPreloader = styled.div`
  width: 100vw;
  height: 100vh;
  // background: linear-gradient(120deg, #162A28 26.38%, rgba(3, 3, 3, 0.81) 107.03%);
  // background: linear-gradient(to bottom, black 60%, gray 40%);
  background: linear-gradient(90deg, rgba(8,21,27,1) 0%, rgba(9,29,38,1) 52%, rgba(8,25,33,1) 100%);
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
    color:#C38C5C; // Make this inner circle visible
    cursor: pointer;
    // Use the adjacent sibling combinator to scale up the StyledSvg1
  
    }
  }

  

`;


//inner
const StyledSvg2 = styled.svg`
  --bg-size: 400%;
  --color-one: rgb(195, 140, 92); // RGB color
  --color-two: rgb(195, 140, 92); // Light shade of white
  width: 320px;
  height: 320px;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  transition: opacity 0.5s ease, transform 0.3s ease;
  opacity: 1; // Start invisible
  pointer-events: all; // Ensure this element can be hovered
  fill: url(#gradient);
&:hover {
  --color-one: rgb(195, 140, 92); // Change color-one on hover
  --color-two: rgb(195, 140, 92); // Change color-two on hover
  opacity: 0.40; // Make this inner circle visible
  cursor: pointer;
  // Use the adjacent sibling combinator to scale up the StyledSvg1
  + ${StyledSvg1} {
    transform: translate(-50%, -50%) scale(1.05);
  }
}
`;

const StyledH2 = styled.h2`
  --bg-size: 400%;
  --color-one: hsl(40, 47%, 56%); // RGB color converted to HSL
  --color-two: hsl(30, 47%, 46%); // Darker shade of the same color
  font-family: 'Orbitron', sans-serif;
  font-size: 32px;
  font-style: normal;
  user-select: none;
  font-weight: 400;
  letter-spacing: 0.32px;
  position: absolute;
  top: 49%;
  left: 50%;
  transform: translate(-50%, -20%);
  background: linear-gradient(
                90deg,
                var(--color-one),
                var(--color-two),
                var(--color-one)
              ) 0 0 / var(--bg-size) 100%;
  color: transparent;
  -webkit-background-clip: text;
  background-clip: text;
  animation: move-bg 8s infinite linear;
  &:hover {
    cursor: pointer;
  }
  @keyframes move-bg {
    0% {
      background-position: 0 0;
    }
    100% {
      background-position: var(--bg-size) 0;
    }
  }
`;



function Preloader() {
  const navigate = useNavigate();
  return (
    <StyledPreloader>
      <StyledHoverWrapper>
        {/* Inner circle becomes visible on hover */}
        <StyledSvg2 viewBox="0 0 270 262" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gradient" gradientTransform="rotate(90)">
      <stop offset="0%" stopColor="var(--color-one)" />
      <stop offset="100%" stopColor="var(--color-two)" />
    </linearGradient>
  </defs>
  <circle cx="135" cy="131" r="130.5" stroke="url(#gradient)" fill="none" />
</StyledSvg2>
        {/* Outer circle SVG, which scales when the inner circle is hovered */}
        <StyledSvg1 viewBox="0 0 302 302" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="151" cy="151" r="150.5" stroke="white" fill="none" />
        </StyledSvg1>
      </StyledHoverWrapper>
      {/* Text is always visible */}
      <StyledH2 onClick={() => navigate('/FirstSection')}>Explore</StyledH2>
  
    </StyledPreloader>
  );
}

export default Preloader;