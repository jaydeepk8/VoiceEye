import React, { useState, useEffect } from "react";
import styled, { keyframes } from "styled-components";


const MainSection = styled.div`
  width: 100%;
  height: 1374px;
  flex-shrink: 0;
  background: #FFF;
  overflow: hidden; // Ensure the overflow from MovingText is hidden
`;


// moving text
const scroll = keyframes`
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
`;

const MovingTextContainer = styled.div`
  white-space: nowrap; // Prevent text from wrapping to a new line
  overflow: hidden; // Hide the overflowing text
  position: relative; // Use relative positioning
`;

const MovingText = styled.div`
color: #000;
font-family: Orbitron;
font-size: 64px;
font-style: normal;
font-weight: 700;
line-height: normal;
margin-top:135px;
  display: inline-block;
  animation: ${scroll} 16000s linear infinite;
  white-space: nowrap; // Ensure the text stays in one line
`;





const Section = styled.div`
width: 546px;
height: 643px;
flex-shrink: 0;
  position: sticky;
  top: 0;
  //background-size: cover;
  background-position: center;
  transition: opacity 5s ease-in-out;
  opacity: ${({ isActive }) => (isActive ? '-3' : '1')};
  background-image: ${({ imageUrl }) => `url(${imageUrl})`};
`;

const TextContent = styled.div`
  position: absolute;
  bottom: 10%;
  left: 5%;
  color: white;
`;









function ThirdSection() {

  const [activeSection, setActiveSection] = useState(0);




  const sectionsData = [
    {
      id: 1,
      imageUrl: '/assets/images/t1.png',
      text: '48 MP Main Camera',
    },
    {
      id: 2,
      imageUrl: '/assets/images/t1.png',
      text: '50 MP Ultra-Wide Camera',
    },
    // ... more sections
  ];



  const handleScroll = () => {
    const sectionHeight = window.innerHeight;
    const scrollY = window.scrollY; // Using scrollY instead of pageYOffset
    const currentSection = Math.floor(scrollY / sectionHeight);
    console.log('ScrollY:', scrollY, 'Current section:', currentSection);
    setActiveSection(currentSection);
  };
  

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);




    const text = "What is VoiceEye ";
    const repeatedText = new Array(1000).fill(null).map((_, index) => (
        <span key={index} style={{ marginRight: '45px' }}>{text}</span> // Add space between texts
      ));
  
      return (
        <MainSection>

          <MovingTextContainer>
            <MovingText>{repeatedText}</MovingText>
          </MovingTextContainer>


          {sectionsData.map((section, index) => {
          console.log(`Rendering section ${index}`, section);
          return (
          <Section
          key={section.id}
          isActive={activeSection === index}
          imageUrl={section.imageUrl}
          >
          <TextContent>{section.text}</TextContent>
          </Section>
          );
         })}
        </MainSection>
      );
    }
    
    export default ThirdSection;