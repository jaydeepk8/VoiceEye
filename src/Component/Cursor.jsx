import React, { useEffect, useRef } from "react";
import styled from "styled-components";

const StyledDefault = styled.div`

  
  position: relative;
  z-index: 1000;
  cursor: none;
`;

const Circle = styled.div`
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  // transition: left 0.1s ease-out, top 0.1s ease-out;
`;

const Circle1 = styled(Circle)`
  width: 7px;
  height: 7px;
  background: aqua;
  transform: translate(-50%, -50%);
  // transition: left 0.2s ease-out, top 0.2s ease-out;
`;

const Circle2 = styled(Circle)`
  width: 50px;
  height: 50px;
  border: 1px solid white;
  background: transparent;
  transform: translate(-50%, -50%);
`;

function Cursor() {
  const circle1Ref = useRef();
  const circle2Ref = useRef();

  useEffect(() => {
    const moveCursor = (e) => {
      const { clientX: x, clientY: y } = e;
      circle1Ref.current.style.left = `${x}px`;
      circle1Ref.current.style.top = `${y}px`;
      circle2Ref.current.style.left = `${x}px`;
      circle2Ref.current.style.top = `${y}px`;
    };

    window.addEventListener("mousemove", moveCursor);

    return () => {
      window.removeEventListener("mousemove", moveCursor);
    };
  }, []);

  return (
    <StyledDefault>
      <Circle1 ref={circle1Ref} />
      <Circle2 ref={circle2Ref} />
    </StyledDefault>
  );
}

export default Cursor;