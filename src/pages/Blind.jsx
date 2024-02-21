import React from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import Manus from "../Component/model/Manus";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.log(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <h1>Something went wrong.</h1>;
    }

    return this.props.children;
  }
}

function Blind() {
  return (
    <ErrorBoundary>
      <Canvas gl={{ alpha: false }}>
        <ambientLight intensity={2} />
        <OrbitControls />
        <Manus />
      </Canvas>
    </ErrorBoundary>
  );
}

export default Blind;
