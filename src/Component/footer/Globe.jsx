import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import styled from 'styled-components';


// globe lines
const Mat = () => {
    return new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true, // Make sure wireframe is true
      transparent: true,
      opacity: 0.5 // Adjust opacity to make it more or less transparent
    });
};

const StyleGlobe = styled.div`
  width: 614px;
  height: 463px;
 padding-left: 50px;

`;

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

    return <StyleGlobe ref={globeRef} />;
};


export default Globe;