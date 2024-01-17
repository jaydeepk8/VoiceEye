import React, { useRef, useEffect } from 'react';
import styled from 'styled-components';
import Globe from './Globe';







    // left side

const StyledFooters = styled.div`
width: 100vw;
height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: black;
  color: white;
  cursor: none;

`;

const LeftDiv = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  margin-right: 0px;
  width: 50vw;
  height: 70vh;

  display: flex;
  flex-direction: column;
//   justify-content: center; // Center children vertically in the column
  align-items: center; // Center children horizontally

  border-bottom: 1px solid gray;
    border-top: 1px solid gray;
    border-left: 1px solid gray;


`;






const StyledGlobeText = styled.text`

margin-top: 70px;
color: #FFF;
font-family: Orbitron;
font-size: 36px;
font-style: normal;
font-weight: 400;
line-height: normal;
z-index: 2;
`;



const StyleGlobe = styled.div`
  width: 714px;
  height: 563px;
  margin-top: -50px;



`;


const StyleGlobeBelow = styled.div`
  margin-top: -130px;
  display: flex;
  flex-direction: column;
`;

const EmailText = styled.p`
  color: #FFF;
  font-family: Orbitron;
  font-size: 16px;
  font-style: normal;
  font-weight: 400;
  line-height: normal;
`;

const StyledInput = styled.input`
  width: 300px;
  border: none;
  border-bottom: 0.8px solid gray;
  background-color: transparent;
  color: gray;
  text-align: center;
  outline: none;

`;




// right side





const RightDiv = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  width: 50vw;
  height: 70vh;
  border-right: 1px solid gray;
  border-top: 1px solid gray;
  border-left: 1px solid gray;


`;
const ChildDiv1 = styled.div`
  flex-grow: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  border-bottom: 1px solid gray;
  width: 100%;
  color: #FFF;
  font-family: 'Orbitron', sans-serif;
  font-size: 36px;
  font-style: normal;
  font-weight: 400;
  line-height: normal;
  &:hover {
    background-color: white;
    color: black;
    transition: 0.9s;
   }
  

`;


const ChildDiv2 = styled.div`
  flex-grow: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  border-bottom: 1px solid gray;
  width: 100%;
  color: #FFF;
  font-family: 'Orbitron', sans-serif;
  font-size: 36px;
  font-style: normal;
  font-weight: 400;
  line-height: normal;
  &:hover {
    background-color: #76BEB9;
    color: black;
    transition: 0.9s;
   }
  
`;

const ChildDiv3 = styled.div`
  flex-grow: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  border-bottom: 1px solid gray;
  width: 100%;
  color: #FFF;
  font-family: 'Orbitron', sans-serif;
  font-size: 36px;
  font-style: normal;
  font-weight: 400;
  line-height: normal;
  &:hover {
    background-color: white;
    color: black;
    transition: 0.9s;
   }
  
`;

const ChildDiv4 = styled.div`
  flex-grow: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  border-bottom: 1px solid gray;
  width: 100%;
  color: #FFF;
  font-family: 'Orbitron', sans-serif;
  font-size: 36px;
  font-style: normal;
  font-weight: 400;
  line-height: normal;
  &:hover {
    background-color: white;
    color: black;
    transition: 0.9s;
   }
  
`;




// bottom side




const BottomDiv = styled.div`
  position: absolute;
  margin-top: 0px;
  height: 27vh;
  width: 100vw;
  border-top: 1px solid gray;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  bottom: 20px;
  border-left: 1px solid gray;
  border-right: 1px solid gray;
  border-bottom: 1px solid gray;
`;

const BottomLeftDiv = styled.div`
//   background-color: red;
color: gray;
margin-bottom: 20px;
margin-left: 20px;
font-family: Orbitron;
font-size: 13px;
font-style: normal;
font-weight: 500;
line-height: 20px; /* 153.846% */

`;

const BottomCenterDiv = styled.div`
//   background-color: blue;
  align-self: center;
  color: #FFF;
  color: #FFF;

  // font-family: Libre Caslon Display;
  // font-family: Orbitron;
  font-family: 'Black Ops One', system-ui;
  font-size: 110px;
  font-style: normal;
  font-weight: 400;
  line-height: normal;
  letter-spacing: 1.28px;
  // font-style: italic;
`;

const BottomRightDiv = styled.div`
//   background-color: yellow;
margin-right: 20px;
color: gray;
margin-bottom: 20px;
margin-left: 20px;
font-family: Orbitron;
font-size: 13px;
font-style: normal;
font-weight: 500;
line-height: 20px; /* 153.846% */
`;


const Circle = styled.div`
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  z-index: 1000;
  // transition: left 0.1s ease-out, top 0.1s ease-out;
`;


const Circle1 = styled(Circle)`
  width: 7px;
  height: 7px;
  background: aqua;
  z-index: 1000;
  transform: translate(-50%, -50%);
  // transition: left 0.2s ease-out, top 0.2s ease-out;
`;

const Circle2 = styled(Circle)`
  width: 50px;
  height: 50px;
  border: 1px solid white;
  background: transparent;
  z-index: 1000;
  transform: translate(-50%, -50%);
`;




function Footers() {

  const circle1Ref = useRef();
  const circle2Ref = useRef();

  useEffect(() => {
    const moveCursor = (e) => {
      const { clientX: x, clientY: y } = e;
      circle1Ref.current.style.left = `${x}px`;
      circle1Ref.current.style.top = `${y}px`;
      circle2Ref.current.style.left = `${x}px`;
      circle2Ref.current.style.top = `${y}px`;
    };

    window.addEventListener("mousemove", moveCursor);

    return () => {
      window.removeEventListener("mousemove", moveCursor);
    };
  }, []);

    return (

      <StyledFooters>
          <Circle1 ref={circle1Ref} />
      <Circle2 ref={circle2Ref} />
        <LeftDiv>
          <StyledGlobeText>Open to the world</StyledGlobeText>
          <StyleGlobe>
            <Globe />
          </StyleGlobe>
          <StyleGlobeBelow>
            <EmailText>Email</EmailText>
            <StyledInput type="text" />
          </StyleGlobeBelow>
        </LeftDiv>
  
        <RightDiv>
          <ChildDiv1>About</ChildDiv1>
          <ChildDiv2>Project</ChildDiv2>
          <ChildDiv3>Goal</ChildDiv3>
          <ChildDiv4>Contact</ChildDiv4>
        </RightDiv>
  
        <BottomDiv>
          <BottomLeftDiv>Voice Eye Project</BottomLeftDiv>
          <BottomCenterDiv>VoiceEye</BottomCenterDiv>
          <BottomRightDiv>@Copyright 2024</BottomRightDiv>
        </BottomDiv>
      </StyledFooters>
    );
  }
  
  export default Footers;