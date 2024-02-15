import React, { useState } from "react";
import styled from "styled-components";

const StyledHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  position: absolute;
  width: 100%;
  top: 0;
  z-index: 10;
  margin-top: 40px;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const Logo = styled.div`
  color: #ffffff;
  font-family: "Libre Caslon Display", sans-serif;
  font-size: 48px;
  font-weight: 400;
  line-height: normal;
  margin-left: 200px;
  user-select: none;
  @media (max-width: 768px) {
    margin-left: 20px;
    font-size: 32px;
  }
`;

const NavLinks = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  flex-grow: 1;
  margin-right: 90px;

  @media (max-width: 768px) {
    display: ${(props) => (props.open ? "flex" : "none")};
    flex-direction: column;
    width: 100%;
    margin: 0;
  }
`;

const NavLink = styled.a`
  position: relative;
  display: inline-block;
  padding: 10px 20px;
  color: darkgray;
  text-decoration: none;
  transition: color 0.3s ease-in-out;

  &::after {
    content: "";
    position: absolute;
    width: 100%; // Change this line
    transform: scaleX(0);
    height: 1px;
    bottom: 0;
    left: 0;
    background-color: white;
    transform-origin: bottom right;
    transition: transform 0.25s ease-out;
  }

  &:hover {
    color: white;

    &::after {
      transform: scaleX(1);
      transform-origin: bottom left;
    }
  }
`;

const Hamburger = styled.div`
  display: none;
  flex-direction: column;
  justify-content: space-around;
  width: 2rem;
  height: 2rem;
  position: fixed;
  top: 55px;
  right: 40px;
  z-index: 30;
  cursor: pointer;

  div {
    width: 2rem;
    height: 0.25rem;
    background: #333;
    border-radius: 10px;
    transform-origin: 1px;
    transition: opacity 0.3s, transform 0.3s;

    :first-child {
      transform: ${({ open }) => (open ? "rotate(45deg)" : "rotate(0)")};
    }

    :nth-child(2) {
      opacity: ${({ open }) => (open ? "0" : "1")};
    }

    :nth-child(3) {
      transform: ${({ open }) => (open ? "rotate(-45deg)" : "rotate(0)")};
    }
  }

  @media (max-width: 768px) {
    display: flex;
  }
`;

function Header() {
  const [open, setOpen] = useState(false);

  return (
    <StyledHeader>
      <Logo>VoiceEye</Logo>
      <Hamburger open={open} onClick={() => setOpen(!open)}>
        <div />
        <div />
        <div />
      </Hamburger>
      <NavLinks open={open}>
        <NavLink href="#">Home</NavLink>
        <NavLink href="#">Project</NavLink>
        <NavLink href="#">ISL to Voice</NavLink>
        <NavLink href="#">Voice to ISL</NavLink>
      </NavLinks>
    </StyledHeader>
  );
}

export default Header;
