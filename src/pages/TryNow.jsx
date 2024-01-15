import React from "react";
import styled from "styled-components";



const StyledTryNow = styled.div`
  width: 110vw;
    height: 90vh;
background : black;
background-image: url('/assets/images/image2.png');
background-repeat: no-repeat;
background-size: cover;
position: relative;





`;


const StyleRightLeft = styled.div`

align-items: center;
justify-content: center;

background-color: white;
top: 50%;

`;


function TryNow() {
    return (
        <StyledTryNow>
        
        <StyleRightLeft>

        </StyleRightLeft>


        </StyledTryNow>
    );
}

export default TryNow;