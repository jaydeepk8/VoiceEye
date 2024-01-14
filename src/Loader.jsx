import React from "react";
import { useNavigate } from 'react-router-dom';

import styled, { keyframes } from "styled-components";

const StyledLoader = styled.div`
// background: linear-gradient(90deg, rgba(8,21,27,1) 0%, rgba(9,29,38,1) 52%, rgba(8,25,33,1) 100%);
background : #0e2225;
width: 100vw;
height: 100vh;

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
cursor: pointer;


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
  border: 0.5px solid #C38C5C;
  position: absolute;
  transform: translate(-50%, -50%);
  transition: width 0.7s, height 0.7s; // Add transition for smooth shrinking
`;



const StyleH2 = styled.h2`

--bg-size: 400%;
--color-one: hsl(40, 47%, 56%); // RGB color converted to HSL
--color-two: hsl(30, 47%, 46%); // Darker shade of the same color
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

const StyleSmallTitle = styled.p`
  color: darkgray;
  font-family: 'Orbitron', sans-serif;
  font-size: 12px;
  position: absolute;
  justify-content: center;
  user-select: none;
  align-items: center;
  cursor: pointer;
  bottom: 40px;
  
  a {
    color: white;
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

  return (
    <StyledLoader>
      <StyledHoverWrapper>
        <ParentDiv onClick={() => navigate('/FirstSection')}>
          <Circle1 className="circle1" />
          <Circle2 className="circle2" />
          <StyleH2>Explore</StyleH2>
        </ParentDiv>
      </StyledHoverWrapper>
      <StyleSmallTitle onClick={() => navigate('/FirstSection')}>  
  By entering the site, you will able to see the content of the site.
  For more info check <a href="your_website_url">website</a>.
</StyleSmallTitle>
    </StyledLoader>
  );
}

export default Loader;  