import React from "react";
import styled from "styled-components";

const MainSection = styled.div`
  width: 1520px;
  height: 1270px;
  flex-shrink: 0;
  mix-blend-mode: hard-light;
  position: relative; // Ensure the positioning context for the pseudo-element
  overflow: hidden; // This will hide any part of the image that overflows the container
  &::before {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%); // Center the image
    min-width: 100%;
    min-height: 100%;
    width: auto;
    height: auto;
    background-image: url('/assets/images/image2.png');
    background-size: cover; // Cover the area of the MainSection
    background-repeat: no-repeat;
    background-position: center; // Center the image within the MainSection
    z-index: -1;
  }
`;

const StyledLeftH2 = styled.div`
width: 379px;
height: 88px;
flex-shrink: 0;
color: #FFF;
font-family: 'Orbitron', sans-serif;
font-size: 32px;
font-style: normal;
font-weight: 400;
line-height: normal;
color:#FFFFFF;
margin-top:250px;
margin-left:325px;
`;

const StyledLeftH4 = styled.div`
width: 346px;
height: 132px;
flex-shrink: 0;
color: #0FE;
font-family: K2D;
font-size: 16px;
font-style: normal;
font-weight: 300;
line-height: normal;
margin-left:325px;
`;

const StyledButton1 = styled.button`
  width: 107px;
  height: 42px;
  flex-shrink: 0;
  background: transparent; // Make button background transparent
  color: #00FFEE; // Text color is #00FFEE by default
  border: 1.5px solid #00FFEE; // Set border color to #00FFEE
  border-radius: 4px; // Rounded corners if you prefer
  cursor: pointer; // Changes the cursor to signify this is a button
  margin-left: 325px;
  margin-top: -50px; // Adjust this value as needed to move the button up
  transition: background-color 0.4s, color 0.4s; // Transition for smooth color change

  &:hover {
    background-color: #00FFEE; // Background color on hover
    color: #FFFFFF; // Text color on hover is white
  }
`;





const StyledRightH2 = styled.div`
width: 400px;
height: 88px;
flex-shrink: 0;
color: #FFF;
font-family: 'Orbitron', sans-serif;
font-size: 32px;
font-style: normal;
font-weight: 400;
line-height: normal;
color:#FFFFFF;
margin-top:210px;
margin-left:800px;
`;

const StyledRightH4 = styled.div`
width: 346px;
height: 132px;
flex-shrink: 0;
color: #0FE;
font-family: K2D;
font-size: 16px;
font-style: normal;
font-weight: 300;
line-height: normal;
margin-left:800px;
`;

const StyledButton2 = styled.button`
  width: 107px;
  height: 42px;
  flex-shrink: 0;
  background: transparent; // Button background is transparent
  color: #00FFEE; // Text color is #00FFEE by default
  border: 1.5px solid #00FFEE; // Border color is #00FFEE
  border-radius: 4px; // Rounded corners
  cursor: pointer; // Cursor to pointer to indicate it's a button
  margin-left: 1090px;
  margin-top: -50px; // Adjust this value as needed to move the button up
  transition: background-color 0.3s, color 0.3s; // Smooth transition for colors

  &:hover {
    background-color: #00FFEE; // Background color on hover
    color: #FFFFFF; // Text color on hover
  }
`;


function SecondSection() {
  return (
    <MainSection>

        <StyledLeftH2>Voice to Indian sign language.</StyledLeftH2>
        <StyledLeftH4>This ISL is used for easily communicate between deaf and blind.</StyledLeftH4>
        <StyledButton1>Try Now</StyledButton1>


        <StyledRightH2>Indian sign language to voice.</StyledRightH2>
        <StyledRightH4>This ISL is used for easily communicate between deaf and blind.</StyledRightH4>
        <StyledButton2>Try Now</StyledButton2>
      
    </MainSection>
  );
}

export default SecondSection;
