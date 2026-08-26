import { Canvas, useFrame } from "@react-three/fiber";
import { useReducedMotion } from "motion/react";
import { useMemo, useRef } from "react";
import * as THREE from "three";

function SignalNetwork({ animate }: { animate: boolean }) {
  const groupRef = useRef<THREE.Group>(null);

  const points = useMemo(
    () => [
      new THREE.Vector3(-2.8, -0.25, 0.2),
      new THREE.Vector3(-1.65, 0.55, -0.15),
      new THREE.Vector3(-0.45, -0.2, 0.35),
      new THREE.Vector3(0.7, 0.65, -0.25),
      new THREE.Vector3(1.8, -0.15, 0.25),
      new THREE.Vector3(2.7, 0.35, -0.1),
    ],
    [],
  );

  const lineGeometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);

  useFrame((state, delta) => {
    if (!animate || !groupRef.current) return;
    groupRef.current.rotation.y += delta * 0.075;
    groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.35) * 0.025;
  });

  return (
    <group ref={groupRef}>
      <primitive
        object={new THREE.Line(
          lineGeometry,
          new THREE.LineBasicMaterial({ color: "#60a5fa", transparent: true, opacity: 0.58 }),
        )}
      />

      {points.map((point, index) => (
        <mesh key={index} position={point}>
          <sphereGeometry args={[index === 2 ? 0.14 : 0.09, 20, 20]} />
          <meshStandardMaterial
            color="#2563eb"
            emissive="#60a5fa"
            emissiveIntensity={index === 2 ? 2.4 : 1.25}
            roughness={0.25}
          />
        </mesh>
      ))}
    </group>
  );
}

export default function SignalField3D() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="signal-field-3d" aria-hidden="true">
      <Canvas camera={{ position: [0, 0, 6.8], fov: 42 }} dpr={[1, 1.5]}>
        <ambientLight intensity={0.5} />
        <pointLight position={[0, 2, 4]} color="#2563eb" intensity={18} />
        <SignalNetwork animate={!reduceMotion} />
      </Canvas>
    </div>
  );
}
