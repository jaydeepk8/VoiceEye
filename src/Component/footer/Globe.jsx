import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import styled from 'styled-components';

// globe lines
const Mat = () => {
    return new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true, // Make sure wireframe is true
      transparent: true,
      opacity: 1.0 // Keep the globe fully visible
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
        const mount = globeRef.current;
        if (!mount) return undefined;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.1, 1000);

        const renderer = new THREE.WebGLRenderer({ alpha: true }); // Set alpha to true
        renderer.setClearColor(0x000000, 0); // Set clear color to black and fully transparent
        renderer.setSize(mount.clientWidth, mount.clientHeight);
        mount.appendChild(renderer.domElement); // Attach the renderer to the DOM

        const spotLight = new THREE.SpotLight(0xffffff);
        spotLight.position.set(100, 100, 100);
        scene.add(spotLight);

        const geometry = new THREE.SphereGeometry(30, 20, 20);

        const earth = new THREE.Mesh(geometry, Mat());
        scene.add(earth);

        camera.position.z = 90;

        let frame = 0;
        const animate = () => {
            frame = requestAnimationFrame(animate);
            earth.rotation.y += 0.005; // Decreased rotation speed
            renderer.render(scene, camera);
        };

        animate();

        const handleResize = () => {
            if (!mount) return;
            camera.aspect = mount.clientWidth / mount.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(mount.clientWidth, mount.clientHeight);
        };

        window.addEventListener('resize', handleResize);

        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('resize', handleResize);
            if (renderer.domElement.parentNode) {
                renderer.domElement.parentNode.removeChild(renderer.domElement);
            }
            geometry.dispose();
            renderer.dispose();
        };
    }, []);

    return <StyleGlobe ref={globeRef} />;
};

export default Globe;