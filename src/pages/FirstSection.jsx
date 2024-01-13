import React from "react";
import styled from "styled-components";

const Container = styled.div`
  position: relative; // Establish relative positioning context

  
`;



const MainSection = styled.div`
  background-color: #040D11;
  width: 100vw; // Full viewport width
  height: 100vh; // Full viewport height
  position: relative;
  z-index: 1;

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
    
`;


const FullPageContainer = styled.div`
  position: relative;  // Or 'absolute' if you want it relative to its parent container
  top: 0;
  left: 0;
  width: 100vw;     // 100% of the viewport width
  height: 100vh;    // 100% of the viewport height
  display: flex;
  // background-image: url('/assets/images/FirstSectionImg.png');
  justify-content: center;
  // background-color: #040D11;

  align-items: center;
`;

const SvgContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  
`;

const CenteredSvg = styled.svg`
  position: absolute;
  top: 82%;  // Adjust this value to move the SVG down
  left: 50%;
  transform: translate(-50%, -40%);  // Adjust the second value to fine-tune the vertical position
`;

const TextBelowSvg = styled.div`
  color: white;
   font-family: K2D;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: normal;
 
   margin-top: 680px;  // Adjust this value for spacing between the SVG and the text
  
`;

const BottomTextContainer = styled.div`
font-family: 'Oooh Baby', sans-serif;
  position: absolute; // Positioning relative to the FullPageContainer
  bottom: 20px;
  width: 100%; // Ensure it spans the width of the page
  display: flex;
  justify-content: center; // This centers the BottomText
`;

const BottomText = styled.div`
  
  bottom: 20px;    // Distance from the bottom of the screen
  left: 50%;       // Center horizontally
  transform: translateX(-50%); // Center align the text block horizontally
  width: 315px;
  height: 69px;
  flex-shrink: 0;
  color: #FFF;
  font-family: K2D;
  font-size: 16px;
  font-style: italic;
  font-weight: 100;
  line-height: normal;
  color: white;
  margin-left: 1500px;
  margin-right: 90px;
  margin-bottom: 50px;
`;

function FirstSection() {
    return (
      <>
        
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
