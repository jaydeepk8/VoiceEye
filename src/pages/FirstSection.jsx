import React, { useEffect, useState } from 'react';
import styled from "styled-components";
import Header from '../Component/header/Header'; 
import Cursor from "../Component/Cursor";




const Container = styled.div`
  position: relative; // Establish relative positioning context
cursor: none;
  
`;



const MainSection = styled.div`
  background-color: #040D11;
  width: 100vw; // Full viewport width
  height: 100vh; // Full viewport height
  position: relative;
  z-index: 1;
  cursor: none;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: url('/assets/images/FirstSectionImg.png');
    
    background-size: contain;
    background-repeat: no-repeat;
    opacity: 0.80; // Adjust the opacity as needed
    mix-blend-mode: color-dodge; // Add Color Dodge effect
    z-index: -1;
  }

  @media (max-width: 768px) {

    font-size: 32px; 
 





    mix-blend-mode: color-dodge; // Add Color Dodge effect

  }
  }
`;


const Title = styled.h1`
    width: 750px;
    color: #FFF;
    text-align: center;
    font-family: 'Orbitron', sans-serif;
    font-size: 100px;
    font-style: normal;
    font-weight: 400;
    line-height: normal;
    position: absolute;
    top: 50%; // Adjust this value as needed to match your design
    left: 50%; // Center horizontally
    transform: translate(-50%, -50%);
    letter-spacing: 0.1em; // Spacing between letters, adjust as needed
    text-align: center; // Center align the text
    z-index: 2;
    user-select: none; // Disable text selection
    @media (max-width: 768px) {
      font-size: 1em;
     
      
    }
`;

const FullPageContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  height: 100%;
`;
const SvgContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 20px 0;

  @media (max-width: 768px) {
    margin: 10px 0;
  }
`;

const CenteredSvg = styled.svg`
  position: absolute;
  top: 82%;  // Adjust this value to move the SVG down
  left: 50%;
  transform: translate(-50%, -40%);  // Adjust the second value to fine-tune the vertical position

// circle animation here

rect {
  fill: none;
  stroke: white;
  
}

circle {
  fill: #D9D9D9;
  animation: moveUpDown 2s ease-in-out infinite;
}

@keyframes moveUpDown {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}
  `;

const TextBelowSvg = styled.div`
  color: darkgray;
  font-family: K2D;
  font-size: 12px;
  font-style: italic;
  font-weight: 400;
  line-height: normal;
  user-select: none;
  margin-top: 770px;  // Adjust this value for spacing between the SVG and the text
  
  @media (max-width: 768px) {
    margin-top: 770px;  // Adjust this value for smaller screens
  }
`;


const BottomTextContainer = styled.div`
  font-family: K2D;
  display: flex;
  justify-content: center;
  user-select: none;
  width: 100%;
  text-align: center;
  margin-bottom: 20px;

  @media (max-width: 768px) {
    margin-bottom: 10px;
  }
`;


const BottomText = styled.div`
  color: darkgray;
  font-family: K2D;
  font-size: 16px;
  font-style: italic;
  font-weight: 50;
  line-height: normal;
  user-select: none;
  text-align: center;
  margin-bottom: 20px; // Adjust this value as needed

  @media (max-width: 768px) {
    font-size: 12px;
  }
`;






function FirstSection() {
 
  return (
    <>
      <Cursor />
      <Header />
      <MainSection>
        <FullPageContainer>
          <Title>A Story of Growth</Title>
          <SvgContainer>
            <CenteredSvg xmlns="http://www.w3.org/2000/svg" width="25" height="45" viewBox="0 0 27 47" fill="none">
              <rect x="0.5" y="0.5" width="26" height="46" rx="13" stroke="white"/>
              <circle cx="13.5" cy="30.5" r="4.5" fill="#D9D9D9"/>
            </CenteredSvg>
            <TextBelowSvg>
              Scroll  More
            </TextBelowSvg>
          </SvgContainer>
          <BottomTextContainer>
            <BottomText>
              "We are here to bridge the communication gap between the blind, deaf, and mute."
            </BottomText>
          </BottomTextContainer>
        
        </FullPageContainer>
      </MainSection>
    </>
  );
}

export default FirstSection;