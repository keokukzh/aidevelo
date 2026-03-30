import { useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

interface CameraControllerProps {
  onFocusChange?: (agentId: string | null) => void;
}

export interface CameraControllerHandle {
  focusOnAgent: (position: [number, number, number], agentId: string) => void;
  returnHome: () => void;
}

const HOME_POSITION = new THREE.Vector3(0, 6, 10);
const HOME_TARGET = new THREE.Vector3(0, 0, 0);
const LERP_SPEED = 2.5;
const RETURN_SPEED = 3.0;

export const CameraController = forwardRef<CameraControllerHandle, CameraControllerProps>(
  ({ onFocusChange }, ref) => {
    const { camera } = useThree();
    const orbitRef = useRef<any>(null);
    const targetPosition = useRef(new THREE.Vector3(0, 6, 10));
    const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));
    const currentLookAt = useRef(new THREE.Vector3(0, 0, 0));
    const selectedAgentId = useRef<string | null>(null);
    const isReturningHome = useRef(false);

    useImperativeHandle(ref, () => ({
      focusOnAgent: (position: [number, number, number], agentId: string) => {
        selectedAgentId.current = agentId;
        isReturningHome.current = false;

        // Camera positions itself in front of the desk
        const focusPos = new THREE.Vector3(
          position[0],
          position[1] + 4,
          position[2] + 6
        );
        targetPosition.current.copy(focusPos);
        targetLookAt.current.set(position[0], position[1], position[2]);

        onFocusChange?.(agentId);
      },
      returnHome: () => {
        selectedAgentId.current = null;
        isReturningHome.current = true;
        targetPosition.current.copy(HOME_POSITION);
        targetLookAt.current.copy(HOME_TARGET);
        onFocusChange?.(null);
      },
    }));

    useFrame((_, delta) => {
      if (!orbitRef.current) return;

      const speed = isReturningHome.current ? RETURN_SPEED : LERP_SPEED;

      // Lerp camera position
      camera.position.lerp(targetPosition.current, Math.min(1, delta * speed));

      // Lerp orbit target
      currentLookAt.current.lerp(targetLookAt.current, Math.min(1, delta * speed));
      orbitRef.current.target.copy(currentLookAt.current);
      orbitRef.current.update();
    });

    // Set initial camera position
    useEffect(() => {
      camera.position.copy(HOME_POSITION);
      currentLookAt.current.copy(HOME_TARGET);
    }, [camera]);

    return (
      <OrbitControls
        ref={orbitRef}
        enableDamping
        dampingFactor={0.05}
        minPolarAngle={Math.PI * 0.1}
        maxPolarAngle={Math.PI * 0.45}
        minDistance={3}
        maxDistance={25}
      />
    );
  }
);

CameraController.displayName = "CameraController";