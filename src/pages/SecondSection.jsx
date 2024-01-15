import React from "react";
import styled from "styled-components";
import backgroundImage from '/assets/images/image2.png';


const MainSection = styled.div`
width: 100%;
height: 1400px;
  flex-shrink: 0;
  background: black url(${backgroundImage}) no-repeat center center/cover;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  overflow: hidden;
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
margin-top:-79%;
margin-left:-10%;
`;

const StyledLeftH4 = styled.div`
width: 346px;
height: 80px;
flex-shrink: 0;
color: #0FE;
font-family: K2D;
font-size: 16px;
font-style: normal;
font-weight: 300;
line-height: normal;


margin-left:-10%;
`;

const StyledButton1 = styled.button`
  width: 107px;
  height: 42px;
  flex-shrink: 0;
  background: transparent; // Make button background transparent
  color: #00FFEE; // Text color is #00FFEE by default
  color: #D9FFEA;
  border: 1.5px solid #FFFFFF; // Set border color to #00FFEE

  cursor: pointer; // Changes the cursor to signify this is a button

  margin-left:-10%; // Adjust this value as needed to move the button up

  transition: background-color 0.6s, color 0.6s; // Transition for smooth color change

  &:hover {
    background-color:  #D9FFEA; // Background color on hover
    opacity: 0.9;
    color: black ;// Text color on hover is white
    font-weight: bold;
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
margin-top:310px;
text-align: right;
margin-left:100px;
`;

const StyledRightH4 = styled.div`
width: 346px;
height:80px;
flex-shrink: 0;
color: #0FE;
text-align: right;
font-family: K2D;
font-size: 16px;
font-style: normal;
font-weight: 300;
line-height: normal;
margin-left:150px;

`;

const StyledButton2 = styled.button`
  width: 107px;
  height: 42px;
  flex-shrink: 0;
  background: transparent; // Button background is transparent
  color: #00FFEE; // Text color is #00FFEE by default
  color: #D9FFEA;
  border: 1.5px solid #FFFFFF; // Set border color to #00FFEE
  cursor: pointer; // Cursor to pointer to indicate it's a button
  margin-left:400px;
margin-top: 10px // Adjust this value as needed to move the button up
  transition: background-color 0.3s, color 0.3s; // Smooth transition for colors

  &:hover {
    background-color:  #D9FFEA; // Background color on hover
    opacity: 0.9;
    color: black ;// Text color on hover is white
    font-weight: bold;
  }
`;

function SecondSection() {
  return (
    <MainSection>
      <div>
        <StyledLeftH2>Voice to Indian sign language.</StyledLeftH2>
        <StyledLeftH4>This ISL is used for easily communicate between deaf and blind.</StyledLeftH4>
        <StyledButton1>Try Now</StyledButton1>
      </div>

      <div>
        <StyledRightH2>Indian sign language to voice.</StyledRightH2>
        <StyledRightH4>This ISL is used for easily communicate between deaf and blind.</StyledRightH4>
        <StyledButton2>Try Now</StyledButton2>
      </div>
    </MainSection>
  );
}

export default SecondSection;
