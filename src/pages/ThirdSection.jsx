import React, { useState, useEffect } from "react";
import styled, { keyframes } from "styled-components";

const scroll = keyframes`
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
`;

const fadeIn = keyframes`
  0% { opacity: 0; transform: translateY(50px); }
  100% { opacity: 1; transform: translateY(0); }
`;

const MainSection = styled.div`
  width: 100vw;
  height: 100vh;
  flex-shrink: 0;
  background: #FFF;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
`;

const MovingTextContainer = styled.div`
  position: absolute;
  top: 0%;
`;

const MovingText = styled.div`
  margin-top: 70px;
  color: #000;
  font-family: Orbitron;
  font-size: 64px;
  font-style: normal;
  font-weight: 700;
  line-height: normal;
  display: inline-block;
  animation: ${scroll} 16000s linear infinite;
  white-space: nowrap;
`;

const GrayWrap = styled.div`
  position: absolute;
  top: 20%;

  height: 75vh;
  width: 90vw;
  background-color: #B5B5B5;
  
  border-radius: 50px;
  display: flex;
  justify-content: center;
  align-items: center;

`;

const ScrollContent = styled.div`
  width: 80vw;
  position: absolute;
  top: 5%;
  height: 80vh;
  display: flex;
  justify-content: center;
  align-items: center;
  opacity: 0;
  animation: ${fadeIn} 1s forwards;
`;

const ImageContainer = styled.div`
  flex: 1;
  display: flex;
  justify-content: center;
`;

const TextContainer = styled.div`
  flex: 1;
  display: flex;
  justify-content: center;
`;

function ThirdSection() {
  const [activeSection, setActiveSection] = useState(0);
  const sectionsData = [
    {
      id: 1,
      imageUrl: '/assets/images/t1.png',
      text: 'We are here to make it possible for blind, deaf, and mute people to communicate with each other and with the rest of the world. ',
    },
    {
      id: 2,
      imageUrl: '/assets/images/t2.png',
      text: 'We are developing technologies and solutions that will help them to overcome the communication barriers that they face. ',
    },
    {
      id: 3,
      imageUrl: '/assets/images/t3.png',
      text: '“We believe that everyone should have the opportunity to communicate and connect with others, regardless of their disability. We are working to create a world where everyone has a voice.”',
    },
  ];

  useEffect(() => {
    const handleWheel = (event) => {
      if (event.deltaY > 0 && activeSection < sectionsData.length - 1) {
        setActiveSection(activeSection + 1);
      } else if (event.deltaY < 0 && activeSection > 0) {
        setActiveSection(activeSection - 1);
      }
    };

    window.addEventListener("wheel", handleWheel);

    return () => {
      window.removeEventListener("wheel", handleWheel);
    };
  }, [activeSection, sectionsData.length]);

  const text = "What is VoiceEye ";
  const repeatedText = new Array(1000).fill(null).map((_, index) => (
    <span key={index} style={{ marginRight: '45px' }}>{text}</span>
  ));
  return (
    <MainSection>
      <MovingTextContainer>
        <MovingText>{repeatedText}</MovingText>
      </MovingTextContainer>
      <GrayWrap>
        {sectionsData.map((section, index) => (
          <ScrollContent
            key={`${section.id}-${activeSection}`}
            data-id={index}
          >
            {activeSection === index && (
              <>
                <ImageContainer>
                  <img src={section.imageUrl} alt="Section" />
                </ImageContainer>
                <TextContainer>
                  <p>{section.text}</p>
                </TextContainer>
              </>
            )}
          </ScrollContent>
        ))}
      </GrayWrap>
    </MainSection>
  );
}

export default ThirdSection;