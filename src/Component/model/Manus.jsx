import React from "react";
import { useGLTF, useAnimations } from "@react-three/drei";

function Manus() {
  const { nodes, animations } = useGLTF("./wireframe.glb");
  const { actions, ref } = useAnimations(animations);

  React.useEffect(() => {
    actions.forEach((action) => action.play());
  }, [actions]);

  return <primitive ref={ref} object={nodes.scene} position={[0, -1, 3]} />;
}

export default Manus;
