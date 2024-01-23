import React from 'react';
import styled from 'styled-components';

const StyledFooters = styled.div`
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  position: fixed;
  cursor: none;
  background-color: black; // Set background color to pink
`;

const Shaders = () => {
  return (
    <StyledFooters>
      {/* Your content will go here */}
    </StyledFooters>
  );
};

export default Shaders;