import React from "react";
import React, { useEffect, useState } from 'react';
import styled from "styled-components";
import { createGlobalStyle } from 'styled-components';




const GlobalStyle = createGlobalStyle`
  body {
    cursor: none;
  }
`;




function Cursor() {

  
  return (
    <GlobalStyle />
    
  
  );
}

export default Cursor;
