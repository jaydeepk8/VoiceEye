import React, { useState } from "react";

import styled from "styled-components";
import Header from "../Component/header/Header";

const StyledDeaf = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background-color: #000;
  align-items: center;
  justify-content: center;
`;

const Canvas = styled.div`
  flex-grow: 1;
  background-color: #040d11;
  border-radius: 10px;
  margin: 30px;
  width: 40%; // Adjust this value as needed
`;

const InputContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: absolute;
  bottom: 8rem; // Adjust this value for bottom padding
  left: 50%;
  transform: translateX(-50%);
  padding: 10px;
  background: none;
  border-radius: 10px;
  border: 1px solid #666;
  height: 50px;
  width: 40%; // Adjust this value as needed
`;

const Input = styled.input`
  flex-grow: 1;
  background: none;
  border: none;
  color: white;
  font-size: 0.8em; // Increase the height of text
  font-weight: 200; // Set font weight to 200
  ::placeholder {
    color: white;
  }
  &:focus {
    outline: none;
  }
`;
const Icon = styled.svg`
  path {
    stroke: ${({ hover }) => (hover ? "white" : "gray")};
  }
`;

function Deaf() {
  const [isSubmitIconHovered, setSubmitIconHovered] = useState(false);
  const [isVoiceIconHovered, setVoiceIconHovered] = useState(false);

  const SubmitIcon = () => (
    <Icon
      onMouseEnter={() => setSubmitIconHovered(true)}
      onMouseLeave={() => setSubmitIconHovered(false)}
      hover={isSubmitIconHovered}
      xmlns="http://www.w3.org/2000/svg"
      width="30"
      height="26"
      viewBox="0 0 24 21"
      fill="none"
    >
      <path
        d="M8.77136 6.73173H10.7205M8.77136 8.91954H10.7205M18.1272 9.34035V10.0219C18.1272 12.9914 15.3783 15.3989 11.9874 15.3989M11.9874 15.3989C8.59652 15.3989 5.84766 12.9914 5.84766 10.0219V9.34035M11.9874 15.3989L11.9872 17.6708M9.35571 17.6708H14.6184M11.9876 13.1269C10.0501 13.1269 8.47918 11.7705 8.47918 10.0976V5.55368C8.47918 3.88077 10.0501 2.52441 11.9876 2.52441C13.9252 2.52441 15.4961 3.88077 15.4961 5.55368V10.0976C15.4961 11.7705 13.9252 13.1269 11.9876 13.1269Z"
        stroke="white"
        stroke-opacity="0.6"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </Icon>
  );

  const VoiceIcon = () => (
    <Icon
      onMouseEnter={() => setVoiceIconHovered(true)}
      onMouseLeave={() => setVoiceIconHovered(false)}
      hover={isVoiceIconHovered}
      xmlns="http://www.w3.org/2000/svg"
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M16 12.001H5M16 12.001L12 8M16 12.001L12 16.002M19 5V19.001"
        stroke="white"
        stroke-opacity="0.5"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </Icon>
  );
  return (
    <StyledDeaf>
      <Header />
      <Canvas>{/* Add your 3D elements here */}</Canvas>
      <InputContainer>
        <Input placeholder="Convert Voice to ISL..." />
        <SubmitIcon />
        <VoiceIcon />
      </InputContainer>
    </StyledDeaf>
  );
}

export default Deaf;
