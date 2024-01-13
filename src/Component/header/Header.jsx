import React from "react";
import styled from "styled-components";

const StyledHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  position: absolute; // Position the header over the MainSection
  width: 100%; // Header should span the full width
  top: 0; // Align the header to the top of the Container
  z-index: 10; // Ensure the header is above the MainSection
  // Add any additional styling for the header here
  margin-top:40px;
`;



const Logo = styled.div`
  color: #FFFFFF;
  font-family: 'Libre Caslon Display', sans-serif;
  font-size: 48px;
  font-weight: 400;
  line-height: normal;
  margin-left: 200px;
  user-select: none;
`;

const NavLinks = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  flex-grow: 1;
  margin-right: 90px;
`;

const NavLink = styled.div`
  margin-left: 50px;
  cursor: pointer;
  color: white;
  font-family: K2D;
  font-size: 14px;
  user-select: none;
`;


function Header() {
    return (
        <StyledHeader>
        <Logo>VoiceEye</Logo>
        <NavLinks>
          <NavLink>[Home]</NavLink>
          <NavLink>[Project]</NavLink>
          <NavLink>[Goal]</NavLink>
          <NavLink>[Contact]</NavLink>
        </NavLinks>
        
      </StyledHeader>
    );
  }
  
  export default Header;