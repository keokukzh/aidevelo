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
  celebrateAgent: (position: [number, number, number]) => void;
  toggleIsometric: () => void;
  resetIdleTimer: () => void;
}

const HOME_POSITION = new THREE.Vector3(0, 6, 10);
const HOME_TARGET = new THREE.Vector3(0, 0, 0);
const LERP_SPEED = 2.5;
const RETURN_SPEED = 3.0;
const IDLE_TIMEOUT = 10.0;
const ORBIT_SPEED = 0.1;
const ISOMETRIC_POSITION = new THREE.Vector3(0, 15, 15);
const ISOMETRIC_TARGET = new THREE.Vector3(0, 0, 0);

export const CameraController = forwardRef<CameraControllerHandle, CameraControllerProps>(
  ({ onFocusChange }, ref) => {
    const { camera } = useThree();
    const orbitRef = useRef<any>(null);
    const targetPosition = useRef(new THREE.Vector3(0, 6, 10));
    const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));
    const currentLookAt = useRef(new THREE.Vector3(0, 0, 0));
    const selectedAgentId = useRef<string | null>(null);
    const isReturningHome = useRef(false);
    const isOrbiting = useRef(false);
    const isIsometric = useRef(false);
    const idleTimer = useRef(0);
    const orbitAngle = useRef(0);
    const celebrationTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const resetIdleTimer = () => {
      idleTimer.current = 0;
      if (isOrbiting.current) {
        isOrbiting.current = false;
      }
    };

    const clearCelebration = () => {
      if (celebrationTimeout.current) {
        clearTimeout(celebrationTimeout.current);
        celebrationTimeout.current = null;
      }
    };

    useImperativeHandle(ref, () => ({
      focusOnAgent: (position: [number, number, number], agentId: string) => {
        clearCelebration();
        selectedAgentId.current = agentId;
        isReturningHome.current = false;
        isOrbiting.current = false;
        isIsometric.current = false;
        resetIdleTimer();

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
        clearCelebration();
        selectedAgentId.current = null;
        isReturningHome.current = true;
        isOrbiting.current = false;
        isIsometric.current = false;
        resetIdleTimer();
        targetPosition.current.copy(HOME_POSITION);
        targetLookAt.current.copy(HOME_TARGET);
        onFocusChange?.(null);
      },
      celebrateAgent: (position: [number, number, number]) => {
        clearCelebration();
        const celebratePos = new THREE.Vector3(position[0], position[1] + 2, position[2] + 3);
        targetPosition.current.copy(celebratePos);
        targetLookAt.current.set(position[0], position[1], position[2]);

        celebrationTimeout.current = setTimeout(() => {
          const normalPos = new THREE.Vector3(position[0], position[1] + 4, position[2] + 6);
          targetPosition.current.copy(normalPos);
        }, 1000);
      },
      toggleIsometric: () => {
        clearCelebration();
        if (isIsometric.current) {
          isIsometric.current = false;
          targetPosition.current.copy(HOME_POSITION);
          targetLookAt.current.copy(HOME_TARGET);
          isReturningHome.current = true;
        } else {
          isIsometric.current = true;
          isOrbiting.current = false;
          isReturningHome.current = false;
          targetPosition.current.copy(ISOMETRIC_POSITION);
          targetLookAt.current.copy(ISOMETRIC_TARGET);
        }
        resetIdleTimer();
      },
      resetIdleTimer,
    }));

    useFrame((_, delta) => {
      if (!orbitRef.current) return;

      if (!selectedAgentId.current && !isIsometric.current && !isReturningHome.current) {
        idleTimer.current += delta;
        if (idleTimer.current > IDLE_TIMEOUT && !isOrbiting.current) {
          isOrbiting.current = true;
          orbitAngle.current = Math.atan2(camera.position.x, camera.position.z);
        }
      }

      if (isOrbiting.current) {
        orbitAngle.current += delta * ORBIT_SPEED;
        const radius = 12;
        targetPosition.current.set(
          Math.sin(orbitAngle.current) * radius,
          6,
          Math.cos(orbitAngle.current) * radius
        );
        targetLookAt.current.set(0, 0, 0);
      }

      const speed = isReturningHome.current ? RETURN_SPEED : LERP_SPEED;

      camera.position.lerp(targetPosition.current, Math.min(1, delta * speed));
      currentLookAt.current.lerp(targetLookAt.current, Math.min(1, delta * speed));
      orbitRef.current.target.copy(currentLookAt.current);
      orbitRef.current.update();
    });

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