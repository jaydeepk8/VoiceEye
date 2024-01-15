import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import styled from 'styled-components';

const StyledFooter = styled.div`
width: 1520px;
height: 770px;
flex-shrink: 0;
background: #000;
`;



// moving globe section
const StyledGlobe = styled.div`
  width: 714px;
  height: 563px;
  flex-shrink: 0;
  position: relative; // Required for positioning the pseudo-elements

  &:after {
    content: ""; // Required for pseudo-elements
    position: absolute; // Position relative to StyledGlobe
    right: 0; // Align to the right side of StyledGlobe
    top: 0; // Align to the top
    width: 1px; // Line width
    height: 563px; // Line height
    background: #393939; // Line color
  }

  &:before {
    content: ""; // Required for pseudo-elements
    position: absolute; // Position relative to StyledGlobe
    left: 0; // Align to the left side of StyledGlobe
    bottom: 0; // Align to the bottom
    width: 1520px; // Line width
    height: 1px; // Line height
    background: #393939; // Line color
  }
`;

// text above the globe
const StyledGlobeText = styled.text`
color: #FFF;
font-family: Orbitron;
font-size: 36px;
font-style: normal;
font-weight: 400;
line-height: normal;
margin-left: 180px;
position: absolute;
top:50px;
`;




// globe lines
const Mat = () => {
  return new THREE.MeshBasicMaterial({
    color: 0xffffff,
    wireframe: true, // Make sure wireframe is true
    transparent: true,
    opacity: 0.5 // Adjust opacity to make it more or less transparent
  });
};



// rotating globe
const Globe = () => {
    const globeRef = useRef();
  
    useEffect(() => {
      
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, globeRef.current.clientWidth / globeRef.current.clientHeight, 0.1, 1000);
      
      const renderer = new THREE.WebGLRenderer();
      renderer.setSize(globeRef.current.clientWidth, globeRef.current.clientHeight);
      globeRef.current.appendChild(renderer.domElement); // Attach the renderer to the DOM
  
      const spotLight = new THREE.SpotLight(0xffffff);
      spotLight.position.set(100, 100, 100);
      scene.add(spotLight);
  
      const material = new THREE.MeshPhongMaterial({
        color: new THREE.Color("rgb(35,35,213)"),
        emissive: new THREE.Color("rgb(64,128,255)"),
        specular: new THREE.Color("rgb(93,195,255)"),
        shininess: 1,
        shading: THREE.FlatShading,
        wireframe: 1,
        transparent: 1,
        opacity: 0.15
      });
  
      
      const geometry = new THREE.SphereGeometry(30, 20, 20);
   
      const earth = new THREE.Mesh(geometry, Mat());
      scene.add(earth);
  
      camera.position.z = 90;
  
      const animate = () => {
        requestAnimationFrame(animate);
      
        earth.rotation.y += 0.005; // Decreased rotation speed
      
        renderer.render(scene, camera);
      };
   
      animate();
 
      const handleResize = () => {
        camera.aspect = globeRef.current.clientWidth / globeRef.current.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(globeRef.current.clientWidth, globeRef.current.clientHeight);
      };
  
      window.addEventListener('resize', handleResize);
  
      return () => {
        window.removeEventListener('resize', handleResize);
        globeRef.current.removeChild(renderer.domElement);
      };
    }, []);
  
    return <StyledGlobe ref={globeRef} />;
  };


// globe icon svg
  const StyledGlobeSvg = styled.svg`
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  position: absolute; 
  top: 460px; 
  left: 150px;
`;

// share icon svg
const StyledShareSvg = styled.svg`
width: 23px;
height: 23px;
flex-shrink: 0;
position: absolute; 
top: 460px; 
left: 210px;
`;



// navigation items section
const StyledFooterNavsContainer = styled.div`
flex-shrink: 0;
position: relative;
`;

const StyledNavItem = styled.div`
  color: #FFF;
  font-family: 'Orbitron', sans-serif;
  font-size: 36px;
  font-style: normal;
  font-weight: 400;
  line-height: normal;
  position: absolute;
  left: 1050px;
`;





// footer bottom section
const StyledBottomItems = styled.div`
width: 464px;
height: 146px;
flex-shrink: 0;
color: #FFF;
font-family: 'Libre Caslon Display', sans-serif;
font-size: 128px;
font-style: normal;
font-weight: 400;
line-height: normal;
letter-spacing: 1.28px;
margin-left:520px;
`;


const StyledVoiceEyeText = styled.text`
color: #FFF;
font-family: Poppins;
font-size: 13px;
font-style: normal;
font-weight: 500;
line-height: 20px; /* 153.846% */
margin-left:100px;
`;

const StyledCopyRight = styled.text`
width: 114px;
height: 19px;
flex-shrink: 0;
color: #FFF;
font-family: 'Poppins', sans-serif;
font-size: 13px;
font-style: normal;
font-weight: 500;
line-height: 20px;
margin-left:1100px;

`;



function Footer() {
    return (
      <StyledFooter>

        <StyledGlobe>
            <Globe />
            <StyledGlobeText>Open to the world</StyledGlobeText>
            <StyledGlobeSvg>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M3.5 12C3.5 16.6944 7.30558 20.5 12 20.5C16.6944 20.5 20.5 16.6944 20.5 12M3.5 12C3.5 7.30558 7.30558 3.5 12 3.5C16.6944 3.5 20.5 7.30558 20.5 12M3.5 12H20.5M10.2695 4.50108C7.54016 9.05783 7.54016 14.9424 10.2695 19.4992C11.0685 20.8336 12.9318 20.8336 13.7307 19.4992C16.4601 14.9424 16.4601 9.05783 13.7307 4.50108C12.9308 3.16663 11.0685 3.16663 10.2695 4.50108Z" stroke="#F2F2F2" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            </StyledGlobeSvg>

            <StyledShareSvg><svg xmlns="http://www.w3.org/2000/svg" width="23" height="23" viewBox="0 0 23 23" fill="none">
            <path fill-rule="evenodd" clip-rule="evenodd" d="M18.0115 4.98873C17.2379 4.21515 15.9837 4.21515 15.2101 4.98873C14.6212 5.57759 14.4806 6.44494 14.7882 7.16681C14.8121 7.19706 14.8332 7.23017 14.8511 7.26597C14.8692 7.30214 14.8831 7.3393 14.893 7.37692C14.9781 7.52467 15.0838 7.6638 15.2101 7.79011C15.9837 8.56369 17.2379 8.56369 18.0115 7.79011C18.785 7.01653 18.785 5.76231 18.0115 4.98873ZM14.3969 4.17556C13.5647 5.00775 13.2989 6.19187 13.5996 7.24885L8.88327 9.60701C8.79835 9.49544 8.70494 9.38826 8.60304 9.28636C7.38036 8.06367 5.398 8.06367 4.17531 9.28636C2.95263 10.509 2.95263 12.4914 4.17531 13.7141C5.398 14.9368 7.38036 14.9368 8.60304 13.7141C8.70499 13.6121 8.79843 13.5049 8.88338 13.3933L13.5996 15.7514C13.2989 16.8084 13.5647 17.9926 14.3969 18.8249C15.6196 20.0476 17.602 20.0476 18.8246 18.8249C20.0473 17.6022 20.0473 15.6198 18.8246 14.3972C17.602 13.1745 15.6196 13.1745 14.3969 14.3972C14.2936 14.5005 14.199 14.6092 14.1132 14.7224L9.39878 12.3653C9.5605 11.8007 9.56048 11.1996 9.39873 10.635L14.1131 8.27785C14.1989 8.39115 14.2936 8.49993 14.3969 8.60329C15.6196 9.82597 17.602 9.82597 18.8246 8.60329C20.0473 7.3806 20.0473 5.39824 18.8246 4.17556C17.602 2.95287 15.6196 2.95287 14.3969 4.17556ZM8.20491 12.2934C8.42517 11.7888 8.4251 11.2111 8.20471 10.7066C8.18385 10.6789 8.16521 10.649 8.14917 10.6169C8.13335 10.5853 8.12073 10.5529 8.11117 10.5201C8.02539 10.3696 7.91829 10.2279 7.78987 10.0995C7.01629 9.32595 5.76207 9.32595 4.98849 10.0995C4.21491 10.8731 4.21491 12.1273 4.98849 12.9009C5.76207 13.6745 7.01629 13.6745 7.78987 12.9009C7.91823 12.7726 8.02529 12.631 8.11105 12.4805C8.12062 12.4476 8.13329 12.4151 8.14917 12.3833C8.16526 12.3511 8.18397 12.3211 8.20491 12.2934ZM14.7884 15.8332C14.8122 15.803 14.8332 15.77 14.8511 15.7343C14.8691 15.6982 14.883 15.6612 14.8929 15.6237C14.978 15.4759 15.0837 15.3367 15.2101 15.2103C15.9837 14.4367 17.2379 14.4367 18.0115 15.2103C18.785 15.9839 18.785 17.2381 18.0115 18.0117C17.2379 18.7853 15.9837 18.7853 15.2101 18.0117C14.6211 17.4227 14.4806 16.5552 14.7884 15.8332Z" fill="#F1FFFE"/></svg>
            </StyledShareSvg>

        </StyledGlobe>

        <StyledFooterNavsContainer>
          {/* Use StyledNavItem for each item and adjust the top value accordingly */}
          <StyledNavItem style={{ top: '-510px' }}>About</StyledNavItem>
          <StyledNavItem style={{ top: '-390px' }}>Project</StyledNavItem>
          <StyledNavItem style={{ top: '-260px' }}>Goal</StyledNavItem>
          <StyledNavItem style={{ top: '-140px' }}>Contact</StyledNavItem>
        </StyledFooterNavsContainer>

        <StyledBottomItems>VoiceEye</StyledBottomItems>
        <StyledVoiceEyeText>VoiceEye Project</StyledVoiceEyeText>
        <StyledCopyRight> @Copyright2024</StyledCopyRight>
        

      </StyledFooter>
    );
  }
  
  export default Footer;