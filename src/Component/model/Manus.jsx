import React from "react";
import { useGLTF } from "@react-three/drei";

function Manus() {
  const model = useGLTF("./wireframe.glb");
  return (
    <>
      <primitive object={model.scene} position={[0, -1, 3]}></primitive>
    </>
  );
}

export default Manus;
