
import { useNavigate } from 'react-router-dom';
import React, { useEffect, useState, useRef } from "react";

import styled, { keyframes } from "styled-components";

import Music2 from './Music/Music2.mp3'; // Import the audio file
import Explore1 from './Music/Explore1.mp3'; // Import the audio file



// New styled component for the custom cursor
const CustomCursor = styled.div`
  width: ${props => props.isHovered ? '38px' : '8px'};
  height: ${props => props.isHovered ? '38px' : '8px'};
  border-radius: 50%;
  background: rgba(0, 255, 255, 0.5);
  position: fixed;
  transform: translate(-50%, -50%);
  pointer-events: none;
  z-index: 9999;
  transition: width 0.3s, height 0.3s; // Add transition for smooth resizing
`;
// ... rest of your code ...






const StyledLoader = styled.div`
// background: linear-gradient(90deg, rgba(8,21,27,1) 0%, rgba(9,29,38,1) 52%, rgba(8,25,33,1) 100%);
// background : #0e2225;
background: black;
width: 100vw;
height: 100vh;
cursor: none;
display: flex;
justify-content: center;
align-items: center;
position: relative;

`;


const StyledHoverWrapper = styled.div`



top: 50%;
left: 50%;
position: absolute;
align-items: center;
justify-content: center;



`;
const ParentDiv = styled.div`
  &:hover {
    .circle1 { // Use class selector to select Circle1
      width: 190px; // Shrink width by 50px
      height: 190px; // Shrink height by 50px
    }

    .circle2 { // Use class selector to select Circle2
      width: 220px; // Shrink width by 100px
      height: 220px; // Shrink height by 100px
    }
  }
`;

const Circle1 = styled.div`
  top: 50%;
  left: 50%;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  border: 0.5px solid rgba(255, 255, 255, 0.20);
  position: absolute;
  transform: translate(-50%, -50%);
  transition: width 0.7s ease, height 0.7s ease; // Add transition with ease function
`;

const Circle2 = styled.div`
  top: 50%;
  left: 50%;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  border: 0.5px solid aqua;
  position: absolute;
  transform: translate(-50%, -50%);
  transition: width 0.7s, height 0.7s; // Add transition for smooth shrinking
`;



const StyleH2 = styled.h2`

--bg-size: 400%;
--color-one: hsl(180, 100%, 50%); // Aqua color
--color-two: hsl(180, 100%, 50%); // Aqua color
font-family: 'Orbitron', sans-serif;
font-size: 14px;
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

const StyleSmallTitle = styled.p`
  color: darkgray;
  font-family: 'Orbitron', sans-serif;
  font-size: 12px;
  position: absolute;
  justify-content: center;
  user-select: none;
  align-items: center;

  bottom: 40px;
  
  a {
    color: aqua;
  }


  @media (max-width: 768px) {
    font-size: 8px;
  }

  @media (max-width: 480px) {
    font-size: 6px;
  }
`;






function Loader() {
  const navigate = useNavigate();
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false); // New state for hover status

  // Update cursor position
  const updateCursor = (e) => {
    setCursorPosition({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    window.addEventListener("mousemove", updateCursor);
    return () => window.removeEventListener("mousemove", updateCursor);
  }, []);
  
  const [hasAudioPlayed, setHasAudioPlayed] = useState(false);
const audioRef = useRef(null);
const [hasExploreAudioPlayed, setHasExploreAudioPlayed] = useState(false);
const exploreAudioRef = useRef(null);

  return (
<StyledLoader
  onClick={() => {
    if (!hasAudioPlayed) {
      audioRef.current.play();
      setHasAudioPlayed(true);
    }
  }}
>
 <audio ref={audioRef}>
  <source src={Music2} type="audio/mpeg" />
</audio>
<audio ref={exploreAudioRef}>
  <source src={Explore1} type="audio/mpeg" />
</audio>
      <CustomCursor style={{ left: `${cursorPosition.x}px`, top: `${cursorPosition.y}px` }} isHovered={isHovered} />
      <StyledHoverWrapper>
      <ParentDiv 
  onClick={() => {
    navigate('/FirstSection');
  }}
  onMouseEnter={() => {
    exploreAudioRef.current.play();
    setIsHovered(true); // Set isHovered to true when mouse enters
  }}
  onMouseLeave={() => setIsHovered(false)} // Set isHovered to false when mouse leaves
>
  <Circle1 className="circle1" />
  <Circle2 className="circle2" />
  <StyleH2>Explore</StyleH2>
</ParentDiv>
      </StyledHoverWrapper>
      <StyleSmallTitle 
        onClick={() => navigate('/FirstSection')}
        onMouseEnter={() => setIsHovered(true)} // Set isHovered to true when mouse enters
        onMouseLeave={() => setIsHovered(false)} // Set isHovered to false when mouse leaves
      >  
        By entering the site, you will able to see the content of the site.
        For more info click on  <a href="your_website_url">Explore</a>.
      </StyleSmallTitle>
    </StyledLoader>
  );
}

export default Loader;