import React, { useState, useEffect, useRef } from "react";
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
  background: #fff;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;

  @media (max-width: 768px) {
    flex-direction: column;
  }
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
  background: linear-gradient(132deg, #819cfd 1.06%, #ffa0f6 98.9%);

  border-radius: 50px;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const ScrollContent = styled.div`
  width: 80vw;
  position: absolute;
  height: 80vh;
  display: flex;
  justify-content: center;
  align-items: center;
  opacity: 0;
  animation: ${fadeIn} 1s forwards;

  @media (max-width: 768px) {
    flex-direction: column;
    height: auto;
    width: auto;
  }
`;
const ImageContainer = styled.div`
  flex: 1;
  display: flex;
  justify-content: center;

  @media (max-width: 768px) {
    margin-top: -80px;
    max-width: 90%; // or whatever size you want
    padding: 25px 25px 20px 30px;
  }
`;

const TextContainer = styled.div`
  flex: 1;
  display: flex;
  justify-content: center;
  padding: 0 50px;

  @media (max-width: 768px) {
    width: 100%;
    padding: 25px 25px 50px 50px;
  }
`;

const Image = styled.img`
  max-width: 100%;

  height: auto;
  /* Add your styles here */
`;

const Text = styled.p`
  font-size: 16px;
  color: black;
  /* Add your styles here */

  font-family: K2D;
  font-size: 32px;
  font-style: italic;
  font-weight: 400;
  line-height: normal;
  letter-spacing: 0.64px;

  @media (max-width: 768px) {
    font-family: K2D;
    font-size: 26px;
    font-style: italic;
    font-weight: 400;
    line-height: normal;
    letter-spacing: 0.64px;
  }
`;

function ThirdSection() {
  const [activeSection, setActiveSection] = useState(0);
  const sectionRef = useRef(null);
  console.log("activeSection", activeSection);
  const sectionsData = [
    {
      id: 1,
      imageUrl: "/assets/images/t1.png",
      text: "We are here to make it possible for blind, deaf, and mute people to communicate with each other and with the rest of the world. ",
    },
    {
      id: 2,
      imageUrl: "/assets/images/t2.png",
      text: "We are developing technologies and solutions that will help them to overcome the communication barriers that they face. ",
    },
    {
      id: 3,
      imageUrl: "/assets/images/t3.png",
      text: "“We believe that everyone should have the opportunity to communicate and connect with others, regardless of their disability. We are working to create a world where everyone has a voice.”",
    },
  ];
  useEffect(() => {
    const handleWheel = (event) => {
      const bounding = sectionRef.current.getBoundingClientRect();
      if (bounding.top >= 0 && bounding.bottom <= window.innerHeight) {
        if (event.deltaY > 0 && activeSection < sectionsData.length - 1) {
          setActiveSection(activeSection + 1);
        } else if (event.deltaY < 0 && activeSection > 0) {
          setActiveSection(activeSection - 1);
        }
      }
    };

    window.addEventListener("wheel", handleWheel);

    return () => {
      window.removeEventListener("wheel", handleWheel);
    };
  }, [activeSection, sectionsData.length]);

  const text = "What is VoiceEye ";
  const repeatedText = new Array(1000).fill(null).map((_, index) => (
    <span key={index} style={{ marginRight: "45px" }}>
      {text}
    </span>
  ));
  return (
    <MainSection ref={sectionRef}>
      <MovingTextContainer>
        <MovingText>{repeatedText}</MovingText>
      </MovingTextContainer>
      <GrayWrap>
        {sectionsData.map((section, index) => (
          <ScrollContent
            key={`${section.id}-${activeSection}`}
            data-id={index}
            style={{
              position: activeSection === index ? "relative" : "absolute",
            }} // Add this line
          >
            {activeSection === index && (
              <>
                <ImageContainer>
                  <Image src={section.imageUrl} alt="Section" />
                </ImageContainer>
                <TextContainer>
                  <Text>{section.text}</Text>
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
